const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!(await isAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await request.json();
    if (body.operation === 'list') return json({ vocabulary: await supabaseRequest('/rest/v1/vocabulary?select=word') });
    if (body.operation === 'learn' && typeof body.word === 'string' && body.word.length) {
      const vocabulary = await supabaseRequest('/rest/v1/vocabulary', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ word: body.word }) });
      return json({ vocabulary: vocabulary[0] ?? { word: body.word } });
    }
    if (body.operation === 'seen' && Array.isArray(body.words)) {
      const words = body.words.filter((word: unknown): word is string => typeof word === 'string' && word.length);
      if (!words.length) return json({ vocabulary: [] });
      const filter = words.map((word) => encodeURIComponent(JSON.stringify(word))).join(',');
      const vocabulary = await supabaseRequest(`/rest/v1/vocabulary?word=in.(${filter})&select=word`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ last_seen: new Date().toISOString() }) });
      return json({ vocabulary });
    }
    return json({ error: 'Invalid request' }, 400);
  } catch (error) {
    console.error('Vocabulary function error:', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
});

async function isAuthorized(request: Request) {
  const secret = Deno.env.get('JWT_SECRET');
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || !token) return false;
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    const payload = JSON.parse(new TextDecoder().decode(base64urlBytes(encodedPayload)));
    if (payload.exp <= Math.floor(Date.now() / 1000) || payload.role !== 'authenticated') return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, base64urlBytes(encodedSignature), new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));
  } catch { return false; }
}

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase server configuration is missing');
  const response = await fetch(`${url}${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers } });
  if (!response.ok) throw new Error('Supabase request failed');
  return response.json();
}

function base64urlBytes(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
