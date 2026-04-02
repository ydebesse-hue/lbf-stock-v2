/**
 * auth.js — Moteur d'authentification Stock Métallerie LBF
 * Authentification via Supabase Auth (JWT).
 * Les rôles et droits sont stockés dans la table `profils` (Supabase).
 */

// ═══════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════

const _racine = (function() {
  const path = window.location.pathname;
  const base = path
    .replace(/\/auth\/[^/]*$/, '/')
    .replace(/\/views\/[^/]*$/, '/')
    .replace(/\/[^/]*\.html$/, '/');
  return window.location.origin + base;
})();

const AUTH_CONFIG = {
  sessionKey: 'lbf_session',
  loginPage:  _racine + 'login.html',
  homePage:   _racine + 'index.html',
};

/** Suffixe email synthétique pour Supabase Auth. */
const EMAIL_SUFFIX = '@lbf.local';

// Table des droits par profil
const DROITS = {
  consultation: {
    can_view:          true,
    can_request:       true,
    can_edit:          false,
    can_add:           false,
    can_validate:      false,
    can_manage_users:  false,
  },
  gestion: {
    can_view:          true,
    can_request:       true,
    can_edit:          true,
    can_add:           true,
    can_validate:      false,
    can_manage_users:  false,
  },
  administration: {
    can_view:          true,
    can_request:       true,
    can_edit:          true,
    can_add:           true,
    can_validate:      true,
    can_manage_users:  true,
  },
};

const REDIRECT_APRES_LOGIN = {
  consultation:   '../views/stock.html',
  gestion:        '../views/stock.html',
  administration: '../views/stock.html',
};


// ═══════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════

/**
 * Connecte un utilisateur via Supabase Auth.
 * @param {string} identifiant  — ex : "p.dupont"
 * @param {string} motDePasse
 * @returns {Promise<{ok: boolean, erreur?: string, utilisateur?: object}>}
 */
async function login(identifiant, motDePasse) {
  if (!identifiant || !motDePasse) {
    return { ok: false, erreur: 'Identifiant et mot de passe requis.' };
  }

  const email = identifiant.toLowerCase().trim() + EMAIL_SUFFIX;

  try {
    // 1. Authentification Supabase (stocke le JWT dans supabase.js)
    const authData = await window.SB.login(email, motDePasse);

    // 2. Lire le rôle depuis les métadonnées utilisateur Supabase
    const meta = authData.user?.user_metadata || {};
    const role = meta.role || 'consultation';

    // 3. Construire la session applicative (même structure qu'avant)
    const session = {
      id:          authData.user.id,
      identifiant: meta.identifiant || identifiant,
      nomComplet:  meta.nom_complet  || identifiant,
      profil:      role,
      droits:      DROITS[role] || DROITS.consultation,
      loginAt:     Date.now(),
    };

    sessionStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(session));
    return { ok: true, utilisateur: session };

  } catch(err) {
    // Effacer tout token partiel
    try { await window.SB.logout(); } catch(e) {}
    return { ok: false, erreur: 'Identifiant ou mot de passe incorrect.' };
  }
}


// ═══════════════════════════════════════════════════════
//  LOGOUT
// ═══════════════════════════════════════════════════════

/**
 * Déconnecte l'utilisateur (Supabase Auth + session applicative).
 */
function logout() {
  sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
  window.SB.logout().catch(() => {});
  window.location.href = AUTH_CONFIG.loginPage;
}


// ═══════════════════════════════════════════════════════
//  LECTURE SESSION
// ═══════════════════════════════════════════════════════

/**
 * Retourne l'utilisateur en session, ou null.
 * @returns {object|null}
 */
function getSession() {
  const raw = sessionStorage.getItem(AUTH_CONFIG.sessionKey);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}


// ═══════════════════════════════════════════════════════
//  GARDE DE ROUTE
// ═══════════════════════════════════════════════════════

/**
 * À appeler en tête de chaque page protégée.
 * Redirige vers login si pas de session valide.
 * @param {string|null} profilMinimum
 * @returns {object|null}
 */
function requireAuth(profilMinimum = null) {
  const session = getSession();

  // Pas de session applicative ou pas de token Supabase → login
  if (!session || !window.SB.hasToken()) {
    sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
    window.location.href = AUTH_CONFIG.loginPage;
    return null;
  }

  if (profilMinimum) {
    const niveaux = { consultation: 1, gestion: 2, administration: 3 };
    if ((niveaux[session.profil] || 0) < (niveaux[profilMinimum] || 0)) {
      window.location.href = REDIRECT_APRES_LOGIN.consultation;
      return null;
    }
  }

  return session;
}


// ═══════════════════════════════════════════════════════
//  VÉRIFICATION D'UN DROIT PRÉCIS
// ═══════════════════════════════════════════════════════

/**
 * @param {string} droit  — ex: 'can_edit', 'can_validate'
 * @returns {boolean}
 */
function hasRight(droit) {
  const session = getSession();
  if (!session || !session.droits) return false;
  return session.droits[droit] === true;
}


// ═══════════════════════════════════════════════════════
//  UTILITAIRES UI
// ═══════════════════════════════════════════════════════

function afficherInfosSession(selectorNom, selectorBadge) {
  const session = getSession();
  if (!session) return;

  const elNom   = document.querySelector(selectorNom);
  const elBadge = document.querySelector(selectorBadge);

  const labelsProfil = {
    consultation:   'Consultation',
    gestion:        'Gestion',
    administration: 'Administration',
  };
  const classesBadge = {
    consultation:   'badge-rouge',
    gestion:        'badge-vert',
    administration: 'badge-or',
  };

  if (elNom)   elNom.textContent  = session.nomComplet;
  if (elBadge) {
    elBadge.textContent = labelsProfil[session.profil] || session.profil;
    elBadge.className   = `badge ${classesBadge[session.profil] || 'badge-rouge'}`;
  }
}

function appliquerDroitsDOM() {
  const session = getSession();
  const droits  = session?.droits || {};
  document.querySelectorAll('[data-require]').forEach(el => {
    const droit = el.getAttribute('data-require');
    if (!droits[droit]) el.style.display = 'none';
  });
}


// ═══════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════

window.Auth = {
  login,
  logout,
  getSession,
  requireAuth,
  hasRight,
  afficherInfosSession,
  appliquerDroitsDOM,
  DROITS,
  EMAIL_SUFFIX,
};
