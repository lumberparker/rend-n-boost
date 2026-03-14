export function showLoading(container) {
  container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
    </div>
  `;
}

export function showError(container, message) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__title">Error</div>
      <div class="empty-state__description">${message}</div>
    </div>
  `;
}

export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function getStatusBadgeClass(status) {
  const statusMap = {
    pending: 'badge--warning',
    approved: 'badge--primary',
    in_progress: 'badge--primary',
    completed: 'badge--success',
    rejected: 'badge--error',
    blocked: 'badge--error'
  };
  return statusMap[status] || 'badge--neutral';
}

export function getStatusLabel(status) {
  const labelMap = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    in_progress: 'En Progreso',
    completed: 'Completada',
    rejected: 'Rechazada',
    blocked: 'Bloqueada'
  };
  return labelMap[status] || status;
}

export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
