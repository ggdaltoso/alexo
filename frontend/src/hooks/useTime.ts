import { useState, useEffect } from 'react';

export function useTime() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  return time;
}
