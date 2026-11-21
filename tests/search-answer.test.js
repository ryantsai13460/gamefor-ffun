import assert from 'node:assert/strict';
import test from 'node:test';
import { builtInReferenceAnswer, findSearchReferences, localAssistantAnswer } from '../assets/search-answer.js';

test('calculates common statistics and explains the calculation', () => {
  const mean = localAssistantAnswer('Find the average of 12, 15, and 18.');
  assert.equal(mean.title, 'Calculator');
  assert.match(mean.text, /^Mean: 15\n\nAdd the 3 values to get 45/);
  assert.match(localAssistantAnswer('What is the median of 3, -1, 8, 6?').text, /^Median: 4\.5/);
  assert.match(localAssistantAnswer('median of 0, 5, 2').text, /^Median: 2/);
  assert.equal(localAssistantAnswer('average of today’s temperatures'), null);
});

test('calculates proportions, change and simplified fractions, and handles zero denominators', () => {
  assert.match(localAssistantAnswer('What percent is 30 out of 80?').text, /^37\.5%\n/);
  assert.match(localAssistantAnswer('Percentage increase from 80 to 100').text, /^25% increase/);
  assert.match(localAssistantAnswer('percentage change from 80 to 60').text, /^25% decrease/);
  assert.match(localAssistantAnswer('percentage change from 0 to 10').text, /undefined/);
  assert.match(localAssistantAnswer('simplify 24/-36').text, /^-2\/3\n/);
  assert.match(localAssistantAnswer('simplify 1/0').text, /zero denominator/);
  assert.equal(localAssistantAnswer('Calculate (24 × 3) + 18').text, '90');
  assert.equal(localAssistantAnswer('Convert 5 miles to km').text, '5 mi = 8.04672 km');
});

test('matches precise educational queries to first-party references', () => {
  assert.equal(findSearchReferences('Why does the sky look blue?')[0].url, 'https://spaceplace.nasa.gov/blue-sky/en/');
  assert.equal(findSearchReferences('learning html')[0].provider, 'MDN Web Docs');
  assert.equal(findSearchReferences('Why do we have seasons?')[0].title, 'What Causes the Seasons?');
  assert.equal(findSearchReferences('How to survive your first day in Minecraft')[0].provider, 'Minecraft');
  assert.deepEqual(findSearchReferences('latest sky-blue Minecraft texture mods'), []);
  const comparison = builtInReferenceAnswer('What is the difference between HTML and CSS?');
  assert.equal(comparison.label, 'Reference comparison');
  assert.deepEqual(comparison.sources.map(item => item.title), ['Basic HTML syntax', 'What is CSS?']);
  assert.match(comparison.text, /### HTML\n.*\n\n### CSS\n/);
  assert.equal(builtInReferenceAnswer('Compare HTML and spreadsheets'), null);
});
