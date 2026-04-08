const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8765;
const wss = new WebSocketServer({ port: PORT });

// rooms: Map<roomCode, Map<userId, { ws, name, skin, x, y, active }>>
const rooms = new Map();

wss.on('connection', (ws) => {
  let userId = null;
  let roomCode = null;

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    const type = msg.type;

    if (type === 'join') {
      userId = msg.userId;
      roomCode = msg.roomCode?.toUpperCase();
      const name = msg.name || 'Anonymous';
      const skin = msg.skin || 'orange';

      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, new Map());
      }

      const room = rooms.get(roomCode);
      room.set(userId, { ws, name, skin, x: 0.85, y: 0.85, active: false });

      // Send current room members to the new joiner
      const users = [...room.entries()]
        .filter(([id]) => id !== userId)
        .map(([id, peer]) => ({
          userId: id,
          name: peer.name,
          skin: peer.skin,
          x: peer.x,
          y: peer.y,
          active: peer.active,
        }));

      safeSend(ws, { type: 'joined', users });

      // Notify others
      broadcast(roomCode, userId, { type: 'user_joined', userId, name, skin });

    } else if (type === 'state') {
      if (!userId || !roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      const peer = room.get(userId);
      if (peer) {
        peer.x = msg.x ?? peer.x;
        peer.y = msg.y ?? peer.y;
        peer.active = msg.active ?? peer.active;
        if (msg.skin) peer.skin = msg.skin;
      }

      broadcast(roomCode, userId, {
        type: 'state',
        userId,
        x: msg.x,
        y: msg.y,
        active: msg.active,
        skin: msg.skin,
      });

    } else if (type === 'chat') {
      if (!userId || !roomCode) return;
      const text = (msg.text || '').slice(0, 30);
      if (!text) return;

      const room = rooms.get(roomCode);
      const peer = room?.get(userId);
      const name = peer?.name || 'Anonymous';

      // Broadcast to everyone including sender
      broadcastAll(roomCode, {
        type: 'chat',
        userId,
        name,
        text,
        timestamp: Date.now(),
      });

    } else if (type === 'leave') {
      handleLeave();
    }
  });

  ws.on('close', () => handleLeave());
  ws.on('error', () => handleLeave());

  function handleLeave() {
    if (!userId || !roomCode) return;
    const room = rooms.get(roomCode);
    if (room) {
      room.delete(userId);
      broadcast(roomCode, userId, { type: 'user_left', userId });
      if (room.size === 0) {
        rooms.delete(roomCode);
      }
    }
    userId = null;
    roomCode = null;
  }
});

function broadcast(roomCode, excludeUserId, message) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const text = JSON.stringify(message);
  for (const [id, peer] of room.entries()) {
    if (id !== excludeUserId) {
      safeSend(peer.ws, text);
    }
  }
}

function broadcastAll(roomCode, message) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const text = JSON.stringify(message);
  for (const [, peer] of room.entries()) {
    safeSend(peer.ws, text);
  }
}

function safeSend(ws, data) {
  if (ws.readyState !== ws.OPEN) return;
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  ws.send(text);
}

console.log(`keycat server running on port ${PORT}`);
