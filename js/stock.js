// =============================================================
// LBF Stock v2 — Module inventaire
// Dépendances : config.js, supabase.js, utils.js, auth/auth.js
// =============================================================

// ── Initialisation ────────────────────────────────────────────
const user = auth.requireAuth(); // redirige si non connecté
auth.initNav();
auth.showAccessError();

// ── État global ───────────────────────────────────────────────
let allStock      = [];  // tous les items validés
let pendingStock  = [];  // items en attente (admins)
let currentFilter = { search: '', categorie: '', section: '', dispo: '' };
let editingId     = null; // id de l'item en cours d'édition
let demandeItemId = null; // id de l'item pour la demande

// ── Chargement ────────────────────────────────────────────────
async function loadStock() {
  const tbody = document.getElementById('stockTableBody');
  tbody.innerHTML = '<tr><td colspan="9"><div class="loader"><div class="spinner"></div>Chargement…</div></td></tr>';

  const { data, error } = await db
    .from('stock')
    .select('*')
    .eq('statut', 'valide')
    .order('created_at', false)
    .get();

  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">
      Erreur de chargement : ${utils.escHtml(error.message)}
    </td></tr>`;
    return;
  }

  allStock = data || [];
  renderStock();
  updateStats();
  populateSectionFilter();
}

async function loadPending() {
  if (!auth.isAdmin()) return;

  const { data } = await db
    .from('stock')
    .select('*')
    .eq('statut', 'en_attente')
    .order('created_at', false)
    .get();

  pendingStock = data || [];

  const section = document.getElementById('validationSection');
  const count   = document.getElementById('validationCount');
  const tbody   = document.getElementById('validationTableBody');

  if (pendingStock.length > 0) {
    section.style.display = 'block';
    count.textContent = pendingStock.length;
    renderPending();
  } else {
    section.style.display = 'none';
  }
}

// ── Rendu ─────────────────────────────────────────────────────
function renderStock() {
  const filtered = filterStock(allStock);
  const tbody    = document.getElementById('stockTableBody');
  const label    = document.getElementById('stockCountLabel');

  label.textContent = `(${filtered.length} résultat${filtered.length !== 1 ? 's' : ''})`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-title">Aucun élément trouvé</div>
        <p>Modifiez les filtres ou ajoutez des éléments à l'inventaire.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => rowHtml(item, false)).join('');
}

function renderPending() {
  const tbody = document.getElementById('validationTableBody');
  tbody.innerHTML = pendingStock.map(item => rowHtml(item, true)).join('');
}

function rowHtml(item, isPending) {
  const desig = item.categorie === 'profil'
    ? `<div class="item-designation">${utils.escHtml(item.section_type || '')} ${utils.escHtml(item.designation || '')}</div>
       <div class="item-sub">${utils.escHtml(item.lieu_stockage || '—')}</div>`
    : `<div class="item-designation">Tôle ${utils.escHtml(item.nuance || '')} ${utils.escHtml(item.designation || '')}</div>
       <div class="item-sub">${utils.escHtml(item.lieu_stockage || '—')}</div>`;

  const dispoBadge = `<span class="badge dispo-${item.disponibilite}">${utils.labelDisponibilite(item.disponibilite)}</span>`;

  let actions = '';
  if (isPending) {
    // File de validation
    actions = `
      <button class="btn btn-success btn-sm" onclick="validerItem('${item.id}')">✓ Valider</button>
      <button class="btn btn-danger  btn-sm" onclick="rejeterItem('${item.id}')">✕ Rejeter</button>
    `;
  } else {
    // Stock normal
    const canEdit = auth.isGestion();
    actions = `
      ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="openEditModal('${item.id}')" title="Modifier">✎</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="openDemandeModal('${item.id}')" title="Demander">↗</button>
    `;
  }

  const extraCol = isPending
    ? `<td class="text-small text-muted">${utils.escHtml(item.ajoute_par || '—')}</td>`
    : '';

  return `<tr>
    <td class="mono">${utils.escHtml(item.id)}</td>
    <td><span class="badge badge-neutral">${item.categorie === 'profil' ? 'Profilé' : 'Tôle'}</span></td>
    <td>${desig}</td>
    <td class="text-right">${item.longueur_m ? utils.formatLongueur(item.longueur_m) : '—'}</td>
    <td class="text-right">${utils.formatPoids(item.poids_barre_kg || item.poids_kg)}</td>
    <td class="text-small">${utils.escHtml(item.lieu_stockage || '—')}</td>
    <td class="text-small">${utils.escHtml(item.chantier_affectation || item.chantier_origine || '—')}</td>
    ${isPending ? '' : `<td>${dispoBadge}</td>`}
    ${extraCol}
    <td class="text-right">${actions}</td>
  </tr>`;
}

// ── Filtrage ──────────────────────────────────────────────────
function filterStock(items) {
  return items.filter(item => {
    if (currentFilter.categorie && item.categorie !== currentFilter.categorie) return false;
    if (currentFilter.section && item.section_type !== currentFilter.section) return false;
    if (currentFilter.dispo && item.disponibilite !== currentFilter.dispo) return false;
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      const haystack = [
        item.id, item.designation, item.section_type, item.section_designation,
        item.lieu_stockage, item.chantier_origine, item.chantier_affectation,
        item.nuance, item.commentaire
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats() {
  const total      = allStock.length;
  const disponible = allStock.filter(i => i.disponibilite === 'disponible').length;
  const reserve    = allStock.filter(i => i.disponibilite === 'reserve').length;
  const poidsTot   = allStock.reduce((s, i) => s + (parseFloat(i.poids_barre_kg) || parseFloat(i.poids_kg) || 0), 0);

  document.getElementById('statTotal').textContent     = total;
  document.getElementById('statDisponible').textContent = disponible;
  document.getElementById('statReserve').textContent   = reserve;
  document.getElementById('statPoids').textContent     = utils.formatPoids(poidsTot);
}

// ── Filtre section ─────────────────────────────────────────────
function populateSectionFilter() {
  const types = [...new Set(allStock.map(i => i.section_type).filter(Boolean))].sort();
  const sel   = document.getElementById('filterSection');
  const val   = sel.value;
  sel.innerHTML = '<option value="">Toutes</option>';
  types.forEach(t => {
    const o = utils.option(t, t, t === val);
    sel.appendChild(o);
  });
}

// ── Validation (admins) ───────────────────────────────────────
async function validerItem(id) {
  if (!confirm('Valider cet élément et le rendre visible dans le stock ?')) return;

  const { error } = await db
    .from('stock')
    .eq('id', id)
    .update({
      statut:          'valide',
      valide_par:      user.username,
      date_validation: new Date().toISOString(),
    });

  if (error) {
    utils.flash('Erreur lors de la validation.', 'error');
    return;
  }

  utils.flash('Élément validé.', 'success');
  await Promise.all([loadStock(), loadPending()]);
}

async function rejeterItem(id) {
  if (!confirm('Rejeter et supprimer cet élément ?')) return;

  const { error } = await db
    .from('stock')
    .eq('id', id)
    .update({ statut: 'rejete' });

  if (error) {
    utils.flash('Erreur lors du rejet.', 'error');
    return;
  }

  utils.flash('Élément rejeté.', 'warning');
  await loadPending();
}

// ── Modal Ajout/Édition ───────────────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Ajouter un élément';
  document.getElementById('profilForm').reset();
  document.getElementById('toleForm').reset();
  document.getElementById('formTabs').style.display = 'flex';
  switchTab('profil');
  document.getElementById('itemModal').hidden = false;
}

async function openEditModal(id) {
  const item = allStock.find(i => i.id === id);
  if (!item) return;
  editingId = id;

  document.getElementById('modalTitle').textContent = `Modifier — ${id}`;
  document.getElementById('formTabs').style.display = 'none';

  if (item.categorie === 'profil') {
    switchTab('profil');
    document.getElementById('pf-sectionType').value     = item.section_type || '';
    document.getElementById('pf-designation').value     = item.section_designation || item.designation || '';
    document.getElementById('pf-longueur').value        = item.longueur_m || '';
    document.getElementById('pf-poidsml').value         = item.poids_ml || '';
    document.getElementById('pf-poidsbarre').value      = item.poids_barre_kg || '';
    document.getElementById('pf-lieu').value            = item.lieu_stockage || '';
    document.getElementById('pf-chantierOrigine').value = item.chantier_origine || '';
    document.getElementById('pf-commentaire').value     = item.commentaire || '';
  } else {
    switchTab('tole');
    document.getElementById('tl-nuance').value          = item.nuance || '';
    document.getElementById('tl-epaisseur').value       = item.epaisseur_mm || '';
    document.getElementById('tl-largeur').value         = item.largeur_mm || '';
    document.getElementById('tl-longueur').value        = item.longueur_tole_mm || '';
    document.getElementById('tl-poids').value           = item.poids_kg || '';
    document.getElementById('tl-lieu').value            = item.lieu_stockage || '';
    document.getElementById('tl-chantierOrigine').value = item.chantier_origine || '';
    document.getElementById('tl-commentaire').value     = item.commentaire || '';
  }

  document.getElementById('itemModal').hidden = false;
}

function closeItemModal() {
  document.getElementById('itemModal').hidden = true;
  editingId = null;
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
}

// ── Sauvegarde ────────────────────────────────────────────────
async function saveItem() {
  const activeTab = document.querySelector('.tab-panel.active').id.replace('tab-', '');
  const btn = document.getElementById('modalSave');
  utils.btnLoading(btn, true);

  let payload, valid;

  if (activeTab === 'profil') {
    const sectionType = document.getElementById('pf-sectionType').value.trim();
    const designation = document.getElementById('pf-designation').value.trim();
    const longueur    = parseFloat(document.getElementById('pf-longueur').value);
    const poidsml     = parseFloat(document.getElementById('pf-poidsml').value) || null;

    valid = sectionType && designation && utils.isPositiveNumber(longueur);
    if (!valid) {
      utils.flash('Remplissez les champs obligatoires (type, désignation, longueur).', 'error');
      utils.btnLoading(btn, false);
      return;
    }

    const poidsBarre = poidsml ? Math.round(poidsml * longueur * 10) / 10 : null;

    payload = {
      categorie:         'profil',
      section_type:      sectionType,
      section_designation: designation,
      designation:       `${sectionType} ${designation}`,
      longueur_m:        longueur,
      poids_ml:          poidsml,
      poids_barre_kg:    poidsBarre,
      lieu_stockage:     document.getElementById('pf-lieu').value.trim() || null,
      chantier_origine:  document.getElementById('pf-chantierOrigine').value.trim() || null,
      commentaire:       document.getElementById('pf-commentaire').value.trim() || null,
    };
  } else {
    const nuance    = document.getElementById('tl-nuance').value;
    const epaisseur = parseFloat(document.getElementById('tl-epaisseur').value);
    const largeur   = parseFloat(document.getElementById('tl-largeur').value);
    const longueur  = parseFloat(document.getElementById('tl-longueur').value);

    valid = nuance && utils.isPositiveNumber(epaisseur) &&
            utils.isPositiveNumber(largeur) && utils.isPositiveNumber(longueur);
    if (!valid) {
      utils.flash('Remplissez les champs obligatoires (nuance, épaisseur, largeur, longueur).', 'error');
      utils.btnLoading(btn, false);
      return;
    }

    // Poids tôle acier : ρ ≈ 7.85 kg/dm³
    const poidsKg = Math.round(epaisseur * largeur * longueur * 7.85e-6 * 10) / 10;

    payload = {
      categorie:      'tole',
      nuance,
      epaisseur_mm:   epaisseur,
      largeur_mm:     largeur,
      longueur_tole_mm: longueur,
      poids_kg:       poidsKg,
      designation:    `Tôle ${nuance} ${epaisseur}mm`,
      lieu_stockage:  document.getElementById('tl-lieu').value.trim() || null,
      chantier_origine: document.getElementById('tl-chantierOrigine').value.trim() || null,
      commentaire:    document.getElementById('tl-commentaire').value.trim() || null,
    };
  }

  let error;

  if (editingId) {
    // Mise à jour
    ({ error } = await db.from('stock').eq('id', editingId).update(payload));
  } else {
    // Insertion — générer un ID unique
    const id = activeTab === 'profil' ? utils.genIdBarre() : utils.genIdTole();
    payload.id        = id;
    payload.ajoute_par = user.username;
    payload.date_ajout = new Date().toISOString().slice(0, 10);
    // statut sera forcé à 'en_attente' par le trigger PostgreSQL
    ({ error } = await db.from('stock').insert(payload));
  }

  utils.btnLoading(btn, false);

  if (error) {
    utils.flash(`Erreur : ${error.message}`, 'error');
    return;
  }

  closeItemModal();
  const msg = editingId
    ? 'Modifications enregistrées. En attente de validation si besoin.'
    : (auth.isAdmin() ? 'Élément ajouté. À valider dans la file ci-dessous.' : 'Demande d\'ajout envoyée. En attente de validation.');
  utils.flash(msg, 'success');

  await Promise.all([loadStock(), loadPending()]);
}

// ── Demande d'affectation ─────────────────────────────────────
function openDemandeModal(id) {
  const item = allStock.find(i => i.id === id);
  if (!item) return;
  demandeItemId = id;

  document.getElementById('demandeItemInfo').textContent =
    `Article : ${item.designation || item.id}`;
  document.getElementById('demandeForm').reset();
  document.getElementById('demandeModal').hidden = false;
}

function closeDemandeModal() {
  document.getElementById('demandeModal').hidden = true;
  demandeItemId = null;
}

async function saveDemande() {
  const chantier  = document.getElementById('dm-chantier').value.trim();
  const quantite  = parseFloat(document.getElementById('dm-quantite').value) || null;
  const comment   = document.getElementById('dm-commentaire').value.trim();

  if (!chantier) {
    utils.flash('Le chantier de destination est requis.', 'error');
    return;
  }

  const btn = document.getElementById('demandeModalSave');
  utils.btnLoading(btn, true);

  const { error } = await db.from('demandes').insert({
    stock_id:    demandeItemId,
    demandeur:   user.username,
    chantier,
    quantite_m:  quantite,
    commentaire: comment || null,
  });

  utils.btnLoading(btn, false);

  if (error) {
    utils.flash(`Erreur : ${error.message}`, 'error');
    return;
  }

  closeDemandeModal();
  utils.flash('Demande envoyée. En attente de traitement par un administrateur.', 'success');
}

// ── Export CSV ────────────────────────────────────────────────
function exportCSV() {
  const filtered = filterStock(allStock);
  const headers  = ['ID','Catégorie','Section','Désignation','Longueur(m)',
                    'Poids(kg)','Lieu','ChantierOrigine','Disponibilité','DateAjout'];
  const rows = filtered.map(i => [
    i.id, i.categorie,
    i.section_type || '',
    i.designation || '',
    i.longueur_m || '',
    i.poids_barre_kg || i.poids_kg || '',
    i.lieu_stockage || '',
    i.chantier_origine || '',
    i.disponibilite,
    i.date_ajout || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `lbf-stock-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Event listeners ───────────────────────────────────────────
document.getElementById('addBtn')?.addEventListener('click', openAddModal);
document.getElementById('exportBtn').addEventListener('click', exportCSV);

document.getElementById('searchInput').addEventListener('input',
  utils.debounce(e => {
    currentFilter.search = e.target.value.trim();
    renderStock();
  }, 250)
);

document.getElementById('filterCategorie').addEventListener('change', e => {
  currentFilter.categorie = e.target.value;
  renderStock();
});

document.getElementById('filterSection').addEventListener('change', e => {
  currentFilter.section = e.target.value;
  renderStock();
});

document.getElementById('filterDispo').addEventListener('change', e => {
  currentFilter.dispo = e.target.value;
  renderStock();
});

document.getElementById('resetFiltersBtn').addEventListener('click', () => {
  currentFilter = { search: '', categorie: '', section: '', dispo: '' };
  document.getElementById('searchInput').value    = '';
  document.getElementById('filterCategorie').value = '';
  document.getElementById('filterSection').value  = '';
  document.getElementById('filterDispo').value    = '';
  renderStock();
});

// Modal item
document.getElementById('modalClose').addEventListener('click',  closeItemModal);
document.getElementById('modalCancel').addEventListener('click', closeItemModal);
document.getElementById('modalSave').addEventListener('click',   saveItem);

// Onglets
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Calcul poids auto (profil)
document.getElementById('pf-longueur').addEventListener('input', calcPoidsProfilAuto);
document.getElementById('pf-poidsml').addEventListener('input',  calcPoidsProfilAuto);

function calcPoidsProfilAuto() {
  const l = parseFloat(document.getElementById('pf-longueur').value);
  const m = parseFloat(document.getElementById('pf-poidsml').value);
  if (l > 0 && m > 0) {
    document.getElementById('pf-poidsbarre').value = Math.round(l * m * 10) / 10;
  }
}

// Calcul poids auto (tôle)
['tl-epaisseur','tl-largeur','tl-longueur'].forEach(id => {
  document.getElementById(id).addEventListener('input', calcPoidsToleAuto);
});

function calcPoidsToleAuto() {
  const e = parseFloat(document.getElementById('tl-epaisseur').value);
  const w = parseFloat(document.getElementById('tl-largeur').value);
  const l = parseFloat(document.getElementById('tl-longueur').value);
  if (e > 0 && w > 0 && l > 0) {
    document.getElementById('tl-poids').value = Math.round(e * w * l * 7.85e-6 * 10) / 10;
  }
}

// Modal demande
document.getElementById('demandeModalClose').addEventListener('click',  closeDemandeModal);
document.getElementById('demandeModalCancel').addEventListener('click', closeDemandeModal);
document.getElementById('demandeModalSave').addEventListener('click',   saveDemande);

// Fermer modals en cliquant l'overlay
[document.getElementById('itemModal'), document.getElementById('demandeModal')].forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.hidden = true;
  });
});

// ── Démarrage ─────────────────────────────────────────────────
Promise.all([loadStock(), loadPending()]);
