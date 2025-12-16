export type CalendarEvent = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
};

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

// Backend types
export interface NFCMessage {
  type: string;
  message: string;
  timestamp: number;
}

export interface BackendState {
  message: NFCMessage | null;
}
