import React from 'react';
import PixelatedClock from './PixelatedClock';
import { useTime } from '../hooks/useTime';

const timeZones = [
  { label: 'PST', timeZone: 'America/Los_Angeles' },
  { label: 'São Paulo', timeZone: 'America/Sao_Paulo' },
  { label: 'Spain', timeZone: 'Europe/Madrid' },
];

const getTimeForZone = (timeZone: string) => {
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

  // Create a new Date object with the correct time for the time zone
  const timeInZone = new Date(now);
  timeInZone.setHours(hours, minutes, seconds, 0);

  return timeInZone;
};

const Clock = ({ timeZone, label }: { timeZone: string; label: string }) => {
  const time = useTime(getTimeForZone(timeZone));

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
