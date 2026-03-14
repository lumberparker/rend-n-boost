import { api } from '../api.js';
import { getProjectRuleConfig, getUrgencyEvaluation } from '../rules.js';
import { buildWhatsAppUrl, showLoading, showError, formatDate, getStatusBadgeClass, getStatusLabel, showToast } from '../utils.js';

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
              ${project.client.whatsapp_number ? `<a class="button button--outline" href="${buildWhatsAppUrl(project.client.whatsapp_number)}" target="_blank" rel="noreferrer">Abrir WhatsApp</a>` : ''}
            </div>

            ${project.client.plan_type === 'monthly' ? renderTaskRequestCard(project.id) : ''}

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
    let currentProject = project;
    const rerenderProject = async () => {
      currentProject = await api.getProjectByToken(token);
      renderView(currentView, currentProject, token, rerenderProject);
    };
    renderView(currentView, currentProject, token, rerenderProject);

    const tabs = app.querySelectorAll('.tabs__button');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('tabs__button--active'));
        tab.classList.add('tabs__button--active');
        currentView = tab.getAttribute('data-view');
        renderView(currentView, currentProject, token, rerenderProject);
      });
    });

    const requestForm = document.getElementById('clientTaskRequestForm');
    requestForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(requestForm);

      try {
        const rules = getProjectRuleConfig(project, project.client?.creative).effective;
        const requestedDate = formData.get('requested_date') || null;
        const urgencyEvaluation = getUrgencyEvaluation(requestedDate, rules);
        const manuallyUrgent = formData.get('is_urgent') === 'on';

        await api.createTask({
          project_id: project.id,
          title: formData.get('title'),
          description: formData.get('description'),
          credits_estimated: Number(formData.get('credits_estimated')),
          is_urgent: manuallyUrgent || urgencyEvaluation.isUrgent,
          urgency_reason: manuallyUrgent
            ? 'El cliente marcó esta solicitud como urgente.'
            : urgencyEvaluation.reason || null,
          requested_date: requestedDate,
          status: 'pending',
          submitted_by_client: true
        });

        requestForm.reset();
        showToast(
          urgencyEvaluation.isUrgent
            ? `Solicitud enviada. ${urgencyEvaluation.reason}`
            : 'Solicitud enviada al creativo'
        );
        await rerenderProject();
      } catch (error) {
        showToast('No se pudo enviar la solicitud', 'error');
      }
    });

  } catch (error) {
    showError(app, 'Error al cargar el proyecto: ' + error.message);
  }
}

function renderView(view, project, token, rerenderProject) {
  const container = document.getElementById('viewContainer');

  switch (view) {
    case 'kanban':
      renderKanbanView(container, project);
      break;
    case 'list':
      renderListView(container, project, rerenderProject);
      break;
    case 'timeline':
      renderTimelineView(container, project);
      break;
  }
}

function renderTaskRequestCard(projectId) {
  return `
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="card__header">
        <div>
          <h3 class="card__title">Enviar nueva solicitud</h3>
          <p class="card__subtitle">Crea una tarea, sugiere créditos y deja contexto para el creativo.</p>
        </div>
      </div>
      <div class="card__body">
        <form id="clientTaskRequestForm">
          <input type="hidden" name="project_id" value="${projectId}" />
          <div class="form-group">
            <label class="form-label" for="clientTaskTitle">Título</label>
            <input id="clientTaskTitle" name="title" class="form-input" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="clientTaskDescription">Notas o brief</label>
            <textarea id="clientTaskDescription" name="description" class="form-textarea" placeholder="Objetivo, referencias, formato, observaciones"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="clientTaskCredits">Créditos sugeridos</label>
              <input id="clientTaskCredits" name="credits_estimated" type="number" min="1" class="form-input" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="clientTaskRequestedDate">Fecha deseada</label>
              <input id="clientTaskRequestedDate" name="requested_date" type="date" class="form-input" />
            </div>
          </div>
          <div class="form-group">
            <label class="checkbox-card">
              <input type="checkbox" name="is_urgent" />
              <span>Marcar como urgente</span>
            </label>
          </div>
          <div class="card__footer">
            <button type="submit" class="button button--primary">Enviar solicitud</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderKanbanView(container, project) {
  const columns = [
    { id: 'pending', title: 'Pendiente', tasks: [] },
    { id: 'counter_proposed', title: 'Contrapropuesta', tasks: [] },
    { id: 'approved', title: 'Aprobada', tasks: [] },
    { id: 'in_progress', title: 'En Progreso', tasks: [] },
    { id: 'delivered', title: 'Entregada', tasks: [] },
    { id: 'revision_requested', title: 'Cambios', tasks: [] },
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
                ${task.urgency_reason ? `<p class="form-helper" style="margin-top: 0.5rem;">Urgencia: ${task.urgency_reason}</p>` : ''}
                ${task.creative_notes ? `<p class="form-helper" style="margin-top: 0.5rem;">Nota creativa: ${task.creative_notes}</p>` : ''}
                ${task.client_feedback ? `<p class="form-helper" style="margin-top: 0.5rem;">Tus notas: ${task.client_feedback}</p>` : ''}
                ${task.deliverable_url ? `<p class="form-helper" style="margin-top: 0.5rem;"><a href="${task.deliverable_url}" target="_blank" rel="noreferrer">Ver entrega</a></p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderListView(container, project, rerenderProject) {
  container.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Título</th>
            <th>Estado</th>
            <th>Créditos</th>
            <th>Entrega</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${project.tasks.map(task => `
            <tr>
              <td>
                <strong>${task.title}</strong>
                ${task.is_urgent ? '<span class="badge badge--error" style="margin-left: 0.5rem;">Urgente</span>' : ''}
                ${task.description ? `<div class="form-helper">${task.description}</div>` : ''}
                ${task.urgency_reason ? `<div class="form-helper">Urgencia: ${task.urgency_reason}</div>` : ''}
                ${task.creative_notes ? `<div class="form-helper">Nota creativa: ${task.creative_notes}</div>` : ''}
                ${task.client_feedback ? `<div class="form-helper">Tus notas: ${task.client_feedback}</div>` : ''}
              </td>
              <td>
                <span class="badge ${getStatusBadgeClass(task.status)}">
                  ${getStatusLabel(task.status)}
                </span>
              </td>
              <td>${renderClientCredits(task)}</td>
              <td>${task.deliverable_url ? `<a href="${task.deliverable_url}" target="_blank" rel="noreferrer">Abrir entrega</a>` : '-'}</td>
              <td>${renderClientTaskActions(task)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  attachClientTaskActions(container, project.id, rerenderProject);
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

function renderClientCredits(task) {
  if (task.status === 'counter_proposed' && task.credits_counter) {
    return `${task.credits_estimated} -> ${task.credits_counter}`;
  }

  return task.credits_approved || task.credits_counter || task.credits_estimated;
}

function renderClientTaskActions(task) {
  if (task.status === 'counter_proposed') {
    return `<button class="button button--primary button--sm client-accept-counter" data-id="${task.id}">Aceptar contrapropuesta</button>`;
  }

  if (task.status === 'delivered') {
    return `
      <div class="table-actions">
        <button class="button button--success button--sm client-approve-delivery" data-id="${task.id}">Aprobar entrega</button>
        <button class="button button--outline button--sm client-request-changes" data-id="${task.id}">Dejar notas</button>
      </div>
    `;
  }

  if (task.status === 'revision_requested') {
    return '<span class="form-helper">Esperando nueva entrega del creativo</span>';
  }

  return '<span class="form-helper">Sin acciones</span>';
}

function attachClientTaskActions(container, projectId, rerenderProject) {
  container.querySelectorAll('.client-accept-counter').forEach((button) => {
    button.addEventListener('click', async () => {
      const taskId = button.getAttribute('data-id');
      try {
        const project = await api.getProjectByToken(new URLSearchParams(window.location.search).get('token'));
        const task = project.tasks.find((item) => item.id === taskId);
        await api.updateTask(taskId, {
          status: 'approved',
          credits_approved: task.credits_counter,
          credits_counter: task.credits_counter
        });
        await api.settlePublicTaskApproval(taskId);
        showToast('Contrapropuesta aceptada');
        await rerenderProject();
      } catch (error) {
        showToast('No se pudo aceptar la contrapropuesta', 'error');
      }
    });
  });

  container.querySelectorAll('.client-approve-delivery').forEach((button) => {
    button.addEventListener('click', async () => {
      const taskId = button.getAttribute('data-id');
      try {
        await api.updateTask(taskId, {
          status: 'completed',
          client_feedback: null,
          client_reviewed_at: new Date().toISOString()
        });
        showToast('Entrega aprobada');
        await rerenderProject();
      } catch (error) {
        showToast('No se pudo aprobar la entrega', 'error');
      }
    });
  });

  container.querySelectorAll('.client-request-changes').forEach((button) => {
    button.addEventListener('click', async () => {
      const taskId = button.getAttribute('data-id');
      const feedback = window.prompt('Escribe las notas o cambios solicitados:');
      if (!feedback) {
        return;
      }

      try {
        await api.updateTask(taskId, {
          status: 'revision_requested',
          client_feedback: feedback,
          client_reviewed_at: new Date().toISOString()
        });
        showToast('Notas enviadas al creativo');
        await rerenderProject();
      } catch (error) {
        showToast('No se pudieron enviar las notas', 'error');
      }
    });
  });
}
