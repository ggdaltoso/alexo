import { useState, useEffect, useCallback } from 'react';

const REFRESH_RATE = 1000; // Update every second

export function useTime(timeZone: string) {
  const getTimeInZone = useCallback(() => {
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
  }, [timeZone]);

  const [time, setTime] = useState(getTimeInZone);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(getTimeInZone());
    }, REFRESH_RATE);

    return () => clearInterval(timer);
  }, [timeZone]);

  return time;
}
