import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { DAY_OPTIONS, formatEnabledDays, getAccountRuleDefaults } from '../rules.js';
import { showLoading, showError, showToast } from '../utils.js';

export async function renderSettings(user, creative, onCreativeUpdated) {
  const app = document.getElementById('app');
  showLoading(app);

  try {
    const defaults = getAccountRuleDefaults(creative);

    app.innerHTML = '';
    app.appendChild(renderHeader(user, creative));

    const main = document.createElement('main');
    main.className = 'main';
    main.innerHTML = `
      <div class="container">
        <div class="page">
          <div class="dashboard__header">
            <h1 class="dashboard__title">Settings</h1>
            <p class="dashboard__subtitle">Define tus reglas por defecto. Cada proyecto puede sobrescribirlas.</p>
          </div>

          <div class="dashboard__grid project-settings-grid">
            <div class="card">
              <div class="card__header">
                <div>
                  <h3 class="card__title">Defaults de la cuenta</h3>
                  <p class="card__subtitle">Se aplican automáticamente a los nuevos proyectos y a los proyectos sin override.</p>
                </div>
              </div>
              <div class="card__body">
                <form id="accountRulesForm">
                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label" for="accountSlaDays">SLA mínimo (días)</label>
                      <input id="accountSlaDays" name="sla_days" type="number" min="1" class="form-input" value="${defaults.sla_days}" required />
                    </div>
                    <div class="form-group">
                      <label class="form-label" for="accountMaxCreditsPerDay">Capacidad diaria</label>
                      <input id="accountMaxCreditsPerDay" name="max_credits_per_day" type="number" min="1" class="form-input" value="${defaults.max_credits_per_day}" required />
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="accountUrgencyMultiplier">Multiplicador de urgencia</label>
                    <input id="accountUrgencyMultiplier" name="urgency_multiplier" type="number" min="1" step="0.1" class="form-input" value="${defaults.urgency_multiplier}" required />
                  </div>

                  <div class="form-group">
                    <label class="form-label">Días laborales por defecto</label>
                    <div class="checkbox-grid">
                      ${DAY_OPTIONS.map((day) => `
                        <label class="checkbox-card">
                          <input type="checkbox" name="work_days" value="${day.key}" ${defaults.work_days[day.key] ? 'checked' : ''} />
                          <span>${day.label}</span>
                        </label>
                      `).join('')}
                    </div>
                  </div>

                  <div class="card__footer">
                    <button type="submit" class="button button--primary">Guardar defaults</button>
                  </div>
                </form>
              </div>
            </div>

            <div class="card">
              <div class="card__header">
                <div>
                  <h3 class="card__title">Resumen</h3>
                  <p class="card__subtitle">Configuración base actual de tu cuenta.</p>
                </div>
              </div>
              <div class="card__body">
                <div class="project-rule-list">
                  <div class="project-rule-item">
                    <span class="project-rule-label">SLA mínimo</span>
                    <strong>${defaults.sla_days} días</strong>
                  </div>
                  <div class="project-rule-item">
                    <span class="project-rule-label">Capacidad diaria</span>
                    <strong>${defaults.max_credits_per_day} créditos</strong>
                  </div>
                  <div class="project-rule-item">
                    <span class="project-rule-label">Urgencia</span>
                    <strong>x${defaults.urgency_multiplier}</strong>
                  </div>
                  <div class="project-rule-item">
                    <span class="project-rule-label">Días laborales</span>
                    <strong>${formatEnabledDays(defaults.work_days)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    app.appendChild(main);

    const form = document.getElementById('accountRulesForm');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const workDays = DAY_OPTIONS.reduce((accumulator, day) => {
        accumulator[day.key] = formData.getAll('work_days').includes(day.key);
        return accumulator;
      }, {});

      try {
        const updatedCreative = await api.updateCreative(creative.id, {
          sla_days: Number(formData.get('sla_days')),
          max_credits_per_day: Number(formData.get('max_credits_per_day')),
          urgency_multiplier: Number(formData.get('urgency_multiplier')),
          work_days: workDays
        });

        onCreativeUpdated(updatedCreative);
        showToast('Defaults de la cuenta actualizados');
        await renderSettings(user, updatedCreative, onCreativeUpdated);
      } catch (error) {
        showToast('No se pudieron guardar los defaults', 'error');
      }
    });
  } catch (error) {
    showError(app, 'Error al cargar settings: ' + error.message);
  }
}
