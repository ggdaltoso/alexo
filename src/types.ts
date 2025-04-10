export interface WeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
}

export interface CurrentWeather {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  time: string;
}

export interface DailyForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  windSpeed: number;
  weatherCode: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BatteryStatus {
  level: number;
  charging: boolean;
}
