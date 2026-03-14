import { supabase, supabaseConfigError } from './api.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigError || 'Supabase is not configured.');
  }

  return supabase;
}

export const auth = {
  async signIn(email, password) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  },

  async signInWithGoogle() {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    window.location.href = '/';
  },

  async getSession() {
    const client = requireSupabase();
    const { data: { session } } = await client.auth.getSession();
    return session;
  },

  async getCurrentUser() {
    const client = requireSupabase();
    const { data: { user } } = await client.auth.getUser();
    return user;
  }
};
