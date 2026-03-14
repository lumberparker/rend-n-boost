export function renderHeader(user, creative) {
  const header = document.createElement('header');
  header.className = 'header';
  const userName = (creative && creative.name) || (user && user.email) || 'Usuario';
  const superAdminBadge = creative?.is_super_admin
    ? '<span class="badge badge--warning">Super Admin</span>'
    : '';
  header.innerHTML = `
    <div class="header__container">
      <div class="header__brand">CreativeFlow</div>
      <nav class="header__nav">
        <a href="/" class="header__link">Panel</a>
        <a href="/projects" class="header__link">Proyectos</a>
        <a href="/clients" class="header__link">Clientes</a>
      </nav>
      <div class="header__user">
        ${superAdminBadge}
        <span class="header__user-name">${userName}</span>
        <button class="button button--sm button--outline" id="logoutBtn">Salir</button>
      </div>
    </div>
  `;
  
  const logoutBtn = header.querySelector('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { auth } = await import('../auth.js');
      await auth.signOut();
    });
  }
  
  return header;
}
