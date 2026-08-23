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

// ---------------------------------------------------------------------------
// Mensagens do WebSocket
//
// `type` é o discriminador da união e não carrega mais nenhuma outra
// informação. Foi essa sobrecarga que causou o bug original: a mensagem NFC
// mandava 'info'/'warning' em `type` enquanto a galeria mandava
// 'gallery_updated', então nenhum consumidor conseguia distinguir os dois e o
// AppContext tratava qualquer broadcast como mensagem.
//
// Todo broadcast novo precisa entrar aqui como uma variante, espelhando o
// contrato documentado em backend/ws.js.
// ---------------------------------------------------------------------------

export interface NfcMessageBroadcast {
  type: 'nfc_message';
  messageType: MessageType;
  message: string;
  timestamp: number;
}

export interface GalleryUpdatedBroadcast {
  type: 'gallery_updated';
}

export type ServerMessage = NfcMessageBroadcast | GalleryUpdatedBroadcast;

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
