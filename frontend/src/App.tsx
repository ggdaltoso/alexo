import { Routes, Route } from 'react-router-dom';
import { ForecastDashboard } from './screens/ForecastDashboard';
import CalendarScreen from './screens/CalendarScreen';
import MessageScreen from './screens/MessageScreen';
import { Clock } from './screens/Clock';
import { useApp } from './contexts';
import { Loader } from 'lucide-react';

export default function App() {
  const { weatherLoading: loading } = useApp();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Clock />} />
      <Route path="/forecast" element={<ForecastDashboard />} />
      <Route path="/calendar" element={<CalendarScreen />} />
      <Route path="/message" element={<MessageScreen />} />
    </Routes>
  );
}
