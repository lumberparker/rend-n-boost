import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { router } from '../router.js';
import { DAY_OPTIONS, formatEnabledDays, getProjectRuleConfig } from '../rules.js';
import { showLoading, showError, formatDate, getStatusBadgeClass, getStatusLabel, showToast } from '../utils.js';

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
            <button class="button button--outline" id="backToDashboardBtn">
              Volver al panel
            </button>
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
      renderListView(container, project);
      break;
    case 'settings':
      renderSettingsView(container, project, creative, onProjectUpdated);
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
