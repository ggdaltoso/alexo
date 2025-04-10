import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export function useTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  return format(time, 'HH:mm');
}