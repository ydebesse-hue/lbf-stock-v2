// =============================================================
// LBF Stock v2 — Module bibliothèque des sections
// Dépendances : config.js, supabase.js, utils.js, auth/auth.js
// =============================================================

auth.requireAuth();
auth.initNav();

// ── État ──────────────────────────────────────────────────────
let allSections = [];
let currentFamille = '';
let currentSearch  = '';
let viewMode       = 'grid'; // 'grid' | 'table'

// ── Chargement ────────────────────────────────────────────────
async function loadSections() {
  const { data, error } = await db
    .from('sections')
    .select('*')
    .order('famille', true)
    .get();

  if (error) {
    utils.flash('Erreur de chargement des sections.', 'error');
    return;
  }

  allSections = data || [];
  document.getElementById('sectionsCountLabel').textContent =
    `(${allSections.length} sections)`;

  buildFamilleNav();
  render();
}

// ── Navigation par famille ─────────────────────────────────────
function buildFamilleNav() {
  const familles = [...new Set(allSections.map(s => s.famille))].sort();
  const nav      = document.getElementById('familleNav');

  // Garder le bouton "Toutes"
  nav.innerHTML = '<button class="famille-btn active" data-famille="">Toutes</button>';

  familles.forEach(f => {
    const btn = document.createElement('button');
    btn.className      = 'famille-btn';
    btn.dataset.famille = f;
    btn.textContent    = f;
    nav.appendChild(btn);
  });

  nav.addEventListener('click', e => {
    const btn = e.target.closest('.famille-btn');
    if (!btn) return;
    currentFamille = btn.dataset.famille;
    nav.querySelectorAll('.famille-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.famille === currentFamille)
    );
    render();
  });
}

// ── Filtrage ──────────────────────────────────────────────────
function filteredSections() {
  return allSections.filter(s => {
    if (currentFamille && s.famille !== currentFamille) return false;
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const h = `${s.famille} ${s.designation}`.toLowerCase();
      if (!h.includes(q)) return false;
    }
    return true;
  });
}

// ── Rendu ─────────────────────────────────────────────────────
function render() {
  const items = filteredSections();

  if (viewMode === 'grid') {
    renderGrid(items);
  } else {
    renderTable(items);
  }
}

function renderGrid(items) {
  const grid = document.getElementById('sectionsGrid');

  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1">
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">Aucune section trouvée</div>
      </div>
    </div>`;
    return;
  }

  grid.innerHTML = items.map(s => sectionCardHtml(s)).join('');
}

function sectionCardHtml(s) {
  const dims = [];
  if (s.hauteur_mm)             dims.push(['h', `${s.hauteur_mm} mm`]);
  if (s.largeur_mm)             dims.push(['b', `${s.largeur_mm} mm`]);
  if (s.epaisseur_ame_mm)       dims.push(['t<sub>w</sub>', `${s.epaisseur_ame_mm} mm`]);
  if (s.epaisseur_semelle_mm)   dims.push(['t<sub>f</sub>', `${s.epaisseur_semelle_mm} mm`]);
  if (s.rayon_mm)               dims.push(['r', `${s.rayon_mm} mm`]);

  const dimsHtml = dims.map(([label, val]) => `
    <div class="section-dim-row">
      <span class="section-dim-label">${label}</span>
      <span class="section-dim-value">${val}</span>
    </div>
  `).join('');

  return `
    <div class="section-card">
      <div class="section-card-header">
        <div>
          <div class="section-name">${utils.escHtml(s.famille)} ${utils.escHtml(s.designation)}</div>
          <div class="section-famille">${utils.escHtml(s.famille)}</div>
        </div>
        <div class="section-poids">
          ${s.poids_ml.toFixed(1)}
          <span class="section-poids-unit">kg/m</span>
        </div>
      </div>
      ${dims.length > 0 ? `<div class="section-dims">${dimsHtml}</div>` : ''}
    </div>
  `;
}

function renderTable(items) {
  const tbody = document.getElementById('sectionsTableBody');

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Aucune section.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(s => `
    <tr>
      <td><span class="badge badge-neutral">${utils.escHtml(s.famille)}</span></td>
      <td class="font-medium">${utils.escHtml(s.designation)}</td>
      <td class="text-right mono">${s.hauteur_mm ?? '—'}</td>
      <td class="text-right mono">${s.largeur_mm ?? '—'}</td>
      <td class="text-right mono">${s.epaisseur_ame_mm ?? '—'}</td>
      <td class="text-right mono">${s.epaisseur_semelle_mm ?? '—'}</td>
      <td class="text-right font-semibold">${s.poids_ml.toFixed(3)}</td>
    </tr>
  `).join('');
}

// ── Event listeners ───────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input',
  utils.debounce(e => {
    currentSearch = e.target.value.trim();
    render();
  }, 200)
);

document.getElementById('viewGrid').addEventListener('click', () => {
  viewMode = 'grid';
  document.getElementById('viewGrid').classList.add('active');
  document.getElementById('viewTable').classList.remove('active');
  document.getElementById('viewGridContent').style.display  = 'block';
  document.getElementById('viewTableContent').style.display = 'none';
  render();
});

document.getElementById('viewTable').addEventListener('click', () => {
  viewMode = 'table';
  document.getElementById('viewTable').classList.add('active');
  document.getElementById('viewGrid').classList.remove('active');
  document.getElementById('viewGridContent').style.display  = 'none';
  document.getElementById('viewTableContent').style.display = 'block';
  render();
});

// ── Démarrage ─────────────────────────────────────────────────
loadSections();
