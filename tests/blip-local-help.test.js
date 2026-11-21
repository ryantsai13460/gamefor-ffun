import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blipOfflineReply, blipOnboardingReply } from '../assets/blip-local-help.js';

test('onboarding offers real built-in tasks without matching open-ended questions', () => {
  assert.match(blipOnboardingReply('Hi, Blip.ai!').text, /quick calculation/);
  assert.match(blipOnboardingReply('How do I use Blip?').text, /Set up an AI model/);
  assert.match(blipOfflineReply('Help me with homework', 'study').text, /Tell me the subject/);
  assert.equal(blipOnboardingReply('Hey, can you explain how clocks work?'), null);
});

test('built-in study plans use the requested duration and keep the topic', () => {
  const plan = blipOfflineReply('Make a 15-minute chemistry study plan.', 'study');
  assert.equal(plan?.title, 'Built-in study plan');
  assert.match(plan.text, /15-minute study plan for chemistry/);
  const minutes = [...plan.text.matchAll(/^(\d+) min/mg)].reduce((total, match) => total + Number(match[1]), 0);
  assert.equal(minutes, 15);
  assert.doesNotMatch(blipOfflineReply('Help me make a 20-minute study plan.', 'study').text, /plan for/);
  assert.match(blipOfflineReply('How should I prepare for a biology quiz?', 'quick').text, /plan for biology quiz/);
  assert.equal(blipOfflineReply('What did the study find about sugar?', 'study'), null);
});

test('fraction comparisons compute exact results including mixed and negative fractions', () => {
  assert.match(blipOfflineReply('Which is greater, 3/5 or 5/8?', 'study').text, /^3\/5 is less than 5\/8\./);
  assert.match(blipOfflineReply('Compare 2/3 and 4/6.', 'quick').text, /^2\/3 equals 4\/6\./);
  assert.match(blipOfflineReply('Compare 1 1/2 and 2/3.', 'study').text, /^1 1\/2 is greater than 2\/3\./);
  assert.match(blipOfflineReply('Compare −3/4 and 1/-2.', 'study').text, /^-3\/4 is less than 1\/-2\./);
  assert.match(blipOfflineReply('Compare 1/0 and 3/5.', 'study').text, /zero denominator is undefined/);
});

test('built-in code and writing help are labeled and respect supported languages', () => {
  const javascript = blipOfflineReply('Show how to filter a list of game titles in JavaScript.', 'code');
  assert.ok(javascript.text.includes('.filter(title =>'));
  const python = blipOfflineReply('How do I filter a list in Python?', 'quick');
  assert.match(python.text, /\[title for title in games if/);
  assert.equal(blipOfflineReply('How do I filter a list in Ruby?', 'code'), null);
  assert.match(blipOfflineReply('Show a Hello World example in Python.', 'code').text, /print\("Hello, world!"\)/);
  assert.equal(blipOfflineReply('Help me outline an essay.', 'study').title, 'Built-in writing guide');
  assert.equal(blipOfflineReply('Explain neutron stars.', 'quick'), null);
});
