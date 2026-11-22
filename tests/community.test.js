import assert from 'node:assert/strict';
import test from 'node:test';
import { discordInviteCode, discordServerId, publicDiscordWidget } from '../assets/community.js';

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

test('public Discord widgets keep valid voice and stage labels and discard unrelated fields', () => {
  const serverId = '81384788765712384';
  const payload = {
    id: serverId, name: 'Arcade Guild',
    instant_invite: 'https://discord.gg/do-not-use',
    members: [{ username: 'Member data', avatar_url: 'https://example.com/member.jpg' }],
    channels: [
      { id: '19184788765712384', name: 'Stage', type: 13, position: 2 },
      { id: '20184788765712384', name: 'First', position: 0, member: 'Never copy' },
      { id: '19184788765712384', name: 'Duplicate', position: 3 },
      { id: '21184788765712384', name: 'Text', type: 0, position: 1 },
      { id: '22184788765712384', name: 'Restricted', type: 2, nsfw: true },
      { id: '23184788765712384', name: 'Hidden control\u202E' },
      { id: 'bad-id', name: 'Invalid' }
    ]
  };
  assert.deepEqual(publicDiscordWidget(payload, serverId), {
    name: 'Arcade Guild',
    channels: [
      { id: '20184788765712384', name: 'First', position: 0 },
      { id: '19184788765712384', name: 'Stage', position: 2 }
    ]
  });
  assert.equal(publicDiscordWidget(payload, '13084788765712384'), null);
  assert.equal(publicDiscordWidget({ ...payload, nsfw_level: 3 }, serverId), null);
  assert.equal(publicDiscordWidget({ ...payload, channels: undefined }, serverId), null);
});
