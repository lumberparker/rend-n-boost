import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { router } from '../router.js';
import { showLoading, showError, showToast, copyToClipboard } from '../utils.js';

const INITIAL_FORM_STATE = {
  client_name: '',
  client_whatsapp: '',
  plan_type: 'monthly',
  credits_available: '20',
  project_name: '',
  project_description: '',
  start_date: '',
  end_date: ''
};

export async function renderNewProject(user, creative) {
  const app = document.getElementById('app');
  showLoading(app);

  try {
    app.innerHTML = '';
    app.appendChild(renderHeader(user, creative));

    const main = document.createElement('main');
    main.className = 'main';
    app.appendChild(main);

    const state = {
      step: 1,
      form: { ...INITIAL_FORM_STATE },
      createdProject: null,
      publicLink: null,
      isSubmitting: false
    };

    renderStep(main, state, creative);
  } catch (error) {
    showError(app, 'Error al cargar la creación de proyectos: ' + error.message);
  }
}

function renderStep(container, state, creative) {
  if (state.createdProject && state.publicLink) {
    renderSuccessState(container, state);
    return;
  }

  container.innerHTML = `
    <div class="container">
      <div class="page">
        <div class="dashboard__header">
          <div>
            <h1 class="dashboard__title">Nuevo proyecto guiado</h1>
            <p class="dashboard__subtitle">Crea el cliente, define el tipo de trabajo y genera el portal compartido en un solo flujo.</p>
          </div>
        </div>

        <div class="wizard">
          <div class="wizard__steps">
            ${renderWizardStep(1, state.step, 'Cliente')}
            ${renderWizardStep(2, state.step, 'Proyecto')}
            ${renderWizardStep(3, state.step, 'Revisión')}
          </div>

          <div class="card">
            <div class="card__body">
              <form id="newProjectWizardForm">
                ${state.step === 1 ? renderClientStep(state.form) : ''}
                ${state.step === 2 ? renderProjectStep(state.form, creative) : ''}
                ${state.step === 3 ? renderReviewStep(state.form) : ''}

                <div class="card__footer">
                  <div class="wizard__actions">
                    ${state.step > 1 ? '<button type="button" class="button button--outline" id="wizardBackBtn">Atrás</button>' : '<span></span>'}
                    ${state.step < 3
                      ? '<button type="submit" class="button button--primary">Continuar</button>'
                      : `<button type="submit" class="button button--primary" ${state.isSubmitting ? 'disabled' : ''}>${state.isSubmitting ? 'Creando...' : 'Crear proyecto'}</button>`}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('newProjectWizardForm');
  const backBtn = document.getElementById('wizardBackBtn');

  backBtn?.addEventListener('click', () => {
    state.step -= 1;
    renderStep(container, state, creative);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    applyStepValues(state.form, formData, state.step);

    if (state.step < 3) {
      state.step += 1;
      renderStep(container, state, creative);
      return;
    }

    state.isSubmitting = true;
    renderStep(container, state, creative);

    try {
      const createdClient = await api.createClient({
        name: state.form.client_name,
        email: null,
        whatsapp_number: state.form.client_whatsapp,
        creative_id: creative.id,
        plan_type: state.form.plan_type,
        credits_available: Number(state.form.credits_available || 0)
      });

      const createdProject = await api.createProject({
        name: state.form.project_name,
        description: state.form.project_description,
        client_id: createdClient.id,
        start_date: state.form.start_date || null,
        end_date: state.form.end_date || null,
        credits_assigned: state.form.plan_type === 'project'
          ? Number(state.form.credits_available || 0)
          : 0
      });

      const publicLink = await api.createPublicLink({
        project_id: createdProject.id,
        created_by: creative.id
      });

      state.createdProject = createdProject;
      state.publicLink = buildProjectShareUrl(publicLink.token);
      state.isSubmitting = false;
      renderStep(container, state, creative);
      showToast('Proyecto creado correctamente');
    } catch (error) {
      state.isSubmitting = false;
      renderStep(container, state, creative);
      showToast('No se pudo crear el proyecto', 'error');
    }
  });
}

function renderWizardStep(number, currentStep, label) {
  return `
    <div class="wizard__step ${number === currentStep ? 'wizard__step--active' : number < currentStep ? 'wizard__step--complete' : ''}">
      <span class="wizard__step-number">${number}</span>
      <span class="wizard__step-label">${label}</span>
    </div>
  `;
}

function renderClientStep(form) {
  return `
    <div class="form-group">
      <label class="form-label" for="clientName">Nombre del cliente</label>
      <input id="clientName" name="client_name" class="form-input" value="${form.client_name}" required />
    </div>

    <div class="form-group">
      <label class="form-label" for="clientWhatsapp">WhatsApp del cliente</label>
      <input id="clientWhatsapp" name="client_whatsapp" type="tel" class="form-input" placeholder="5219991234567" value="${form.client_whatsapp}" required />
      <span class="form-helper">Usa el número completo con código de país. Este será el canal principal de comunicación.</span>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="planType">Tipo de trabajo</label>
        <select id="planType" name="plan_type" class="form-select">
          <option value="monthly" ${form.plan_type === 'monthly' ? 'selected' : ''}>Iguala</option>
          <option value="project" ${form.plan_type === 'project' ? 'selected' : ''}>Proyecto cerrado</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="creditsAvailable">${form.plan_type === 'monthly' ? 'Créditos mensuales iniciales' : 'Créditos del proyecto'}</label>
        <input id="creditsAvailable" name="credits_available" type="number" min="0" class="form-input" value="${form.credits_available}" required />
      </div>
    </div>
  `;
}

function renderProjectStep(form, creative) {
  return `
    <div class="form-group">
      <label class="form-label" for="projectName">Nombre del proyecto</label>
      <input id="projectName" name="project_name" class="form-input" value="${form.project_name}" required />
    </div>

    <div class="form-group">
      <label class="form-label" for="projectDescription">Descripción</label>
      <textarea id="projectDescription" name="project_description" class="form-textarea" placeholder="Resumen, objetivos y alcance">${form.project_description}</textarea>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="startDate">Fecha de inicio</label>
        <input id="startDate" name="start_date" type="date" class="form-input" value="${form.start_date}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="endDate">Fecha estimada de cierre</label>
        <input id="endDate" name="end_date" type="date" class="form-input" value="${form.end_date}" />
      </div>
    </div>

    <div class="empty-state" style="padding: 1.5rem 0 0; text-align: left;">
      <div class="empty-state__title">Qué se va a crear</div>
      <div class="empty-state__description">
        Se generará un portal compartido para el cliente. En iguala, el cliente podrá crear tareas y sugerir créditos. Tú aprobarás, contrapropodrás y entregarás desde este mismo proyecto.
      </div>
      <div class="empty-state__description">Defaults activos de tu cuenta: SLA ${creative?.sla_days || 4} días, capacidad ${creative?.max_credits_per_day || 6} créditos/día.</div>
    </div>
  `;
}

function renderReviewStep(form) {
  return `
    <div class="project-rule-list">
      <div class="project-rule-item">
        <span class="project-rule-label">Cliente</span>
        <strong>${form.client_name}</strong>
      </div>
      <div class="project-rule-item">
        <span class="project-rule-label">WhatsApp</span>
        <strong>${form.client_whatsapp}</strong>
      </div>
      <div class="project-rule-item">
        <span class="project-rule-label">Tipo de trabajo</span>
        <strong>${form.plan_type === 'monthly' ? 'Iguala' : 'Proyecto cerrado'}</strong>
      </div>
      <div class="project-rule-item">
        <span class="project-rule-label">${form.plan_type === 'monthly' ? 'Créditos mensuales' : 'Créditos del proyecto'}</span>
        <strong>${form.credits_available}</strong>
      </div>
      <div class="project-rule-item">
        <span class="project-rule-label">Proyecto</span>
        <strong>${form.project_name}</strong>
      </div>
      <div class="project-rule-item">
        <span class="project-rule-label">Descripción</span>
        <strong>${form.project_description || 'Sin descripción'}</strong>
      </div>
    </div>
  `;
}

function renderSuccessState(container, state) {
  container.innerHTML = `
    <div class="container">
      <div class="page">
        <div class="card">
          <div class="card__header">
            <div>
              <h3 class="card__title">Proyecto creado</h3>
              <p class="card__subtitle">El cliente ya tiene su portal de trabajo listo.</p>
            </div>
          </div>
          <div class="card__body">
            <div class="project-rule-list">
              <div class="project-rule-item">
                <span class="project-rule-label">Proyecto</span>
                <strong>${state.createdProject.name}</strong>
              </div>
              <div class="project-rule-item">
                <span class="project-rule-label">Link para cliente</span>
                <strong>${state.publicLink}</strong>
              </div>
            </div>
          </div>
          <div class="card__footer">
            <div class="wizard__actions">
              <button type="button" class="button button--outline" id="copyClientLinkBtn">Copiar link</button>
              <button type="button" class="button button--primary" id="openCreatedProjectBtn">Abrir proyecto</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('copyClientLinkBtn')?.addEventListener('click', async () => {
    await copyToClipboard(state.publicLink);
    showToast('Link copiado');
  });

  document.getElementById('openCreatedProjectBtn')?.addEventListener('click', () => {
    router.navigate(`/projects/${state.createdProject.id}`);
  });
}

function applyStepValues(formState, formData, step) {
  if (step === 1) {
    formState.client_name = String(formData.get('client_name') || '');
    formState.client_whatsapp = String(formData.get('client_whatsapp') || '');
    formState.plan_type = String(formData.get('plan_type') || 'monthly');
    formState.credits_available = String(formData.get('credits_available') || '0');
  }

  if (step === 2) {
    formState.project_name = String(formData.get('project_name') || '');
    formState.project_description = String(formData.get('project_description') || '');
    formState.start_date = String(formData.get('start_date') || '');
    formState.end_date = String(formData.get('end_date') || '');
  }
}

function buildProjectShareUrl(token) {
  return `${window.location.origin}/?token=${token}`;
}
