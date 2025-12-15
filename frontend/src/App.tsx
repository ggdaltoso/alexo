import { Routes, Route } from 'react-router-dom';
import ForecastDashboard from './screens/ForecastDashboard';
import CalendarScreen from './screens/CalendarScreen';
import MessageScreen from './screens/MessageScreen';
import { CurrentWeather } from './screens/CurrentWeather';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CurrentWeather />} />
      <Route path="/forecast" element={<ForecastDashboard />} />
      <Route path="/calendar" element={<CalendarScreen />} />
      <Route path="/message" element={<MessageScreen />} />
    </Routes>
  );
}
