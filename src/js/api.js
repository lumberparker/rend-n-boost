import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseConfigError =
  !supabaseUrl
    ? 'Missing VITE_SUPABASE_URL. Set it in your deployment environment variables.'
    : !supabaseAnonKey
      ? 'Missing VITE_SUPABASE_ANON_KEY. Set it in your deployment environment variables.'
      : null;

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey);

function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigError);
  }

  return supabase;
}

export const api = {
  async getClients() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getProjects() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('projects')
      .select('*, client:clients(*)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getProject(id) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('projects')
      .select('*, client:clients(*), tasks(*)')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async getProjectByToken(token) {
    const client = requireSupabase();
    const { data: linkData, error: linkError } = await client
      .from('public_links')
      .select('project_id')
      .eq('token', token)
      .maybeSingle();
    
    if (linkError) throw linkError;
    if (!linkData) return null;

    const { data, error } = await client
      .from('projects')
      .select('*, client:clients(*), tasks(*)')
      .eq('id', linkData.project_id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async getTasks() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async updateTask(id, updates) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateProject(id, updates) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select('*, client:clients(*), tasks(*)')
      .single();

    if (error) throw error;
    return data;
  },

  async addCreditsTransaction(transaction) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('credits_history')
      .insert(transaction)
      .select()
      .single();
    
    if (error) throw error;
    
    if (transaction.amount < 0) {
      await client
        .from('clients')
        .update({ 
          credits_available: client.rpc('increment', { 
            x: transaction.amount 
          }) 
        })
        .eq('id', transaction.client_id);
    }
    
    return data;
  }
};
