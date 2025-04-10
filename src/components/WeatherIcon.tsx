import React from 'react';

import sun from './icons/sun.png';
import cloudy from './icons/partly-cloudy.png';
import cloud from './icons/cloud.png';
import drizzle from './icons/drizzle.png';
import snow from './icons/snow.png';
import rain from './icons/rain-showers.png';
import thunderstorm from './icons/thunderstorm.png';
import foggy from './icons/foggy.png';

interface WeatherIconProps {
  code: number;
  className?: string;
}

export const WeatherIcon = React.memo(
  ({ code, className = 'w-8 h-8' }: WeatherIconProps) => {
    // Based on WMO Weather interpretation codes
    // https://open-meteo.com/en/docs
    const getIconSrc = () => {
      switch (true) {
        case code === 0: // Clear sky
          return sun;
        case code === 1 || code === 2: // Partly cloudy
          return cloudy;
        case code === 3: // Overcast
          return cloud;
        case code >= 51 && code <= 67: // Drizzle or rain
          return drizzle;
        case code >= 71 && code <= 77: // Snow
          return snow;
        case code >= 80 && code <= 82: // Rain showers
          return rain;
        case code >= 95 && code <= 99: // Thunderstorm
          return thunderstorm;
        case code >= 45 && code <= 48: // Foggy
          return foggy;
        default:
          return cloud;
      }
    };

    return <img src={getIconSrc()} alt="Weather Icon" className={className} />;
  },
);

WeatherIcon.displayName = 'WeatherIcon';
