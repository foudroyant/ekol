// ─── FICHE D'UNE CLASSE ───────────────────────────────────────────────────────
// Matières de la classe, style effectif, liste des étudiants avec moyennes,
// classement, filtres et exports.

var _classeView = { classeId: null, periodeId: null, search: '', sort: 'rang', mention: '' };

function renderClasseDetail(params) {
  var classeId = Number(params.id);
  var classe = dbGetClasseById(classeId);
  if (!classe) {
    document.getElementById('app').innerHTML =
      '<a href="#/classes" class="back-link">← Retour aux classes</a>' +
      '<p class="mt-4 text-gray-500">Classe introuvable.</p>';
    return;
  }

  var periodes = dbGetAllPeriodes();
  if (!periodes.length) {
    document.getElementById('app').innerHTML =
      '<a href="#/classes" class="back-link">← Retour aux classes</a>' +
      '<div class="card p-8 text-center max-w-lg mx-auto mt-8">' +
        '<p class="text-lg font-medium mb-2">Aucune période d\'évaluation</p>' +
        '<a href="#/parametres" class="btn btn-primary mt-2">Créer une période</a>' +
      '</div>';
    return;
  }

  var periodeId = (_classeView.classeId === classeId && _classeView.periodeId)
    ? _classeView.periodeId
    : periodes[0].id;
  _classeView = {
    classeId: classeId,
    periodeId: periodeId,
    search: (_classeView.classeId === classeId ? _classeView.search : ''),
    sort: (_classeView.classeId === classeId ? _classeView.sort : 'rang'),
    mention: (_classeView.classeId === classeId ? _classeView.mention : '')
  };

  var admin = canManage();
  var style = dbGetEffectiveStyleForClasse(classeId);
  var subjects = dbGetClasseMatieresWithDetails(classeId);
  var styles = dbGetStyles();
  var totalCoef = 0;
  for (var i = 0; i < subjects.length; i++) totalCoef += Number(subjects[i].coefficient) || 0;

  var periodeOptions = periodes.map(function(p) {
    return '<option value="' + p.id + '"' + (p.id === periodeId ? ' selected' : '') + '>' +
      escapeHtml(p.nom) + '</option>';
  }).join('');

  var styleOptions = '<option value="">Style de l\'établissement — ' +
    escapeHtml(style ? style.nom : 'aucun') + '</option>' +
    styles.map(function(s) {
      return '<option value="' + s.id + '"' + (classe.style_id === s.id ? ' selected' : '') + '>' +
        escapeHtml(s.nom) + '</option>';
    }).join('');

  var subjectRows = subjects.map(function(s) {
    return '<tr>' +
      '<td class="font-medium">' + escapeHtml(s.nom) + '</td>' +
      '<td><span class="chip chip-indigo">Coef. ' + s.coefficient + '</span></td>' +
      '<td class="text-right">' +
        (admin ? '<button class="btn btn-sm btn-danger" onclick="removeClasseMatiere(' + classeId + ', ' + s.matiere_id + ')">Retirer</button>' : '') +
      '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6 flex-wrap gap-3">' +
      '<div class="flex items-center gap-3">' +
        '<a href="#/classes" class="back-link">← Classes</a>' +
        '<span class="text-gray-300">/</span>' +
        '<div>' +
          '<h1 class="text-xl font-bold text-gray-900">' + escapeHtml(classe.nom) + '</h1>' +
          '<p class="text-xs text-gray-500">' + escapeHtml(classe.cycle_nom) + (classe.annee_scolaire ? ' · ' + escapeHtml(classe.annee_scolaire) : '') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap-2 flex-wrap">' +
        '<button class="btn btn-primary" onclick="openNotesForClasse(' + classeId + ', ' + periodeId + ')">Saisir les notes</button>' +
        '<a href="#/inscription" class="btn btn-secondary">Inscrire un étudiant</a>' +
        '<button class="btn btn-secondary" onclick="exportClasseSummary(' + classeId + ', ' + periodeId + ', \'csv\')">Export CSV</button>' +
        '<button class="btn btn-secondary" onclick="exportClasseSummary(' + classeId + ', ' + periodeId + ', \'xls\')">Export Excel</button>' +
      '</div>' +
    '</div>' +

    '<div class="grid grid-cols-4 gap-4 mb-5">' +
      '<div class="card p-4"><div class="text-xs text-gray-400 uppercase tracking-wider">Étudiants</div><div class="text-2xl font-bold text-gray-800">' + classe.nb_eleves + '</div></div>' +
      '<div class="card p-4"><div class="text-xs text-gray-400 uppercase tracking-wider">Matières</div><div class="text-2xl font-bold text-gray-800">' + subjects.length + '</div></div>' +
      '<div class="card p-4"><div class="text-xs text-gray-400 uppercase tracking-wider">Total coefficients</div><div class="text-2xl font-bold text-gray-800">' + gradeFormat(totalCoef, 1) + '</div></div>' +
      '<div class="card p-4"><div class="text-xs text-gray-400 uppercase tracking-wider">Style effectif</div><div class="text-sm font-bold text-indigo-700 mt-1">' + escapeHtml(style ? style.nom : '—') + '</div></div>' +
    '</div>' +

    '<div class="card p-4 mb-5">' +
      '<div class="toolbar">' +
        '<div><label class="form-label">Période</label><select id="c-periode" class="form-input">' + periodeOptions + '</select></div>' +
        '<div><label class="form-label">Rechercher</label><input type="text" id="c-search" class="form-input" placeholder="Nom ou matricule…" value="' + escapeHtml(_classeView.search) + '"></div>' +
        '<div><label class="form-label">Trier par</label>' +
          '<select id="c-sort" class="form-input">' +
            '<option value="rang"' + (_classeView.sort === 'rang' ? ' selected' : '') + '>Rang</option>' +
            '<option value="nom"' + (_classeView.sort === 'nom' ? ' selected' : '') + '>Nom A → Z</option>' +
            '<option value="nom_desc"' + (_classeView.sort === 'nom_desc' ? ' selected' : '') + '>Nom Z → A</option>' +
            '<option value="moyenne_desc"' + (_classeView.sort === 'moyenne_desc' ? ' selected' : '') + '>Moyenne décroissante</option>' +
            '<option value="moyenne_asc"' + (_classeView.sort === 'moyenne_asc' ? ' selected' : '') + '>Moyenne croissante</option>' +
            '<option value="matricule"' + (_classeView.sort === 'matricule' ? ' selected' : '') + '>Matricule</option>' +
          '</select>' +
        '</div>' +
        '<div><label class="form-label">Mention</label>' +
          '<select id="c-mention" class="form-input">' +
            '<option value="">Toutes</option>' +
            ['Excellent', 'Très bien', 'Bien', 'Assez bien', 'Passable', 'Insuffisant', '—'].map(function(m) {
              return '<option value="' + m + '"' + (_classeView.mention === m ? ' selected' : '') + '>' +
                (m === '—' ? 'Sans notes' : m) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        (admin
          ? '<div><label class="form-label">Style de la classe</label>' +
              '<select id="c-style" class="form-input">' + styleOptions + '</select></div>'
          : '') +
      '</div>' +
    '</div>' +

    '<div class="card mb-5">' +
      '<div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">' +
        '<span class="font-semibold text-gray-700">Matières de la classe</span>' +
        (admin ? '<button class="btn btn-sm btn-secondary" onclick="openClasseMatieresModal(' + classeId + ')">Gérer les matières</button>' : '') +
      '</div>' +
      '<table>' +
        '<thead><tr><th>Matière</th><th>Coefficient</th><th></th></tr></thead>' +
        '<tbody>' + (subjectRows || '<tr><td colspan="3" class="empty-state">Aucune matière. Ajoutez-en pour saisir des notes.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>' +

    '<div class="card">' +
      '<div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">' +
        '<span class="font-semibold text-gray-700">Étudiants et résultats</span>' +
        '<span class="text-xs text-gray-400" id="c-count"></span>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<table class="table-compact">' +
          '<thead><tr>' +
            '<th>Matricule</th><th>Nom</th><th>Sexe</th><th>Notes</th>' +
            '<th>Moyenne</th><th>Rang</th><th>Mention</th><th></th>' +
          '</tr></thead>' +
          '<tbody id="c-tbody"></tbody>' +
        '</table>' +
      '</div>' +
    '</div>';

  function refresh() {
    _classeView.periodeId = Number(document.getElementById('c-periode').value);
    _classeView.search = document.getElementById('c-search').value.trim();
    _classeView.sort = document.getElementById('c-sort').value;
    _classeView.mention = document.getElementById('c-mention').value;
    renderClasseStudents(classeId, _classeView.periodeId);
  }

  document.getElementById('c-periode').addEventListener('change', refresh);
  document.getElementById('c-search').addEventListener('input', refresh);
  document.getElementById('c-sort').addEventListener('change', refresh);
  document.getElementById('c-mention').addEventListener('change', refresh);
  var styleSel = document.getElementById('c-style');
  if (styleSel) {
    styleSel.addEventListener('change', function() {
      setClasseStyle(classeId, this.value ? Number(this.value) : null);
    });
  }

  renderClasseStudents(classeId, periodeId);
}

function renderClasseStudents(classeId, periodeId) {
  var cr = dbGetClassResults(classeId, periodeId);
  if (!cr) return;

  var results = cr.results.slice();
  var search = (_classeView.search || '').toLowerCase();
  if (search) {
    results = results.filter(function(r) {
      return (r.eleve.nom + ' ' + r.eleve.prenom + ' ' + (r.eleve.matricule || '')).toLowerCase().indexOf(search) !== -1;
    });
  }
  if (_classeView.mention) {
    results = results.filter(function(r) {
      var m = r.saisies > 0 ? gradeMention(r.moyenne_generale, cr.note_max) : '—';
      return m === _classeView.mention;
    });
  }

  var sort = _classeView.sort || 'rang';
  results.sort(function(a, b) {
    if (sort === 'moyenne_desc' || sort === 'moyenne_asc') {
      var am = a.saisies > 0 ? a.moyenne_generale : null;
      var bm = b.saisies > 0 ? b.moyenne_generale : null;
      if (am === null && bm === null) return (a.eleve.nom + ' ' + a.eleve.prenom).localeCompare(b.eleve.nom + ' ' + b.eleve.prenom);
      if (am === null) return 1;
      if (bm === null) return -1;
      return sort === 'moyenne_desc' ? bm - am : am - bm;
    }
    if (sort === 'rang') {
      var ar = a.rang === null ? 999999 : a.rang;
      var br = b.rang === null ? 999999 : b.rang;
      if (ar !== br) return ar - br;
      return (a.eleve.nom + ' ' + a.eleve.prenom).localeCompare(b.eleve.nom + ' ' + b.eleve.prenom);
    }
    if (sort === 'matricule') return String(a.eleve.matricule || '').localeCompare(String(b.eleve.matricule || ''));
    if (sort === 'nom_desc') return (b.eleve.nom + ' ' + b.eleve.prenom).localeCompare(a.eleve.nom + ' ' + a.eleve.prenom);
    return (a.eleve.nom + ' ' + a.eleve.prenom).localeCompare(b.eleve.nom + ' ' + b.eleve.prenom);
  });

  var rows = results.map(function(r) {
    var has = r.saisies > 0;
    var mention = has ? gradeMention(r.moyenne_generale, cr.note_max) : '—';
    return '<tr>' +
      '<td class="font-mono text-xs text-gray-500">' + escapeHtml(r.eleve.matricule) + '</td>' +
      '<td class="font-medium">' + escapeHtml(r.eleve.prenom + ' ' + r.eleve.nom) + '</td>' +
      '<td class="text-xs text-gray-500">' + escapeHtml(r.eleve.sexe || '—') + '</td>' +
      '<td class="text-xs text-gray-500">' + r.saisies + ' / ' + r.total_notes + '</td>' +
      '<td class="font-semibold ' + (has ? 'text-indigo-700' : 'text-gray-400') + '">' + (has ? gradeFormat(r.moyenne_generale) : '—') + '</td>' +
      '<td>' + (r.rang === null ? '—' : r.rang) + '</td>' +
      '<td><span class="' + gradeMentionClass(mention) + '">' + mention + '</span></td>' +
      '<td><a href="#/eleve/' + r.eleve.id + '" class="btn btn-sm btn-secondary">Fiche</a></td>' +
    '</tr>';
  }).join('');

  var tbody = document.getElementById('c-tbody');
  if (tbody) {
    tbody.innerHTML = rows || '<tr><td colspan="8" class="empty-state">Aucun étudiant ne correspond aux filtres.</td></tr>';
  }
  var count = document.getElementById('c-count');
  if (count) count.textContent = results.length + ' étudiant(s) affiché(s)';
}

function openNotesForClasse(classeId, periodeId) {
  _notesPrefill = { classe_id: classeId, periode_id: periodeId };
  routerNavigate('/notes');
}

async function setClasseStyle(classeId, styleId) {
  try {
    await dbSetClasseStyle(classeId, styleId);
    showToast('Style de la classe mis à jour', 'success');
    renderClasseDetail({ id: classeId });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openClasseMatieresModal(classeId) {
  var matieres = dbGetAllMatieres();
  var current = dbGetClasseMatieresWithDetails(classeId);
  var checked = {};
  for (var i = 0; i < current.length; i++) checked[current[i].matiere_id] = current[i];

  if (!matieres.length) {
    showModal(
      '<h2 class="text-lg font-bold text-gray-800 mb-4">Matières de la classe</h2>' +
      '<p class="text-sm text-gray-500 mb-4">Aucune matière dans le catalogue. Créez-en d\'abord.</p>' +
      '<div class="flex justify-end gap-3">' +
        '<button class="btn btn-secondary" onclick="hideModal()">Fermer</button>' +
        '<a href="#/matieres" class="btn btn-primary" onclick="hideModal()">Gérer les matières</a>' +
      '</div>'
    );
    return;
  }

  var list = matieres.map(function(m) {
    var isChecked = !!checked[m.id];
    return '<label class="check-row">' +
      '<input type="checkbox" name="matiere" value="' + m.id + '"' + (isChecked ? ' checked' : '') + '>' +
      '<span class="font-medium">' + escapeHtml(m.nom) + '</span>' +
      '<span class="chip chip-indigo ml-auto">Coef. ' + m.coefficient + '</span>' +
    '</label>';
  }).join('');

  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-1">Matières de la classe</h2>' +
    '<p class="text-xs text-gray-500 mb-4">Cochez les matières étudiées dans cette classe. Une même matière peut être choisie avec un autre coefficient.</p>' +
    '<form id="classe-matieres-form">' +
      '<div class="check-list">' + list + '</div>' +
      '<div class="flex justify-end gap-3 pt-4">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">Enregistrer</button>' +
      '</div>' +
    '</form>',
    620
  );

  document.getElementById('classe-matieres-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var boxes = document.querySelectorAll('#classe-matieres-form input[name="matiere"]');
    var selected = [];
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].checked) selected.push(Number(boxes[i].value));
    }

    var removedWithNotes = 0;
    for (var mid in checked) {
      if (!checked.hasOwnProperty(mid)) continue;
      var stillSelected = selected.indexOf(Number(mid)) !== -1;
      if (!stillSelected) {
        var notes = dbCountNotesForClasseMatiere(checked[mid].id);
        if (notes > 0) removedWithNotes++;
      }
    }
    if (removedWithNotes > 0) {
      var ok = await showConfirm('Certaines matières retirées contiennent des notes. Ces notes seront définitivement effacées. Continuer ?');
      if (!ok) return;
    }

    try {
      await dbSetClasseMatieres(classeId, selected);
      hideModal();
      showToast('Matières de la classe mises à jour', 'success');
      renderClasseDetail({ id: classeId });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function removeClasseMatiere(classeId, matiereId) {
  var notes = 0;
  var subjects = dbGetClasseMatieresWithDetails(classeId);
  for (var i = 0; i < subjects.length; i++) {
    if (subjects[i].matiere_id === matiereId) {
      notes = dbCountNotesForClasseMatiere(subjects[i].id);
      break;
    }
  }
  var msg = 'Retirer cette matière de la classe ?' + (notes > 0 ? ' Les ' + notes + ' note(s) associée(s) seront effacées.' : '');
  var ok = await showConfirm(msg);
  if (!ok) return;
  try {
    await dbRemoveMatiereFromClasse(classeId, matiereId);
    showToast('Matière retirée de la classe', 'success');
    renderClasseDetail({ id: classeId });
  } catch (err) {
    showToast(err.message, 'error');
  }
}
