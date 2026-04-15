import { EventEmitter } from 'events';
import type { RemoteAPIConfig, RemoteAPIMessage } from '../types';

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private connected = false;
  private pendingMessages = new Map<
    string, 
    { 
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timer: NodeJS.Timeout;
    }
  >();

  constructor(private config: RemoteAPIConfig) {
    super();
    this.config.timeout = this.config.timeout || 60; // Default 60s timeout
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = this.config.ssl ? 'wss' : 'ws';
      const url = `${protocol}://${this.config.server}:${this.config.port}`;
      
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        this.emit('connected');
        resolve();
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected');
        this.cleanup();
      };

      this.ws.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          this.emit('error', 'Failed to parse message');
        }
      };
    });
  }

  async sendMessage(message: RemoteAPIMessage): Promise<any> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      if (!message.message_id) {
        message.message_id = `id#${++this.messageId}`;
      }

      const timer = setTimeout(() => {
        this.pendingMessages.delete(message.message_id!.toString());
        reject(new Error(`Message timeout: ${message.message}`));
      }, this.config.timeout! * 1000);

      this.pendingMessages.set(message.message_id!.toString(), {
        resolve,
        reject,
        timer
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  private handleMessage(message: any) {
    if (message.message_id) {
      const pending = this.pendingMessages.get(message.message_id.toString());
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingMessages.delete(message.message_id.toString());
        
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message);
        }
        return;
      }
    }

    if (message.message === 'authenticate') {
      if (message.ready) {
        this.emit('authenticated');
      } else if (message.error) {
        this.emit('error', new Error(`Authentication failed: ${message.error}`));
      }
      return;
    }

    this.emit('message', message);
    if (message.message) {
      this.emit(message.message, message);
    }
  }

  private cleanup() {
    for (const [id, pending] of this.pendingMessages) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingMessages.clear();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
