import assert from 'node:assert/strict';
import test from 'node:test';
import {analyzeBlipFiles} from '../assets/blip-file-analysis.js';

const file = (name, text, type = 'text/plain', truncated = false) => ({name, text, type, truncated});

test('summarizes loaded attachments by citing their own text and labels clipping', () => {
  const notes = file('practice.md', 'Practice tuning the cello.\nPractice the cello with a metronome.\nTake breaks.', 'text/markdown', true);
  const reply = analyzeBlipFiles('Summarize this attachment.', [notes]);
  assert.equal(reply.kind, 'local');
  assert.equal(reply.title, 'Extractive file summary');
  assert.match(reply.text, /practice\.md\n3 lines · \d+ words in the loaded text/);
  assert.match(reply.text, /Line 2 · Practice the cello with a metronome\./);
  assert.match(reply.text, /only the loaded excerpt/);
});

test('locates matching passages by line, reports misses, and defers unrelated actions', () => {
  const notes = file('notes.txt', 'The office opened on Monday.\nThe café closes at 5 PM.\nParking is available until 6 PM.');
  const found = analyzeBlipFiles('When does the cafe close?', [notes]);
  assert.equal(found.title, 'Local file excerpts');
  assert.match(found.text, /Line 2 · The café closes at 5 PM\./);
  assert.doesNotMatch(found.text, /Line 1 ·|Line 3 ·/);
  assert.match(analyzeBlipFiles('What is the reservation fee?', [notes]).text, /No excerpts matched/);
  assert.equal(analyzeBlipFiles('Write a short poem.', [notes]), null);
  assert.equal(analyzeBlipFiles('Summarize this.', []), null);
});

test('profiles quoted CSV with commas, embedded newlines and escaped quotes', () => {
  const items = file('items.csv', 'Item,Amount\r\n"Blue, kit",10\r\n"Red\nkit",-2\r\n"Bright ""kit""",4\r\nUnpriced,', 'text/csv');
  const reply = analyzeBlipFiles('Show the column profiles.', [items]);
  assert.equal(reply.title, 'Local table profile');
  assert.match(reply.text, /4 data rows · 2 columns/);
  assert.match(reply.text, /Blue, kit \/ Red kit \/ Bright "kit"/);
  assert.match(reply.text, /Amount · 3 filled, 1 blank, 3 distinct · 3 numeric, min -2, max 10, mean 4, median 4, sum 12/);
});

test('profiles TSV without counting clipped records and flags an unclosed CSV field', () => {
  const table = file('grades.tsv', 'Name\tGrade\nAna\t8\nBob\t999', 'text/tab-separated-values', true);
  const reply = analyzeBlipFiles('Analyze the table and find the average grade.', [table]);
  assert.match(reply.text, /1 data row · 2 columns/);
  assert.match(reply.text, /mean 8/);
  assert.match(reply.text, /before the clipping boundary/);
  assert.doesNotMatch(reply.text, /999/);
  const malformed = file('invalid.csv', 'Item,Amount\n"unfinished,2', 'text/csv');
  assert.match(analyzeBlipFiles('Profile the CSV.', [malformed]).text, /quoted field was left open/);
});
