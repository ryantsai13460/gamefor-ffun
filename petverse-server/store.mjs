import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createProgress, restoreProgress } from '../assets/petverse/model.js';

const receiptLimit = 128;
const tokenHash = token => createHash('sha256').update(token).digest('hex');

export function openStore(path, profileLimit) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 1500;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      revision INTEGER NOT NULL, progress TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS receipts (
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      request_id TEXT NOT NULL, revision INTEGER NOT NULL, event TEXT NOT NULL,
      PRIMARY KEY (profile_id, request_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS receipts_by_revision ON receipts(profile_id, revision);
  `);
  const count = db.prepare('SELECT count(*) AS count FROM profiles');
  const byToken = db.prepare('SELECT id, name, revision, progress FROM profiles WHERE token_hash = ?');
  const insert = db.prepare('INSERT INTO profiles (id, token_hash, name, revision, progress) VALUES (?, ?, ?, ?, ?)');
  const save = db.prepare('UPDATE profiles SET progress = ?, revision = revision + 1 WHERE id = ? AND revision = ?');
  const receipt = db.prepare('SELECT event FROM receipts WHERE profile_id = ? AND request_id = ?');
  const addReceipt = db.prepare('INSERT INTO receipts (profile_id, request_id, revision, event) VALUES (?, ?, ?, ?)');
  const prune = db.prepare(`DELETE FROM receipts WHERE profile_id = ? AND revision <= (
    SELECT revision FROM receipts WHERE profile_id = ? ORDER BY revision DESC LIMIT 1 OFFSET ?
  )`);

  function transaction(write) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = write();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function saveProgress(player, progress) {
    if (save.run(JSON.stringify(progress), player.id, player.version).changes !== 1) {
      throw new Error('The saved progress was updated by another session.');
    }
  }

  return {
    create() {
      return transaction(() => {
        if (count.get().count >= profileLimit) return null;
        const token = randomBytes(32).toString('base64url');
        const id = randomBytes(12).toString('base64url');
        const name = `Explorer ${id.slice(0, 5).toUpperCase()}`;
        const progress = createProgress();
        insert.run(id, tokenHash(token), name, 0, JSON.stringify(progress));
        return { token, id, name, progress, version: 0 };
      });
    },
    restore(token) {
      const row = byToken.get(tokenHash(token));
      if (!row) return null;
      return { token, id: row.id, name: row.name, version: row.revision, progress: restoreProgress(JSON.parse(row.progress)) };
    },
    receipt(player, requestId) {
      const row = receipt.get(player.id, requestId);
      return row ? JSON.parse(row.event) : null;
    },
    record(player, progress, requestId, event) {
      transaction(() => {
        saveProgress(player, progress);
        const revision = player.version + 1;
        addReceipt.run(player.id, requestId, revision, JSON.stringify(event));
        prune.run(player.id, player.id, receiptLimit);
      });
      player.progress = progress;
      player.version++;
    },
    checkpoint(player, progress) {
      saveProgress(player, progress);
      player.progress = progress;
      player.version++;
    },
    exchange(first, firstProgress, second, secondProgress) {
      transaction(() => {
        saveProgress(first, firstProgress);
        saveProgress(second, secondProgress);
      });
      first.progress = firstProgress;
      first.version++;
      second.progress = secondProgress;
      second.version++;
    },
    close() { db.close(); }
  };
}
