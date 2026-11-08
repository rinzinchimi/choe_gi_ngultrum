/**
 * Choe Gi Ngultrum - Client-Side Enhancements
 */

document.addEventListener('DOMContentLoaded', function () {
  // Auto-dismiss transient success alerts after 6 seconds
  const alerts = document.querySelectorAll('.alert-success');
  alerts.forEach(function (alert) {
    setTimeout(function () {
      alert.style.transition = 'opacity 0.5s ease';
      alert.style.opacity = '0';
      setTimeout(function () {
        if (alert.parentNode) alert.parentNode.removeChild(alert);
      }, 500);
    }, 6000);
  });

  // Polite form submit confirmation for critical actions
  const rejectForms = document.querySelectorAll('form[action*="reject"]');
  rejectForms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!confirm('Please confirm: are you sure you want to return/reject this expenditure record with the provided reason?')) {
        e.preventDefault();
      }
    });
  });
});

