import assert from 'node:assert/strict';
import test from 'node:test';
import { discordInviteCode, discordServerId } from '../assets/community.js';

test('Discord settings accept only a bounded snowflake and first-party public invite routes', () => {
  assert.equal(discordServerId(' 81384788765712384 '), '81384788765712384');
  assert.equal(discordServerId('18446744073709551615'), '18446744073709551615');
  for (const bad of ['abc', '18446744073709551616', '00000000000000001', '81384788765712384/other', 12345678901234567]) {
    assert.equal(discordServerId(bad), '');
  }

  assert.equal(discordInviteCode('https://discord.gg/Arcade_A'), 'Arcade_A');
  assert.equal(discordInviteCode('https://discord.com/invite/Arcade-A/'), 'Arcade-A');
  for (const bad of [
    'https://discord.gg.example.test/invite/Arcade', 'https://discord.com@elsewhere.test/invite/Arcade',
    'https://visitor@discord.com/invite/Arcade', 'http://discord.gg/Arcade', 'https://discord.com:444/invite/Arcade',
    'https://discord.com/channels/81384788765712384', 'https://discord.gg/Arcade?comment=private',
    'https://discord.gg/Arcade#private', 'https://discord.com/invite/Arcade/more', 'https://discord.gg/unsafe%2fcode'
  ]) assert.equal(discordInviteCode(bad), '', bad);
});
