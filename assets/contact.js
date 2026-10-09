import { CONFIG } from './config.js';
document.getElementById('contact-form')?.addEventListener('submit', (e) => {
  e.preventDefault(); const n = document.getElementById('ct-name').value, em = document.getElementById('ct-email').value, m = document.getElementById('ct-msg').value;
  location.href = `mailto:${CONFIG.store.email}?subject=${encodeURIComponent('Website message from ' + n)}&body=${encodeURIComponent(m + '\n\n— ' + n + ' (' + em + ')')}`;
});
