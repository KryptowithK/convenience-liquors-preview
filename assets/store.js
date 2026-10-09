const dow = new Date().getDay(); document.querySelector(`.hours tr[data-dow="${dow}"]`)?.classList.add('today');
