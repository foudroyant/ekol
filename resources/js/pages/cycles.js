function renderCycles() {
  var cycles = dbGetAllCycles();

  var rows = cycles.map(function(c) {
    return '<tr>' +
      '<td class="font-medium">' + c.nom + '</td>' +
      '<td>' + (c.ordre !== null && c.ordre !== undefined ? c.ordre : '—') + '</td>' +
      '<td>' +
        '<div class="flex gap-2">' +
          '<button class="btn btn-sm btn-secondary" onclick="openCycleModal(' + c.id + ')">Modifier</button>' +
          '<button class="btn btn-sm btn-danger" onclick="confirmDeleteCycle(' + c.id + ')">Supprimer</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<h1 class="page-title mb-0">Cycles</h1>' +
      '<button class="btn btn-primary" onclick="openCycleModal(0)">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' +
        'Nouveau cycle' +
      '</button>' +
    '</div>' +
    '<div class="card">' +
      '<table>' +
        '<thead><tr><th>Nom du cycle</th><th>Ordre</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="3" class="text-center py-10 text-gray-400">Aucun cycle. Créez-en un pour commencer.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';
}

function openCycleModal(id) {
  var cycle = id ? dbGetAllCycles().filter(function(c) { return c.id === id; })[0] : null;

  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-5">' + (cycle ? 'Modifier le cycle' : 'Nouveau cycle') + '</h2>' +
    '<form id="cycle-form" class="space-y-4">' +
      '<input type="hidden" name="id" value="' + (cycle ? cycle.id : '') + '">' +
      '<div>' +
        '<label class="form-label">Nom du cycle *</label>' +
        '<input type="text" name="nom" value="' + (cycle ? cycle.nom : '') + '" required class="form-input" placeholder="ex: Primaire, Collège, Lycée">' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Ordre d\'affichage</label>' +
        '<input type="number" name="ordre" value="' + (cycle && cycle.ordre !== null ? cycle.ordre : '') + '" class="form-input" placeholder="1, 2, 3...">' +
      '</div>' +
      '<div class="flex justify-end gap-3 pt-2">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">' + (cycle ? 'Enregistrer' : 'Créer') + '</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('cycle-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var nom = fd.get('nom').trim();
    var ordre = fd.get('ordre') ? parseInt(fd.get('ordre')) : null;
    if (!nom) { showToast('Le nom est obligatoire', 'error'); return; }
    try {
      if (fd.get('id')) {
        await dbUpdateCycle(Number(fd.get('id')), nom, ordre);
      } else {
        await dbCreateCycle(nom, ordre);
      }
      hideModal();
      showToast('Cycle enregistré', 'success');
      renderCycles();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function confirmDeleteCycle(id) {
  var cycle = dbGetAllCycles().filter(function(c) { return c.id === id; })[0];
  if (!cycle) return;
  var ok = await showConfirm('Supprimer le cycle "' + cycle.nom + '" ? Cette action est irréversible.');
  if (!ok) return;
  try {
    await dbDeleteCycle(id);
    showToast('Cycle supprimé', 'success');
    renderCycles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
