/**
 * supabase.js — Client Supabase centralisé
 * Stock Métallerie — Le Bras Frères
 *
 * Authentification via Supabase Auth (JWT).
 * Les droits sont appliqués côté serveur via RLS.
 */

// ═══════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://ihpwdcndytxdnqjdcrsn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlocHdkY25keXR4ZG5xamRjcnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjExMDksImV4cCI6MjA5MDEzNzEwOX0.19WoAzpF59KeKfEXD8kYrzQtVOET594ajSTD9NwtEcs';
const SB_SESSION_KEY = 'sb_auth';

// ═══════════════════════════════════════════════════════
//  GESTION DU TOKEN JWT
// ═══════════════════════════════════════════════════════

let _accessToken  = null;
let _refreshToken = null;
let _tokenTimer   = null;

/** Planifie le renouvellement automatique du token. */
function _planifierRefresh(delaiMs) {
  clearTimeout(_tokenTimer);
  if (delaiMs > 0) {
    _tokenTimer = setTimeout(_refreshAccessToken, delaiMs);
  }
}

/** Renouvelle le token via le refresh_token stocké. */
async function _refreshAccessToken() {
  if (!_refreshToken) return;
  try {
    const rep = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method:  'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: _refreshToken }),
    });
    if (!rep.ok) {
      _accessToken = _refreshToken = null;
      try { sessionStorage.removeItem(SB_SESSION_KEY); } catch(e) {}
      return;
    }
    const d = await rep.json();
    _sauverSession(d);
  } catch(e) {}
}

/** Sauvegarde la session Supabase et met à jour les tokens en mémoire. */
function _sauverSession(data) {
  _accessToken  = data.access_token;
  _refreshToken = data.refresh_token;
  try { sessionStorage.setItem(SB_SESSION_KEY, JSON.stringify(data)); } catch(e) {}
  const delai = ((data.expires_in || 3600) - 60) * 1000;
  _planifierRefresh(delai);
}

// Restauration automatique de la session au chargement de la page
(function _restaurerSession() {
  try {
    const raw = sessionStorage.getItem(SB_SESSION_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data.access_token) return;
    // Vérifier si le token est encore valide
    const expiresAt = data.expires_at || 0;
    const resteSec  = expiresAt - Math.floor(Date.now() / 1000);
    if (resteSec > 30) {
      _accessToken  = data.access_token;
      _refreshToken = data.refresh_token;
      _planifierRefresh((resteSec - 60) * 1000);
    } else {
      // Token expiré → refresh immédiat
      _refreshToken = data.refresh_token;
      _refreshAccessToken();
    }
  } catch(e) {}
})();

/** Retourne les en-têtes HTTP avec le token courant. */
function _entetes(extra) {
  return Object.assign({
    'apikey':        SUPABASE_ANON,
    'Authorization': 'Bearer ' + (_accessToken || SUPABASE_ANON),
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  }, extra || {});
}

// ═══════════════════════════════════════════════════════
//  AUTHENTIFICATION
// ═══════════════════════════════════════════════════════

/**
 * Connecte un utilisateur via Supabase Auth (email + mot de passe).
 * L'email est construit comme {identifiant}@lbf.local
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} — données de session Supabase
 */
async function sbLogin(email, password) {
  const rep = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:  'POST',
    headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  if (!rep.ok) {
    const err = await rep.json().catch(() => ({}));
    throw new Error(err.error_description || err.msg || 'Identifiant ou mot de passe incorrect.');
  }
  const data = await rep.json();
  _sauverSession(data);
  return data;
}

/**
 * Déconnecte l'utilisateur côté Supabase.
 */
async function sbLogout() {
  clearTimeout(_tokenTimer);
  const token = _accessToken;
  _accessToken = _refreshToken = null;
  try { sessionStorage.removeItem(SB_SESSION_KEY); } catch(e) {}
  if (token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method:  'POST',
        headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + token },
      });
    } catch(e) {}
  }
}

/**
 * Crée un compte Supabase Auth (utilisé par l'admin pour créer des utilisateurs).
 * Nécessite que "Allow email signups" soit activé dans Supabase Auth settings.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} — { user: { id, email } }
 */
async function sbCreerCompte(email, password) {
  const rep = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method:  'POST',
    headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  if (!rep.ok) {
    const err = await rep.json().catch(() => ({}));
    throw new Error(err.msg || err.error_description || 'Erreur création du compte.');
  }
  return rep.json();
}

/**
 * Change le mot de passe de l'utilisateur connecté.
 * @param {string} nouveauMdp
 */
async function sbChangerMotDePasse(nouveauMdp) {
  const rep = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method:  'PUT',
    headers: _entetes(),
    body:    JSON.stringify({ password: nouveauMdp }),
  });
  if (!rep.ok) {
    const err = await rep.json().catch(() => ({}));
    throw new Error(err.msg || 'Erreur changement de mot de passe.');
  }
  return rep.json();
}

/** Indique si un token valide est présent en mémoire. */
function sbHasToken() {
  return !!_accessToken;
}

// ═══════════════════════════════════════════════════════
//  FONCTIONS CRUD GÉNÉRIQUES
// ═══════════════════════════════════════════════════════

/**
 * Lit tous les enregistrements d'une table.
 * @param {string} table
 * @returns {Promise<Array>}
 */
async function sbLire(table) {
  const rep = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: _entetes(),
  });
  if (!rep.ok) throw new Error(`Erreur lecture ${table} : ${rep.status}`);
  return rep.json();
}

/**
 * Insère un enregistrement dans une table.
 * @param {string} table
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function sbInserer(table, data) {
  const rep = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: _entetes(),
    body:    JSON.stringify(data),
  });
  if (!rep.ok) {
    const err = await rep.text();
    throw new Error(`Erreur insertion ${table} : ${err}`);
  }
  const result = await rep.json();
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Met à jour un enregistrement identifié par son id.
 * @param {string} table
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function sbMettreAJour(table, id, data) {
  const rep = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method:  'PATCH',
    headers: _entetes(),
    body:    JSON.stringify(data),
  });
  if (!rep.ok) {
    const err = await rep.text();
    throw new Error(`Erreur mise à jour ${table} : ${err}`);
  }
  const result = await rep.json();
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Supprime un enregistrement identifié par son id.
 * @param {string} table
 * @param {string} id
 * @returns {Promise<void>}
 */
async function sbSupprimer(table, id) {
  const rep = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method:  'DELETE',
    headers: _entetes({ Prefer: 'return=minimal' }),
  });
  if (!rep.ok) {
    const err = await rep.text();
    throw new Error(`Erreur suppression ${table} : ${err}`);
  }
}

/**
 * Upsert — insère ou met à jour selon l'id.
 * @param {string} table
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function sbUpsert(table, data) {
  const rep = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: _entetes({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body:    JSON.stringify(data),
  });
  if (!rep.ok) {
    const err = await rep.text();
    throw new Error(`Erreur upsert ${table} : ${err}`);
  }
  const result = await rep.json();
  return Array.isArray(result) ? result[0] : result;
}

// ═══════════════════════════════════════════════════════
//  HISTORIQUE DES BARRES
// ═══════════════════════════════════════════════════════

/**
 * Lit l'historique d'une barre identifiée par son id.
 * @param {string} barreId
 * @returns {Promise<Array>}
 */
async function sbLireHistoriqueParBarre(barreId) {
  const rep = await fetch(
    `${SUPABASE_URL}/rest/v1/lbf_barres_historique?barre_id=eq.${encodeURIComponent(barreId)}&order=date_operation.asc`,
    { headers: _entetes() }
  );
  if (!rep.ok) throw new Error(`Erreur lecture historique ${barreId} : ${rep.status}`);
  return rep.json();
}

/**
 * Insère une entrée dans la table lbf_barres_historique.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function sbInsererHistorique(data) {
  const rep = await fetch(`${SUPABASE_URL}/rest/v1/lbf_barres_historique`, {
    method:  'POST',
    headers: _entetes(),
    body:    JSON.stringify(data),
  });
  if (!rep.ok) {
    const err = await rep.text();
    throw new Error(`Erreur insertion historique : ${err}`);
  }
  const result = await rep.json();
  return Array.isArray(result) ? result[0] : result;
}

// ═══════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════

window.SB = {
  // Auth
  login:               sbLogin,
  logout:              sbLogout,
  creerCompte:         sbCreerCompte,
  changerMotDePasse:   sbChangerMotDePasse,
  hasToken:            sbHasToken,
  // CRUD
  lire:                sbLire,
  inserer:             sbInserer,
  mettreAJour:         sbMettreAJour,
  supprimer:           sbSupprimer,
  upsert:              sbUpsert,
  // Historique
  lireHistoriqueParBarre: sbLireHistoriqueParBarre,
  insererHistorique:      sbInsererHistorique,
};
