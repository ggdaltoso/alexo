import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { WeatherData, Coordinates, NFCMessage } from '../types';
import { wsService } from '../services/websocket';
import { apiService } from '../services/api';

interface AppContextType {
  // Weather
  weather: WeatherData | null;
  weatherLoading: boolean;
  weatherError: string | null;

  // Time
  currentTime: Date;
  getTimeInZone: (timeZone: string) => Date;

  // Navigation
  navigateToNext: () => void;
  navigateToPrevious: () => void;
  navigateToScreen: (index: number) => void;

  // Messages
  currentMessage: NFCMessage | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SAO_VICENTE_COORDINATES: Coordinates = {
  latitude: -23.9633, // São Vicente, SP, Brazil
  longitude: -46.3919,
};

const KEYBOARD_ROUTES = ['/', '/forecast', '/calendar', '/message'];

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // Weather state
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [coordinates] = useState<Coordinates>(SAO_VICENTE_COORDINATES);

  // Time state
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Message state
  const [currentMessage, setCurrentMessage] = useState<NFCMessage | null>(null);

  // Navigation
  const navigate = useNavigate();
  const location = useLocation();

  // Weather effect
  useEffect(() => {
    async function fetchWeather() {
      try {
        setWeatherLoading(true);
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${coordinates.latitude}&longitude=${coordinates.longitude}` +
            `&current=temperature_2m,wind_speed_10m,weather_code` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
            `&timezone=America/Sao_Paulo`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch weather data');
        }

        const data = await response.json();

        setWeather({
          current: {
            temperature: Math.round(data.current.temperature_2m),
            windSpeed: Math.round(data.current.wind_speed_10m),
            weatherCode: data.current.weather_code,
            time: data.current.time,
          },
          daily: data.daily.time.map((date: string, index: number) => ({
            date,
            temperatureMax: Math.round(data.daily.temperature_2m_max[index]),
            temperatureMin: Math.round(data.daily.temperature_2m_min[index]),
            precipitationProbability:
              data.daily.precipitation_probability_max[index],
            windSpeed: Math.round(data.daily.wind_speed_10m_max[index]),
            weatherCode: data.daily.weather_code[index],
          })),
        });
        setWeatherError(null);
      } catch (err) {
        setWeatherError('Failed to fetch weather data');
      } finally {
        setWeatherLoading(false);
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 1800000); // Update every 30 minutes

    return () => clearInterval(interval);
  }, [coordinates]);

  // Time effect
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Backend connection effect
  useEffect(() => {
    // Fetch initial state
    // apiService
    //   .getState()
    //   .then((state) => {
    //     setCurrentMessage(state.message);
    //   })
    //   .catch((error) => {
    //     console.error('Failed to fetch initial state:', error);
    //   });

    // Connect to WebSocket for real-time updates
    wsService.connect();
    const unsubscribe = wsService.subscribe((message) => {
      setCurrentMessage(message);
    });

    return () => {
      unsubscribe();
      wsService.disconnect();
    };
  }, []);

  // Helper to get time in a specific timezone
  const getTimeInZone = useCallback((timeZone: string) => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hours = parseInt(
      parts.find((part) => part.type === 'hour')?.value || '0',
      10,
    );
    const minutes = parseInt(
      parts.find((part) => part.type === 'minute')?.value || '0',
      10,
    );
    const seconds = parseInt(
      parts.find((part) => part.type === 'second')?.value || '0',
      10,
    );

    const timeInZone = new Date(now);
    timeInZone.setHours(hours, minutes, seconds, 0);

    return timeInZone;
  }, []);

  // Keyboard navigation effect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const idx = KEYBOARD_ROUTES.indexOf(location.pathname);
        navigate(KEYBOARD_ROUTES[(idx + 1) % KEYBOARD_ROUTES.length]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const idx = KEYBOARD_ROUTES.indexOf(location.pathname);
        navigate(
          KEYBOARD_ROUTES[
            (idx - 1 + KEYBOARD_ROUTES.length) % KEYBOARD_ROUTES.length
          ],
        );
      } else if (e.key >= '1' && e.key <= '4') {
        navigate(KEYBOARD_ROUTES[parseInt(e.key, 10) - 1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, location.pathname]);

  // Navigation helpers
  const navigateToNext = () => {
    const idx = KEYBOARD_ROUTES.indexOf(location.pathname);
    navigate(KEYBOARD_ROUTES[(idx + 1) % KEYBOARD_ROUTES.length]);
  };

  const navigateToPrevious = () => {
    const idx = KEYBOARD_ROUTES.indexOf(location.pathname);
    navigate(
      KEYBOARD_ROUTES[
        (idx - 1 + KEYBOARD_ROUTES.length) % KEYBOARD_ROUTES.length
      ],
    );
  };

  const navigateToScreen = (index: number) => {
    if (index >= 0 && index < KEYBOARD_ROUTES.length) {
      navigate(KEYBOARD_ROUTES[index]);
    }
  };

  const value: AppContextType = {
    weather,
    weatherLoading,
    weatherError,
    currentTime,
    getTimeInZone,
    navigateToNext,
    navigateToPrevious,
    navigateToScreen,
    currentMessage,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
