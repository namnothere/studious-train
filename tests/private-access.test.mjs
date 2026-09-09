import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('private access page contains the production authorization contract', async () => {
  const page = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  const functionCode = await readFile(
    new URL('../supabase/functions/authorize/index.ts', import.meta.url),
    'utf8',
  );
  const protectedPage = await readFile(new URL('../src/pages/songs.astro', import.meta.url), 'utf8');
  const geniusFunction = await readFile(new URL('../supabase/functions/genius/index.ts', import.meta.url), 'utf8');
  const vocabularyFunction = await readFile(new URL('../supabase/functions/vocabulary/index.ts', import.meta.url), 'utf8');

  assert.match(page, /id="unlock-form"/);
  assert.match(page, /id="credential"/);
  assert.match(page, /\/functions\/v1\/authorize/);
  assert.match(page, /Access denied\./);
  assert.match(functionCode, /401/);
  assert.match(functionCode, /ACCESS_PASSWORD_HASH/);
  assert.match(functionCode, /JWT_SECRET/);
  assert.match(functionCode, /now \+ 86400/);
  assert.doesNotMatch(functionCode, /AUTH_EMAIL|AUTH_PASSWORD/);
  assert.match(protectedPage, /hasAccessToken/);
  assert.match(protectedPage, /response\.status === 401/);
  assert.match(protectedPage, /clearAccessToken/);
  assert.match(protectedPage, /geniusId/);
  assert.doesNotMatch(protectedPage, /from\('songs'\)/);
  assert.match(geniusFunction, /SONG_ACCESS_TOKEN/);
  assert.match(geniusFunction, /`\/search\/\?q=/);
  assert.match(geniusFunction, /`\/song\/lyrics\//);
  assert.match(geniusFunction, /response\.status/);
  assert.match(geniusFunction, /response\.lyrics\?\.lyrics\?\.body\?\.html/);
  assert.match(geniusFunction, /instrumental/);
  assert.match(geniusFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(geniusFunction, /isAuthorized/);
  assert.match(vocabularyFunction, /operation === 'list'/);
  assert.match(vocabularyFunction, /operation === 'learn'/);
  assert.match(vocabularyFunction, /operation === 'seen'/);
  assert.doesNotMatch(protectedPage, /SONG_ACCESS_TOKEN/);
});

test('song cards navigate to the standalone lyrics route', async () => {
  const songsPage = await readFile(new URL('../src/pages/songs.astro', import.meta.url), 'utf8');
  const lyricsPage = await readFile(new URL('../src/pages/song.astro', import.meta.url), 'utf8');

  assert.match(songsPage, /return `\$\{base\}song\?slug=/);
  assert.match(songsPage, /cursor:pointer/);
  assert.match(lyricsPage, /action: 'song'/);
});

test('lyrics route renders stored lyric text safely', async () => {
  const lyricsPage = await readFile(new URL('../src/pages/song.astro', import.meta.url), 'utf8');
  const geniusFunction = await readFile(new URL('../supabase/functions/genius/index.ts', import.meta.url), 'utf8');

  assert.match(lyricsPage, /lyrics = loadedSong\.lyrics/);
  assert.match(lyricsPage, /renderLyrics\(lyrics\)/);
  assert.doesNotMatch(lyricsPage, /getSupabaseClient|from\('vocabulary'\)/);
  assert.match(lyricsPage, /selectionchange/);
  assert.match(lyricsPage, /functions\/v1\/vocabulary/);
  assert.doesNotMatch(geniusFunction, /operation === 'list'|operation === 'learn'|operation === 'seen'/);
  assert.match(lyricsPage, /new DOMParser\(\)/);
  assert.match(lyricsPage, /allowedTags/);
  assert.doesNotMatch(lyricsPage, /lyrics\.split\('\\n'\)/);
  assert.match(lyricsPage, /createTextNode/);
});
