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
		if (typeof credential !== 'string' || credential !== Deno.env.get('ACCESS_CREDENTIAL')) {
			return json({ error: 'Unauthorized' }, 401);
		}

		const url = Deno.env.get('SUPABASE_URL');
		const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
		const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
		const email = Deno.env.get('AUTH_EMAIL');
		const password = Deno.env.get('AUTH_PASSWORD');
		if (!url || !anonKey || !serviceKey || !email || !password) return json({ error: 'Server misconfigured' }, 500);

		const createResponse = await fetch(`${url}/auth/v1/admin/users`, {
			method: 'POST', headers: { ...authHeaders(serviceKey), 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password, email_confirm: true }),
		});
		if (!createResponse.ok && createResponse.status !== 422) return json({ error: 'Unauthorized' }, 401);

		const loginResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
			method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
		});
		if (!loginResponse.ok) return json({ error: 'Unauthorized' }, 401);
		return json({ session: await loginResponse.json() });
	} catch {
		return json({ error: 'Unauthorized' }, 401);
	}
});

function authHeaders(key: string) {
	return { apikey: key, Authorization: `Bearer ${key}` };
}
