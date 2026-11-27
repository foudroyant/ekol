// ─── UTILISATEURS ─────────────────────────────────────────────────────────────
// Réservé aux administrateurs. Un admin gère les comptes de son établissement ;
// un super administrateur gère tous les comptes et tous les établissements.

function renderUtilisateurs() {
  if (!canManage()) {
    document.getElementById('app').innerHTML =
      '<h1 class="page-title">Utilisateurs</h1>' +
      '<div class="card p-8 text-center text-gray-500">Accès réservé aux administrateurs.</div>';
    return;
  }

  var users = dbGetAllUsers();
  if (!isSuperAdmin()) {
    users = users.filter(function(u) { return u.role !== 'super_admin'; });
  }

  var rows = users.map(function(u) {
    var isSelf = currentUser && u.id === currentUser.id;
    var canEdit = isSuperAdmin() || u.role !== 'super_admin';
    return '<tr>' +
      '<td class="font-medium">' + escapeHtml(u.nom) + (isSelf ? ' <span class="text-xs text-gray-400">(vous)</span>' : '') + '</td>' +
      '<td class="font-mono text-xs">' + escapeHtml(u.username) + '</td>' +
      '<td><span class="chip ' + (u.role === 'super_admin' ? 'chip-purple' : (u.role === 'admin' ? 'chip-indigo' : 'chip-neutral')) + '">' + roleLabel(u.role) + '</span></td>' +
      '<td class="text-xs text-gray-500">' + escapeHtml(u.organization_nom || '—') + '</td>' +
      '<td>' + (u.actif ? '<span class="badge-solde">Actif</span>' : '<span class="badge-retard">Désactivé</span>') + '</td>' +
      '<td class="text-xs text-gray-500">' + (u.last_login ? String(u.last_login).slice(0, 16) : '—') + '</td>' +
      '<td class="text-right">' +
        (canEdit
          ? '<div class="flex gap-2 justify-end flex-wrap">' +
              '<button class="btn btn-sm btn-secondary" onclick="openUserModal(' + u.id + ')">Modifier</button>' +
              '<button class="btn btn-sm btn-secondary" onclick="openResetPasswordModal(' + u.id + ')">Mot de passe</button>' +
              (!isSelf
                ? (u.actif
                    ? '<button class="btn btn-sm btn-danger" onclick="toggleUserActive(' + u.id + ', 0)">Désactiver</button>'
                    : '<button class="btn btn-sm btn-secondary" onclick="toggleUserActive(' + u.id + ', 1)">Réactiver</button>')
                : '') +
            '</div>'
          : '<span class="text-xs text-gray-400">—</span>') +
      '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div>' +
        '<h1 class="page-title mb-1">Utilisateurs</h1>' +
        '<p class="text-sm text-gray-500">Comptes locaux, rôles et accès.</p>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="openUserModal(0)">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' +
        'Nouvel utilisateur' +
      '</button>' +
    '</div>' +
    '<div class="card">' +
      '<table>' +
        '<thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Établissement</th><th>Statut</th><th>Dernière connexion</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="7" class="empty-state">Aucun utilisateur.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';
}

function _findUser(id) {
  var users = dbGetAllUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === Number(id)) return users[i];
  }
  return null;
}

function openUserModal(id) {
  var user = id ? _findUser(id) : null;
  if (user && user.role === 'super_admin' && !isSuperAdmin()) {
    showToast('Seul un super administrateur peut modifier ce compte.', 'error');
    return;
  }

  var orgs = dbGetAllOrganizations();
  var orgOptions = orgs.map(function(o) {
    var sel = user ? user.organization_id === o.id : o.id === currentOrgId;
    return '<option value="' + o.id + '"' + (sel ? ' selected' : '') + '>' + escapeHtml(o.nom) + '</option>';
  }).join('');

  var roleOptions = '';
  if (isSuperAdmin()) {
    roleOptions += '<option value="super_admin"' + (user && user.role === 'super_admin' ? ' selected' : '') + '>Super administrateur</option>';
  }
  roleOptions += '<option value="admin"' + (user && user.role === 'admin' ? ' selected' : '') + '>Administrateur</option>';
  roleOptions += '<option value="enseignant"' + (user && user.role === 'enseignant' ? ' selected' : '') + '>Enseignant</option>';

  var isSelf = user && currentUser && user.id === currentUser.id;

  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-5">' + (user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur') + '</h2>' +
    '<form id="user-form" class="space-y-4">' +
      '<input type="hidden" name="id" value="' + (user ? user.id : '') + '">' +
      '<div>' +
        '<label class="form-label">Nom complet *</label>' +
        '<input type="text" name="nom" value="' + (user ? escapeHtml(user.nom) : '') + '" required class="form-input">' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-4">' +
        '<div>' +
          '<label class="form-label">Identifiant *</label>' +
          '<input type="text" name="username" value="' + (user ? escapeHtml(user.username) : '') + '" required class="form-input" ' + (user ? 'readonly' : '') + '>' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Rôle *</label>' +
          '<select name="role" class="form-input">' + roleOptions + '</select>' +
        '</div>' +
      '</div>' +
      (isSuperAdmin()
        ? '<div>' +
            '<label class="form-label">Établissement</label>' +
            '<select name="organization_id" class="form-input">' + orgOptions + '</select>' +
          '</div>'
        : '') +
      '<div class="grid grid-cols-2 gap-4">' +
        '<div>' +
          '<label class="form-label">' + (user ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *') + '</label>' +
          '<input type="password" name="password" ' + (user ? '' : 'required') + ' minlength="6" class="form-input" autocomplete="new-password">' +
        '</div>' +
        '<div class="flex items-end pb-1">' +
          '<label class="check-row w-full">' +
            '<input type="checkbox" name="actif" ' + (!user || user.actif ? ' checked' : '') + (isSelf ? ' disabled' : '') + '>' +
            '<span>Compte actif</span>' +
          '</label>' +
        '</div>' +
      '</div>' +
      '<div class="flex justify-end gap-3 pt-2">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">' + (user ? 'Enregistrer' : 'Créer') + '</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('user-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var nom = (fd.get('nom') || '').trim();
    var username = (fd.get('username') || '').trim();
    var password = fd.get('password') || '';
    var role = fd.get('role') || 'enseignant';
    var actif = isSelf ? 1 : (fd.get('actif') ? 1 : 0);
    var organizationId = fd.get('organization_id') ? Number(fd.get('organization_id')) : currentOrgId;

    if (!nom) { showToast('Le nom est obligatoire', 'error'); return; }
    if (!user && !username) { showToast('L\'identifiant est obligatoire', 'error'); return; }
    if (password && password.length < 6) { showToast('Le mot de passe doit contenir au moins 6 caractères', 'error'); return; }

    try {
      if (user) {
        await dbUpdateUser(user.id, {
          nom: nom,
          role: role,
          actif: actif,
          organization_id: organizationId,
          password: password || null
        });
      } else {
        await dbCreateUser({
          organization_id: organizationId,
          nom: nom,
          username: username,
          password: password,
          role: role,
          actif: actif
        });
      }
      hideModal();
      showToast('Utilisateur enregistré', 'success');
      renderUtilisateurs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function openResetPasswordModal(id) {
  var user = _findUser(id);
  if (!user) return;
  if (user.role === 'super_admin' && !isSuperAdmin()) {
    showToast('Seul un super administrateur peut modifier ce compte.', 'error');
    return;
  }
  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-1">Réinitialiser le mot de passe</h2>' +
    '<p class="text-sm text-gray-500 mb-4">' + escapeHtml(user.nom) + ' · ' + escapeHtml(user.username) + '</p>' +
    '<form id="reset-password-form" class="space-y-4">' +
      '<div>' +
        '<label class="form-label">Nouveau mot de passe *</label>' +
        '<input type="password" name="password" required minlength="6" class="form-input" autocomplete="new-password">' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Confirmer *</label>' +
        '<input type="password" name="password2" required minlength="6" class="form-input" autocomplete="new-password">' +
      '</div>' +
      '<div class="flex justify-end gap-3 pt-2">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">Réinitialiser</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('reset-password-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var p1 = fd.get('password') || '';
    var p2 = fd.get('password2') || '';
    if (p1.length < 6) { showToast('6 caractères minimum', 'error'); return; }
    if (p1 !== p2) { showToast('Les mots de passe ne correspondent pas', 'error'); return; }
    try {
      await dbSetUserPassword(user.id, p1);
      hideModal();
      showToast('Mot de passe réinitialisé', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function toggleUserActive(id, actif) {
  if (currentUser && currentUser.id === Number(id)) {
    showToast('Vous ne pouvez pas désactiver votre propre compte.', 'error');
    return;
  }
  var target = _findUser(id);
  if (target && target.role === 'super_admin' && !isSuperAdmin()) {
    showToast('Seul un super administrateur peut modifier ce compte.', 'error');
    return;
  }
  var ok = await showConfirm(actif ? 'Réactiver ce compte ?' : 'Désactiver ce compte ?');
  if (!ok) return;
  try {
    if (actif) await dbActivateUser(id); else await dbDeactivateUser(id);
    showToast(actif ? 'Compte réactivé' : 'Compte désactivé', 'success');
    renderUtilisateurs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
