import { useState, useEffect, useCallback } from 'react';
import { WebSocketClient } from '../utils/websocket-client';
import type { RemoteAPIConfig } from '../types';

export function useRemoteAPI(config: RemoteAPIConfig) {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(async () => {
    try {
      const wsClient = new WebSocketClient(config);
      
      wsClient.on('connected', () => setConnected(true));
      wsClient.on('disconnected', () => setConnected(false));
      wsClient.on('error', (err: Error) => setError(err));

      await wsClient.connect();
      setClient(wsClient);
      setError(null);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [config]);

  const disconnect = useCallback(() => {
    if (client) {
      client.disconnect();
      setClient(null);
      setConnected(false);
    }
  }, [client]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const execute = useCallback(async (command: string, params: any = {}) => {
    if (!client) throw new Error('Not connected');
    return client.sendMessage({
      message: command,
      ...params
    });
  }, [client]);

  return {
    client,
    connected,
    error,
    connect,
    disconnect,
    execute
  };
}
