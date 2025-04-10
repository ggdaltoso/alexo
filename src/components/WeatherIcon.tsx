import React from 'react';

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
          return '/assets/icons/sun.png';
        case code === 1 || code === 2: // Partly cloudy
          return '/assets/icons/partly-cloudy.png';
        case code === 3: // Overcast
          return '/assets/icons/cloud.png';
        case code >= 51 && code <= 67: // Drizzle or rain
          return '/assets/icons/drizzle.png';
        case code >= 71 && code <= 77: // Snow
          return '/assets/icons/snow.png';
        case code >= 80 && code <= 82: // Rain showers
          return '/assets/icons/rain-showers.png';
        case code >= 95 && code <= 99: // Thunderstorm
          return '/assets/icons/thunderstorm.png';
        case code >= 45 && code <= 48: // Foggy
          return '/assets/icons/foggy.png';
        default:
          return '/assets/icons/cloud.png';
      }
    };

    return <img src={getIconSrc()} alt="Weather Icon" className={className} />;
  },
);

WeatherIcon.displayName = 'WeatherIcon';
