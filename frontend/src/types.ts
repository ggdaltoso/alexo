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

export type MessageType = 'info' | 'warning';

// Backend types
export interface NFCMessage {
  type: MessageType;
  message: string;
  timestamp: number;
}

export interface BackendState {
  message: NFCMessage | null;
}

export interface ExchangeRate {
  code: string;
  codein: string;
  name: string;
  high: string;
  low: string;
  varBid: string;
  pctChange: string;
  bid: string;
  ask: string;
  timestamp: string;
  create_date: string;
}
