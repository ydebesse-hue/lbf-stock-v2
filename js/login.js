// =============================================================
// LBF Stock v2 — Logique de la page de connexion
// Dépendances : config.js, supabase.js, utils.js, auth/auth.js
// =============================================================

(function () {
  // Si déjà connecté → rediriger directement vers le stock
  const existingSession = auth.getSession();
  if (existingSession) {
    window.location.href = 'views/stock.html';
    return;
  }

  const form       = document.getElementById('loginForm');
  const usernameEl = document.getElementById('username');
  const passwordEl = document.getElementById('password');
  const errorEl    = document.getElementById('loginError');
  const submitBtn  = document.getElementById('submitBtn');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    passwordEl.value = '';
    passwordEl.focus();
  }

  function hideError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!username || !password) {
      showError('Veuillez remplir tous les champs.');
      return;
    }

    utils.btnLoading(submitBtn, true);

    const { user, error } = await auth.login(username, password);

    utils.btnLoading(submitBtn, false);

    if (error) {
      showError(error);
      return;
    }

    // Connexion réussie → redirection
    window.location.href = 'views/stock.html';
  });

  // Focus automatique sur le champ identifiant
  usernameEl.focus();
})();
