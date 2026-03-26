// =============================================================
// LBF Stock v2 — Module d'authentification et RBAC
// Dépendances : config.js, supabase.js, utils.js
// =============================================================

const auth = {
  // Clé de session dans sessionStorage
  SESSION_KEY: 'lbf_session',

  // ── Session ───────────────────────────────────────────────

  /**
   * Retourner l'utilisateur connecté ou null
   * @returns {{ id, username, nom, prenom, role } | null}
   */
  getSession() {
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /**
   * Enregistrer la session après connexion réussie
   */
  setSession(user) {
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
  },

  /**
   * Supprimer la session (déconnexion)
   */
  clearSession() {
    sessionStorage.removeItem(this.SESSION_KEY);
  },

  // ── Connexion ─────────────────────────────────────────────

  /**
   * Authentifier un utilisateur
   * @param {string} username
   * @param {string} plainPassword — mot de passe en clair
   * @returns {Promise<{ user: object | null, error: string | null }>}
   */
  async login(username, plainPassword) {
    if (!username || !plainPassword) {
      return { user: null, error: 'Identifiant et mot de passe requis.' };
    }

    // Hash SHA-256 du mot de passe
    let passwordHash;
    try {
      passwordHash = await utils.hashPassword(plainPassword);
    } catch (err) {
      return { user: null, error: 'Erreur de chiffrement.' };
    }

    // Appel RPC verify_user (SECURITY DEFINER — bypasse RLS)
    const { data, error } = await db.rpc('verify_user', {
      p_username:      username.trim().toLowerCase(),
      p_password_hash: passwordHash,
    });

    if (error) {
      return { user: null, error: 'Erreur de connexion au serveur.' };
    }

    // verify_user retourne un tableau (RETURNS TABLE)
    const user = Array.isArray(data) ? data[0] : data;

    if (!user) {
      return { user: null, error: 'Identifiant ou mot de passe incorrect.' };
    }

    this.setSession(user);
    return { user, error: null };
  },

  /**
   * Déconnecter l'utilisateur et rediriger
   * @param {string} redirectTo — chemin de redirection (défaut : login)
   */
  logout(redirectTo = null) {
    this.clearSession();
    const target = redirectTo || this._loginUrl();
    window.location.href = target;
  },

  // ── Guards ────────────────────────────────────────────────

  /**
   * Vérifier que l'utilisateur est connecté et a le bon rôle.
   * Redirige vers la page de login sinon.
   * À appeler en tête de chaque page protégée.
   *
   * @param {string[]} roles — rôles autorisés (vide = tout rôle connecté)
   * @returns {{ id, username, nom, prenom, role }}
   */
  requireAuth(roles = []) {
    const user = this.getSession();

    if (!user) {
      window.location.href = this._loginUrl();
      throw new Error('Non authentifié — redirection en cours');
    }

    if (roles.length > 0 && !roles.includes(user.role)) {
      // Redirige vers stock (page par défaut) avec un message d'erreur
      sessionStorage.setItem('lbf_access_error', 'Accès non autorisé pour votre rôle.');
      window.location.href = this._stockUrl();
      throw new Error('Rôle insuffisant — redirection en cours');
    }

    return user;
  },

  /**
   * Vérifier si l'utilisateur courant a un rôle parmi la liste
   * @param {string[]} roles
   * @returns {boolean}
   */
  hasRole(roles) {
    const user = this.getSession();
    if (!user) return false;
    return roles.includes(user.role);
  },

  /** Raccourcis rôles */
  isAdmin() {
    return this.hasRole(['administration']);
  },

  isGestion() {
    return this.hasRole(['gestion', 'administration']);
  },

  // ── Navigation ────────────────────────────────────────────

  /** Chemin vers la page de login selon la profondeur de la page courante */
  _loginUrl() {
    const path = window.location.pathname;
    // Si on est dans views/ → ../index.html
    if (path.includes('/views/')) return '../index.html';
    return 'index.html';
  },

  _stockUrl() {
    const path = window.location.pathname;
    if (path.includes('/views/')) return 'stock.html';
    return 'views/stock.html';
  },

  // ── UI helpers ────────────────────────────────────────────

  /**
   * Afficher le nom de l'utilisateur dans l'élément #userDisplay
   * et brancher le bouton de déconnexion
   */
  initNav() {
    const user = this.getSession();
    if (!user) return;

    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
      userDisplay.textContent = `${user.prenom} ${user.nom}`;
      userDisplay.title = `Rôle : ${utils.labelRole(user.role)}`;
    }

    const roleDisplay = document.getElementById('roleDisplay');
    if (roleDisplay) {
      roleDisplay.textContent = utils.labelRole(user.role);
      roleDisplay.className   = `role-badge role-${user.role}`;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('Se déconnecter ?')) this.logout();
      });
    }

    // Afficher/masquer les éléments réservés aux admins
    document.querySelectorAll('[data-require-role]').forEach(el => {
      const required = el.dataset.requireRole.split(',').map(r => r.trim());
      if (!this.hasRole(required)) {
        el.style.display = 'none';
      }
    });
  },

  /**
   * Afficher une erreur d'accès stockée en session
   */
  showAccessError() {
    const err = sessionStorage.getItem('lbf_access_error');
    if (err) {
      utils.flash(err, 'error');
      sessionStorage.removeItem('lbf_access_error');
    }
  },
};
