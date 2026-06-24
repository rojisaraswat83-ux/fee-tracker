/**
 * toast.js
 * Utility to display premium animated toast notifications.
 */

const TOAST_DURATION = 4000; // 4 seconds before auto-dismissal

/**
 * Show a notification toast.
 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {string} title - Strong bold header text
 * @param {string} message - Description message
 */
export function showToast(type, title, message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  // Choose appropriate SVG icon based on toast type
  let iconSvg = '';
  switch (type) {
    case 'success':
      iconSvg = `
        <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      `;
      break;
    case 'error':
      iconSvg = `
        <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      `;
      break;
    case 'warning':
      iconSvg = `
        <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      `;
      break;
    default:
      iconSvg = `
        <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      `;
  }

  // Populate inner HTML structure
  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close-btn" aria-label="Close notification">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `;

  // Append toast
  container.appendChild(toast);

  // Setup dismissal timer
  let autoDismissTimer = setTimeout(() => {
    dismissToast(toast);
  }, TOAST_DURATION);

  // Manual dismiss event listener
  const closeBtn = toast.querySelector('.toast-close-btn');
  closeBtn.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    dismissToast(toast);
  });
}

/**
 * Apply exit animations and delete toast node from document flow.
 * @param {HTMLElement} toast - The toast element node
 */
function dismissToast(toast) {
  toast.classList.add('toast-hide');
  // Wait for slide-up/fade out CSS transition to finish before removal
  toast.addEventListener('transitionend', () => {
    toast.remove();
  }, { once: true });
}

// Convenience export wrappers
export function showSuccess(title, message) { showToast('success', title, message); }
export function showError(title, message) { showToast('error', title, message); }
export function showWarning(title, message) { showToast('warning', title, message); }
export function showInfo(title, message) { showToast('info', title, message); }
