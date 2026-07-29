import Peer, { type DataConnection } from 'peerjs';
import type { SyncPayload } from '../types/game';

const CHANNEL_NAME = 'sdg_arcade_quiz_global_v4';
const LOCAL_STORAGE_KEY = 'sdg_arcade_quiz_global_event_v4';
const HOST_PEER_ID = 'sdg_arcade_quiz_global_host_v4';

// High-Availability Public Realtime WebSockets Relay Pool
const WS_POOL_URLS = [
  'wss://socketsbay.com/wss/v2/1/sdg_arcade_quiz_global_v4/',
  'wss://free.pipes.piehost.com/v1/ws'
];

class SyncService {
  private channel: BroadcastChannel | null = null;
  private peer: Peer | null = null;
  private sockets: WebSocket[] = [];
  private connections: Map<string, DataConnection> = new Map();
  private hostConn: DataConnection | null = null;
  private listeners: Set<(payload: SyncPayload) => void> = new Set();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  public clientId: string;
  public isHost: boolean = false;
  public isConnected: boolean = false;

  constructor() {
    this.clientId = 'client_' + Math.random().toString(36).substring(2, 9);
    this.initLocalStorage();
  }

  public initGlobalChannel(isHostView: boolean) {
    this.isHost = isHostView;
    this.initBroadcastChannel();
    this.initWebSocketPool();
    this.initPeerJS(isHostView);
    this.startHeartbeat();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      if (this.channel) {
        try { this.channel.close(); } catch(e) {}
      }
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<SyncPayload>) => {
          if (event.data && event.data.senderId !== this.clientId) {
            this.notifyListeners(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel failed', e);
      }
    }
  }

  private initLocalStorage() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
          try {
            const payload: SyncPayload = JSON.parse(event.newValue);
            if (payload.senderId !== this.clientId) {
              this.notifyListeners(payload);
            }
          } catch (err) {
            console.error('Failed to parse sync payload from localStorage', err);
          }
        }
      });
    }
  }

  private initWebSocketPool() {
    if (typeof window === 'undefined') return;

    this.sockets.forEach(ws => {
      try { ws.close(); } catch(e) {}
    });
    this.sockets = [];

    WS_POOL_URLS.forEach(url => {
      try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log('[SyncService] WebSocket pool relay connected:', url);
          this.isConnected = true;
          if (!this.isHost) {
            this.publish({ event: 'REQUEST_STATE' });
          }
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            if (typeof event.data === 'string') {
              const payload: SyncPayload = JSON.parse(event.data);
              if (payload && payload.event && payload.senderId !== this.clientId) {
                this.notifyListeners(payload);
              }
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          setTimeout(() => this.initWebSocketPool(), 3000);
        };

        this.sockets.push(ws);
      } catch (e) {
        console.warn('[SyncService] Failed connecting socket to pool:', url, e);
      }
    });
  }

  private initPeerJS(isHostView: boolean) {
    if (typeof window === 'undefined') return;

    if (this.peer) {
      try { this.peer.destroy(); } catch(e) {}
      this.peer = null;
    }

    try {
      if (isHostView) {
        this.peer = new Peer(HOST_PEER_ID, { debug: 1 });

        this.peer.on('open', (id) => {
          console.log('[SyncService] WebRTC Host registered:', id);
          this.isConnected = true;
        });

        this.peer.on('connection', (conn) => {
          console.log('[SyncService] Remote Player peer connected:', conn.peer);
          this.connections.set(conn.peer, conn);
          this.isConnected = true;

          conn.on('data', (data) => this.handleIncomingData(data));
          conn.on('close', () => this.connections.delete(conn.peer));

          conn.send({ event: 'PLAYER_READY', senderId: this.clientId, timestamp: Date.now() });
        });

        this.peer.on('error', (err) => {
          console.warn('[SyncService] PeerJS host notice:', err.type);
        });
      } else {
        this.peer = new Peer({ debug: 1 });
        this.peer.on('open', () => this.connectToGlobalHost());
        this.peer.on('error', (err) => {
          console.warn('[SyncService] Player peer notice:', err.type);
        });
      }
    } catch (e) {
      console.warn('[SyncService] PeerJS init error:', e);
    }
  }

  private connectToGlobalHost() {
    if (!this.peer || (this.hostConn && this.hostConn.open)) return;

    try {
      const conn = this.peer.connect(HOST_PEER_ID, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        console.log('[SyncService] WebRTC P2P Host connected!');
        this.isConnected = true;
        conn.send({ event: 'REQUEST_STATE', senderId: this.clientId, timestamp: Date.now() });
      });

      conn.on('data', (data) => this.handleIncomingData(data));
      conn.on('close', () => {
        this.hostConn = null;
        setTimeout(() => this.connectToGlobalHost(), 3000);
      });
    } catch (e) {
      console.warn('[SyncService] Connect host error:', e);
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(() => {
      this.sockets.forEach(ws => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ event: 'PING', senderId: this.clientId, timestamp: Date.now() }));
          } catch (e) {}
        }
      });
    }, 4000);
  }

  private handleIncomingData(data: unknown) {
    try {
      const payload: SyncPayload = typeof data === 'string' ? JSON.parse(data) : (data as SyncPayload);
      if (payload && payload.event && payload.senderId !== this.clientId) {
        this.notifyListeners(payload);
      }
    } catch (e) {
      console.error('Failed to parse incoming sync data', e);
    }
  }

  public publish(payload: Omit<SyncPayload, 'timestamp' | 'senderId'>): void {
    const fullPayload: SyncPayload = {
      ...payload,
      timestamp: Date.now(),
      senderId: this.clientId
    };

    if (this.channel) {
      try { this.channel.postMessage(fullPayload); } catch (e) {}
    }

    this.sockets.forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(fullPayload)); } catch (e) {}
      }
    });

    if (this.isHost) {
      this.connections.forEach((conn) => {
        if (conn.open) {
          try { conn.send(fullPayload); } catch (e) {}
        }
      });
    } else if (this.hostConn && this.hostConn.open) {
      try { this.hostConn.send(fullPayload); } catch (e) {}
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fullPayload));
    } catch (e) {}
  }

  public subscribe(callback: (payload: SyncPayload) => void): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  private notifyListeners(payload: SyncPayload): void {
    this.listeners.forEach(cb => {
      try { cb(payload); } catch (e) {}
    });
  }

  public close(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.sockets.forEach(ws => {
      try { ws.close(); } catch(e) {}
    });
    this.sockets = [];
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
    this.hostConn = null;
    this.listeners.clear();
  }
}

export const syncService = new SyncService();
