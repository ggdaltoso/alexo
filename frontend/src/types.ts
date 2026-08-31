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

export interface MusicPlaybackState {
  album: string | null;
  trackId: string | null;
  trackIndex: number;
  trackCount: number;
  title: string | null;
  filename: string | null;
  isPlaying: boolean;
  /** Segundos, medidos em `positionAt`. Ver o comentário abaixo. */
  position: number;
  /**
   * Instante (epoch ms) em que `position` foi medida.
   *
   * O backend só emite em transições reais, nunca a cada segundo. Este par é o
   * que permite ao cliente interpolar a posição localmente entre um evento e o
   * seguinte, em vez de exigir um fluxo contínuo pelo WebSocket.
   */
  positionAt: number;
  /**
   * Instante (epoch ms) da última mudança entre tocando e parado.
   *
   * Estável entre consultas, ao contrário de `positionAt`. É o que permite saber
   * há quanto tempo a música parou -- e por isso o que decide se o painel ainda
   * deve aparecer depois de uma pausa.
   */
  stateChangedAt: number;
  duration: number | null;
  volume: number;
  activeTagUid: string | null;
}

export interface MusicPlaybackBroadcast extends MusicPlaybackState {
  type: 'music_playback_state';
  timestamp: number;
}

export interface MusicTracksUpdatedBroadcast {
  type: 'music_tracks_updated';
}

export interface MusicTagsUpdatedBroadcast {
  type: 'music_tags_updated';
}

export type ServerMessage =
  | NfcMessageBroadcast
  | GalleryUpdatedBroadcast
  | MusicPlaybackBroadcast
  | MusicTracksUpdatedBroadcast
  | MusicTagsUpdatedBroadcast;

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
