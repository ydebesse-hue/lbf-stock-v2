// =============================================================
// LBF Stock v2 — Utilitaires partagés
// =============================================================

const utils = {
  // ── Cryptographie ─────────────────────────────────────────

  /**
   * Hash SHA-256 d'une chaîne (via WebCrypto natif)
   * @param {string} str
   * @returns {Promise<string>} — hex 64 caractères
   */
  async hashPassword(str) {
    const buf  = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(str)
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  // ── Formatage ──────────────────────────────────────────────

  /**
   * Formater un poids en kg avec unité (kg ou t)
   * @param {number} kg
   * @returns {string}
   */
  formatPoids(kg) {
    if (kg === null || kg === undefined || isNaN(kg)) return '—';
    if (kg >= 1000) return `${(kg / 1000).toFixed(3)} t`;
    return `${kg.toFixed(1)} kg`;
  },

  /**
   * Formater une longueur en mètres
   * @param {number} m
   * @returns {string}
   */
  formatLongueur(m) {
    if (m === null || m === undefined || isNaN(m)) return '—';
    return `${m.toFixed(2)} m`;
  },

  /**
   * Formater une date ISO en date française
   * @param {string} iso — YYYY-MM-DD ou ISO 8601
   * @returns {string}
   */
  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', {
      day:   '2-digit',
      month: '2-digit',
      year:  'numeric'
    });
  },

  /**
   * Formater une date + heure
   */
  formatDateHeure(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('fr-FR', {
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit'
    });
  },

  // ── Génération d'ID ───────────────────────────────────────

  /**
   * Générer un ID de barre unique basé sur le timestamp
   * Format : BAR-XXXXXXXX
   */
  genIdBarre() {
    const ts = Date.now().toString(36).toUpperCase().padStart(8, '0');
    return `${APP_CONFIG.prefixeProfil}-${ts}`;
  },

  /**
   * Générer un ID de tôle unique
   */
  genIdTole() {
    const ts = Date.now().toString(36).toUpperCase().padStart(8, '0');
    return `${APP_CONFIG.prefixeTole}-${ts}`;
  },

  // ── DOM ───────────────────────────────────────────────────

  /**
   * Afficher un message flash (succès, erreur, info)
   * @param {string} msg
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {number} duration — ms avant disparition (0 = permanent)
   */
  flash(msg, type = 'info', duration = 4000) {
    let zone = document.getElementById('flashZone');
    if (!zone) {
      zone = document.createElement('div');
      zone.id = 'flashZone';
      zone.className = 'flash-zone';
      document.body.appendChild(zone);
    }

    const el = document.createElement('div');
    el.className = `flash flash-${type}`;
    el.textContent = msg;

    // Bouton fermer
    const btn = document.createElement('button');
    btn.className = 'flash-close';
    btn.textContent = '×';
    btn.onclick = () => el.remove();
    el.appendChild(btn);

    zone.appendChild(el);

    if (duration > 0) {
      setTimeout(() => {
        el.classList.add('flash-fade');
        setTimeout(() => el.remove(), 400);
      }, duration);
    }
  },

  /**
   * Afficher/masquer un spinner de chargement sur un bouton
   * @param {HTMLButtonElement} btn
   * @param {boolean} loading
   */
  btnLoading(btn, loading) {
    if (loading) {
      btn.disabled = true;
      btn._origText = btn.textContent;
      btn.textContent = 'Chargement…';
    } else {
      btn.disabled = false;
      btn.textContent = btn._origText || btn.textContent;
    }
  },

  /**
   * Créer un élément <option> pour un <select>
   */
  option(value, label, selected = false) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    o.selected = selected;
    return o;
  },

  // ── Tableaux / Données ────────────────────────────────────

  /**
   * Trier un tableau d'objets par un champ
   * @param {Array} arr
   * @param {string} key
   * @param {boolean} asc
   */
  sortBy(arr, key, asc = true) {
    return [...arr].sort((a, b) => {
      const va = a[key] ?? '';
      const vb = b[key] ?? '';
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ?  1 : -1;
      return 0;
    });
  },

  /**
   * Debounce — éviter les appels trop fréquents (ex: recherche)
   * @param {Function} fn
   * @param {number} wait — ms
   */
  debounce(fn, wait = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  // ── Validation ────────────────────────────────────────────

  /**
   * Vérifier qu'un nombre est positif et fini
   */
  isPositiveNumber(val) {
    const n = parseFloat(val);
    return isFinite(n) && n > 0;
  },

  /**
   * Sanitiser une chaîne pour affichage HTML (anti-XSS basique)
   * Utiliser textContent de préférence — cette fn est un dernier recours
   */
  escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  // ── Labels localisés ─────────────────────────────────────

  labelDisponibilite(val) {
    const map = {
      disponible: 'Disponible',
      reserve:    'Réservé',
      sorti:      'Sorti',
    };
    return map[val] || val;
  },

  labelStatut(val) {
    const map = {
      valide:     'Validé',
      en_attente: 'En attente',
      rejete:     'Rejeté',
      archive:    'Archivé',
    };
    return map[val] || val;
  },

  labelRole(val) {
    const map = {
      consultation:   'Consultation',
      gestion:        'Gestion',
      administration: 'Administration',
    };
    return map[val] || val;
  },

  labelStatutDemande(val) {
    const map = {
      en_attente: 'En attente',
      approuvee:  'Approuvée',
      refusee:    'Refusée',
      annulee:    'Annulée',
    };
    return map[val] || val;
  },
};
