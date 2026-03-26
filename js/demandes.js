// =============================================================
// LBF Stock v2 — Module des demandes d'affectation
// Dépendances : config.js, supabase.js, utils.js, auth/auth.js
// =============================================================

const user = auth.requireAuth();
auth.initNav();

// ── État ──────────────────────────────────────────────────────
let allDemandes    = [];
let currentStatut  = '';
let currentSearch  = '';
let currentDemande = null; // demande affichée dans le modal

// ── Chargement ────────────────────────────────────────────────
async function loadDemandes() {
  const tbody = document.getElementById('demandesTableBody');
  tbody.innerHTML = '<tr><td colspan="7"><div class="loader"><div class="spinner"></div>Chargement…</div></td></tr>';

  // Joindre les infos du stock pour l'affichage
  const { data, error } = await db
    .from('demandes')
    .select('*, stock(id, categorie, designation, section_type, longueur_m, poids_barre_kg, poids_kg)')
    .order('date_demande', false)
    .get();

  if (error) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Erreur de chargement.</td></tr>';
    return;
  }

  allDemandes = data || [];
  updateCounts();
  render();
}

// ── Compteurs de tabs ─────────────────────────────────────────
function updateCounts() {
  const statuts = ['en_attente', 'approuvee', 'refusee', 'annulee'];
  document.getElementById('cnt-all').textContent = allDemandes.length;
  statuts.forEach(s => {
    const cnt = allDemandes.filter(d => d.statut === s).length;
    const el  = document.getElementById(`cnt-${s}`);
    if (el) el.textContent = cnt;
  });
}

// ── Filtrage ──────────────────────────────────────────────────
function filtered() {
  return allDemandes.filter(d => {
    if (currentStatut && d.statut !== currentStatut) return false;
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const h = [
        d.demandeur, d.chantier,
        d.stock?.id, d.stock?.designation,
        d.commentaire
      ].join(' ').toLowerCase();
      if (!h.includes(q)) return false;
    }
    return true;
  });
}

// ── Rendu ─────────────────────────────────────────────────────
function render() {
  const items = filtered();
  const tbody = document.getElementById('demandesTableBody');

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Aucune demande</div>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(d => demandeRowHtml(d)).join('');
}

function demandeRowHtml(d) {
  const stockInfo = d.stock
    ? `${utils.escHtml(d.stock.designation || d.stock.id)}`
    : `<span class="text-muted">${utils.escHtml(d.stock_id)}</span>`;

  const canTrait = auth.isAdmin() && d.statut === 'en_attente';
  const canAnnul = d.demandeur === user.username && d.statut === 'en_attente';

  const actions = `
    <button class="btn btn-ghost btn-sm" onclick="openModal('${d.id}')">Détail</button>
    ${canTrait ? `
      <button class="btn btn-success btn-sm" onclick="approuver('${d.id}')">✓</button>
      <button class="btn btn-danger  btn-sm" onclick="openRefusModal('${d.id}')">✕</button>
    ` : ''}
  `;

  return `<tr>
    <td class="text-small">${utils.formatDate(d.date_demande)}</td>
    <td class="font-medium">${utils.escHtml(d.demandeur)}</td>
    <td>${stockInfo}</td>
    <td>${utils.escHtml(d.chantier)}</td>
    <td class="text-right">${d.quantite_m ? utils.formatLongueur(d.quantite_m) : '—'}</td>
    <td><span class="badge statut-${d.statut}">${utils.labelStatutDemande(d.statut)}</span></td>
    <td class="text-right">${actions}</td>
  </tr>`;
}

// ── Modal détail ──────────────────────────────────────────────
function openModal(id) {
  currentDemande = allDemandes.find(d => d.id === id);
  if (!currentDemande) return;
  const d = currentDemande;

  const detailHtml = [
    ['Demandeur',  d.demandeur],
    ['Date',       utils.formatDateHeure(d.date_demande)],
    ['Article',    d.stock?.designation || d.stock_id],
    ['Chantier',   d.chantier],
    ['Quantité',   d.quantite_m ? utils.formatLongueur(d.quantite_m) : 'Barre entière'],
    ['Commentaire', d.commentaire || '—'],
    ['Statut',     utils.labelStatutDemande(d.statut)],
    ['Traité par', d.traite_par || '—'],
    ['Date traitement', d.date_traitement ? utils.formatDateHeure(d.date_traitement) : '—'],
    ['Motif',      d.motif_refus || '—'],
  ].map(([label, val]) => `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${utils.escHtml(String(val))}</span>
    </div>
  `).join('');

  document.getElementById('demandeDetail').innerHTML = detailHtml;

  // Zone de traitement (admins + en attente)
  const traitZone = document.getElementById('traitementZone');
  traitZone.style.display = (auth.isAdmin() && d.statut === 'en_attente') ? 'block' : 'none';
  document.getElementById('motifRefus').value = '';

  // Bouton annuler (propre demande en attente)
  const btnAnnul = document.getElementById('btnAnnulerDemande');
  btnAnnul.style.display =
    (d.demandeur === user.username && d.statut === 'en_attente') ? 'inline-flex' : 'none';

  document.getElementById('demandeModal').hidden = false;
}

function closeModal() {
  document.getElementById('demandeModal').hidden = true;
  currentDemande = null;
}

// ── Actions ───────────────────────────────────────────────────
async function approuver(id) {
  const { error } = await db.from('demandes').eq('id', id).update({
    statut:          'approuvee',
    traite_par:      user.username,
    date_traitement: new Date().toISOString(),
  });

  if (error) { utils.flash('Erreur lors de l\'approbation.', 'error'); return; }

  utils.flash('Demande approuvée.', 'success');
  closeModal();
  await loadDemandes();
}

function openRefusModal(id) {
  currentDemande = allDemandes.find(d => d.id === id);
  if (!currentDemande) return;

  // Ouvrir le modal détail avec zone de traitement visible
  openModal(id);
}

async function refuser() {
  if (!currentDemande) return;
  const motif = document.getElementById('motifRefus').value.trim();
  if (!motif) {
    utils.flash('Un motif est requis pour refuser une demande.', 'error');
    return;
  }

  const btn = document.getElementById('btnRefuser');
  utils.btnLoading(btn, true);

  const { error } = await db.from('demandes').eq('id', currentDemande.id).update({
    statut:          'refusee',
    traite_par:      user.username,
    date_traitement: new Date().toISOString(),
    motif_refus:     motif,
  });

  utils.btnLoading(btn, false);

  if (error) { utils.flash('Erreur lors du refus.', 'error'); return; }

  utils.flash('Demande refusée.', 'warning');
  closeModal();
  await loadDemandes();
}

async function annulerDemande() {
  if (!currentDemande) return;
  if (!confirm('Annuler cette demande ?')) return;

  const { error } = await db.from('demandes').eq('id', currentDemande.id).update({
    statut: 'annulee',
  });

  if (error) { utils.flash('Erreur lors de l\'annulation.', 'error'); return; }

  utils.flash('Demande annulée.', 'warning');
  closeModal();
  await loadDemandes();
}

// ── Event listeners ───────────────────────────────────────────
// Onglets statut
document.getElementById('statutTabs').addEventListener('click', e => {
  const tab = e.target.closest('.statut-tab');
  if (!tab) return;
  currentStatut = tab.dataset.statut;
  document.querySelectorAll('.statut-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.statut === currentStatut)
  );
  render();
});

document.getElementById('searchInput').addEventListener('input',
  utils.debounce(e => {
    currentSearch = e.target.value.trim();
    render();
  }, 200)
);

// Modal
document.getElementById('modalClose').addEventListener('click',    closeModal);
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('demandeModal').addEventListener('click', e => {
  if (e.target === document.getElementById('demandeModal')) closeModal();
});

document.getElementById('btnApprouver').addEventListener('click', () =>
  currentDemande && approuver(currentDemande.id)
);
document.getElementById('btnRefuser').addEventListener('click', refuser);
document.getElementById('btnAnnulerDemande').addEventListener('click', annulerDemande);

// ── Démarrage ─────────────────────────────────────────────────
loadDemandes();
