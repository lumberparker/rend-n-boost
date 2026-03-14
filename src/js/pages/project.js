import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { router } from '../router.js';
import { showLoading, showError, formatDate, getStatusBadgeClass, getStatusLabel, showToast } from '../utils.js';

const DAY_OPTIONS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

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
  const rules = getProjectRules(project, creative);

  container.innerHTML = `
    <div class="dashboard__grid project-settings-grid">
      <div class="card">
        <div class="card__header">
          <div>
            <h3 class="card__title">Reglas del Proyecto</h3>
            <p class="card__subtitle">Estas reglas afectan la planificación y el cálculo operativo del proyecto.</p>
          </div>
        </div>
        <div class="card__body">
          <form id="projectRulesForm">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="slaDays">SLA mínimo (días)</label>
                <input id="slaDays" name="sla_days" type="number" min="1" class="form-input" value="${rules.sla_days}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="maxCreditsPerDay">Capacidad diaria</label>
                <input id="maxCreditsPerDay" name="max_credits_per_day" type="number" min="1" class="form-input" value="${rules.max_credits_per_day}" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="urgencyMultiplier">Multiplicador de urgencia</label>
              <input id="urgencyMultiplier" name="urgency_multiplier" type="number" min="1" step="0.1" class="form-input" value="${rules.urgency_multiplier}" required />
              <span class="form-helper">Ejemplo: 1.5 aumenta el costo operativo de una tarea urgente en 50%.</span>
            </div>

            <div class="form-group">
              <label class="form-label">Días laborales del proyecto</label>
              <div class="checkbox-grid">
                ${DAY_OPTIONS.map((day) => `
                  <label class="checkbox-card">
                    <input type="checkbox" name="work_days" value="${day.key}" ${rules.work_days[day.key] ? 'checked' : ''} />
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
              <strong>${rules.sla_days} días</strong>
            </div>
            <div class="project-rule-item">
              <span class="project-rule-label">Capacidad diaria</span>
              <strong>${rules.max_credits_per_day} créditos</strong>
            </div>
            <div class="project-rule-item">
              <span class="project-rule-label">Urgencia</span>
              <strong>x${rules.urgency_multiplier}</strong>
            </div>
            <div class="project-rule-item">
              <span class="project-rule-label">Días laborales</span>
              <strong>${formatEnabledDays(rules.work_days)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('projectRulesForm');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const workDays = DAY_OPTIONS.reduce((accumulator, day) => {
      accumulator[day.key] = formData.getAll('work_days').includes(day.key);
      return accumulator;
    }, {});

    try {
      const updatedProject = await api.updateProject(project.id, {
        sla_days: Number(formData.get('sla_days')),
        max_credits_per_day: Number(formData.get('max_credits_per_day')),
        urgency_multiplier: Number(formData.get('urgency_multiplier')),
        work_days: workDays
      });

      showToast('Reglas del proyecto actualizadas');
      onProjectUpdated(updatedProject);
    } catch (error) {
      showToast('No se pudieron guardar las reglas del proyecto', 'error');
    }
  });
}

function getProjectRules(project, creative) {
  return {
    sla_days: project.sla_days ?? creative?.sla_days ?? 4,
    max_credits_per_day: project.max_credits_per_day ?? creative?.max_credits_per_day ?? 6,
    urgency_multiplier: project.urgency_multiplier ?? creative?.urgency_multiplier ?? 1.5,
    work_days: {
      monday: project.work_days?.monday ?? creative?.work_days?.monday ?? true,
      tuesday: project.work_days?.tuesday ?? creative?.work_days?.tuesday ?? true,
      wednesday: project.work_days?.wednesday ?? creative?.work_days?.wednesday ?? true,
      thursday: project.work_days?.thursday ?? creative?.work_days?.thursday ?? true,
      friday: project.work_days?.friday ?? creative?.work_days?.friday ?? true,
      saturday: project.work_days?.saturday ?? creative?.work_days?.saturday ?? false,
      sunday: project.work_days?.sunday ?? creative?.work_days?.sunday ?? false
    }
  };
}

function formatEnabledDays(workDays) {
  const labels = DAY_OPTIONS
    .filter((day) => workDays[day.key])
    .map((day) => day.label);

  return labels.length > 0 ? labels.join(', ') : 'Sin días definidos';
}
