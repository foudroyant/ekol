// ─── ÉTABLISSEMENTS (ORGANISATIONS) ───────────────────────────────────────────
// Réservé au super administrateur. Chaque établissement possède ses propres
// cycles, classes, élèves, matières, styles, périodes et notes.

function renderOrganisations() {
  if (!isSuperAdmin()) {
    document.getElementById('app').innerHTML =
      '<h1 class="page-title">Établissements</h1>' +
      '<div class="card p-8 text-center text-gray-500">Accès réservé au super administrateur.</div>';
    return;
  }

  var orgs = dbGetAllOrganizations();
  var rows = orgs.map(function(o) {
    var isCurrent = o.id === currentOrgId;
    return '<tr>' +
      '<td>' +
        '<div class="font-medium">' + escapeHtml(o.nom) +
          (isCurrent ? ' <span class="chip chip-green ml-1">Actif</span>' : '') +
        '</div>' +
        '<div class="text-xs text-gray-400">' + escapeHtml(o.email || '') + '</div>' +
      '</td>' +
      '<td class="text-xs text-gray-500">' + escapeHtml(o.adresse || '—') + '</td>' +
      '<td>' + o.nb_users + '</td>' +
      '<td>' + o.nb_classes + '</td>' +
      '<td>' + o.nb_eleves + '</td>' +
      '<td class="text-right">' +
        '<div class="flex gap-2 justify-end flex-wrap">' +
          (!isCurrent ? '<button class="btn btn-sm btn-secondary" onclick="switchOrg(' + o.id + ')">Activer</button>' : '') +
          '<button class="btn btn-sm btn-secondary" onclick="openOrgModal(' + o.id + ')">Modifier</button>' +
          (!isCurrent ? '<button class="btn btn-sm btn-danger" onclick="confirmDeleteOrg(' + o.id + ')">Supprimer</button>' : '') +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div>' +
        '<h1 class="page-title mb-1">Établissements</h1>' +
        '<p class="text-sm text-gray-500">Chaque établissement est cloisonné : données, styles, périodes et utilisateurs séparés.</p>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="openOrgModal(0)">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' +
        'Nouvel établissement' +
      '</button>' +
    '</div>' +
    '<div class="card">' +
      '<table>' +
        '<thead><tr><th>Établissement</th><th>Adresse</th><th>Utilisateurs</th><th>Classes</th><th>Élèves</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" class="empty-state">Aucun établissement.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';
}

function openOrgModal(id) {
  var org = id ? dbGetOrganizationById(id) : null;
  var isNew = !org;

  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-5">' + (isNew ? 'Nouvel établissement' : 'Modifier l\'établissement') + '</h2>' +
    '<form id="org-form" class="space-y-4">' +
      '<input type="hidden" name="id" value="' + (org ? org.id : '') + '">' +
      '<div>' +
        '<label class="form-label">Nom de l\'établissement *</label>' +
        '<input type="text" name="nom" value="' + (org ? escapeHtml(org.nom) : '') + '" required class="form-input">' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Adresse</label>' +
        '<input type="text" name="adresse" value="' + (org ? escapeHtml(org.adresse || '') : '') + '" class="form-input">' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-4">' +
        '<div>' +
          '<label class="form-label">Téléphone</label>' +
          '<input type="text" name="telephone" value="' + (org ? escapeHtml(org.telephone || '') : '') + '" class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Email</label>' +
          '<input type="email" name="email" value="' + (org ? escapeHtml(org.email || '') : '') + '" class="form-input">' +
        '</div>' +
      '</div>' +
      (isNew
        ? '<div class="border-t border-gray-100 pt-4 mt-2">' +
            '<div class="font-semibold text-gray-700 mb-1">Compte administrateur</div>' +
            '<p class="text-xs text-gray-500 mb-3">Un administrateur sera créé pour cet établissement.</p>' +
            '<div class="space-y-3">' +
              '<div>' +
                '<label class="form-label">Nom complet *</label>' +
                '<input type="text" name="admin_nom" required class="form-input">' +
              '</div>' +
              '<div class="grid grid-cols-2 gap-4">' +
                '<div>' +
                  '<label class="form-label">Identifiant *</label>' +
                  '<input type="text" name="admin_username" required class="form-input">' +
                '</div>' +
                '<div>' +
                  '<label class="form-label">Mot de passe *</label>' +
                  '<input type="password" name="admin_password" required minlength="6" class="form-input" autocomplete="new-password">' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>'
        : '') +
      '<div class="flex justify-end gap-3 pt-2">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">' + (isNew ? 'Créer' : 'Enregistrer') + '</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('org-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var nom = (fd.get('nom') || '').trim();
    if (!nom) { showToast('Le nom est obligatoire', 'error'); return; }
    var data = {
      nom: nom,
      adresse: (fd.get('adresse') || '').trim() || null,
      telephone: (fd.get('telephone') || '').trim() || null,
      email: (fd.get('email') || '').trim() || null
    };
    try {
      if (org) {
        await dbUpdateOrganization(org.id, data);
      } else {
        var adminNom = (fd.get('admin_nom') || '').trim();
        var adminUsername = (fd.get('admin_username') || '').trim();
        var adminPassword = fd.get('admin_password') || '';
        if (!adminNom || !adminUsername || adminPassword.length < 6) {
          showToast('Renseignez le compte administrateur (mot de passe : 6 caractères min.)', 'error');
          return;
        }
        if (dbGetUserByUsername(adminUsername)) {
          showToast('Ce nom d\'utilisateur existe déjà. Choisissez-en un autre.', 'error');
          return;
        }
        var orgId = await dbCreateOrganization(data);
        await dbCreateUser({
          organization_id: orgId,
          nom: adminNom,
          username: adminUsername,
          password: adminPassword,
          role: 'admin'
        });
      }
      hideModal();
      showToast('Établissement enregistré', 'success');
      renderOrganisations();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function confirmDeleteOrg(id) {
  var org = dbGetOrganizationById(id);
  if (!org) return;
  var ok = await showConfirm('Supprimer l\'établissement "' + org.nom + '" ? Cette action est irréversible.');
  if (!ok) return;
  try {
    await dbDeleteOrganization(id);
    showToast('Établissement supprimé', 'success');
    renderOrganisations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
