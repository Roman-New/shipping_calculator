import React, { useState, useEffect, useCallback } from 'react';
import { 
  Truck, 
  MapPin, 
  Navigation, 
  Weight, 
  Box, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  Info
} from 'lucide-react';
import debounce from 'lodash.debounce';

// Constants
const GRAPH_HOPPER_KEY = '815dcb17-ae9f-4045-8cd7-ffc715e44b23';
const KIROV_CENTER = { lat: 58.600618, lng: 49.639762 };
const NEW_BRIDGE = { lat: 58.650113, lng: 49.598264 };
const BASE_DISTANCE = 5.5;

type CargoType = 'Sand' | 'CrushedStone' | 'Gravel' | 'Soil';

interface CargoOption {
  value: CargoType;
  label: string;
  coefficient: number;
}

const CARGO_OPTIONS: CargoOption[] = [
  { value: 'Sand', label: 'Песок', coefficient: 1.6 },
  { value: 'CrushedStone', label: 'Щебень', coefficient: 1.6 },
  { value: 'Gravel', label: 'Гравий', coefficient: 1.6 },
  { value: 'Soil', label: 'Грунт', coefficient: 1.7 },
];

interface Suggestion {
  name: string;
  city: string;
  street?: string;
  point: {
    lat: number;
    lng: number;
  };
}

export default function App() {
  const [cargoType, setCargoType] = useState<CargoType>('Sand');
  const [volume, setVolume] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [destination, setDestination] = useState<Suggestion['point'] | null>(null);
  const [viaNewBridge, setViaNewBridge] = useState(false);
  
  const [distance, setDistance] = useState<number | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [truckType, setTruckType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);

  // Auto-calculate weight when volume or cargo type changes
  useEffect(() => {
    if (volume && !isNaN(parseFloat(volume))) {
      const option = CARGO_OPTIONS.find(o => o.value === cargoType);
      if (option) {
        const calculatedWeight = parseFloat(volume) * option.coefficient;
        setWeight(calculatedWeight.toFixed(2));
      }
    }
  }, [volume, cargoType]);

  // Handle manual weight input
  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWeight(val);
    if (val === '') {
      // If weight is cleared, we don't clear volume automatically to avoid confusion, 
      // but if the user wants to calculate weight FROM volume again, they'd just change volume.
    }
  };

  // Debounced search for GraphHopper Geocoding
  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }

      setIsAutocompleteLoading(true);
      try {
        const response = await fetch(
          `https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(query)}&locale=ru&limit=5&key=${GRAPH_HOPPER_KEY}&point=${KIROV_CENTER.lat},${KIROV_CENTER.lng}`
        );
        const data = await response.json();
        
        if (data.hits) {
          const formatted: Suggestion[] = data.hits.map((hit: any) => ({
            name: hit.name || hit.street || 'Неизвестно',
            city: hit.city || '',
            street: hit.street || '',
            point: hit.point
          }));
          setSuggestions(formatted);
        }
      } catch (err) {
        console.error('Geocoding error:', err);
      } finally {
        setIsAutocompleteLoading(false);
      }
    }, 500),
    []
  );

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddress(value);
    setDestination(null); // Reset destination if user types
    fetchSuggestions(value);
  };

  const selectSuggestion = (s: Suggestion) => {
    const label = [s.city, s.street, s.name].filter(Boolean).join(', ');
    setAddress(label);
    setDestination(s.point);
    setSuggestions([]);
  };

  const calculateRoute = async () => {
    if (!destination) {
      setError('Пожалуйста, выберите адрес из списка');
      return;
    }

    const currentWeight = parseFloat(weight);
    if (!currentWeight || currentWeight <= 0) {
      setError('Пожалуйста, укажите вес груза');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let points = `point=${KIROV_CENTER.lat},${KIROV_CENTER.lng}`;
      if (viaNewBridge) {
        points += `&point=${NEW_BRIDGE.lat},${NEW_BRIDGE.lng}`;
      }
      points += `&point=${destination.lat},${destination.lng}`;

      const url = `https://graphhopper.com/api/1/route?${points}&profile=car&locale=ru&calc_points=false&key=${GRAPH_HOPPER_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0].message || 'Ошибка при расчете маршрута');
      }

      const distKm = data.paths[0].distance / 1000;
      setDistance(distKm);

      // Calculation logic
      let finalCost = 0;
      let truckLabel = '';

      if (currentWeight <= 16) {
        truckLabel = 'Камаз';
        finalCost = 5500;
        if (distKm > BASE_DISTANCE) {
          finalCost += (distKm - BASE_DISTANCE) * 110;
        }
      } else {
        truckLabel = 'Шахман';
        finalCost = 7500;
        if (distKm > BASE_DISTANCE) {
          finalCost += (distKm - BASE_DISTANCE) * 150;
        }
      }

      setCost(Math.round(finalCost));
      setTruckType(truckLabel);

    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при расчете. Проверьте подключение.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl mb-4 text-white shadow-lg">
            <Truck size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Калькулятор доставки</h1>
          <p className="text-slate-500 mt-2">Киров и область — расчет стоимости сыпучих грузов</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Side */}
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 space-y-6">
            <div className="space-y-4">
              {/* Cargo Type */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                  <Box size={16} /> Что перевозим
                </label>
                <select 
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value as CargoType)}
                  className="w-full bg-slate-100 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                >
                  {CARGO_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Volume and Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                    Объем (м³)
                  </label>
                  <input 
                    type="number"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="м³"
                    className="w-full bg-slate-100 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                    <Weight size={16} /> Вес (тонны)
                  </label>
                  <input 
                    type="number"
                    value={weight}
                    onChange={handleWeightChange}
                    placeholder="т"
                    className="w-full bg-slate-100 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Address Autocomplete */}
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                  <MapPin size={16} /> Место разгрузки
                </label>
                <div className="relative">
                  <input 
                    type="text"
                    value={address}
                    onChange={handleAddressChange}
                    placeholder="Начните вводить адрес в Кирове..."
                    className="w-full bg-slate-100 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                  {isAutocompleteLoading && (
                    <div className="absolute right-3 top-3">
                      <Loader2 size={20} className="animate-spin text-slate-400" />
                    </div>
                  )}
                </div>

                {suggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white mt-1 rounded-xl shadow-2xl border border-slate-100 overflow-hidden">
                    {suggestions.map((s, idx) => (
                      <li 
                        key={idx}
                        onClick={() => selectSuggestion(s)}
                        className="px-4 py-3 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-50 last:border-0 flex items-start gap-2"
                      >
                        <MapPin size={14} className="mt-1 text-slate-400" />
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-slate-400">{s.city}{s.street ? `, ${s.street}` : ''}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Routing options */}
              <div className="flex items-center gap-3 py-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={viaNewBridge}
                    onChange={(e) => setViaNewBridge(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-slate-600">Через Новый мост</span>
                </label>
              </div>
            </div>

            <button 
              onClick={calculateRoute}
              disabled={loading || !destination}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  Рассчитать стоимость 
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Results Side */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 h-full flex flex-col">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Navigation size={20} className="text-blue-500" />
                Результат расчета
              </h2>

              {!cost && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-100 rounded-2xl">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Info size={24} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400">Введите данные и адрес доставки, чтобы увидеть стоимость</p>
                </div>
              )}

              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                  <p className="text-slate-500">Строим маршрут и считаем...</p>
                </div>
              )}

              {cost && !loading && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                    <div className="text-sm text-blue-600 font-semibold mb-1 uppercase tracking-wider">Итоговая стоимость</div>
                    <div className="text-4xl font-black text-blue-900">
                      {cost.toLocaleString('ru-RU')} <span className="text-2xl font-bold">₽</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <div className="text-xs text-slate-500 mb-1">Расстояние</div>
                      <div className="text-lg font-bold">{distance?.toFixed(1)} км</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <div className="text-xs text-slate-500 mb-1">Транспорт</div>
                      <div className="text-lg font-bold text-orange-600">{truckType}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm py-2 border-b border-slate-100">
                      <span className="text-slate-500">Вес груза</span>
                      <span className="font-semibold">{weight} т</span>
                    </div>
                    <div className="flex justify-between text-sm py-2 border-b border-slate-100">
                      <span className="text-slate-500">Базовый тариф</span>
                      <span className="font-semibold">{parseFloat(weight) <= 16 ? '5 500' : '7 500'} ₽</span>
                    </div>
                    {distance && distance > BASE_DISTANCE && (
                      <div className="flex justify-between text-sm py-2 border-b border-slate-100">
                        <span className="text-slate-500">Доплата за км (+{(distance - BASE_DISTANCE).toFixed(1)} км)</span>
                        <span className="font-semibold text-green-600">
                          +{(Math.round((distance - BASE_DISTANCE) * (parseFloat(weight) <= 16 ? 110 : 150))).toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-6">
                    <div className="p-4 bg-amber-50 rounded-xl text-amber-800 text-xs leading-relaxed border border-amber-100">
                      <strong>Примечание:</strong> Расчет является предварительным. Итоговая стоимость может измениться в зависимости от дорожной ситуации и сложности подъезда.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
