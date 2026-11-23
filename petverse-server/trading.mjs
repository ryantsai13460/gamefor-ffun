import { randomBytes } from 'node:crypto';
import { exchangePets } from '../assets/petverse/model.js';

const tradeLifetime = 90_000;
const inviteCooldown = 4000;
const offerLimit = 4;

function eligiblePets(player, ids) {
  return ids.flatMap(id => {
    const pet = player.progress.inventory.find(entry => entry.id === id);
    if (!pet || pet.locked || pet.favorite || player.progress.equipped.includes(id)) return [];
    return [{ id, speciesId: pet.speciesId, variant: pet.variant }];
  });
}

export function createTrading({ players, send, exchange, announceProgress, publicChange }) {
  const byPlayer = new Map();

  function notify(trade, message) {
    for (const [me, other] of [[trade.first, trade.second], [trade.second, trade.first]]) {
      send(me, { type: 'trade', trade: {
        id: trade.id,
        state: trade.state,
        revision: trade.revision,
        peer: { id: other.id, name: other.name },
        initiatedByMe: trade.first === me,
        mine: eligiblePets(me, trade.offers.get(me.id)),
        theirs: eligiblePets(other, trade.offers.get(other.id)),
        confirmedByMe: trade.confirmed.has(me.id),
        confirmedByPeer: trade.confirmed.has(other.id),
        expiresAt: trade.expiresAt,
        ...(message ? { message } : {})
      } });
    }
  }

  function close(trade, message) {
    byPlayer.delete(trade.first.id);
    byPlayer.delete(trade.second.id);
    trade.state = 'closed';
    notify(trade, message);
  }

  function refuse(player, code, message, requestId) {
    send(player, { type: 'error', code, message, requestId });
  }

  function acknowledge(player, requestId) {
    send(player, { type: 'trade-result', requestId });
  }

  return {
    handle(player, command, now) {
      const { step, tradeId, requestId } = command;
      const reject = (code, message) => refuse(player, code, message, requestId);
      if (step === 'invite') {
        const other = players.get(command.peerId);
        if (!other || other === player || other.room !== player.room) {
          return reject('player_unavailable', 'Choose another explorer in your private meadow.');
        }
        if (byPlayer.has(player.id) || byPlayer.has(other.id)) return reject('trade_busy', 'An explorer is already trading.');
        if (now < (player.nextTradeAt || 0)) return reject('trade_cooldown', 'Wait a moment before sending another invite.');
        const trade = {
          id: randomBytes(12).toString('base64url'), first: player, second: other,
          state: 'invited', revision: 0, expiresAt: now + tradeLifetime,
          offers: new Map([[player.id, []], [other.id, []]]), confirmed: new Set()
        };
        player.nextTradeAt = now + inviteCooldown;
        byPlayer.set(player.id, trade);
        byPlayer.set(other.id, trade);
        notify(trade);
        return acknowledge(player, requestId);
      }

      const trade = byPlayer.get(player.id);
      if (!trade || trade.id !== tradeId) return reject('trade_unavailable', 'This trade is no longer available.');
      if (now >= trade.expiresAt) {
        close(trade, 'The trade expired.');
        return reject('trade_unavailable', 'This trade has expired.');
      }
      if (step === 'cancel') {
        close(trade, 'The trade was cancelled.');
        return acknowledge(player, requestId);
      }
      if (step === 'accept' && trade.state === 'invited' && player === trade.second) {
        trade.state = 'open';
        trade.expiresAt = now + tradeLifetime;
        notify(trade);
        return acknowledge(player, requestId);
      }
      if (trade.state !== 'open') return reject('trade_pending', 'Wait for the other explorer to accept.');
      if (step === 'offer') {
        const ids = command.petIds;
        if (ids.length > offerLimit || new Set(ids).size !== ids.length || eligiblePets(player, ids).length !== ids.length) {
          return reject('invalid_offer', 'Choose up to four of your unlocked, unequipped pets that are not favorites.');
        }
        trade.offers.set(player.id, ids);
        trade.revision++;
        trade.confirmed.clear();
        notify(trade);
        return acknowledge(player, requestId);
      }
      if (step !== 'confirm') return reject('invalid_trade', 'This trade action is unavailable.');
      if (command.revision !== trade.revision) return reject('offer_changed', 'The offer changed. Review the current pets before confirming.');
      const firstIds = trade.offers.get(trade.first.id);
      const secondIds = trade.offers.get(trade.second.id);
      if (!firstIds.length || !secondIds.length) return reject('incomplete_offer', 'Both explorers must offer a pet before confirming.');
      trade.confirmed.add(player.id);
      if (trade.confirmed.size < 2) {
        notify(trade);
        return acknowledge(player, requestId);
      }

      const { first, second, event } = exchangePets(trade.first.progress, trade.second.progress, { firstIds, secondIds }, { now });
      if (event.type === 'error') {
        close(trade, event.message);
        return reject(event.code, event.message);
      }
      try {
        exchange(trade.first, first, trade.second, second);
      } catch {
        close(trade, 'The trade could not be saved. Both inventories were kept.');
        return reject('trade_save_failed', 'The trade could not be saved.');
      }
      announceProgress(trade.first, event);
      announceProgress(trade.second, event);
      publicChange(trade.first);
      close(trade, 'Trade complete.');
      return acknowledge(player, requestId);
    },
    expire(now) {
      for (const trade of new Set(byPlayer.values())) {
        if (now >= trade.expiresAt) close(trade, 'The trade expired.');
      }
    },
    leave(player) {
      const trade = byPlayer.get(player.id);
      if (trade) close(trade, 'The other explorer disconnected.');
    }
  };
}
