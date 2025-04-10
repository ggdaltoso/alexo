import React from 'react';
import PixelatedClock from './PixelatedClock';
import { useTime } from '../hooks/useTime';

const timeZones = [
  { label: 'PST', timeZone: 'America/Los_Angeles' },
  { label: 'São Paulo', timeZone: 'America/Sao_Paulo' },
  { label: 'Spain', timeZone: 'Europe/Madrid' },
];

const Clock = ({ timeZone, label }: { timeZone: string; label: string }) => {
  const time = useTime(timeZone);

  return (
    <div key={timeZone} className="flex flex-col items-center">
      <PixelatedClock size={60} date={time} />
      <span className="block text-xs text-gray-500 mt-2">{label}</span>
      <span className="block text-xs font-bold">
        {time.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
      </span>
    </div>
  );
};

export const WorldClocks: React.FC = () => {
  return (
    <div className="flex justify-evenly items-center">
      {timeZones.map(({ label, timeZone }) => (
        <Clock key={timeZone} timeZone={timeZone} label={label} />
      ))}
    </div>
  );
};
