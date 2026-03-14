import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, showError, formatDate } from '../utils.js';

export async function renderClients(user, creative) {
  const app = document.getElementById('app');
  showLoading(app);

  try {
    const clients = await api.getClients();

    app.innerHTML = '';
    app.appendChild(renderHeader(user, creative));

    const main = document.createElement('main');
    main.className = 'main';
    main.innerHTML = `
      <div class="container">
        <div class="page">
          <div class="dashboard__header">
            <h1 class="dashboard__title">Clientes</h1>
            <p class="dashboard__subtitle">Gestiona tus clientes y sus créditos</p>
          </div>

          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Tipo de Plan</th>
                  <th>Créditos Disponibles</th>
                  <th>Fecha de Registro</th>
                </tr>
              </thead>
              <tbody>
                ${clients.length === 0 ? `
                  <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem;">
                      No hay clientes registrados
                    </td>
                  </tr>
                ` : clients.map(client => `
                  <tr>
                    <td><strong>${client.name}</strong></td>
                    <td>${client.email}</td>
                    <td>
                      <span class="badge badge--${client.plan_type === 'monthly' ? 'success' : 'primary'}">
                        ${client.plan_type === 'monthly' ? 'Mensual' : 'Por Proyecto'}
                      </span>
                    </td>
                    <td><strong>${client.credits_available}</strong> créditos</td>
                    <td>${formatDate(client.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    app.appendChild(main);

  } catch (error) {
    showError(app, 'Error al cargar clientes: ' + error.message);
  }
}
