export type ServerMessage =
  | { type: "joined"; users: PeerInfo[] }
  | { type: "user_joined"; userId: string; name: string; skin: string }
  | { type: "user_left"; userId: string }
  | { type: "state"; userId: string; x: number; y: number; active: boolean; skin?: string }
  | { type: "chat"; userId: string; name: string; text: string; timestamp: number };

export interface PeerInfo {
  userId: string;
  name: string;
  skin: string;
  x: number;
  y: number;
  active: boolean;
}

type MessageHandler = (msg: ServerMessage) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private handler: MessageHandler;
  private reconnectTimer: number | null = null;
  private url: string;
  private userId: string;
  private roomCode: string = "";
  private userName: string = "";
  private skin: string = "orange";

  constructor(url: string, handler: MessageHandler) {
    this.url = url;
    this.userId = crypto.randomUUID();
    this.handler = handler;
  }

  join(roomCode: string, name: string, skin: string) {
    this.roomCode = roomCode.toUpperCase();
    this.userName = name;
    this.skin = skin;
    this.connect();
  }

  private connect() {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.send({
        type: "join",
        userId: this.userId,
        roomCode: this.roomCode,
        name: this.userName,
        skin: this.skin,
      });
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as ServerMessage;
        this.handler(msg);
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      if (this.roomCode) {
        this.reconnectTimer = window.setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  sendState(x: number, y: number, active: boolean) {
    this.send({ type: "state", x, y, active, skin: this.skin });
  }

  sendChat(text: string) {
    this.send({ type: "chat", text: text.slice(0, 30) });
  }

  updateSkin(skin: string) {
    this.skin = skin;
  }

  leave() {
    this.send({ type: "leave" });
    this.roomCode = "";
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getUserId(): string {
    return this.userId;
  }

  private send(msg: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
