import { api } from '../api.js';
import { showLoading, showError, formatDate, getStatusBadgeClass, getStatusLabel } from '../utils.js';

export async function renderClientView(token) {
  const app = document.getElementById('app');
  showLoading(app);

  try {
    const project = await api.getProjectByToken(token);

    if (!project) {
      showError(app, 'Proyecto no encontrado o enlace inválido');
      return;
    }

    app.innerHTML = `
      <header class="header">
        <div class="header__container">
          <div class="header__brand">CreativeFlow</div>
        </div>
      </header>
      <main class="main">
        <div class="container">
          <div class="page">
            <div class="dashboard__header">
              <div>
                <h1 class="dashboard__title">${project.name}</h1>
                <p class="dashboard__subtitle">${project.client.name} • ${project.client.credits_available} créditos disponibles</p>
              </div>
            </div>

            <div class="tabs">
              <div class="tabs__list">
                <button class="tabs__button tabs__button--active" data-view="kanban">Tablero</button>
                <button class="tabs__button" data-view="list">Lista</button>
                <button class="tabs__button" data-view="timeline">Cronograma</button>
              </div>
            </div>

            <div id="viewContainer"></div>
          </div>
        </div>
      </main>
    `;

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
    showError(app, 'Error al cargar el proyecto: ' + error.message);
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
    case 'timeline':
      renderTimelineView(container, project);
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
          ${project.tasks.map(task => `
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

function renderTimelineView(container, project) {
  const sortedTasks = [...project.tasks]
    .filter(t => t.committed_date || t.requested_date)
    .sort((a, b) => {
      const dateA = new Date(a.committed_date || a.requested_date);
      const dateB = new Date(b.committed_date || b.requested_date);
      return dateA - dateB;
    });

  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">Cronograma de Entregas</h3>
      </div>
      <div class="card__body">
        ${sortedTasks.length === 0 ? `
          <div class="empty-state">
            <p class="empty-state__description">No hay tareas con fechas asignadas</p>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${sortedTasks.map(task => {
              const date = new Date(task.committed_date || task.requested_date);
              const isUpcoming = date >= new Date();
              return `
                <div style="display: flex; gap: 1rem; align-items: center; padding: 1rem; border-left: 3px solid ${isUpcoming ? 'var(--color-primary-500)' : 'var(--color-neutral-300)'}; background-color: var(--color-bg-secondary); border-radius: var(--radius-md);">
                  <div style="min-width: 100px;">
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary);">
                      ${formatDate(task.committed_date || task.requested_date)}
                    </div>
                  </div>
                  <div style="flex: 1;">
                    <div style="font-weight: 500;">${task.title}</div>
                    <div style="font-size: 0.875rem; color: var(--color-text-secondary); margin-top: 0.25rem;">
                      ${task.credits_approved || task.credits_estimated} créditos
                      ${task.is_urgent ? ' • <span class="badge badge--error">Urgente</span>' : ''}
                    </div>
                  </div>
                  <span class="badge ${getStatusBadgeClass(task.status)}">
                    ${getStatusLabel(task.status)}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}
