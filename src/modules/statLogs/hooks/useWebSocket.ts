import { useState, useEffect, useCallback } from 'react';
import { WebSocketClient } from '../lib/utils/websocket';
import { ComponentType } from '../constants/ports';
import { WebSocketMessage, ConnectionStatus } from '../types/common.types';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onMessage?: (message: any) => void;
  onError?: (error: Error) => void;
  reconnectAttempts?: number;
  pingInterval?: number;
}

export function useWebSocket(
  ip: string,
  componentType: ComponentType,
  options: UseWebSocketOptions = {}
) {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false
  });
  const [lastMessage, setLastMessage] = useState<any>(null);

  const connect = useCallback(async () => {
    try {
      const wsClient = new WebSocketClient(ip, componentType, {
        reconnectAttempts: options.reconnectAttempts,
        pingInterval: options.pingInterval
      });

      wsClient.on('connected', () => {
        setStatus({ connected: true });
      });

      wsClient.on('message', (message) => {
        setLastMessage(message);
        options.onMessage?.(message);
      });

      wsClient.on('error', (error) => {
        setStatus(prev => ({ ...prev, error: error.message }));
        options.onError?.(error);
      });

      wsClient.on('ping', (time) => {
        setStatus(prev => ({ ...prev, lastPing: time }));
      });

      await wsClient.connect();
      setClient(wsClient);
    } catch (error) {
      setStatus({ connected: false, error: error.message });
      throw error;
    }
  }, [ip, componentType, options]);

  const disconnect = useCallback(() => {
    client?.disconnect();
    setClient(null);
    setStatus({ connected: false });
  }, [client]);

  const sendMessage = useCallback(async (message: WebSocketMessage) => {
    if (!client) throw new Error('WebSocket not connected');
    return client.sendMessage(message);
  }, [client]);

  useEffect(() => {
    if (options.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [options.autoConnect, connect, disconnect]);

  return {
    status,
    lastMessage,
    connect,
    disconnect,
    sendMessage
  };
}