import { useQuery } from '@tanstack/react-query';
import { Sun, Cloud, CloudRain, CloudSnow, CloudDrizzle, CloudLightning } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

function getWeatherInfo(code: number): { label: string; Icon: LucideIcon; color: string } {
  if (code <= 1)  return { label: 'Clear',        Icon: Sun,            color: 'text-yellow-300' };
  if (code <= 3)  return { label: 'Cloudy',       Icon: Cloud,          color: 'text-gray-400'   };
  if (code <= 48) return { label: 'Foggy',        Icon: Cloud,          color: 'text-gray-500'   };
  if (code <= 55) return { label: 'Drizzle',      Icon: CloudDrizzle,   color: 'text-blue-300'   };
  if (code <= 65) return { label: 'Rain',         Icon: CloudRain,      color: 'text-blue-400'   };
  if (code <= 77) return { label: 'Snow',         Icon: CloudSnow,      color: 'text-sky-200'    };
  if (code <= 82) return { label: 'Showers',      Icon: CloudRain,      color: 'text-blue-400'   };
  return                 { label: 'Thunderstorm', Icon: CloudLightning, color: 'text-purple-400' };
}

export default function WeatherWidget({ compact = false }: { compact?: boolean }) {
  const { data: coords } = useQuery<{ lat: number; lon: number }>({
    queryKey: ['geolocation'],
    queryFn: () =>
      new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          reject,
          { timeout: 8000 },
        )
      ),
    staleTime: Infinity,
    retry: false,
  });

  const { data: weather } = useQuery<any>({
    queryKey: ['weather', coords?.lat, coords?.lon],
    queryFn: async () => {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords!.lat}&longitude=${coords!.lon}` +
        `&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
      );
      return res.json();
    },
    enabled: !!coords,
    staleTime: 10 * 60 * 1000,
  });

  const { data: city } = useQuery<string>({
    queryKey: ['city', coords?.lat, coords?.lon],
    queryFn: async () => {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coords!.lat}&lon=${coords!.lon}&format=json`
      );
      const d = await res.json();
      return d.address?.city || d.address?.town || d.address?.village || d.address?.county || '';
    },
    enabled: !!coords,
    staleTime: Infinity,
  });

  if (!weather) return null;

  const temp = Math.round(weather.current.temperature_2m);
  const code = weather.current.weather_code;
  const { label, Icon, color } = getWeatherInfo(code);

  if (compact) {
    return (
      <div className="flex items-center gap-2.5">
        <Icon size={22} className={color} />
        <div>
          <p className="text-base font-semibold text-white leading-none">{temp}°F</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}{city ? ` · ${city}` : ''}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
      <Icon size={28} className={color} />
      <div>
        <p className="text-2xl font-semibold text-white leading-none">{temp}°F</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}{city ? ` · ${city}` : ''}</p>
      </div>
    </div>
  );
}
