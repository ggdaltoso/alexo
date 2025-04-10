import React from 'react';
import type { WeatherData } from '../types';
import { WeatherIcon } from './WeatherIcon';
import { DailyForecast } from './DailyForecast';
import { TimeDisplay } from './TimeDisplay';
import { Frame } from '@react95/core';

interface CurrentWeatherProps {
  data: WeatherData;
}

export const CurrentWeather = React.memo(({ data }: CurrentWeatherProps) => {
  const { current, daily } = data;
  const today = daily[0];

  return (
    <Frame
      boxShadow="$out"
      bgColor="$material"
      className="p-2 grid grid-cols-[180px_1fr] gap-3 h-full"
    >
      <Frame
        boxShadow="$in"
        bgColor="white"
        className="flex flex-col items-center justify-center"
      >
        <WeatherIcon
          code={current.weatherCode}
          className="w-16 h-16 mb-2 text-gray-600"
        />
        <div className="text-5xl font-normal">{current.temperature}</div>
        <div className="text-sm space-x-1 mt-1">
          <span className="text-gray-500">{today.temperatureMin}</span>
          <span className="font-medium">{today.temperatureMax}</span>
        </div>
      </Frame>
      <div className="flex flex-col justify-between">
        <div>
          <TimeDisplay />
          <div className="text-2xl font-medium">Oi Gabriel</div>
        </div>
        <DailyForecast forecasts={daily} />
      </div>
    </Frame>
  );
});

CurrentWeather.displayName = 'CurrentWeather';
