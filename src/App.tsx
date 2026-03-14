import { useEffect, useState } from 'react';
import './css/styles.css';
import { supabase } from './js/api';
import { renderLogin } from './js/pages/login';
import { renderDashboard } from './js/pages/dashboard';
import { renderClientView } from './js/pages/client-view';

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initApp();
  }, []);

  async function initApp() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (token) {
        await renderClientView(token);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        renderLogin();
        setLoading(false);
        return;
      }

      const { data: creative } = await supabase
        .from('creatives')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!creative) {
        await supabase
          .from('creatives')
          .insert({
            id: session.user.id,
            name: session.user.email?.split('@')[0] || 'Creative',
            email: session.user.email || ''
          });
      }

      await renderDashboard(session.user, creative || {
        id: session.user.id,
        name: session.user.email?.split('@')[0] || 'Creative',
        email: session.user.email || '',
        sla_days: 4,
        max_credits_per_day: 6,
        urgency_multiplier: 1.5
      });

      setLoading(false);

      supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          window.location.reload();
        } else if (event === 'SIGNED_OUT') {
          renderLogin();
        }
      });
    } catch (error) {
      console.error('Error initializing app:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return <div id="app"></div>;
}

export default App;
