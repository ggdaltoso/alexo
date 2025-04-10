import React from 'react';
import { useTime } from '../hooks/useTime';

export const TimeDisplay = React.memo(() => {
  const time = useTime();

  return <span className="text-xs float-right font-bold">{time}</span>;
});

TimeDisplay.displayName = 'TimeDisplay';
