function renderClasses() {
  var classes = dbGetAllClasses();

  var rows = classes.map(function(c) {
    return '<tr>' +
      '<td class="font-medium">' + c.nom + '</td>' +
      '<td><span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">' + c.cycle_nom + '</span></td>' +
      '<td>' + formatMoney(c.montant_inscription) + '</td>' +
      '<td>' + formatMoney(c.montant_mensuel) + '</td>' +
      '<td>' + (c.annee_scolaire || '—') + '</td>' +
      '<td>' +
        '<div class="flex gap-2">' +
          '<button class="btn btn-sm btn-secondary" onclick="openClasseModal(' + c.id + ')">Modifier</button>' +
          '<button class="btn btn-sm btn-danger" onclick="confirmDeleteClasse(' + c.id + ')">Supprimer</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<h1 class="page-title mb-0">Classes</h1>' +
      '<button class="btn btn-primary" onclick="openClasseModal(0)">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' +
        'Nouvelle classe' +
      '</button>' +
    '</div>' +
    '<div class="card">' +
      '<table>' +
        '<thead><tr><th>Classe</th><th>Cycle</th><th>Inscription</th><th>Mensuel</th><th>Année</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" class="text-center py-10 text-gray-400">Aucune classe. Créez d\'abord un cycle.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';
}

function openClasseModal(id) {
  var classe = id ? dbGetClasseById(id) : null;
  var cycles = dbGetAllCycles();

  if (cycles.length === 0) {
    showToast('Créez d\'abord un cycle avant d\'ajouter une classe.', 'error');
    return;
  }

  var cycleOptions = cycles.map(function(c) {
    var selected = classe && classe.cycle_id === c.id ? ' selected' : '';
    return '<option value="' + c.id + '"' + selected + '>' + c.nom + '</option>';
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
          '<input type="text" name="nom" value="' + (classe ? classe.nom : '') + '" required class="form-input" placeholder="ex: CP1, 6ème A">' +
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
        '<input type="text" name="annee_scolaire" value="' + (classe ? (classe.annee_scolaire || '') : '') + '" class="form-input" placeholder="ex: 2026-2027">' +
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
    var nom = fd.get('nom').trim();
    if (!nom || !fd.get('cycle_id')) { showToast('Champs obligatoires manquants', 'error'); return; }
    try {
      if (fd.get('id')) {
        await dbUpdateClasse(
          Number(fd.get('id')), Number(fd.get('cycle_id')), nom,
          parseFloat(fd.get('montant_inscription')) || 0,
          parseFloat(fd.get('montant_mensuel')) || 0,
          fd.get('annee_scolaire').trim() || null
        );
      } else {
        await dbCreateClasse(
          Number(fd.get('cycle_id')), nom,
          parseFloat(fd.get('montant_inscription')) || 0,
          parseFloat(fd.get('montant_mensuel')) || 0,
          fd.get('annee_scolaire').trim() || null
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
