import Peer, { type DataConnection } from 'peerjs';
import type { SyncPayload } from '../types/game';

const CHANNEL_NAME = 'sdg_arcade_quiz_global_v8';
const LOCAL_STORAGE_KEY = 'sdg_arcade_quiz_global_event_v8';
const HOST_PEER_ID = 'sdg_arcade_quiz_global_host_v8';
const REST_RELAY_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019fad2b8e254248';

class SyncService {
  private channel: BroadcastChannel | null = null;
  private peer: Peer | null = null;
  private ws: WebSocket | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConn: DataConnection | null = null;
  private listeners: Set<(payload: SyncPayload) => void> = new Set();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  
  private pollInterval: ReturnType<typeof setInterval> | null = null;
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
    this.initWebSocket();
    this.initPeerJS(isHostView);
    this.startHttpRelayPolling();
    this.startPresenceHeartbeat();

    // Player Client instantly publishes REQUEST_STATE on boot for < 50ms sync
    if (!isHostView) {
      setTimeout(() => this.publish({ event: 'REQUEST_STATE' }), 100);
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

  private initWebSocket() {
    if (typeof window === 'undefined') return;

    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
      this.ws = null;
    }

    try {
      this.ws = new WebSocket('wss://free.qrserver.com/v1/ws');

      this.ws.onopen = () => {
        console.log('[SyncService] Primary WebSocket channel open');
        if (!this.isHost) {
          this.publish({ event: 'REQUEST_STATE' });
        }
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          if (typeof event.data === 'string') {
            const payload: SyncPayload = JSON.parse(event.data);
            if (payload && payload.event && payload.senderId !== this.clientId) {
              this.handleIncomingPayload(payload);
            }
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        setTimeout(() => this.initWebSocket(), 5000);
      };

      this.ws.onerror = () => {};
    } catch (e) {
      console.warn('[SyncService] WebSocket setup error:', e);
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
        this.peer = new Peer(HOST_PEER_ID, { debug: 1 });

        this.peer.on('open', (id) => {
          console.log('[SyncService] WebRTC Host registered:', id);
        });

        this.peer.on('connection', (conn) => {
          this.connections.set(conn.peer, conn);
          this.lastRemotePeerSeenTime = Date.now();
          this.setConnectedState(true);

          conn.on('data', (data) => this.handleRawData(data));
          conn.on('close', () => this.connections.delete(conn.peer));

          conn.send({ event: 'PLAYER_READY', senderId: this.clientId, timestamp: Date.now() });
        });

        this.peer.on('error', (err) => {
          console.warn('[SyncService] PeerJS notice:', err.type);
        });
      } else {
        this.peer = new Peer({ debug: 1 });
        this.peer.on('open', () => this.connectToGlobalHost());
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
        setTimeout(() => this.connectToGlobalHost(), 3000);
      });
    } catch (e) {
      console.warn('[SyncService] Connect host error:', e);
    }
  }

  private startPresenceHeartbeat() {
    if (this.presenceInterval) clearInterval(this.presenceInterval);

    // Heartbeat ping every 2 seconds to advertise active presence
    this.presenceInterval = setInterval(() => {
      const payloadEvent = this.isHost ? 'HOST_HEARTBEAT' : 'PLAYER_HEARTBEAT';
      this.publish({ event: payloadEvent });

      // Check if remote peer has been seen in last 6 seconds
      const isRemoteActive = (Date.now() - this.lastRemotePeerSeenTime) < 6000;
      this.setConnectedState(isRemoteActive);
    }, 2000);
  }

  private startHttpRelayPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    // Initial fetch to sync state immediately on boot
    this.pollHttpRelay();

    // Poll HTTP REST Relay every 1 second
    this.pollInterval = setInterval(() => {
      this.pollHttpRelay();
    }, 1000);
  }

  private async pollHttpRelay() {
    try {
      const res = await fetch(REST_RELAY_URL, { cache: 'no-store' });
      if (res.ok) {
        const result = await res.json();
        if (result && result.data && result.data.timestamp) {
          const payload: SyncPayload = result.data;
          if (this.lastProcessedTimestamp === 0 || payload.timestamp > this.lastProcessedTimestamp) {
            if (payload.senderId !== this.clientId) {
              this.handleIncomingPayload(payload);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SyncService] HTTP relay poll notice:', e);
    }
  }

  private async publishHttpRelay(payload: SyncPayload) {
    try {
      await fetch(REST_RELAY_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'sdg_arcade_global_state', data: payload })
      });
    } catch (e) {
      console.warn('[SyncService] HTTP relay publish notice:', e);
    }
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
    if (this.lastProcessedTimestamp === 0 || payload.timestamp > this.lastProcessedTimestamp) {
      this.lastProcessedTimestamp = payload.timestamp;

      // Mark remote peer active
      this.lastRemotePeerSeenTime = Date.now();
      this.setConnectedState(true);

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

    // 1. BroadcastChannel (Same Device)
    if (this.channel) {
      try { this.channel.postMessage(fullPayload); } catch (e) {}
    }

    // 2. Primary WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(fullPayload)); } catch (e) {}
    }

    // 3. WebRTC P2P DataChannels
    if (this.isHost) {
      this.connections.forEach((conn) => {
        if (conn.open) {
          try { conn.send(fullPayload); } catch (e) {}
        }
      });
    } else if (this.hostConn && this.hostConn.open) {
      try { this.hostConn.send(fullPayload); } catch (e) {}
    }

    // 4. LocalStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fullPayload));
    } catch (e) {}

    // 5. HTTPS REST Relay (Don't publish routine HEARTBEAT to HTTP to reduce rate usage, only state changes & requests)
    if (payload.event !== 'PLAYER_HEARTBEAT' && payload.event !== 'HOST_HEARTBEAT') {
      this.publishHttpRelay(fullPayload);
    }
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
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.presenceInterval) clearInterval(this.presenceInterval);
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
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
