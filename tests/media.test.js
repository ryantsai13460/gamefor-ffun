import assert from 'node:assert/strict';
import test from 'node:test';
import {parseYouTubeVideo} from '../assets/media.js';

test('accepts YouTube watch, Shorts, video ID, short links, and privacy-enhanced embeds', () => {
  assert.deepEqual(parseYouTubeVideo('https://www.youtube.com/shorts/80VtSQHvWBo?si=value'), {
    id: '80VtSQHvWBo', short: true
  });

  for (const url of [
    'https://youtu.be/wJO_vIDZn-I',
    'youtube.com/watch?v=wJO_vIDZn-I',
    'https://www.youtube-nocookie.com/embed/wJO_vIDZn-I',
    'wJO_vIDZn-I'
  ]) {
    assert.deepEqual(parseYouTubeVideo(url), {id: 'wJO_vIDZn-I', short: false});
  }
});

test('rejects credentials, fake YouTube hosts, unsupported routes, and malformed IDs', () => {
  for (const url of [
    'https://user:pass@www.youtube.com/shorts/80VtSQHvWBo',
    'https://www.youtube.com@evil.example/shorts/80VtSQHvWBo',
    'https://www.youtube.com.evil.example/shorts/80VtSQHvWBo',
    'https://www.youtube.com:9443/shorts/80VtSQHvWBo',
    'https://www.youtube.com/channel/80VtSQHvWBo',
    'https://youtu.be/too-short',
    'javascript:alert(1)'
  ]) assert.equal(parseYouTubeVideo(url), null);
});
