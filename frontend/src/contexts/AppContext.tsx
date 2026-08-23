import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { WeatherData, Coordinates, NFCMessage } from '../types';
import { wsService } from '../services/websocket';
import { useWeather } from '../hooks/useWeather';

interface AppContextType {
  // Weather
  weather: WeatherData | null;
  weatherLoading: boolean;
  weatherError: string | null;

  // Navigation
  navigateToNext: () => void;
  navigateToPrevious: () => void;
  navigateToScreen: (index: number) => void;

  // Messages
  currentMessage: NFCMessage | null;

  // Timer
  timerProgress: number; // 0-100
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SAO_VICENTE_COORDINATES: Coordinates = {
  latitude: -23.9633, // São Vicente, SP, Brazil
  longitude: -46.3919,
};

// Routes for automatic and manual navigation (excluding /message and /calendar)
const NAVIGATION_ROUTES = ['/', '/forecast', '/exchange'];

const TIMER_DURATION = 10000; // 10 seconds
const TIMER_INTERVAL = 100; // Update progress every 100ms

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // Use the useWeather hook with React Query
  const {
    data: weather = null,
    isLoading: weatherLoading,
    error: weatherQueryError,
  } = useWeather(SAO_VICENTE_COORDINATES);

  const weatherError = weatherQueryError
    ? 'Failed to fetch weather data'
    : null;

  // Message state
  const [currentMessage, setCurrentMessage] = useState<NFCMessage | null>(null);

  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);

  // Calculate progress percentage from elapsed time
  const timerProgress = Math.min(
    100,
    Math.round((elapsedTime / TIMER_DURATION) * 100),
  );

  // Navigation
  const navigate = useNavigate();
  const location = useLocation();

  // Helper function to reset timer
  const resetTimer = () => {
    setElapsedTime(0);
  };

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
    const unsubscribe = wsService.subscribe((event) => {
      // Discriminar pelo `type` é obrigatório: `broadcast()` manda para todos os
      // clientes sem filtro, então este callback vê TODO evento do backend, não
      // só as mensagens. Sem o switch, um `gallery_updated` (que não tem
      // `message` nem `timestamp`) virava uma NFCMessage malformada no estado.
      switch (event.type) {
        case 'nfc_message':
          // Guarda a mensagem para quem navegar até /message, e nada mais.
          // A regra que interrompia a tela automaticamente (ir para /message ao
          // receber, e voltar 10s depois) foi removida: a página saiu de uso.
          setCurrentMessage({
            type: event.messageType,
            message: event.message,
            timestamp: event.timestamp,
          });
          break;

        case 'gallery_updated':
          // Ignorado de propósito: a Galeria faz polling e não escuta o WS.
          break;

        default:
          // Variante que este cliente ainda não conhece (backend mais novo).
          break;
      }
    });

    return () => {
      unsubscribe();
      wsService.disconnect();
    };
  }, []);

  // Auto-navigation timer effect
  useEffect(() => {
    // Only run the carousel timer on the navigation routes
    if (!NAVIGATION_ROUTES.includes(location.pathname)) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime((prev) => {
        const newElapsed = prev + TIMER_INTERVAL;

        // When timer completes, navigate to next route
        if (newElapsed >= TIMER_DURATION) {
          const currentIndex = NAVIGATION_ROUTES.indexOf(location.pathname);
          const nextRoute =
            NAVIGATION_ROUTES[(currentIndex + 1) % NAVIGATION_ROUTES.length];
          navigate(nextRoute);
          return 0; // Reset elapsed time
        }

        return newElapsed;
      });
    }, TIMER_INTERVAL);

    return () => clearInterval(interval);
  }, [location.pathname, navigate]);

  // Keyboard navigation effect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const idx = NAVIGATION_ROUTES.indexOf(location.pathname);
        navigate(NAVIGATION_ROUTES[(idx + 1) % NAVIGATION_ROUTES.length]);
        resetTimer(); // Reset timer on manual navigation
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const idx = NAVIGATION_ROUTES.indexOf(location.pathname);
        navigate(
          NAVIGATION_ROUTES[
            (idx - 1 + NAVIGATION_ROUTES.length) % NAVIGATION_ROUTES.length
          ],
        );
        resetTimer(); // Reset timer on manual navigation
      } else if (e.key >= '1' && e.key <= '3') {
        navigate(NAVIGATION_ROUTES[parseInt(e.key, 10) - 1]);
        resetTimer(); // Reset timer on manual navigation
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, location.pathname]);

  // Navigation helpers
  const navigateToNext = () => {
    const idx = NAVIGATION_ROUTES.indexOf(location.pathname);
    navigate(NAVIGATION_ROUTES[(idx + 1) % NAVIGATION_ROUTES.length]);
  };

  const navigateToPrevious = () => {
    const idx = NAVIGATION_ROUTES.indexOf(location.pathname);
    navigate(
      NAVIGATION_ROUTES[
        (idx - 1 + NAVIGATION_ROUTES.length) % NAVIGATION_ROUTES.length
      ],
    );
  };

  const navigateToScreen = (index: number) => {
    if (index >= 0 && index < NAVIGATION_ROUTES.length) {
      navigate(NAVIGATION_ROUTES[index]);
    }
  };

  const value: AppContextType = {
    weather,
    weatherLoading,
    weatherError,
    navigateToNext,
    navigateToPrevious,
    navigateToScreen,
    currentMessage,
    timerProgress,
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
