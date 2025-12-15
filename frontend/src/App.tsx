import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import PixelatedClock from './components/PixelatedClock';
import ForecastDashboard from './components/ForecastDashboard';
import CalendarScreen from './components/CalendarScreen';
import MessageScreen from './components/MessageScreen';

const KEYBOARD_ROUTES = ['/', '/forecast', '/calendar', '/message'];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
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

  return (
    <Routes>
      <Route path="/" element={<PixelatedClock />} />
      <Route path="/forecast" element={<ForecastDashboard />} />
      <Route path="/calendar" element={<CalendarScreen />} />
      <Route path="/message" element={<MessageScreen />} />
    </Routes>
  );
}
