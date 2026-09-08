import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
const tokenKey = 'kotoba.access_token';
export const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseClient() {
	if (client) return client;
	if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase public configuration is missing.');
	return (client = createClient(supabaseUrl, supabaseAnonKey, {
		accessToken: async () => localStorage.getItem(tokenKey),
	}));
}

export function saveAccessToken(token: string) {
	localStorage.setItem(tokenKey, token);
}

export function clearAccessToken() {
	localStorage.removeItem(tokenKey);
}

export function hasAccessToken() {
	return Boolean(localStorage.getItem(tokenKey));
}
