import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, showError, formatDate, getStatusBadgeClass, getStatusLabel } from '../utils.js';

export async function renderProject(params, user, creative) {
  const app = document.getElementById('app');
  showLoading(app);

  try {
    const project = await api.getProject(params.id);

    if (!project) {
      showError(app, 'Proyecto no encontrado');
      return;
    }

    app.innerHTML = '';
    app.appendChild(renderHeader(user, creative));

    const main = document.createElement('main');
    main.className = 'main';
    main.innerHTML = `
      <div class="container">
        <div class="page">
          <div class="dashboard__header">
            <div>
              <h1 class="dashboard__title">${project.name}</h1>
              <p class="dashboard__subtitle">
                Cliente: ${project.client.name} • 
                ${project.client.credits_available} créditos disponibles
              </p>
            </div>
          </div>

          <div class="tabs">
            <div class="tabs__list">
              <button class="tabs__button tabs__button--active" data-view="kanban">
                Tablero Kanban
              </button>
              <button class="tabs__button" data-view="list">
                Lista de Tareas
              </button>
            </div>
          </div>

          <div id="viewContainer"></div>
        </div>
      </div>
    `;

    app.appendChild(main);

    let currentView = 'kanban';
    renderView(currentView, project);

    const tabs = app.querySelectorAll('.tabs__button');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('tabs__button--active'));
        tab.classList.add('tabs__button--active');
        currentView = tab.getAttribute('data-view');
        renderView(currentView, project);
      });
    });

  } catch (error) {
    showError(app, 'Error al cargar proyecto: ' + error.message);
  }
}

function renderView(view, project) {
  const container = document.getElementById('viewContainer');

  switch (view) {
    case 'kanban':
      renderKanbanView(container, project);
      break;
    case 'list':
      renderListView(container, project);
      break;
  }
}

function renderKanbanView(container, project) {
  const columns = [
    { id: 'pending', title: 'Pendiente', tasks: [] },
    { id: 'approved', title: 'Aprobada', tasks: [] },
    { id: 'in_progress', title: 'En Progreso', tasks: [] },
    { id: 'completed', title: 'Completada', tasks: [] }
  ];

  project.tasks.forEach(task => {
    const column = columns.find(c => c.id === task.status);
    if (column) {
      column.tasks.push(task);
    }
  });

  container.innerHTML = `
    <div class="kanban">
      ${columns.map(column => `
        <div class="kanban__column">
          <div class="kanban__column-header">
            <div class="kanban__column-title">
              ${column.title}
              <span class="kanban__column-count">${column.tasks.length}</span>
            </div>
          </div>
          <div class="kanban__cards">
            ${column.tasks.map(task => `
              <div class="kanban-card ${task.is_urgent ? 'kanban-card--urgent' : ''}">
                <div class="kanban-card__header">
                  <h4 class="kanban-card__title">${task.title}</h4>
                  <div class="kanban-card__credits">
                    ${task.credits_approved || task.credits_estimated}h
                  </div>
                </div>
                ${task.description ? `<p class="kanban-card__description">${task.description}</p>` : ''}
                <div class="kanban-card__footer">
                  <span class="kanban-card__date">${formatDate(task.committed_date || task.requested_date)}</span>
                  ${task.is_urgent ? '<span class="badge badge--error">Urgente</span>' : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderListView(container, project) {
  container.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Título</th>
            <th>Estado</th>
            <th>Créditos</th>
            <th>Fecha Solicitada</th>
            <th>Fecha Comprometida</th>
          </tr>
        </thead>
        <tbody>
          ${project.tasks.length === 0 ? `
            <tr>
              <td colspan="5" style="text-align: center; padding: 2rem;">
                No hay tareas en este proyecto
              </td>
            </tr>
          ` : project.tasks.map(task => `
            <tr>
              <td>
                <strong>${task.title}</strong>
                ${task.is_urgent ? '<span class="badge badge--error" style="margin-left: 0.5rem;">Urgente</span>' : ''}
              </td>
              <td>
                <span class="badge ${getStatusBadgeClass(task.status)}">
                  ${getStatusLabel(task.status)}
                </span>
              </td>
              <td>${task.credits_approved || task.credits_estimated}</td>
              <td>${formatDate(task.requested_date)}</td>
              <td>${formatDate(task.committed_date)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
