import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { WebSocket } from "ws";
import { ChildProcess, spawn } from "child_process";
import path from "path";

const PORT = 18765;
const WS_URL = `ws://localhost:${PORT}`;

let serverProcess: ChildProcess;
let openSockets: WebSocket[] = [];
let roomCounter = 0;

function uniqueRoom() {
  return `R${++roomCounter}_${Date.now()}`;
}

function createClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on("open", () => {
      openSockets.push(ws);
      resolve(ws);
    });
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket, timeoutMs = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("waitForMessage timeout")), timeoutMs);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function expectNoMessage(ws: WebSocket, timeoutMs = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeAllListeners("message");
      resolve();
    }, timeoutMs);
    ws.once("message", (data) => {
      clearTimeout(timer);
      reject(new Error(`Unexpected message: ${data.toString()}`));
    });
  });
}

function send(ws: WebSocket, msg: Record<string, unknown>) {
  ws.send(JSON.stringify(msg));
}

describe("WebSocket Server E2E", { timeout: 15000 }, () => {
  beforeAll(async () => {
    const serverPath = path.resolve(__dirname, "../../server/index.js");
    serverProcess = spawn("node", [serverPath], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: "pipe",
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(() => {
    for (const ws of openSockets) {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
    openSockets = [];
  });

  afterAll(() => {
    serverProcess?.kill();
  });

  describe("Room Join Flow", () => {
    it("should join a room and receive joined message with empty users", async () => {
      const room = uniqueRoom();
      const ws = await createClient();
      const msgPromise = waitForMessage(ws);

      send(ws, { type: "join", userId: "u1", roomCode: room, name: "Alice", skin: "orange" });

      const msg = await msgPromise;
      expect(msg.type).toBe("joined");
      expect(msg.users).toEqual([]);
    });

    it("should notify existing users when a new user joins", async () => {
      const room = uniqueRoom();
      const ws1 = await createClient();
      send(ws1, { type: "join", userId: "a1", roomCode: room, name: "Alice", skin: "orange" });
      await waitForMessage(ws1); // joined

      const ws2 = await createClient();
      const notifyPromise = waitForMessage(ws1);
      const joinPromise = waitForMessage(ws2);

      send(ws2, { type: "join", userId: "a2", roomCode: room, name: "Bob", skin: "gray" });

      const [notification, joinMsg] = await Promise.all([notifyPromise, joinPromise]);

      expect(notification.type).toBe("user_joined");
      expect(notification.userId).toBe("a2");
      expect(notification.name).toBe("Bob");
      expect(notification.skin).toBe("gray");

      expect(joinMsg.type).toBe("joined");
      expect(joinMsg.users).toHaveLength(1);
      expect(joinMsg.users[0].userId).toBe("a1");
    });
  });

  describe("State Sharing", () => {
    it("should broadcast position state to other users in the room", async () => {
      const room = uniqueRoom();
      const ws1 = await createClient();

      send(ws1, { type: "join", userId: "s1", roomCode: room, name: "P1", skin: "orange" });
      await waitForMessage(ws1); // joined

      const ws2 = await createClient();
      const p1 = waitForMessage(ws1); // user_joined
      const p2 = waitForMessage(ws2); // joined
      send(ws2, { type: "join", userId: "s2", roomCode: room, name: "P2", skin: "gray" });
      await Promise.all([p1, p2]);

      const statePromise = waitForMessage(ws2);
      send(ws1, { type: "state", x: 100, y: 200, active: true, skin: "orange" });

      const stateMsg = await statePromise;
      expect(stateMsg.type).toBe("state");
      expect(stateMsg.userId).toBe("s1");
      expect(stateMsg.x).toBe(100);
      expect(stateMsg.y).toBe(200);
      expect(stateMsg.active).toBe(true);
    });

    it("should not broadcast state to users in different rooms", async () => {
      const room1 = uniqueRoom();
      const room2 = uniqueRoom();
      const ws1 = await createClient();
      const ws2 = await createClient();

      send(ws1, { type: "join", userId: "r1", roomCode: room1, name: "P1", skin: "orange" });
      await waitForMessage(ws1);

      send(ws2, { type: "join", userId: "r2", roomCode: room2, name: "P2", skin: "gray" });
      await waitForMessage(ws2);

      send(ws1, { type: "state", x: 50, y: 50, active: false });

      await expectNoMessage(ws2);
    });
  });

  describe("Chat", () => {
    it("should broadcast chat to all users in room including sender", async () => {
      const room = uniqueRoom();
      const ws1 = await createClient();

      send(ws1, { type: "join", userId: "c1", roomCode: room, name: "Alice", skin: "orange" });
      await waitForMessage(ws1); // joined

      const ws2 = await createClient();
      const p1 = waitForMessage(ws1); // user_joined
      const p2 = waitForMessage(ws2); // joined
      send(ws2, { type: "join", userId: "c2", roomCode: room, name: "Bob", skin: "gray" });
      await Promise.all([p1, p2]);

      const chat1Promise = waitForMessage(ws1);
      const chat2Promise = waitForMessage(ws2);
      send(ws1, { type: "chat", text: "Hello!" });

      const [chatToSender, chatToOther] = await Promise.all([chat1Promise, chat2Promise]);

      expect(chatToSender.type).toBe("chat");
      expect(chatToSender.text).toBe("Hello!");
      expect(chatToSender.name).toBe("Alice");

      expect(chatToOther.type).toBe("chat");
      expect(chatToOther.text).toBe("Hello!");
      expect(chatToOther.userId).toBe("c1");
    });

    it("should truncate chat messages to 30 characters", async () => {
      const room = uniqueRoom();
      const ws1 = await createClient();

      send(ws1, { type: "join", userId: "t1", roomCode: room, name: "Alice", skin: "orange" });
      await waitForMessage(ws1); // joined

      const ws2 = await createClient();
      const p1 = waitForMessage(ws1); // user_joined
      const p2 = waitForMessage(ws2); // joined
      send(ws2, { type: "join", userId: "t2", roomCode: room, name: "Bob", skin: "gray" });
      await Promise.all([p1, p2]);

      const chat1Promise = waitForMessage(ws1); // sender also gets chat
      const chat2Promise = waitForMessage(ws2);
      send(ws1, { type: "chat", text: "A".repeat(50) });

      const [, chatMsg] = await Promise.all([chat1Promise, chat2Promise]);
      expect(chatMsg.text).toHaveLength(30);
    });

    it("should ignore empty chat messages", async () => {
      const room = uniqueRoom();
      const ws1 = await createClient();

      send(ws1, { type: "join", userId: "e1", roomCode: room, name: "Alice", skin: "orange" });
      await waitForMessage(ws1); // joined

      const ws2 = await createClient();
      const p1 = waitForMessage(ws1); // user_joined
      const p2 = waitForMessage(ws2); // joined
      send(ws2, { type: "join", userId: "e2", roomCode: room, name: "Bob", skin: "gray" });
      await Promise.all([p1, p2]);

      send(ws1, { type: "chat", text: "" });

      await expectNoMessage(ws1); // sender shouldn't get empty chat either
      await expectNoMessage(ws2);
    });
  });

  describe("Leave / Disconnect", () => {
    it("should notify others when a user disconnects", async () => {
      const room = uniqueRoom();
      const ws1 = await createClient();

      send(ws1, { type: "join", userId: "d1", roomCode: room, name: "Alice", skin: "orange" });
      await waitForMessage(ws1); // joined

      const ws2 = await createClient();
      const p1 = waitForMessage(ws1); // user_joined
      const p2 = waitForMessage(ws2); // joined
      send(ws2, { type: "join", userId: "d2", roomCode: room, name: "Bob", skin: "gray" });
      await Promise.all([p1, p2]);

      const leavePromise = waitForMessage(ws1);
      ws2.close();
      openSockets = openSockets.filter((s) => s !== ws2);

      const leaveMsg = await leavePromise;
      expect(leaveMsg.type).toBe("user_left");
      expect(leaveMsg.userId).toBe("d2");
    });
  });
});
