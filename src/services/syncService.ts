import Peer, { type DataConnection } from 'peerjs';
import type { SyncPayload } from '../types/game';

const CHANNEL_NAME = 'sdg_arcade_quiz_global';
const LOCAL_STORAGE_KEY = 'sdg_arcade_quiz_global_event';
const HOST_PEER_ID = 'sdg_arcade_quiz_global_host';

class SyncService {
  private channel: BroadcastChannel | null = null;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConn: DataConnection | null = null;
  private listeners: Set<(payload: SyncPayload) => void> = new Set();
  
  public clientId: string;
  public isHost: boolean = false;
  public isConnected: boolean = false;

  constructor() {
    this.clientId = 'client_' + Math.random().toString(36).substring(2, 9);
    this.initLocalStorage();
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

  public initGlobalChannel(isHostView: boolean) {
    this.isHost = isHostView;

    // 1. BroadcastChannel for same-device local tabs
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
        console.warn('BroadcastChannel initialization failed', e);
      }
    }

    // 2. WebRTC PeerJS Cloud Connection (No room codes needed)
    if (typeof window === 'undefined') return;

    if (this.peer) {
      try { this.peer.destroy(); } catch(e) {}
      this.peer = null;
    }

    try {
      if (isHostView) {
        // Host Controller Peer
        this.peer = new Peer(HOST_PEER_ID, { debug: 1 });

        this.peer.on('open', (id) => {
          console.log(`[SyncService] Global Host Controller registered: ${id}`);
          this.isConnected = true;
        });

        this.peer.on('connection', (conn) => {
          console.log('[SyncService] Remote Player connected:', conn.peer);
          this.connections.set(conn.peer, conn);
          this.isConnected = true;

          conn.on('data', (data) => {
            this.handleIncomingData(data);
          });

          conn.on('close', () => {
            this.connections.delete(conn.peer);
          });

          // Confirm connection
          conn.send({ event: 'PLAYER_READY', senderId: this.clientId, timestamp: Date.now() });
        });

        this.peer.on('error', (err) => {
          console.warn('[SyncService] Host peer notice:', err.type, err.message);
        });
      } else {
        // Player Client Peer
        this.peer = new Peer({ debug: 1 });

        this.peer.on('open', (id) => {
          console.log(`[SyncService] Player peer created (${id}), connecting to global host...`);
          this.connectToGlobalHost();
        });

        this.peer.on('error', (err) => {
          console.warn('[SyncService] Player peer notice:', err.type, err.message);
        });
      }
    } catch (e) {
      console.warn('[SyncService] PeerJS global init error:', e);
    }
  }

  private connectToGlobalHost() {
    if (!this.peer || (this.hostConn && this.hostConn.open)) return;

    try {
      const conn = this.peer.connect(HOST_PEER_ID, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        console.log(`[SyncService] Successfully connected to Global Host Controller!`);
        this.isConnected = true;
        conn.send({ event: 'PLAYER_READY', senderId: this.clientId, timestamp: Date.now() });
      });

      conn.on('data', (data) => {
        this.handleIncomingData(data);
      });

      conn.on('close', () => {
        this.hostConn = null;
        this.isConnected = false;
        setTimeout(() => this.connectToGlobalHost(), 2000);
      });

      conn.on('error', (err) => {
        console.warn('[SyncService] Connection error:', err);
      });
    } catch (e) {
      console.warn('[SyncService] Failed to connect to global host:', e);
    }
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
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
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
