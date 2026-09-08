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
  assert.match(geniusFunction, /GENIUS_ACCESS_TOKEN/);
  assert.match(geniusFunction, /`\/search\/\?q=/);
  assert.match(geniusFunction, /`\/song\/lyrics\//);
  assert.match(geniusFunction, /response\.status/);
  assert.match(geniusFunction, /response\.response\?\.lyrics\?\.lyrics\?\.body\?\.plain/);
  assert.match(geniusFunction, /instrumental/);
  assert.match(geniusFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(geniusFunction, /isAuthorized/);
  assert.doesNotMatch(protectedPage, /GENIUS_ACCESS_TOKEN/);
});
