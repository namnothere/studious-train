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
  const accessToken = Deno.env.get('SONG_ACCESS_TOKEN');
  if (!accessToken) return json({ error: 'Server misconfigured' }, 500);
  try {
    const body = await request.json();
    if (body.action === 'recent') {
      const songs = await supabaseRequest('/rest/v1/songs?select=genius_id,title,artist,artwork_url,genius_url&order=created_at.desc&limit=5');
      return json({ songs: songs.map((song: Record<string, unknown>) => ({ geniusId: song.genius_id, title: song.title, artist: song.artist, artworkUrl: song.artwork_url, geniusUrl: song.genius_url })) });
    }
    if (body.action === 'search' && typeof body.query === 'string' && body.query.trim()) {
      const response = await geniusRequest(`/search/?q=${encodeURIComponent(body.query.trim())}&per_page=20&page=1`, accessToken);
      const songs = response.hits
        .map(({ result }: { result: Record<string, unknown> }) => ({ geniusId: result.id, title: result.title, artist: (result.primary_artist as { name: string }).name, artworkUrl: result.header_image_url ?? null, geniusUrl: result.url, instrumental: result.instrumental === true, lyricsState: result.lyrics_state }))
        .filter((song: { instrumental: boolean; lyricsState: unknown }) => !song.instrumental && song.lyricsState === 'complete')
        .map(({ instrumental, lyricsState, ...song }: { instrumental: boolean; lyricsState: unknown; geniusId: number; title: string; artist: string; artworkUrl: string | null; geniusUrl: string }) => song);
      return json({ songs });
    }
    if (body.action === 'song' && body.song && Number.isInteger(body.song.geniusId)) {
      const cached = await supabaseRequest(`/rest/v1/songs?genius_id=eq.${body.song.geniusId}&select=*`);
      if (cached[0]) return json({ song: { geniusId: cached[0].genius_id, title: cached[0].title, artist: cached[0].artist, artworkUrl: cached[0].artwork_url, geniusUrl: cached[0].genius_url, lyrics: cached[0].lyrics } });
      if (typeof body.song.title !== 'string' || typeof body.song.artist !== 'string') return json({ error: 'Song metadata required' }, 400);
      const response = await geniusRequest(`/song/lyrics/?id=${body.song.geniusId}/`, accessToken);
      const lyrics = response.lyrics?.lyrics?.body?.html ?? null;
      if (typeof lyrics !== 'string' || !lyrics.trim()) return json({ error: 'Lyrics unavailable' }, 404);
      const inserted = await supabaseRequest('/rest/v1/songs', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ genius_id: body.song.geniusId, title: body.song.title, artist: body.song.artist, artwork_url: body.song.artworkUrl, genius_url: body.song.geniusUrl, lyrics }),
      });
      return json({ song: { ...body.song, lyrics: inserted[0]?.lyrics ?? lyrics } });
    }
    return json({ error: 'Invalid request' }, 400);
  } catch (error) {
    console.error('Genius function error:', error);

    return json(
      {
        error: error instanceof Error ? error.message : String(error)
      },
      502,
    );
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
  if (!response.ok) {
    if (response.status === 409 && options.method === 'POST') return supabaseRequest(`/rest/v1/songs?genius_id=eq.${JSON.parse(String(options.body)).genius_id}&select=*`);
    throw new Error('Supabase request failed');
  }
  return response.json();
}

async function geniusRequest(path: string, accessToken: string) {
  const geniusApi = Deno.env.get('SONG_BASE_API_URL');
  const geniusHost = Deno.env.get('SONG_BASE_API_HOST');
  if (!geniusApi || !geniusHost) throw new Error('Genius server configuration is missing');
  const response = await fetch(`${geniusApi}${path}`, {
    headers: {
      'x-rapidapi-key': `${accessToken}`,
      'x-rapidapi-host': geniusHost,
    }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Genius request failed (${response.status}): ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

function base64urlBytes(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
