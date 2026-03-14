import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const api = {
  async getClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*, client:clients(*)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getProject(id) {
    const { data, error } = await supabase
      .from('projects')
      .select('*, client:clients(*), tasks(*)')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async getProjectByToken(token) {
    const { data: linkData, error: linkError } = await supabase
      .from('public_links')
      .select('project_id')
      .eq('token', token)
      .maybeSingle();
    
    if (linkError) throw linkError;
    if (!linkData) return null;

    const { data, error } = await supabase
      .from('projects')
      .select('*, client:clients(*), tasks(*)')
      .eq('id', linkData.project_id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async getTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async updateTask(id, updates) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async addCreditsTransaction(transaction) {
    const { data, error } = await supabase
      .from('credits_history')
      .insert(transaction)
      .select()
      .single();
    
    if (error) throw error;
    
    if (transaction.amount < 0) {
      await supabase
        .from('clients')
        .update({ 
          credits_available: supabase.rpc('increment', { 
            x: transaction.amount 
          }) 
        })
        .eq('id', transaction.client_id);
    }
    
    return data;
  }
};
