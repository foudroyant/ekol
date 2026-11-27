function renderClasses() {
  var classes = dbGetAllClasses();
  var admin = canManage();

  var rows = classes.map(function(c) {
    return '<tr>' +
      '<td class="font-medium">' + escapeHtml(c.nom) + '</td>' +
      '<td><span class="chip chip-indigo">' + escapeHtml(c.cycle_nom) + '</span></td>' +
      '<td>' + c.nb_matieres + '</td>' +
      '<td class="text-xs text-gray-600">' + escapeHtml(c.style_nom || '—') + (c.style_id ? ' <span class="chip chip-purple">surcharge</span>' : '') + '</td>' +
      '<td>' + c.nb_eleves + '</td>' +
      '<td>' + formatMoney(c.montant_inscription) + '</td>' +
      '<td>' + formatMoney(c.montant_mensuel) + '</td>' +
      '<td class="text-xs text-gray-500">' + escapeHtml(c.annee_scolaire || '—') + '</td>' +
      '<td class="text-right">' +
        '<div class="flex gap-2 justify-end flex-wrap">' +
          '<a href="#/classe/' + c.id + '" class="btn btn-sm btn-secondary">Étudiants</a>' +
          (admin
            ? '<button class="btn btn-sm btn-secondary" onclick="openClasseMatieresModal(' + c.id + ')">Matières</button>' +
              '<button class="btn btn-sm btn-secondary" onclick="openClasseModal(' + c.id + ')">Modifier</button>' +
              '<button class="btn btn-sm btn-danger" onclick="confirmDeleteClasse(' + c.id + ')">Supprimer</button>'
            : '') +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div>' +
        '<h1 class="page-title mb-1">Classes</h1>' +
        '<p class="text-sm text-gray-500">Matières, style de notation et étudiants par classe.</p>' +
      '</div>' +
      (admin
        ? '<button class="btn btn-primary" onclick="openClasseModal(0)">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' +
            'Nouvelle classe' +
          '</button>'
        : '') +
    '</div>' +
    '<div class="card">' +
      '<div class="table-wrap">' +
        '<table class="table-compact">' +
          '<thead><tr><th>Classe</th><th>Cycle</th><th>Matières</th><th>Style</th><th>Élèves</th><th>Inscription</th><th>Mensuel</th><th>Année</th><th></th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="9" class="empty-state">Aucune classe. Créez d\'abord un cycle.</td></tr>') + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
}

function openClasseModal(id) {
  var classe = id ? dbGetClasseById(id) : null;
  var cycles = dbGetAllCycles();
  var styles = dbGetStyles();
  var defaultStyleId = dbGetDefaultStyleId();
  var defaultStyle = styles.filter(function(s) { return s.id === defaultStyleId; })[0];

  if (cycles.length === 0) {
    showToast('Créez d\'abord un cycle avant d\'ajouter une classe.', 'error');
    return;
  }

  var cycleOptions = cycles.map(function(c) {
    var selected = classe && classe.cycle_id === c.id ? ' selected' : '';
    return '<option value="' + c.id + '"' + selected + '>' + escapeHtml(c.nom) + '</option>';
  }).join('');

  var styleOptions = '<option value="">Style de l\'établissement — ' +
    escapeHtml(defaultStyle ? defaultStyle.nom : 'aucun') + '</option>' +
    styles.map(function(s) {
      var selected = classe && classe.style_id === s.id ? ' selected' : '';
      return '<option value="' + s.id + '"' + selected + '>' + escapeHtml(s.nom) + '</option>';
    }).join('');

  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-5">' + (classe ? 'Modifier la classe' : 'Nouvelle classe') + '</h2>' +
    '<form id="classe-form" class="space-y-4">' +
      '<input type="hidden" name="id" value="' + (classe ? classe.id : '') + '">' +
      '<div class="grid grid-cols-2 gap-4">' +
        '<div>' +
          '<label class="form-label">Cycle *</label>' +
          '<select name="cycle_id" required class="form-input"><option value="">— Choisir —</option>' + cycleOptions + '</select>' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Nom de la classe *</label>' +
          '<input type="text" name="nom" value="' + (classe ? escapeHtml(classe.nom) : '') + '" required class="form-input" placeholder="ex: CP1, 6ème A">' +
        '</div>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-4">' +
        '<div>' +
          '<label class="form-label">Montant inscription</label>' +
          '<input type="number" name="montant_inscription" value="' + (classe ? classe.montant_inscription : '0') + '" min="0" class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Mensualité</label>' +
          '<input type="number" name="montant_mensuel" value="' + (classe ? classe.montant_mensuel : '0') + '" min="0" class="form-input">' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Année scolaire</label>' +
        '<input type="text" name="annee_scolaire" value="' + (classe ? escapeHtml(classe.annee_scolaire || '') : '') + '" class="form-input" placeholder="ex: 2026-2027">' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Style de notation</label>' +
        '<select name="style_id" class="form-input">' + styleOptions + '</select>' +
        '<p class="text-xs text-gray-400 mt-1">Laissez « style de l\'établissement » pour hériter du style par défaut, ou choisissez une surcharge pour cette classe.</p>' +
      '</div>' +
      '<div class="flex justify-end gap-3 pt-2">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">' + (classe ? 'Enregistrer' : 'Créer') + '</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('classe-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var nom = (fd.get('nom') || '').trim();
    if (!nom || !fd.get('cycle_id')) { showToast('Champs obligatoires manquants', 'error'); return; }
    var styleId = fd.get('style_id') ? Number(fd.get('style_id')) : null;
    try {
      if (fd.get('id')) {
        await dbUpdateClasse(
          Number(fd.get('id')), Number(fd.get('cycle_id')), nom,
          parseFloat(fd.get('montant_inscription')) || 0,
          parseFloat(fd.get('montant_mensuel')) || 0,
          (fd.get('annee_scolaire') || '').trim() || null,
          styleId
        );
      } else {
        await dbCreateClasse(
          Number(fd.get('cycle_id')), nom,
          parseFloat(fd.get('montant_inscription')) || 0,
          parseFloat(fd.get('montant_mensuel')) || 0,
          (fd.get('annee_scolaire') || '').trim() || null,
          styleId
        );
      }
      hideModal();
      showToast('Classe enregistrée', 'success');
      renderClasses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function confirmDeleteClasse(id) {
  var classe = dbGetClasseById(id);
  if (!classe) return;
  var ok = await showConfirm('Supprimer la classe "' + classe.nom + '" ? Cette action est irréversible.');
  if (!ok) return;
  try {
    await dbDeleteClasse(id);
    showToast('Classe supprimée', 'success');
    renderClasses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
