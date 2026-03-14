import { useEffect, useState } from 'react';
import './css/styles.css';
import { supabase, supabaseConfigError } from './js/api';
import { renderLogin } from './js/pages/login';
import { renderDashboard } from './js/pages/dashboard';
import { renderClientView } from './js/pages/client-view';
import { renderClients } from './js/pages/clients';
import { renderNewProject } from './js/pages/new-project';
import { renderProject } from './js/pages/project';
import { renderSettings } from './js/pages/settings';
import { isSuperAdminEmail } from './js/super-admin';
import { router } from './js/router';

function App() {
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    initApp();
  }, []);

  async function initApp() {
    try {
      if (supabaseConfigError || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase is not configured.');
      }

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

      const isSuperAdmin = isSuperAdminEmail(session.user.email);

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

      const creativeProfile = {
        ...(creative || {
          id: session.user.id,
          name: session.user.email?.split('@')[0] || 'Creative',
          email: session.user.email || '',
          sla_days: 4,
          max_credits_per_day: 6,
          urgency_multiplier: 1.5
        }),
        is_super_admin: isSuperAdmin
      };

      registerRoutes(session.user, creativeProfile);
      await router.handleRoute();

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
      setStartupError(error instanceof Error ? error.message : 'Unable to initialize the app.');
      setLoading(false);
    }
  }

  return (
    <>
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      )}
      {!loading && startupError && (
        <div className="auth-page">
          <div className="auth-card">
            <h1 className="auth-card__title">Startup Error</h1>
            <p>{startupError}</p>
          </div>
        </div>
      )}
      <div id="app" className={loading || Boolean(startupError) ? 'hidden' : ''}></div>
    </>
  );
}

function registerRoutes(user, creative) {
  const onCreativeUpdated = (updatedCreative) => {
    Object.assign(creative, updatedCreative);
  };

  router.routes = {};
  router.addRoute('/', async () => {
    await renderDashboard(user, creative);
  });
  router.addRoute('/clients', async () => {
    await renderClients(user, creative);
  });
  router.addRoute('/projects', async () => {
    await renderDashboard(user, creative);
  });
  router.addRoute('/settings', async () => {
    await renderSettings(user, creative, onCreativeUpdated);
  });
  router.addRoute('/projects/new', async () => {
    await renderNewProject(user, creative);
  });
  router.addRoute('/projects/:id', async (params) => {
    await renderProject(params, user, creative);
  });
  router.addRoute('/404', async () => {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Página no encontrada</div>
          <div class="empty-state__description">La ruta solicitada no existe.</div>
        </div>
      `;
    }
  });
}

export default App;
