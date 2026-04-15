import { EventEmitter } from 'events';
import { WebSocketMessage, WebSocketResponse, ConnectionStatus } from '../../types/common.types';
import { ComponentType, COMPONENT_PORTS } from '../../constants/ports';

interface WebSocketOptions {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  pingInterval?: number;
  timeout?: number;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private pingInterval?: NodeJS.Timer;
  private messageQueue: Map<string, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timer: NodeJS.Timeout;
  }> = new Map();
  private messageCounter = 0;

  constructor(
    private ip: string,
    private componentType: ComponentType,
    private options: WebSocketOptions = {}
  ) {
    super();
    this.options = {
      reconnectAttempts: 5,
      reconnectInterval: 1000,
      pingInterval: 30000,
      timeout: 5000,
      ...options
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = COMPONENT_PORTS[this.componentType];
      const url = `ws://${this.ip}:${port}`;

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log(`Connected to ${this.componentType} at ${url}`);
          this.reconnectAttempts = 0;
          this.setupPing();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const response: WebSocketResponse = JSON.parse(event.data);
            this.handleMessage(response);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error(`WebSocket error for ${this.componentType}:`, error);
          this.emit('error', error);
        };

        this.ws.onclose = () => {
          console.log(`Disconnected from ${this.componentType}`);
          this.cleanup();
          this.handleReconnect();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  async sendMessage(message: WebSocketMessage): Promise<WebSocketResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const messageId = `msg_${++this.messageCounter}`;
      const messageWithId = { ...message, message_id: messageId };

      // Set timeout for message response
      const timer = setTimeout(() => {
        this.messageQueue.delete(messageId);
        reject(new Error(`Message timeout: ${message.message}`));
      }, this.options.timeout);

      this.messageQueue.set(messageId, { resolve, reject, timer });
      this.ws.send(JSON.stringify(messageWithId));
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
    this.cleanup();
  }

  getStatus(): ConnectionStatus {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      lastPing: this.lastPingTime,
      error: this.lastError
    };
  }

  private lastPingTime?: Date;
  private lastError?: string;

  private setupPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(async () => {
      try {
        await this.sendMessage({ message: 'ping' });
        this.lastPingTime = new Date();
        this.emit('ping', this.lastPingTime);
      } catch (error) {
        this.lastError = error.message;
        this.emit('ping_error', error);
      }
    }, this.options.pingInterval);
  }

  private handleMessage(response: WebSocketResponse): void {
    // Handle ping response
    if (response.message === 'pong') {
      this.lastPingTime = new Date();
      return;
    }

    // Handle message queue responses
    if (response.message_id && this.messageQueue.has(response.message_id)) {
      const { resolve, reject, timer } = this.messageQueue.get(response.message_id)!;
      clearTimeout(timer);
      this.messageQueue.delete(response.message_id);

      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
      return;
    }

    // Emit other messages as events
    this.emit('message', response);
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts < this.options.reconnectAttempts!) {
      this.reconnectAttempts++;
      const delay = this.options.reconnectInterval! * this.reconnectAttempts;
      
      console.log(`Attempting to reconnect to ${this.componentType} in ${delay}ms...`);
      
      setTimeout(async () => {
        try {
          await this.connect();
        } catch (error) {
          console.error('Reconnection failed:', error);
        }
      }, delay);
    } else {
      this.emit('reconnect_failed');
    }
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Clear message queue and reject pending messages
    this.messageQueue.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(new Error('Connection closed'));
    });
    this.messageQueue.clear();

    this.ws = null;
  }
}