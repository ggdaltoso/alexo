import { useState, useEffect } from 'react';

export function useTime(initialDate?: Date) {
  const [time, setTime] = useState(initialDate || new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime((prevTime) => {
        const newTime = new Date(prevTime.getTime());
        newTime.setMinutes(newTime.getMinutes() + 1);
        return newTime;
      });
    }, 60000); // Update every 60 seconds

    return () => clearInterval(timer);
  }, []);

  return time;
}
