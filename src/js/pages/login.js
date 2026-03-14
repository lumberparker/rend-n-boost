import { auth } from '../auth.js';

export function renderLogin() {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h1 class="auth-card__title">CreativeFlow</h1>
        <p style="text-align: center; color: var(--color-text-secondary); margin-bottom: 2rem;">
          Gestión de proyectos creativos basada en créditos
        </p>
        
        <form id="loginForm">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input 
              type="email" 
              name="email" 
              class="form-input" 
              required 
              placeholder="tu@email.com"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input 
              type="password" 
              name="password" 
              class="form-input" 
              required 
              placeholder="••••••••"
            />
          </div>
          
          <button type="submit" class="button button--primary button--full">
            Iniciar Sesión
          </button>
          
          <div id="loginError" class="form-error" style="display: none; margin-top: 1rem;"></div>
        </form>
      </div>
    </div>
  `;
  
  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('loginError');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';
    
    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');
    
    try {
      await auth.signIn(email, password);
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  });
}
