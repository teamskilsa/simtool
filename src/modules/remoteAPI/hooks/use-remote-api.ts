import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketClient, type SendOptions, type ServerInfo } from '../utils/websocket-client';
import type { RemoteAPIConfig } from '../types';

export function useRemoteAPI(config: RemoteAPIConfig) {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  // The latest client, for callers that must not wait for a re-render.
  const clientRef = useRef<WebSocketClient | null>(null);

  // Returns the live client. Callers that connect and then immediately use
  // the connection cannot rely on `client`/`connected` state: those are set
  // via setState and are not visible to the closure that just called
  // connect(). Returning the instance lets them hold it in a ref instead.
  const connect = useCallback(async (): Promise<WebSocketClient> => {
    // Reconnect: drop the previous socket so it cannot leak (and keep its own
    // stats/log_get windows open on the server).
    clientRef.current?.disconnect();
    try {
      const wsClient = new WebSocketClient({ ...config });

      wsClient.on('connected', () => setConnected(true));
      wsClient.on('disconnected', () => { if (clientRef.current === wsClient) setConnected(false); });
      wsClient.on('error', (err: Error) => setError(err));
      wsClient.on('ready', (info: ServerInfo) => setServerInfo({ ...info }));

      clientRef.current = wsClient;
      await wsClient.connect();
      setClient(wsClient);
      setServerInfo(wsClient.serverInfo ? { ...wsClient.serverInfo } : null);
      setError(null);
      return wsClient;
    } catch (err) {
      setError(err as Error);
      setConnected(false);
      throw err;
    }
  }, [config]);

  // Stable identity: consumers put it in effect deps and cleanups. It must
  // act on the CURRENT client (via the ref), never a stale closure.
  const disconnect = useCallback(() => {
    const c = clientRef.current;
    if (c) {
      clientRef.current = null;
      c.disconnect();
      setClient(null);
      setConnected(false);
      setServerInfo(null);
    }
  }, []);

  // Close the socket when the component using the hook unmounts.
  useEffect(() => () => {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  const execute = useCallback(async (command: string, params: any = {}, opts?: SendOptions) => {
    const c = clientRef.current;
    if (!c) throw new Error('Not connected');
    return c.sendMessage({
      ...params,
      message: command,
    }, opts);
  }, []);

  return {
    client,
    connected,
    error,
    serverInfo,
    connect,
    disconnect,
    execute,
  };
}
