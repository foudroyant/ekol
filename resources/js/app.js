Neutralino.init();

Neutralino.events.on('windowClose', function() {
  Neutralino.app.exit();
});

var _currency = 'FCFA';

function escapeHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' ' + _currency;
}

function setCurrency(code) {
  _currency = code || 'FCFA';
}

function showToast(message, type) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#dc2626' : '#16a34a';
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() { toast.classList.add('hidden'); }, 3000);
}

function showModal(htmlContent, width) {
  var m = document.getElementById('modal');
  m.style.width = (width || 500) + 'px';
  m.innerHTML = htmlContent;
  m.classList.remove('hidden');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-overlay').addEventListener('click', hideModal);

// ─── Confirm dialog ──────────────────────────────────────────────────────────

function showConfirm(msg) {
  return new Promise(function(resolve) {
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-modal').classList.remove('hidden');
    document.getElementById('confirm-overlay').classList.remove('hidden');

    function cleanup(result) {
      document.getElementById('confirm-modal').classList.add('hidden');
      document.getElementById('confirm-overlay').classList.add('hidden');
      resolve(result);
    }

    document.getElementById('confirm-ok').onclick = function() { cleanup(true); };
    document.getElementById('confirm-cancel').onclick = function() { cleanup(false); };
    document.getElementById('confirm-overlay').onclick = function() { cleanup(false); };
  });
}

// ─── About / Credits ──────────────────────────────────────────────────────────

function showAbout() {
  showModal(
    '<div class="text-center">' +
      '<div class="text-2xl font-extrabold text-indigo-900 mb-1">Bambyno Studio App</div>' +
      '<div class="text-sm text-gray-500 mb-5">Studio de création d\'applications sur mesure</div>' +
      '<div class="border-t border-gray-100 pt-4 space-y-2 text-sm text-gray-700">' +
        '<p>Créé par <span class="font-semibold">Stéphane Bamby Bazebibouta</span></p>' +
        '<p><a href="mailto:stephanebazebibouta@gmail.com" class="text-indigo-600 hover:underline">stephanebazebibouta@gmail.com</a></p>' +
        '<p class="font-medium text-indigo-700">WhatsApp : +242 06 483 76 37</p>' +
      '</div>' +
      '<div class="mt-4 text-xs text-gray-400">Ekol v1.1.0 — notes, styles de notation et établissements</div>' +
      '<div class="mt-6 pt-4 border-t border-gray-100">' +
        '<button class="btn btn-primary" onclick="hideModal()">Fermer</button>' +
      '</div>' +
    '</div>'
  );
}

// ─── Paramètres ───────────────────────────────────────────────────────────────

function renderParametres() {
  var org = dbGetOrganizationById(currentOrgId) || {};
  var current = dbGetCurrency();
  var noteMax = dbGetNoteMax();
  var missingZero = dbGetMissingAsZero();
  var periodes = dbGetAllPeriodes();
  var admin = canManage();

  var periodeRows = periodes.map(function(p) {
    return '<tr>' +
      '<td class="font-medium">' + escapeHtml(p.nom) + '</td>' +
      '<td>' + (p.ordre === null ? '—' : p.ordre) + '</td>' +
      '<td class="text-xs text-gray-500">' + escapeHtml(p.annee_scolaire || '—') + '</td>' +
      '<td class="text-right">' +
        (admin
          ? '<div class="flex gap-2 justify-end">' +
              '<button class="btn btn-sm btn-secondary" onclick="openPeriodeModal(' + p.id + ')">Renommer</button>' +
              '<button class="btn btn-sm btn-danger" onclick="confirmDeletePeriode(' + p.id + ')">Supprimer</button>' +
            '</div>'
          : '') +
      '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<h1 class="page-title">Paramètres</h1>' +

    '<div class="grid grid-cols-2 gap-5 mb-5">' +
      '<div class="card p-6">' +
        '<h2 class="font-semibold text-gray-700 mb-4">Établissement</h2>' +
        (admin
          ? '<form id="org-info-form" class="space-y-3">' +
              '<div><label class="form-label">Nom</label><input type="text" name="nom" value="' + escapeHtml(org.nom || '') + '" required class="form-input"></div>' +
              '<div><label class="form-label">Adresse</label><input type="text" name="adresse" value="' + escapeHtml(org.adresse || '') + '" class="form-input"></div>' +
              '<div class="grid grid-cols-2 gap-3">' +
                '<div><label class="form-label">Téléphone</label><input type="text" name="telephone" value="' + escapeHtml(org.telephone || '') + '" class="form-input"></div>' +
                '<div><label class="form-label">Email</label><input type="email" name="email" value="' + escapeHtml(org.email || '') + '" class="form-input"></div>' +
              '</div>' +
              '<button type="submit" class="btn btn-primary">Enregistrer</button>' +
            '</form>'
          : '<div class="text-sm text-gray-600 space-y-1">' +
              '<div class="font-medium text-gray-800">' + escapeHtml(org.nom || '—') + '</div>' +
              '<div>' + escapeHtml(org.adresse || '') + '</div>' +
              '<div>' + escapeHtml(org.telephone || '') + '</div>' +
              '<div>' + escapeHtml(org.email || '') + '</div>' +
            '</div>') +
      '</div>' +

      '<div class="card p-6">' +
        '<h2 class="font-semibold text-gray-700 mb-4">Notation & monnaie</h2>' +
        (admin
          ? '<form id="grading-form" class="space-y-4">' +
              '<div class="grid grid-cols-2 gap-3">' +
                '<div>' +
                  '<label class="form-label">Barème</label>' +
                  '<input type="number" id="sel-note-max" value="' + noteMax + '" min="1" step="1" class="form-input">' +
                  '<p class="text-xs text-gray-400 mt-1">Notes sur /' + noteMax + ' par défaut.</p>' +
                '</div>' +
                '<div>' +
                  '<label class="form-label">Monnaie</label>' +
                  '<select id="sel-currency" class="form-input">' +
                    ['FCFA', 'XAF', 'XOF', 'EUR', 'USD', 'GBP', 'NGN'].map(function(c) {
                      return '<option value="' + c + '"' + (current === c ? ' selected' : '') + '>' + c + '</option>';
                    }).join('') +
                  '</select>' +
                '</div>' +
              '</div>' +
              '<label class="check-row">' +
                '<input type="checkbox" id="sel-missing-zero"' + (missingZero ? ' checked' : '') + '>' +
                '<span>Une note absente compte 0 dans la moyenne</span>' +
              '</label>' +
              '<button type="submit" class="btn btn-primary">Enregistrer</button>' +
            '</form>'
          : '<div class="text-sm text-gray-600 space-y-1">' +
              '<div>Barème : /' + noteMax + '</div>' +
              '<div>Monnaie : ' + escapeHtml(current) + '</div>' +
              '<div>Notes absentes : ' + (missingZero ? 'comptées 0' : 'ignorées') + '</div>' +
            '</div>') +
      '</div>' +
    '</div>' +

    '<div class="card mb-5">' +
      '<div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">' +
        '<div>' +
          '<div class="font-semibold text-gray-700">Périodes d\'évaluation</div>' +
          '<div class="text-xs text-gray-400">Séquences, trimestres, semestres… renommez-les librement.</div>' +
        '</div>' +
        (admin ? '<button class="btn btn-sm btn-primary" onclick="openPeriodeModal(0)">+ Ajouter</button>' : '') +
      '</div>' +
      '<table>' +
        '<thead><tr><th>Nom</th><th>Ordre</th><th>Année scolaire</th><th></th></tr></thead>' +
        '<tbody>' + (periodeRows || '<tr><td colspan="4" class="empty-state">Aucune période. Créez-en une pour saisir des notes.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>' +

    '<div class="grid grid-cols-2 gap-5">' +
      '<div class="card p-6">' +
        '<h2 class="font-semibold text-gray-700 mb-4">Sauvegarde</h2>' +
        (isSuperAdmin()
          ? '<p class="text-sm text-gray-500 mb-4">Exportez toute la base (tous établissements) ou restaurez un fichier .db existant.</p>' +
            '<div class="flex gap-3">' +
              '<button class="btn btn-primary" onclick="exportBackup()">📤 Exporter</button>' +
              '<button class="btn btn-secondary" onclick="importBackup()">📥 Importer</button>' +
            '</div>'
          : '<p class="text-sm text-gray-500">La sauvegarde complète est réservée au super administrateur. Utilisez les exports CSV/Excel pour vos données.</p>') +
      '</div>' +
      '<div class="card p-6">' +
        '<h2 class="font-semibold text-gray-700 mb-4">Raccourcis</h2>' +
        '<div class="flex flex-wrap gap-2">' +
          '<a href="#/styles" class="btn btn-secondary">Styles de notation</a>' +
          '<a href="#/matieres" class="btn btn-secondary">Matières</a>' +
          (canManage() ? '<a href="#/utilisateurs" class="btn btn-secondary">Utilisateurs</a>' : '') +
          (isSuperAdmin() ? '<a href="#/organisations" class="btn btn-secondary">Établissements</a>' : '') +
        '</div>' +
      '</div>' +
    '</div>';

  if (admin) {
    document.getElementById('org-info-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var nom = (fd.get('nom') || '').trim();
      if (!nom) { showToast('Le nom est obligatoire', 'error'); return; }
      try {
        await dbUpdateOrganization(currentOrgId, {
          nom: nom,
          adresse: (fd.get('adresse') || '').trim() || null,
          telephone: (fd.get('telephone') || '').trim() || null,
          email: (fd.get('email') || '').trim() || null
        });
        showToast('Établissement mis à jour', 'success');
        applyRoleUI();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('grading-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var max = parseFloat(document.getElementById('sel-note-max').value);
      if (isNaN(max) || max <= 0) { showToast('Barème invalide', 'error'); return; }
      var currency = document.getElementById('sel-currency').value;
      var missing = document.getElementById('sel-missing-zero').checked ? '1' : '0';
      try {
        await dbSetOrgSetting('note_max', max);
        await dbSetOrgSetting('notes_manquantes_zero', missing);
        await dbSetCurrency(currency);
        setCurrency(currency);
        showToast('Paramètres de notation enregistrés', 'success');
        renderParametres();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

function openPeriodeModal(id) {
  var p = id ? dbGetPeriodeById(id) : null;
  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-5">' + (p ? 'Modifier la période' : 'Nouvelle période') + '</h2>' +
    '<form id="periode-form" class="space-y-4">' +
      '<input type="hidden" name="id" value="' + (p ? p.id : '') + '">' +
      '<div>' +
        '<label class="form-label">Nom *</label>' +
        '<input type="text" name="nom" value="' + (p ? escapeHtml(p.nom) : '') + '" required class="form-input" placeholder="ex: Séquence 1, Trimestre 1, Semestre 1">' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-4">' +
        '<div>' +
          '<label class="form-label">Ordre</label>' +
          '<input type="number" name="ordre" value="' + (p && p.ordre !== null ? p.ordre : '') + '" min="1" class="form-input" placeholder="1, 2, 3…">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Année scolaire</label>' +
          '<input type="text" name="annee_scolaire" value="' + (p ? escapeHtml(p.annee_scolaire || '') : '') + '" class="form-input" placeholder="ex: 2026-2027">' +
        '</div>' +
      '</div>' +
      '<div class="flex justify-end gap-3 pt-2">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">' + (p ? 'Enregistrer' : 'Créer') + '</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('periode-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var nom = (fd.get('nom') || '').trim();
    if (!nom) { showToast('Le nom est obligatoire', 'error'); return; }
    var ordre = fd.get('ordre') ? parseInt(fd.get('ordre')) : null;
    var annee = (fd.get('annee_scolaire') || '').trim() || null;
    try {
      if (p) {
        await dbUpdatePeriode(p.id, nom, ordre, annee);
      } else {
        await dbCreatePeriode(nom, ordre, annee);
      }
      hideModal();
      showToast('Période enregistrée', 'success');
      renderParametres();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function confirmDeletePeriode(id) {
  var p = dbGetPeriodeById(id);
  if (!p) return;
  var ok = await showConfirm('Supprimer la période "' + p.nom + '" ?');
  if (!ok) return;
  try {
    await dbDeletePeriode(id);
    showToast('Période supprimée', 'success');
    renderParametres();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Backup / Sauvegarde ───────────────────────────────────────────────────────

async function exportBackup() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  var h = String(now.getHours()).padStart(2, '0');
  var min = String(now.getMinutes()).padStart(2, '0');
  var s = String(now.getSeconds()).padStart(2, '0');
  var defaultName = 'ekol-backup-' + y + m + d + '-' + h + min + s + '.db';

  try {
    var path = await Neutralino.os.showSaveDialog('Exporter la base de données', {
      filters: [{ name: 'Base de données SQLite', extensions: ['db'] }],
      defaultPath: defaultName
    });
    if (!path) return;

    var data = db.export().buffer;
    await Neutralino.filesystem.writeBinaryFile(path, data);
    showToast('Sauvegarde exportée avec succès', 'success');
  } catch (err) {
    showToast('Erreur lors de l\'export : ' + err.message, 'error');
  }
}

async function importBackup() {
  try {
    var paths = await Neutralino.os.showOpenDialog('Importer une sauvegarde', {
      filters: [{ name: 'Base de données SQLite', extensions: ['db'] }],
      multiSelections: false
    });
    if (!paths || paths.length === 0) return;

    var confirmed = await showConfirm(
      '⚠️ Importer une sauvegarde remplacera TOUTES les données actuelles. Cette action est irréversible. Confirmer ?'
    );
    if (!confirmed) return;

    var buf = await Neutralino.filesystem.readBinaryFile(paths[0]);
    var newDb = new SQL.Database(new Uint8Array(buf));

    try {
      var test = newDb.exec('SELECT count(*) AS cnt FROM cycles');
      if (!test || test.length === 0) throw new Error('Base invalide');
    } catch (e) {
      showToast('Le fichier sélectionné n\'est pas une base Ekol valide', 'error');
      return;
    }

    db = newDb;
    _runSchema();
    await saveDB();
    showToast('Sauvegarde importée. Rechargement…', 'success');
    setTimeout(function() { window.location.reload(); }, 900);
  } catch (err) {
    showToast('Erreur lors de l\'import : ' + err.message, 'error');
  }
}

// ─── Route registration ───────────────────────────────────────────────────────

routerAdd('/dashboard',      renderDashboard);
routerAdd('/cycles',         renderCycles);
routerAdd('/classes',        renderClasses);
routerAdd('/classe/:id',     renderClasseDetail);
routerAdd('/eleves',         renderEleves);
routerAdd('/inscription',    renderInscriptionForm);
routerAdd('/eleve/:id',      renderEleveFiche);
routerAdd('/paiement/:id',   renderPaiement);
routerAdd('/notes',          renderNotes);
routerAdd('/matieres',       renderMatieres);
routerAdd('/styles',         renderStyles);
routerAdd('/recherche',      renderRecherche);
routerAdd('/utilisateurs',   renderUtilisateurs);
routerAdd('/organisations',  renderOrganisations);
routerAdd('/parametres',     renderParametres);

// Boot
window.addEventListener('DOMContentLoaded', async function() {
  document.getElementById('app').innerHTML =
    '<div class="flex flex-col items-center justify-center h-64 text-gray-400 gap-4">' +
      '<img src="/icons/logo.svg" alt="Ekol" class="w-16 h-16 opacity-60">' +
      '<div class="text-sm">Chargement...</div>' +
    '</div>';
  try {
    await initDB();
    await authBoot();
  } catch (err) {
    var screen = document.getElementById('auth-screen');
    screen.classList.remove('hidden');
    screen.innerHTML = '<div class="auth-card"><div class="text-red-600 font-medium">Erreur critique : ' +
      escapeHtml(err.message) + '</div><p class="text-xs text-gray-500 mt-2">Consultez la console pour plus de détails.</p></div>';
    console.error(err);
  }
});
