import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { router } from '../router.js';
import { DAY_OPTIONS, formatEnabledDays, getProjectRuleConfig } from '../rules.js';
import { buildWhatsAppUrl, showLoading, showError, formatDate, getStatusBadgeClass, getStatusLabel, showToast } from '../utils.js';

export async function renderProject(params, user, creative) {
  const app = document.getElementById('app');
  showLoading(app);

  try {
    const [project, publicLink] = await Promise.all([
      api.getProject(params.id),
      api.getProjectPublicLink(params.id)
    ]);

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
            <div class="wizard__actions">
              ${project.client.whatsapp_number ? `<a class="button button--outline" href="${buildWhatsAppUrl(project.client.whatsapp_number, `Hola ${project.client.name}, te escribo sobre el proyecto ${project.name}.`)}" target="_blank" rel="noreferrer">WhatsApp cliente</a>` : ''}
              ${publicLink ? '<button class="button button--outline" id="copyClientPortalBtn">Copiar portal cliente</button>' : ''}
              <button class="button button--outline" id="backToDashboardBtn">
                Volver al panel
              </button>
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
              <button class="tabs__button" data-view="settings">
                Configuración
              </button>
            </div>
          </div>

          <div id="viewContainer"></div>
        </div>
      </div>
    `;

    app.appendChild(main);

    let currentView = 'kanban';
    let currentProject = project;
    const handleProjectUpdated = (updatedProject) => {
      currentProject = updatedProject;
      renderView(currentView, currentProject, creative, handleProjectUpdated);
    };

    renderView(currentView, currentProject, creative, handleProjectUpdated);

    const tabs = app.querySelectorAll('.tabs__button');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('tabs__button--active'));
        tab.classList.add('tabs__button--active');
        currentView = tab.getAttribute('data-view');
        renderView(currentView, currentProject, creative, handleProjectUpdated);
      });
    });

    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    backToDashboardBtn?.addEventListener('click', () => {
      router.navigate('/');
    });

    const copyClientPortalBtn = document.getElementById('copyClientPortalBtn');
    copyClientPortalBtn?.addEventListener('click', async () => {
      const { copyToClipboard, showToast } = await import('../utils.js');
      await copyToClipboard(`${window.location.origin}/?token=${publicLink.token}`);
      showToast('Portal del cliente copiado');
    });

  } catch (error) {
    showError(app, 'Error al cargar proyecto: ' + error.message);
  }
}

function renderView(view, project, creative, onProjectUpdated) {
  const container = document.getElementById('viewContainer');

  switch (view) {
    case 'kanban':
      renderKanbanView(container, project);
      break;
    case 'list':
      renderListView(container, project, onProjectUpdated);
      break;
    case 'settings':
      renderSettingsView(container, project, creative, onProjectUpdated);
      break;
  }
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
                ${task.urgency_reason ? `<p class="form-helper" style="margin-top: 0.5rem;">Motivo urgencia: ${task.urgency_reason}</p>` : ''}
                ${task.creative_notes ? `<p class="form-helper" style="margin-top: 0.75rem;">Nota creativa: ${task.creative_notes}</p>` : ''}
                ${task.client_feedback ? `<p class="form-helper" style="margin-top: 0.5rem;">Feedback cliente: ${task.client_feedback}</p>` : ''}
                ${task.deliverable_url ? `<p class="form-helper" style="margin-top: 0.5rem;"><a href="${task.deliverable_url}" target="_blank" rel="noreferrer">Abrir entrega</a></p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderListView(container, project, onProjectUpdated) {
  container.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Título</th>
            <th>Estado</th>
            <th>Créditos</th>
            <th>Fecha Solicitada</th>
            <th>Entrega</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${project.tasks.length === 0 ? `
            <tr>
              <td colspan="6" style="text-align: center; padding: 2rem;">
                No hay tareas en este proyecto
              </td>
            </tr>
          ` : project.tasks.map(task => `
            <tr>
              <td>
                <strong>${task.title}</strong>
                ${task.is_urgent ? '<span class="badge badge--error" style="margin-left: 0.5rem;">Urgente</span>' : ''}
                ${task.urgency_reason ? `<div class="form-helper">Motivo urgencia: ${task.urgency_reason}</div>` : ''}
                ${task.creative_notes ? `<div class="form-helper">Nota creativa: ${task.creative_notes}</div>` : ''}
                ${task.client_feedback ? `<div class="form-helper">Feedback cliente: ${task.client_feedback}</div>` : ''}
              </td>
              <td>
                <span class="badge ${getStatusBadgeClass(task.status)}">
                  ${getStatusLabel(task.status)}
                </span>
              </td>
              <td>${renderCreditsSummary(task)}</td>
              <td>${formatDate(task.requested_date)}</td>
              <td>${task.deliverable_url ? `<a href="${task.deliverable_url}" target="_blank" rel="noreferrer">Ver link</a>` : '-'}</td>
              <td>${renderCreativeTaskActions(task)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  attachCreativeTaskActions(container, project.id, onProjectUpdated);
}

function renderSettingsView(container, project, creative, onProjectUpdated) {
  const rules = getProjectRuleConfig(project, creative);

  container.innerHTML = `
    <div class="dashboard__grid project-settings-grid">
      <div class="card">
        <div class="card__header">
          <div>
            <h3 class="card__title">Overrides del Proyecto</h3>
            <p class="card__subtitle">Si activas overrides, este proyecto deja de usar los defaults de tu cuenta.</p>
          </div>
        </div>
        <div class="card__body">
          <form id="projectRulesForm">
            <div class="form-group">
              <label class="checkbox-card">
                <input type="checkbox" id="useProjectOverrides" ${rules.hasOverrides ? 'checked' : ''} />
                <span>Usar reglas específicas para este proyecto</span>
              </label>
              <span class="form-helper">Si lo desactivas, el proyecto hereda automáticamente tus defaults de cuenta.</span>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="slaDays">SLA mínimo (días)</label>
                <input id="slaDays" name="sla_days" type="number" min="1" class="form-input" value="${rules.overrides.sla_days}" placeholder="${rules.defaults.sla_days}" ${rules.hasOverrides ? 'required' : 'disabled'} />
              </div>
              <div class="form-group">
                <label class="form-label" for="maxCreditsPerDay">Capacidad diaria</label>
                <input id="maxCreditsPerDay" name="max_credits_per_day" type="number" min="1" class="form-input" value="${rules.overrides.max_credits_per_day}" placeholder="${rules.defaults.max_credits_per_day}" ${rules.hasOverrides ? 'required' : 'disabled'} />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="urgencyMultiplier">Multiplicador de urgencia</label>
              <input id="urgencyMultiplier" name="urgency_multiplier" type="number" min="1" step="0.1" class="form-input" value="${rules.overrides.urgency_multiplier}" placeholder="${rules.defaults.urgency_multiplier}" ${rules.hasOverrides ? 'required' : 'disabled'} />
              <span class="form-helper">Ejemplo: 1.5 aumenta el costo operativo de una tarea urgente en 50%.</span>
            </div>

            <div class="form-group">
              <label class="form-label">Días laborales del proyecto</label>
              <div class="checkbox-grid">
                ${DAY_OPTIONS.map((day) => `
                  <label class="checkbox-card">
                    <input type="checkbox" name="work_days" value="${day.key}" ${rules.overrides.work_days[day.key] ? 'checked' : ''} ${rules.hasOverrides ? '' : 'disabled'} />
                    <span>${day.label}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div class="card__footer">
              <button type="submit" class="button button--primary">Guardar reglas</button>
            </div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <div>
            <h3 class="card__title">Resumen activo</h3>
            <p class="card__subtitle">Configuración actualmente aplicada a este proyecto.</p>
          </div>
        </div>
        <div class="card__body">
          <div class="project-rule-list">
            <div class="project-rule-item">
              <span class="project-rule-label">SLA mínimo</span>
              <strong>${rules.effective.sla_days} días</strong>
            </div>
            <div class="project-rule-item">
              <span class="project-rule-label">Capacidad diaria</span>
              <strong>${rules.effective.max_credits_per_day} créditos</strong>
            </div>
            <div class="project-rule-item">
              <span class="project-rule-label">Urgencia</span>
              <strong>x${rules.effective.urgency_multiplier}</strong>
            </div>
            <div class="project-rule-item">
              <span class="project-rule-label">Días laborales</span>
              <strong>${formatEnabledDays(rules.effective.work_days)}</strong>
            </div>
            <div class="project-rule-item">
              <span class="project-rule-label">Origen</span>
              <strong>${rules.hasOverrides ? 'Override de proyecto' : 'Defaults de la cuenta'}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('projectRulesForm');
  const useProjectOverrides = document.getElementById('useProjectOverrides');
  const overrideFields = form?.querySelectorAll('input[name="sla_days"], input[name="max_credits_per_day"], input[name="urgency_multiplier"], input[name="work_days"]');

  useProjectOverrides?.addEventListener('change', () => {
    const enabled = useProjectOverrides.checked;
    overrideFields?.forEach((field) => {
      field.disabled = !enabled;
      if (field.type !== 'checkbox') {
        field.required = enabled;
      }
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const usingOverrides = useProjectOverrides?.checked;

    try {
      const updates = usingOverrides
        ? {
            sla_days: Number(formData.get('sla_days')),
            max_credits_per_day: Number(formData.get('max_credits_per_day')),
            urgency_multiplier: Number(formData.get('urgency_multiplier')),
            work_days: DAY_OPTIONS.reduce((accumulator, day) => {
              accumulator[day.key] = formData.getAll('work_days').includes(day.key);
              return accumulator;
            }, {})
          }
        : {
            sla_days: null,
            max_credits_per_day: null,
            urgency_multiplier: null,
            work_days: null
          };

      const updatedProject = await api.updateProject(project.id, updates);

      showToast(usingOverrides ? 'Overrides del proyecto actualizados' : 'El proyecto volvió a usar los defaults de la cuenta');
      onProjectUpdated(updatedProject);
    } catch (error) {
      showToast('No se pudieron guardar las reglas del proyecto', 'error');
    }
  });
}

function renderCreditsSummary(task) {
  if (task.status === 'counter_proposed' && task.credits_counter) {
    return `${task.credits_estimated} -> ${task.credits_counter}`;
  }

  return task.credits_approved || task.credits_counter || task.credits_estimated;
}

function renderCreativeTaskActions(task) {
  if (task.status === 'pending') {
    return `
      <div class="table-actions">
        <button class="button button--success button--sm creative-approve-task" data-id="${task.id}">Aprobar</button>
        <button class="button button--outline button--sm creative-counter-task" data-id="${task.id}">Contrapropuesta</button>
        <button class="button button--danger button--sm creative-reject-task" data-id="${task.id}">Rechazar</button>
      </div>
    `;
  }

  if (['approved', 'revision_requested'].includes(task.status)) {
    return `
      <div class="table-actions">
        <button class="button button--outline button--sm creative-start-task" data-id="${task.id}">Iniciar</button>
        <button class="button button--primary button--sm creative-deliver-task" data-id="${task.id}">Entregar</button>
      </div>
    `;
  }

  if (task.status === 'in_progress') {
    return `
      <div class="table-actions">
        <button class="button button--primary button--sm creative-deliver-task" data-id="${task.id}">Entregar</button>
      </div>
    `;
  }

  if (task.status === 'counter_proposed') {
    return '<span class="form-helper">Esperando aprobación del cliente</span>';
  }

  if (task.status === 'delivered') {
    return '<span class="form-helper">Esperando revisión del cliente</span>';
  }

  return '<span class="form-helper">Sin acciones</span>';
}

function attachCreativeTaskActions(container, projectId, onProjectUpdated) {
  container.querySelectorAll('.creative-approve-task').forEach((button) => {
    button.addEventListener('click', async () => {
      await approveProjectTask(button.getAttribute('data-id'), projectId, onProjectUpdated);
    });
  });

  container.querySelectorAll('.creative-counter-task').forEach((button) => {
    button.addEventListener('click', async () => {
      await counterProjectTask(button.getAttribute('data-id'), projectId, onProjectUpdated);
    });
  });

  container.querySelectorAll('.creative-reject-task').forEach((button) => {
    button.addEventListener('click', async () => {
      await rejectProjectTask(button.getAttribute('data-id'), projectId, onProjectUpdated);
    });
  });

  container.querySelectorAll('.creative-start-task').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateProjectTaskStatus(button.getAttribute('data-id'), projectId, { status: 'in_progress' }, onProjectUpdated, 'Tarea iniciada');
    });
  });

  container.querySelectorAll('.creative-deliver-task').forEach((button) => {
    button.addEventListener('click', async () => {
      const taskId = button.getAttribute('data-id');
      const deliverableUrl = window.prompt('Pega el link de Dropbox o Google Drive:');
      if (!deliverableUrl) {
        return;
      }

      const creativeNotes = window.prompt('Notas para el cliente sobre la entrega (opcional):') || '';
      await updateProjectTaskStatus(taskId, projectId, {
        status: 'delivered',
        deliverable_url: deliverableUrl,
        creative_notes: creativeNotes,
        delivered_at: new Date().toISOString()
      }, onProjectUpdated, 'Entrega enviada');
    });
  });
}

async function approveProjectTask(taskId, projectId, onProjectUpdated) {
  const project = await api.getProject(projectId);
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) {
    showToast('No se encontró la tarea', 'error');
    return;
  }

  try {
    await api.updateTask(taskId, {
      status: 'approved',
      credits_approved: task.credits_estimated,
      credits_counter: null,
      creative_notes: null
    });
    showToast('Tarea aprobada');
    onProjectUpdated(await api.getProject(projectId));
  } catch (error) {
    showToast('No se pudo aprobar la tarea', 'error');
  }
}

async function counterProjectTask(taskId, projectId, onProjectUpdated) {
  const project = await api.getProject(projectId);
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) {
    showToast('No se encontró la tarea', 'error');
    return;
  }

  const counterCredits = window.prompt('Créditos propuestos por el creativo:', String(task.credits_estimated));
  if (!counterCredits) {
    return;
  }

  const creativeNotes = window.prompt('Explica la contrapropuesta (opcional):', task.creative_notes || '') || '';
  const markUrgent = window.confirm('¿Quieres marcar esta contrapropuesta como urgente?');
  const urgencyReason = markUrgent
    ? window.prompt(
        'Explica al cliente por qué esta solicitud se considera urgente:',
        task.urgency_reason || 'La solicitud requiere atención urgente según alcance y tiempos.'
      ) || 'La solicitud requiere atención urgente según alcance y tiempos.'
    : null;

  try {
    await api.updateTask(taskId, {
      status: 'counter_proposed',
      credits_counter: Number(counterCredits),
      creative_notes: creativeNotes,
      is_urgent: Boolean(markUrgent),
      urgency_reason: urgencyReason
    });
    showToast('Contrapropuesta enviada');
    onProjectUpdated(await api.getProject(projectId));
  } catch (error) {
    showToast('No se pudo enviar la contrapropuesta', 'error');
  }
}

async function rejectProjectTask(taskId, projectId, onProjectUpdated) {
  await updateProjectTaskStatus(taskId, projectId, { status: 'rejected' }, onProjectUpdated, 'Tarea rechazada');
}

async function updateProjectTaskStatus(taskId, projectId, updates, onProjectUpdated, successMessage) {
  try {
    await api.updateTask(taskId, updates);
    showToast(successMessage);
    onProjectUpdated(await api.getProject(projectId));
  } catch (error) {
    showToast('No se pudo actualizar la tarea', 'error');
  }
}
