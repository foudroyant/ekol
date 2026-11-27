// ─── SAISIE DES NOTES ─────────────────────────────────────────────────────────
// Grille : une classe + une période + une matière. Les colonnes sont les
// composantes libres du style effectif (surcharge de classe ou style par défaut).

var _notesPrefill = null;
var _notesComposantes = [];
var _notesMissingAsZero = true;
var _notesNoteMax = 20;

function renderNotes() {
  var periodes = dbGetAllPeriodes();
  var classes = dbGetAllClasses();

  if (!periodes.length) {
    document.getElementById('app').innerHTML =
      '<h1 class="page-title">Saisie des notes</h1>' +
      '<div class="card p-8 text-center max-w-lg mx-auto mt-8">' +
        '<p class="text-lg font-medium mb-2">Aucune période d\'évaluation</p>' +
        '<p class="text-sm text-gray-500 mb-4">Créez au moins une période (séquence, trimestre…) dans les paramètres.</p>' +
        '<a href="#/parametres" class="btn btn-primary">Ouvrir les paramètres</a>' +
      '</div>';
    return;
  }

  if (!classes.length) {
    document.getElementById('app').innerHTML =
      '<h1 class="page-title">Saisie des notes</h1>' +
      '<div class="card p-8 text-center max-w-lg mx-auto mt-8">' +
        '<p class="text-lg font-medium mb-2">Aucune classe</p>' +
        '<p class="text-sm text-gray-500 mb-4">Créez d\'abord un cycle et une classe.</p>' +
        '<a href="#/classes" class="btn btn-primary">Gérer les classes</a>' +
      '</div>';
    return;
  }

  var prefill = _notesPrefill || {};
  var selectedClasse = prefill.classe_id ? Number(prefill.classe_id) : classes[0].id;
  var selectedPeriode = prefill.periode_id ? Number(prefill.periode_id) : periodes[0].id;
  _notesPrefill = null;

  var classeOptions = classes.map(function(c) {
    return '<option value="' + c.id + '"' + (c.id === selectedClasse ? ' selected' : '') + '>' +
      escapeHtml(c.cycle_nom + ' › ' + c.nom) + '</option>';
  }).join('');
  var periodeOptions = periodes.map(function(p) {
    return '<option value="' + p.id + '"' + (p.id === selectedPeriode ? ' selected' : '') + '>' +
      escapeHtml(p.nom) + '</option>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div>' +
        '<h1 class="page-title mb-1">Saisie des notes</h1>' +
        '<p class="text-sm text-gray-500">Sélectionnez une classe, une période et une matière, puis saisissez les notes.</p>' +
      '</div>' +
      '<div class="flex gap-2">' +
        '<button class="btn btn-secondary" onclick="exportClasseSummary(document.getElementById(\'n-classe\').value, document.getElementById(\'n-periode\').value, \'csv\')">Export étudiants CSV</button>' +
        '<button class="btn btn-secondary" onclick="exportClasseDetailed(document.getElementById(\'n-classe\').value, document.getElementById(\'n-periode\').value, \'xls\')">Export notes Excel</button>' +
      '</div>' +
    '</div>' +
    '<div class="card p-4 mb-5">' +
      '<div class="toolbar">' +
        '<div><label class="form-label">Classe</label><select id="n-classe" class="form-input">' + classeOptions + '</select></div>' +
        '<div><label class="form-label">Période</label><select id="n-periode" class="form-input">' + periodeOptions + '</select></div>' +
        '<div><label class="form-label">Matière</label><select id="n-matiere" class="form-input"></select></div>' +
      '</div>' +
    '</div>' +
    '<div id="notes-area"></div>';

  var matiereSelect = document.getElementById('n-matiere');

  function fillMatieres() {
    var cid = Number(document.getElementById('n-classe').value);
    var subjects = dbGetClasseMatieresWithDetails(cid);
    if (!subjects.length) {
      matiereSelect.innerHTML = '<option value="">— Aucune matière —</option>';
      renderNotesArea(cid, Number(document.getElementById('n-periode').value), null);
      return;
    }
    matiereSelect.innerHTML = subjects.map(function(s) {
      return '<option value="' + s.id + '">' + escapeHtml(s.nom) + ' (coef. ' + s.coefficient + ')</option>';
    }).join('');
    if (prefill.matiere_id) {
      matiereSelect.value = String(prefill.matiere_id);
      if (!matiereSelect.value) matiereSelect.selectedIndex = 0;
    }
    renderNotesArea(cid, Number(document.getElementById('n-periode').value), Number(matiereSelect.value));
  }

  document.getElementById('n-classe').addEventListener('change', fillMatieres);
  document.getElementById('n-periode').addEventListener('change', function() {
    renderNotesArea(
      Number(document.getElementById('n-classe').value),
      Number(document.getElementById('n-periode').value),
      matiereSelect.value ? Number(matiereSelect.value) : null
    );
  });
  matiereSelect.addEventListener('change', function() {
    renderNotesArea(
      Number(document.getElementById('n-classe').value),
      Number(document.getElementById('n-periode').value),
      matiereSelect.value ? Number(matiereSelect.value) : null
    );
  });

  fillMatieres();
}

function renderNotesArea(classeId, periodeId, classeMatiereId) {
  var area = document.getElementById('notes-area');
  if (!classeMatiereId) {
    area.innerHTML = '<div class="card p-8 text-center text-gray-500">' +
      '<p class="font-medium mb-2">Aucune matière sélectionnée</p>' +
      '<p class="text-sm">Ajoutez des matières à cette classe depuis <a href="#/classes" class="back-link">Classes</a>.</p>' +
      '</div>';
    return;
  }

  var style = dbGetEffectiveStyleForClasse(classeId);
  var composantes = style ? dbGetStyleComponents(style.id) : [];
  if (!composantes.length) {
    area.innerHTML = '<div class="card p-8 text-center text-gray-500">' +
      '<p class="font-medium mb-2">Aucune composante de notation</p>' +
      '<p class="text-sm">Le style de cette classe n\'a pas de composante. Modifiez-le dans <a href="#/styles" class="back-link">Styles de notation</a>.</p>' +
      '</div>';
    return;
  }

  var students = dbGetElevesByClasse(classeId);
  if (!students.length) {
    area.innerHTML = '<div class="card p-8 text-center text-gray-500">' +
      '<p class="font-medium mb-2">Aucun étudiant dans cette classe</p>' +
      '<a href="#/inscription" class="btn btn-primary mt-3">Inscrire un étudiant</a>' +
      '</div>';
    return;
  }

  _notesComposantes = composantes;
  _notesMissingAsZero = dbGetMissingAsZero();
  _notesNoteMax = dbGetNoteMax();

  var notes = dbGetNotesForClasseMatierePeriode(classeMatiereId, periodeId);
  var noteMap = {};
  for (var i = 0; i < notes.length; i++) {
    noteMap[notes[i].eleve_id + '|' + notes[i].composante_id] = notes[i].valeur;
  }

  // Regroupement des composantes par "groupe" pour l'en-tête.
  var groups = [];
  for (var g = 0; g < composantes.length; g++) {
    var groupe = composantes[g].groupe || 'Notes';
    var last = groups[groups.length - 1];
    if (last && last.nom === groupe) last.count++;
    else groups.push({ nom: groupe, count: 1 });
  }

  var head1 = '<th rowspan="2" class="sticky-col">Élève</th>';
  for (var h = 0; h < groups.length; h++) {
    head1 += '<th colspan="' + groups[h].count + '" class="text-center group-head">' + escapeHtml(groups[h].nom) + '</th>';
  }
  head1 += '<th rowspan="2" class="text-center">Moyenne matière</th>';

  var head2 = '';
  for (var c = 0; c < composantes.length; c++) {
    var comp = composantes[c];
    head2 += '<th class="text-center comp-head-cell">' + escapeHtml(comp.nom) +
      '<div class="text-xs text-gray-400 font-normal">poids ' + comp.poids + '</div></th>';
  }

  var body = '';
  for (var s = 0; s < students.length; s++) {
    var st = students[s];
    var valeurs = {};
    var inputs = '';
    for (var k = 0; k < composantes.length; k++) {
      var cp = composantes[k];
      var v = noteMap[st.id + '|' + cp.id];
      var val = (v === null || v === undefined) ? '' : v;
      valeurs[cp.id] = (v === undefined ? null : v);
      inputs += '<td class="text-center">' +
        '<input type="number" class="note-input" inputmode="decimal" ' +
          'min="0" max="' + _notesNoteMax + '" step="0.25" ' +
          'data-eleve="' + st.id + '" data-comp="' + cp.id + '" ' +
          'data-row="' + s + '" data-col="' + k + '" ' +
          'value="' + val + '" oninput="notesRecalcRow(this)" onkeydown="notesKeyNav(event, this)">' +
        '</td>';
    }
    var mm = gradeComputeMoyenneMatiere(valeurs, composantes, _notesMissingAsZero);
    body += '<tr>' +
      '<td class="sticky-col">' +
        '<div class="font-medium text-sm">' + escapeHtml(st.prenom + ' ' + st.nom) + '</div>' +
        '<div class="text-xs text-gray-400 font-mono">' + escapeHtml(st.matricule) + '</div>' +
      '</td>' +
      inputs +
      '<td class="text-center font-semibold text-indigo-700" data-row-moyenne>' + gradeFormat(mm.moyenne) + '</td>' +
    '</tr>';
  }

  area.innerHTML =
    '<div class="card">' +
      '<div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">' +
        '<div class="text-sm text-gray-600">' +
          '<span class="font-semibold">' + students.length + '</span> étudiant(s) · ' +
          'barème /' + _notesNoteMax + ' · ' +
          (style ? 'style « ' + escapeHtml(style.nom) + ' »' : 'aucun style') +
        '</div>' +
        '<div class="flex items-center gap-3">' +
          '<span class="text-xs text-gray-400">' +
            (_notesMissingAsZero ? 'Note absente = 0' : 'Notes absentes ignorées') +
          '</span>' +
          '<button class="btn btn-primary" id="save-notes-btn">Enregistrer les notes</button>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<table class="table-compact grade-entry">' +
          '<thead><tr>' + head1 + '</tr><tr>' + head2 + '</tr></thead>' +
          '<tbody>' + body + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';

  document.getElementById('save-notes-btn').addEventListener('click', function() {
    saveNotesBatch(classeMatiereId, periodeId);
  });
}

function notesRecalcRow(input) {
  var tr = input.closest('tr');
  if (!tr) return;
  var inputs = tr.querySelectorAll('input[data-comp]');
  var valeurs = {};
  for (var i = 0; i < inputs.length; i++) {
    var inp = inputs[i];
    var raw = inp.value;
    if (raw !== '') {
      var n = Number(raw);
      if (isNaN(n) || n < 0 || n > _notesNoteMax) {
        inp.classList.add('invalid');
      } else {
        inp.classList.remove('invalid');
      }
    } else {
      inp.classList.remove('invalid');
    }
    valeurs[inp.getAttribute('data-comp')] = raw;
  }
  var mm = gradeComputeMoyenneMatiere(valeurs, _notesComposantes, _notesMissingAsZero);
  var cell = tr.querySelector('[data-row-moyenne]');
  if (cell) cell.textContent = gradeFormat(mm.moyenne);
}

function notesKeyNav(event, input) {
  if (event.key !== 'Enter' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  var row = Number(input.getAttribute('data-row'));
  var col = input.getAttribute('data-col');
  var nextRow = event.key === 'ArrowUp' ? row - 1 : row + 1;
  var next = document.querySelector('input[data-row="' + nextRow + '"][data-col="' + col + '"]');
  if (next) {
    next.focus();
    next.select();
  }
}

async function saveNotesBatch(classeMatiereId, periodeId) {
  var inputs = document.querySelectorAll('#notes-area input[data-comp]');
  var rows = [];
  var invalid = false;
  for (var i = 0; i < inputs.length; i++) {
    var inp = inputs[i];
    var raw = inp.value;
    if (raw !== '') {
      var n = Number(raw);
      if (isNaN(n) || n < 0 || n > _notesNoteMax) { invalid = true; inp.classList.add('invalid'); }
    }
    rows.push({
      eleve_id: Number(inp.getAttribute('data-eleve')),
      classe_matiere_id: Number(classeMatiereId),
      periode_id: Number(periodeId),
      composante_id: Number(inp.getAttribute('data-comp')),
      valeur: raw === '' ? null : Number(raw)
    });
  }
  if (invalid) {
    showToast('Certaines notes dépassent le barème /' + _notesNoteMax, 'error');
    return;
  }
  try {
    await dbSaveNotesBatch(rows);
    showToast('Notes enregistrées', 'success');
    renderNotesArea(
      Number(document.getElementById('n-classe').value),
      Number(document.getElementById('n-periode').value),
      Number(classeMatiereId)
    );
  } catch (err) {
    showToast(err.message, 'error');
  }
}
