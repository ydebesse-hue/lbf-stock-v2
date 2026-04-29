/**
 * stock.js — Module Stock Métallerie Le Bras Frères
 * Conv. 5 — Formulaires, modales et persistance localStorage
 *
 * SOMMAIRE (Ctrl+G pour aller à la ligne)
 * ─────────────────────────────────────────────────────────
 *   L.  23  CONSTANTES
 *   L. 162  ÉTAT INTERNE
 *   L. 183  INITIALISATION
 *   L. 292  PERSISTANCE LOCALSTORAGE
 *   L. 440  VISIBILITÉ DES COLONNES
 *   L. 476  FILTRAGE
 *   L. 587  TRI
 *   L. 625  RENDU DU TABLEAU
 *   L. 854  HELPERS CALCUL
 *   L. 893  BADGES ET BOUTONS LIGNE
 *   L. 962  PEUPLEMENT DES FILTRES
 *   L.1078  SYNTHÈSE
 *   L.1333  ONGLETS
 *   L.1384  COMPTEUR ET ALERTE
 *   L.1417  ÉVÉNEMENTS PRINCIPAUX
 *   L.1621  INITIALISATION DES MODALES
 *   L.1899  MODALE AJOUT PROFILÉ
 *   L.2422  MODALE AJOUT TÔLE
 *   L.2543  MODALE MODIFICATION
 *   L.2971  MODALE DEMANDE D'ATTRIBUTION
 *   L.3063  MODALE DÉTAIL TÔLE
 *   L.3115  ACTIONS PUBLIQUES
 *   L.3236  VALIDATION ADMIN
 *   L.3596  HISTORIQUE DES BARRES
 *   L.3724  HELPERS MODALES
 *   L.4268  UTILITAIRES INTERNES
 *   L.4309  PLAN DE STOCKAGE
 *   L.4451  SUPPRESSION D'UNE BARRE
 *   L.4522  ZOOM IMAGE FICHE SECTION
 *   L.4579  EXPORT / IMPORT CSV
 *   L.4836  NAVIGATION STOCK ↔ ADMINISTRATION
 *   L.4900  ADMIN STOCKAGE
 *   L.5006  ADMIN CHANTIERS
 *   L.5189  API PUBLIQUE (return)
 * ─────────────────────────────────────────────────────────
 * Dépendance : auth/auth.js doit être chargé avant ce fichier
 *
 * IDs HTML utilisés :
 *  Profilés : p-type, p-desig, p-chantier, p-lieu, p-dispo, p-recherche
 *  Tôles    : t-epaisseur, t-chantier, t-lieu, t-dispo, t-recherche
 *  Communs  : tableau-stock, stock-compteur, stock-notif, stock-alerte-attente
 *             toolbar-profils, toolbar-toles
 *             btn-ajout-profil, btn-ajout-tole, btn-ajout-tole-tab
 *             btn-reset-profils, btn-reset-toles
 *
 * Persistance : localStorage, clé 'lbf_stock_modifs'
 *   Structure identique à stock.json pour migration SharePoint (Conv. 7)
 *   Les modifications locales priment sur stock.json
 */

'use strict';

const Stock = (() => {

  /* ──────────────────────────────────────────────────────────────
     CONSTANTES
     ────────────────────────────────────────────────────────────── */

  /** Clé localStorage pour les modifications locales */
  const CLE_LOCAL = 'lbf_stock_modifs';

  /** Clé localStorage pour les demandes d'attribution */
  const CLE_DEMANDES = 'lbf_demandes';

  /** Densité acier (kg/dm³) pour calcul poids tôle */
  const DENSITE_ACIER = 7.85;

  /** Lieux de stockage — chargés depuis Supabase, fallback codé en dur */
  const LIEUX_DEFAUT = ['Rack 1', 'Rack 2', 'Rack 3', 'Rack 4', 'Extérieur', 'Autre'];

  /** Classes acier disponibles */
  const CLASSES_ACIER = ['S235', 'S275', 'S355', 'S420', 'S460', 'S690'];

  /** Clé localStorage pour la visibilité des colonnes profilés */
  const CLE_COLS_PROFILS = 'lbf-stock-cols-profils';

  /** Définition des colonnes du tableau profilés */
  const COLS_PROFILS = [
    { key: 'id',          label: 'ID',              tri: 'id',          defaut: true  },
    { key: 'type',        label: 'Type',            tri: 'type',        defaut: true  },
    { key: 'designation', label: 'Désignation',     tri: 'designation', defaut: true  },
    { key: 'longueur',    label: 'Longueur (m)',    tri: 'longueur',    defaut: true  },
    { key: 'poids',       label: 'Poids (kg)',      tri: 'poids',       defaut: true  },
    { key: 'classe',      label: 'Classe',          tri: null,          defaut: true  },
    { key: 'dispo',       label: 'Statut',          tri: 'dispo',       defaut: true  },
    { key: 'date',        label: 'Dernière modif.', tri: 'date',        defaut: true  },
    { key: 'chantier',    label: 'Chantier',        tri: 'chantier',    defaut: true  },
    { key: 'lieu',        label: 'Stockage',        tri: 'lieu',        defaut: true  },
    { key: 'origine',     label: 'Origine',         tri: null,          defaut: false },
    { key: 'ref_cmd',     label: 'Réf. commande',   tri: null,          defaut: false },
    { key: 'fournisseur', label: 'Fournisseur',     tri: null,          defaut: false },
    { key: 'ajoute_par',  label: 'Ajouté par',      tri: null,          defaut: false },
    { key: 'commentaire', label: 'Commentaire',     tri: null,          defaut: false },
  ];

  /** Colonnes visibles en mode "Essentiel" */
  const COLS_ESSENTIELLES = new Set(['id','type','designation','longueur','dispo','chantier','lieu']);

  /** Colonnes éditables inline dans le tableau profilés */
  const COLS_EDITABLES_PROFIL = new Set(['longueur', 'lieu', 'dispo', 'chantier', 'commentaire']);

  /** Clé localStorage pour le mode de vue du tableau profilés */
  const CLE_VUE_PROFILS = 'lbf-stock-vue-profils';

  /** Définition des colonnes du tableau tôles */
  const COLS_TOLES = [
    { key: 'id',         label: 'ID',             tri: 'id',         defaut: true  },
    { key: 'type',       label: 'Type',           tri: 'type',       defaut: true  },
    { key: 'epaisseur',  label: 'Épaisseur (mm)', tri: 'epaisseur',  defaut: true  },
    { key: 'dimensions', label: 'Dimensions',     tri: 'dimensions', defaut: true  },
    { key: 'surf_unit',  label: 'Surface unit.',  tri: 'surf_unit',  defaut: true  },
    { key: 'quantite',   label: 'Quantité',       tri: 'quantite',   defaut: true  },
    { key: 'surf_tot',   label: 'Surface tot.',   tri: 'surf_tot',   defaut: true  },
    { key: 'poids',      label: 'Poids (kg)',     tri: 'poids',      defaut: false },
    { key: 'lieu',       label: 'Stockage',       tri: 'lieu',       defaut: true  },
    { key: 'date',       label: 'Date ajout',     tri: 'date',       defaut: false },
    { key: 'chantier',   label: 'Chantier',       tri: 'chantier',   defaut: true  },
    { key: 'dispo',      label: 'Statut',         tri: 'dispo',      defaut: true  },
    { key: 'ref_cmd',    label: 'Réf. commande',  tri: null,         defaut: false },
  ];

  const COLS_ESSENTIELLES_TOLES = new Set(['id','type','epaisseur','dimensions','surf_unit','quantite','surf_tot','lieu','chantier','dispo']);

  const CLE_VUE_TOLES  = 'lbf-stock-vue-toles';
  const CLE_COLS_TOLES = 'lbf-stock-cols-toles';

  /** Clé localStorage pour l'image du plan de stockage (base64) */
  const CLE_PLAN_IMG = 'lbf_plan_image';

  // ── Configuration email (EmailJS) ───────────────────────────────
  // Renseigner ces valeurs après création d'un compte sur emailjs.com
  const EMAILJS_PUBLIC_KEY       = '';  // clé publique EmailJS
  const EMAILJS_SERVICE_ID       = '';  // ID du service (ex. 'service_abc123')
  const EMAILJS_TPL_ACCEPTATION  = '';  // ID template acceptation
  const EMAILJS_TPL_REFUS        = '';  // ID template refus

  /** Clé localStorage pour les positions des racks sur le plan { rackId: {x,y} } */
  const CLE_PLAN_POS = 'lbf_plan_positions';

  /** Plan provisoire embarqué en data URL — indépendant du serveur de fichiers */
  const PLAN_PROVISOIRE_SRC = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 520" font-family="Tahoma,Geneva,sans-serif">
  <rect width="820" height="520" fill="#f0f0f0"/>
  <rect x="14" y="14" width="792" height="492" fill="white" stroke="#b0b0b0" stroke-width="2.5" stroke-dasharray="10,5" rx="6"/>
  <text x="410" y="44" text-anchor="middle" font-size="12" fill="#999" font-weight="bold" letter-spacing="3">PLAN PROVISOIRE — ATELIER LBF</text>
  <g transform="translate(30,145)">
    <text x="0" y="0" font-size="22" font-weight="bold" fill="#2d5f32">A</text>
    <text x="0" y="18" font-size="11" fill="#2d5f32">allée</text>
    <line x1="26" y1="-9" x2="58" y2="-9" stroke="#2d5f32" stroke-width="2.5"/>
    <polygon points="58,-13 68,-9 58,-5" fill="#2d5f32"/>
  </g>
  <g transform="translate(100,75)">
    <rect width="170" height="150" rx="5" fill="#e8f5ea" stroke="#2d5f32" stroke-width="2.5"/>
    <line x1="10" y1="50" x2="160" y2="50" stroke="#2d5f32" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>
    <line x1="10" y1="100" x2="160" y2="100" stroke="#2d5f32" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>
    <rect x="0" y="0" width="22" height="150" rx="3" fill="#2d5f32" fill-opacity=".12"/>
    <text x="11" y="80" text-anchor="middle" font-size="11" font-weight="bold" fill="#2d5f32">A</text>
    <text x="96" y="80" text-anchor="middle" font-size="18" font-weight="bold" fill="#2d5f32">RACK 1</text>
    <text x="158" y="30" text-anchor="end" font-size="10" fill="#888">ét. 1</text>
    <text x="158" y="80" text-anchor="end" font-size="10" fill="#888">ét. 2</text>
    <text x="158" y="130" text-anchor="end" font-size="10" fill="#888">ét. 3</text>
  </g>
  <g transform="translate(320,75)">
    <rect width="170" height="150" rx="5" fill="#e8f5ea" stroke="#2d5f32" stroke-width="2.5"/>
    <line x1="10" y1="50" x2="160" y2="50" stroke="#2d5f32" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>
    <line x1="10" y1="100" x2="160" y2="100" stroke="#2d5f32" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>
    <rect x="0" y="0" width="22" height="150" rx="3" fill="#2d5f32" fill-opacity=".12"/>
    <text x="11" y="80" text-anchor="middle" font-size="11" font-weight="bold" fill="#2d5f32">A</text>
    <text x="96" y="80" text-anchor="middle" font-size="18" font-weight="bold" fill="#2d5f32">RACK 2</text>
    <text x="158" y="30" text-anchor="end" font-size="10" fill="#888">ét. 1</text>
    <text x="158" y="80" text-anchor="end" font-size="10" fill="#888">ét. 2</text>
    <text x="158" y="130" text-anchor="end" font-size="10" fill="#888">ét. 3</text>
  </g>
  <g transform="translate(540,75)">
    <rect width="170" height="150" rx="5" fill="#e8f5ea" stroke="#2d5f32" stroke-width="2.5"/>
    <line x1="10" y1="50" x2="160" y2="50" stroke="#2d5f32" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>
    <line x1="10" y1="100" x2="160" y2="100" stroke="#2d5f32" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>
    <rect x="0" y="0" width="22" height="150" rx="3" fill="#2d5f32" fill-opacity=".12"/>
    <text x="11" y="80" text-anchor="middle" font-size="11" font-weight="bold" fill="#2d5f32">A</text>
    <text x="96" y="80" text-anchor="middle" font-size="18" font-weight="bold" fill="#2d5f32">RACK 3</text>
    <text x="158" y="30" text-anchor="end" font-size="10" fill="#888">ét. 1</text>
    <text x="158" y="80" text-anchor="end" font-size="10" fill="#888">ét. 2</text>
    <text x="158" y="130" text-anchor="end" font-size="10" fill="#888">ét. 3</text>
  </g>
  <line x1="40" y1="262" x2="780" y2="262" stroke="#ccc" stroke-width="1.5" stroke-dasharray="6,4"/>
  <text x="410" y="277" text-anchor="middle" font-size="10" fill="#bbb" letter-spacing="2">ZONE EXTÉRIEURE</text>
  <g transform="translate(100,292)">
    <rect width="245" height="90" rx="5" fill="#fff3e0" stroke="#e65100" stroke-width="2.5"/>
    <line x1="0" y1="0" x2="30" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="40" y1="0" x2="70" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="80" y1="0" x2="110" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="120" y1="0" x2="150" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="160" y1="0" x2="190" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="200" y1="0" x2="230" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <text x="122" y="52" text-anchor="middle" font-size="20" font-weight="bold" fill="#e65100">EXT 1</text>
  </g>
  <g transform="translate(400,292)">
    <rect width="245" height="90" rx="5" fill="#fff3e0" stroke="#e65100" stroke-width="2.5"/>
    <line x1="0" y1="0" x2="30" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="40" y1="0" x2="70" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="80" y1="0" x2="110" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="120" y1="0" x2="150" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="160" y1="0" x2="190" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <line x1="200" y1="0" x2="230" y2="90" stroke="#e65100" stroke-width=".8" opacity=".2"/>
    <text x="122" y="52" text-anchor="middle" font-size="20" font-weight="bold" fill="#e65100">EXT 2</text>
  </g>
  <g transform="translate(40,425)">
    <rect width="14" height="14" rx="2" fill="#e8f5ea" stroke="#2d5f32" stroke-width="1.5"/>
    <text x="20" y="11" font-size="11" fill="#555">Rack (stockage intérieur)</text>
    <rect x="200" width="14" height="14" rx="2" fill="#fff3e0" stroke="#e65100" stroke-width="1.5"/>
    <text x="220" y="11" font-size="11" fill="#555">Zone extérieure</text>
  </g>
  <text x="410" y="500" text-anchor="middle" font-size="10" fill="#bbb" font-style="italic">Plan provisoire — remplacer par le plan réel dans Administration › Stockage</text>
</svg>`);


  /* ──────────────────────────────────────────────────────────────
     ÉTAT INTERNE
     ────────────────────────────────────────────────────────────── */

  let _data      = null;        // données fusionnées (stock.json + localStorage)
  let _sections  = null;        // données de sections.json (pour les modales)
  let _sectionActive = 'stock';  // 'stock' | 'admin'
  let _ongletAdmin   = 'stockage';
  let _onglet        = 'synthese';
  let _synTab        = 'profils';
  let _synProfilsTous = false;
  let _bilanChantier  = '';
  let _racks     = [];  // { id, nom, nb_allees, nb_etages } depuis Supabase
  let _lieux     = [...LIEUX_DEFAUT]; // calculés depuis _racks
  let _chantiers    = [];  // { id, nom, numero_affaire, ville } depuis Supabase
  let _fournisseurs = [];  // { id, nom } depuis Supabase
  let _demandeurs   = [];  // { id, nom, prenom, email } depuis Supabase
  let _tri       = { col: null, ordre: 'asc' };
  let _selection = null;        // élément sélectionné (partagé avec les modales)
  let _demandes  = [];          // demandes en_attente chargées depuis Supabase (Conv. 6)
  let _demandCompteur = 0;      // compteur max des IDs DEM-XXXX connus (Supabase + localStorage)
  let _planImg   = null;        // image plan (base64), chargée au démarrage depuis Supabase
  let _planPos   = {};          // positions racks sur le plan {rackId:{x,y}}, chargées au démarrage
  let _filtreEnAttente = false; // true quand l'admin clique l'alerte pour voir les en_attente
  let _seuils = {};             // { [epaisseur_mm]: seuil_m2 } — définis depuis la synthèse, stockés en localStorage

  const _SEUILS_STORAGE_KEY = 'lbf_seuils_toles';

  function _chargerSeuils() {
    try {
      const raw = localStorage.getItem(_SEUILS_STORAGE_KEY);
      _seuils = raw ? JSON.parse(raw) : {};
    } catch { _seuils = {}; }
  }

  function _sauvegarderSeuil(ep, valeur) {
    const v = parseFloat(valeur);
    if (isNaN(v) || v <= 0) {
      delete _seuils[ep];
    } else {
      _seuils[ep] = v;
    }
    try { localStorage.setItem(_SEUILS_STORAGE_KEY, JSON.stringify(_seuils)); } catch { /* rien */ }
  }


  /* ──────────────────────────────────────────────────────────────
     INITIALISATION
     ────────────────────────────────────────────────────────────── */

  /**
   * Point d'entrée — appelé au DOMContentLoaded
   */
  async function init() {
    Auth.requireAuth();
    Auth.afficherInfosSession('#header-user', '#header-badge');
    Auth.appliquerDroitsDOM();
    _chargerSeuils();

    try {
      // Chargement stock depuis Supabase
      let barres = [];
      try {
        barres = await window.SB.lire('stock');
      } catch(e) {
        console.warn('[Stock] Supabase indisponible, fallback JSON :', e);
        const rep = await fetch('../data/stock.json');
        if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
        const json = await rep.json();
        barres = json.barres || [];
      }

      // Calculer le compteur depuis les IDs existants
      const nums = barres.map(b => parseInt((b.id||'').replace(/[^0-9]/g,''),10)).filter(n=>!isNaN(n));
      const compteur = nums.length ? Math.max(...nums) : 0;
      _data = { barres, compteur };

      // Charger les sections — sections.json toujours en base, Supabase complète
      let sectionsJson = null;
      try {
        const repSec = await fetch('../data/sections.json');
        if (repSec.ok) sectionsJson = await repSec.json();
      } catch(e2) { /* ignoré */ }

      try {
        const rows = await window.SB.lire('sections', { order: 'sort_order' });
        _sections = _sectionsFromRows(rows);
        // Ajouter les familles absentes de Supabase depuis sections.json
        if (sectionsJson) {
          sectionsJson.standard.forEach(famJson => {
            if (!_sections.standard.find(f => f.famille === famJson.famille)) {
              _sections.standard.push(famJson);
            }
          });
        }
      } catch(e) {
        _sections = sectionsJson || { standard: [], custom: [] };
      }

      // Charger les demandes depuis Supabase (toutes, pour calculer le compteur max)
      try {
        const demandes = await window.SB.lire('demandes');
        const nums = demandes.map(d => parseInt((d.id||'').replace(/[^0-9]/g,''), 10)).filter(n => !isNaN(n));
        _demandCompteur = nums.length ? Math.max(...nums) : 0;
        _demandes = demandes.filter(d => d.statut === 'en_attente');
      } catch(e) {
        const store = _chargerDemandes();
        _demandCompteur = store.compteur || 0;
        _demandes = store.demandes.filter(d => d.statut === 'en_attente');
      }

      // Charger les référentiels administrables
      try {
        const rows = await window.SB.lire('racks', { order: 'created_at' });
        _racks = rows.filter(r => r.actif);
        if (_racks.length) _lieux = _majLieux();
      } catch(e) { /* garde LIEUX_DEFAUT */ }
      try {
        const rows = await window.SB.lire('chantiers', { order: 'nom' });
        _chantiers = rows.filter(c => c.actif);
      } catch(e) {}
      try {
        const rows = await window.SB.lire('fournisseurs', { order: 'nom' });
        _fournisseurs = rows.filter(f => f.actif);
      } catch(e) {}
      try {
        const rows = await window.SB.lire('demandeurs', { order: 'nom' });
        _demandeurs = rows.filter(d => d.actif);
      } catch(e) {}

      // Charger les données du plan (positions + image) depuis Supabase
      await _chargerDonnesPlan();

    } catch (err) {
      _erreurChargement(err.message);
      return;
    }

    _peuplerFiltres();
    _filtrer();
    _majAlerteAttente();
    _majDatalistChantiers();
    _attacherEvenements();
    _initialiserModales();

    // Rafraîchissement automatique des demandes pour les admins
    if (Auth.hasRight('can_validate')) {
      setInterval(async () => {
        try {
          const demandes = await window.SB.lire('demandes');
          const nouvelles = demandes.filter(d => d.statut === 'en_attente');
          const avant = _demandes.length;
          _demandes = nouvelles;
          if (nouvelles.length !== avant) {
            _filtrer();
            _majAlerteAttente();
          }
        } catch(e) {}
      }, 30000);
    }
  }


  /* ──────────────────────────────────────────────────────────────
     PERSISTANCE LOCALSTORAGE
     ────────────────────────────────────────────────────────────── */

  /**
   * Charge les modifications stockées en local
   * @returns {Object} { barres: [], compteur: 0 }
   */
  function _chargerLocal() {
    try {
      const raw = localStorage.getItem(CLE_LOCAL);
      return raw ? JSON.parse(raw) : { barres: [], compteur: 0 };
    } catch (e) {
      return { barres: [], compteur: 0 };
    }
  }

  /**
   * Sauvegarde les modifications locales
   * @param {Object} local — { barres: [], compteur: 0 }
   */
  function _sauvegarderLocal(local) {
    try {
      localStorage.setItem(CLE_LOCAL, JSON.stringify(local));
    } catch (e) {
      console.error('Impossible de sauvegarder dans localStorage :', e);
    }
  }

  /**
   * Fusionne stock.json avec les modifications locales
   * Les modifications locales priment (même id → local remplace JSON)
   * Les nouveaux éléments locaux (id absent de JSON) sont ajoutés
   * @param {Object} stockJson — données brutes de stock.json
   * @returns {Object} données fusionnées
   */
  function _fusionnerAvecLocal(stockJson) {
    const local = _chargerLocal();
    if (!local.barres.length) return stockJson;

    const fusion = { ...stockJson };

    // Remplacer ou ajouter les barres locales
    local.barres.forEach(barreLocale => {
      const idx = fusion.barres.findIndex(b => b.id === barreLocale.id);
      if (idx !== -1) {
        fusion.barres[idx] = barreLocale; // remplacement
      } else {
        fusion.barres.push(barreLocale);  // nouvel ajout
      }
    });

    // Mettre à jour le compteur si le local est plus grand
    if (local.compteur > fusion.compteur) {
      fusion.compteur = local.compteur;
    }

    return fusion;
  }

  /**
   * Génère un nouvel ID pour un profilé (BAR-XXXX)
   * @returns {string}
   */
  function _genererIdBarre() {
    const nums = _data.barres
      .filter(b => b.id && b.id.startsWith('BAR-'))
      .map(b => parseInt(b.id.replace('BAR-',''), 10))
      .filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `BAR-${String(max + 1).padStart(4, '0')}`;
  }

  /**
   * Génère un nouvel ID pour une tôle (TOL-XXXX)
   * @returns {string}
   */
  function _genererIdTole() {
    const nums = _data.barres
      .filter(b => b.id && b.id.startsWith('TOL-'))
      .map(b => parseInt(b.id.replace('TOL-',''), 10))
      .filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `TOL-${String(max + 1).padStart(4, '0')}`;
  }

  /**
   * Persiste un élément (ajout ou modification) dans Supabase
   * Fallback localStorage si Supabase indisponible
   * @param {Object} element — objet barre ou tôle
   */
  async function _persisterElement(element) {
    // Mettre à jour _data en mémoire immédiatement
    const idxData = _data.barres.findIndex(b => b.id === element.id);
    if (idxData !== -1) {
      _data.barres[idxData] = element;
    } else {
      _data.barres.push(element);
    }

    // Persister dans Supabase
    try {
      await window.SB.upsert('stock', element);
      return true; // ✅ sauvegardé en base
    } catch(e) {
      console.warn('[Stock] Supabase indisponible, fallback localStorage :', e);
      // Fallback localStorage
      const local = _chargerLocal();
      const idx = local.barres.findIndex(b => b.id === element.id);
      if (idx !== -1) { local.barres[idx] = element; } else { local.barres.push(element); }
      _sauvegarderLocal(local);
      return false; // ⚠ sauvegardé localement uniquement
    }
  }

  /**
   * Charge les demandes d'attribution depuis localStorage
   * @returns {Object} { demandes: [], compteur: 0 }
   */
  function _chargerDemandes() {
    try {
      const raw = localStorage.getItem(CLE_DEMANDES);
      return raw ? JSON.parse(raw) : { demandes: [], compteur: 0 };
    } catch (e) {
      return { demandes: [], compteur: 0 };
    }
  }

  /**
   * Persiste une demande d'attribution dans Supabase
   * Fallback localStorage si Supabase indisponible
   * @param {Object} demande
   */
  async function _persisterDemande(demande) {
    try {
      await window.SB.upsert('demandes', demande);
      // Synchroniser le compteur localStorage pour la cohérence offline
      try {
        const store = _chargerDemandes();
        store.compteur = _demandCompteur;
        localStorage.setItem(CLE_DEMANDES, JSON.stringify(store));
      } catch {}
      return true; // ✅ sauvegardé en base
    } catch(e) {
      console.warn('[Stock] Supabase indisponible, fallback localStorage demande :', e);
      const store = _chargerDemandes();
      store.demandes.push(demande);
      store.compteur = _demandCompteur;
      try { localStorage.setItem(CLE_DEMANDES, JSON.stringify(store)); } catch {}
      return false; // ⚠ sauvegardé localement uniquement
    }
  }


  /* ──────────────────────────────────────────────────────────────
     VISIBILITÉ DES COLONNES
     ────────────────────────────────────────────────────────────── */

  function _getModeVue() {
    try { return localStorage.getItem(CLE_VUE_PROFILS) || 'essentiel'; } catch(e) { return 'essentiel'; }
  }

  function _setModeVue(mode) {
    try { localStorage.setItem(CLE_VUE_PROFILS, mode); } catch(e) {}
  }

  function _getModeVueToles() {
    try { return localStorage.getItem(CLE_VUE_TOLES) || 'essentiel'; } catch(e) { return 'essentiel'; }
  }
  function _setModeVueToles(mode) {
    try { localStorage.setItem(CLE_VUE_TOLES, mode); } catch(e) {}
  }
  function _chargerColsVisToles() {
    const mode = _getModeVueToles();
    const vis = {};
    if (mode === 'essentiel') {
      COLS_TOLES.forEach(c => { vis[c.key] = COLS_ESSENTIELLES_TOLES.has(c.key); });
    } else if (mode === 'complet') {
      COLS_TOLES.forEach(c => { vis[c.key] = true; });
    } else {
      try {
        const raw = localStorage.getItem(CLE_COLS_TOLES);
        const saved = raw ? JSON.parse(raw) : {};
        COLS_TOLES.forEach(c => { vis[c.key] = c.key in saved ? saved[c.key] : c.defaut; });
      } catch(e) {
        COLS_TOLES.forEach(c => { vis[c.key] = c.defaut; });
      }
    }
    return vis;
  }
  function _sauverColsVisToles(vis) {
    try { localStorage.setItem(CLE_COLS_TOLES, JSON.stringify(vis)); } catch(e) {}
  }

  function _chargerColsVis() {
    const mode = _getModeVue();
    const vis = {};
    if (mode === 'essentiel') {
      COLS_PROFILS.forEach(c => { vis[c.key] = COLS_ESSENTIELLES.has(c.key); });
    } else if (mode === 'complet') {
      COLS_PROFILS.forEach(c => { vis[c.key] = true; });
    } else {
      // personnalise
      try {
        const raw = localStorage.getItem(CLE_COLS_PROFILS);
        const saved = raw ? JSON.parse(raw) : {};
        COLS_PROFILS.forEach(c => { vis[c.key] = c.key in saved ? saved[c.key] : c.defaut; });
      } catch(e) {
        COLS_PROFILS.forEach(c => { vis[c.key] = c.defaut; });
      }
    }
    return vis;
  }

  function _sauverColsVis(vis) {
    try { localStorage.setItem(CLE_COLS_PROFILS, JSON.stringify(vis)); } catch(e) {}
  }

  /* ──────────────────────────────────────────────────────────────
     FILTRAGE
     ────────────────────────────────────────────────────────────── */

  function _filtrer() {
    if (!_data) return;
    if (_onglet === 'synthese') { _rendreSynthese(); return; }

    // Récupérer le profil courant pour masquer les éléments refusés
    const session = window.Auth ? window.Auth.getSession() : null;
    const profil  = session ? session.profil : 'consultation';
    const voirRefus = (profil === 'administration');

    let source;
    if (_onglet === 'archivees') {
      // Onglet archivées : tous éléments avec statut archivee (profils + tôles)
      source = _data.barres.filter(b => b.statut === 'archivee');
    } else {
      // Onglets actifs : exclure les archivées et masquer les refusés selon le profil
      source = _data.barres.filter(b => {
        if (b.statut === 'archivee') return false;
        if (!voirRefus && b.statut === 'refuse') return false;
        return _onglet === 'profils' ? b.categorie === 'profil' : b.categorie === 'tole';
      });
    }

    let resultats;
    if (_onglet === 'profils') {
      resultats = _filtrerProfils(source);
    } else if (_onglet === 'toles') {
      resultats = _filtrerToles(source);
    } else {
      resultats = _filtrerArchivees(source);
    }

    if (_tri.col) {
      resultats = _trier(resultats);
    } else if (_onglet === 'toles') {
      // Tri par défaut : épaisseur croissante puis type
      resultats = [...resultats].sort((a, b) => {
        const ep = (a.epaisseur_mm || 0) - (b.epaisseur_mm || 0);
        if (ep !== 0) return ep;
        return (a.type_tole || '').localeCompare(b.type_tole || '', 'fr');
      });
    }

    _rendrTableau(resultats);
    _majCompteur(resultats.length, source.length);
    _majAlerteSeuil();

    if (_onglet === 'profils')   _peuplerDesignations(_val('p-type'));
    if (_onglet === 'archivees') _peuplerDesignationsArchivees(_val('a-type'));
  }

  function _filtrerProfils(source) {
    const type     = _val('p-type');
    const desig    = _val('p-desig');
    const chantier = _val('p-chantier');
    const lieu     = _val('p-lieu');
    const dispo    = _val('p-dispo');
    const texte    = _val('p-recherche').toLowerCase().trim();

    return source.filter(b => {
      if (_filtreEnAttente) {
        const aDemande = _demandes.some(d => d.id_barre === b.id);
        if (b.statut !== 'en_attente' && !aDemande) return false;
      }
      if (type     && b.section_type     !== type)     return false;
      if (desig    && b.designation      !== desig)    return false;
      if (chantier && b.chantier_affectation !== chantier) return false;
      if (lieu     && b.lieu_stockage    !== lieu)     return false;
      if (dispo    && b.disponibilite    !== dispo)    return false;
      if (texte) {
        const h = [b.section_type, b.designation, b.chantier_origine,
          b.lieu_stockage, b.commentaire, b.id].join(' ').toLowerCase();
        if (!h.includes(texte)) return false;
      }
      return true;
    });
  }

  function _filtrerToles(source) {
    const type     = _val('t-type');
    const epais    = _val('t-epaisseur');
    const chantier = _val('t-chantier');
    const lieu     = _val('t-lieu');
    const dispo    = _val('t-dispo');
    const texte    = _val('t-recherche').toLowerCase().trim();

    return source.filter(b => {
      if (_filtreEnAttente) {
        const aDemande = _demandes.some(d => d.id_barre === b.id);
        if (b.statut !== 'en_attente' && !aDemande) return false;
      }
      if (type     && b.type_tole            !== type)     return false;
      if (epais    && String(b.epaisseur_mm) !== epais)    return false;
      if (chantier && b.chantier_origine     !== chantier) return false;
      if (lieu     && b.lieu_stockage        !== lieu)     return false;
      if (dispo    && b.disponibilite        !== dispo)    return false;
      if (texte) {
        const h = [b.epaisseur_mm, b.largeur_mm, b.longueur_mm,
          b.type_tole, b.ref_commande,
          b.chantier_origine, b.lieu_stockage, b.commentaire, b.id].join(' ').toLowerCase();
        if (!h.includes(texte)) return false;
      }
      return true;
    });
  }

  /**
   * Filtre les barres archivées selon les filtres de l'onglet "Archivées"
   * @param {Array} source — barres avec statut archivee
   * @returns {Array}
   */
  function _filtrerArchivees(source) {
    const type  = _val('a-type');
    const desig = _val('a-desig');
    const texte = _val('a-recherche').toLowerCase().trim();

    return source.filter(b => {
      if (type  && b.section_type !== type)  return false;
      if (desig && b.designation  !== desig) return false;
      if (texte) {
        const h = [b.section_type, b.designation, b.code_barre,
          b.id, b.chantier_origine, b.commentaire].join(' ').toLowerCase();
        if (!h.includes(texte)) return false;
      }
      return true;
    });
  }


  /* ──────────────────────────────────────────────────────────────
     TRI
     ────────────────────────────────────────────────────────────── */

  function _clicTri(col) {
    _tri.ordre = (_tri.col === col && _tri.ordre === 'asc') ? 'desc' : 'asc';
    _tri.col   = col;
    _filtrer();
  }

  function _trier(data) {
    const mult = _tri.ordre === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = _valTri(a), vb = _valTri(b);
      if (typeof va === 'string') return va.localeCompare(vb, 'fr') * mult;
      return (va - vb) * mult;
    });
  }

  function _valTri(item) {
    switch (_tri.col) {
      case 'id':          return item.id               || '';
      case 'type':        return item.section_type     || '';
      case 'designation': return item.designation      || '';
      case 'longueur':    return item.longueur_m       || 0;
      case 'poids':       return item.categorie === 'profil' ? _poidsEffectifProfil(item) : (item.poids_unitaire_kg || 0);
      case 'chantier':    return item.chantier_affectation || '';
      case 'lieu':        return item.lieu_stockage    || '';
      case 'dispo':       return item.disponibilite    || '';
      case 'date':        return item.date_modif || item.date_validation || item.date_ajout || '';
      case 'epaisseur':   return item.epaisseur_mm     || 0;
      case 'dimensions':  return (item.largeur_mm || 0) * 100000 + (item.longueur_mm || 0);
      case 'surf_unit':   return _surfaceTole(item);
      case 'quantite':    return item.quantite         || 0;
      case 'surf_tot':    return _surfaceTole(item) * (item.quantite || 1);
      default:            return '';
    }
  }


  /* ──────────────────────────────────────────────────────────────
     RENDU DU TABLEAU
     ────────────────────────────────────────────────────────────── */

  function _rendrTableau(data) {
    const zone = document.getElementById('tableau-stock');
    if (!zone) return;

    let html;
    if (_onglet === 'profils')        html = _htmlProfils(data);
    else if (_onglet === 'toles')     html = _htmlToles(data);
    else                              html = _htmlArchivees(data);

    zone.innerHTML = html;

    zone.querySelectorAll('thead th[data-col]').forEach(th => {
      th.addEventListener('click', () => _clicTri(th.dataset.col));
    });
  }

  function _htmlProfils(data) {
    const admin = Auth.hasRight('can_validate');
    const modif = Auth.hasRight('can_edit');
    const vis   = _chargerColsVis();
    const nbCols = COLS_PROFILS.filter(c => vis[c.key]).length + 2; // +hist +actions

    let h = '<table class="table-profils"><thead><tr>';
    COLS_PROFILS.forEach(c => {
      if (!vis[c.key]) return;
      const cls   = `col-p-${c.key}`;
      if (c.tri) {
        const actif = _tri.col === c.tri;
        const ind   = actif ? (_tri.ordre === 'asc' ? '▲' : '▼') : '⇅';
        h += `<th class="${cls}${actif ? ' tri-actif' : ''}" data-col="${c.tri}">${c.label} <span class="tri-ind">${ind}</span></th>`;
      } else {
        h += `<th class="${cls}">${c.label}</th>`;
      }
    });
    h += '<th class="col-p-hist">Hist.</th><th class="col-p-actions">Actions</th></tr></thead><tbody>';

    if (!data.length) {
      h += `<tr><td colspan="${nbCols}" class="vide">Aucun profilé ne correspond aux filtres.</td></tr>`;
    } else {
      data.forEach(b => {
        const attente = b.statut === 'en_attente';
        h += `<tr${attente ? ' class="ligne-attente"' : ''} data-id="${_e(b.id)}">`;
        COLS_PROFILS.forEach(c => {
          if (!vis[c.key]) return;
          const ed = modif && COLS_EDITABLES_PROFIL.has(c.key);
          h += `<td class="col-p-${c.key}${ed ? ' cell-editable' : ''}"${ed ? ` data-field="${c.key}"` : ''}>${_cellProfil(c.key, b)}</td>`;
        });
        h += `<td class="col-p-hist"><button class="btn-historique" onclick="Stock.ouvrirHistoriqueBarre('${_e(b.id)}')" title="Historique">📋</button></td>`;
        h += `<td class="col-p-actions">${_actionsLigneProfil(b, modif, admin)}</td>`;
        h += '</tr>';
      });
    }

    return h + '</tbody></table>';
  }

  /** Retourne le contenu HTML d'une cellule du tableau profilés */
  function _cellProfil(key, b) {
    switch (key) {
      case 'id':
        return `<span class="chip-id">${_e(b.id)}</span>`;
      case 'type':
        return `<strong>${_e(b.section_type)}</strong>`;
      case 'designation':
        return `${_e(b.designation)}<button class="btn-inline" onclick="Stock.ouvrirFicheSection('${_e(b.section_type)}','${_e(b.designation)}')" title="Fiche section">🔍</button>`;
      case 'longueur':
        return b.longueur_m.toFixed(2);
      case 'poids': {
        const p = _poidsEffectifProfil(b);
        return p > 0 ? p.toFixed(1) : '—';
      }
      case 'classe':
        return b.classe_acier
          ? `<span class="badge-classe-acier">${_e(b.classe_acier)}</span>`
          : '—';
      case 'dispo':
        return _badgeDispo(b);
      case 'date': {
        const d = b.date_modif || b.date_validation || b.date_ajout;
        return d ? new Date(d).toLocaleDateString('fr-FR') : '—';
      }
      case 'chantier':
        return b.chantier_affectation ? _e(_labelChantier(b.chantier_affectation)) : '—';
      case 'lieu':
        return b.lieu_stockage
          ? `<span class="chip-lieu chip-lieu-btn" data-lieu="${_e(b.lieu_stockage)}" title="Voir sur le plan">${_e(b.lieu_stockage)} <span class="chip-plan-pin">📍</span></span>`
          : '—';
      case 'origine':
        return _e(_labelChantier(b.chantier_origine)) || '—';
      case 'ref_cmd':
        return _e(b.ref_commande) || '—';
      case 'fournisseur':
        return _e(b.fournisseur) || '—';
      case 'ajoute_par':
        return _e(b.ajoute_par) || '—';
      case 'commentaire':
        return `<span title="${_e(b.commentaire || '')}">${_e(b.commentaire) || '—'}</span>`;
      default:
        return '—';
    }
  }

  /**
   * Génère le HTML du tableau des barres archivées (lecture seule)
   * @param {Array} data
   * @returns {string}
   */
  function _htmlArchivees(data) {
    const admin = Auth.hasRight('can_validate');
    const cols = [
      { col: 'id',          label: 'ID'               },
      { col: 'type',        label: 'Type / Catégorie'  },
      { col: 'designation', label: 'Description'       },
      { col: 'longueur',    label: 'Long. / Qté'       },
      { col: 'poids',       label: 'Poids (kg)'        },
      { col: 'lieu',        label: 'Stockage'          },
      { col: 'date',        label: 'Date ajout'        },
      { col: 'chantier',    label: 'Chantier origine'  },
    ];

    let h = '<table><thead><tr>';
    cols.forEach(c => {
      const actif = _tri.col === c.col;
      const ind   = actif ? (_tri.ordre === 'asc' ? '▲' : '▼') : '⇅';
      h += `<th data-col="${c.col}" class="${actif ? 'tri-actif' : ''}">${c.label} <span class="tri-ind">${ind}</span></th>`;
    });
    h += '<th>Actions</th></tr></thead><tbody>';

    if (!data.length) {
      h += `<tr><td colspan="9" class="vide">Aucun élément archivé.</td></tr>`;
    } else {
      data.forEach(b => {
        const dateAjout = b.date_ajout
          ? new Date(b.date_ajout).toLocaleDateString('fr-FR') : '—';

        let typeTxt, descTxt, longQteTxt, poidsTxt;
        if (b.categorie === 'profil') {
          const poidsEff = _poidsEffectifProfil(b);
          typeTxt    = `<strong>${_e(b.section_type)}</strong>`;
          descTxt    = _e(b.designation);
          longQteTxt = typeof b.longueur_m === 'number' ? `${b.longueur_m.toFixed(2)} m` : '—';
          poidsTxt   = poidsEff > 0 ? poidsEff.toFixed(1) : '—';
        } else {
          const poidsU = b.poids_unitaire_kg || 0;
          typeTxt    = `<span style="color:#888">Tôle</span>`;
          descTxt    = `${b.epaisseur_mm} mm · ${b.largeur_mm}×${b.longueur_mm} mm`;
          longQteTxt = `${b.quantite ?? 0} pièce${(b.quantite ?? 0) > 1 ? 's' : ''}`;
          poidsTxt   = poidsU > 0 ? `${poidsU.toFixed(1)} /u` : '—';
        }

        h += `<tr>`;
        h += `<td class="td-id"><span class="chip-id">${_e(b.id)}</span></td>`;
        h += `<td>${typeTxt}</td>`;
        h += `<td>${descTxt}</td>`;
        h += `<td>${longQteTxt}</td>`;
        h += `<td>${poidsTxt}</td>`;
        h += `<td>${_e(b.lieu_stockage || '—')}</td>`;
        h += `<td>${dateAjout}</td>`;
        h += `<td>${_e(_labelChantier(b.chantier_origine) || '—')}</td>`;
        h += `<td class="td-actions">
          ${b.categorie === 'profil' ? `<button class="btn-historique" onclick="Stock.ouvrirHistoriqueBarre('${_e(b.id)}')" title="Voir l'historique">📋</button>` : ''}
          ${admin ? `<button class="btn-ligne btn-supprimer-def" onclick="Stock.ouvrirSuppressionDefinitive('${_e(b.id)}')" title="Supprimer définitivement">🗑</button>` : ''}
        </td>`;
        h += `</tr>`;
      });
    }

    return h + '</tbody></table>';
  }

  const _LABEL_TYPE_TOLE = { noir: 'Noir', inox: 'Inox', larmee: 'Larmée' };
  const _CLASSE_TYPE_TOLE = { noir: 'chip-tole-noir', inox: 'chip-tole-inox', larmee: 'chip-tole-larmee' };

  function _badgeTypeTole(type) {
    if (!type) return '<span style="color:#aaa">—</span>';
    const cls = _CLASSE_TYPE_TOLE[type] || '';
    return `<span class="chip-tole ${cls}">${_LABEL_TYPE_TOLE[type] || _e(type)}</span>`;
  }

  /** Surface en m² d'une tôle (largeur × longueur en mm² → m²) */
  function _surfaceTole(t) {
    if (!t.largeur_mm || !t.longueur_mm) return 0;
    return (t.largeur_mm / 1000) * (t.longueur_mm / 1000);
  }

  /**
   * Calcule la surface totale (m²) restante par épaisseur pour l'alerte.
   * Le seuil est lu depuis _seuils (localStorage), pas depuis les tôles.
   * Retourne un Map<epaisseur_mm, { surface, seuil }>
   */
  function _surfacesParEpaisseur() {
    const map = new Map();
    (_data?.barres || []).forEach(b => {
      if (b.categorie !== 'tole' || b.statut === 'archivee') return;
      const ep = b.epaisseur_mm;
      if (!map.has(ep)) map.set(ep, { surface: 0, seuil: _seuils[ep] || 0 });
      map.get(ep).surface += _surfaceTole(b) * (b.quantite || 1);
    });
    return map;
  }

  const COLS_EDITABLES_TOLE = new Set(['epaisseur', 'quantite', 'lieu', 'dispo']);

  function _cellTole(key, t, modif) {
    const surf = _surfaceTole(t);
    switch (key) {
      case 'id':
        return `<span class="chip-id">${_e(t.id)}</span>`;
      case 'type':
        return `${_badgeTypeTole(t.type_tole)}${t.is_chute ? ' <span class="chip-chute">chute</span>' : ''}`;
      case 'epaisseur':
        return `<strong>${t.epaisseur_mm} mm</strong>`;
      case 'dimensions':
        return `${t.largeur_mm} × ${t.longueur_mm} mm`;
      case 'surf_unit':
        return surf > 0 ? `<span style="color:#555">${surf.toFixed(2)} m²</span>` : '—';
      case 'quantite':
        return `${t.quantite} pièce${t.quantite > 1 ? 's' : ''}`;
      case 'surf_tot':
        return surf > 0 ? `<span style="color:#555">${(surf * (t.quantite || 1)).toFixed(2)} m²</span>` : '—';
      case 'poids': {
        const u = t.poids_unitaire_kg != null ? Math.ceil(t.poids_unitaire_kg) : null;
        const tot = t.poids_total_kg  != null ? Math.ceil(t.poids_total_kg)    : null;
        return `${u ?? '—'} <span style="color:#999;font-size:11px">(tot.&nbsp;${tot ?? '—'})</span>`;
      }
      case 'lieu':
        return t.lieu_stockage
          ? `<span class="chip-lieu chip-lieu-btn" data-lieu="${_e(t.lieu_stockage)}" title="Voir sur le plan">${_e(t.lieu_stockage)} <span class="chip-plan-pin">📍</span></span>`
          : '—';
      case 'date':
        return t.date_ajout ? new Date(t.date_ajout).toLocaleDateString('fr-FR') : '—';
      case 'chantier':
        return `${_e(_labelChantier(t.chantier_origine))}${t.chantier_affectation
          ? ` <span class="chip-chantier" title="Affecté à : ${_e(_labelChantier(t.chantier_affectation))}">→ ${_e(_labelChantier(t.chantier_affectation))}</span>`
          : ''}`;
      case 'dispo':
        return _badgeDispo(t);
      case 'ref_cmd':
        return t.ref_commande ? `<span style="font-size:11px;color:#666">${_e(t.ref_commande)}</span>` : '—';
      default:
        return '';
    }
  }

  function _htmlToles(data) {
    const admin = Auth.hasRight('can_validate');
    const modif = Auth.hasRight('can_edit');
    const vis   = _chargerColsVisToles();
    const colsVis = COLS_TOLES.filter(c => vis[c.key]);
    const nbCols  = colsVis.length + 1; // +actions

    let h = '<table class="table-toles"><thead><tr>';
    colsVis.forEach(c => {
      const actif = _tri.col === c.tri;
      const ind   = actif ? (_tri.ordre === 'asc' ? '▲' : '▼') : (c.tri ? '⇅' : '');
      const clsTri = actif ? ' tri-actif' : '';
      h += c.tri
        ? `<th class="col-t-${c.key}${clsTri}" data-col="${c.tri}">${c.label} <span class="tri-ind">${ind}</span></th>`
        : `<th class="col-t-${c.key}">${c.label}</th>`;
    });
    h += '<th>Action</th></tr></thead><tbody>';

    if (!data.length) {
      h += `<tr><td colspan="${nbCols + 1}" class="vide">Aucune tôle ne correspond aux filtres.</td></tr>`;
    } else {
      data.forEach(t => {
        const attente = t.statut === 'en_attente';
        h += `<tr${attente ? ' class="ligne-attente"' : ''} data-id="${_e(t.id)}">`;
        colsVis.forEach(c => {
          const editable = modif && COLS_EDITABLES_TOLE.has(c.key);
          const cls = `col-t-${c.key}${editable ? ' cell-editable' : ''}`;
          const dataField = editable ? ` data-field="${c.key}"` : '';
          h += `<td class="${cls}"${dataField}>${_cellTole(c.key, t, modif)}</td>`;
        });
        h += `<td class="td-actions">${_actionsLigneTole(t, modif, admin)}</td>`;
        h += `</tr>`;
      });
    }

    return h + '</tbody></table>';
  }


  /* ──────────────────────────────────────────────────────────────
     HELPERS CALCUL
     ────────────────────────────────────────────────────────────── */

  /** Étiquette d'allée : 0→A, 25→Z, 26→AA, 27→AB … (style colonnes Excel) */
  function _labelAllee(i) {
    let s = '', n = i;
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  }

  /** Génère tous les emplacements d'un rack (ex. "Rack 1 - B4").
   *  Rack avec nb_allees=0 → zone plate : retourne juste [rack.nom]. */
  function _lieuxDuRack(rack) {
    if (!rack.nb_allees || !rack.nb_etages) return [rack.nom];
    const lieux = [];
    for (let a = 0; a < rack.nb_allees; a++) {
      for (let e = 1; e <= rack.nb_etages; e++) {
        lieux.push(`${rack.nom} - ${_labelAllee(a)}${e}`);
      }
    }
    return lieux;
  }

  /** Recalcule _lieux depuis _racks et retourne le tableau */
  function _majLieux() {
    const liste = _racks.flatMap(r => _lieuxDuRack(r));
    return liste.length ? liste : [...LIEUX_DEFAUT];
  }

  /** Poids effectif d'un profilé — poids_barre_kg prioritaire, sinon poids_ml × longueur,
   *  sinon lookup catalogue sections.json × longueur */
  function _poidsEffectifProfil(b) {
    if (b.poids_barre_kg > 0) return b.poids_barre_kg;
    const pml = b.poids_ml > 0 ? b.poids_ml : (_getDims(b.section_type, b.designation)?.pml || 0);
    if (pml > 0 && b.longueur_m > 0) return Math.round(pml * b.longueur_m * 10) / 10;
    return 0;
  }

  /* ──────────────────────────────────────────────────────────────
     BADGES ET BOUTONS LIGNE
     ────────────────────────────────────────────────────────────── */

  function _badgeDispo(item) {
    if (item.statut === 'en_attente')        return `<span class="badge badge-attente">⏳ En attente</span>`;
    // Vérifier si une demande d'attribution est en cours sur cet élément
    const demandeEnCours = _demandes.find(d => d.id_barre === item.id);
    if (demandeEnCours) return `<span class="badge badge-attente">⏳ Attribution demandée</span>`;
    if (item.disponibilite === 'disponible') return `<span class="badge badge-dispo">Disponible</span>`;
    return                                          `<span class="badge badge-affecte">Affecté</span>`;
  }

  function _actionsLigneProfil(b, modif, admin) {
    let h = '';

    if (b.statut === 'en_attente' && admin) {
      // Admin : boutons valider / refuser sur ajout en attente
      h += ` <button class="btn-ligne btn-valider" onclick="Stock.validerElement('${b.id}')" title="Valider">✔</button>`;
      h += ` <button class="btn-ligne btn-refuser" onclick="Stock.refuserElement('${b.id}')" title="Refuser">✘</button>`;
    } else {
      // Vérifier si une demande d'attribution est en attente sur cette barre
      const demandeEnCours = _demandes.find(d => d.id_barre === b.id);
      if (demandeEnCours && admin) {
        // Admin : boutons valider / refuser sur la demande (id DEM-XXXX)
        h += ` <button class="btn-ligne btn-valider" onclick="Stock.validerElement('${_e(demandeEnCours.id)}')" title="Valider la demande">✔</button>`;
        h += ` <button class="btn-ligne btn-refuser" onclick="Stock.refuserElement('${_e(demandeEnCours.id)}')" title="Refuser la demande">✘</button>`;
      } else if (modif) {
        // Gestion / Admin : modifier
        h += ` <button class="btn-ligne btn-modifier" onclick="Stock.ouvrirModification('${b.id}')" title="Modifier">Modifier</button>`;
      }
    }

    // Demander : tous les profils (si disponible et pas de demande en cours)
    const demandeActifP = _demandes.find(d => d.id_barre === b.id);
    if (b.statut !== 'en_attente' && !demandeActifP) {
      const dis = b.disponibilite !== 'disponible' ? ' disabled' : '';
      h += ` <button class="btn-ligne btn-demander"${dis} onclick="Stock.ouvrirDemande('${b.id}')" title="Demander l'attribution">Demander</button>`;
    }

    return h;
  }

  function _actionsLigneTole(t, modif, admin) {
    let h = '';

    if (t.statut === 'en_attente' && admin) {
      h += ` <button class="btn-ligne btn-valider" onclick="Stock.validerElement('${t.id}')" title="Valider">✔</button>`;
      h += ` <button class="btn-ligne btn-refuser" onclick="Stock.refuserElement('${t.id}')" title="Refuser">✘</button>`;
    } else {
      const demandeEnCours = _demandes.find(d => d.id_barre === t.id);
      if (demandeEnCours && admin) {
        h += ` <button class="btn-ligne btn-valider" onclick="Stock.validerElement('${_e(demandeEnCours.id)}')" title="Valider la demande">✔</button>`;
        h += ` <button class="btn-ligne btn-refuser" onclick="Stock.refuserElement('${_e(demandeEnCours.id)}')" title="Refuser la demande">✘</button>`;
      } else if (modif) {
        h += ` <button class="btn-ligne btn-modifier" onclick="Stock.ouvrirModification('${t.id}')" title="Modifier">Modifier</button>`;
        const dis = t.quantite <= 0 ? ' disabled' : '';
        h += ` <button class="btn-ligne btn-demander"${dis} onclick="Stock.ouvrirSortieTole('${_e(t.id)}')" title="Sortie chantier">Sortie</button>`;
      }
    }

    h += ` <button class="btn-historique" onclick="Stock.ouvrirHistoriqueTole('${_e(t.id)}')" title="Historique">📋</button>`;
    return h;
  }


  /* ──────────────────────────────────────────────────────────────
     PEUPLEMENT DES FILTRES
     ────────────────────────────────────────────────────────────── */

  function _peuplerFiltres() {
    // Exclure les archivées des onglets actifs
    const profils   = _data.barres.filter(b => b.categorie === 'profil' && b.statut !== 'archivee');
    const toles     = _data.barres.filter(b => b.categorie === 'tole'   && b.statut !== 'archivee');
    const archivees = _data.barres.filter(b => b.statut === 'archivee');

    _remplirSelect('p-type',
      [...new Set(profils.map(b => b.section_type))].sort()
    );
    _remplirSelectChantiers('p-chantier',
      [...new Set(profils.filter(b => b.chantier_affectation).map(b => b.chantier_affectation))].sort()
    );
    _remplirSelect('p-lieu',
      [...new Set(profils.map(b => b.lieu_stockage))].sort()
    );
    // t-type : ne remplacer que les valeurs dynamiques (les options fixes sont dans le HTML)
    _remplirSelect('t-epaisseur',
      [...new Set(toles.map(b => String(b.epaisseur_mm)))].sort((a,b) => +a - +b),
      'mm'
    );
    _remplirSelectChantiers('t-chantier',
      [...new Set(toles.map(b => b.chantier_origine))].sort()
    );
    _remplirSelect('t-lieu',
      [...new Set(toles.map(b => b.lieu_stockage))].sort()
    );
    // Filtre type pour l'onglet archivées
    _remplirSelect('a-type',
      [...new Set(archivees.map(b => b.section_type))].sort()
    );
  }

  function _peuplerDesignations(type) {
    const sel = document.getElementById('p-desig');
    if (!sel) return;
    const valAct = sel.value;
    sel.innerHTML = '<option value="">Toutes désignations</option>';
    if (!type) return;

    const desigs = [...new Set(
      _data.barres
        .filter(b => b.categorie === 'profil' && b.statut !== 'archivee' && b.section_type === type)
        .map(b => b.designation)
    )].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      return isNaN(na) ? a.localeCompare(b) : na - nb;
    });

    desigs.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = d;
      if (d === valAct) o.selected = true;
      sel.appendChild(o);
    });
  }

  /**
   * Peuple la cascade désignation de l'onglet Archivées selon le type sélectionné
   * @param {string} type — valeur du select a-type
   */
  function _peuplerDesignationsArchivees(type) {
    const sel = document.getElementById('a-desig');
    if (!sel) return;
    const valAct = sel.value;
    sel.innerHTML = '<option value="">Toutes désignations</option>';
    if (!type) return;

    const desigs = [...new Set(
      _data.barres
        .filter(b => b.categorie === 'profil' && b.statut === 'archivee' && b.section_type === type)
        .map(b => b.designation)
    )].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      return isNaN(na) ? a.localeCompare(b) : na - nb;
    });

    desigs.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = d;
      if (d === valAct) o.selected = true;
      sel.appendChild(o);
    });
  }

  function _remplirSelect(id, valeurs, suffixe = '') {
    const sel = document.getElementById(id);
    if (!sel) return;
    const premiere = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(premiere);
    valeurs.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = suffixe ? `${v} ${suffixe}` : v;
      sel.appendChild(o);
    });
  }

  function _remplirSelectChantiers(id, noms) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const premiere = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(premiere);
    const tries = [...noms].sort((a, b) => {
      const ca = _chantiers.find(c => c.nom === a);
      const cb = _chantiers.find(c => c.nom === b);
      return (ca?.numero_affaire || a).localeCompare(cb?.numero_affaire || b, 'fr', { numeric: true });
    });
    tries.forEach(nom => {
      const o = document.createElement('option');
      o.value = nom;
      o.textContent = _labelChantier(nom) || nom;
      sel.appendChild(o);
    });
  }


  /* ──────────────────────────────────────────────────────────────
     SYNTHÈSE
     ────────────────────────────────────────────────────────────── */

  function _rendreSynthese() {
    const zone = document.getElementById('zone-synthese');
    if (!zone || !_data) return;

    const barres = _data.barres || [];

    // Segmentation
    const profilsDispo    = barres.filter(b => b.categorie === 'profil' && b.statut === 'valide' && b.disponibilite === 'disponible');
    const profilsAffectes = barres.filter(b => b.categorie === 'profil' && b.statut === 'valide' && b.disponibilite === 'affecte');
    const profilsAttente  = barres.filter(b => b.categorie === 'profil' && b.statut === 'en_attente');
    const tolesDispo      = barres.filter(b => b.categorie === 'tole'   && b.statut === 'valide' && b.disponibilite === 'disponible');
    const tolesAffectees  = barres.filter(b => b.categorie === 'tole'   && b.statut === 'valide' && b.disponibilite === 'affecte');
    const tolesAttente    = barres.filter(b => b.categorie === 'tole'   && b.statut === 'en_attente');

    // Métriques globales
    const mlDispo      = profilsDispo.reduce((s, b)    => s + (b.longueur_m     || 0), 0);
    const mlAffectes   = profilsAffectes.reduce((s, b) => s + (b.longueur_m     || 0), 0);
    const mlAttente    = profilsAttente.reduce((s, b)  => s + (b.longueur_m     || 0), 0);
    const poidsProfils = profilsDispo.reduce((s, b)    => s + _poidsEffectifProfil(b), 0);
    const poidsToles   = tolesDispo.reduce((s, b)      => s + (b.poids_total_kg || 0), 0);
    const nbAttente    = profilsAttente.length + tolesAttente.length;

    // Formatage français
    const fmt  = (n, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    const fmtT = (kg)       => kg >= 1000 ? `${fmt(kg / 1000)} t` : `${fmt(kg, 0)} kg`;

    // ── Contenu sous-onglet Profilés ──────────────────────────────
    const _contenuProfils = () => {
      const sourceType = _synProfilsTous
        ? [...profilsDispo, ...profilsAffectes]
        : profilsDispo;
      const parType = {};
      sourceType.forEach(b => {
        const t = b.section_type || '?';
        const d = b.designation  || '?';
        if (!parType[t]) parType[t] = { nb: 0, ml: 0, poids: 0, desigs: {} };
        parType[t].nb++;
        parType[t].ml    += b.longueur_m || 0;
        parType[t].poids += _poidsEffectifProfil(b);
        if (!parType[t].desigs[d]) parType[t].desigs[d] = { nb: 0, ml: 0, poids: 0 };
        parType[t].desigs[d].nb++;
        parType[t].desigs[d].ml    += b.longueur_m || 0;
        parType[t].desigs[d].poids += _poidsEffectifProfil(b);
      });
      const lignesType = Object.entries(parType).sort((a, b) => b[1].ml - a[1].ml);
      const mlMax = lignesType.length ? lignesType[0][1].ml : 1;

      const mlAffectes   = profilsAffectes.reduce((s, b) => s + (b.longueur_m || 0), 0);
      const mlAttente    = profilsAttente.reduce((s, b)  => s + (b.longueur_m || 0), 0);
      const mlTotal      = mlDispo + mlAffectes + mlAttente;
      const poidsAffectes = profilsAffectes.reduce((s, b) => s + _poidsEffectifProfil(b), 0);
      const poidsAttente  = profilsAttente.reduce((s, b)  => s + _poidsEffectifProfil(b), 0);
      const poidsTotal    = poidsProfils + poidsAffectes + poidsAttente;
      const nbTotal       = profilsDispo.length + profilsAffectes.length + profilsAttente.length;

      const cartes = `
        <div class="syn-kpi k-vert syn-kpi-table" style="margin-bottom:16px">
          <table class="syn-kpi-inner">
            <thead><tr>
              <th></th>
              <th>Barres</th><th>Métrage</th><th>Poids</th>
            </tr></thead>
            <tbody>
              <tr>
                <td><span class="syn-dot s-vert"></span> <span class="syn-lien" data-syn-action="voir-dispo" data-syn-onglet="profils" data-syn-dispo="disponible">Disponible →</span></td>
                <td><strong>${profilsDispo.length}</strong></td>
                <td>${fmt(mlDispo)} m</td>
                <td>${fmtT(poidsProfils)}</td>
              </tr>
              <tr>
                <td><span class="syn-dot s-rouge"></span> <span class="syn-lien" data-syn-action="voir-dispo" data-syn-onglet="profils" data-syn-dispo="affecte">Affecté →</span></td>
                <td><strong>${profilsAffectes.length}</strong></td>
                <td>${fmt(mlAffectes)} m</td>
                <td>${fmtT(poidsAffectes)}</td>
              </tr>
              <tr class="syn-kpi-inner-total">
                <td>Total</td>
                <td><strong>${nbTotal}</strong></td>
                <td>${fmt(mlTotal)} m</td>
                <td>${fmtT(poidsTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;

      const rowsType = lignesType.map(([type, d]) => {
        const pct = Math.round((d.ml / mlMax) * 100);
        const sousLignes = Object.entries(d.desigs)
          .sort((a, b) => b[1].ml - a[1].ml)
          .map(([desig, sd]) => `
            <tr class="syn-sous-ligne" data-syn-parent="${_e(type)}"
                data-syn-action="voir-desig" data-syn-type="${_e(type)}" data-syn-desig="${_e(desig)}"
                style="display:none" title="Filtrer ${_e(type)} ${_e(desig)}">
              <td class="syn-sous-cell">
                <span class="syn-sous-indent">└</span>
                ${_e(type)} <strong>${_e(desig)}</strong>
              </td>
              <td class="r syn-sous-val">${sd.nb}</td>
              <td class="r syn-sous-val">${fmt(sd.ml)} m</td>
              <td class="r syn-sous-val">${fmtT(sd.poids)}</td>
            </tr>`).join('');
        return `<tr class="syn-type-row">
          <td>
            <span class="syn-toggle-icon" data-syn-action="toggle-type" data-syn-type-group="${_e(type)}">▶</span>
            <span class="syn-type-chip" data-syn-action="voir-type" data-syn-type="${_e(type)}" title="Voir ${_e(type)} dans le stock">${_e(type)}</span>
          </td>
          <td class="r">${d.nb}</td>
          <td class="r">${fmt(d.ml)} m</td>
          <td class="r">${fmtT(d.poids)}</td>
        </tr>${sousLignes}`;
      }).join('');

      const nbTotal2   = sourceType.length;
      const mlTotal2   = sourceType.reduce((s, b) => s + (b.longueur_m || 0), 0);
      const poidsTotal2 = sourceType.reduce((s, b) => s + _poidsEffectifProfil(b), 0);
      const totalRow = lignesType.length > 1 ? `<tr class="syn-total">
        <td>Total</td><td class="r">${nbTotal2}</td>
        <td class="r">${fmt(mlTotal2)} m</td><td class="r">${fmtT(poidsTotal2)}</td>
      </tr>` : '';

      const scopeLabel = _synProfilsTous ? 'Tous' : 'Disponibles';
      const scopeNext  = _synProfilsTous ? 'Disponibles' : 'Tous';
      return `
        ${cartes}
        <div class="syn-card" style="padding:0;overflow:hidden">
          <table class="syn-table">
            <colgroup>
              <col style="width:auto">
              <col style="width:58px">
              <col style="width:88px">
              <col style="width:78px">
            </colgroup>
            <thead>
              <tr class="syn-table-title-row">
                <th colspan="4">
                  Par type
                  <span class="syn-scope-btn" data-syn-action="toggle-profils-scope"
                        title="Basculer le périmètre">
                    ${scopeLabel} ▾
                  </span>
                </th>
              </tr>
              <tr>
                <th>Type</th>
                <th class="r">Barres</th>
                <th class="r">ML</th>
                <th class="r">Poids</th>
              </tr>
            </thead>
            <tbody>
              ${rowsType || `<tr><td colspan="4" style="color:#aaa;text-align:center;padding:14px">Aucun profilé ${_synProfilsTous ? '' : 'disponible'}</td></tr>`}
              ${totalRow}
            </tbody>
          </table>
        </div>`;
    };

    // ── Contenu sous-onglet Tôles ─────────────────────────────────
    const _contenuToles = () => {
      // Surface totale = disponible + affecté + attente (hors archivées)
      const tolesActives = barres.filter(b => b.categorie === 'tole' && b.statut !== 'archivee');
      const surfaceDispo  = tolesDispo.reduce((s, b) => s + _surfaceTole(b) * (b.quantite || 1), 0);
      const surfaceAfft   = tolesAffectees.reduce((s, b) => s + _surfaceTole(b) * (b.quantite || 1), 0);
      const poidsTolesTot = tolesDispo.reduce((s, b) => s + (b.poids_total_kg || 0), 0);
      const pAfft         = tolesAffectees.reduce((s, b) => s + (b.poids_total_kg || 0), 0);
      const nbTolTotal    = tolesDispo.length + tolesAffectees.length + tolesAttente.length;

      // Grouper par épaisseur (toutes disponibilités actives)
      const parEp = {};
      tolesActives.forEach(b => {
        const ep = b.epaisseur_mm;
        if (!parEp[ep]) parEp[ep] = { surface: 0, poids: 0, types: new Set(), nb: 0 };
        parEp[ep].surface += _surfaceTole(b) * (b.quantite || 1);
        parEp[ep].poids   += b.poids_total_kg || 0;
        parEp[ep].nb      += b.quantite || 1;
        if (b.type_tole) parEp[ep].types.add(b.type_tole);
      });
      const lignesEp = Object.entries(parEp).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
      const surfMax  = lignesEp.length ? Math.max(...lignesEp.map(([, d]) => d.surface)) : 1;

      const canEdit = Auth.hasRight('can_edit');

      const rowsEp = lignesEp.map(([ep, d]) => {
        const seuil    = _seuils[ep] || 0;
        const alerte   = seuil > 0 && d.surface < seuil;
        const pct      = Math.round((d.surface / surfMax) * 100);
        const typesBadges = [...d.types].map(t =>
          `<span class="chip-tole ${_CLASSE_TYPE_TOLE[t] || ''}" style="font-size:10px;padding:1px 5px">${_LABEL_TYPE_TOLE[t] || t}</span>`
        ).join(' ');
        const alerteIcon = alerte
          ? `<span title="Surface totale (${fmt(d.surface)} m²) sous le seuil (${fmt(seuil)} m²)" style="color:#c0392b;font-weight:700">⚠</span>`
          : `<span style="color:var(--vert)">✓</span>`;
        const seuilInput = canEdit
          ? `<input type="number" class="syn-seuil-input" data-ep="${_e(String(ep))}"
               value="${seuil > 0 ? seuil : ''}" min="0" step="0.1" placeholder="—"
               title="Seuil d'alerte pour ${ep} mm (en m²)"
               style="width:72px;padding:2px 5px;border:1px solid #ccc;border-radius:3px;font-size:12px;text-align:right"> m²`
          : `${seuil > 0 ? fmt(seuil) + ' m²' : '<span style="color:#aaa">—</span>'}`;

        return `<tr class="${alerte ? 'ligne-stock-bas' : ''}">
          <td>
            <span class="syn-type-chip" style="background:#2980b9;cursor:pointer"
                  data-syn-action="voir-epaisseur" data-syn-ep="${_e(String(ep))}"
                  title="Voir les tôles ${_e(String(ep))} mm dans le stock">${_e(String(ep))} mm</span>
            ${typesBadges}
          </td>
          <td class="r"><strong>${fmt(d.surface)} m²</strong></td>
          <td><div class="syn-bar"><div class="syn-bar-fill" style="width:${pct}%;background:${alerte ? '#e74c3c' : '#2980b9'}"></div></div></td>
          <td style="text-align:right;white-space:nowrap">${seuilInput}</td>
          <td style="text-align:center">${alerteIcon}</td>
        </tr>`;
      }).join('');

      const totalRow = lignesEp.length > 1 ? `<tr class="syn-total">
        <td>Total (${lignesEp.length} épaisseur${lignesEp.length > 1 ? 's' : ''})</td>
        <td class="r">${fmt(tolesActives.reduce((s, b) => s + _surfaceTole(b) * (b.quantite || 1), 0))} m²</td>
        <td></td><td></td><td></td>
      </tr>` : '';

      const noteEdit = canEdit
        ? `<div style="font-size:11px;color:#888;margin-top:6px;padding:0 6px">
            Saisissez un seuil en m² — l'alerte se déclenche quand la surface restante de cette épaisseur descend en dessous.
           </div>`
        : '';

      return `
        <div class="syn-kpi k-vert syn-kpi-table" style="margin-bottom:16px">
          <table class="syn-kpi-inner">
            <thead><tr>
              <th></th>
              <th>Tôles</th><th>Surface</th><th>Poids</th>
            </tr></thead>
            <tbody>
              <tr>
                <td><span class="syn-dot s-vert"></span> <span class="syn-lien" data-syn-action="voir-dispo" data-syn-onglet="toles" data-syn-dispo="disponible">Disponible →</span></td>
                <td><strong>${tolesDispo.length}</strong></td>
                <td>${fmt(surfaceDispo)} m²</td>
                <td>${fmtT(poidsTolesTot)}</td>
              </tr>
              <tr>
                <td><span class="syn-dot s-rouge"></span> <span class="syn-lien" data-syn-action="voir-dispo" data-syn-onglet="toles" data-syn-dispo="affecte">Affecté →</span></td>
                <td><strong>${tolesAffectees.length}</strong></td>
                <td>${fmt(surfaceAfft)} m²</td>
                <td>${fmtT(pAfft)}</td>
              </tr>
              <tr class="syn-kpi-inner-total">
                <td>Total</td>
                <td><strong>${nbTolTotal}</strong></td>
                <td>${fmt(surfaceDispo + surfaceAfft)} m²</td>
                <td>${fmtT(poidsTolesTot + pAfft)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="syn-section-titre">Seuils d'alerte par épaisseur</div>
        <div class="syn-card" style="padding:0;overflow:hidden">
          <table class="syn-table">
            <thead><tr>
              <th>Épaisseur / Type</th>
              <th class="r">Surface en stock</th>
              <th></th>
              <th class="r" style="white-space:nowrap">Seuil alerte</th>
              <th style="text-align:center;width:34px">État</th>
            </tr></thead>
            <tbody>
              ${rowsEp || '<tr><td colspan="5" style="color:#aaa;text-align:center;padding:14px">Aucune tôle active</td></tr>'}
              ${totalRow}
            </tbody>
          </table>
          ${noteEdit}
        </div>`;
    };

    // ── Contenu onglet Bilan chantiers ────────────────────────────
    const _contenuBilan = () => {
      // ── Sources de données ────────────────────────────────────────
      const profils   = barres.filter(b => b.categorie === 'profil');
      const pAff      = profils.filter(b => b.statut === 'valide' && b.disponibilite === 'affecte' && b.chantier_affectation);
      const pArc      = profils.filter(b => b.statut === 'archivee' && b.chantier_affectation);

      const toles     = barres.filter(b => b.categorie === 'tole');
      const tAff      = toles.filter(b => b.statut === 'valide' && b.disponibilite === 'affecte' && b.chantier_affectation);
      const tArc      = toles.filter(b => b.statut === 'archivee' && b.chantier_affectation);

      const _surfTole = b => _surfaceTole(b) * (b.quantite || 1);
      const _poidsTole = b => b.poids_total_kg || 0;

      // Tous les chantiers présents (union profils + tôles)
      const tousChantiers = [...new Set([
        ...pAff.map(b => b.chantier_affectation),
        ...pArc.map(b => b.chantier_affectation),
        ...tAff.map(b => b.chantier_affectation),
        ...tArc.map(b => b.chantier_affectation),
      ])].sort((a, b) => {
        const ca = _chantiers.find(c => c.nom === a);
        const cb = _chantiers.find(c => c.nom === b);
        return (ca?.numero_affaire || a).localeCompare(cb?.numero_affaire || b, 'fr', { numeric: true });
      });

      if (_bilanChantier) {
        // ── Vue détail d'un chantier ──────────────────────────────
        const chPAff = pAff.filter(b => b.chantier_affectation === _bilanChantier);
        const chPArc = pArc.filter(b => b.chantier_affectation === _bilanChantier);
        const chTAff = tAff.filter(b => b.chantier_affectation === _bilanChantier);
        const chTArc = tArc.filter(b => b.chantier_affectation === _bilanChantier);

        const mlAff    = chPAff.reduce((s, b) => s + (b.longueur_m || 0), 0);
        const mlArc    = chPArc.reduce((s, b) => s + (b.longueur_m || 0), 0);
        const surfAff  = chTAff.reduce((s, b) => s + _surfTole(b), 0);
        const surfArc  = chTArc.reduce((s, b) => s + _surfTole(b), 0);
        const poidsP   = [...chPAff, ...chPArc].reduce((s, b) => s + _poidsEffectifProfil(b), 0);
        const poidsT   = [...chTAff, ...chTArc].reduce((s, b) => s + _poidsTole(b), 0);

        const chObj = _chantiers.find(c => c.nom === _bilanChantier);
        const titre = chObj ? [chObj.numero_affaire, chObj.ville, chObj.nom].filter(Boolean).join(' — ') : _bilanChantier;

        // ── Tableau profilés (type → désignation) ─────────────────
        const parType = {};
        const accP = (list, sfx) => list.forEach(b => {
          const t = b.section_type || '?', d = b.designation || '?';
          if (!parType[t]) parType[t] = {};
          if (!parType[t][d]) parType[t][d] = { nbAff:0, mlAff:0, poidsAff:0, nbArc:0, mlArc:0, poidsArc:0 };
          parType[t][d][`nb${sfx}`]++;
          parType[t][d][`ml${sfx}`]    += b.longueur_m || 0;
          parType[t][d][`poids${sfx}`] += _poidsEffectifProfil(b);
        });
        accP(chPAff, 'Aff'); accP(chPArc, 'Arc');

        const profilRows = Object.entries(parType).sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([type, desigs]) => {
          const desigEntries = Object.entries(desigs).sort((a, b) => a[0].localeCompare(b[0], 'fr'));
          const tot = desigEntries.reduce((a, [, d]) => {
            a.nb += d.nbAff + d.nbArc; a.ml += d.mlAff + d.mlArc; a.poids += d.poidsAff + d.poidsArc; return a;
          }, { nb: 0, ml: 0, poids: 0 });
          return `<tr class="bilan-type-row">
              <td colspan="7"><span class="syn-type-chip">${_e(type)}</span>
                <span class="bilan-type-meta">${tot.nb} barre${tot.nb > 1 ? 's' : ''} &nbsp;·&nbsp; ${fmt(tot.ml)} m &nbsp;·&nbsp; ${fmtT(tot.poids)}</span>
              </td></tr>` +
            desigEntries.map(([desig, d]) => `<tr>
              <td class="bilan-desig-cell"><span class="bilan-indent">└</span>${_e(desig)}</td>
              <td class="r">${d.nbAff  || '<span class=bilan-nil>—</span>'}</td>
              <td class="r">${d.mlAff  > 0 ? fmt(d.mlAff)  + ' m' : '<span class=bilan-nil>—</span>'}</td>
              <td class="r">${d.nbArc  || '<span class=bilan-nil>—</span>'}</td>
              <td class="r">${d.mlArc  > 0 ? fmt(d.mlArc)  + ' m' : '<span class=bilan-nil>—</span>'}</td>
              <td class="r"><strong>${fmt(d.mlAff + d.mlArc)} m</strong></td>
              <td class="r bilan-poids">${fmtT(d.poidsAff + d.poidsArc)}</td>
            </tr>`).join('');
        }).join('');

        // ── Tableau tôles (épaisseur → type_tole) ─────────────────
        const parEp = {};
        const accT = (list, sfx) => list.forEach(b => {
          const ep = b.epaisseur_mm ?? '?', ty = b.type_tole || '?';
          const k  = `${ep}__${ty}`;
          if (!parEp[k]) parEp[k] = { ep, ty, nbAff:0, surfAff:0, poidsAff:0, nbArc:0, surfArc:0, poidsArc:0 };
          parEp[k][`nb${sfx}`]++;
          parEp[k][`surf${sfx}`]  += _surfTole(b);
          parEp[k][`poids${sfx}`] += _poidsTole(b);
        });
        accT(chTAff, 'Aff'); accT(chTArc, 'Arc');

        const toleRows = Object.values(parEp)
          .sort((a, b) => (a.ep - b.ep) || (a.ty).localeCompare(b.ty, 'fr'))
          .map(d => `<tr>
            <td><strong>${_e(String(d.ep))} mm</strong> &nbsp;${_badgeTypeTole(d.ty)}</td>
            <td class="r">${d.nbAff  || '<span class=bilan-nil>—</span>'}</td>
            <td class="r">${d.surfAff  > 0 ? fmt(d.surfAff)  + ' m²' : '<span class=bilan-nil>—</span>'}</td>
            <td class="r">${d.nbArc  || '<span class=bilan-nil>—</span>'}</td>
            <td class="r">${d.surfArc  > 0 ? fmt(d.surfArc)  + ' m²' : '<span class=bilan-nil>—</span>'}</td>
            <td class="r"><strong>${fmt(d.surfAff + d.surfArc)} m²</strong></td>
            <td class="r bilan-poids">${fmtT(d.poidsAff + d.poidsArc)}</td>
          </tr>`).join('');

        const hasP = chPAff.length + chPArc.length > 0;
        const hasT = chTAff.length + chTArc.length > 0;

        return `
          <div class="bilan-retour"><span class="syn-lien" data-syn-action="retour-bilan">← Tous les chantiers</span></div>
          <div class="syn-kpi k-vert syn-kpi-table" style="margin-bottom:16px">
            <div class="bilan-titre-ch">${_e(titre)}</div>
            <table class="syn-kpi-inner">
              <thead><tr><th></th><th>Qté</th><th>Métrage / Surface</th><th>Poids</th></tr></thead>
              <tbody>
                ${hasP ? `<tr>
                  <td>Profilés affectés</td>
                  <td><strong>${chPAff.length}</strong></td><td>${fmt(mlAff)} m</td><td>${fmtT(poidsP * mlAff / (mlAff + mlArc || 1))}</td>
                </tr>
                <tr>
                  <td>Profilés archivés</td>
                  <td><strong>${chPArc.length}</strong></td><td>${fmt(mlArc)} m</td><td></td>
                </tr>` : ''}
                ${hasT ? `<tr>
                  <td>Tôles affectées</td>
                  <td><strong>${chTAff.length}</strong></td><td>${fmt(surfAff)} m²</td><td></td>
                </tr>
                <tr>
                  <td>Tôles archivées</td>
                  <td><strong>${chTArc.length}</strong></td><td>${fmt(surfArc)} m²</td><td></td>
                </tr>` : ''}
                <tr class="syn-kpi-inner-total">
                  <td>Poids total engagé</td>
                  <td><strong>${chPAff.length + chPArc.length + chTAff.length + chTArc.length}</strong></td>
                  <td></td><td>${fmtT(poidsP + poidsT)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          ${hasP ? `
          <div class="syn-section-titre">Profilés</div>
          <div class="syn-card" style="padding:0;overflow:hidden;margin-bottom:12px">
            <table class="syn-table">
              <thead><tr><th>Désignation</th><th class="r">Aff.</th><th class="r">ML aff.</th><th class="r">Arch.</th><th class="r">ML arch.</th><th class="r">Total ML</th><th class="r">Poids</th></tr></thead>
              <tbody>${profilRows || '<tr><td colspan="7" class="bilan-vide">—</td></tr>'}</tbody>
            </table>
          </div>` : ''}
          ${hasT ? `
          <div class="syn-section-titre">Tôles</div>
          <div class="syn-card" style="padding:0;overflow:hidden">
            <table class="syn-table">
              <thead><tr><th>Épaisseur / Type</th><th class="r">Aff.</th><th class="r">m² aff.</th><th class="r">Arch.</th><th class="r">m² arch.</th><th class="r">Total m²</th><th class="r">Poids</th></tr></thead>
              <tbody>${toleRows || '<tr><td colspan="7" class="bilan-vide">—</td></tr>'}</tbody>
            </table>
          </div>` : ''}`;
      }

      // ── Vue d'ensemble tous chantiers ─────────────────────────────
      const rows = tousChantiers.map(ch => {
        const chPa = pAff.filter(b => b.chantier_affectation === ch);
        const chPr = pArc.filter(b => b.chantier_affectation === ch);
        const chTa = tAff.filter(b => b.chantier_affectation === ch);
        const chTr = tArc.filter(b => b.chantier_affectation === ch);
        const mlTot   = [...chPa, ...chPr].reduce((s, b) => s + (b.longueur_m || 0), 0);
        const surfTot = [...chTa, ...chTr].reduce((s, b) => s + _surfTole(b), 0);
        const poids   = [...chPa, ...chPr].reduce((s, b) => s + _poidsEffectifProfil(b), 0)
                      + [...chTa, ...chTr].reduce((s, b) => s + _poidsTole(b), 0);
        const chObj = _chantiers.find(c => c.nom === ch);
        const meta  = chObj ? [chObj.numero_affaire, chObj.ville].filter(Boolean).join(' · ') : '';
        return `<tr class="bilan-ch-row" data-syn-action="voir-bilan-chantier" data-syn-chantier="${_e(ch)}" title="Voir le détail">
          <td>${meta ? `<span class="bilan-meta">${_e(meta)}</span><br>` : ''}<strong>${_e(ch)}</strong></td>
          <td class="r">${mlTot   > 0 ? fmt(mlTot)   + ' m'  : '<span class=bilan-nil>—</span>'}</td>
          <td class="r">${surfTot > 0 ? fmt(surfTot) + ' m²' : '<span class=bilan-nil>—</span>'}</td>
          <td class="r bilan-poids">${fmtT(poids)}</td>
        </tr>`;
      }).join('');

      const totMl   = [...pAff, ...pArc].reduce((s, b) => s + (b.longueur_m || 0), 0);
      const totSurf = [...tAff, ...tArc].reduce((s, b) => s + _surfTole(b), 0);
      const totPoids = [...pAff, ...pArc].reduce((s, b) => s + _poidsEffectifProfil(b), 0)
                     + [...tAff, ...tArc].reduce((s, b) => s + _poidsTole(b), 0);
      const totalRow = tousChantiers.length > 1 ? `<tr class="syn-total">
        <td>Total (${tousChantiers.length} chantier${tousChantiers.length > 1 ? 's' : ''})</td>
        <td class="r">${fmt(totMl)} m</td>
        <td class="r">${fmt(totSurf)} m²</td>
        <td class="r bilan-poids">${fmtT(totPoids)}</td>
      </tr>` : '';

      return `
        <div class="syn-card" style="padding:0;overflow:hidden">
          <table class="syn-table">
            <thead>
              <tr class="syn-table-title-row"><th colspan="4">Consommation par chantier</th></tr>
              <tr><th>Chantier</th><th class="r">Profilés (ML)</th><th class="r">Tôles (m²)</th><th class="r">Poids</th></tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4" class="bilan-vide">Aucun profilé ou tôle affecté ou archivé</td></tr>'}
              ${totalRow}
            </tbody>
          </table>
        </div>`;
    };

    // ── Rendu final ───────────────────────────────────────────────
    const estBilan   = _synTab === 'bilan';
    const estProfils = _synTab === 'profils';
    zone.innerHTML = `
    <div class="syn-page">
      <div class="syn-sous-nav">
        <button class="syn-tab${estProfils ? ' actif' : ''}" data-syn-action="changer-syn-tab" data-syn-tab="profils">Profilés</button>
        <button class="syn-tab${_synTab === 'toles' ? ' actif' : ''}" data-syn-action="changer-syn-tab" data-syn-tab="toles">Tôles</button>
        <button class="syn-tab${estBilan ? ' actif' : ''}" data-syn-action="changer-syn-tab" data-syn-tab="bilan">Bilan chantiers</button>
      </div>
      ${estBilan ? _contenuBilan() : estProfils ? _contenuProfils() : _contenuToles()}
    </div>`;
  }


  /* ──────────────────────────────────────────────────────────────
     ONGLETS
     ────────────────────────────────────────────────────────────── */

  function _basculerOnglet(onglet, garderFiltreAttente = false) {
    const precedent = _onglet;
    _onglet = onglet;
    _tri    = { col: null, ordre: 'asc' };

    if (!garderFiltreAttente) {
      _filtreEnAttente = false;
      _majBadgeAttente();
    }

    document.querySelectorAll('.sous-onglet').forEach(b => {
      b.classList.toggle('actif', b.dataset.onglet === onglet);
    });

    const tpro = document.getElementById('toolbar-profils');
    const ttol = document.getElementById('toolbar-toles');
    const tarc = document.getElementById('toolbar-archivees');
    if (tpro) tpro.style.display = onglet === 'profils'   ? '' : 'none';
    if (ttol) ttol.style.display = onglet === 'toles'     ? '' : 'none';
    if (tarc) tarc.style.display = onglet === 'archivees' ? '' : 'none';

    // Basculer entre tableau et zone synthèse
    const ztab  = document.getElementById('tableau-stock');
    const zpied = document.querySelector('.pied-tableau');
    const zsyn  = document.getElementById('zone-synthese');
    const estSyn = onglet === 'synthese';
    if (ztab)  ztab.style.display  = estSyn ? 'none' : '';
    if (zpied) zpied.style.display = estSyn ? 'none' : '';
    if (zsyn)  zsyn.style.display  = estSyn ? '' : 'none';

    // Titre dynamique selon l'onglet
    const titres = {
      profils: 'Stock Profilés — LBF', toles: 'Stock Tôles — LBF',
      archivees: 'Stock Archivées — LBF', synthese: 'Synthèse Stock — LBF'
    };
    document.title = titres[onglet] || 'Stock — LBF';

    // Réinitialiser les filtres de l'onglet quitté
    if (precedent !== onglet) _resetFiltres(precedent);
    _filtrer();
  }

  function _resetFiltres(onglet) {
    const map = {
      profils:   ['p-type','p-desig','p-chantier','p-lieu','p-dispo','p-recherche'],
      toles:     ['t-type','t-epaisseur','t-chantier','t-lieu','t-dispo','t-recherche'],
      archivees: ['a-type','a-desig','a-recherche'],
    };
    (map[onglet] || []).forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (onglet === 'profils' || onglet === 'toles') {
      _filtreEnAttente = false;
      _majBadgeAttente();
    }
  }

  function _majBadgeAttente() {
    const badge = document.getElementById('badge-filtre-attente');
    if (badge) badge.style.display = _filtreEnAttente ? 'inline-flex' : 'none';
  }

  window._clearFiltreAttente = function() {
    _filtreEnAttente = false;
    _majBadgeAttente();
    _filtrer();
  };


  /* ──────────────────────────────────────────────────────────────
     COMPTEUR ET ALERTE
     ────────────────────────────────────────────────────────────── */

  function _majCompteur(nb, total) {
    const z = document.getElementById('stock-compteur');
    if (!z) return;
    let s;
    if (_onglet === 'profils')        s = ['profilé', 'profilés'];
    else if (_onglet === 'toles')     s = ['tôle', 'tôles'];
    else                              s = ['barre archivée', 'barres archivées'];
    z.textContent = nb === total
      ? `${nb} ${nb > 1 ? s[1] : s[0]}`
      : `${nb} ${nb > 1 ? s[1] : s[0]} affichées sur ${total}`;
  }

  function _majAlerteSeuil() {
    const badge = document.getElementById('badge-stock-bas');
    if (!badge || !_data) return;
    const surfaces = _surfacesParEpaisseur();
    let nb = 0;
    surfaces.forEach(entry => {
      if (entry.seuil > 0 && entry.surface < entry.seuil) nb++;
    });
    badge.style.display = nb > 0 ? 'inline-flex' : 'none';
    const span = badge.querySelector('.stock-bas-nb');
    if (span) span.textContent = nb;
  }

  function _majAlerteAttente() {
    const z = document.getElementById('stock-alerte-attente');
    if (!z || !Auth.hasRight('can_validate')) {
      if (z) z.style.display = 'none';
      return;
    }
    const nbItems   = _data.barres.filter(b => b.statut === 'en_attente').length;
    const nbDemandes = _demandes.length;
    const nb = nbItems + nbDemandes;
    if (nb === 0) {
      z.style.display = 'none';
    } else {
      z.style.display = 'flex';
      const span = z.querySelector('.alerte-nb');
      if (span) span.textContent = nb;
    }
  }


  /* ──────────────────────────────────────────────────────────────
     ÉVÉNEMENTS PRINCIPAUX
     ────────────────────────────────────────────────────────────── */

  function _attacherEvenements() {
    // Onglets
    document.querySelectorAll('.sous-onglet').forEach(b => {
      b.addEventListener('click', () => _basculerOnglet(b.dataset.onglet));
    });

    // Alerte admin : clic pour voir les éléments en attente de validation
    document.getElementById('stock-alerte-attente')?.addEventListener('click', () => {
      _filtreEnAttente = true;
      if (_sectionActive === 'admin') _activerSectionStock();
      _basculerOnglet('profils', true);
      _majBadgeAttente();
      _filtrer();
    });

    // Liens de navigation depuis la synthèse (event delegation)
    const zsyn = document.getElementById('zone-synthese');
    if (zsyn) {
      zsyn.addEventListener('click', e => {
        const el = e.target.closest('[data-syn-action]');
        if (!el) return;
        const action  = el.dataset.synAction;
        const onglet  = el.dataset.synOnglet || 'profils';
        const type    = el.dataset.synType   || '';
        const dispo   = el.dataset.synDispo  || '';
        if (action === 'changer-syn-tab') {
          _synTab = el.dataset.synTab;
          _bilanChantier = '';
          _rendreSynthese();
        } else if (action === 'toggle-profils-scope') {
          _synProfilsTous = !_synProfilsTous;
          _rendreSynthese();
        } else if (action === 'toggle-type') {
          const grp      = el.dataset.synTypeGroup;
          const expanded = el.textContent.trim() === '▶';
          el.textContent = expanded ? '▼' : '▶';
          el.style.color = expanded ? 'var(--vert)' : '';
          const row = el.closest('tr');
          if (row) row.classList.toggle('expanded', expanded);
          zsyn.querySelectorAll(`[data-syn-parent="${CSS.escape(grp)}"]`).forEach(tr => {
            tr.style.display = expanded ? '' : 'none';
          });
        } else if (action === 'voir-desig') {
          const desig = el.dataset.synDesig || '';
          _basculerOnglet('profils');
          const selType  = document.getElementById('p-type');
          const selDesig = document.getElementById('p-desig');
          if (selType && type) { selType.value = type; _peuplerDesignations(type); }
          if (selDesig && desig) selDesig.value = desig;
          _filtrer();
        } else if (action === 'voir-type') {
          _basculerOnglet(onglet);
          const selType = document.getElementById('p-type');
          if (selType && type) { selType.value = type; _peuplerDesignations(type); }
          _filtrer();
        } else if (action === 'voir-dispo') {
          _basculerOnglet(onglet);
          if (dispo) {
            const selDispo = document.getElementById(onglet === 'profils' ? 'p-dispo' : 't-dispo');
            if (selDispo) selDispo.value = dispo;
          }
          _filtrer();
        } else if (action === 'voir-epaisseur') {
          _basculerOnglet('toles');
          const ep = el.dataset.synEp;
          const selEp = document.getElementById('t-epaisseur');
          if (selEp && ep) selEp.value = ep;
          _filtrer();
        } else if (action === 'voir-bilan-chantier') {
          _bilanChantier = el.dataset.synChantier;
          _rendreSynthese();
        } else if (action === 'retour-bilan') {
          _bilanChantier = '';
          _rendreSynthese();
        }
      });

      // Seuils d'alerte tôles — sauvegarde au changement de la valeur
      zsyn.addEventListener('change', e => {
        const inp = e.target.closest('.syn-seuil-input');
        if (!inp) return;
        const ep = parseFloat(inp.dataset.ep);
        if (isNaN(ep)) return;
        _sauvegarderSeuil(ep, inp.value);
        _majAlerteSeuil();
        // Rafraîchir la ligne pour mettre à jour la couleur barre + icône état
        _rendreSynthese();
      });
    }

    // Filtres profilés
    ['p-type','p-desig','p-chantier','p-lieu','p-dispo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', _filtrer);
    });
    const prech = document.getElementById('p-recherche');
    if (prech) prech.addEventListener('input', _filtrer);

    // Filtres tôles
    ['t-type','t-epaisseur','t-chantier','t-lieu','t-dispo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', _filtrer);
    });
    const trech = document.getElementById('t-recherche');
    if (trech) trech.addEventListener('input', _filtrer);

    // Filtres archivées — cascade type → désignation
    const selAType = document.getElementById('a-type');
    if (selAType) selAType.addEventListener('change', () => {
      _peuplerDesignationsArchivees(selAType.value);
      _filtrer();
    });
    const selADesig = document.getElementById('a-desig');
    if (selADesig) selADesig.addEventListener('change', _filtrer);
    const arech = document.getElementById('a-recherche');
    if (arech) arech.addEventListener('input', _filtrer);

    // Reset filtres
    const rp = document.getElementById('btn-reset-profils');
    if (rp) rp.addEventListener('click', () => { _resetFiltres('profils'); _filtrer(); });
    const rt = document.getElementById('btn-reset-toles');
    if (rt) rt.addEventListener('click', () => { _resetFiltres('toles'); _filtrer(); });
    const ra = document.getElementById('btn-reset-archivees');
    if (ra) ra.addEventListener('click', () => { _resetFiltres('archivees'); _filtrer(); });

    // Export / Import CSV (admin)
    const btnExp = document.getElementById('btn-exporter');
    if (btnExp) btnExp.addEventListener('click', _exporterCSV);
    const btnImp = document.getElementById('btn-importer');
    if (btnImp) btnImp.addEventListener('click', _ouvrirImport);

    // Boutons impression PDF (toolbar de chaque onglet)
    ['btn-imprimer-profils', 'btn-imprimer-toles', 'btn-imprimer-archivees'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', _imprimerListe);
    });

    // Boutons ajout → ouvrir modales
    // Focus ligne au clic cellule
    const zoneTab = document.getElementById('tableau-stock');
    if (zoneTab) {
      zoneTab.addEventListener('click', e => {
        // Chip lieu → ouvrir plan
        const chipLieu = e.target.closest('.chip-lieu-btn');
        if (chipLieu) { e.stopPropagation(); _ouvrirCarte(chipLieu.dataset.lieu); return; }

        if (e.target.closest('button')) return;
        const tdEd = e.target.closest('td.cell-editable');
        if (tdEd) {
          if (!tdEd.classList.contains('editing')) _activerEditionInline(tdEd);
          return;
        }
        const td = e.target.closest('td');
        if (!td) return;
        const tr = td.closest('tr');
        if (!tr || tr.closest('thead')) return;
        const deja = tr.classList.contains('ligne-focus');
        zoneTab.querySelectorAll('tr.ligne-focus').forEach(r => r.classList.remove('ligne-focus'));
        if (!deja) tr.classList.add('ligne-focus');
      });
    }

    // Sélecteur de vue (Essentiel / Complet / Personnalisé)
    const panelCols = document.getElementById('panel-cols-profils');

    function _ouvrirPanelCols() {
      if (!panelCols) return;
      // Même source de vérité que le rendu du tableau
      const vis = _chargerColsVis();
      panelCols.innerHTML = '<div class="panel-cols-titre">Colonnes visibles</div>'
        + COLS_PROFILS.map(c =>
          `<label><input type="checkbox" data-col="${c.key}"${vis[c.key] ? ' checked' : ''}> ${c.label}</label>`
        ).join('');
      panelCols.classList.add('open');
    }

    function _syncBoutonsVue() {
      const mode = _getModeVue();
      ['essentiel','complet','personnalise'].forEach(m => {
        const el = document.getElementById(`btn-vue-${m}`);
        if (el) el.classList.toggle('active', m === mode);
      });
      if (panelCols) panelCols.classList.remove('open');
    }

    ['essentiel','complet','personnalise'].forEach(mode => {
      const btn = document.getElementById(`btn-vue-${mode}`);
      if (!btn) return;
      btn.addEventListener('click', e => {
        if (mode === 'personnalise') {
          e.stopPropagation();
          // Si déjà actif → toggle panel
          if (_getModeVue() === 'personnalise') {
            panelCols?.classList.contains('open')
              ? panelCols.classList.remove('open')
              : _ouvrirPanelCols();
            return;
          }
          // Passage en mode perso : snapshot de l'affichage courant
          // pour que les checkboxes soient toujours en accord avec ce qui est affiché
          _sauverColsVis(_chargerColsVis());
          _setModeVue('personnalise');
          _syncBoutonsVue();
          _filtrer();
          _ouvrirPanelCols();
          return;
        }
        _setModeVue(mode);
        _syncBoutonsVue();
        _filtrer();
      });
    });

    if (panelCols) {
      panelCols.addEventListener('change', e => {
        if (e.target.type !== 'checkbox') return;
        const vis = _chargerColsVis();
        vis[e.target.dataset.col] = e.target.checked;
        _sauverColsVis(vis);
        _filtrer();
      });
      document.addEventListener('click', e => {
        if (!panelCols.contains(e.target) && !e.target.closest('#btn-vue-personnalise')) {
          panelCols.classList.remove('open');
        }
      });
    }

    _syncBoutonsVue();

    // ── Sélecteur de vue tôles (Essentiel / Complet / Personnalisé) ──
    const panelColsToles = document.getElementById('panel-cols-toles');

    function _ouvrirPanelColsToles() {
      if (!panelColsToles) return;
      const vis = _chargerColsVisToles();
      panelColsToles.innerHTML = '<div class="panel-cols-titre">Colonnes visibles</div>'
        + COLS_TOLES.map(c =>
          `<label><input type="checkbox" data-col-t="${c.key}"${vis[c.key] ? ' checked' : ''}> ${c.label}</label>`
        ).join('');
      panelColsToles.classList.add('open');
    }

    function _syncBoutonsVueToles() {
      const mode = _getModeVueToles();
      ['essentiel','complet','personnalise'].forEach(m => {
        const el = document.getElementById(`btn-t-vue-${m}`);
        if (el) el.classList.toggle('active', m === mode);
      });
      if (panelColsToles) panelColsToles.classList.remove('open');
    }

    ['essentiel','complet','personnalise'].forEach(mode => {
      const btn = document.getElementById(`btn-t-vue-${mode}`);
      if (!btn) return;
      btn.addEventListener('click', e => {
        if (mode === 'personnalise') {
          e.stopPropagation();
          if (_getModeVueToles() === 'personnalise') {
            panelColsToles?.classList.contains('open')
              ? panelColsToles.classList.remove('open')
              : _ouvrirPanelColsToles();
            return;
          }
          _sauverColsVisToles(_chargerColsVisToles());
          _setModeVueToles('personnalise');
          _syncBoutonsVueToles();
          _filtrer();
          _ouvrirPanelColsToles();
          return;
        }
        _setModeVueToles(mode);
        _syncBoutonsVueToles();
        _filtrer();
      });
    });

    if (panelColsToles) {
      panelColsToles.addEventListener('change', e => {
        if (e.target.type !== 'checkbox') return;
        const vis = _chargerColsVisToles();
        vis[e.target.dataset.colT] = e.target.checked;
        _sauverColsVisToles(vis);
        _filtrer();
      });
      document.addEventListener('click', e => {
        if (!panelColsToles.contains(e.target) && !e.target.closest('#btn-t-vue-personnalise')) {
          panelColsToles.classList.remove('open');
        }
      });
    }

    _syncBoutonsVueToles();

    const btnProfil = document.getElementById('btn-ajout-profil');
    if (btnProfil) btnProfil.addEventListener('click', () => _ouvrirModaleAjoutProfil());

    ['btn-ajout-tole','btn-ajout-tole-tab'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => _ouvrirModaleAjoutTole());
    });
  }


  /* ──────────────────────────────────────────────────────────────
     INITIALISATION DES MODALES
     ────────────────────────────────────────────────────────────── */

  /**
   * Branche tous les écouteurs des modales après le chargement du DOM
   */
  function _initialiserModales() {
    // Fermeture au clic sur le fond
    document.querySelectorAll('.modale-bg').forEach(bg => {
      bg.addEventListener('click', e => {
        if (e.target === bg) _fermerModale(bg.id);
      });
    });

    // ── Modale ajout profilé ──────────────────────────────────
    const mAP = document.getElementById('m-ajout-profil');
    if (mAP) {
      const selType  = mAP.querySelector('#ap-type');
      const selDesig = mAP.querySelector('#ap-desig');
      const inpLong  = mAP.querySelector('#ap-longueur');

      if (selType)  selType.addEventListener('change',  () => _apMajDesig(mAP));
      if (selDesig) selDesig.addEventListener('change', () => _apMajSchema(mAP));
      if (inpLong)  inpLong.addEventListener('input',   () => _apMajPoids(mAP));

      // Tabs inventaire / commande
      mAP.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          mAP.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const mode = tab.dataset.mode;
          mAP.dataset.modeAjout = mode;
          document.getElementById('ap-panel-inventaire').style.display = mode === 'inventaire' ? '' : 'none';
          document.getElementById('ap-panel-commande').style.display   = mode === 'commande'   ? '' : 'none';
          // Note de statut sur les deux panels
          _majNoteStatut(mAP, '.ap-note-statut');
          _majNoteStatut(mAP, '.ap-note-statut-cmd');
        });
      });

      // Bouton toggle schéma
      const btnToggleSchemaAP = mAP.querySelector('#ap-toggle-schema');
      if (btnToggleSchemaAP) {
        btnToggleSchemaAP.addEventListener('click', () => {
          const zoneSchema = mAP.querySelector('#ap-schema');
          if (!zoneSchema) return;
          const open = zoneSchema.style.display !== 'none';
          zoneSchema.style.display = open ? 'none' : 'flex';
          btnToggleSchemaAP.textContent = open
            ? '▶ Voir schéma et caractéristiques'
            : '▼ Masquer schéma et caractéristiques';
        });
      }

      // Bouton "+ Ajouter une référence"
      const btnAjLigne = mAP.querySelector('#ap-cmd-ajouter-ligne');
      if (btnAjLigne) btnAjLigne.addEventListener('click', () => {
        _ajouterLigneCommande(mAP.querySelector('#ap-cmd-tbody'));
      });

      // Délégation type → désig sur les lignes commande
      const tbody = mAP.querySelector('#ap-cmd-tbody');
      if (tbody) tbody.addEventListener('change', e => {
        if (e.target.classList.contains('cmd-type')) {
          const tr = e.target.closest('tr');
          if (tr) _apMajDesigLigne(tr);
        }
      });

      const btnSoumettre = mAP.querySelector('.btn-soumettre');
      if (btnSoumettre) btnSoumettre.addEventListener('click', () => _soumettreAjoutProfil(mAP));
    }

    // ── Modale ajout tôle ─────────────────────────────────────
    const mAT = document.getElementById('m-ajout-tole');
    if (mAT) {
      ['#at-epaisseur','#at-largeur','#at-longueur','#at-quantite'].forEach(sel => {
        const el = mAT.querySelector(sel);
        if (el) el.addEventListener('input', () => _atMajApercu(mAT));
      });
      const btnSoumettre = mAT.querySelector('.btn-soumettre');
      if (btnSoumettre) btnSoumettre.addEventListener('click', () => _soumettreAjoutTole(mAT));
    }

    // ── Modale sortie tôle ────────────────────────────────────
    const mST = document.getElementById('m-sortie-tole');
    if (mST) {
      const chkChute = mST.querySelector('#st-avec-chute');
      const zoneCh   = mST.querySelector('#st-zone-chute');
      if (chkChute && zoneCh) {
        chkChute.addEventListener('change', () => {
          zoneCh.style.display = chkChute.checked ? '' : 'none';
        });
      }
      const btnConfirmer = mST.querySelector('.btn-confirmer-sortie');
      if (btnConfirmer) btnConfirmer.addEventListener('click', _confirmerSortieTole);
      mST.addEventListener('click', e => { if (e.target === mST) _fermerModale('m-sortie-tole'); });
    }

    // ── Modale modification ───────────────────────────────────
    const mMod = document.getElementById('m-modification');
    if (mMod) {
      const inpLong = mMod.querySelector('#mod-longueur');
      if (inpLong) inpLong.addEventListener('input', () => _apMajPoids(mMod, '#mod-longueur'));

      const btnSoumettre = mMod.querySelector('.btn-soumettre');
      if (btnSoumettre) btnSoumettre.addEventListener('click', () => _soumettreModification(mMod));
    }

    // ── Modal résumé réception commande ──────────────────────
    const mResume = document.getElementById('m-reception-resume');
    if (mResume) {
      const btnFermer = mResume.querySelector('#btn-resume-fermer');
      if (btnFermer) btnFermer.addEventListener('click', () => _fermerModale('m-reception-resume'));
    }

    // ── Modale demande d'attribution ──────────────────────────
    const mDem = document.getElementById('m-demande');
    if (mDem) {
      const btnSoumettre = mDem.querySelector('.btn-soumettre');
      if (btnSoumettre) btnSoumettre.addEventListener('click', () => _soumettreDemande(mDem));
    }

    // ── Modale validation stock (Conv. 6) ─────────────────────
    const mVS = document.getElementById('m-valider-stock');
    if (mVS) {
      const btnValider = mVS.querySelector('.btn-valider-confirmer');
      const btnRefuser = mVS.querySelector('.btn-refuser-depuis-valider');
      if (btnValider) btnValider.addEventListener('click', _confirmerValidationStock);
      if (btnRefuser) btnRefuser.addEventListener('click', () => {
        const id = mVS.dataset.idEnCours;
        _fermerModale('m-valider-stock');
        refuserElement(id);
      });
    }

    // ── Modale validation demande (Conv. 6) ───────────────────
    const mVD = document.getElementById('m-valider-demande');
    if (mVD) {
      const btnValider = mVD.querySelector('.btn-valider-confirmer');
      const btnRefuser = mVD.querySelector('.btn-refuser-depuis-valider');
      if (btnValider) btnValider.addEventListener('click', _confirmerValidationDemande);
      if (btnRefuser) btnRefuser.addEventListener('click', () => {
        const id = mVD.dataset.idEnCours;
        _fermerModale('m-valider-demande');
        refuserElement(id);
      });
    }

    // ── Modale confirmation refus (Conv. 6) ───────────────────
    const mConf = document.getElementById('m-confirmation');
    if (mConf) {
      const btnConfirmer = mConf.querySelector('.btn-confirmer-refus');
      const btnAnnuler   = mConf.querySelector('.btn-annuler-refus');
      if (btnConfirmer) btnConfirmer.addEventListener('click', _confirmerRefus);
      if (btnAnnuler)   btnAnnuler.addEventListener('click',   () => _fermerModale('m-confirmation'));
    }

    // ── Modale suppression ────────────────────────────────────
    const mModSup = document.getElementById('m-modification');
    if (mModSup) {
      const btnSup = mModSup.querySelector('.btn-supprimer-barre');
      if (btnSup) btnSup.addEventListener('click', () => {
        const id = mModSup.dataset.idEnCours;
        if (id) _ouvrirConfirmationSuppression(id);
      });
    }

    const mSup = document.getElementById('m-supprimer');
    if (mSup) {
      const btnConfirmer = mSup.querySelector('.btn-confirmer-sup');
      const btnAnnuler   = mSup.querySelector('.btn-annuler-sup');
      if (btnConfirmer) btnConfirmer.addEventListener('click', _confirmerSuppression);
      if (btnAnnuler)   btnAnnuler.addEventListener('click',   () => _fermerModale('m-supprimer'));
    }

    // ── Modale historique barre ───────────────────────────────
    const mHist = document.getElementById('m-historique-barre');
    if (mHist) {
      const btnFermer = mHist.querySelector('.btn-fermer-hist');
      if (btnFermer) btnFermer.addEventListener('click', () => _fermerModale('m-historique-barre'));
    }

    // ── Modale import CSV ─────────────────────────────────────
    const mImport = document.getElementById('m-import');
    if (mImport) {
      // Fermeture fond + bouton annuler
      mImport.addEventListener('click', e => { if (e.target === mImport) _fermerModale('m-import'); });
      const btnAnnuler = mImport.querySelector('#import-btn-annuler');
      if (btnAnnuler) btnAnnuler.addEventListener('click', () => _fermerModale('m-import'));

      // Sélection fichier → activer bouton Analyser
      const fichierInput = mImport.querySelector('#import-fichier');
      if (fichierInput) {
        fichierInput.addEventListener('change', () => {
          const nom = fichierInput.files[0]?.name || '';
          mImport.querySelector('#import-nom-fichier').textContent = nom;
          mImport.querySelector('#import-btn-analyser').disabled = !nom;
          // Réinitialiser l'état d'analyse si on change de fichier
          mImport.querySelector('#import-resume').style.display        = 'none';
          mImport.querySelector('#import-avertissement').style.display = 'none';
          mImport.querySelector('#import-erreur').style.display        = 'none';
          mImport.querySelector('#import-btn-confirmer').style.display = 'none';
          mImport.querySelector('#import-btn-analyser').style.display  = '';
          _importData = null;
        });
      }

      // Drag & drop sur la zone
      const dropzone = mImport.querySelector('#import-dropzone');
      if (dropzone) {
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        dropzone.addEventListener('drop', e => {
          e.preventDefault();
          dropzone.classList.remove('drag-over');
          const f = e.dataTransfer.files[0];
          if (f && fichierInput) {
            // Affecter le fichier glissé à l'input
            const dt = new DataTransfer();
            dt.items.add(f);
            fichierInput.files = dt.files;
            fichierInput.dispatchEvent(new Event('change'));
          }
        });
      }

      // Boutons Analyser / Confirmer
      const btnAnalyser  = mImport.querySelector('#import-btn-analyser');
      const btnConfirmer = mImport.querySelector('#import-btn-confirmer');
      if (btnAnalyser)  btnAnalyser.addEventListener('click',  _analyserImport);
      if (btnConfirmer) btnConfirmer.addEventListener('click', _confirmerImport);
    }

    _attacherAdminStockage();
    _attacherAdminPlan();
    _attacherAdminChantiers();
    _attacherAdminFournisseurs();
    _attacherAdminDemandeurs();
    _attacherNavAdmin();

    // ── Modale modification — dispo ↔ chantier ────────────────────
    const mModAff = document.getElementById('m-modification');
    if (mModAff) {
      const selDispo   = mModAff.querySelector('#mod-dispo');
      const affWrap    = mModAff.querySelector('#mod-affectation-wrap');
      const inpAff     = mModAff.querySelector('#mod-affectation');
      const btnCreer   = mModAff.querySelector('#mod-btn-creer-chantier');
      const formNouv      = mModAff.querySelector('#mod-nouveau-chantier-form');
      const inpNomNouv    = mModAff.querySelector('#mod-new-chantier-nom');
      const inpAffaireNouv = mModAff.querySelector('#mod-new-chantier-affaire');
      const inpVilleNouv  = mModAff.querySelector('#mod-new-chantier-ville');
      const btnConf       = mModAff.querySelector('#mod-btn-confirmer-chantier');
      const btnAnn        = mModAff.querySelector('#mod-btn-annuler-chantier');

      function _majVisibiliteChantierMod() {
        const estAffecte = selDispo?.value === 'affecte';
        if (affWrap) affWrap.style.display = estAffecte ? '' : 'none';
        if (!estAffecte && inpAff) inpAff.value = '';
        if (formNouv) formNouv.style.display = 'none';
      }

      if (selDispo) selDispo.addEventListener('change', _majVisibiliteChantierMod);

      if (btnCreer) btnCreer.addEventListener('click', () => {
        if (formNouv) formNouv.style.display = '';
        if (inpAffaireNouv) inpAffaireNouv.value = '';
        if (inpVilleNouv)  inpVilleNouv.value  = '';
        if (inpNomNouv)    { inpNomNouv.value = ''; inpNomNouv.focus(); }
      });

      if (btnAnn) btnAnn.addEventListener('click', () => {
        if (formNouv) formNouv.style.display = 'none';
      });

      if (btnConf) btnConf.addEventListener('click', async () => {
        const nom     = inpNomNouv?.value?.trim();
        const affaire = inpAffaireNouv?.value?.trim() || null;
        const ville   = inpVilleNouv?.value?.trim()   || null;
        if (!nom) return;
        const res = await window.SB.inserer('chantiers', { nom, numero_affaire: affaire, ville, actif: true });
        if (res?.error) { alert('Erreur création chantier : ' + res.error.message); return; }
        const rows = await window.SB.lire('chantiers', { order: 'nom' });
        _chantiers = rows.filter(c => c.actif);
        _majDatalistChantiers();
        _peuplerSelectAffectation(inpAff, nom);
        if (formNouv) formNouv.style.display = 'none';
      });
    }
  }


  /* ──────────────────────────────────────────────────────────────
     MODALE AJOUT PROFILÉ
     ────────────────────────────────────────────────────────────── */

  /**
   * Ouvre la modale d'ajout de profilé et initialise le formulaire
   */
  function _ouvrirModaleAjoutProfil() {
    const m = document.getElementById('m-ajout-profil');
    if (!m) return;

    // Revenir au mode inventaire
    m.dataset.modeAjout = 'inventaire';
    m.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === 'inventaire'));
    document.getElementById('ap-panel-inventaire').style.display = '';
    document.getElementById('ap-panel-commande').style.display   = 'none';

    // Réinitialiser le formulaire inventaire
    m.querySelectorAll('#ap-panel-inventaire input:not([type=hidden]), #ap-panel-inventaire select, #ap-panel-inventaire textarea').forEach(el => {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });

    // Remplir les selects
    _remplirSelectType(m.querySelector('#ap-type'));
    _monterSelecteurLieu(m.querySelector('#ap-lieu'));

    // Cacher le schéma et la zone ID
    const schema = m.querySelector('#ap-schema');
    if (schema) schema.style.display = 'none';
    const zoneId = document.getElementById('ap-zone-id');
    if (zoneId) zoneId.style.display = 'none';
    delete m.dataset.idPrevu;

    // Reset désignations
    const selDesig = m.querySelector('#ap-desig');
    if (selDesig) selDesig.innerHTML = '<option value="">— Choisir le type d\'abord —</option>';

    // Réinitialiser le panel commande
    m.querySelectorAll('#ap-panel-commande input').forEach(el => { el.value = ''; });
    _monterPickerChantier('ap-cmd-chantier-picker', 'ap-cmd-chantier');
    _monterPickerFournisseur('ap-cmd-fournisseur-picker', 'ap-cmd-fournisseur');
    const tbody = m.querySelector('#ap-cmd-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      _ajouterLigneCommande(tbody); // une ligne vide par défaut
    }

    // Note de statut
    _majNoteStatut(m, '.ap-note-statut');
    _majNoteStatut(m, '.ap-note-statut-cmd');

    _ouvrirModale('m-ajout-profil');
  }

  /**
   * Met à jour les désignations selon le type sélectionné (modale ajout/modif)
   * @param {HTMLElement} m — modale
   * @param {string} selTypeId — sélecteur CSS du select type
   * @param {string} selDesigId — sélecteur CSS du select désignation
   */
  function _apMajDesig(m, selTypeId = '#ap-type', selDesigId = '#ap-desig') {
    const selType  = m.querySelector(selTypeId);
    const selDesig = m.querySelector(selDesigId);
    if (!selType || !selDesig) return;

    const type = selType.value;
    selDesig.innerHTML = '<option value="">— Choisir —</option>';

    if (!type) {
      const schema = m.querySelector('div[id$="-schema"]');
      if (schema) schema.style.display = 'none';
      return;
    }

    // Chercher les désignations dans sections.json — taille seule (ex: "140", "200")
    // sections.json stocke desig = "IPE A 140" → on extrait la partie après la série
    let desigs = [];
    if (_sections) {
      _sections.standard.forEach(f => {
        f.sections.forEach(s => {
          if (s.serie === type) {
            // Extraire la taille : supprimer le préfixe série + espace
            const taille = s.desig.startsWith(type + ' ')
              ? s.desig.slice(type.length + 1)
              : s.desig;
            if (!desigs.includes(taille)) desigs.push(taille);
          }
        });
      });
    }

    if (!desigs.length) {
      // Fallback : désignations déjà en stock
      desigs = [...new Set(
        _data.barres
          .filter(b => b.categorie === 'profil' && b.section_type === type)
          .map(b => b.designation)
      )].sort((a, b) => parseFloat(a) - parseFloat(b));
    }

    desigs.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = d;
      selDesig.appendChild(o);
    });

    // Mettre à jour le schéma/poids : désignation vient d'être réinitialisée
    _apMajSchema(m, selTypeId, selDesigId);
  }

  /**
   * Affiche le schéma SVG et les dimensions selon type + désignation
   * @param {HTMLElement} m — modale
   * @param {string} selTypeId
   * @param {string} selDesigId
   */
  function _apMajSchema(m, selTypeId = '#ap-type', selDesigId = '#ap-desig') {
    const type  = m.querySelector(selTypeId)?.value;
    const desig = m.querySelector(selDesigId)?.value;

    const zoneSchema  = m.querySelector('div[id$="-schema"]');
    const btnToggle   = m.querySelector('#ap-toggle-schema');
    if (!zoneSchema || !type || !desig) {
      if (zoneSchema)  zoneSchema.style.display = 'none';
      if (btnToggle)   btnToggle.style.display  = 'none';
      m.dataset.poidsml = '';
      _apMajPoids(m);
      return;
    }

    // Afficher le bouton toggle, garder le schéma masqué par défaut
    zoneSchema.style.display = 'none';
    if (btnToggle) {
      btnToggle.style.display = 'block';
      btnToggle.textContent   = '▶ Voir schéma et caractéristiques';
    }

    // Libellé
    const label = zoneSchema.querySelector('[id$="-schema-label"]');
    if (label) label.textContent = `${type} ${desig}`;

    // Image / SVG — même logique que la fiche section
    const SERIES_IMAGES = {
      'IPE': 'IPE.png', 'IPE A': 'IPEA.png', 'IPE O': 'IPEO.png',
      'IPE 750': 'IPE750.png', 'IPN': 'IPN.png',
      'HEA': 'HEA.png', 'HEA A': 'HEAA.png', 'HEB': 'HEB.png', 'HEM': 'HEM.png',
      'UPN': 'UPN.png', 'UPE': 'UPE.png',
      'L égale': 'Le.png', 'L inégale': 'Li.png',
      'SHS': 'SHS chaud.png', 'RHS': 'RHS chaud.png', 'CHS': 'CHS chaud.png',
      'Rond': 'Rond.png', 'Carré': 'Carre.png',
    };
    const nomFichier = SERIES_IMAGES[type] || null;
    const visuel = zoneSchema.querySelector('[id$="-visuel"]');

    if (visuel) {
      if (nomFichier) {
        visuel.innerHTML = `<img alt="${type} ${desig}" data-zoom="0"
          style="max-width:130px;max-height:130px;object-fit:contain;display:block;margin:0 auto;
                 cursor:zoom-in;border:1px solid var(--gris-clair);border-radius:3px;background:#f7f7f7;"
          onclick="profilZoomImage(this)">`;
        const imgEl = visuel.querySelector('img');
        if (imgEl) {
          imgEl.onerror = () => {
            visuel.innerHTML = profilSvgCote({ serie: type }, 130, 130);
          };
          imgEl.src = `../assets/profils/${nomFichier}`;
        }
      } else {
        visuel.innerHTML = profilSvgCote({ serie: type }, 130, 130);
      }
    }

    // Dimensions
    const dimsList = zoneSchema.querySelector('[id$="-dims-list"]');
    if (dimsList) {
      const dims = _getDims(type, desig);
      dimsList.innerHTML = dims
        ? profilDimsTableau(dims)
        : '<div style="color:#aaa;font-size:12px">Non disponible</div>';
      m.dataset.poidsml = dims ? dims.pml : '';
    }

    // Recalcul poids barre
    _apMajPoids(m);

    // Afficher l'ID généré si c'est la modale d'ajout (pas de modification)
    const zoneId  = document.getElementById('ap-zone-id');
    const spanId  = document.getElementById('ap-id-genere');
    if (zoneId && spanId && m.id === 'm-ajout-profil') {
      const nouvelId = _genererIdBarre();
      spanId.textContent    = nouvelId;
      m.dataset.idPrevu     = nouvelId; // mémorisé pour la soumission
      zoneId.style.display  = 'block';
    }
  }

  /**
   * Recalcule et affiche le poids de la barre
   * @param {HTMLElement} m — modale
   * @param {string} inpId — sélecteur de l'input longueur
   */
  function _apMajPoids(m, inpId = '#ap-longueur') {
    const inpLong = m.querySelector(inpId);
    const spanPoids = m.querySelector('[id$="-poids-calc"]');
    if (!inpLong || !spanPoids) return;

    const longueur = parseFloat(inpLong.value);
    const poidsml  = parseFloat(m.dataset.poidsml);

    if (!isNaN(longueur) && longueur > 0 && !isNaN(poidsml) && poidsml > 0) {
      spanPoids.textContent = `${(longueur * poidsml).toFixed(1)} kg`;
      spanPoids.style.color = 'var(--vert)';
    } else {
      spanPoids.textContent = '—';
      spanPoids.style.color = '#aaa';
    }
  }

  /**
   * Soumet le formulaire d'ajout de profilé
   * @param {HTMLElement} m — modale
   */
  async function _soumettreAjoutProfil(m) {
    if ((m.dataset.modeAjout || 'inventaire') === 'commande') {
      return _soumettreAjoutCommande(m);
    }

    const type        = m.querySelector('#ap-type')?.value?.trim();
    const desig       = m.querySelector('#ap-desig')?.value?.trim();
    const longueur    = parseFloat(m.querySelector('#ap-longueur')?.value);
    const lieu        = _lireLieu(m.querySelector('#ap-lieu'));
    const classe      = m.querySelector('#ap-classe')?.value?.trim() || '';
    const commentaire = m.querySelector('#ap-commentaire')?.value?.trim() || '';

    // Validation
    if (!type)    return _signalerErreur(m, '#ap-type',    'Le type de section est obligatoire');
    if (!desig)   return _signalerErreur(m, '#ap-desig',   'La désignation est obligatoire');
    if (!longueur || longueur <= 0) return _signalerErreur(m, '#ap-longueur', 'La longueur est obligatoire');

    const session = Auth.getSession();
    const isAdmin = Auth.hasRight('can_validate');

    const poidsml    = parseFloat(m.dataset.poidsml) || 0;
    const poidsBarre = poidsml > 0 ? Math.round(longueur * poidsml * 10) / 10 : null;
    const nouvelleId = m.dataset.idPrevu || _genererIdBarre();

    const barre = {
      id: nouvelleId,
      categorie: 'profil',
      section_type: type,
      designation: desig,
      longueur_m: longueur,
      poids_ml: poidsml,
      poids_barre_kg: poidsBarre,
      chantier_origine: null,
      lieu_stockage: lieu,
      disponibilite: 'disponible',
      chantier_affectation: null,
      classe_acier: classe || null,
      ref_commande: null,
      fournisseur: null,
      statut: isAdmin ? 'valide' : 'en_attente',
      date_ajout: _dateAujourdhui(),
      ajoute_par: session?.identifiant || 'inconnu',
      valide_par: isAdmin ? session?.identifiant : null,
      date_validation: isAdmin ? _dateAujourdhui() : null,
      commentaire,
    };

    const enLigne = await _persisterElement(barre);
    await _enregistrerHistorique(nouvelleId, 'ENTREE', null, longueur, null, session?.identifiant || null, null, commentaire || null, barre.lieu_stockage || null);

    _fermerModale('m-ajout-profil');
    _peuplerFiltres();
    _filtrer();
    _majAlerteAttente();

    const msg = isAdmin
      ? `Profilé ${type} ${desig} ajouté (${nouvelleId})`
      : `Profilé ${type} ${desig} soumis pour validation`;
    _notif(msg + (enLigne ? '' : ' — ⚠ mode hors ligne'), isAdmin ? (enLigne ? 'succes' : 'alerte') : 'info');
  }

  /**
   * Soumet le formulaire en mode réception commande :
   * crée une barre individuelle pour chaque unité de chaque ligne.
   */
  async function _soumettreAjoutCommande(m) {
    const chantier    = m.querySelector('#ap-cmd-chantier')?.value?.trim()    || '';
    const refCmd      = m.querySelector('#ap-cmd-ref')?.value?.trim()         || '';
    const fournisseur = m.querySelector('#ap-cmd-fournisseur')?.value?.trim() || '';

    const lignes = [...m.querySelectorAll('#ap-cmd-tbody .cmd-ligne')];
    if (!lignes.length) return _notif('Ajoutez au moins une ligne', 'erreur');

    // Validation globale avant création
    for (const [i, ligne] of lignes.entries()) {
      const type  = ligne.querySelector('.cmd-type')?.value?.trim();
      const desig = ligne.querySelector('.cmd-desig')?.value?.trim();
      const lng   = parseFloat(ligne.querySelector('.cmd-longueur')?.value);
      const qte   = parseInt(ligne.querySelector('.cmd-qte')?.value) || 0;
      if (!type || !desig) return _notif(`Ligne ${i+1} : type et désignation obligatoires`, 'erreur');
      if (!lng || lng <= 0) return _notif(`Ligne ${i+1} : longueur invalide`, 'erreur');
      if (qte < 1)         return _notif(`Ligne ${i+1} : quantité invalide`, 'erreur');
    }

    const session = Auth.getSession();
    const isAdmin = Auth.hasRight('can_validate');

    // Résumé par ligne pour affichage post-soumission
    const resumeLignes = [];
    let toutEnLigne = true;

    for (const ligne of lignes) {
      const type     = ligne.querySelector('.cmd-type')?.value?.trim();
      const desig    = ligne.querySelector('.cmd-desig')?.value?.trim();
      const classe   = ligne.querySelector('.cmd-classe')?.value?.trim() || '';
      const longueur = parseFloat(ligne.querySelector('.cmd-longueur')?.value);
      const qte      = parseInt(ligne.querySelector('.cmd-qte')?.value) || 1;
      const lieu     = _lireLieu(ligne.querySelector('.cmd-lieu-csc'))  || '';

      const dims    = _getDims(type, desig);
      const poidsml = dims?.pml || 0;

      const idsLigne = [];
      for (let i = 0; i < qte; i++) {
        const nouvelleId = _genererIdBarre();
        const poidsBarre = poidsml > 0 ? Math.round(longueur * poidsml * 10) / 10 : null;

        const barre = {
          id: nouvelleId,
          categorie: 'profil',
          section_type: type,
          designation: desig,
          longueur_m: longueur,
          poids_ml: poidsml,
          poids_barre_kg: poidsBarre,
          chantier_origine: chantier || null,
          lieu_stockage: lieu,
          disponibilite: chantier ? 'affecte' : 'disponible',
          chantier_affectation: chantier || null,
          classe_acier: classe || null,
          ref_commande: refCmd || null,
          fournisseur: fournisseur || null,
          statut: isAdmin ? 'valide' : 'en_attente',
          date_ajout: _dateAujourdhui(),
          ajoute_par: session?.identifiant || 'inconnu',
          valide_par: isAdmin ? session?.identifiant : null,
          date_validation: isAdmin ? _dateAujourdhui() : null,
          commentaire: '',
        };

        const ok = await _persisterElement(barre);
        if (!ok) toutEnLigne = false;
        await _enregistrerHistorique(nouvelleId, 'ENTREE', null, longueur, chantier || null, session?.identifiant || null, null, refCmd || null, barre.lieu_stockage || null);
        idsLigne.push(nouvelleId);
      }

      resumeLignes.push({ type, desig, classe, longueur, qte, ids: idsLigne });
    }

    _fermerModale('m-ajout-profil');
    _peuplerFiltres();
    _filtrer();
    _majAlerteAttente();

    if (!toutEnLigne) _notif('⚠ Sauvegarde en mode hors ligne — données non synchronisées', 'alerte');

    // Afficher le résumé interactif
    _afficherResumeReception(resumeLignes, chantier, refCmd, fournisseur);
  }

  /**
   * Affiche le modal de résumé après une réception de commande.
   * Permet à l'opérateur de noter les IDs et de filtrer directement.
   */
  function _afficherResumeReception(resumeLignes, chantier, refCmd, fournisseur) {
    const m = document.getElementById('m-reception-resume');
    if (!m) return;

    // En-tête récapitulatif
    const entete = m.querySelector('#resume-entete');
    const parts = [];
    if (chantier)    parts.push(`Chantier : <strong>${_e(chantier)}</strong>`);
    if (refCmd)      parts.push(`Réf. : <strong>${_e(refCmd)}</strong>`);
    if (fournisseur) parts.push(`Fournisseur : <strong>${_e(fournisseur)}</strong>`);
    entete.innerHTML = parts.length
      ? parts.join(' &nbsp;·&nbsp; ')
      : '<em>Réception sans chantier défini</em>';

    // Tableau des lignes
    const tbody = m.querySelector('#resume-tbody');
    tbody.innerHTML = '';
    resumeLignes.forEach(({ type, desig, classe, longueur, qte, ids }) => {
      const tr = document.createElement('tr');
      const idBadges = ids.map(id => `<span class="chip-id">${_e(id)}</span>`).join(' ');
      tr.innerHTML = `
        <td><strong>${_e(type)}</strong></td>
        <td>${_e(desig)}</td>
        <td>${classe ? `<span class="badge-classe-acier">${_e(classe)}</span>` : '—'}</td>
        <td>${longueur.toFixed(2)} m</td>
        <td style="text-align:center">${qte}</td>
        <td class="td-ids-resume">${idBadges}</td>
      `;
      tbody.appendChild(tr);
    });

    // Bouton "Voir dans le stock"
    const btnFiltrer = m.querySelector('#btn-resume-filtrer');
    if (btnFiltrer) {
      if (chantier) {
        btnFiltrer.style.display = '';
        btnFiltrer.onclick = () => {
          _fermerModale('m-reception-resume');
          _basculerOnglet('profils');
          const sel = document.getElementById('p-chantier');
          if (sel) { sel.value = chantier; _filtrer(); }
        };
      } else {
        btnFiltrer.style.display = 'none';
      }
    }

    _ouvrirModale('m-reception-resume');
  }

  /**
   * Ajoute une ligne vide dans le tableau de saisie commande.
   * @param {HTMLTableSectionElement} tbody
   */
  function _ajouterLigneCommande(tbody) {
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = 'cmd-ligne';

    // Select type
    const selType = document.createElement('select');
    selType.className = 'cmd-type';
    _remplirSelectType(selType);

    // Select désignation (vide au départ)
    const selDesig = document.createElement('select');
    selDesig.className = 'cmd-desig';
    selDesig.innerHTML = '<option value="">— d\'abord le type —</option>';

    // Select classe acier
    const selClasse = document.createElement('select');
    selClasse.className = 'cmd-classe';
    ['', 'S235', 'S275', 'S355', 'S420', 'S460', 'S690'].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v || '—';
      selClasse.appendChild(o);
    });

    // Input longueur
    const inpLong = document.createElement('input');
    inpLong.type = 'number'; inpLong.className = 'cmd-longueur';
    inpLong.placeholder = '6.00'; inpLong.step = '0.01'; inpLong.min = '0.01';

    // Input quantité
    const inpQte = document.createElement('input');
    inpQte.type = 'number'; inpQte.className = 'cmd-qte';
    inpQte.value = '1'; inpQte.min = '1'; inpQte.step = '1';

    // Sélecteur lieu en cascade
    const selLieu = document.createElement('span');
    selLieu.className = 'cmd-lieu-csc lieu-cascade';
    _monterSelecteurLieu(selLieu);

    // Bouton suppression
    const btnDel = document.createElement('button');
    btnDel.type = 'button'; btnDel.className = 'btn-suppr-ligne'; btnDel.title = 'Supprimer';
    btnDel.textContent = '✕';
    btnDel.addEventListener('click', () => {
      tr.remove();
      // Toujours garder au moins une ligne
      if (!tbody.querySelector('.cmd-ligne')) _ajouterLigneCommande(tbody);
    });

    [selType, selDesig, selClasse, inpLong, inpQte, selLieu, btnDel].forEach(el => {
      const td = document.createElement('td');
      td.appendChild(el);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  /**
   * Met à jour le select désignation d'une ligne commande après changement de type.
   * @param {HTMLTableRowElement} tr
   */
  function _apMajDesigLigne(tr) {
    const type     = tr.querySelector('.cmd-type')?.value;
    const selDesig = tr.querySelector('.cmd-desig');
    if (!selDesig) return;

    selDesig.innerHTML = '<option value="">— Choisir —</option>';
    if (!type) return;

    let desigs = [];
    if (_sections?.standard) {
      _sections.standard.forEach(f => {
        f.sections.forEach(s => {
          if (s.serie === type) {
            const taille = s.desig.startsWith(type + ' ') ? s.desig.slice(type.length + 1) : s.desig;
            if (!desigs.includes(taille)) desigs.push(taille);
          }
        });
      });
    }
    if (!desigs.length) {
      desigs = [...new Set(_data.barres.filter(b => b.categorie === 'profil' && b.section_type === type).map(b => b.designation))].sort((a, b) => parseFloat(a) - parseFloat(b));
    }
    desigs.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = d;
      selDesig.appendChild(o);
    });
  }


  /* ──────────────────────────────────────────────────────────────
     MODALE AJOUT TÔLE
     ────────────────────────────────────────────────────────────── */

  function _ouvrirModaleAjoutTole() {
    const m = document.getElementById('m-ajout-tole');
    if (!m) return;

    // Réinitialiser
    m.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(el => { el.value = ''; });
    m.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });
    const chute = m.querySelector('#at-chute');
    if (chute) chute.checked = false;
    // Remettre quantite à 1
    const qty = m.querySelector('#at-quantite');
    if (qty) qty.value = '1';

    _monterSelecteurLieu(m.querySelector('#at-lieu'));
    _monterPickerChantier('at-chantier-picker', 'at-chantier');
    _majNoteStatut(m, '.at-note-statut');
    _atMajApercu(m);

    _ouvrirModale('m-ajout-tole');
  }

  /**
   * Met à jour l'aperçu poids et dimensions dans la modale tôle
   * @param {HTMLElement} m
   */
  function _atMajApercu(m) {
    const ep  = parseFloat(m.querySelector('#at-epaisseur')?.value);
    const lrg = parseFloat(m.querySelector('#at-largeur')?.value);
    const lng = parseFloat(m.querySelector('#at-longueur')?.value);
    const qty = parseInt(m.querySelector('#at-quantite')?.value) || 1;

    const spanEp   = m.querySelector('#at-aff-ep');
    const spanLrg  = m.querySelector('#at-aff-lrg');
    const spanLng  = m.querySelector('#at-aff-lng');
    const spanQty  = m.querySelector('#at-aff-qty');
    const spanSurf = m.querySelector('#at-aff-surf');
    const spanPds  = m.querySelector('#at-aff-poids');
    const spanTot  = m.querySelector('#at-aff-total');

    if (spanEp)  spanEp.textContent  = !isNaN(ep)  ? `${ep} mm`  : '—';
    if (spanLrg) spanLrg.textContent = !isNaN(lrg) ? `${lrg} mm` : '—';
    if (spanLng) spanLng.textContent = !isNaN(lng) ? `${lng} mm` : '—';
    if (spanQty) spanQty.textContent = `${qty} pièce${qty > 1 ? 's' : ''}`;

    if (!isNaN(lrg) && !isNaN(lng)) {
      const sU = (lrg / 1000) * (lng / 1000);
      if (spanSurf) { spanSurf.textContent = `${(sU * qty).toFixed(2)} m² (${sU.toFixed(2)}/pièce)`; spanSurf.style.color = 'var(--vert)'; }
    } else {
      if (spanSurf) { spanSurf.textContent = '—'; spanSurf.style.color = '#aaa'; }
    }

    // Poids = épaisseur(m) × largeur(m) × longueur(m) × densité acier (kg/m³ = 7850)
    if (!isNaN(ep) && !isNaN(lrg) && !isNaN(lng)) {
      const pU = (ep / 1000) * (lrg / 1000) * (lng / 1000) * 7850;
      const pT = pU * qty;
      if (spanPds) { spanPds.textContent = `${pU.toFixed(1)} kg`; spanPds.style.color = 'var(--vert)'; }
      if (spanTot) { spanTot.textContent = `${pT.toFixed(1)} kg`; spanTot.style.color = 'var(--vert)'; }
    } else {
      if (spanPds) { spanPds.textContent = '—'; spanPds.style.color = '#aaa'; }
      if (spanTot) { spanTot.textContent = '—'; spanTot.style.color = '#aaa'; }
    }
  }

  /**
   * Soumet le formulaire d'ajout de tôle
   * @param {HTMLElement} m
   */
  async function _soumettreAjoutTole(m) {
    const ep   = parseFloat(m.querySelector('#at-epaisseur')?.value);
    const lrg  = parseFloat(m.querySelector('#at-largeur')?.value);
    const lng  = parseFloat(m.querySelector('#at-longueur')?.value);
    const qty  = parseInt(m.querySelector('#at-quantite')?.value) || 1;
    const type    = m.querySelector('#at-type-tole')?.value?.trim() || '';
    const refCmd  = m.querySelector('#at-ref-cmd')?.value?.trim() || '';
    const isChute = m.querySelector('#at-chute')?.checked || false;
    const chantier    = m.querySelector('#at-chantier')?.value?.trim();
    const lieu        = _lireLieu(m.querySelector('#at-lieu'));
    const dispo       = m.querySelector('#at-dispo')?.value || 'disponible';
    const commentaire = m.querySelector('#at-commentaire')?.value?.trim() || '';

    // Validation
    if (isNaN(ep)  || ep  <= 0) return _signalerErreur(m, '#at-epaisseur',   'L\'épaisseur est obligatoire');
    if (isNaN(lrg) || lrg <= 0) return _signalerErreur(m, '#at-largeur',     'La largeur est obligatoire');
    if (isNaN(lng) || lng <= 0) return _signalerErreur(m, '#at-longueur',    'La longueur est obligatoire');
    if (!type)                   return _signalerErreur(m, '#at-type-tole',   'Le type de tôle est obligatoire');

    const session = Auth.getSession();
    const isAdmin = Auth.hasRight('can_validate');

    const poidsU = Math.round(((ep/1000)*(lrg/1000)*(lng/1000)*7850)*10)/10;
    const poidsT = Math.round(poidsU * qty * 10) / 10;
    const nouvelleId = _genererIdTole();

    const tole = {
      id: nouvelleId,
      categorie: 'tole',
      type_tole: type,
      epaisseur_mm: ep,
      largeur_mm: lrg,
      longueur_mm: lng,
      quantite: qty,
      is_chute: isChute,
      ref_commande: refCmd || null,
      poids_unitaire_kg: poidsU,
      poids_total_kg: poidsT,
      chantier_origine: chantier || 'Non renseigné',
      lieu_stockage: lieu,
      disponibilite: dispo,
      chantier_affectation: null,
      statut: isAdmin ? 'valide' : 'en_attente',
      date_ajout: _dateAujourdhui(),
      ajoute_par: session?.identifiant || 'inconnu',
      valide_par: isAdmin ? session?.identifiant : null,
      date_validation: isAdmin ? _dateAujourdhui() : null,
      commentaire
    };

    const enLigne = await _persisterElement(tole);
    await _enregistrerHistoriqueTole(nouvelleId, 'ENTREE', null, qty, chantier || null, session?.identifiant || null, commentaire || null, lieu || null);
    _fermerModale('m-ajout-tole');
    _peuplerFiltres();
    _filtrer();
    _majAlerteAttente();
    _majAlerteSeuil();

    const msg = isAdmin
      ? `Tôle ${ep}mm (${_LABEL_TYPE_TOLE[type] || type}) ajoutée (${nouvelleId})`
      : `Tôle ${ep}mm soumise pour validation`;
    _notif(msg + (enLigne ? '' : ' — ⚠ mode hors ligne'), isAdmin ? (enLigne ? 'succes' : 'alerte') : 'info');
  }


  /* ──────────────────────────────────────────────────────────────
     MODALE SORTIE CHANTIER (tôle)
     ────────────────────────────────────────────────────────────── */

  let _sortieToleId = null;

  function _ouvrirSortieTole(id) {
    const tole = _data?.barres.find(b => b.id === id && b.categorie === 'tole');
    if (!tole) return;
    _sortieToleId = id;

    const m = document.getElementById('m-sortie-tole');
    if (!m) return;

    // Info tôle
    const info = m.querySelector('#st-info-tole');
    if (info) {
      const surf = _surfaceTole(tole);
      info.innerHTML = `
        <strong>${_e(tole.id)}</strong> —
        ${_badgeTypeTole(tole.type_tole)}
        <strong>${tole.epaisseur_mm} mm</strong>,
        ${tole.largeur_mm} × ${tole.longueur_mm} mm${tole.ref_commande ? ` — Réf. <em>${_e(tole.ref_commande)}</em>` : ''}<br>
        Quantité disponible : <strong>${tole.quantite} pièce${tole.quantite > 1 ? 's' : ''}</strong>
        (surface : ${(surf * tole.quantite).toFixed(2)} m²)
      `;
    }

    // Quantité max
    const inputQty = m.querySelector('#st-qty-sortie');
    const spanMax  = m.querySelector('#st-qty-max');
    if (inputQty) { inputQty.value = '1'; inputQty.max = tole.quantite; }
    if (spanMax)  spanMax.textContent = `max ${tole.quantite}`;

    // Chute
    const chkChute = m.querySelector('#st-avec-chute');
    const zoneCh   = m.querySelector('#st-zone-chute');
    if (chkChute) chkChute.checked = false;
    if (zoneCh)   zoneCh.style.display = 'none';
    const cLrg = m.querySelector('#st-chute-lrg');
    const cLng = m.querySelector('#st-chute-lng');
    if (cLrg) cLrg.value = '';
    if (cLng) cLng.value = '';

    // Chantier
    _monterPickerChantier('st-chantier-picker', 'st-chantier');

    _ouvrirModale('m-sortie-tole');
  }

  async function _confirmerSortieTole() {
    const m = document.getElementById('m-sortie-tole');
    if (!m || !_sortieToleId) return;

    const tole = _data?.barres.find(b => b.id === _sortieToleId);
    if (!tole) return;

    const chantierDest = m.querySelector('#st-chantier')?.value?.trim();
    const qtySortie    = parseInt(m.querySelector('#st-qty-sortie')?.value) || 0;
    const avecChute    = m.querySelector('#st-avec-chute')?.checked || false;
    const chuteLrg     = parseFloat(m.querySelector('#st-chute-lrg')?.value);
    const chuteLng     = parseFloat(m.querySelector('#st-chute-lng')?.value);

    if (!chantierDest) return _signalerErreur(m, '#st-chantier', 'Chantier destination requis');
    if (qtySortie <= 0 || qtySortie > tole.quantite)
      return _signalerErreur(m, '#st-qty-sortie', `Quantité invalide (max ${tole.quantite})`);
    if (avecChute) {
      if (isNaN(chuteLrg) || chuteLrg <= 0) return _signalerErreur(m, '#st-chute-lrg', 'Largeur chute requise');
      if (isNaN(chuteLng) || chuteLng <= 0) return _signalerErreur(m, '#st-chute-lng', 'Longueur chute requise');
    }

    const session = Auth.getSession();
    const operateur = session?.identifiant || null;
    const nouvelleQty = tole.quantite - qtySortie;

    // 1 — Mettre à jour la tôle d'origine
    if (nouvelleQty <= 0) {
      // Archiver si plus rien en stock — enregistrer le chantier consommateur
      try {
        await window.SB.mettreAJour('stock', _sortieToleId, { quantite: 0, statut: 'archivee', chantier_affectation: chantierDest });
      } catch(e) { /* hors ligne */ }
      const b = _data.barres.find(x => x.id === _sortieToleId);
      if (b) { b.quantite = 0; b.statut = 'archivee'; b.chantier_affectation = chantierDest; }
      await _enregistrerHistoriqueTole(_sortieToleId, 'SORTIE',   tole.quantite, qtySortie,   chantierDest, operateur, null, tole.lieu_stockage || null);
      await _enregistrerHistoriqueTole(_sortieToleId, 'ARCHIVAGE', qtySortie,    0,            chantierDest, operateur, null, tole.lieu_stockage || null);
    } else {
      const poidsT = Math.round(tole.poids_unitaire_kg * nouvelleQty * 10) / 10;
      try {
        await window.SB.mettreAJour('stock', _sortieToleId, { quantite: nouvelleQty, poids_total_kg: poidsT });
      } catch(e) { /* hors ligne */ }
      const b = _data.barres.find(x => x.id === _sortieToleId);
      if (b) { b.quantite = nouvelleQty; b.poids_total_kg = poidsT; }

      // Créer un enregistrement archivé représentant la quantité consommée
      const poidsS   = Math.round(tole.poids_unitaire_kg * qtySortie * 10) / 10;
      const sortieId = _genererIdTole();
      const sortieObj = {
        id: sortieId,
        categorie: 'tole',
        type_tole: tole.type_tole,
        epaisseur_mm: tole.epaisseur_mm,
        largeur_mm: tole.largeur_mm,
        longueur_mm: tole.longueur_mm,
        quantite: qtySortie,
        is_chute: false,
        ref_commande: tole.ref_commande || null,
        seuil_surface_m2: null,
        poids_unitaire_kg: tole.poids_unitaire_kg,
        poids_total_kg: poidsS,
        chantier_origine: tole.chantier_origine || null,
        chantier_affectation: chantierDest,
        lieu_stockage: tole.lieu_stockage,
        disponibilite: 'disponible',
        statut: 'archivee',
        date_ajout: tole.date_ajout,
        ajoute_par: tole.ajoute_par || operateur || 'inconnu',
        valide_par: operateur,
        date_validation: _dateAujourdhui(),
        commentaire: `Sortie ${qtySortie} pièce${qtySortie > 1 ? 's' : ''} → chantier ${chantierDest} (depuis ${_sortieToleId})`
      };
      await _persisterElement(sortieObj);
      await _enregistrerHistoriqueTole(_sortieToleId, 'SORTIE', tole.quantite, nouvelleQty, chantierDest, operateur, null, tole.lieu_stockage || null);
    }

    // 2 — Créer la chute si demandée
    if (avecChute) {
      const poidsU = Math.round(((tole.epaisseur_mm/1000)*(chuteLrg/1000)*(chuteLng/1000)*7850)*10)/10;
      const chuteId = _genererIdTole();
      const chuteObj = {
        id: chuteId,
        categorie: 'tole',
        type_tole: tole.type_tole,
        epaisseur_mm: tole.epaisseur_mm,
        largeur_mm: chuteLrg,
        longueur_mm: chuteLng,
        quantite: 1,
        is_chute: true,
        ref_commande: tole.ref_commande || null,
        seuil_surface_m2: null,
        poids_unitaire_kg: poidsU,
        poids_total_kg: poidsU,
        chantier_origine: chantierDest,
        lieu_stockage: tole.lieu_stockage,
        disponibilite: 'disponible',
        chantier_affectation: null,
        statut: 'valide',
        date_ajout: _dateAujourdhui(),
        ajoute_par: operateur || 'inconnu',
        valide_par: operateur,
        date_validation: _dateAujourdhui(),
        commentaire: `Chute issue de ${_sortieToleId} — sortie chantier ${chantierDest}`
      };
      await _persisterElement(chuteObj);
    }

    _fermerModale('m-sortie-tole');
    _sortieToleId = null;
    _peuplerFiltres();
    _filtrer();
    _majAlerteSeuil();

    const msg = nouvelleQty <= 0
      ? `Tôle sortie et archivée (stock épuisé)`
      : `Sortie de ${qtySortie} pièce${qtySortie > 1 ? 's' : ''} — reste ${nouvelleQty}`;
    _notif(msg + (avecChute ? ' + chute créée' : ''), 'succes');
  }


  /* ──────────────────────────────────────────────────────────────
     MODALE MODIFICATION
     ────────────────────────────────────────────────────────────── */

  /* ──────────────────────────────────────────────────────────────
     ÉDITION INLINE
     ────────────────────────────────────────────────────────────── */

  function _activerEditionInline(td) {
    const tr    = td.closest('tr');
    const id    = tr?.dataset.id;
    const field = td.dataset.field;
    if (!id || !field) return;
    const item = _parId(id);
    if (!item) return;

    td.classList.add('editing');
    const originalHtml = td.innerHTML;

    // ── Cas particulier : lieu (cascade Rack → Allée → Étage) ──────
    if (field === 'lieu') {
      const wrapper = document.createElement('span');
      wrapper.className = 'lieu-cascade lieu-cascade-inline';
      _monterSelecteurLieu(wrapper, item.lieu_stockage || '');

      const annulerL = () => { td.innerHTML = originalHtml; td.classList.remove('editing'); };
      let savedL = false;
      const sauvegarderL = () => {
        if (savedL) return; savedL = true;
        td.classList.remove('editing');
        _sauvegarderInline(id, field, _lireLieu(wrapper), item.categorie);
      };

      // Zone plate : sauvegarder dès la sélection du rack
      wrapper.querySelector('.lieu-sel-rack')?.addEventListener('change', () => {
        const rNom = wrapper.querySelector('.lieu-sel-rack')?.value;
        const rack = _racks.find(r => r.nom === rNom);
        if (rack && (!rack.nb_allees || !rack.nb_etages)) sauvegarderL();
      });
      wrapper.querySelector('.lieu-sel-etage')?.addEventListener('change', sauvegarderL);
      wrapper.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); sauvegarderL(); }
        if (e.key === 'Escape') { e.preventDefault(); annulerL(); }
      });

      td.innerHTML = '';
      td.appendChild(wrapper);
      wrapper.querySelector('.lieu-sel-rack')?.focus();
      return;
    }

    let ctrl;
    if (field === 'dispo') {
      ctrl = document.createElement('select');
      ctrl.className = 'cell-inline-input';
      ctrl.innerHTML = `
          <option value="disponible"${item.disponibilite === 'disponible' ? ' selected' : ''}>Disponible</option>
          <option value="affecte"${item.disponibilite === 'affecte' ? ' selected' : ''}>Affecté</option>`;
    } else {
      ctrl = document.createElement('input');
      ctrl.className = 'cell-inline-input';
      if (field === 'longueur') {
        ctrl.type = 'number'; ctrl.step = '0.01'; ctrl.min = '0';
        ctrl.value = item.longueur_m ?? '';
      } else if (field === 'epaisseur') {
        ctrl.type = 'number'; ctrl.step = '0.5'; ctrl.min = '1';
        ctrl.value = item.epaisseur_mm ?? '';
      } else if (field === 'quantite') {
        ctrl.type = 'number'; ctrl.min = '1'; ctrl.step = '1';
        ctrl.value = item.quantite ?? 1;
      } else if (field === 'chantier') {
        ctrl = document.createElement('select');
        ctrl.className = 'cell-inline-input';
        ctrl.innerHTML = `<option value="">— Aucun —</option>` +
          _chantiers.map(c => {
            const label = [c.numero_affaire, c.ville, c.nom].filter(Boolean).join(' — ');
            const sel   = c.nom === item.chantier_affectation ? ' selected' : '';
            return `<option value="${_e(c.nom)}"${sel}>${_e(label)}</option>`;
          }).join('');
      } else if (field === 'commentaire') {
        ctrl.type = 'text';
        ctrl.value = item.commentaire ?? '';
        ctrl.placeholder = 'Commentaire…';
      }
    }

    const annuler = () => {
      td.innerHTML = originalHtml;
      td.classList.remove('editing');
    };

    let sauvegarde = false;
    const sauvegarder = () => {
      if (sauvegarde) return;
      sauvegarde = true;
      td.classList.remove('editing');
      _sauvegarderInline(id, field, ctrl.value, item.categorie);
    };

    ctrl.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); sauvegarder(); }
      if (e.key === 'Escape') { e.preventDefault(); annuler(); }
    });
    if (ctrl.tagName === 'SELECT') {
      ctrl.addEventListener('change', sauvegarder);
    } else {
      ctrl.addEventListener('blur', sauvegarder);
    }

    td.innerHTML = '';
    td.appendChild(ctrl);
    ctrl.focus();
    if (ctrl.select) ctrl.select();
  }

  async function _sauvegarderInline(id, field, rawVal, categorie) {
    const original = _parId(id);
    if (!original) return;
    const session = Auth.getSession();
    const isAdmin = Auth.hasRight('can_validate');

    let patch = {};
    if (categorie === 'profil') {
      if (field === 'longueur') {
        const longueur = parseFloat(rawVal);
        if (isNaN(longueur) || longueur < 0) { _filtrer(); return; }
        const poidsml = original.poids_ml || 0;
        const poidsBarre = poidsml > 0 ? Math.round(longueur * poidsml * 10) / 10 : original.poids_barre_kg;
        patch = { longueur_m: longueur, poids_barre_kg: poidsBarre };
      } else if (field === 'lieu') {
        patch = { lieu_stockage: rawVal || original.lieu_stockage };
      } else if (field === 'dispo') {
        if (rawVal === 'affecte') {
          // Chantier requis — ouvrir la modale complète
          _filtrer();
          Stock.ouvrirModification(id);
          _notif('Sélectionnez le chantier d\'affectation', 'info');
          return;
        }
        // Passage à disponible : effacer le chantier d'affectation
        patch = { disponibilite: rawVal, chantier_affectation: null };
      } else if (field === 'chantier') {
        patch = { chantier_affectation: rawVal || null };
      } else if (field === 'commentaire') {
        patch = { commentaire: rawVal };
      }
    } else {
      // tôle
      if (field === 'epaisseur') {
        const ep = parseFloat(rawVal);
        if (isNaN(ep) || ep <= 0) { _filtrer(); return; }
        const poidsU = Math.round(((ep/1000)*(original.largeur_mm/1000)*(original.longueur_mm/1000)*7850)*10)/10;
        patch = { epaisseur_mm: ep, poids_unitaire_kg: poidsU, poids_total_kg: Math.round(poidsU*(original.quantite||1)*10)/10 };
      } else if (field === 'quantite') {
        const qty = parseInt(rawVal) ?? 0;
        if (qty <= 0) {
          patch = { quantite: 0, statut: 'archivee' };
        } else {
          patch = { quantite: qty, poids_total_kg: Math.round(original.poids_unitaire_kg*qty*10)/10 };
        }
      } else if (field === 'lieu') {
        patch = { lieu_stockage: rawVal };
      } else if (field === 'dispo') {
        patch = { disponibilite: rawVal };
      }
    }

    if (!Object.keys(patch).length) { _filtrer(); return; }

    const modif = {
      ...original,
      ...patch,
      statut: original.statut === 'en_attente' ? 'en_attente' : (isAdmin ? 'valide' : 'en_attente'),
      valide_par:      isAdmin ? session?.identifiant : null,
      date_validation: isAdmin ? _dateAujourdhui() : null,
      date_modif:      _dateAujourdhui(),
      modifie_par:     session?.identifiant || 'inconnu'
    };

    const enLigne = await _persisterElement(modif);
    _notif('Modification enregistrée' + (enLigne ? '' : ' — ⚠ mode hors ligne'), enLigne ? 'succes' : 'alerte');

    if (original.categorie === 'profil') {
      const op  = session?.identifiant || null;
      const lieuActuel = original.lieu_stockage || null;
      if (field === 'longueur') {
        const longAvant = original.longueur_m;
        const longueur  = modif.longueur_m;
        if (longueur === 0) {
          await _enregistrerHistorique(id, 'ARCHIVAGE', longAvant, 0,
            original.chantier_origine || null, op, null, null, lieuActuel);
        } else if (longueur < longAvant) {
          await _enregistrerHistorique(id, 'RETOUR', longAvant, longueur,
            original.chantier_origine || null, op, null, null, lieuActuel);
        } else if (longueur !== longAvant) {
          await _enregistrerHistorique(id, 'MODIFICATION', longAvant, longueur,
            original.chantier_affectation || null, op, null, 'Correction longueur', lieuActuel);
        }
      } else if (field === 'chantier') {
        const chantier = rawVal || null;
        const type = chantier ? 'AFFECTATION' : 'RETOUR';
        await _enregistrerHistorique(id, type, original.longueur_m, original.longueur_m,
          chantier, op, null, null, lieuActuel);
      } else if (field === 'dispo') {
        const type = rawVal === 'affecte' ? 'AFFECTATION' : 'RETOUR';
        await _enregistrerHistorique(id, type, original.longueur_m, original.longueur_m,
          original.chantier_affectation || null, op, null, null, lieuActuel);
      } else if (field === 'lieu') {
        const nouveauLieu = rawVal || null;
        await _enregistrerHistorique(id, 'MODIFICATION', original.longueur_m, original.longueur_m,
          original.chantier_affectation || null, op, null, null, nouveauLieu);
      }
    }

    _filtrer();
  }

  /**
   * Ouvre la modale de modification et pré-remplit les champs
   * @param {string} id — id de la barre ou tôle
   */
  function ouvrirModification(id) {
    _selection = _parId(id);
    if (!_selection) return;

    if (_selection.categorie === 'profil') {
      _ouvrirModificationProfil(_selection);
    } else {
      _ouvrirModificationTole(_selection);
    }
  }

  function _ouvrirModificationProfil(barre) {
    const m = document.getElementById('m-modification');
    if (!m) return;

    // Titre modale
    const titre = m.querySelector('.modale-titre');
    if (titre) titre.textContent = 'Modifier la barre';

    // ── En-tête lecture seule ──
    const elId    = m.querySelector('#mod-display-id');
    const elType  = m.querySelector('#mod-display-type');
    const elDesig = m.querySelector('#mod-display-desig');
    const elLong  = m.querySelector('#mod-display-longueur');
    if (elId)    elId.textContent    = barre.id;
    if (elType)  elType.textContent  = barre.section_type;
    if (elDesig) elDesig.textContent = barre.designation;
    if (elLong)  elLong.textContent  = barre.longueur_m.toFixed(2) + ' m';

    // Bouton fiche section
    const btnFiche = m.querySelector('#mod-btn-fiche');
    if (btnFiche) btnFiche.onclick = () => Stock.ouvrirFicheSection(barre.section_type, barre.designation);

    // Chips métadonnées
    const metaDiv = m.querySelector('#mod-barre-meta');
    if (metaDiv) {
      const chips = [];
      if (barre.chantier_origine) chips.push(`<span class="mod-meta-chip"><strong>Origine :</strong>&nbsp;${_e(_labelChantier(barre.chantier_origine))}</span>`);
      if (barre.classe_acier)     chips.push(`<span class="mod-meta-chip"><strong>Classe :</strong>&nbsp;${_e(barre.classe_acier)}</span>`);
      if (barre.ref_commande)     chips.push(`<span class="mod-meta-chip"><strong>Réf :</strong>&nbsp;${_e(barre.ref_commande)}</span>`);
      if (barre.fournisseur)      chips.push(`<span class="mod-meta-chip"><strong>Fourn. :</strong>&nbsp;${_e(barre.fournisseur)}</span>`);
      metaDiv.innerHTML = chips.join('');
    }

    // ── Champs éditables ──
    _monterSelecteurLieu(m.querySelector('#mod-lieu'), barre.lieu_stockage || '');
    _setVal(m, '#mod-longueur',    barre.longueur_m);
    _setVal(m, '#mod-dispo',       barre.disponibilite);
    _peuplerSelectAffectation(m.querySelector('#mod-affectation'), barre.chantier_affectation || '');
    _setVal(m, '#mod-commentaire', barre.commentaire || '');
    _apMajPoids(m, '#mod-longueur');
    const affWrapMod = m.querySelector('#mod-affectation-wrap');
    if (affWrapMod) affWrapMod.style.display = barre.disponibilite === 'affecte' ? '' : 'none';
    const formNouvMod = m.querySelector('#mod-nouveau-chantier-form');
    if (formNouvMod) formNouvMod.style.display = 'none';

    // Stocker l'id et les données immuables
    m.dataset.idEnCours         = barre.id;
    m.dataset.categorieEnCours  = 'profil';
    m.dataset.poidsml           = barre.poids_ml || '';

    _majNoteStatut(m, '.mod-note-statut');
    _ouvrirModale('m-modification');
  }

  function _ouvrirModificationTole(tole) {
    const m = document.getElementById('m-modification');
    if (!m) return;

    // Utiliser le même formulaire mais en mode tôle
    const titre = m.querySelector('.modale-titre');
    if (titre) titre.textContent = `Modifier — Tôle ${tole.epaisseur_mm}mm (${tole.id})`;

    // Masquer les champs profilé, afficher les champs tôle
    const zoneProfil = m.querySelector('.mod-zone-profil');
    const zoneTole   = m.querySelector('.mod-zone-tole');
    if (zoneProfil) zoneProfil.style.display = 'none';
    if (zoneTole)   zoneTole.style.display   = 'block';

    _monterSelecteurLieu(m.querySelector('#mod-t-lieu'), tole.lieu_stockage || '');

    _setVal(m, '#mod-t-epaisseur',     tole.epaisseur_mm);
    _setVal(m, '#mod-t-largeur',       tole.largeur_mm);
    _setVal(m, '#mod-t-longueur',      tole.longueur_mm);
    _setVal(m, '#mod-t-type',          tole.type_tole || '');
    _setVal(m, '#mod-t-quantite',      tole.quantite);
    _setVal(m, '#mod-t-ref-cmd',  tole.ref_commande || '');
    _monterPickerChantier('mod-t-chantier-picker', 'mod-t-chantier', tole.chantier_origine || '');
    _setVal(m, '#mod-t-dispo',         tole.disponibilite);
    _setVal(m, '#mod-t-commentaire',   tole.commentaire || '');

    m.dataset.idEnCours = tole.id;
    m.dataset.categorieEnCours = 'tole';

    _majNoteStatut(m, '.mod-note-statut');
    _ouvrirModale('m-modification');
  }

  /**
   * Soumet la modification
   * @param {HTMLElement} m
   */
  async function _soumettreModification(m) {
    const categorie = m.dataset.categorieEnCours;
    const id        = m.dataset.idEnCours;
    const original  = _parId(id);
    if (!original) return;

    const session = Auth.getSession();
    const isAdmin = Auth.hasRight('can_validate');

    if (categorie === 'profil') {
      const longueur    = parseFloat(m.querySelector('#mod-longueur')?.value);
      const lieu        = _lireLieu(m.querySelector('#mod-lieu'));
      const dispo       = m.querySelector('#mod-dispo')?.value || 'disponible';
      const affectation = dispo === 'affecte' ? (m.querySelector('#mod-affectation')?.value?.trim() || null) : null;
      const commentaire = m.querySelector('#mod-commentaire')?.value?.trim() || '';

      // La longueur 0 est autorisée (déclenchera un archivage)
      if (isNaN(longueur) || longueur < 0) return _signalerErreur(m, '#mod-longueur', 'La longueur est obligatoire');
      if (dispo === 'affecte' && !affectation) return _signalerErreur(m, '#mod-affectation', 'Le chantier d\'affectation est obligatoire');

      const poidsml    = parseFloat(m.dataset.poidsml) || original.poids_ml || 0;
      const poidsBarre = poidsml > 0 ? Math.round(longueur * poidsml * 10) / 10 : original.poids_barre_kg;
      const estArchivage = longueur === 0;

      const modif = {
        ...original,
        longueur_m: longueur,
        poids_barre_kg: poidsBarre,
        lieu_stockage: lieu,
        disponibilite: dispo,
        chantier_affectation: affectation,
        commentaire,
        statut: estArchivage ? 'archivee' : (isAdmin ? 'valide' : 'en_attente'),
        valide_par: isAdmin ? session?.identifiant : null,
        date_validation: isAdmin ? _dateAujourdhui() : null,
        date_modif: _dateAujourdhui(),
        modifie_par: session?.identifiant || 'inconnu'
      };

      var _enLigneModif = await _persisterElement(modif);

      const longAvant = original.longueur_m;
      const op = session?.identifiant || null;
      if (estArchivage) {
        await _enregistrerHistorique(original.id, 'ARCHIVAGE', longAvant, 0,
          affectation || original.chantier_origine || null, op, null, commentaire || null, lieu || null);
      } else if (longueur < longAvant) {
        await _enregistrerHistorique(original.id, 'RETOUR', longAvant, longueur,
          original.chantier_origine || null, op, null, commentaire || null, lieu || null);
      } else if (longueur > longAvant) {
        await _enregistrerHistorique(original.id, 'MODIFICATION', longAvant, longueur,
          affectation || original.chantier_affectation || null, op, null, 'Correction longueur', lieu || null);
      } else if (dispo === 'affecte' && original.disponibilite !== 'affecte') {
        await _enregistrerHistorique(original.id, 'AFFECTATION', longAvant, longueur,
          affectation || null, op, null, commentaire || null, lieu || null);
      } else if (dispo === 'disponible' && original.disponibilite === 'affecte') {
        await _enregistrerHistorique(original.id, 'RETOUR', longAvant, longueur,
          original.chantier_affectation || null, op, null, commentaire || null, lieu || null);
      } else if (lieu !== original.lieu_stockage) {
        await _enregistrerHistorique(original.id, 'MODIFICATION', longAvant, longueur,
          affectation || original.chantier_affectation || null, op, null, null, lieu || null);
      }

    } else {
      // Modification tôle
      const ep   = parseFloat(m.querySelector('#mod-t-epaisseur')?.value);
      const lrg  = parseFloat(m.querySelector('#mod-t-largeur')?.value);
      const lng  = parseFloat(m.querySelector('#mod-t-longueur')?.value);
      const qty  = parseInt(m.querySelector('#mod-t-quantite')?.value) || 1;
      const type    = m.querySelector('#mod-t-type')?.value?.trim() || '';
      const refCmd  = m.querySelector('#mod-t-ref-cmd')?.value?.trim() || '';
      const chantier = m.querySelector('#mod-t-chantier')?.value?.trim();
      const lieu        = _lireLieu(m.querySelector('#mod-t-lieu'));
      const dispo       = m.querySelector('#mod-t-dispo')?.value || 'disponible';
      const commentaire = m.querySelector('#mod-t-commentaire')?.value?.trim() || '';

      if (isNaN(ep)  || ep  <= 0) return _signalerErreur(m, '#mod-t-epaisseur', 'L\'épaisseur est obligatoire');
      if (isNaN(lrg) || lrg <= 0) return _signalerErreur(m, '#mod-t-largeur',   'La largeur est obligatoire');
      if (isNaN(lng) || lng <= 0) return _signalerErreur(m, '#mod-t-longueur',  'La longueur est obligatoire');
      if (!type)                   return _signalerErreur(m, '#mod-t-type',      'Le type de tôle est obligatoire');

      const poidsU = Math.round(((ep/1000)*(lrg/1000)*(lng/1000)*7850)*10)/10;
      const poidsT = Math.round(poidsU * qty * 10) / 10;

      const modif = {
        ...original,
        type_tole: type,
        epaisseur_mm: ep,
        largeur_mm: lrg,
        longueur_mm: lng,
        quantite: qty,
        ref_commande: refCmd || null,
        poids_unitaire_kg: poidsU,
        poids_total_kg: poidsT,
        chantier_origine: chantier || original.chantier_origine,
        lieu_stockage: lieu,
        disponibilite: dispo,
        commentaire,
        statut: isAdmin ? 'valide' : 'en_attente',
        valide_par: isAdmin ? session?.identifiant : null,
        date_validation: isAdmin ? _dateAujourdhui() : null,
        date_modif: _dateAujourdhui(),
        modifie_par: session?.identifiant || 'inconnu'
      };

      _enLigneModif = await _persisterElement(modif);
      await _enregistrerHistoriqueTole(id, 'MODIFICATION', original.quantite, qty, modif.chantier_origine || null, session?.identifiant || null, commentaire || null, lieu || null);
      _majAlerteSeuil();
    }

    // Réafficher la zone correcte
    const zoneProfil = m.querySelector('.mod-zone-profil');
    const zoneTole   = m.querySelector('.mod-zone-tole');
    if (zoneProfil) zoneProfil.style.display = '';
    if (zoneTole)   zoneTole.style.display   = 'none';

    _fermerModale('m-modification');
    _peuplerFiltres();
    _filtrer();
    _majAlerteAttente();

    // Message adapté selon le type d'opération
    const estArch = categorie === 'profil' && parseFloat(m.querySelector('#mod-longueur')?.value) === 0;
    const msgBase = estArch
      ? 'Barre archivée'
      : (isAdmin ? 'Modification enregistrée' : 'Modification soumise pour validation');
    const typeNotif = _enLigneModif ? 'succes' : 'alerte';
    _notif(msgBase + (_enLigneModif ? '' : ' — ⚠ mode hors ligne'), typeNotif);
  }


  /* ──────────────────────────────────────────────────────────────
     MODALE DEMANDE D'ATTRIBUTION
     ────────────────────────────────────────────────────────────── */

  /**
   * Ouvre la modale de demande d'attribution
   * @param {string} id
   */
  function ouvrirDemande(id) {
    _selection = _parId(id);
    if (!_selection) return;

    const m = document.getElementById('m-demande');
    if (!m) return;

    // Réinitialiser les champs
    m.querySelectorAll('input, textarea').forEach(el => el.value = '');

    // Pré-remplir le résumé de la barre
    const infoZone = m.querySelector('#dem-info-barre');
    if (infoZone) {
      if (_selection.categorie === 'profil') {
        infoZone.innerHTML = `
          <strong>${_e(_selection.section_type)} ${_e(_selection.designation)}</strong>
          — ${_selection.longueur_m.toFixed(2)} m
          — ${_e(_selection.lieu_stockage)}
          <span class="badge badge-dispo" style="margin-left:6px">Disponible</span>`;
      } else {
        infoZone.innerHTML = `
          <strong>Tôle ${_selection.epaisseur_mm} mm</strong>
          — ${_selection.largeur_mm} × ${_selection.longueur_mm} mm
          — Qté : ${_selection.quantite}
          — ${_e(_selection.lieu_stockage)}
          <span class="badge badge-dispo" style="margin-left:6px">Disponible</span>`;
      }
    }

    // Picker demandeur
    const session = Auth.getSession();
    const pickWrap = m.querySelector('#dem-demandeur-picker');
    _monterPickerDemandeur(pickWrap);

    // Picker chantier
    _monterPickerChantier('dem-chantier-picker', 'dem-chantier');

    m.dataset.idBarre = id;

    _ouvrirModale('m-demande');
  }

  /**
   * Soumet la demande d'attribution
   * @param {HTMLElement} m
   */
  async function _soumettreDemande(m) {
    const demandeurInfo = _lireDemandeurPicker(m);
    const chantier      = m.querySelector('#dem-chantier')?.value?.trim();
    const commentaire   = m.querySelector('#dem-commentaire')?.value?.trim() || '';
    const idBarre       = m.dataset.idBarre;

    if (!demandeurInfo) return _notif('Le demandeur est obligatoire', 'erreur');
    if (!chantier)      return _signalerErreur(m, '#dem-chantier', 'Le chantier est obligatoire');

    const nomComplet = [demandeurInfo.prenom, demandeurInfo.nom].filter(Boolean).join(' ');

    const nb = _demandCompteur + 1;
    _demandCompteur = nb;

    const demande = {
      id:               `DEM-${String(nb).padStart(4, '0')}`,
      id_barre:         idBarre,
      demandeur:        nomComplet,
      demandeur_email:  demandeurInfo.email || null,
      demandeur_id:     demandeurInfo.id    || null,
      demandeur_nom:    demandeurInfo.nom   || null,
      demandeur_prenom: demandeurInfo.prenom || null,
      chantier_demande: chantier,
      commentaire,
      statut:      'en_attente',
      date_demande: _dateAujourdhui(),
      demande_par:  Auth.getSession()?.identifiant || 'visiteur'
    };

    const enLigne = await _persisterDemande(demande);
    _demandes.push(demande);
    _fermerModale('m-demande');
    _filtrer();
    _majAlerteAttente();
    _notif(`Demande ${demande.id} envoyée — en attente de validation admin` + (enLigne ? '' : ' — ⚠ mode hors ligne'), enLigne ? 'info' : 'alerte');
  }


  /* ──────────────────────────────────────────────────────────────
     MODALE DÉTAIL TÔLE
     ────────────────────────────────────────────────────────────── */

  /**
   * Ouvre la fiche détail d'une tôle
   * @param {string} id
   */
  function ouvrirDetailTole(id) {
    _selection = _parId(id);
    if (!_selection) return;

    const m = document.getElementById('m-detail-tole');
    if (!m) return;

    const t = _selection;

    // Titre
    const titre = m.querySelector('.modale-titre');
    if (titre) titre.textContent = `Fiche tôle — ${t.id}`;

    // Infos
    _afficherInfo(m, '#dtole-epaisseur',  `${t.epaisseur_mm} mm`);
    _afficherInfo(m, '#dtole-largeur',    `${t.largeur_mm} mm`);
    _afficherInfo(m, '#dtole-longueur',   `${t.longueur_mm} mm`);
    _afficherInfo(m, '#dtole-quantite',   `${t.quantite} pièce${t.quantite > 1 ? 's' : ''}`);
    _afficherInfo(m, '#dtole-poids-u',    `${t.poids_unitaire_kg.toFixed(1)} kg`);
    _afficherInfo(m, '#dtole-poids-t',    `${t.poids_total_kg.toFixed(1)} kg`);
    _afficherInfo(m, '#dtole-chantier',   t.chantier_origine);
    _afficherInfo(m, '#dtole-lieu',       t.lieu_stockage);
    _afficherInfo(m, '#dtole-date',       t.date_ajout || '—');
    _afficherInfo(m, '#dtole-commentaire', t.commentaire || '—');

    // Badge dispo
    const zoneDispo = m.querySelector('#dtole-dispo');
    if (zoneDispo) zoneDispo.innerHTML = _badgeDispo(t);

    // Bouton modifier — conditionnel
    const btnModif = m.querySelector('#dtole-btn-modifier');
    if (btnModif) {
      const canModif = Auth.hasRight('can_edit');
      btnModif.style.display = canModif ? '' : 'none';
      btnModif.onclick = () => {
        _fermerModale('m-detail-tole');
        ouvrirModification(id);
      };
    }

    _ouvrirModale('m-detail-tole');
  }


  /* ──────────────────────────────────────────────────────────────
     ACTIONS PUBLIQUES
     ────────────────────────────────────────────────────────────── */

  /**
   * Ouvre la modale fiche section directement depuis le stock
   * Remplace la redirection vers bibliotheque.html (Conv. 5 patch)
   * @param {string} type  — ex : 'IPE'
   * @param {string} desig — ex : '200'
   */
  function ouvrirFicheSection(type, desig) {
    const m = document.getElementById('m-fiche-section');
    if (!m) return;

    /* Titre */
    const titre = m.querySelector('.modale-titre');
    if (titre) titre.textContent = `Fiche section — ${type} ${desig}`;

    /* Badge norme + description */
    const badgeNorme = m.querySelector('#fiche-badge-norme');
    const descNorme  = m.querySelector('#fiche-desc-norme');
    const NORMES = {
      'IPE':       { norme: 'EN 10034',    desc: 'Profilé en I à ailes parallèles' },
      'IPE A':     { norme: 'EN 10034',    desc: 'Profilé en I à ailes parallèles — série A' },
      'IPE O':     { norme: 'EN 10034',    desc: 'Profilé en I à ailes parallèles — série O' },
      'IPN':       { norme: 'EN 10024',    desc: 'Profilé en I à ailes inclinées' },
      'HEA':       { norme: 'EN 10034',    desc: 'Profilé en H à larges ailes — série A' },
      'HEB':       { norme: 'EN 10034',    desc: 'Profilé en H à larges ailes — série B' },
      'HEM':       { norme: 'EN 10034',    desc: 'Profilé en H à larges ailes — série M' },
      'UPN':       { norme: 'EN 10279',    desc: 'Profilé en U à ailes inclinées' },
      'UPE':       { norme: 'EN 10279',    desc: 'Profilé en U à ailes parallèles' },
      'Cornière':  { norme: 'EN 10056-1',  desc: 'Cornière à ailes égales ou inégales' },
      'L égale':   { norme: 'EN 10056-1',  desc: 'Cornière à ailes égales' },
      'L inégale': { norme: 'EN 10056-1',  desc: 'Cornière à ailes inégales' },
      'Plat':      { norme: 'EN 10058',    desc: 'Plat laminé à chaud' },
      'SHS':       { norme: 'EN 10210 / EN 10219', desc: 'Tube carré à section creuse' },
      'RHS':       { norme: 'EN 10210 / EN 10219', desc: 'Tube rectangulaire à section creuse' },
      'CHS':       { norme: 'EN 10210 / EN 10219', desc: 'Tube circulaire à section creuse' },
    };
    const info = NORMES[type] || { norme: 'Section normalisée', desc: '' };
    if (badgeNorme) badgeNorme.textContent = info.norme;
    if (descNorme)  descNorme.textContent  = info.desc;

    /* Image PNG ou SVG coté + dimensions */
    const sec = _getDims(type, desig);
    const svgZone = m.querySelector('.detail-svg-zone');
    if (svgZone) {
      const PHOTOS = {
        'IPE':       '../assets/profils/IPE.png',
        'IPE A':     '../assets/profils/IPEA.png',
        'IPE AA':    '../assets/profils/IPEAA.png',
        'IPE O':     '../assets/profils/IPEO.png',
        'IPN':       '../assets/profils/IPN.png',
        'HEA':       '../assets/profils/HEA.png',
        'HEA A':     '../assets/profils/HEAA.png',
        'HEB':       '../assets/profils/HEB.png',
        'HEM':       '../assets/profils/HEM.png',
        'UPN':       '../assets/profils/UPN.png',
        'UPE':       '../assets/profils/UPE.png',
        'L égale':   '../assets/profils/Le.png',
        'L inégale': '../assets/profils/Li.png',
        'Plat':      '../assets/profils/Plat.png',
        'SHS':       '../assets/profils/SHS chaud.png',
        'SHS chaud': '../assets/profils/SHS chaud.png',
        'SHS froid': '../assets/profils/SHS froid.png',
        'RHS':       '../assets/profils/RHS chaud.png',
        'RHS chaud': '../assets/profils/RHS chaud.png',
        'RHS froid': '../assets/profils/RHS froid.png',
        'CHS':       '../assets/profils/CHS chaud.png',
        'CHS chaud': '../assets/profils/CHS chaud.png',
        'CHS froid': '../assets/profils/CHS froid.png',
      };
      const fab    = sec?.fabrication;
      const imgKey = fab ? `${type} ${fab}` : type;
      const imgSrc = PHOTOS[imgKey] || PHOTOS[type] || null;

      const showSvg = () => {
        svgZone.innerHTML = profilSvgCote(sec || { serie: type }, 190, 190);
      };

      if (imgSrc) {
        // Pattern identique à mfImageHtml() dans la bibliothèque
        svgZone.innerHTML = `<img alt="${type}" data-zoom="0"
          style="max-width:100%;max-height:220px;object-fit:contain;display:block;margin:0 auto;cursor:zoom-in;transition:max-height .2s;"
          onclick="profilZoomImage(this)">`;
        const imgEl = svgZone.querySelector('img');
        if (imgEl) {
          imgEl.onerror = showSvg;
          imgEl.src     = imgSrc;
        }
      } else {
        showSvg();
      }
    }

    const dimsZone = m.querySelector('.detail-dims-zone');
    if (dimsZone) {
      dimsZone.innerHTML = sec
        ? profilDimsTableau(sec)
        : '<div style="color:#aaa;font-size:12px">Dimensions non disponibles</div>';
    }

    /* Inventaire rapide depuis le stock courant */
    const stockInfo = m.querySelector('#fiche-stock-info');
    if (stockInfo && _data) {
      const barres = _data.barres.filter(b =>
        b.categorie === 'profil' &&
        b.section_type === type &&
        b.designation === desig &&
        b.statut === 'valide'
      );
      const nbDispo = barres.filter(b => b.disponibilite === 'disponible').length;
      const nbAff   = barres.length - nbDispo;
      stockInfo.innerHTML = barres.length > 0
        ? `<strong>En stock :</strong> ${nbDispo} barre${nbDispo > 1 ? 's' : ''} disponible${nbDispo > 1 ? 's' : ''} · ${nbAff} affectée${nbAff > 1 ? 's' : ''}`
        : `<strong>En stock :</strong> aucune barre de ce type actuellement`;
    }

    m.classList.add('open');
  }

  /* ──────────────────────────────────────────────────────────────
     VALIDATION ADMIN — Conv. 6
     ────────────────────────────────────────────────────────────── */

  /**
   * Ouvre la modale de validation appropriée selon le type d'élément
   * Distingue : ajout/modif stock (BAR/TOL) vs demande d'attribution (DEM)
   * @param {string} id — identifiant BAR-XXXX, TOL-XXXX ou DEM-XXXX
   */
  async function validerElement(id) {
    if (id.startsWith('DEM-')) {
      // Validation d'une demande d'attribution
      _selection = _demandes.find(d => d.id === id) || null;
      if (!_selection) {
        // fallback localStorage
        _selection = _chargerDemandes().demandes.find(d => d.id === id) || null;
      }
      if (!_selection) return _notif('Demande introuvable', 'erreur');
      _remplirValidationDemande(_selection);
      _ouvrirModale('m-valider-demande');
    } else {
      // Validation d'un ajout ou d'une modification de stock
      _selection = _parId(id);
      if (!_selection) return _notif('Élément introuvable', 'erreur');
      _remplirValidationStock(_selection);
      _ouvrirModale('m-valider-stock');
    }
  }

  /**
   * Ouvre la modale de confirmation de refus
   * @param {string} id — identifiant BAR-XXXX, TOL-XXXX ou DEM-XXXX
   */
  async function refuserElement(id) {
    if (id.startsWith('DEM-')) {
      _selection = _demandes.find(d => d.id === id) || null;
      if (!_selection) _selection = _chargerDemandes().demandes.find(d => d.id === id) || null;
    } else {
      _selection = _parId(id);
    }
    if (!_selection) return _notif('Élément introuvable', 'erreur');
    _remplirConfirmationRefus(_selection);
    _ouvrirModale('m-confirmation');
  }

  /**
   * Remplit la modale m-valider-stock avec les données de l'élément sélectionné
   * @param {Object} el — barre ou tôle en statut en_attente
   */
  function _remplirValidationStock(el) {
    const m = document.getElementById('m-valider-stock');
    if (!m) return;

    // Titre dynamique selon catégorie
    const titre = m.querySelector('.modale-titre');
    if (titre) titre.textContent = el.categorie === 'profil'
      ? `Valider l'ajout — ${el.section_type} ${el.designation}`
      : `Valider l'ajout — Tôle ${el.epaisseur_mm} mm`;

    // Stocker l'id pour la confirmation
    m.dataset.idEnCours = el.id;

    // Remplir le récapitulatif
    const recap = m.querySelector('#vstock-recap');
    if (!recap) return;

    const session = el.ajoute_par || '—';
    const date    = el.date_ajout || el.date_modif || '—';
    const typeOp  = el.date_modif ? 'Modification' : 'Ajout';

    if (el.categorie === 'profil') {
      const poidsP = _poidsEffectifProfil(el);
      const poids = poidsP > 0 ? `${poidsP.toFixed(1)} kg` : '—';
      recap.innerHTML = `
        <div class="dim-row"><span class="dim-label">Opération</span><span class="dim-val">${typeOp}</span></div>
        <div class="dim-row"><span class="dim-label">Référence</span><span class="dim-val">${_e(el.id)}</span></div>
        <div class="dim-row"><span class="dim-label">Section</span><span class="dim-val">${_e(el.section_type)} ${_e(el.designation)}</span></div>
        <div class="dim-row"><span class="dim-label">Longueur</span><span class="dim-val">${el.longueur_m.toFixed(2)} m</span></div>
        <div class="dim-row"><span class="dim-label">Poids barre</span><span class="dim-val">${poids}</span></div>
        <div class="dim-row"><span class="dim-label">Chantier origine</span><span class="dim-val">${_e(el.chantier_origine)}</span></div>
        <div class="dim-row"><span class="dim-label">Lieu stockage</span><span class="dim-val">${_e(el.lieu_stockage)}</span></div>
        <div class="dim-row"><span class="dim-label">Disponibilité</span><span class="dim-val">${el.disponibilite === 'disponible' ? 'Disponible' : 'Affecté'}</span></div>
        <div class="dim-row"><span class="dim-label">Soumis par</span><span class="dim-val">${_e(session)}</span></div>
        <div class="dim-row"><span class="dim-label">Date</span><span class="dim-val">${_e(date)}</span></div>
        ${el.commentaire ? `<div class="dim-row"><span class="dim-label">Commentaire</span><span class="dim-val">${_e(el.commentaire)}</span></div>` : ''}`;
    } else {
      recap.innerHTML = `
        <div class="dim-row"><span class="dim-label">Opération</span><span class="dim-val">${typeOp}</span></div>
        <div class="dim-row"><span class="dim-label">Référence</span><span class="dim-val">${_e(el.id)}</span></div>
        <div class="dim-row"><span class="dim-label">Épaisseur</span><span class="dim-val">${el.epaisseur_mm} mm</span></div>
        <div class="dim-row"><span class="dim-label">Dimensions</span><span class="dim-val">${el.largeur_mm} × ${el.longueur_mm} mm</span></div>
        <div class="dim-row"><span class="dim-label">Quantité</span><span class="dim-val">${el.quantite} pièce${el.quantite > 1 ? 's' : ''}</span></div>
        <div class="dim-row"><span class="dim-label">Poids unitaire</span><span class="dim-val">${el.poids_unitaire_kg.toFixed(1)} kg</span></div>
        <div class="dim-row"><span class="dim-label">Chantier origine</span><span class="dim-val">${_e(el.chantier_origine)}</span></div>
        <div class="dim-row"><span class="dim-label">Lieu stockage</span><span class="dim-val">${_e(el.lieu_stockage)}</span></div>
        <div class="dim-row"><span class="dim-label">Soumis par</span><span class="dim-val">${_e(session)}</span></div>
        <div class="dim-row"><span class="dim-label">Date</span><span class="dim-val">${_e(date)}</span></div>`;
    }
  }

  /**
   * Remplit la modale m-valider-demande avec les données de la demande
   * @param {Object} dem — demande d'attribution en statut en_attente
   */
  function _remplirValidationDemande(dem) {
    const m = document.getElementById('m-valider-demande');
    if (!m) return;

    m.dataset.idEnCours = dem.id;

    // Récupérer la barre concernée
    const barre = _parId(dem.id_barre);

    const recap = m.querySelector('#vdem-recap');
    if (!recap) return;

    const descBarre = barre
      ? (barre.categorie === 'profil'
          ? `${barre.section_type} ${barre.designation} — ${barre.longueur_m.toFixed(2)} m — ${barre.lieu_stockage}`
          : `Tôle ${barre.epaisseur_mm} mm — ${barre.largeur_mm}×${barre.longueur_mm} mm — ${barre.lieu_stockage}`)
      : `Référence : ${dem.id_barre} (introuvable dans le stock actuel)`;

    recap.innerHTML = `
      <div class="dim-row"><span class="dim-label">Demande</span><span class="dim-val">${_e(dem.id)}</span></div>
      <div class="dim-row"><span class="dim-label">Demandeur</span><span class="dim-val">${_e(dem.demandeur)}</span></div>
      <div class="dim-row"><span class="dim-label">Chantier demandé</span><span class="dim-val">${_e(dem.chantier_demande)}</span></div>
      <div class="dim-row"><span class="dim-label">Élément concerné</span><span class="dim-val">${_e(descBarre)}</span></div>
      <div class="dim-row"><span class="dim-label">Date de demande</span><span class="dim-val">${_e(dem.date_demande)}</span></div>
      ${dem.commentaire ? `<div class="dim-row"><span class="dim-label">Commentaire</span><span class="dim-val">${_e(dem.commentaire)}</span></div>` : ''}`;
  }

  /**
   * Remplit la modale m-confirmation pour un refus
   * @param {Object} el — barre, tôle ou demande
   */
  function _remplirConfirmationRefus(el) {
    const m = document.getElementById('m-confirmation');
    if (!m) return;

    m.dataset.idEnCours = el.id;

    // Réinitialiser le textarea motif
    const textarea = m.querySelector('#conf-motif');
    if (textarea) textarea.value = '';

    // Message de confirmation
    const msg = m.querySelector('#conf-message');
    if (!msg) return;

    if (el.id.startsWith('DEM-')) {
      msg.textContent = `Confirmer le refus de la demande ${el.id} (${_e(el.demandeur)} — ${_e(el.chantier_demande)}) ?`;
    } else if (el.categorie === 'profil') {
      msg.textContent = `Confirmer le refus de l'élément ${el.id} (${el.section_type} ${el.designation} — ${el.longueur_m.toFixed(2)} m) ?`;
    } else {
      msg.textContent = `Confirmer le refus de l'élément ${el.id} (Tôle ${el.epaisseur_mm} mm) ?`;
    }
  }

  /**
   * Exécute la validation d'un élément stock (BAR/TOL)
   * Appelée par le bouton Valider de m-valider-stock
   */
  async function _confirmerValidationStock() {
    const m = document.getElementById('m-valider-stock');
    if (!m) return;
    const id = m.dataset.idEnCours;
    if (!id) return;

    const el = _parId(id);
    if (!el) return _notif('Élément introuvable', 'erreur');

    const session = Auth.getSession();

    // Mise à jour du statut
    const valide = {
      ...el,
      statut: 'valide',
      valide_par: session?.identifiant || 'admin',
      date_validation: _dateAujourdhui()
    };

    const enLigne = await _persisterElement(valide);

    // Enregistrer la validation dans l'historique
    if (el.categorie === 'profil') {
      await _enregistrerHistorique(
        el.id, 'VALIDATION',
        null, el.longueur_m,
        el.chantier_origine || null,
        null,
        session?.identifiant || null,
        null,
        el.lieu_stockage || null
      );
    } else if (el.categorie === 'tole') {
      await _enregistrerHistoriqueTole(el.id, 'VALIDATION', null, el.quantite, el.chantier_origine || null, null, session?.identifiant || null, el.lieu_stockage || null);
    }

    _fermerModale('m-valider-stock');
    _filtrer();
    _majAlerteAttente();

    _notif(`${id} validé` + (enLigne ? ' avec succès' : ' — ⚠ mode hors ligne'), enLigne ? 'succes' : 'alerte');
  }

  /**
   * Exécute la validation d'une demande d'attribution (DEM)
   * Appelée par le bouton Valider de m-valider-demande
   */
  async function _confirmerValidationDemande() {
    const m = document.getElementById('m-valider-demande');
    if (!m) return;
    const idDem = m.dataset.idEnCours;
    if (!idDem) return;

    const dem = _demandes.find(d => d.id === idDem);
    if (!dem) return _notif('Demande introuvable', 'erreur');

    const session = Auth.getSession();
    const demMAJ = {
      ...dem,
      statut: 'valide',
      date_traitement: _dateAujourdhui(),
      traite_par: session?.identifiant || 'admin'
    };

    // Persister la demande mise à jour dans Supabase
    let enLigne = true;
    try {
      await window.SB.upsert('demandes', demMAJ);
    } catch(e) {
      console.warn('[Stock] Supabase indisponible pour la demande :', e);
      const store = _chargerDemandes();
      const idx = store.demandes.findIndex(d => d.id === idDem);
      if (idx !== -1) { store.demandes[idx] = demMAJ; } else { store.demandes.push(demMAJ); }
      try { localStorage.setItem(CLE_DEMANDES, JSON.stringify(store)); } catch {}
      enLigne = false;
    }

    // Mettre à jour la barre → affectée au chantier demandé
    const barre = _parId(dem.id_barre);
    if (barre) {
      const barreMAJ = {
        ...barre,
        disponibilite: 'affecte',
        chantier_affectation: dem.chantier_demande,
        statut: 'valide',
        date_modif: _dateAujourdhui(),
        modifie_par: session?.identifiant || 'admin'
      };
      const ok = await _persisterElement(barreMAJ);
      if (!ok) enLigne = false;

      // Enregistrer l'affectation dans l'historique (profilés uniquement)
      if (barre.categorie === 'profil') {
        await _enregistrerHistorique(
          barre.id, 'AFFECTATION',
          barre.longueur_m, barre.longueur_m,
          dem.chantier_demande,
          dem.demandeur,
          session?.identifiant || null,
          dem.commentaire || null,
          barre.lieu_stockage || null
        );
      }
    }

    // Rafraîchir la liste des demandes en mémoire
    try {
      const demandes = await window.SB.lire('demandes');
      _demandes = demandes.filter(d => d.statut === 'en_attente');
    } catch(e) {
      _demandes = _chargerDemandes().demandes.filter(d => d.statut === 'en_attente');
    }

    // Sauvegarder le nouveau demandeur s'il n'était pas encore dans la liste
    if (!dem.demandeur_id && dem.demandeur_nom) {
      try {
        const res = await window.SB.inserer('demandeurs', {
          nom:    dem.demandeur_nom,
          prenom: dem.demandeur_prenom || null,
          email:  dem.demandeur_email  || null,
          actif:  true
        });
        const rows = await window.SB.lire('demandeurs', { order: 'nom' });
        _demandeurs = rows.filter(d => d.actif);
      } catch(e) { console.warn('[Stock] Impossible de sauvegarder le demandeur :', e); }
    }

    // Envoyer email de confirmation
    await _envoyerMailConfirmation(dem, 'accepte');

    _fermerModale('m-valider-demande');
    _filtrer();
    _majAlerteAttente();
    _notif(`Demande ${idDem} validée — barre affectée à "${dem.chantier_demande}"` + (enLigne ? '' : ' — ⚠ mode hors ligne'), enLigne ? 'succes' : 'alerte');
  }

  /**
   * Exécute le refus d'un élément (stock ou demande)
   * Appelée par le bouton Confirmer le refus de m-confirmation
   */
  async function _confirmerRefus() {
    const m = document.getElementById('m-confirmation');
    if (!m) return;
    const id    = m.dataset.idEnCours;
    const motif = m.querySelector('#conf-motif')?.value?.trim() || '';
    if (!id) return;

    const session = Auth.getSession();

    if (id.startsWith('DEM-')) {
      const dem = _demandes.find(d => d.id === id);
      if (dem) {
        const demRefus = {
          ...dem,
          statut: 'refuse',
          motif_refus: motif,
          date_traitement: _dateAujourdhui(),
          traite_par: session?.identifiant || 'admin'
        };
        try {
          await window.SB.upsert('demandes', demRefus);
        } catch(e) {
          const store = _chargerDemandes();
          const idx = store.demandes.findIndex(d => d.id === id);
          if (idx !== -1) { store.demandes[idx] = demRefus; } else { store.demandes.push(demRefus); }
          try { localStorage.setItem(CLE_DEMANDES, JSON.stringify(store)); } catch {}
        }
      }
      if (dem) await _envoyerMailConfirmation(dem, 'refuse', motif);
      try {
        const demandes = await window.SB.lire('demandes');
        _demandes = demandes.filter(d => d.statut === 'en_attente');
      } catch(e) {
        _demandes = _chargerDemandes().demandes.filter(d => d.statut === 'en_attente');
      }
      _fermerModale('m-confirmation');
      _filtrer();
      _notif(`Demande ${id} refusée`, 'info');
    } else {
      const el = _parId(id);
      if (!el) return _notif('Élément introuvable', 'erreur');
      const refuse = {
        ...el,
        statut: 'refuse',
        motif_refus: motif,
        date_validation: _dateAujourdhui(),
        valide_par: session?.identifiant || 'admin'
      };
      await _persisterElement(refuse);
      _fermerModale('m-confirmation');
      _filtrer();
      _majAlerteAttente();
      _notif(`${id} refusé`, 'info');
    }
  }

  /** Retourne l'élément sélectionné */
  function getSelection() { return _selection; }


  /* ──────────────────────────────────────────────────────────────
     HISTORIQUE DES BARRES
     ────────────────────────────────────────────────────────────── */

  /**
   * Enregistre une entrée dans lbf_barres_historique (non-bloquant).
   * En cas d'erreur Supabase, l'opération est ignorée silencieusement.
   * @param {string} barreId
   * @param {string} typeOperation — ENTREE | AFFECTATION | RETOUR | ARCHIVAGE | VALIDATION
   * @param {number|null} longueurAvant
   * @param {number|null} longueurApres
   * @param {string|null} chantier
   * @param {string|null} operateur
   * @param {string|null} validePar
   * @param {string|null} commentaire
   */
  async function _enregistrerHistorique(barreId, typeOperation, longueurAvant, longueurApres, chantier, operateur, validePar, commentaire, lieu = null) {
    if (!barreId || !typeOperation) return;
    try {
      await window.SB.insererHistorique({
        barre_id:         barreId,
        type_operation:   typeOperation,
        longueur_avant_m: longueurAvant  ?? null,
        longueur_apres_m: longueurApres  ?? null,
        chantier:         chantier       || null,
        operateur:        operateur      || null,
        valide_par:       validePar      || null,
        commentaire:      commentaire    || null,
        lieu:             lieu           || null,
      });
    } catch(e) {
      console.warn('[Stock] Impossible d\'enregistrer l\'historique :', e);
    }
  }

  /**
   * Enregistre une entrée historique pour une tôle.
   * Réutilise lbf_barres_historique : longueur_avant/après stocke la quantité.
   */
  async function _enregistrerHistoriqueTole(toleId, typeOperation, qtyAvant, qtyApres, chantier, operateur, commentaire, lieu = null) {
    if (!toleId || !typeOperation) return;
    try {
      await window.SB.insererHistorique({
        barre_id:         toleId,
        type_operation:   typeOperation,
        longueur_avant_m: qtyAvant  ?? null,
        longueur_apres_m: qtyApres  ?? null,
        chantier:         chantier  || null,
        operateur:        operateur || null,
        valide_par:       commentaire || null,
        commentaire:      commentaire || null,
        lieu:             lieu       || null,
      });
    } catch(e) {
      console.warn('[Stock] Impossible d\'enregistrer l\'historique tôle :', e);
    }
  }

  /**
   * Ouvre la modale d'historique pour une tôle.
   */
  async function ouvrirHistoriqueTole(id) {
    const tole = _parId(id);
    const titreEl = document.getElementById('hist-titre');
    if (titreEl) {
      titreEl.textContent = tole
        ? `Historique — ${id} · ${tole.epaisseur_mm} mm ${_LABEL_TYPE_TOLE[tole.type_tole] || tole.type_tole || ''} ${tole.largeur_mm}×${tole.longueur_mm} mm`
        : `Historique — ${id}`;
    }
    const contenu = document.getElementById('hist-contenu');
    if (contenu) contenu.innerHTML = '<div style="padding:24px;text-align:center;color:#aaa;font-style:italic">Chargement…</div>';
    _ouvrirModale('m-historique-barre');
    try {
      const lignes = await window.SB.lireHistoriqueParBarre(id);
      if (contenu) contenu.innerHTML = _htmlTableauHistoriqueTole(lignes);
    } catch(e) {
      console.error('[Stock] Erreur chargement historique tôle :', e);
      if (contenu) contenu.innerHTML = '<div style="padding:24px;text-align:center;color:var(--rouge)">Impossible de charger l\'historique.</div>';
    }
  }

  /**
   * Génère le HTML du tableau historique d'une tôle.
   * longueur_avant/après = quantité avant/après dans ce contexte.
   */
  function _htmlTableauHistoriqueTole(lignes) {
    if (!lignes || !lignes.length) {
      return '<div style="padding:24px;text-align:center;color:#aaa;font-style:italic">Aucune entrée dans l\'historique.</div>';
    }
    const BADGES = {
      ENTREE:       'badge-op-entree',
      SORTIE:       'badge-op-sortie',
      ARCHIVAGE:    'badge-op-archivage',
      MODIFICATION: 'badge-op-modification',
      VALIDATION:   'badge-op-validation',
    };
    let h = `<table class="hist-table">
      <thead><tr>
        <th>Date</th><th>Opération</th><th>Qté avant</th><th>Qté après</th>
        <th>Lieu</th><th>Chantier</th><th>Opérateur</th>
      </tr></thead><tbody>`;
    lignes.forEach(l => {
      const date  = l.date_operation
        ? new Date(l.date_operation).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
        : '—';
      const cls   = BADGES[l.type_operation] || '';
      const avant = l.longueur_avant_m != null ? parseFloat(l.longueur_avant_m) : null;
      const apres = l.longueur_apres_m != null ? parseFloat(l.longueur_apres_m) : null;
      h += `<tr>
        <td style="white-space:nowrap">${_e(date)}</td>
        <td><span class="badge-operation ${cls}">${_e(l.type_operation)}</span></td>
        <td>${avant != null ? avant : '—'}</td>
        <td>${apres != null ? apres : '—'}</td>
        <td>${_e(l.lieu || '—')}</td>
        <td>${_e(_labelChantier(l.chantier) || l.chantier || '—')}</td>
        <td>${_e(l.operateur || '—')}</td>
      </tr>`;
    });
    return h + '</tbody></table>';
  }

  /**
   * Ouvre la modale d'historique pour une barre donnée et charge les données.
   * Accessible depuis le tableau (bouton 📋) et l'onglet Archivées.
   * @param {string} id — ex. "BAR-0001"
   */
  async function ouvrirHistoriqueBarre(id) {
    const barre = _parId(id);

    // Construire le titre de la modale
    const titreEl = document.getElementById('hist-titre');
    if (titreEl) {
      if (barre) {
        const prefix = barre.statut === 'archivee' ? 'ARC' : 'BAR';
        const code   = barre.code_barre ? `${prefix}-${barre.code_barre}` : barre.id;
        titreEl.textContent = `Historique — ${code} · ${barre.section_type} ${barre.designation}`;
      } else {
        titreEl.textContent = `Historique — ${id}`;
      }
    }

    // Afficher le loader et ouvrir la modale
    const contenu = document.getElementById('hist-contenu');
    if (contenu) {
      contenu.innerHTML = '<div style="padding:24px;text-align:center;color:#aaa;font-style:italic">Chargement de l\'historique…</div>';
    }
    _ouvrirModale('m-historique-barre');

    // Charger l'historique depuis Supabase
    try {
      const lignes = await window.SB.lireHistoriqueParBarre(id);
      if (contenu) contenu.innerHTML = _htmlTableauHistorique(lignes);
    } catch(e) {
      console.error('[Stock] Erreur chargement historique :', e);
      if (contenu) {
        contenu.innerHTML = '<div style="padding:24px;text-align:center;color:var(--rouge)">Impossible de charger l\'historique.</div>';
      }
    }
  }

  /**
   * Génère le HTML du tableau historique d'une barre.
   * @param {Array} lignes — entrées de lbf_barres_historique
   * @returns {string}
   */
  function _htmlTableauHistorique(lignes) {
    if (!lignes || !lignes.length) {
      return '<div style="padding:24px;text-align:center;color:#aaa;font-style:italic">Aucune entrée dans l\'historique.</div>';
    }

    // Correspondance type d'opération → classe CSS du badge
    const BADGES = {
      ENTREE:       'badge-op-entree',
      AFFECTATION:  'badge-op-affectation',
      RETOUR:       'badge-op-retour',
      SORTIE:       'badge-op-sortie',
      ARCHIVAGE:    'badge-op-archivage',
      VALIDATION:   'badge-op-validation',
      MODIFICATION: 'badge-op-modification',
    };

    let h = `<table class="hist-table">
      <thead><tr>
        <th>Date</th>
        <th>Opération</th>
        <th>Long. avant</th>
        <th>Long. après</th>
        <th>Lieu</th>
        <th>Chantier</th>
        <th>Opérateur</th>
      </tr></thead><tbody>`;

    lignes.forEach(l => {
      const date = l.date_operation
        ? new Date(l.date_operation).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
        : '—';
      const cls   = BADGES[l.type_operation] || '';
      const avant = l.longueur_avant_m != null ? `${parseFloat(l.longueur_avant_m).toFixed(2)} m` : '—';
      const apres = l.longueur_apres_m != null ? `${parseFloat(l.longueur_apres_m).toFixed(2)} m` : '—';

      h += `<tr>
        <td style="white-space:nowrap">${_e(date)}</td>
        <td><span class="badge-operation ${cls}">${_e(l.type_operation)}</span></td>
        <td>${avant}</td>
        <td>${apres}</td>
        <td>${_e(l.lieu || '—')}</td>
        <td>${_e(_labelChantier(l.chantier) || l.chantier || '—')}</td>
        <td>${_e(l.operateur || '—')}</td>
      </tr>`;
    });

    return h + '</tbody></table>';
  }


  /* ──────────────────────────────────────────────────────────────
     HELPERS MODALES
     ────────────────────────────────────────────────────────────── */

  function _ouvrirModale(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
  }

  function _fermerModale(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
    // Nettoyer l'overlay zoom s'il est ouvert
    const overlay = document.getElementById('stock-zoom-overlay');
    if (overlay) {
      overlay.remove();
      // Remettre l'état zoom de l'image à zéro
      const img = document.getElementById('fiche-img');
      if (img) { img.dataset.zoom = '0'; img.style.cursor = 'zoom-in'; }
    }
  }

  /**
   * Affiche la note de statut selon le profil (en_attente ou direct)
   * @param {HTMLElement} m — modale
   * @param {string} selector — sélecteur de la note
   */
  function _majNoteStatut(m, selector) {
    const note = m.querySelector(selector);
    if (!note) return;
    const isAdmin = Auth.hasRight('can_validate');
    note.textContent = isAdmin
      ? '✔ En tant qu\'administrateur, cet enregistrement sera validé directement.'
      : '⏳ Cet enregistrement sera soumis à validation par l\'administrateur.';
    note.className = isAdmin
      ? `note-statut note-statut-direct ${selector.replace('.','')}`
      : `note-statut note-statut-attente ${selector.replace('.','')}`;;
  }

  /**
   * Convertit les lignes Supabase sections en structure {standard, custom}
   */
  function _sectionsFromRows(rows) {
    const ORDRE = ['Profilés I', 'Profilés H', 'Profilés U', 'Cornière', 'Profilés creux', 'Plat', 'Barres rondes', 'Barres carrées'];
    const map = {};
    rows.forEach(r => {
      if (!map[r.famille]) map[r.famille] = { famille: r.famille, sections: [] };
      const dims = typeof r.dims === 'string' ? JSON.parse(r.dims) : (r.dims || {});
      const sec = { famille: r.famille, serie: r.serie, desig: r.desig, pml: r.pml, fabrication: r.fabrication || null, ...dims };
      if (r.serie === 'CHS') {
        const ep = sec.e ?? sec.t;
        if (sec.d !== undefined && ep !== undefined) sec.di = Math.round((sec.d - 2 * ep) * 10) / 10;
      }
      map[r.famille].sections.push(sec);
    });
    return { standard: ORDRE.map(f => map[f]).filter(Boolean), custom: [] };
  }

  /**
   * Remplit un select avec les types de sections disponibles
   * @param {HTMLSelectElement} sel
   */
  function _remplirSelectType(sel) {
    if (!sel) return;
    sel.innerHTML = '<option value="">— Choisir —</option>';
    let series = [];

    if (_sections?.standard) {
      // Extraire toutes les séries uniques toutes familles confondues
      // ex : "IPE", "IPE A", "IPE O", "IPN", "HEA", "HEA A", "HEB", "HEM"...
      _sections.standard.forEach(f => {
        f.sections.forEach(s => {
          if (!series.includes(s.serie)) series.push(s.serie);
        });
      });
    } else if (_data?.barres) {
      series = [...new Set(_data.barres
        .filter(b => b.categorie === 'profil')
        .map(b => b.section_type))].sort();
    }

    series.forEach(t => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t;
      sel.appendChild(o);
    });
  }

  /**
   * Remplit un select avec les lieux de stockage
   * @param {HTMLSelectElement} sel
   */
  /** Monte un sélecteur lieu en cascade (Rack → Allée → Étage) dans el.
   *  valeur — ex. "Rack 1 - B4" pour pré-sélectionner */
  function _monterSelecteurLieu(el, valeur = '') {
    if (!el) return;
    let nomRack = '', nomAllee = '', nomEtage = '';
    if (valeur) {
      const mt = valeur.match(/^(.+)\s*-\s*([A-Z]+)(\d+)$/);
      if (mt) { nomRack = mt[1].trim(); nomAllee = mt[2]; nomEtage = mt[3]; }
      else { nomRack = valeur.trim(); } // zone plate : valeur = nom du rack seul
    }

    const selRack = document.createElement('select');
    selRack.className = 'lieu-sel lieu-sel-rack';
    const racksTries = [..._racks].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
    selRack.innerHTML = '<option value="">— Rack —</option>'
      + racksTries.map(r => `<option value="${_e(r.nom)}"${r.nom === nomRack ? ' selected' : ''}>${_e(r.nom)}</option>`).join('');

    const selAllee = document.createElement('select');
    selAllee.className = 'lieu-sel lieu-sel-allee';

    const selEtage = document.createElement('select');
    selEtage.className = 'lieu-sel lieu-sel-etage';

    const majAllee = () => {
      const rack = _racks.find(r => r.nom === selRack.value);
      if (!rack) {
        selAllee.innerHTML = '<option value="">— Allée —</option>';
        selAllee.style.display = '';
        selEtage.innerHTML = '<option value="">— Étage —</option>';
        selEtage.style.display = '';
        return;
      }
      // Zone plate : cacher allée et étage
      if (!rack.nb_allees || !rack.nb_etages) {
        selAllee.innerHTML = '<option value="">— Allée —</option>';
        selAllee.style.display = 'none';
        selEtage.innerHTML = '<option value="">— Étage —</option>';
        selEtage.style.display = 'none';
        return;
      }
      selAllee.style.display = '';
      selEtage.style.display = '';
      selAllee.innerHTML = '<option value="">— Allée —</option>'
        + Array.from({length: rack.nb_allees}, (_, i) => {
            const l = _labelAllee(i);
            return `<option value="${l}"${l === nomAllee ? ' selected' : ''}>${l}</option>`;
          }).join('');
      majEtage();
    };

    const majEtage = () => {
      const rack = _racks.find(r => r.nom === selRack.value);
      if (!rack || !selAllee.value) { selEtage.innerHTML = '<option value="">— Étage —</option>'; return; }
      selEtage.innerHTML = '<option value="">— Étage —</option>'
        + Array.from({length: rack.nb_etages}, (_, i) => {
            const n = String(i + 1);
            return `<option value="${n}"${n === nomEtage ? ' selected' : ''}>${n}</option>`;
          }).join('');
    };

    selRack.addEventListener('change', () => { nomAllee = ''; nomEtage = ''; majAllee(); });
    selAllee.addEventListener('change', majEtage);

    el.innerHTML = '';
    el.append(selRack, selAllee, selEtage);
    majAllee();
  }

  /** Lit la valeur depuis un conteneur lieu-cascade.
   *  Zone plate : retourne juste le nom du rack.
   *  Zone avec allées/étages : retourne "Rack 1 - B4". */
  function _lireLieu(el) {
    if (!el) return '';
    const rack = el.querySelector('.lieu-sel-rack')?.value || '';
    if (!rack) return '';
    const selAllee = el.querySelector('.lieu-sel-allee');
    if (selAllee?.style.display === 'none') return rack; // zone plate
    const allee = selAllee?.value || '';
    const etage = el.querySelector('.lieu-sel-etage')?.value || '';
    if (!allee || !etage) return '';
    return `${rack} - ${allee}${etage}`;
  }

  function _majDatalistChantiers() {
    const dl = document.getElementById('dl-chantiers');
    if (!dl) return;
    const tries = [..._chantiers].sort((a, b) =>
      (a.numero_affaire || '').localeCompare(b.numero_affaire || '', 'fr', { numeric: true })
    );
    dl.innerHTML = tries.map(c => `<option value="${_e(c.nom)}">`).join('');
  }

  function _monterPickerFournisseur(wrapId, selectId, valeurCourante = '') {
    const wrap = typeof wrapId === 'string' ? document.getElementById(wrapId) : wrapId;
    if (!wrap) return;

    const fvTries = [..._fournisseurs].sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' }));
    const opts = `<option value="">— Choisir un fournisseur —</option>` +
      fvTries.map(f => {
        const sel = f.nom === valeurCourante ? ' selected' : '';
        return `<option value="${_e(f.nom)}"${sel}>${_e(f.nom)}</option>`;
      }).join('');

    wrap.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center">
        <select id="${selectId}" style="flex:1;min-width:0">${opts}</select>
        <button type="button" class="btn btn-sec fv-btn-creer" style="white-space:nowrap;padding:4px 8px;font-size:.85em">+ Nouveau</button>
      </div>
      <div class="fv-form-nouv" style="display:none;margin-top:6px;padding:8px;background:#f5f5f5;border-radius:6px;border:1px solid #ddd">
        <div style="display:flex;gap:6px">
          <input type="text" class="fv-new-nom" placeholder="Nom du fournisseur *" style="flex:1;min-width:0">
          <button type="button" class="btn btn-ok fv-btn-confirmer" style="white-space:nowrap;padding:4px 8px;font-size:.85em">✓ Ajouter</button>
          <button type="button" class="btn btn-sec fv-btn-annuler" style="padding:4px 8px;font-size:.85em">✗</button>
        </div>
      </div>`;

    const formNouv = wrap.querySelector('.fv-form-nouv');
    const inpNom   = wrap.querySelector('.fv-new-nom');
    const sel      = wrap.querySelector(`#${selectId}`);

    wrap.querySelector('.fv-btn-creer').addEventListener('click', () => {
      formNouv.style.display = '';
      inpNom.value = '';
      inpNom.focus();
    });
    wrap.querySelector('.fv-btn-annuler').addEventListener('click', () => {
      formNouv.style.display = 'none';
    });
    wrap.querySelector('.fv-btn-confirmer').addEventListener('click', async () => {
      const nom = inpNom.value.trim();
      if (!nom) return;
      const res = await window.SB.inserer('fournisseurs', { nom, actif: true });
      if (res?.error) { alert('Erreur création fournisseur : ' + res.error.message); return; }
      const rows = await window.SB.lire('fournisseurs', { order: 'nom' });
      _fournisseurs = rows.filter(f => f.actif);
      _monterPickerFournisseur(wrap, selectId, nom);
    });
  }

  function _peuplerSelectAffectation(sel, valeurCourante) {
    if (!sel) return;
    const chTries = [..._chantiers].sort((a, b) =>
      (a.numero_affaire || '').localeCompare(b.numero_affaire || '', 'fr', { numeric: true })
    );
    const opts = chTries.map(c => {
      const label = [c.numero_affaire, c.ville, c.nom].filter(Boolean).join(' — ');
      return `<option value="${_e(c.nom)}"${c.nom === valeurCourante ? ' selected' : ''}>${_e(label)}</option>`;
    });
    if (!valeurCourante || _chantiers.some(c => c.nom === valeurCourante)) {
      opts.unshift(`<option value="">— Choisir un chantier —</option>`);
    } else {
      opts.unshift(`<option value="${_e(valeurCourante)}" selected>${_e(valeurCourante)}</option>`);
    }
    sel.innerHTML = opts.join('');
  }

  function _monterPickerChantier(wrapId, selectId, valeurCourante = '') {
    const wrap = typeof wrapId === 'string' ? document.getElementById(wrapId) : wrapId;
    if (!wrap) return;

    const chTries = [..._chantiers].sort((a, b) =>
      (a.numero_affaire || '').localeCompare(b.numero_affaire || '', 'fr', { numeric: true })
    );
    const opts = `<option value="">— Choisir un chantier —</option>` +
      chTries.map(c => {
        const lbl = [c.numero_affaire, c.ville, c.nom].filter(Boolean).join(' — ');
        const sel = c.nom === valeurCourante ? ' selected' : '';
        return `<option value="${_e(c.nom)}"${sel}>${_e(lbl)}</option>`;
      }).join('');

    wrap.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center">
        <select id="${selectId}" style="flex:1;min-width:0">${opts}</select>
        <button type="button" class="btn btn-sec ch-btn-creer" style="white-space:nowrap;padding:4px 8px;font-size:.85em">+ Nouveau</button>
      </div>
      <div class="ch-form-nouv" style="display:none;margin-top:6px;padding:8px;background:#f5f5f5;border-radius:6px;border:1px solid #ddd">
        <div style="display:flex;gap:6px;margin-bottom:5px">
          <input type="text" class="ch-new-affaire" placeholder="N° affaire" style="width:110px">
          <input type="text" class="ch-new-ville" placeholder="Ville" style="flex:1;min-width:0">
        </div>
        <div style="display:flex;gap:6px">
          <input type="text" class="ch-new-nom" placeholder="Nom du chantier *" style="flex:1;min-width:0">
          <button type="button" class="btn btn-ok ch-btn-confirmer" style="white-space:nowrap;padding:4px 8px;font-size:.85em">✓ Créer</button>
          <button type="button" class="btn btn-sec ch-btn-annuler" style="padding:4px 8px;font-size:.85em">✗</button>
        </div>
      </div>`;

    const formNouv = wrap.querySelector('.ch-form-nouv');
    const inpNom   = wrap.querySelector('.ch-new-nom');
    const inpAff   = wrap.querySelector('.ch-new-affaire');
    const inpVille = wrap.querySelector('.ch-new-ville');

    wrap.querySelector('.ch-btn-creer').addEventListener('click', () => {
      formNouv.style.display = '';
      inpAff.value = ''; inpVille.value = ''; inpNom.value = '';
      inpNom.focus();
    });
    wrap.querySelector('.ch-btn-annuler').addEventListener('click', () => {
      formNouv.style.display = 'none';
    });
    wrap.querySelector('.ch-btn-confirmer').addEventListener('click', async () => {
      const nom     = inpNom.value.trim();
      const affaire = inpAff.value.trim() || null;
      const ville   = inpVille.value.trim() || null;
      if (!nom) return;
      const res = await window.SB.inserer('chantiers', { nom, numero_affaire: affaire, ville, actif: true });
      if (res?.error) { alert('Erreur création chantier : ' + res.error.message); return; }
      const rows = await window.SB.lire('chantiers', { order: 'nom' });
      _chantiers = rows.filter(c => c.actif);
      _majDatalistChantiers();
      _monterPickerChantier(wrap, selectId, nom);
    });
  }

  function _monterPickerDemandeur(wrap, demandeurId = '') {
    if (!wrap) return;
    const opts = `<option value="">— Choisir un demandeur —</option>` +
      _demandeurs.map(d => {
        const label = [d.prenom, d.nom].filter(Boolean).join(' ') + (d.email ? ` (${d.email})` : '');
        return `<option value="${_e(d.id)}"${d.id === demandeurId ? ' selected' : ''}>${_e(label)}</option>`;
      }).join('') +
      `<option value="__nouveau__">— Nouveau demandeur —</option>`;

    wrap.innerHTML = `
      <select id="dem-demandeur-sel" style="width:100%">${opts}</select>
      <div id="dem-demandeur-email-affiche" style="margin-top:4px;font-size:12px;color:#666;min-height:18px"></div>
      <div id="dem-nouveau-form" style="display:none;margin-top:8px;padding:8px;background:#f5f5f5;border-radius:6px;border:1px solid #ddd">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input type="text" id="dem-new-prenom" placeholder="Prénom" style="flex:1;min-width:0">
          <input type="text" id="dem-new-nom" placeholder="Nom *" style="flex:1;min-width:0">
        </div>
        <input type="email" id="dem-new-email" placeholder="Email (confirmation de demande)" style="width:100%;box-sizing:border-box">
      </div>`;

    const sel = wrap.querySelector('#dem-demandeur-sel');
    const emailAffiche = wrap.querySelector('#dem-demandeur-email-affiche');
    const formNouv = wrap.querySelector('#dem-nouveau-form');

    function majEmail() {
      const v = sel.value;
      if (v === '__nouveau__') {
        formNouv.style.display = '';
        emailAffiche.textContent = '';
      } else if (v) {
        formNouv.style.display = 'none';
        const d = _demandeurs.find(x => x.id === v);
        emailAffiche.innerHTML = d?.email ? `📧 ${_e(d.email)}` : '';
      } else {
        formNouv.style.display = 'none';
        emailAffiche.textContent = '';
      }
    }
    sel.addEventListener('change', majEmail);
    majEmail();
  }

  function _lireDemandeurPicker(m) {
    const sel = m?.querySelector('#dem-demandeur-sel');
    if (!sel) return null;
    const v = sel.value;
    if (!v) return null;
    if (v === '__nouveau__') {
      const prenom = m.querySelector('#dem-new-prenom')?.value?.trim() || '';
      const nom    = m.querySelector('#dem-new-nom')?.value?.trim() || '';
      const email  = m.querySelector('#dem-new-email')?.value?.trim() || '';
      if (!nom) return null;
      return { id: null, nom, prenom, email, isNew: true };
    }
    const d = _demandeurs.find(x => x.id === v);
    return d ? { ...d, isNew: false } : null;
  }

  async function _envoyerMailConfirmation(dem, statut, motif = '') {
    if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID) return;
    const email = dem.demandeur_email;
    if (!email) return;
    const tplId = statut === 'accepte' ? EMAILJS_TPL_ACCEPTATION : EMAILJS_TPL_REFUS;
    if (!tplId) return;
    try {
      await window.emailjs.send(EMAILJS_SERVICE_ID, tplId, {
        to_email:   email,
        to_name:    dem.demandeur,
        demande_id: dem.id,
        chantier:   _labelChantier(dem.chantier_demande) || dem.chantier_demande,
        motif:      motif || '',
      }, EMAILJS_PUBLIC_KEY);
    } catch(e) {
      console.warn('[Stock] Envoi email échoué :', e);
    }
  }

  function _labelChantier(nom) {
    if (!nom) return '';
    const c = _chantiers.find(x => x.nom === nom);
    if (!c) return nom;
    return [c.numero_affaire, c.ville, c.nom].filter(Boolean).join(' — ');
  }

  /**
   * Récupère les dimensions d'une section depuis sections.json
   * @param {string} type
   * @param {string} desig
   * @returns {Object|null}
   */
  function _getDims(type, desig) {
    if (!_sections?.standard) return null;
    // Normaliser × (U+00D7 Supabase) et x (ASCII sections.json) pour comparaison fiable
    const norm = s => s.replace(/×/g, 'x');
    const desigN         = norm(desig);
    const desigCompleteN = norm(`${type} ${desig}`);
    for (const groupe of _sections.standard) {
      const sec = groupe.sections.find(s =>
        s.serie === type && (norm(s.desig) === desigCompleteN || norm(s.desig) === desigN)
      );
      if (sec) return sec.famille ? sec : { famille: groupe.famille, ...sec };
    }
    return null;
  }

  /**
   * Affiche la liste des dimensions dans un conteneur
   * @param {HTMLElement} el
   * @param {Object|null} dims
   */
  function _rendreDimsList(el, dims) {
    if (!dims) {
      el.innerHTML = '<div style="color:#aaa;font-size:12px">Dimensions standard — voir bibliothèque</div>';
      return;
    }
    const rows = [];
    const ser = dims.serie || '';
    const fam = dims.famille ||
      (['SHS','RHS','CHS'].includes(ser)              ? 'Profilés creux' :
       ['L égale','L inégale'].includes(ser)           ? 'Cornière'       : '');

    if (fam === 'Profilés creux') {
      if (dims.fabrication) rows.push(['Façonnage', dims.fabrication === 'chaud' ? 'À chaud (EN 10210)' : 'À froid (EN 10219)']);
      if (ser === 'CHS') {
        if (dims.d  !== undefined) rows.push(['de — Diamètre ext.', `${dims.d} mm`]);
        if (dims.di !== undefined) rows.push(['di — Diamètre int.', `${dims.di} mm`]);
        const ep = dims.e ?? dims.t;
        if (ep !== undefined) rows.push(['t — Épaisseur', `${ep} mm`]);
      } else if (ser === 'RHS') {
        if (dims.a  !== undefined) rows.push(['h — Hauteur',     `${dims.a} mm`]);
        if (dims.b  !== undefined) rows.push(['b — Largeur',     `${dims.b} mm`]);
        const ep = dims.e ?? dims.t;
        if (ep !== undefined) rows.push(['t — Épaisseur', `${ep} mm`]);
        if (dims.ri !== undefined) rows.push(['ri — Rayon int.', `${dims.ri} mm`]);
        if (dims.re !== undefined) rows.push(['re — Rayon ext.', `${dims.re} mm`]);
      } else { // SHS
        if (dims.a  !== undefined) rows.push(['h — Hauteur',     `${dims.a} mm`]);
        const ep = dims.e ?? dims.t;
        if (ep !== undefined) rows.push(['t — Épaisseur', `${ep} mm`]);
        if (dims.ri !== undefined) rows.push(['ri — Rayon int.', `${dims.ri} mm`]);
        if (dims.re !== undefined) rows.push(['re — Rayon ext.', `${dims.re} mm`]);
      }
    } else if (fam === 'Cornière') {
      if (ser === 'L inégale') {
        if (dims.a  !== undefined) rows.push(['h — Hauteur',       `${dims.a} mm`]);
        if (dims.b  !== undefined) rows.push(['b — Largeur',       `${dims.b} mm`]);
        if (dims.t  !== undefined) rows.push(['t — Épaisseur',     `${dims.t} mm`]);
        if (dims.r1 !== undefined) rows.push(['r1 — Rayon int.',   `${dims.r1} mm`]);
      } else {
        if (dims.a  !== undefined) rows.push(['h — Largeur d\'aile', `${dims.a} mm`]);
        if (dims.t  !== undefined) rows.push(['t — Épaisseur',       `${dims.t} mm`]);
        if (dims.r1 !== undefined) rows.push(['r1 — Rayon int.',     `${dims.r1} mm`]);
      }
    } else {
      if (dims.h   !== undefined) rows.push(['h — Hauteur',    `${dims.h} mm`]);
      if (dims.b   !== undefined) rows.push(['b — Largeur',    `${dims.b} mm`]);
      if (dims.tw  !== undefined) rows.push(['tw — Ép. âme',   `${dims.tw} mm`]);
      if (dims.tf  !== undefined) rows.push(['tf — Ép. aile',  `${dims.tf} mm`]);
      if (dims.r   !== undefined) rows.push(['r — Congé',      `${dims.r} mm`]);
    }
    if (dims.pml !== undefined) rows.push(['Poids/ml', `${dims.pml} kg/m`]);
    if (dims.A   !== undefined) rows.push(['Section',  `${dims.A} cm²`]);

    el.innerHTML = rows.map(r =>
      `<div class="dim-row"><span class="dim-label">${r[0]}</span><span class="dim-val">${r[1]}</span></div>`
    ).join('');
  }

  /**
   * Dessine le schéma SVG complet selon le type de section
   * @param {SVGElement} svg
   * @param {string} type
   */
  function _dessinerSVGComplet(svg, type) {
    const S = '#333', F = '#c8d4de';
    const e = (tag, attrs) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    svg.setAttribute('viewBox', '0 0 160 160');

    if (['IPE','HEA','HEB'].includes(type)) {
      const w  = type === 'IPE' ? 90 : 110;
      const ox = (160 - w) / 2;
      const th = type === 'HEB' ? 16 : 11;
      svg.appendChild(e('rect', { x:ox, y:18, width:w, height:th, fill:F, stroke:S, 'stroke-width':1.5 }));
      svg.appendChild(e('rect', { x:ox, y:142-th, width:w, height:th, fill:F, stroke:S, 'stroke-width':1.5 }));
      svg.appendChild(e('rect', { x:ox+(w/2)-5, y:18+th, width:10, height:142-18-2*th, fill:F, stroke:S, 'stroke-width':1.5 }));
    } else if (type === 'UPN') {
      svg.appendChild(e('rect', { x:40, y:18, width:80, height:10, fill:F, stroke:S, 'stroke-width':1.5 }));
      svg.appendChild(e('rect', { x:40, y:132, width:80, height:10, fill:F, stroke:S, 'stroke-width':1.5 }));
      svg.appendChild(e('rect', { x:40, y:28, width:10, height:104, fill:F, stroke:S, 'stroke-width':1.5 }));
    } else if (type === 'Cornière') {
      svg.appendChild(e('rect', { x:35, y:125, width:90, height:10, fill:F, stroke:S, 'stroke-width':1.5 }));
      svg.appendChild(e('rect', { x:35, y:25,  width:10, height:100, fill:F, stroke:S, 'stroke-width':1.5 }));
    } else if (type === 'Plat') {
      svg.appendChild(e('rect', { x:20, y:65, width:120, height:30, fill:F, stroke:S, 'stroke-width':1.5 }));
    } else if (type === 'SHS' || type === 'Tube □') {
      svg.appendChild(e('rect', { x:25, y:25,  width:110, height:110, fill:F, stroke:S, 'stroke-width':1.5 }));
      svg.appendChild(e('rect', { x:38, y:38,  width:84,  height:84,  fill:'white', stroke:S, 'stroke-width':1.5 }));
    } else if (type === 'RHS') {
      svg.appendChild(e('rect', { x:20, y:35,  width:120, height:90,  fill:F, stroke:S, 'stroke-width':1.5 }));
      svg.appendChild(e('rect', { x:33, y:48,  width:94,  height:64,  fill:'white', stroke:S, 'stroke-width':1.5 }));
    } else if (type === 'CHS' || type === 'Tube ○') {
      svg.appendChild(e('circle', { cx:80, cy:80, r:58, fill:F, stroke:S, 'stroke-width':1.5 }));
      svg.appendChild(e('circle', { cx:80, cy:80, r:45, fill:'white', stroke:S, 'stroke-width':1.5 }));
    }

    // Cote h minimale
    svg.appendChild(e('line', { x1:12, y1:18, x2:12, y2:142, stroke:'#d22323', 'stroke-width':1 }));
    svg.appendChild(e('line', { x1:9,  y1:18, x2:28, y2:18,  stroke:'#d22323', 'stroke-width':1 }));
    svg.appendChild(e('line', { x1:9,  y1:142, x2:28, y2:142, stroke:'#d22323', 'stroke-width':1 }));
    const t = e('text', { x:5, y:80, 'font-size':8, fill:'#d22323', 'font-family':'Tahoma', 'text-anchor':'middle' });
    t.setAttribute('transform', 'rotate(-90,5,80)');
    t.textContent = 'h';
    svg.appendChild(t);
  }

  /** Signale visuellement un champ invalide et affiche un message */
  function _signalerErreur(m, selector, message) {
    const el = m.querySelector(selector);
    if (el) {
      el.style.borderColor = 'var(--rouge)';
      el.focus();
      setTimeout(() => el.style.borderColor = '', 3000);
    }
    _notif(message, 'erreur');
  }

  /** Définit la valeur d'un champ dans la modale */
  function _setVal(m, selector, valeur) {
    const el = m.querySelector(selector);
    if (el) el.value = valeur ?? '';
  }

  /** Injecte du texte dans un conteneur info */
  function _afficherInfo(m, selector, valeur) {
    const el = m.querySelector(selector);
    if (el) el.textContent = valeur ?? '—';
  }

  /** Retourne la date du jour au format ISO (YYYY-MM-DD) */
  function _dateAujourdhui() {
    return new Date().toISOString().split('T')[0];
  }


  /* ──────────────────────────────────────────────────────────────
     UTILITAIRES INTERNES
     ────────────────────────────────────────────────────────────── */

  function _val(id) { return document.getElementById(id)?.value || ''; }

  function _parId(id) { return _data?.barres.find(b => b.id === id) || null; }

  function _e(val) {
    if (val == null) return '';
    return String(val)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _notif(msg, type = 'info') {
    const z = document.getElementById('stock-notif');
    if (!z) return;
    z.className   = `notif notif-${type} notif-visible`;
    z.textContent = msg;
    clearTimeout(z._t);
    z._t = setTimeout(() => { z.className = 'notif'; }, 3500);
  }

  function _erreurChargement(msg) {
    const z = document.getElementById('tableau-stock');
    if (z) z.innerHTML = `
      <div class="erreur-chargement">
        <div style="font-size:32px;margin-bottom:12px">⚠️</div>
        <strong>Impossible de charger le stock</strong>
        <p style="margin:10px 0 6px;color:#555">La base de données est inaccessible ou la connexion a échoué.</p>
        <p style="font-size:12px;color:#aaa;margin-bottom:16px">${_e(msg)}</p>
        <button onclick="window.location.reload()"
          style="padding:8px 18px;background:rgb(210,35,42);color:white;border:none;border-radius:3px;cursor:pointer;font-family:Tahoma;font-weight:bold">
          🔄 Réessayer
        </button>
      </div>`;
  }


  /* ──────────────────────────────────────────────────────────────
     PLAN DE STOCKAGE
     ────────────────────────────────────────────────────────────── */

  function _chargerPlanImg() { return _planImg; }

  function _chargerPlanPos() { return { ..._planPos }; }

  function _sauvegarderPlanPos(positions) {
    _planPos = { ...positions };
    localStorage.setItem(CLE_PLAN_POS, JSON.stringify(positions));
    // Sauvegarder pos_x/pos_y sur chaque rack dans Supabase (fire-and-forget)
    if (window.SB) {
      _racks.forEach(r => {
        const pos  = positions[r.id];
        const data = pos ? { pos_x: pos.x, pos_y: pos.y } : { pos_x: null, pos_y: null };
        window.SB.mettreAJour('racks', r.id, data).catch(e =>
          console.warn('[Plan] Erreur sauvegarde position rack :', e)
        );
      });
    }
  }

  /**
   * Charge au démarrage les positions et l'image du plan depuis Supabase,
   * avec fallback sur localStorage si Supabase est indisponible.
   * Doit être appelée APRÈS le chargement de _racks.
   */
  async function _chargerDonnesPlan() {
    // Positions : lire pos_x/pos_y depuis les racks déjà en mémoire
    const posSupabase = {};
    _racks.forEach(r => {
      if (r.pos_x != null && r.pos_y != null) posSupabase[r.id] = { x: r.pos_x, y: r.pos_y };
    });
    if (Object.keys(posSupabase).length) {
      _planPos = posSupabase;
      localStorage.setItem(CLE_PLAN_POS, JSON.stringify(_planPos));
    } else {
      try { _planPos = JSON.parse(localStorage.getItem(CLE_PLAN_POS) || '{}'); } catch { _planPos = {}; }
    }

    // Image : lire depuis la table config
    try {
      if (window.SB) {
        const img = await window.SB.lireConfig('plan_image');
        if (img) {
          _planImg = img;
          localStorage.setItem(CLE_PLAN_IMG, img);
          return;
        }
      }
    } catch(e) {
      console.warn('[Plan] Supabase config indisponible, fallback localStorage :', e);
    }
    _planImg = localStorage.getItem(CLE_PLAN_IMG) || null;
  }

  /** Génère les marqueurs SVG à superposer sur l'image du plan.
   *  showNames=true : tous les marqueurs avec nom + bouton ✕ (vue admin).
   *  showNames=false : uniquement le rack actif en rouge, sans texte (vue localisation). */
  function _svgMarqueursPlan(positions, rackActif, showNames = false) {
    return _racks.map(r => {
      const pos = positions[r.id];
      if (!pos) return '';
      const actif = r.nom === rackActif;
      // Vue localisation : afficher uniquement le rack actif
      if (!showNames && !actif) return '';
      const cx = `${pos.x}%`;
      const cy = `${pos.y}%`;
      if (showNames) {
        // Bouton ✕ décalé en haut à droite du marqueur
        const bx = `${Math.min(pos.x + 1.2, 98)}%`;
        const by = `${Math.max(pos.y - 2.8, 1)}%`;
        // Vue admin : pastille verte + nom + bouton ✕ de suppression individuelle
        // pointer-events:none sur les décorations → les clics passent au canvas en dessous
        // pointer-events:all uniquement sur le bouton ✕
        return `
          <g pointer-events="none">
            <circle cx="${cx}" cy="${cy}" r="10" fill="rgb(45,95,50)" fill-opacity=".85"/>
            <text x="${cx}" y="${cy}" dy="22" text-anchor="middle" fill="rgb(45,95,50)"
              font-size="11" font-family="Tahoma" font-weight="bold"
              style="text-shadow:0 0 3px white,0 0 3px white">${_e(r.nom)}</text>
          </g>
          <g pointer-events="all" style="cursor:pointer"
             onclick="window._supprimerMarqueurRack('${_e(r.id)}')"
             title="Retirer ${_e(r.nom)} du plan">
            <rect x="${bx}" y="${by}" width="14" height="14" rx="3"
              fill="rgb(210,35,42)" fill-opacity=".9" transform="translate(-7,-7)"/>
            <text x="${bx}" y="${by}" text-anchor="middle" dominant-baseline="middle"
              fill="white" font-size="11" font-family="Tahoma" font-weight="bold"
              pointer-events="none">✕</text>
          </g>`;
      }
      // Vue localisation : cercle rouge avec pulsation
      return `
        <circle cx="${cx}" cy="${cy}" r="26" fill="rgb(210,35,42)" fill-opacity=".18">
          <animate attributeName="r" values="22;30;22" dur="1.6s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${cx}" cy="${cy}" r="18" fill="rgb(210,35,42)"/>`;
    }).join('');
  }

  /** Supprime la position d'un seul rack sur le plan (sans effacer les autres). */
  window._supprimerMarqueurRack = function(rackId) {
    const positions = _chargerPlanPos();
    if (!positions[rackId]) return;
    delete positions[rackId];
    _sauvegarderPlanPos(positions);
    const planSvg = document.getElementById('admin-plan-svg');
    if (planSvg) planSvg.innerHTML = _svgMarqueursPlan(positions, null, true);
    const rack = _racks.find(r => r.id === rackId);
    _notif(`Marqueur "${rack?.nom || '…'}" retiré du plan`, 'info');
  };

  /**
   * Ouvre la modale de plan et met en évidence le rack correspondant.
   * @param {string} lieu — ex. "Rack 1 - B4" ou "Zone Ext."
   */
  function _ouvrirCarte(lieu) {
    const m = document.getElementById('m-carte');
    if (!m) return;

    const titre = m.querySelector('#carte-titre');
    if (titre) titre.textContent = `Emplacement : ${lieu}`;

    const img      = _chargerPlanImg();
    const noPlan   = m.querySelector('#carte-no-plan');
    const planWrap = m.querySelector('#carte-plan-wrap');
    const planImg  = m.querySelector('#carte-plan-img');
    const svgOver  = m.querySelector('#carte-plan-svg');

    // Plan personnalisé ou plan provisoire par défaut
    const src = img || PLAN_PROVISOIRE_SRC;
    if (noPlan)   noPlan.style.display   = 'none';
    if (planWrap) planWrap.style.display  = '';
    if (planImg)  planImg.src = src;

    // Marqueurs sur tous les plans (provisoire ou personnalisé)
    if (svgOver) {
      const rackNom = lieu.includes(' - ') ? lieu.split(' - ')[0].trim() : lieu;
      svgOver.innerHTML = _svgMarqueursPlan(_chargerPlanPos(), rackNom);
    }

    m.classList.add('open');
  }

  window._ouvrirCarte = _ouvrirCarte;

  /* ── Gestion admin du plan ───────────────────────────────────── */

  function _rendreAdminPlan() {
    const img       = _chargerPlanImg();
    const positions = _chargerPlanPos();
    const editor    = document.getElementById('admin-plan-editor');
    const btnClear  = document.getElementById('admin-plan-clear');
    const planImg   = document.getElementById('admin-plan-img');
    const planSvg   = document.getElementById('admin-plan-svg');
    const sel       = document.getElementById('admin-plan-rack-sel');

    if (sel) {
      sel.innerHTML = '<option value="">— Choisir —</option>'
        + [..._racks]
            .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
            .map(r => `<option value="${_e(r.id)}">${_e(r.nom)}</option>`)
            .join('');
    }

    if (editor) editor.style.display = '';
    if (btnClear) btnClear.style.display = img ? '' : 'none';

    const src = img || PLAN_PROVISOIRE_SRC;
    if (planImg) planImg.src = src;
    if (planSvg) planSvg.innerHTML = _svgMarqueursPlan(positions, null, true);
  }

  function _attacherAdminPlan() {
    const input = document.getElementById('admin-plan-input');
    const wrap  = document.getElementById('admin-plan-canvas-wrap');

    input?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const imgData = ev.target.result;
        _planImg = imgData;
        localStorage.setItem(CLE_PLAN_IMG, imgData);
        // Sauvegarder dans Supabase (fire-and-forget)
        if (window.SB) {
          window.SB.sauvegarderConfig('plan_image', imgData).catch(e =>
            console.warn('[Plan] Erreur sauvegarde image :', e)
          );
        }
        _rendreAdminPlan();
        _notif('Plan chargé et synchronisé', 'succes');
      };
      reader.readAsDataURL(file);
      input.value = '';
    });

    document.getElementById('admin-plan-clear')?.addEventListener('click', () => {
      _planImg = null;
      _planPos = {};
      localStorage.removeItem(CLE_PLAN_IMG);
      localStorage.removeItem(CLE_PLAN_POS);
      // Effacer dans Supabase (fire-and-forget)
      if (window.SB) {
        window.SB.sauvegarderConfig('plan_image', null).catch(() => {});
        _racks.forEach(r =>
          window.SB.mettreAJour('racks', r.id, { pos_x: null, pos_y: null }).catch(() => {})
        );
      }
      _rendreAdminPlan();
      _notif('Plan supprimé', 'info');
    });

    wrap?.addEventListener('click', e => {
      const rackId = document.getElementById('admin-plan-rack-sel')?.value;
      if (!rackId) { _notif('Sélectionnez une zone d\'abord', 'alerte'); return; }
      const rect = wrap.getBoundingClientRect();
      const x = +((e.clientX - rect.left)  / rect.width  * 100).toFixed(2);
      const y = +((e.clientY - rect.top)   / rect.height * 100).toFixed(2);
      const positions = _chargerPlanPos();
      positions[rackId] = { x, y };
      _sauvegarderPlanPos(positions);
      const planSvg = document.getElementById('admin-plan-svg');
      if (planSvg) planSvg.innerHTML = _svgMarqueursPlan(positions, null, true);
      const rack = _racks.find(r => r.id === rackId);
      _notif(`${rack?.nom || 'Zone'} placée sur le plan`, 'succes');
    });
  }

  /* ──────────────────────────────────────────────────────────────
     SUPPRESSION D'UNE BARRE
     ────────────────────────────────────────────────────────────── */

  /**
   * Ouvre la modale de confirmation de suppression
   * @param {string} id — BAR-XXXX ou TOL-XXXX
   */
  function _ouvrirConfirmationSuppression(id) {
    const el = _parId(id);
    if (!el) return;

    const mSup = document.getElementById('m-supprimer');
    if (!mSup) return;

    mSup.dataset.idEnCours = id;
    mSup.dataset.mode = 'archiver';

    // Titre et couleurs mode archivage
    const titre = document.getElementById('sup-titre');
    const info  = document.getElementById('sup-info-barre');
    const desc  = document.getElementById('sup-description');
    const btn   = document.getElementById('sup-btn-confirmer');

    if (titre) { titre.textContent = '📦 Archiver cet élément'; titre.style.color = 'var(--bleu-info)'; }
    if (info) {
      info.style.background = '#e8f0fe';
      info.style.border = '1px solid var(--bleu-info)';
      info.style.color = 'var(--bleu-info)';
      if (el.categorie === 'profil') {
        info.innerHTML = `<strong>${_e(el.id)}</strong> — ${_e(el.section_type)} ${_e(el.designation)} · ${el.longueur_m.toFixed(2)} m · ${_e(el.lieu_stockage)}`;
      } else {
        info.innerHTML = `<strong>${_e(el.id)}</strong> — Tôle ${el.epaisseur_mm} mm · ${el.largeur_mm}×${el.longueur_mm} mm · ${el.quantite} pièce(s) · ${_e(el.lieu_stockage)}`;
      }
    }
    if (desc) desc.innerHTML = `L'élément sera <strong>archivé</strong> et consultable dans l'onglet <em>Archivées</em>. Il ne sera plus visible dans le stock actif.`;
    if (btn) { btn.textContent = '📦 Archiver'; btn.className = 'btn-modale btn-modale-bleu btn-confirmer-sup'; }

    _fermerModale('m-modification');
    _ouvrirModale('m-supprimer');
  }

  function _ouvrirConfirmationSuppressionDefinitive(id) {
    const el = _parId(id);
    if (!el) return;

    const mSup = document.getElementById('m-supprimer');
    if (!mSup) return;

    mSup.dataset.idEnCours = id;
    mSup.dataset.mode = 'supprimer';

    const titre = document.getElementById('sup-titre');
    const info  = document.getElementById('sup-info-barre');
    const desc  = document.getElementById('sup-description');
    const btn   = document.getElementById('sup-btn-confirmer');

    if (titre) { titre.textContent = '🗑 Suppression définitive'; titre.style.color = 'var(--rouge)'; }
    if (info) {
      info.style.background = '#fde8e8';
      info.style.border = '1px solid var(--rouge)';
      info.style.color = 'var(--rouge)';
      if (el.categorie === 'profil') {
        info.innerHTML = `<strong>${_e(el.id)}</strong> — ${_e(el.section_type)} ${_e(el.designation)} · ${_e(el.lieu_stockage)}`;
      } else {
        info.innerHTML = `<strong>${_e(el.id)}</strong> — Tôle ${el.epaisseur_mm} mm · ${el.largeur_mm}×${el.longueur_mm} mm`;
      }
    }
    if (desc) desc.innerHTML = `Cette action est <strong>irréversible</strong>. L'élément sera définitivement supprimé de la base de données.`;
    if (btn) { btn.textContent = '🗑 Supprimer définitivement'; btn.className = 'btn-modale btn-modale-rouge btn-confirmer-sup'; }

    _ouvrirModale('m-supprimer');
  }

  /**
   * Exécute l'archivage ou la suppression définitive après confirmation
   */
  async function _confirmerSuppression() {
    const mSup = document.getElementById('m-supprimer');
    if (!mSup) return;

    const id   = mSup.dataset.idEnCours;
    const mode = mSup.dataset.mode || 'archiver';
    if (!id) return;

    let enLigne = true;

    if (mode === 'archiver') {
      // ── Archivage : PATCH statut → archivee ──────────────────
      const el = _parId(id);
      const longAvant = el?.longueur_m ?? 0;
      try {
        await window.SB.mettreAJour('stock', id, { statut: 'archivee' });
        await _enregistrerHistorique(id, 'ARCHIVAGE', longAvant, 0,
          null, Auth.getSession()?.identifiant || null, null, 'Archivage manuel');
      } catch(e) {
        console.warn('[Stock] Supabase indisponible, archivage local :', e);
        enLigne = false;
      }
      // Mise à jour en mémoire
      const barre = _data.barres.find(b => b.id === id);
      if (barre) barre.statut = 'archivee';
      _fermerModale('m-supprimer');
      _peuplerFiltres();
      _filtrer();
      _majAlerteAttente();
      _notif(`${id} archivé` + (enLigne ? '' : ' — ⚠ mode hors ligne'), enLigne ? 'succes' : 'alerte');

    } else {
      // ── Suppression définitive : DELETE ──────────────────────
      try {
        await window.SB.supprimer('stock', id);
      } catch(e) {
        console.warn('[Stock] Supabase indisponible, suppression locale :', e);
        const local = _chargerLocal();
        const idx = local.barres.findIndex(b => b.id === id);
        if (idx !== -1) local.barres.splice(idx, 1);
        else local.barres.push({ id, _supprime: true });
        _sauvegarderLocal(local);
        enLigne = false;
      }
      _data.barres = _data.barres.filter(b => b.id !== id);
      _fermerModale('m-supprimer');
      _peuplerFiltres();
      _filtrer();
      _majAlerteAttente();
      _notif(`${id} supprimé définitivement` + (enLigne ? '' : ' — ⚠ mode hors ligne'), enLigne ? 'succes' : 'alerte');
    }
  }


  /* ──────────────────────────────────────────────────────────────
     ZOOM IMAGE FICHE SECTION
     ────────────────────────────────────────────────────────────── */

  /**
   * Toggle zoom plein écran sur l'image de la fiche section
   * Identique au comportement de la bibliothèque (mfZoomImage)
   * @param {HTMLImageElement} img
   */
  function _zoomImage(img) {
    const estZoom = img.dataset.zoom === '1';

    if (estZoom) {
      // Retour à la normale
      img.dataset.zoom   = '0';
      img.style.cursor   = 'zoom-in';
      const overlay = document.getElementById('stock-zoom-overlay');
      if (overlay) overlay.remove();
    } else {
      // Créer l'overlay plein écran
      img.dataset.zoom = '1';
      img.style.cursor = 'zoom-out';

      const overlay = document.createElement('div');
      overlay.id = 'stock-zoom-overlay';
      overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.75);
        display:flex; align-items:center; justify-content:center;
        z-index:9999; cursor:zoom-out;`;
      overlay.onclick = () => _zoomImage(img);

      // Image agrandie
      const imgGrande = document.createElement('img');
      imgGrande.src   = img.src;
      imgGrande.alt   = img.alt;
      imgGrande.style.cssText = `
        max-width:90vw; max-height:85vh;
        object-fit:contain; display:block;
        border-radius:4px; box-shadow:0 8px 40px rgba(0,0,0,0.6);`;
      overlay.appendChild(imgGrande);

      // Bouton fermer
      const btnFermer = document.createElement('button');
      btnFermer.textContent = '✕';
      btnFermer.style.cssText = `
        position:absolute; top:16px; right:20px;
        background:rgba(255,255,255,0.15); border:none; color:white;
        font-size:22px; cursor:pointer; border-radius:50%;
        width:36px; height:36px; display:flex; align-items:center; justify-content:center;`;
      btnFermer.onclick = (e) => { e.stopPropagation(); _zoomImage(img); };
      overlay.appendChild(btnFermer);

      document.body.appendChild(overlay);
    }
  }


  /* ──────────────────────────────────────────────────────────────
     EXPORT / IMPORT CSV (admin)
     ────────────────────────────────────────────────────────────── */

  /** Colonnes du CSV (ordre fixe, couvre profilés et tôles) */
  const CSV_CHAMPS = [
    'id', 'categorie',
    'section_type', 'designation', 'longueur_m', 'poids_ml', 'poids_barre_kg',
    'classe_acier', 'ref_commande', 'fournisseur',
    'epaisseur_mm', 'largeur_mm', 'longueur_mm', 'quantite',
    'poids_unitaire_kg', 'poids_total_kg',
    'chantier_origine', 'lieu_stockage', 'disponibilite', 'chantier_affectation',
    'statut', 'date_ajout', 'ajoute_par', 'valide_par', 'date_validation', 'commentaire',
  ];

  /**
   * Exporte tout le stock (hors archivées) en fichier CSV téléchargeable.
   * Séparateur ";" et BOM UTF-8 pour compatibilité Excel.
   */
  function _exporterCSV() {
    if (!Auth.hasRight('can_validate')) return;

    const SEP = ';';
    const esc = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return (s.includes(SEP) || s.includes('"') || s.includes('\n'))
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };

    const elements = _data.barres.filter(b => b.statut !== 'archivee');
    const lignes   = [CSV_CHAMPS.join(SEP)];
    for (const b of elements) {
      lignes.push(CSV_CHAMPS.map(c => esc(b[c])).join(SEP));
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const blob = new Blob(['\uFEFF' + lignes.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const lien = Object.assign(document.createElement('a'), {
      href: url, download: `stock-lbf-${dateStr}.csv`,
    });
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(url);

    _notif(`Export réussi — ${elements.length} élément(s) téléchargé(s)`, 'succes');
  }

  /* ──────────────────────────────────────────────────────────────
     IMPRESSION / PDF
     ────────────────────────────────────────────────────────────── */

  function _imprimerListe() {
    if (!_data) return;

    // Recalculer les données filtrées courantes
    const session   = window.Auth ? window.Auth.getSession() : null;
    const voirRefus = session?.profil === 'administration';

    let source;
    if (_onglet === 'archivees') {
      source = _data.barres.filter(b => b.statut === 'archivee');
    } else {
      source = _data.barres.filter(b => {
        if (b.statut === 'archivee') return false;
        if (!voirRefus && b.statut === 'refuse') return false;
        return _onglet === 'profils' ? b.categorie === 'profil' : b.categorie === 'tole';
      });
    }
    let resultats = _onglet === 'profils' ? _filtrerProfils(source)
                  : _onglet === 'toles'   ? _filtrerToles(source)
                  : _filtrerArchivees(source);
    if (_tri.col) resultats = _trier(resultats);

    // Collecter les filtres actifs pour l'en-tête
    const filtresActifs = [];
    if (_onglet === 'profils') {
      if (_val('p-type'))     filtresActifs.push(`Type : ${_val('p-type')}`);
      if (_val('p-desig'))    filtresActifs.push(`Désignation : ${_val('p-desig')}`);
      if (_val('p-chantier')) filtresActifs.push(`Chantier : ${_val('p-chantier')}`);
      if (_val('p-lieu'))     filtresActifs.push(`Lieu : ${_val('p-lieu')}`);
      if (_val('p-dispo'))    filtresActifs.push(`Dispo : ${_val('p-dispo')}`);
      if (_val('p-recherche')) filtresActifs.push(`Recherche : "${_val('p-recherche')}"`);
    } else if (_onglet === 'toles') {
      if (_val('t-type'))      filtresActifs.push(`Type : ${_LABEL_TYPE_TOLE[_val('t-type')] || _val('t-type')}`);
      if (_val('t-epaisseur')) filtresActifs.push(`Épaisseur : ${_val('t-epaisseur')} mm`);
      if (_val('t-chantier'))  filtresActifs.push(`Chantier : ${_val('t-chantier')}`);
      if (_val('t-lieu'))      filtresActifs.push(`Lieu : ${_val('t-lieu')}`);
      if (_val('t-dispo'))     filtresActifs.push(`Dispo : ${_val('t-dispo')}`);
      if (_val('t-recherche')) filtresActifs.push(`Recherche : "${_val('t-recherche')}"`);
    } else {
      if (_val('a-type'))      filtresActifs.push(`Type : ${_val('a-type')}`);
      if (_val('a-desig'))     filtresActifs.push(`Désignation : ${_val('a-desig')}`);
      if (_val('a-recherche')) filtresActifs.push(`Recherche : "${_val('a-recherche')}"`);
    }

    const titreOnglet = _onglet === 'profils' ? 'Profilés'
                      : _onglet === 'toles'   ? 'Tôles'
                      : 'Archivées';
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // Générer les lignes du tableau selon l'onglet
    let enTetes = '';
    let lignes  = '';

    if (_onglet === 'profils') {
      enTetes = `<tr>
        <th>ID</th><th>Type</th><th>Désignation</th><th>Long. (m)</th>
        <th>Poids (kg)</th><th>Classe</th><th>Statut</th>
        <th>Lieu stockage</th><th>Chantier</th><th>Commentaire</th>
      </tr>`;
      lignes = resultats.map(b => {
        const poids = _poidsEffectifProfil(b);
        const statut = b.statut === 'en_attente' ? 'En attente'
                     : b.disponibilite === 'disponible' ? 'Disponible' : 'Affecté';
        return `<tr>
          <td>${_e(b.id)}</td>
          <td>${_e(b.section_type)}</td>
          <td>${_e(b.designation)}</td>
          <td>${typeof b.longueur_m === 'number' ? b.longueur_m.toFixed(2) : '—'}</td>
          <td>${poids > 0 ? poids.toFixed(1) : '—'}</td>
          <td>${_e(b.classe_acier || '—')}</td>
          <td>${statut}</td>
          <td>${_e(b.lieu_stockage || '—')}</td>
          <td>${_e(_labelChantier(b.chantier_affectation) || b.chantier_affectation || '—')}</td>
          <td>${_e(b.commentaire || '—')}</td>
        </tr>`;
      }).join('');
    } else if (_onglet === 'toles') {
      enTetes = `<tr>
        <th>ID</th><th>Type</th><th>Ép. (mm)</th><th>Dimensions (mm)</th>
        <th>Surface unit.</th><th>Qté</th><th>Surface tot.</th>
        <th>Poids unit. (kg)</th><th>Réf. cmd</th>
        <th>Statut</th><th>Lieu stockage</th><th>Chantier</th>
      </tr>`;
      lignes = resultats.map(b => {
        const surf    = _surfaceTole(b);
        const surfU   = surf > 0 ? surf.toFixed(2) + ' m²' : '—';
        const surfT   = surf > 0 ? (surf * (b.quantite || 1)).toFixed(2) + ' m²' : '—';
        const poidsU  = b.poids_unitaire_kg != null ? Math.ceil(b.poids_unitaire_kg) : '—';
        const statut  = b.statut === 'en_attente' ? 'En attente'
                      : b.disponibilite === 'disponible' ? 'Disponible' : 'Affecté';
        return `<tr>
          <td>${_e(b.id)}${b.is_chute ? ' (chute)' : ''}</td>
          <td>${_LABEL_TYPE_TOLE[b.type_tole] || (b.type_tole ? _e(b.type_tole) : '—')}</td>
          <td>${b.epaisseur_mm}</td>
          <td>${b.largeur_mm} × ${b.longueur_mm}</td>
          <td>${surfU}</td>
          <td>${b.quantite}</td>
          <td>${surfT}</td>
          <td>${poidsU}</td>
          <td>${_e(b.ref_commande || '—')}</td>
          <td>${statut}</td>
          <td>${_e(b.lieu_stockage || '—')}</td>
          <td>${_e(_labelChantier(b.chantier_origine) || b.chantier_origine || '—')}</td>
        </tr>`;
      }).join('');
    } else {
      enTetes = `<tr>
        <th>ID</th><th>Type</th><th>Désignation</th><th>Long. (m)</th>
        <th>Poids (kg)</th><th>Lieu stockage</th><th>Chantier origine</th><th>Date ajout</th>
      </tr>`;
      lignes = resultats.map(b => {
        const poids = _poidsEffectifProfil(b);
        const dateAjout = b.date_ajout
          ? new Date(b.date_ajout).toLocaleDateString('fr-FR') : '—';
        return `<tr>
          <td>${_e(b.id)}</td>
          <td>${_e(b.section_type)}</td>
          <td>${_e(b.designation)}</td>
          <td>${typeof b.longueur_m === 'number' ? b.longueur_m.toFixed(2) : '—'}</td>
          <td>${poids > 0 ? poids.toFixed(1) : '—'}</td>
          <td>${_e(b.lieu_stockage || '—')}</td>
          <td>${_e(_labelChantier(b.chantier_origine) || b.chantier_origine || '—')}</td>
          <td>${dateAjout}</td>
        </tr>`;
      }).join('');
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Stock ${titreOnglet} — Le Bras Frères</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #222; padding: 16px; }
    .entete { margin-bottom: 14px; border-bottom: 2px solid #d22323; padding-bottom: 10px; }
    .entete h1 { font-size: 16px; color: #d22323; margin-bottom: 4px; }
    .entete .meta { font-size: 11px; color: #555; margin-bottom: 3px; }
    .entete .filtres { font-size: 10px; color: #888; font-style: italic; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #222; color: white; padding: 5px 6px; text-align: left; font-size: 10px; white-space: nowrap; }
    td { padding: 4px 6px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
    tr:nth-child(even) td { background: #f7f7f7; }
    .pied { margin-top: 12px; font-size: 10px; color: #aaa; text-align: right; }
    @page { margin: 1.2cm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="entete">
    <h1>Le Bras Frères — Stock Métallerie · ${titreOnglet}</h1>
    <div class="meta">${resultats.length} élément(s) · Imprimé le ${dateStr}</div>
    ${filtresActifs.length ? `<div class="filtres">Filtres : ${filtresActifs.join(' · ')}</div>` : ''}
  </div>
  <table>
    <thead>${enTetes}</thead>
    <tbody>${lignes || '<tr><td colspan="10" style="text-align:center;padding:12px;color:#aaa">Aucun élément</td></tr>'}</tbody>
  </table>
  <div class="pied">LBF Stock v2 — ${dateStr}</div>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) { _notif('Popup bloquée — autoriser les popups pour ce site', 'erreur'); return; }
    w.document.write(html);
    w.document.close();
  }

  /** Données parsées en attente de confirmation d'import */
  let _importData = null;

  /** Ouvre la modale d'import et réinitialise son état */
  function _ouvrirImport() {
    if (!Auth.hasRight('can_validate')) return;
    _importData = null;

    const m = document.getElementById('m-import');
    if (!m) return;

    const fi = m.querySelector('#import-fichier');
    if (fi) fi.value = '';
    m.querySelector('#import-nom-fichier').textContent    = '';
    m.querySelector('#import-resume').style.display       = 'none';
    m.querySelector('#import-avertissement').style.display = 'none';
    m.querySelector('#import-erreur').style.display       = 'none';
    m.querySelector('#import-btn-analyser').disabled      = true;
    m.querySelector('#import-btn-analyser').style.display = '';
    m.querySelector('#import-btn-confirmer').style.display = 'none';

    _ouvrirModale('m-import');
  }

  /**
   * Analyse le fichier CSV sélectionné.
   * Parse, valide les lignes, affiche le résumé et active le bouton Importer.
   */
  function _analyserImport() {
    const m = document.getElementById('m-import');
    if (!m) return;

    const fi = m.querySelector('#import-fichier');
    if (!fi?.files[0]) return;

    const afficherErreur = msg => {
      const el = m.querySelector('#import-erreur');
      el.innerHTML = msg;
      el.style.display = 'block';
    };

    const reader = new FileReader();
    reader.onload = e => {
      try {
        let texte = e.target.result;
        // Retirer BOM éventuel
        if (texte.charCodeAt(0) === 0xFEFF) texte = texte.slice(1);

        // ── Parser CSV (séparateur ; avec support guillemets)
        const parseRow = line => {
          const cells = [];
          let inQ = false, cell = '';
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (inQ) {
              if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
              else if (c === '"') inQ = false;
              else cell += c;
            } else if (c === '"') {
              inQ = true;
            } else if (c === ';') {
              cells.push(cell); cell = '';
            } else {
              cell += c;
            }
          }
          cells.push(cell);
          return cells;
        };

        const lignesBrutes = texte.split(/\r?\n/).filter(l => l.trim());
        if (lignesBrutes.length < 2) {
          afficherErreur('Le fichier est vide ou ne contient pas de données.');
          return;
        }

        const headers = parseRow(lignesBrutes[0]);
        if (!headers.includes('id') || !headers.includes('categorie')) {
          afficherErreur('Format invalide — colonnes "id" et "categorie" introuvables.<br>Utilisez un fichier exporté depuis cette application.');
          return;
        }

        // ── Convertir chaque ligne en objet
        const nb   = (v, def = null) => { const n = parseFloat(v);  return isNaN(n) ? def : n; };
        const ni   = (v, def = null) => { const n = parseInt(v, 10); return isNaN(n) ? def : n; };
        const str  = (v, def = null) => (v && String(v).trim()) ? String(v).trim() : def;

        const valides = [];
        const erreurs = [];

        for (let i = 1; i < lignesBrutes.length; i++) {
          const cells = parseRow(lignesBrutes[i]);
          const row   = {};
          headers.forEach((h, j) => { row[h] = cells[j] ?? ''; });

          const id  = str(row.id);
          const cat = str(row.categorie);

          if (!id)                         { erreurs.push(`Ligne ${i + 1} : ID manquant`); continue; }
          if (!['profil','tole'].includes(cat)) { erreurs.push(`Ligne ${i + 1} (${id}) : catégorie invalide`); continue; }

          const base = {
            id, categorie: cat,
            chantier_origine:    str(row.chantier_origine),
            lieu_stockage:       str(row.lieu_stockage),
            disponibilite:       str(row.disponibilite, 'disponible'),
            chantier_affectation: str(row.chantier_affectation),
            statut:              str(row.statut, 'valide'),
            date_ajout:          str(row.date_ajout),
            ajoute_par:          str(row.ajoute_par),
            valide_par:          str(row.valide_par),
            date_validation:     str(row.date_validation),
            commentaire:         str(row.commentaire),
          };

          if (cat === 'profil') {
            valides.push({
              ...base,
              section_type:    str(row.section_type),
              designation:     str(row.designation),
              longueur_m:      nb(row.longueur_m),
              poids_ml:        nb(row.poids_ml),
              poids_barre_kg:  nb(row.poids_barre_kg),
              classe_acier:    str(row.classe_acier),
              ref_commande:    str(row.ref_commande),
              fournisseur:     str(row.fournisseur),
            });
          } else {
            valides.push({
              ...base,
              epaisseur_mm:      nb(row.epaisseur_mm),
              largeur_mm:        nb(row.largeur_mm),
              longueur_mm:       nb(row.longueur_mm),
              quantite:          ni(row.quantite, 1),
              poids_unitaire_kg: nb(row.poids_unitaire_kg),
              poids_total_kg:    nb(row.poids_total_kg),
            });
          }
        }

        if (!valides.length) {
          afficherErreur('Aucune ligne valide trouvée dans le fichier.' +
            (erreurs.length ? `<br>${erreurs.slice(0, 3).join('<br>')}` : ''));
          return;
        }

        _importData = valides;

        // Résumé
        const nbProfils = valides.filter(b => b.categorie === 'profil').length;
        const nbToles   = valides.filter(b => b.categorie === 'tole').length;
        const resumeEl  = m.querySelector('#import-resume');
        resumeEl.innerHTML =
          `<strong>Fichier analysé :</strong><br>` +
          `&nbsp;• ${nbProfils} profilé(s)<br>` +
          `&nbsp;• ${nbToles} tôle(s)<br>` +
          `&nbsp;• <strong>Total : ${valides.length} élément(s)</strong>` +
          (erreurs.length
            ? `<br><span style="color:var(--rouge)">⚠ ${erreurs.length} ligne(s) ignorée(s)</span>`
            : '');
        resumeEl.style.display = 'block';

        m.querySelector('#import-erreur').style.display        = 'none';
        m.querySelector('#import-avertissement').style.display = 'block';
        m.querySelector('#import-btn-analyser').style.display  = 'none';
        m.querySelector('#import-btn-confirmer').style.display = '';

      } catch (ex) {
        afficherErreur('Erreur lors de la lecture : ' + ex.message);
      }
    };
    reader.readAsText(fi.files[0], 'UTF-8');
  }

  /**
   * Importe (upsert) tous les éléments parsés dans Supabase / localStorage.
   */
  async function _confirmerImport() {
    if (!_importData?.length || !Auth.hasRight('can_validate')) return;

    const m = document.getElementById('m-import');
    const btnOk = m?.querySelector('#import-btn-confirmer');
    if (btnOk) { btnOk.disabled = true; btnOk.textContent = 'Import en cours…'; }

    let ok = 0, horsLigne = 0;
    for (const element of _importData) {
      const enLigne = await _persisterElement(element);
      if (enLigne) { ok++; } else { horsLigne++; }
    }

    _importData = null;
    _fermerModale('m-import');
    _peuplerFiltres();
    _filtrer();
    _majAlerteAttente();

    const total = ok + horsLigne;
    const msg = horsLigne === 0
      ? `Import réussi — ${ok} élément(s) chargé(s)`
      : ok === 0
        ? `Import hors ligne — ${horsLigne} élément(s) sauvegardé(s) localement`
        : `Import partiel — ${ok} en base, ${horsLigne} hors ligne`;
    _notif(msg, horsLigne === 0 ? 'succes' : 'alerte');
  }


  /* ──────────────────────────────────────────────────────────────
     NAVIGATION STOCK ↔ ADMINISTRATION
     ────────────────────────────────────────────────────────────── */

  function _activerSectionAdmin(onglet = _ongletAdmin) {
    _ongletAdmin = onglet;
    _sectionActive = 'admin';

    document.getElementById('section-stock')?.style.setProperty('display', 'none');
    document.getElementById('section-admin')?.style.setProperty('display', 'block');

    // Activer nav-admin
    document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('actif'));
    document.getElementById('nav-admin')?.classList.add('actif');

    // Activer sous-onglet admin
    _activerOngletAdmin(onglet);
  }

  function _activerSectionStock() {
    _sectionActive = 'stock';
    document.getElementById('section-stock')?.style.setProperty('display', 'block');
    document.getElementById('section-admin')?.style.setProperty('display', 'none');

    document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('actif'));
    document.querySelector('.nav-item[href="stock.html"]')?.classList.add('actif');
  }

  function _activerOngletAdmin(onglet) {
    _ongletAdmin = onglet;
    document.querySelectorAll('#section-admin .sous-onglet').forEach(btn => {
      btn.classList.toggle('actif', btn.dataset.adminOnglet === onglet);
    });
    document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
    const panel = document.getElementById(`admin-panel-${onglet}`);
    if (panel) panel.style.display = 'block';

    if (onglet === 'stockage')     { _rendreRacks(); _rendreAdminPlan(); }
    if (onglet === 'chantiers')    _rendreChantiers();
    if (onglet === 'fournisseurs') _rendreFournisseurs();
    if (onglet === 'demandeurs')   _rendreDemandeurs();
    if (onglet === 'comptes' && typeof chargerUsers === 'function') chargerUsers();
  }

  function _attacherNavAdmin() {
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) {
      navAdmin.addEventListener('click', e => {
        e.preventDefault();
        _activerSectionAdmin();
      });
    }
    const navStock = document.querySelector('.nav-item[href="stock.html"]');
    if (navStock) {
      navStock.addEventListener('click', e => {
        e.preventDefault();
        _activerSectionStock();
      });
    }
    document.querySelectorAll('#section-admin .sous-onglet').forEach(btn => {
      btn.addEventListener('click', () => _activerOngletAdmin(btn.dataset.adminOnglet));
    });
  }

  /* ──────────────────────────────────────────────────────────────
     ADMIN STOCKAGE
     ────────────────────────────────────────────────────────────── */

  function ouvrirAdminStockage() {
    _activerSectionAdmin('stockage');
  }

  function _rendreRacks() {
    const zone = document.getElementById('admin-racks-liste');
    if (!zone) return;
    if (!_racks.length) {
      zone.innerHTML = '<div class="admin-ref-vide">Aucune zone configurée</div>';
      return;
    }
    const sorted = [..._racks].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
    zone.innerHTML = `
      <table class="admin-rack-table">
        <thead><tr>
          <th>Zone</th><th>Allées</th><th>Étages</th><th>Emplacements</th><th></th>
        </tr></thead>
        <tbody>
          ${sorted.map(r => {
            const plat = !r.nb_allees || !r.nb_etages;
            const nb = plat ? 0 : r.nb_allees * r.nb_etages;
            const alleeLabel = plat ? '—' : `A – ${_e(_labelAllee(r.nb_allees - 1))} (${r.nb_allees})`;
            const etageLabel = plat ? '—' : `1 – ${r.nb_etages}`;
            return `<tr data-rack-row="${_e(r.id)}">
              <td><strong>${_e(r.nom)}</strong></td>
              <td>${alleeLabel}</td>
              <td>${etageLabel}</td>
              <td style="color:#888;font-size:12px">${plat ? 'Zone plate' : `${nb} emplacement${nb > 1 ? 's' : ''}`}</td>
              <td class="admin-ch-actions">
                <button class="admin-ref-edit" data-rack-id="${_e(r.id)}" title="Modifier">✎</button>
                <button class="admin-ref-del" data-rack-id="${_e(r.id)}" data-nom="${_e(r.nom)}" title="Supprimer">✕</button>
              </td>
            </tr>
            <tr class="admin-ch-edit-row" data-rack-edit="${_e(r.id)}" style="display:none">
              <td colspan="5">
                <div class="admin-ch-edit-form">
                  <input class="admin-input-sm" data-rack-field="nom" placeholder="Nom de la zone" value="${_e(r.nom)}" style="flex:2">
                  <input class="admin-input-sm" data-rack-field="nb_allees" type="number" min="0" placeholder="Allées" value="${r.nb_allees ?? ''}" style="width:70px;flex:none">
                  <input class="admin-input-sm" data-rack-field="nb_etages" type="number" min="0" placeholder="Étages" value="${r.nb_etages ?? ''}" style="width:70px;flex:none">
                  <button class="btn-sm btn-valider" data-rack-save="${_e(r.id)}">Enregistrer</button>
                  <button class="btn-sm btn-annuler" data-rack-cancel="${_e(r.id)}">Annuler</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  async function _adminModifierRack(id) {
    const editRow = document.querySelector(`[data-rack-edit="${id}"]`);
    if (!editRow) return;
    const nom = editRow.querySelector('[data-rack-field="nom"]')?.value?.trim();
    const na  = parseInt(editRow.querySelector('[data-rack-field="nb_allees"]')?.value) || 0;
    const ne  = parseInt(editRow.querySelector('[data-rack-field="nb_etages"]')?.value) || 0;
    if (!nom) { _notif('Le nom est requis', 'alerte'); return; }
    if (na > 0 && ne < 1) { _notif('Étages : minimum 1', 'alerte'); return; }
    try {
      await window.SB.mettreAJour('racks', id, { nom, nb_allees: na, nb_etages: na === 0 ? 0 : ne });
      const rows = await window.SB.lire('racks', { order: 'created_at' });
      _racks = rows.filter(r => r.actif);
      _lieux = _majLieux();
      _rendreRacks();
      _notif('Zone modifiée', 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  function _aperçuRack(nom, nbAllees, nbEtages) {
    if (!nom) return '';
    if (!nbAllees || !nbEtages) return `${nom} (zone plate, sans allée ni étage)`;
    const ex = [];
    outer: for (let a = 0; a < nbAllees; a++) {
      for (let e = 1; e <= nbEtages; e++) {
        ex.push(`${nom} - ${_labelAllee(a)}${e}`);
        if (ex.length >= 4) break outer;
      }
    }
    const total = nbAllees * nbEtages;
    return ex.join(', ') + (total > 4 ? ` … (${total} au total)` : '');
  }

  function _majAperçuRack() {
    const m   = document.getElementById('admin-panel-stockage');
    const nom = m?.querySelector('#admin-rack-nom')?.value?.trim() || '';
    const na  = parseInt(m?.querySelector('#admin-rack-allees')?.value) || 0;
    const ne  = parseInt(m?.querySelector('#admin-rack-etages')?.value) || 0;
    const el  = m?.querySelector('#admin-rack-apercu');
    if (el) el.textContent = _aperçuRack(nom, na, ne);
  }

  async function _adminAjouterRack() {
    const m   = document.getElementById('admin-panel-stockage');
    const nom = m?.querySelector('#admin-rack-nom')?.value?.trim();
    const na  = parseInt(m?.querySelector('#admin-rack-allees')?.value);
    const ne  = parseInt(m?.querySelector('#admin-rack-etages')?.value);
    if (!nom) return;
    if (isNaN(na) || na < 0) return _notif('Allées : 0 (zone plate) ou nombre ≥ 1', 'alerte');
    if (na > 0 && (!ne || ne < 1)) return _notif('Étages : minimum 1', 'alerte');
    const neEffectif = na === 0 ? 0 : ne;
    try {
      await window.SB.inserer('racks', { nom, nb_allees: na, nb_etages: neEffectif, actif: true });
      const rows = await window.SB.lire('racks', { order: 'created_at' });
      _racks = rows.filter(r => r.actif);
      _lieux = _majLieux();
      _rendreRacks();
      if (m) { m.querySelector('#admin-rack-nom').value = ''; m.querySelector('#admin-rack-allees').value = ''; m.querySelector('#admin-rack-etages').value = ''; m.querySelector('#admin-rack-apercu').textContent = ''; }
      _notif(na > 0 ? `${nom} ajouté (${na * ne} emplacements)` : `${nom} ajouté (zone plate)`, 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  async function _adminSupprimerRack(id, nom) {
    try {
      await window.SB.supprimer('racks', id);
      const rows = await window.SB.lire('racks', { order: 'created_at' });
      _racks = rows.filter(r => r.actif);
      _lieux = _majLieux();
      _rendreRacks();
      _notif(`"${nom}" supprimé`, 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  function _attacherAdminStockage() {
    const m = document.getElementById('admin-panel-stockage');
    if (!m) return;
    m.addEventListener('click', e => {
      const del = e.target.closest('.admin-ref-del[data-rack-id]');
      if (del) { _adminSupprimerRack(del.dataset.rackId, del.dataset.nom); return; }

      const edit = e.target.closest('.admin-ref-edit[data-rack-id]');
      if (edit) {
        const id = edit.dataset.rackId;
        const editRow = m.querySelector(`[data-rack-edit="${id}"]`);
        const mainRow = m.querySelector(`[data-rack-row="${id}"]`);
        if (editRow && mainRow) {
          const open = editRow.style.display !== 'none';
          editRow.style.display = open ? 'none' : '';
          mainRow.style.opacity = open ? '' : '0.4';
        }
        return;
      }

      const save = e.target.closest('[data-rack-save]');
      if (save) { _adminModifierRack(save.dataset.rackSave); return; }

      const cancel = e.target.closest('[data-rack-cancel]');
      if (cancel) {
        const id = cancel.dataset.rackCancel;
        const editRow = m.querySelector(`[data-rack-edit="${id}"]`);
        const mainRow = m.querySelector(`[data-rack-row="${id}"]`);
        if (editRow) editRow.style.display = 'none';
        if (mainRow) mainRow.style.opacity = '';
        return;
      }
    });
    m.querySelector('#admin-rack-nom')?.addEventListener('input', _majAperçuRack);
    m.querySelector('#admin-rack-allees')?.addEventListener('input', _majAperçuRack);
    m.querySelector('#admin-rack-etages')?.addEventListener('input', _majAperçuRack);
    m.querySelector('#admin-btn-rack')?.addEventListener('click', _adminAjouterRack);
  }

  /* ──────────────────────────────────────────────────────────────
     ADMIN CHANTIERS
     ────────────────────────────────────────────────────────────── */

  function ouvrirAdminChantiers() {
    _activerSectionAdmin('chantiers');
  }

  function _rendreChantiers() {
    const zone = document.getElementById('admin-chantiers-liste');
    if (!zone) return;
    if (!_chantiers.length) { zone.innerHTML = '<div class="admin-ref-vide">Aucun chantier</div>'; return; }
    const tries = [..._chantiers].sort((a, b) =>
      (a.numero_affaire || '').localeCompare(b.numero_affaire || '', 'fr', { numeric: true })
    );
    zone.innerHTML = `
      <table class="admin-rack-table">
        <thead><tr>
          <th>N° Affaire</th><th>Ville</th><th>Nom du chantier</th><th></th>
        </tr></thead>
        <tbody>
          ${tries.map(c => `<tr data-ch-row="${_e(c.id)}">
            <td>${_e(c.numero_affaire || '—')}</td>
            <td>${_e(c.ville || '—')}</td>
            <td><strong>${_e(c.nom)}</strong></td>
            <td class="admin-ch-actions">
              <button class="admin-ref-edit" data-ch-id="${_e(c.id)}" title="Modifier">✎</button>
              <button class="admin-ref-del" data-ch-id="${_e(c.id)}" data-nom="${_e(c.nom)}" title="Supprimer">✕</button>
            </td>
          </tr>
          <tr class="admin-ch-edit-row" data-ch-edit="${_e(c.id)}" style="display:none">
            <td colspan="4">
              <div class="admin-ch-edit-form">
                <input class="admin-input-sm" data-ch-field="numero_affaire" placeholder="N° affaire" value="${_e(c.numero_affaire || '')}">
                <input class="admin-input-sm" data-ch-field="ville" placeholder="Ville" value="${_e(c.ville || '')}">
                <input class="admin-input-sm" data-ch-field="nom" placeholder="Nom du chantier" value="${_e(c.nom || '')}">
                <button class="btn-sm btn-valider" data-ch-save="${_e(c.id)}">Enregistrer</button>
                <button class="btn-sm btn-annuler" data-ch-cancel="${_e(c.id)}">Annuler</button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  async function _adminModifierChantier(id) {
    const editRow = document.querySelector(`[data-ch-edit="${id}"]`);
    if (!editRow) return;
    const nom     = editRow.querySelector('[data-ch-field="nom"]')?.value?.trim();
    const affaire = editRow.querySelector('[data-ch-field="numero_affaire"]')?.value?.trim();
    const ville   = editRow.querySelector('[data-ch-field="ville"]')?.value?.trim();
    if (!nom) { _notif('Le nom est requis', 'alerte'); return; }
    try {
      await window.SB.mettreAJour('chantiers', id, { nom, numero_affaire: affaire || null, ville: ville || null });
      const rows = await window.SB.lire('chantiers', { order: 'nom' });
      _chantiers = rows.filter(c => c.actif);
      _rendreChantiers();
      _majDatalistChantiers();
      _notif('Chantier modifié', 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  async function _adminAjouterChantier() {
    const m       = document.getElementById('admin-panel-chantiers');
    const nom     = m?.querySelector('#admin-ch-nom')?.value?.trim();
    const affaire = m?.querySelector('#admin-ch-affaire')?.value?.trim();
    const ville   = m?.querySelector('#admin-ch-ville')?.value?.trim();
    if (!nom) return;
    try {
      await window.SB.inserer('chantiers', { nom, numero_affaire: affaire || null, ville: ville || null, actif: true });
      const rows = await window.SB.lire('chantiers', { order: 'nom' });
      _chantiers = rows.filter(c => c.actif);
      _rendreChantiers();
      _majDatalistChantiers();
      if (m) {
        m.querySelector('#admin-ch-nom').value     = '';
        m.querySelector('#admin-ch-affaire').value = '';
        m.querySelector('#admin-ch-ville').value   = '';
      }
      _notif('Chantier ajouté', 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  async function _adminSupprimerChantier(id, nom) {
    try {
      await window.SB.supprimer('chantiers', id);
      const rows = await window.SB.lire('chantiers', { order: 'nom' });
      _chantiers = rows.filter(c => c.actif);
      _rendreChantiers();
      _majDatalistChantiers();
      _notif(`"${nom}" supprimé`, 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  function _attacherAdminChantiers() {
    const m = document.getElementById('admin-panel-chantiers');
    if (!m) return;
    m.addEventListener('click', e => {
      const del = e.target.closest('.admin-ref-del[data-ch-id]');
      if (del) { _adminSupprimerChantier(del.dataset.chId, del.dataset.nom); return; }

      const edit = e.target.closest('.admin-ref-edit[data-ch-id]');
      if (edit) {
        const id = edit.dataset.chId;
        const editRow = m.querySelector(`[data-ch-edit="${id}"]`);
        const mainRow = m.querySelector(`[data-ch-row="${id}"]`);
        if (editRow && mainRow) {
          const open = editRow.style.display !== 'none';
          editRow.style.display = open ? 'none' : '';
          mainRow.style.opacity = open ? '' : '0.4';
        }
        return;
      }

      const save = e.target.closest('[data-ch-save]');
      if (save) { _adminModifierChantier(save.dataset.chSave); return; }

      const cancel = e.target.closest('[data-ch-cancel]');
      if (cancel) {
        const id = cancel.dataset.chCancel;
        const editRow = m.querySelector(`[data-ch-edit="${id}"]`);
        const mainRow = m.querySelector(`[data-ch-row="${id}"]`);
        if (editRow) editRow.style.display = 'none';
        if (mainRow) mainRow.style.opacity = '';
        return;
      }
    });
    m.querySelector('#admin-btn-chantier')?.addEventListener('click', _adminAjouterChantier);
    ['#admin-ch-affaire','#admin-ch-ville','#admin-ch-nom'].forEach(sel => {
      m.querySelector(sel)?.addEventListener('keydown', e => { if (e.key === 'Enter') _adminAjouterChantier(); });
    });
  }

  function _rendreFournisseurs() {
    const zone = document.getElementById('admin-fournisseurs-liste');
    if (!zone) return;
    if (!_fournisseurs.length) { zone.innerHTML = '<div class="admin-ref-vide">Aucun fournisseur</div>'; return; }
    const tries = [..._fournisseurs].sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' }));
    zone.innerHTML = `
      <table class="admin-rack-table">
        <thead><tr><th>Nom du fournisseur</th><th></th></tr></thead>
        <tbody>
          ${tries.map(f => `<tr data-fv-row="${_e(f.id)}">
            <td><strong>${_e(f.nom)}</strong></td>
            <td class="admin-ch-actions">
              <button class="admin-ref-edit" data-fv-id="${_e(f.id)}" title="Modifier">✎</button>
              <button class="admin-ref-del" data-fv-id="${_e(f.id)}" data-nom="${_e(f.nom)}" title="Supprimer">✕</button>
            </td>
          </tr>
          <tr class="admin-ch-edit-row" data-fv-edit="${_e(f.id)}" style="display:none">
            <td colspan="2">
              <div class="admin-ch-edit-form">
                <input class="admin-input-sm" data-fv-field="nom" placeholder="Nom du fournisseur" value="${_e(f.nom)}">
                <button class="btn-sm btn-valider" data-fv-save="${_e(f.id)}">Enregistrer</button>
                <button class="btn-sm btn-annuler" data-fv-cancel="${_e(f.id)}">Annuler</button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  async function _adminModifierFournisseur(id) {
    const editRow = document.querySelector(`[data-fv-edit="${id}"]`);
    if (!editRow) return;
    const nom = editRow.querySelector('[data-fv-field="nom"]')?.value?.trim();
    if (!nom) { _notif('Le nom est requis', 'alerte'); return; }
    try {
      await window.SB.mettreAJour('fournisseurs', id, { nom });
      const rows = await window.SB.lire('fournisseurs', { order: 'nom' });
      _fournisseurs = rows.filter(f => f.actif);
      _rendreFournisseurs();
      _notif('Fournisseur modifié', 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  async function _adminAjouterFournisseur() {
    const m   = document.getElementById('admin-panel-fournisseurs');
    const nom = m?.querySelector('#admin-fv-nom')?.value?.trim();
    if (!nom) return;
    try {
      await window.SB.inserer('fournisseurs', { nom, actif: true });
      const rows = await window.SB.lire('fournisseurs', { order: 'nom' });
      _fournisseurs = rows.filter(f => f.actif);
      _rendreFournisseurs();
      if (m) m.querySelector('#admin-fv-nom').value = '';
      _notif('Fournisseur ajouté', 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  async function _adminSupprimerFournisseur(id, nom) {
    try {
      await window.SB.supprimer('fournisseurs', id);
      const rows = await window.SB.lire('fournisseurs', { order: 'nom' });
      _fournisseurs = rows.filter(f => f.actif);
      _rendreFournisseurs();
      _notif(`"${nom}" supprimé`, 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  function _attacherAdminFournisseurs() {
    const m = document.getElementById('admin-panel-fournisseurs');
    if (!m) return;
    m.addEventListener('click', e => {
      const del = e.target.closest('.admin-ref-del[data-fv-id]');
      if (del) { _adminSupprimerFournisseur(del.dataset.fvId, del.dataset.nom); return; }

      const edit = e.target.closest('.admin-ref-edit[data-fv-id]');
      if (edit) {
        const id = edit.dataset.fvId;
        const editRow = m.querySelector(`[data-fv-edit="${id}"]`);
        const mainRow = m.querySelector(`[data-fv-row="${id}"]`);
        if (editRow && mainRow) {
          const open = editRow.style.display !== 'none';
          editRow.style.display = open ? 'none' : '';
          mainRow.style.opacity = open ? '' : '0.4';
        }
        return;
      }

      const save = e.target.closest('[data-fv-save]');
      if (save) { _adminModifierFournisseur(save.dataset.fvSave); return; }

      const cancel = e.target.closest('[data-fv-cancel]');
      if (cancel) {
        const id = cancel.dataset.fvCancel;
        const editRow = m.querySelector(`[data-fv-edit="${id}"]`);
        const mainRow = m.querySelector(`[data-fv-row="${id}"]`);
        if (editRow) editRow.style.display = 'none';
        if (mainRow) mainRow.style.opacity = '';
        return;
      }
    });
    m.querySelector('#admin-btn-fournisseur')?.addEventListener('click', _adminAjouterFournisseur);
    m.querySelector('#admin-fv-nom')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _adminAjouterFournisseur();
    });
  }

  function _pseudoDemandeur(d) {
    const init = d.prenom ? d.prenom.trim()[0].toUpperCase() + '.' : '';
    return init ? `${init} ${d.nom}` : d.nom;
  }

  function _rendreDemandeurs() {
    const zone = document.getElementById('admin-demandeurs-liste');
    if (!zone) return;
    if (!_demandeurs.length) { zone.innerHTML = '<div class="admin-ref-vide">Aucun demandeur enregistré</div>'; return; }
    const tries = [..._demandeurs].sort((a, b) =>
      (a.prenom || '').localeCompare(b.prenom || '', 'fr', { sensitivity: 'base' })
    );
    zone.innerHTML = `
      <table class="admin-rack-table">
        <thead><tr><th>Prénom</th><th>Nom</th><th>Pseudo</th><th>Email</th><th></th></tr></thead>
        <tbody>
          ${tries.map(d => `<tr data-dem-row="${_e(d.id)}">
            <td>${_e(d.prenom || '—')}</td>
            <td><strong>${_e(d.nom)}</strong></td>
            <td><span class="dem-pseudo">${_e(_pseudoDemandeur(d))}</span></td>
            <td>${d.email ? `<a href="mailto:${_e(d.email)}">${_e(d.email)}</a>` : '—'}</td>
            <td class="admin-ch-actions">
              <button class="admin-ref-edit" data-dem-id="${_e(d.id)}" title="Modifier">✎</button>
              <button class="admin-ref-del" data-dem-id="${_e(d.id)}" data-nom="${_e(d.nom)}" title="Supprimer">✕</button>
            </td>
          </tr>
          <tr class="admin-ch-edit-row" data-dem-edit="${_e(d.id)}" style="display:none">
            <td colspan="5">
              <div class="admin-ch-edit-form">
                <input class="admin-input-sm" data-dem-field="prenom" placeholder="Prénom" value="${_e(d.prenom || '')}">
                <input class="admin-input-sm" data-dem-field="nom" placeholder="Nom" value="${_e(d.nom || '')}">
                <input class="admin-input-sm" data-dem-field="email" type="email" placeholder="Email" value="${_e(d.email || '')}" style="flex:2">
                <button class="btn-sm btn-valider" data-dem-save="${_e(d.id)}">Enregistrer</button>
                <button class="btn-sm btn-annuler" data-dem-cancel="${_e(d.id)}">Annuler</button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  async function _adminModifierDemandeur(id) {
    const editRow = document.querySelector(`[data-dem-edit="${id}"]`);
    if (!editRow) return;
    const prenom = editRow.querySelector('[data-dem-field="prenom"]')?.value?.trim();
    const nom    = editRow.querySelector('[data-dem-field="nom"]')?.value?.trim();
    const email  = editRow.querySelector('[data-dem-field="email"]')?.value?.trim();
    if (!nom) { _notif('Le nom est requis', 'alerte'); return; }
    try {
      await window.SB.mettreAJour('demandeurs', id, { nom, prenom: prenom || null, email: email || null });
      const rows = await window.SB.lire('demandeurs', { order: 'nom' });
      _demandeurs = rows.filter(d => d.actif);
      _rendreDemandeurs();
      _notif('Demandeur modifié', 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  async function _adminAjouterDemandeur() {
    const m      = document.getElementById('admin-panel-demandeurs');
    const prenom = m?.querySelector('#admin-dem-prenom')?.value?.trim();
    const nom    = m?.querySelector('#admin-dem-nom')?.value?.trim();
    const email  = m?.querySelector('#admin-dem-email')?.value?.trim();
    if (!nom) return;
    try {
      await window.SB.inserer('demandeurs', { nom, prenom: prenom || null, email: email || null, actif: true });
      const rows = await window.SB.lire('demandeurs', { order: 'nom' });
      _demandeurs = rows.filter(d => d.actif);
      _rendreDemandeurs();
      if (m) { m.querySelector('#admin-dem-prenom').value = ''; m.querySelector('#admin-dem-nom').value = ''; m.querySelector('#admin-dem-email').value = ''; }
      _notif('Demandeur ajouté', 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  async function _adminSupprimerDemandeur(id, nom) {
    try {
      await window.SB.supprimer('demandeurs', id);
      const rows = await window.SB.lire('demandeurs', { order: 'nom' });
      _demandeurs = rows.filter(d => d.actif);
      _rendreDemandeurs();
      _notif(`"${nom}" supprimé`, 'succes');
    } catch(e) { _notif('Erreur : ' + e.message, 'alerte'); }
  }

  function _attacherAdminDemandeurs() {
    const m = document.getElementById('admin-panel-demandeurs');
    if (!m) return;
    m.addEventListener('click', e => {
      const del = e.target.closest('.admin-ref-del[data-dem-id]');
      if (del) { _adminSupprimerDemandeur(del.dataset.demId, del.dataset.nom); return; }

      const edit = e.target.closest('.admin-ref-edit[data-dem-id]');
      if (edit) {
        const id = edit.dataset.demId;
        const editRow = m.querySelector(`[data-dem-edit="${id}"]`);
        const mainRow = m.querySelector(`[data-dem-row="${id}"]`);
        if (editRow && mainRow) {
          const open = editRow.style.display !== 'none';
          editRow.style.display = open ? 'none' : '';
          mainRow.style.opacity = open ? '' : '0.4';
        }
        return;
      }

      const save = e.target.closest('[data-dem-save]');
      if (save) { _adminModifierDemandeur(save.dataset.demSave); return; }

      const cancel = e.target.closest('[data-dem-cancel]');
      if (cancel) {
        const id = cancel.dataset.demCancel;
        const editRow = m.querySelector(`[data-dem-edit="${id}"]`);
        const mainRow = m.querySelector(`[data-dem-row="${id}"]`);
        if (editRow) editRow.style.display = 'none';
        if (mainRow) mainRow.style.opacity = '';
        return;
      }
    });
    m.querySelector('#admin-btn-demandeur')?.addEventListener('click', _adminAjouterDemandeur);
    m.querySelector('#admin-dem-nom')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _adminAjouterDemandeur();
    });
  }

  /* ──────────────────────────────────────────────────────────────
     API PUBLIQUE
     ────────────────────────────────────────────────────────────── */
  return {
    init,
    ouvrirFicheSection,
    ouvrirModification,
    ouvrirDemande,
    ouvrirDetailTole,
    ouvrirSortieTole:  _ouvrirSortieTole,
    validerElement,
    refuserElement,
    getSelection,
    ouvrirHistoriqueBarre,
    ouvrirHistoriqueTole,
    ouvrirSuppressionDefinitive: _ouvrirConfirmationSuppressionDefinitive,
    ouvrirAdminStockage,
    ouvrirAdminChantiers,
    exporterCSV: _exporterCSV,
    ouvrirImport: _ouvrirImport,
  };

})();

// Démarrage automatique
document.addEventListener('DOMContentLoaded', () => Stock.init());
