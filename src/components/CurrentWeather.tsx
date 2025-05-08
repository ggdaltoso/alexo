import React from 'react';
import type { WeatherData } from '../types';
import { WeatherIcon } from './WeatherIcon';
import { DailyForecast } from './DailyForecast';
import { Frame } from '@react95/core';
import { WorldClocks } from './WorldClocks';
import { BatteryIndicator } from './BatteryIndicator';

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
      className="p-2 grid grid-cols-[120px_1fr] gap-3 h-full"
    >
      <Frame
        boxShadow="$in"
        bgColor="white"
        className="flex flex-col items-center justify-center"
      >
        <WeatherIcon
          code={current.weatherCode}
          className="w-12 h-12 mb-2 text-gray-600"
        />
        <div className="text-2xl font-normal">{current.temperature}</div>
        <div className="text-sm space-x-1 mt-1">
          <span className="text-gray-500">{today.temperatureMin}</span>
          <span className="font-medium">{today.temperatureMax}</span>
        </div>
      </Frame>
      <div className="flex flex-col gap-1">
        <div className="text-lg font-medium flex-grow">
          Hi Gabriel
          {/* <BatteryIndicator /> */}
        </div>
        <WorldClocks />

        <div className="mt-auto">
          <DailyForecast forecasts={daily} />
        </div>
      </div>
    </Frame>
  );
});

CurrentWeather.displayName = 'CurrentWeather';
