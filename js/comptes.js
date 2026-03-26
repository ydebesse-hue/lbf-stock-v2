// =============================================================
// LBF Stock v2 — Module gestion des comptes (admin uniquement)
// Dépendances : config.js, supabase.js, utils.js, auth/auth.js
// =============================================================

// Guard : administration uniquement
const user = auth.requireAuth(['administration']);
auth.initNav();

// ── État ──────────────────────────────────────────────────────
let allUsers    = [];
let editingUser = null; // utilisateur en cours d'édition (null = création)

// ── Chargement ────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="6"><div class="loader"><div class="spinner"></div>Chargement…</div></td></tr>';

  // La clé service_role est requise pour lire la table users
  // En prod, utiliser un edge function ou la service_role key
  // Ici on appelle le RPC list_users (à créer en SQL) ou on utilise
  // la service_role key via une variable d'environnement côté serveur.
  // Pour l'instant, on utilise une requête directe (nécessite service_role
  // ou une policy SELECT pour administration — à configurer dans Supabase).
  const { data, error } = await db
    .from('users_public')  // vue sans password_hash
    .select('*')
    .order('created_at', false)
    .get();

  if (error) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Accès refusé ou erreur.</td></tr>';
    utils.flash('Impossible de charger les comptes. Vérifiez les permissions Supabase.', 'error');
    return;
  }

  allUsers = data || [];
  render();
}

// ── Rendu ─────────────────────────────────────────────────────
function render() {
  const tbody = document.getElementById('usersTableBody');

  if (allUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Aucun utilisateur.</td></tr>';
    return;
  }

  tbody.innerHTML = allUsers.map(u => userRowHtml(u)).join('');
}

function userRowHtml(u) {
  const actifBadge = u.actif
    ? '<span class="user-actif">Actif</span>'
    : '<span class="user-inactif">Inactif</span>';

  const isSelf = u.username === user.username;

  return `<tr>
    <td class="font-mono text-small">${utils.escHtml(u.username)}</td>
    <td class="font-medium">${utils.escHtml(u.prenom)} ${utils.escHtml(u.nom)}</td>
    <td><span class="role-badge role-${u.role}">${utils.labelRole(u.role)}</span></td>
    <td class="text-center">${actifBadge}</td>
    <td class="text-small text-muted">${utils.formatDate(u.created_at)}</td>
    <td class="text-right">
      <button class="btn btn-ghost btn-sm" onclick="openEditModal('${u.id}')">
        Modifier
      </button>
      ${!isSelf ? `
        <button class="btn btn-ghost btn-sm" onclick="toggleActif('${u.id}', ${u.actif})">
          ${u.actif ? 'Désactiver' : 'Activer'}
        </button>
      ` : ''}
    </td>
  </tr>`;
}

// ── Modal Créer ────────────────────────────────────────────────
function openAddModal() {
  editingUser = null;
  document.getElementById('userModalTitle').textContent = 'Nouveau compte';
  document.getElementById('userForm').reset();
  document.getElementById('uf-id').value = '';
  document.getElementById('uf-username').disabled   = false;
  document.getElementById('passwordLabel').innerHTML = 'Mot de passe <span class="required">*</span>';
  document.getElementById('passwordHint').textContent = 'Minimum 8 caractères.';
  document.getElementById('uf-password').required   = true;
  resetStrengthBars();
  document.getElementById('userModal').hidden = false;
}

// ── Modal Édition ──────────────────────────────────────────────
function openEditModal(id) {
  const u = allUsers.find(u => u.id === id);
  if (!u) return;
  editingUser = u;

  document.getElementById('userModalTitle').textContent = `Modifier — ${u.username}`;
  document.getElementById('uf-id').value       = u.id;
  document.getElementById('uf-prenom').value   = u.prenom;
  document.getElementById('uf-nom').value      = u.nom;
  document.getElementById('uf-username').value = u.username;
  document.getElementById('uf-username').disabled = true; // identifiant non modifiable
  document.getElementById('uf-role').value     = u.role;
  document.getElementById('uf-password').value = '';
  document.getElementById('uf-password').required = false;
  document.getElementById('passwordLabel').innerHTML = 'Nouveau mot de passe';
  document.getElementById('passwordHint').textContent = 'Laisser vide pour conserver le mot de passe actuel.';
  resetStrengthBars();
  document.getElementById('userModal').hidden = false;
}

function closeUserModal() {
  document.getElementById('userModal').hidden = true;
  editingUser = null;
}

// ── Sauvegarde ────────────────────────────────────────────────
async function saveUser() {
  const prenom   = document.getElementById('uf-prenom').value.trim();
  const nom      = document.getElementById('uf-nom').value.trim();
  const username = document.getElementById('uf-username').value.trim().toLowerCase();
  const role     = document.getElementById('uf-role').value;
  const password = document.getElementById('uf-password').value;

  if (!prenom || !nom || !username || !role) {
    utils.flash('Remplissez tous les champs obligatoires.', 'error');
    return;
  }

  if (!editingUser && !password) {
    utils.flash('Le mot de passe est requis pour un nouveau compte.', 'error');
    return;
  }

  if (password && password.length < 8) {
    utils.flash('Le mot de passe doit contenir au moins 8 caractères.', 'error');
    return;
  }

  const btn = document.getElementById('userModalSave');
  utils.btnLoading(btn, true);

  const payload = { prenom, nom, role };

  if (password) {
    payload.password_hash = await utils.hashPassword(password);
  }

  let error;

  if (editingUser) {
    ({ error } = await db.from('users').eq('id', editingUser.id).update(payload));
  } else {
    payload.username = username;
    ({ error } = await db.from('users').insert(payload));
  }

  utils.btnLoading(btn, false);

  if (error) {
    const msg = error.message?.includes('unique') || error.message?.includes('duplicate')
      ? 'Cet identifiant est déjà utilisé.'
      : `Erreur : ${error.message}`;
    utils.flash(msg, 'error');
    return;
  }

  closeUserModal();
  utils.flash(editingUser ? 'Compte mis à jour.' : 'Compte créé.', 'success');
  await loadUsers();
}

// ── Activer / Désactiver ──────────────────────────────────────
async function toggleActif(id, currentActif) {
  const u    = allUsers.find(u => u.id === id);
  const verb = currentActif ? 'désactiver' : 'réactiver';
  if (!confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} le compte « ${u?.username} » ?`)) return;

  const { error } = await db.from('users').eq('id', id).update({ actif: !currentActif });

  if (error) {
    utils.flash('Erreur lors de la modification.', 'error');
    return;
  }

  utils.flash(`Compte ${currentActif ? 'désactivé' : 'réactivé'}.`, 'success');
  await loadUsers();
}

// ── Indicateur force du mot de passe ─────────────────────────
function evalPasswordStrength(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8)                             score++;
  if (pwd.length >= 12)                            score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd))     score++;
  if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

function resetStrengthBars() {
  for (let i = 1; i <= 4; i++) {
    const bar = document.getElementById(`sb${i}`);
    bar.className = 'strength-bar';
  }
}

document.getElementById('uf-password').addEventListener('input', e => {
  const score = evalPasswordStrength(e.target.value);
  for (let i = 1; i <= 4; i++) {
    const bar = document.getElementById(`sb${i}`);
    bar.className = 'strength-bar' + (i <= score ? ` active-${score}` : '');
  }
});

// ── Modal confirmation ─────────────────────────────────────────
function openConfirm(title, message) {
  return new Promise(resolve => {
    document.getElementById('confirmTitle').textContent   = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').hidden        = false;

    const ok  = document.getElementById('confirmOk');
    const no  = document.getElementById('confirmCancel');
    const cls = document.getElementById('confirmClose');

    const handler = (result) => () => {
      document.getElementById('confirmModal').hidden = true;
      ok.removeEventListener('click', yes);
      no.removeEventListener('click', nope);
      cls.removeEventListener('click', nope);
      resolve(result);
    };

    const yes  = handler(true);
    const nope = handler(false);

    ok.addEventListener('click',  yes);
    no.addEventListener('click',  nope);
    cls.addEventListener('click', nope);
  });
}

// ── Event listeners ───────────────────────────────────────────
document.getElementById('addUserBtn').addEventListener('click',    openAddModal);
document.getElementById('userModalClose').addEventListener('click', closeUserModal);
document.getElementById('userModalCancel').addEventListener('click', closeUserModal);
document.getElementById('userModalSave').addEventListener('click',  saveUser);
document.getElementById('confirmCancel').addEventListener('click', () =>
  document.getElementById('confirmModal').hidden = true
);
document.getElementById('confirmClose').addEventListener('click', () =>
  document.getElementById('confirmModal').hidden = true
);

// Fermer en cliquant l'overlay
document.getElementById('userModal').addEventListener('click', e => {
  if (e.target === document.getElementById('userModal')) closeUserModal();
});

// ── Démarrage ─────────────────────────────────────────────────
loadUsers();
