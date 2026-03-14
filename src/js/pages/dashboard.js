import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, showError, formatDate, getStatusBadgeClass, getStatusLabel } from '../utils.js';
import { router } from '../router.js';

export async function renderDashboard(user, creative) {
  const app = document.getElementById('app');
  showLoading(app);

  try {
    const [clients, projects, tasks] = await Promise.all([
      api.getClients(),
      api.getProjects(),
      api.getTasks()
    ]);

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const activeTasks = tasks.filter(t => ['approved', 'in_progress', 'delivered', 'revision_requested', 'counter_proposed'].includes(t.status));
    const totalCreditsAvailable = clients.reduce((sum, c) => sum + c.credits_available, 0);

    app.innerHTML = '';
    app.appendChild(renderHeader(user, creative));

    const main = document.createElement('main');
    main.className = 'main';
    main.innerHTML = `
      <div class="container">
        <div class="dashboard">
          <div class="dashboard__header">
            <h1 class="dashboard__title">Panel de Control</h1>
            <p class="dashboard__subtitle">${creative?.is_super_admin ? 'Gestiona todos los proyectos y clientes' : 'Gestiona tus proyectos y clientes'}</p>
          </div>

          <div class="dashboard__stats">
            <div class="stat-card">
              <div class="stat-card__label">Tareas Pendientes</div>
              <div class="stat-card__value">${pendingTasks.length}</div>
            </div>
            <div class="stat-card stat-card--success">
              <div class="stat-card__label">Tareas Activas</div>
              <div class="stat-card__value">${activeTasks.length}</div>
            </div>
            <div class="stat-card stat-card--warning">
              <div class="stat-card__label">Proyectos Activos</div>
              <div class="stat-card__value">${projects.filter(p => p.active).length}</div>
            </div>
            <div class="stat-card stat-card--neutral">
              <div class="stat-card__label">Créditos Disponibles</div>
              <div class="stat-card__value">${totalCreditsAvailable}</div>
            </div>
          </div>

          <div class="dashboard__section">
            <div class="dashboard__section-header">
              <h2 class="dashboard__section-title">Tareas Pendientes de Aprobación</h2>
            </div>
            <div id="pendingTasksContainer"></div>
          </div>

          <div class="dashboard__section">
            <div class="dashboard__section-header">
              <h2 class="dashboard__section-title">Proyectos Activos</h2>
              <button class="button button--primary" id="newProjectBtn">
                Nuevo Proyecto
              </button>
            </div>
            <div id="projectsContainer"></div>
          </div>
        </div>
      </div>
    `;

    app.appendChild(main);

    renderPendingTasks(pendingTasks, projects);
    renderActiveProjects(projects);

    const newProjectBtn = document.getElementById('newProjectBtn');
    newProjectBtn?.addEventListener('click', () => {
      router.navigate('/projects/new');
    });

  } catch (error) {
    showError(app, 'Error al cargar el panel: ' + error.message);
  }
}

function renderPendingTasks(tasks, projects) {
  const container = document.getElementById('pendingTasksContainer');

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__description">No hay tareas pendientes de aprobación</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="grid grid--2">
      ${tasks.map(task => {
        const project = projects.find(p => p.id === task.project_id);
        return `
          <div class="card">
            <div class="card__header">
              <div>
                <h3 class="card__title">${task.title}</h3>
                <p class="card__subtitle">${project?.name || 'Proyecto'}</p>
              </div>
              <span class="badge ${getStatusBadgeClass(task.status)}">
                ${getStatusLabel(task.status)}
              </span>
            </div>
            <div class="card__body">
              <p>${task.description || 'Sin descripción'}</p>
              <div style="margin-top: 1rem; display: flex; gap: 1rem; font-size: 0.875rem; color: var(--color-text-secondary);">
                <span>Créditos: ${task.credits_estimated}</span>
                <span>Fecha: ${formatDate(task.requested_date)}</span>
                ${task.is_urgent ? '<span class="badge badge--error">Urgente</span>' : ''}
              </div>
            </div>
            <div class="card__footer">
              <button class="button button--success button--sm approve-task" data-id="${task.id}">
                Aprobar
              </button>
              <button class="button button--outline button--sm counter-task" data-id="${task.id}">
                Contrapropuesta
              </button>
              <button class="button button--danger button--sm reject-task" data-id="${task.id}">
                Rechazar
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('.approve-task').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = e.target.getAttribute('data-id');
      await approveTask(taskId);
    });
  });

  container.querySelectorAll('.reject-task').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = e.target.getAttribute('data-id');
      await rejectTask(taskId);
    });
  });

  container.querySelectorAll('.counter-task').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = e.target.getAttribute('data-id');
      await counterTask(taskId);
    });
  });
}

function renderActiveProjects(projects) {
  const container = document.getElementById('projectsContainer');
  const activeProjects = projects.filter(p => p.active);

  if (activeProjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__description">No hay proyectos activos</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="grid grid--3">
      ${activeProjects.map(project => `
        <div class="card card--interactive" data-project-id="${project.id}">
          <div class="card__header">
            <h3 class="card__title">${project.name}</h3>
          </div>
          <div class="card__body">
            <p>${project.description || 'Sin descripción'}</p>
            <div style="margin-top: 1rem;">
              <p style="font-size: 0.875rem; color: var(--color-text-secondary);">
                Cliente: ${project.client?.name || 'N/A'}
              </p>
            </div>
          </div>
          <div class="card__footer">
            <div style="font-size: 0.875rem;">
              <span style="color: var(--color-text-secondary);">Créditos:</span>
              <strong>${project.client?.credits_available || 0}</strong>
            </div>
            <button class="button button--primary button--sm">Ver Proyecto</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.card--interactive').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        const projectId = card.getAttribute('data-project-id');
        router.navigate(`/projects/${projectId}`);
      }
    });
  });
}

async function approveTask(taskId) {
  try {
    const tasks = await api.getTasks();
    const selectedTask = tasks.find((item) => item.id === taskId);
    if (!selectedTask) {
      throw new Error('Tarea no encontrada');
    }

    const task = await api.updateTask(taskId, {
      status: 'approved',
      credits_approved: selectedTask.credits_estimated,
      credits_counter: null
    });

    const project = await api.getProject(task.project_id);
    await api.addCreditsTransaction({
      client_id: project.client.id,
      project_id: project.id,
      type: 'task_usage',
      description: `Tarea aprobada: ${task.title}`,
      amount: -(task.credits_approved || task.credits_estimated),
      reference: task.id
    });

    location.reload();
  } catch (error) {
    alert('Error al aprobar tarea: ' + error.message);
  }
}

async function counterTask(taskId) {
  try {
    const tasks = await api.getTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error('Tarea no encontrada');
    }

    const counterCredits = window.prompt('¿Cuántos créditos propones para esta tarea?', String(task.credits_estimated));
    if (!counterCredits) {
      return;
    }

    const creativeNotes = window.prompt('Notas para el cliente sobre la contrapropuesta (opcional):', task.creative_notes || '') || '';

    await api.updateTask(taskId, {
      status: 'counter_proposed',
      credits_counter: Number(counterCredits),
      creative_notes: creativeNotes
    });

    location.reload();
  } catch (error) {
    alert('Error al enviar contrapropuesta: ' + error.message);
  }
}

async function rejectTask(taskId) {
  try {
    await api.updateTask(taskId, { status: 'rejected' });
    location.reload();
  } catch (error) {
    alert('Error al rechazar tarea: ' + error.message);
  }
}
