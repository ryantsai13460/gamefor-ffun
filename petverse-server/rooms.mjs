import { randomBytes } from 'node:crypto';

const codePattern = /^PET-[0-9A-F]{10}$/;

function invitationCode() {
  return `PET-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export function createRooms({ limit, lifetimeMs, emptyMs }) {
  const rooms = new Map();
  const byCode = new Map();

  function regenerate(room) {
    let code;
    do { code = invitationCode(); } while (byCode.has(code));
    byCode.delete(room.code);
    room.code = code;
    byCode.set(code, room);
  }

  function isExpired(room, now) {
    return now >= room.expiresAt || (room.emptySince !== null && now >= room.emptySince + emptyMs);
  }

  return {
    hasSpace() { return rooms.size < limit; },
    contains(room) { return rooms.get(room.id) === room; },
    values() { return rooms.values(); },
    create(hostId, maxPlayers, now) {
      const room = { id: randomBytes(12).toString('base64url'), hostId, maxPlayers,
        expiresAt: now + lifetimeMs, emptySince: now, members: new Set(), nodeReadyAt: new Map() };
      rooms.set(room.id, room);
      regenerate(room);
      return room;
    },
    find(rawCode, now) {
      const code = typeof rawCode === 'string' && rawCode.length <= 20 ? rawCode.trim().toUpperCase() : '';
      const room = codePattern.test(code) && byCode.get(code);
      return room && !isExpired(room, now) ? room : null;
    },
    info(room, playerId) {
      const { id, hostId, maxPlayers, expiresAt } = room;
      return { id, hostId, maxPlayers, expiresAt, playerCount: room.members.size,
        ...(hostId === playerId ? { code: room.code } : {}) };
    },
    add(room, player) {
      room.members.add(player);
      room.emptySince = null;
    },
    remove(room, player, now) {
      if (room.members.delete(player) && !room.members.size) room.emptySince = now;
    },
    regenerate,
    close(room) {
      byCode.delete(room.code);
      rooms.delete(room.id);
    },
    expired(now) {
      return Array.from(rooms.values()).filter(room => isExpired(room, now));
    }
  };
}

export function createInviteLimiter({ limit = 12, intervalMs = 60_000, addressLimit = 1024 } = {}) {
  const addresses = new Map();
  function expire(now) {
    for (const [address, entry] of addresses) {
      if (entry.resetAt <= now) addresses.delete(address);
    }
  }

  return {
    take(address, now) {
      const entry = addresses.get(address);
      if (entry && entry.resetAt > now) {
        if (entry.count >= limit) return false;
        entry.count++;
        return true;
      }
      if (addresses.size >= addressLimit) expire(now);
      if (addresses.size >= addressLimit) return false;
      addresses.set(address, { resetAt: now + intervalMs, count: 1 });
      return true;
    },
    expire
  };
}
