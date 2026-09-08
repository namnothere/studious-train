const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const geniusApi = 'https://api.genius.com';

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
	const accessToken = Deno.env.get('GENIUS_ACCESS_TOKEN');
	if (!accessToken) return json({ error: 'Server misconfigured' }, 500);
	try {
		const body = await request.json();
		if (body.action === 'search' && typeof body.query === 'string' && body.query.trim()) {
			const response = await geniusRequest(`/search?q=${encodeURIComponent(body.query.trim())}`, accessToken);
			const songs = response.response.hits
				.map(({ result }: { result: Record<string, unknown> }) => ({ geniusId: result.id, title: result.title, artist: (result.primary_artist as { name: string }).name, artworkUrl: result.header_image_url ?? null, geniusUrl: result.url, instrumental: result.instrumental === true, lyricsState: result.lyrics_state }))
				.filter((song: { instrumental: boolean; lyricsState: unknown }) => !song.instrumental && song.lyricsState === 'complete')
				.map(({ instrumental, lyricsState, ...song }: { instrumental: boolean; lyricsState: unknown; geniusId: number; title: string; artist: string; artworkUrl: string | null; geniusUrl: string }) => song);
			return json({ songs });
		}
		if (body.action === 'lyrics' && Number.isInteger(body.geniusId)) {
			const response = await geniusRequest(`/songs/${body.geniusId}?text_format=plain`, accessToken);
			return json({ lyrics: response.response.lyrics?.lyrics?.body?.plain ?? response.lyrics?.lyrics?.body?.plain ?? null });
		}
		return json({ error: 'Invalid request' }, 400);
	} catch { return json({ error: 'Genius request failed' }, 502); }
});

async function geniusRequest(path: string, accessToken: string) {
	const response = await fetch(`${geniusApi}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!response.ok) throw new Error('Genius request failed');
	return response.json();
}
