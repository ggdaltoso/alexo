import type { WeatherData, Coordinates } from '../types';

export async function fetchWeather(
  coordinates: Coordinates,
): Promise<WeatherData> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${coordinates.latitude}&longitude=${coordinates.longitude}` +
      `&current=temperature_2m,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=America/Sao_Paulo`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }

  const data = await response.json();

  return {
    current: {
      temperature: Math.round(data.current.temperature_2m),
      windSpeed: Math.round(data.current.wind_speed_10m),
      weatherCode: data.current.weather_code,
      time: data.current.time,
    },
    daily: data.daily.time.map((date: string, index: number) => ({
      date,
      temperatureMax: Math.round(data.daily.temperature_2m_max[index]),
      temperatureMin: Math.round(data.daily.temperature_2m_min[index]),
      precipitationProbability: data.daily.precipitation_probability_max[index],
      windSpeed: Math.round(data.daily.wind_speed_10m_max[index]),
      weatherCode: data.daily.weather_code[index],
    })),
  };
}
