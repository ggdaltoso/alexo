// WebSocket service for real-time updates
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import type { ServerMessage } from '../types';

type MessageCallback = (message: ServerMessage) => void;

/**
 * Valida só o envelope: um objeto com `type` string.
 *
 * Não garante que o `type` seja um dos conhecidos -- um backend mais novo pode
 * mandar variantes que este cliente ainda não conhece. Distinguir isso é do
 * consumidor, que deve tratar o `default` do switch como "ignorar".
 */
function isServerMessage(value: unknown): value is ServerMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private callbacks: Set<MessageCallback> = new Set();
  private isConnecting = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = `${API_CONFIG.WS_URL}${API_ENDPOINTS.WS}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        try {
          const data: unknown = JSON.parse(event.data);
          if (!isServerMessage(data)) {
            console.warn('Ignoring WebSocket frame without a `type`:', data);
            return;
          }
          this.callbacks.forEach((callback) => callback(data));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.ws = null;
        // Attempt to reconnect after 5 seconds
        this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
      // Attempt to reconnect after 5 seconds
      this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(callback: MessageCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }
}

export const wsService = new WebSocketService();
