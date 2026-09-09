import assert from 'node:assert/strict';
import test from 'node:test';
import { highlightSegments } from '../src/lib/lyrics.mjs';

test('highlights exact and overlapping vocabulary without changing lyrics', () => {
  assert.deepEqual(highlightSegments('考えている', ['考えて', '考えている']), [
    { text: '考えて', words: ['考えて', '考えている'] },
    { text: 'いる', words: ['考えている'] },
  ]);
});

test('does not normalize or morphologically match vocabulary', () => {
  assert.deepEqual(highlightSegments('考えて 考える', ['考えて']), [
    { text: '考えて', words: ['考えて'] },
    { text: ' 考える', words: [] },
  ]);
});
