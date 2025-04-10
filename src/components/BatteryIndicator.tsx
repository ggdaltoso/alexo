import React from 'react';
import { Battery, BatteryCharging } from 'lucide-react';
import { useBattery } from '../hooks/useBattery';

export const BatteryIndicator = React.memo(() => {
  const { batteryStatus, error } = useBattery();

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        <Battery className="size-4" />
        Error
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 bg-white rounded-3xl w-full justify-between">
      {batteryStatus.charging ? (
        <BatteryCharging className="size-4 text-green-500" />
      ) : (
        <Battery className="size-4 text-gray-600" />
      )}
      <span className="text-xs font-medium">{batteryStatus.level}%</span>
    </div>
  );
});

BatteryIndicator.displayName = 'BatteryIndicator';
