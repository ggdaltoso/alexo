import { Routes, Route } from 'react-router-dom';
import { ForecastDashboard } from './screens/ForecastDashboard';
import CalendarScreen from './screens/CalendarScreen';
import MessageScreen from './screens/MessageScreen';
import { Clock } from './screens/Clock';
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
    <>
      <Routes>
        <Route path="/" element={<Clock />} />
        <Route path="/forecast" element={<ForecastDashboard />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/message" element={<MessageScreen />} />
      </Routes>
      <Frame
        position="fixed"
        bottom="10px"
        left="10px"
        right="10px"
        width={`${window.innerWidth - 20}px`}
      >
        <ProgressBar
          width={`${window.innerWidth - 20}px`}
          percent={Math.min(100, Math.max(0, timerProgress))}
        />
      </Frame>
    </>
  );
}
