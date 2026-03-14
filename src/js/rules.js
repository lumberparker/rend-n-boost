export const DAY_OPTIONS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

export function normalizeWorkDays(workDays) {
  return {
    monday: workDays?.monday ?? true,
    tuesday: workDays?.tuesday ?? true,
    wednesday: workDays?.wednesday ?? true,
    thursday: workDays?.thursday ?? true,
    friday: workDays?.friday ?? true,
    saturday: workDays?.saturday ?? false,
    sunday: workDays?.sunday ?? false
  };
}

export function getAccountRuleDefaults(creative) {
  return {
    sla_days: creative?.sla_days ?? 4,
    max_credits_per_day: creative?.max_credits_per_day ?? 6,
    urgency_multiplier: creative?.urgency_multiplier ?? 1.5,
    work_days: normalizeWorkDays(creative?.work_days)
  };
}

export function getProjectRuleConfig(project, creative) {
  const defaults = getAccountRuleDefaults(creative);
  const hasOverrides =
    project?.sla_days !== null && project?.sla_days !== undefined ||
    project?.max_credits_per_day !== null && project?.max_credits_per_day !== undefined ||
    project?.urgency_multiplier !== null && project?.urgency_multiplier !== undefined ||
    project?.work_days !== null && project?.work_days !== undefined;

  return {
    defaults,
    hasOverrides,
    effective: {
      sla_days: project?.sla_days ?? defaults.sla_days,
      max_credits_per_day: project?.max_credits_per_day ?? defaults.max_credits_per_day,
      urgency_multiplier: project?.urgency_multiplier ?? defaults.urgency_multiplier,
      work_days: normalizeWorkDays(project?.work_days ?? defaults.work_days)
    },
    overrides: {
      sla_days: project?.sla_days ?? '',
      max_credits_per_day: project?.max_credits_per_day ?? '',
      urgency_multiplier: project?.urgency_multiplier ?? '',
      work_days: normalizeWorkDays(project?.work_days ?? defaults.work_days)
    }
  };
}

export function formatEnabledDays(workDays) {
  const labels = DAY_OPTIONS
    .filter((day) => workDays?.[day.key])
    .map((day) => day.label);

  return labels.length > 0 ? labels.join(', ') : 'Sin días definidos';
}
