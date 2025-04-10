import React from 'react';
import { format } from 'date-fns';
import type { DailyForecast as DailyForecastType } from '../types';
import { WeatherIcon } from './WeatherIcon';
import { Frame } from '@react95/core';

interface DailyForecastProps {
  forecasts: DailyForecastType[];
}

export const DailyForecast = React.memo(({ forecasts }: DailyForecastProps) => {
  return (
    <div className="grid grid-cols-5 gap-1">
      {forecasts.slice(0, 5).map((day) => (
        <Frame
          boxShadow="$in"
          key={day.date}
          className="flex flex-col items-center p-2"
        >
          <div className="text-sm font-medium">
            {format(new Date(day.date), 'EEE')}
          </div>
          <WeatherIcon code={day.weatherCode} className="size-6 my-1" />
          <div className="text-xs space-x-1">
            <span className="text-gray-500">{day.temperatureMin}</span>
            <span className="font-medium">{day.temperatureMax}</span>
          </div>
        </Frame>
      ))}
    </div>
  );
});

DailyForecast.displayName = 'DailyForecast';
