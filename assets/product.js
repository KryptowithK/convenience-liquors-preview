const qty = document.getElementById('qty');
document.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { qty.value = Math.min(99, Math.max(1, (parseInt(qty.value, 10) || 1) + Number(b.dataset.q))); }));
