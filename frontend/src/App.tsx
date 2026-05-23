import { Routes, Route } from 'react-router-dom';
import { ForecastDashboard } from './screens/ForecastDashboard';
import CalendarScreen from './screens/CalendarScreen';
import MessageScreen from './screens/MessageScreen';
import { Clock } from './screens/Clock';
import { ExchangeRateScreen } from './screens/ExchangeRateScreen';
import { useApp } from './contexts';
import { Loader } from 'lucide-react';
import { Frame, ProgressBar } from '@react95/core';

export default function App() {
  const { weatherLoading: loading, timerProgress } = useApp();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Clock />} />
          <Route path="/forecast" element={<ForecastDashboard />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/message" element={<MessageScreen />} />
          <Route path="/exchange" element={<ExchangeRateScreen />} />
        </Routes>
      </div>
      <Frame width={`${window.innerWidth / 2}px`}>
        <ProgressBar
          width={`${window.innerWidth / 2}px`}
          percent={Math.min(100, Math.max(0, timerProgress))}
        />
      </Frame>
    </div>
  );
}
