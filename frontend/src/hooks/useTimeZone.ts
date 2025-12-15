import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

const REFRESH_RATE = 1000; // Update every second

export function useTimeZone(timeZone: string) {
  const { getTimeInZone } = useApp();
  const [time, setTime] = useState(() => getTimeInZone(timeZone));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(getTimeInZone(timeZone));
    }, REFRESH_RATE);

    return () => clearInterval(timer);
  }, [timeZone, getTimeInZone]);

  return time;
}
