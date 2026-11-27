// ─── MATIÈRES ─────────────────────────────────────────────────────────────────
// Une matière est définie par un nom + un coefficient. Le même nom peut exister
// plusieurs fois avec des coefficients différents (ex: Mathématiques coef 2 et
// Mathématiques coef 4) ; chaque classe choisit la variante qui lui convient.

function renderMatieres() {
  var matieres = dbGetAllMatieres();
  var admin = canManage();

  var rows = matieres.map(function(m) {
    return '<tr>' +
      '<td class="font-medium">' + escapeHtml(m.nom) + '</td>' +
      '<td><span class="chip chip-indigo">Coef. ' + m.coefficient + '</span></td>' +
      '<td>' + m.nb_classes + ' classe(s)</td>' +
      '<td class="text-right">' +
        (admin
          ? '<div class="flex gap-2 justify-end">' +
              '<button class="btn btn-sm btn-secondary" onclick="openMatiereModal(' + m.id + ')">Modifier</button>' +
              '<button class="btn btn-sm btn-danger" onclick="confirmDeleteMatiere(' + m.id + ')">Supprimer</button>' +
            '</div>'
          : '<span class="text-xs text-gray-400">Lecture seule</span>') +
      '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div>' +
        '<h1 class="page-title mb-1">Matières</h1>' +
        '<p class="text-sm text-gray-500">Catalogue réutilisable : une même matière peut avoir plusieurs coefficients.</p>' +
      '</div>' +
      (admin
        ? '<button class="btn btn-primary" onclick="openMatiereModal(0)">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' +
            'Nouvelle matière' +
          '</button>'
        : '') +
    '</div>' +
    '<div class="card">' +
      '<table>' +
        '<thead><tr><th>Matière</th><th>Coefficient</th><th>Utilisation</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="4" class="empty-state">Aucune matière. Créez-en une pour commencer.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';
}

function openMatiereModal(id) {
  var m = id ? dbGetMatiereById(id) : null;
  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-5">' + (m ? 'Modifier la matière' : 'Nouvelle matière') + '</h2>' +
    '<form id="matiere-form" class="space-y-4">' +
      '<input type="hidden" name="id" value="' + (m ? m.id : '') + '">' +
      '<div>' +
        '<label class="form-label">Nom de la matière *</label>' +
        '<input type="text" name="nom" value="' + (m ? escapeHtml(m.nom) : '') + '" required class="form-input" placeholder="ex: Mathématiques">' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Coefficient *</label>' +
        '<input type="number" name="coefficient" value="' + (m ? m.coefficient : '1') + '" min="0.5" step="0.5" required class="form-input">' +
        '<p class="text-xs text-gray-400 mt-1">Le coefficient par défaut est 1. Une même matière peut être recréée avec un autre coefficient.</p>' +
      '</div>' +
      '<div class="flex justify-end gap-3 pt-2">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">' + (m ? 'Enregistrer' : 'Créer') + '</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('matiere-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var nom = (fd.get('nom') || '').trim();
    var coef = parseFloat(fd.get('coefficient'));
    if (!nom) { showToast('Le nom est obligatoire', 'error'); return; }
    if (isNaN(coef) || coef <= 0) { showToast('Coefficient invalide', 'error'); return; }
    try {
      if (fd.get('id')) {
        await dbUpdateMatiere(Number(fd.get('id')), nom, coef);
      } else {
        await dbCreateMatiere(nom, coef);
      }
      hideModal();
      showToast('Matière enregistrée', 'success');
      renderMatieres();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function confirmDeleteMatiere(id) {
  var m = dbGetMatiereById(id);
  if (!m) return;
  var ok = await showConfirm('Supprimer la matière "' + m.nom + '" (coef. ' + m.coefficient + ') ?');
  if (!ok) return;
  try {
    await dbDeleteMatiere(id);
    showToast('Matière supprimée', 'success');
    renderMatieres();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
