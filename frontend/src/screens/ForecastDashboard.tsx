import * as React from 'react';
import { WeatherIcon } from '../components/WeatherIcon';
import { DailyForecast } from '../components/DailyForecast';
import { Frame } from '@react95/core';
import { useApp } from '../contexts/AppContext';

export const ForecastDashboard = React.memo(() => {
  const { weather, weatherLoading } = useApp();

  if (weatherLoading) {
    return <div>Loading...</div>;
  }

  if (!weather) {
    return <div>No weather data available</div>;
  }

  const { current, daily } = weather;
  const today = daily[0];

  return (
    <Frame
      boxShadow="$out"
      bgColor="$material"
      className="p-2 grid grid-rows-[2fr_1fr] gap-3 h-full"
    >
      <Frame
        boxShadow="$in"
        bgColor="white"
        className="flex items-center justify-center"
      >
        <WeatherIcon
          code={current.weatherCode}
          className="w-12 h-12 mr-1 text-gray-600"
        />
        <div className="flex flex-col">
          <div className="text-2xl font-normal">{current.temperature}°</div>
          <div className="flex align-end text-sm space-x-1">
            <div className="flex flex-col">
              <span className="text-[0.5rem] leading-none text-center">
                min
              </span>
              <span className="text-gray-500">{today.temperatureMin}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-[0.5rem] leading-none text-center">
                max
              </span>
              <span className="font-medium">{today.temperatureMax}</span>
            </div>
          </div>
        </div>
      </Frame>
      <div className="flex flex-col gap-1">
        <DailyForecast forecasts={daily} />
      </div>
    </Frame>
  );
});

ForecastDashboard.displayName = 'ForecastDashboard';
