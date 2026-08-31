import React, { useMemo } from 'react';
import { Battery } from 'lucide-react';
import { useBattery } from '../hooks/useBattery';
import { Systray300 } from '@react95/icons/Systray300';
import { Systray301 } from '@react95/icons/Systray301';
import { Systray302 } from '@react95/icons/Systray302';
import { Systray306 } from '@react95/icons/Systray306';

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

  const icon = useMemo(() => {
    if (batteryStatus.charging) {
      return <Systray306 variant="32x32_4" />;
    }
    if (batteryStatus.level < 30) {
      return <Systray302 variant="32x32_4" />;
    } else if (batteryStatus.level < 70) {
      return <Systray301 variant="32x32_4" />;
    } else if (batteryStatus.level <= 100) {
      return <Systray300 variant="32x32_4" />;
    }

    return null;
  }, [batteryStatus]);

  return (
    <div className="space-x-1 float-right inline-flex items-center">
      {icon}
      <span className="text-xs font-medium">{batteryStatus.level}%</span>
    </div>
  );
});

BatteryIndicator.displayName = 'BatteryIndicator';
