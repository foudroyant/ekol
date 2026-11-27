// ─── STYLES DE NOTATION ───────────────────────────────────────────────────────
// Un style = une liste de composantes libres avec des poids. Le style par défaut
// de l'établissement s'applique à toutes les classes, sauf surcharge par classe.
// Le modèle "Standard 40/60" est fourni et défini par défaut à la création.

function _styleCompRow(c) {
  return '<div class="comp-row" data-comp-row>' +
    '<input type="hidden" data-comp-id value="' + (c.id || '') + '">' +
    '<input type="text" data-comp-nom value="' + escapeHtml(c.nom || '') + '" placeholder="Nom (ex: Devoir 1)" class="form-input">' +
    '<input type="text" data-comp-groupe value="' + escapeHtml(c.groupe || '') + '" placeholder="Groupe (Classe / Session)" class="form-input">' +
    '<input type="number" data-comp-poids value="' + (c.poids || 1) + '" min="0.1" step="0.1" class="form-input comp-poids">' +
    '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentNode.remove(); _styleRecalcTotal()" title="Retirer">×</button>' +
  '</div>';
}

function _styleRecalcTotal() {
  var total = 0;
  var rows = document.querySelectorAll('[data-comp-row]');
  for (var i = 0; i < rows.length; i++) {
    var input = rows[i].querySelector('[data-comp-poids]');
    var v = parseFloat(input && input.value);
    if (!isNaN(v)) total += v;
  }
  var el = document.getElementById('style-total');
  if (el) el.textContent = total ? gradeFormat(total, 2) : '0';
}

function renderStyles() {
  var styles = dbGetStyles();
  var defaultId = dbGetDefaultStyleId();
  var admin = canManage();

  var rows = styles.map(function(s) {
    var isDefault = s.id === defaultId;
    return '<tr>' +
      '<td>' +
        '<div class="font-medium">' + escapeHtml(s.nom) +
          (isDefault ? ' <span class="chip chip-green ml-1">Par défaut</span>' : '') +
        '</div>' +
        '<div class="text-xs text-gray-400 mt-1">' + escapeHtml(s.description || '') + '</div>' +
      '</td>' +
      '<td><div class="text-xs text-gray-600">' + escapeHtml(s.resume || '—') + '</div></td>' +
      '<td>' + s.nb_classes + ' classe(s)</td>' +
      '<td class="text-right">' +
        (admin
          ? '<div class="flex gap-2 justify-end flex-wrap">' +
              '<button class="btn btn-sm btn-secondary" onclick="openStyleModal(' + s.id + ')">Modifier</button>' +
              '<button class="btn btn-sm btn-secondary" onclick="duplicateStyle(' + s.id + ')">Dupliquer</button>' +
              (!isDefault ? '<button class="btn btn-sm btn-secondary" onclick="setDefaultStyle(' + s.id + ')">Par défaut</button>' : '') +
              (!isDefault && s.nb_classes === 0 ? '<button class="btn btn-sm btn-danger" onclick="confirmDeleteStyle(' + s.id + ')">Supprimer</button>' : '') +
            '</div>'
          : '<span class="text-xs text-gray-400">Lecture seule</span>') +
      '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div>' +
        '<h1 class="page-title mb-1">Styles de notation</h1>' +
        '<p class="text-sm text-gray-500">Choisissez un modèle ou créez le vôtre. Les composantes et leurs poids sont libres.</p>' +
      '</div>' +
      (admin
        ? '<button class="btn btn-primary" onclick="openStyleModal(0)">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' +
            'Nouveau style' +
          '</button>'
        : '') +
    '</div>' +
    '<div class="card p-4 mb-5 bg-indigo-50 border border-indigo-100">' +
      '<div class="text-sm text-indigo-900">' +
        '<span class="font-semibold">Calcul :</span> moyenne matière = Σ(note × poids) / Σ(poids). ' +
        'La moyenne générale = Σ(moyenne matière × coefficient) / Σ(coefficients). ' +
        'Le style par défaut s\'applique à toutes les classes, sauf celles qui ont une surcharge.' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<table>' +
        '<thead><tr><th>Style</th><th>Composantes</th><th>Utilisation</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="4" class="empty-state">Aucun style.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';
}

function openStyleModal(id) {
  var style = id ? dbGetStyleById(id) : null;
  var composantes = style && style.composantes.length
    ? style.composantes
    : [{ nom: 'Devoir', groupe: 'Classe', poids: 50 }, { nom: 'Session', groupe: 'Session', poids: 50 }];

  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-1">' + (style ? 'Modifier le style' : 'Nouveau style') + '</h2>' +
    '<p class="text-xs text-gray-500 mb-5">Ajoutez les composantes de votre choix (devoirs, TP, exposé, session…). ' +
      'Les poids sont relatifs : inutile qu\'ils totalisent 100.</p>' +
    '<form id="style-form" class="space-y-4">' +
      '<input type="hidden" name="id" value="' + (style ? style.id : '') + '">' +
      '<div>' +
        '<label class="form-label">Nom du style *</label>' +
        '<input type="text" name="nom" value="' + (style ? escapeHtml(style.nom) : '') + '" required class="form-input" placeholder="ex: Standard 40/60">' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Description</label>' +
        '<input type="text" name="description" value="' + (style ? escapeHtml(style.description || '') : '') + '" class="form-input" placeholder="Optionnel">' +
      '</div>' +
      '<div>' +
        '<div class="flex items-center justify-between mb-2">' +
          '<label class="form-label mb-0">Composantes *</label>' +
          '<span class="text-xs text-gray-500">Total des poids : <span id="style-total" class="font-semibold text-indigo-700">—</span></span>' +
        '</div>' +
        '<div class="comp-head">' +
          '<span>Nom</span><span>Groupe</span><span>Poids</span><span></span>' +
        '</div>' +
        '<div id="composantes-container">' +
          composantes.map(_styleCompRow).join('') +
        '</div>' +
        '<button type="button" class="btn btn-sm btn-secondary mt-1" onclick="_styleAddComp()">+ Ajouter une composante</button>' +
      '</div>' +
      (style && dbCountNotesForStyle(style.id) > 0
        ? '<div class="auth-error">⚠️ Ce style contient déjà des notes. Si vous supprimez une composante, ses notes seront définitivement effacées.</div>'
        : '') +
      '<div class="flex justify-end gap-3 pt-2">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">' + (style ? 'Enregistrer' : 'Créer') + '</button>' +
      '</div>' +
    '</form>',
    680
  );

  _styleRecalcTotal();
  document.getElementById('composantes-container').addEventListener('input', _styleRecalcTotal);

  document.getElementById('style-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var nom = (fd.get('nom') || '').trim();
    if (!nom) { showToast('Le nom du style est obligatoire', 'error'); return; }

    var rows = document.querySelectorAll('[data-comp-row]');
    var comps = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var cid = row.querySelector('[data-comp-id]').value;
      var cnom = row.querySelector('[data-comp-nom]').value.trim();
      var cgroupe = row.querySelector('[data-comp-groupe]').value.trim();
      var cpoids = parseFloat(row.querySelector('[data-comp-poids]').value);
      if (!cnom) { showToast('Chaque composante doit avoir un nom', 'error'); return; }
      if (isNaN(cpoids) || cpoids <= 0) { showToast('Chaque composante doit avoir un poids > 0', 'error'); return; }
      comps.push({ id: cid ? Number(cid) : null, nom: cnom, groupe: cgroupe || null, poids: cpoids });
    }
    if (!comps.length) { showToast('Ajoutez au moins une composante', 'error'); return; }

    if (style && dbCountNotesForStyle(style.id) > 0) {
      var oldIds = {};
      for (var k = 0; k < style.composantes.length; k++) oldIds[style.composantes[k].id] = true;
      var removed = false;
      for (var m = 0; m < comps.length; m++) { if (comps[m].id) delete oldIds[comps[m].id]; }
      for (var key in oldIds) { if (oldIds.hasOwnProperty(key)) removed = true; }
      if (removed) {
        var ok = await showConfirm('Des composantes supprimées contiennent des notes. Ces notes seront définitivement effacées. Continuer ?');
        if (!ok) return;
      }
    }

    try {
      if (style) {
        await dbUpdateStyle(style.id, nom, (fd.get('description') || '').trim() || null, comps);
      } else {
        await dbCreateStyle(nom, (fd.get('description') || '').trim() || null, comps);
      }
      hideModal();
      showToast('Style enregistré', 'success');
      renderStyles();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function _styleAddComp() {
  var container = document.getElementById('composantes-container');
  container.insertAdjacentHTML('beforeend', _styleCompRow({ nom: '', groupe: 'Classe', poids: 10 }));
  _styleRecalcTotal();
}

async function duplicateStyle(id) {
  var style = dbGetStyleById(id);
  if (!style) return;
  try {
    await dbDuplicateStyle(id, style.nom + ' (copie)');
    showToast('Style dupliqué', 'success');
    renderStyles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function setDefaultStyle(id) {
  try {
    await dbSetDefaultStyle(id);
    showToast('Style défini par défaut pour l\'établissement', 'success');
    renderStyles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmDeleteStyle(id) {
  var style = dbGetStyleById(id);
  if (!style) return;
  var ok = await showConfirm('Supprimer le style "' + style.nom + '" ?');
  if (!ok) return;
  try {
    await dbDeleteStyle(id);
    showToast('Style supprimé', 'success');
    renderStyles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
