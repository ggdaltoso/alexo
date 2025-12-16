import { useState, useEffect } from 'react';
import type { BatteryStatus } from '../types';

export function useBattery() {
  const [batteryStatus, setBatteryStatus] = useState<BatteryStatus>({
    level: 100,
    charging: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getBatteryStatus() {
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          setBatteryStatus({
            level: Math.round(battery.level * 100),
            charging: battery.charging,
          });

          battery.addEventListener('levelchange', () => {
            setBatteryStatus((prev) => ({
              ...prev,
              level: Math.round(battery.level * 100),
            }));
          });

          battery.addEventListener('chargingchange', () => {
            setBatteryStatus((prev) => ({
              ...prev,
              charging: battery.charging,
            }));
          });
        } else {
          setError('Battery API not supported');
        }
      } catch (err) {
        setError('Failed to get battery status');
      }
    }

    const updateInterval = setInterval(getBatteryStatus, 300000); // Update every 5 minutes
    getBatteryStatus();

    return () => clearInterval(updateInterval);
  }, []);

  return { batteryStatus, error };
}
