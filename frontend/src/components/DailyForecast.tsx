import React from 'react';
import { format, parseISO } from 'date-fns';
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
          className="flex flex-col items-center p-1"
        >
          <div className="text-[0.35rem] font-medium">
            {format(parseISO(day.date), 'EEE')}
          </div>
          <WeatherIcon code={day.weatherCode} className="w-6 my-0.5" />
          <div className="space-x-0.5">
            <span className="text-gray-500 text-[0.35rem]">
              {day.temperatureMin}
            </span>
            <span className="font-medium text-[0.35rem]">
              {day.temperatureMax}
            </span>
          </div>
        </Frame>
      ))}
    </div>
  );
});

DailyForecast.displayName = 'DailyForecast';
