import Peer, { type DataConnection } from 'peerjs';
import type { SyncPayload } from '../types/game';

const CHANNEL_NAME = 'sdg_arcade_quiz_global_v10';
const LOCAL_STORAGE_KEY = 'sdg_arcade_quiz_global_event_v10';
const HOST_PEER_ID = 'sdg_arcade_quiz_global_host_v10';

class SyncService {
  private channel: BroadcastChannel | null = null;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConn: DataConnection | null = null;
  private listeners: Set<(payload: SyncPayload) => void> = new Set();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  
  private presenceInterval: ReturnType<typeof setInterval> | null = null;
  private lastProcessedTimestamp: number = 0;
  private lastRemotePeerSeenTime: number = 0;

  public clientId: string;
  public isHost: boolean = false;
  public isConnected: boolean = false;

  constructor() {
    this.clientId = 'client_' + Math.random().toString(36).substring(2, 9);
    this.initLocalStorage();
  }

  public onConnectionChange(cb: (connected: boolean) => void): () => void {
    this.connectionListeners.add(cb);
    cb(this.isConnected);
    return () => {
      this.connectionListeners.delete(cb);
    };
  }

  private setConnectedState(status: boolean) {
    if (this.isConnected !== status) {
      this.isConnected = status;
      this.connectionListeners.forEach(cb => {
        try { cb(status); } catch (e) {}
      });
    }
  }

  public initGlobalChannel(isHostView: boolean) {
    this.isHost = isHostView;
    this.initBroadcastChannel();
    this.initPeerJS(isHostView);
    this.startPresenceHeartbeat();

    if (!isHostView) {
      setTimeout(() => this.publish({ event: 'REQUEST_STATE' }), 300);
    }
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
            this.handleIncomingPayload(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error', e);
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
              this.handleIncomingPayload(payload);
            }
          } catch (err) {}
        }
      });
    }
  }

  private initPeerJS(isHostView: boolean) {
    if (typeof window === 'undefined') return;

    if (this.peer) {
      try { this.peer.destroy(); } catch(e) {}
      this.peer = null;
    }

    try {
      if (isHostView) {
        this.peer = new Peer(HOST_PEER_ID, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          console.log('[SyncService] WebRTC Host registered:', id);
          this.setConnectedState(true);
        });

        this.peer.on('connection', (conn) => {
          console.log('[SyncService] Remote Player connected:', conn.peer);
          this.connections.set(conn.peer, conn);
          this.lastRemotePeerSeenTime = Date.now();
          this.setConnectedState(true);

          conn.on('data', (data) => this.handleRawData(data));
          conn.on('close', () => this.connections.delete(conn.peer));

          conn.send({ event: 'HOST_HEARTBEAT', senderId: this.clientId, timestamp: Date.now() });
        });

        this.peer.on('error', (err) => {
          console.warn('[SyncService] PeerJS host notice:', err.type);
          if (err.type === 'unavailable-id') {
            setTimeout(() => {
              if (this.isHost) {
                this.peer = new Peer(HOST_PEER_ID + '_' + Math.floor(Math.random()*1000), { debug: 1 });
              }
            }, 2000);
          }
        });
      } else {
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('open', () => this.connectToGlobalHost());
        this.peer.on('error', (err) => {
          console.warn('[SyncService] Player peer notice:', err.type);
          setTimeout(() => this.connectToGlobalHost(), 3000);
        });
      }
    } catch (e) {
      console.warn('[SyncService] PeerJS setup error:', e);
    }
  }

  private connectToGlobalHost() {
    if (!this.peer || (this.hostConn && this.hostConn.open)) return;

    try {
      const conn = this.peer.connect(HOST_PEER_ID, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        console.log('[SyncService] WebRTC P2P DataChannel connected!');
        this.lastRemotePeerSeenTime = Date.now();
        this.setConnectedState(true);
        conn.send({ event: 'REQUEST_STATE', senderId: this.clientId, timestamp: Date.now() });
      });

      conn.on('data', (data) => this.handleRawData(data));
      conn.on('close', () => {
        this.hostConn = null;
        setTimeout(() => this.connectToGlobalHost(), 2000);
      });
    } catch (e) {
      console.warn('[SyncService] Connect host error:', e);
    }
  }

  private startPresenceHeartbeat() {
    if (this.presenceInterval) clearInterval(this.presenceInterval);

    this.presenceInterval = setInterval(() => {
      const payloadEvent = this.isHost ? 'HOST_HEARTBEAT' : 'PLAYER_HEARTBEAT';
      this.publish({ event: payloadEvent });

      if (!this.isHost && (!this.hostConn || !this.hostConn.open)) {
        this.connectToGlobalHost();
      }

      const isRemoteActive = (Date.now() - this.lastRemotePeerSeenTime) < 15000;
      this.setConnectedState(isRemoteActive);
    }, 2000);
  }

  private handleRawData(data: unknown) {
    try {
      const payload: SyncPayload = typeof data === 'string' ? JSON.parse(data) : (data as SyncPayload);
      if (payload && payload.event && payload.senderId !== this.clientId) {
        this.handleIncomingPayload(payload);
      }
    } catch (e) {}
  }

  private handleIncomingPayload(payload: SyncPayload) {
    this.lastRemotePeerSeenTime = Date.now();
    this.setConnectedState(true);

    if (this.lastProcessedTimestamp === 0 || payload.timestamp >= this.lastProcessedTimestamp) {
      this.lastProcessedTimestamp = payload.timestamp;
      this.notifyListeners(payload);
    }
  }

  public publish(payload: Omit<SyncPayload, 'timestamp' | 'senderId'>): void {
    const fullPayload: SyncPayload = {
      ...payload,
      timestamp: Date.now(),
      senderId: this.clientId
    };

    this.lastProcessedTimestamp = fullPayload.timestamp;

    // 1. BroadcastChannel (Same Device / Dual Monitor)
    if (this.channel) {
      try { this.channel.postMessage(fullPayload); } catch (e) {}
    }

    // 2. WebRTC P2P DataChannels (Cross Device)
    if (this.isHost) {
      this.connections.forEach((conn) => {
        if (conn.open) {
          try { conn.send(fullPayload); } catch (e) {}
        }
      });
    } else if (this.hostConn && this.hostConn.open) {
      try { this.hostConn.send(fullPayload); } catch (e) {}
    }

    // 3. LocalStorage
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
    if (this.presenceInterval) clearInterval(this.presenceInterval);
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
    this.connectionListeners.clear();
  }
}

export const syncService = new SyncService();
