const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { credential } = await request.json();
    if (typeof credential !== 'string' || !(await matchesPassword(credential, Deno.env.get('ACCESS_PASSWORD_HASH')))) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) return json({ error: 'Server misconfigured' }, 500);
    return json({ access_token: await createAccessToken(jwtSecret) });
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }
});

async function matchesPassword(password: string, expectedHash: string | undefined) {
  if (!expectedHash) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  const actualHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return actualHash.length === expectedHash.length && [...actualHash].every((char, index) => char === expectedHash[index]);
}

async function createAccessToken(secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => base64url(JSON.stringify(value));
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ aud: 'authenticated', role: 'authenticated', sub: '00000000-0000-0000-0000-000000000001', iat: now, exp: now + 86400 });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64url(signature)}`;
}

function base64url(value: string | ArrayBuffer) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
