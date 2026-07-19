Neutralino.init();

Neutralino.events.on('windowClose', function() {
  Neutralino.app.exit();
});

var _currency = 'FCFA';

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

function showModal(htmlContent) {
  var m = document.getElementById('modal');
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
      '<div class="mt-6 pt-4 border-t border-gray-100">' +
        '<button class="btn btn-primary" onclick="hideModal()">Fermer</button>' +
      '</div>' +
    '</div>'
  );
}

// ─── Settings / Paramètres ─────────────────────────────────────────────────────

function renderParametres() {
  var current = dbGetCurrency();

  document.getElementById('app').innerHTML =
    '<h1 class="page-title">Paramètres</h1>' +
    '<div class="card p-6 max-w-lg">' +
      '<h2 class="font-semibold text-gray-700 mb-4">Monnaie générale</h2>' +
      '<p class="text-sm text-gray-500 mb-4">La monnaie utilisée pour tous les montants dans l\'application.</p>' +
      '<select id="sel-currency" class="form-input mb-5">' +
        '<option value="FCFA"' + (current === 'FCFA' ? ' selected' : '') + '>FCFA (Franc CFA - BEAC/UEMOA)</option>' +
        '<option value="XAF"' + (current === 'XAF' ? ' selected' : '') + '>XAF (Franc CFA - BEAC)</option>' +
        '<option value="XOF"' + (current === 'XOF' ? ' selected' : '') + '>XOF (Franc CFA - UEMOA)</option>' +
        '<option value="EUR"' + (current === 'EUR' ? ' selected' : '') + '>EUR (Euro)</option>' +
        '<option value="USD"' + (current === 'USD' ? ' selected' : '') + '>USD (Dollar US)</option>' +
        '<option value="GBP"' + (current === 'GBP' ? ' selected' : '') + '>GBP (Livre sterling)</option>' +
        '<option value="NGN"' + (current === 'NGN' ? ' selected' : '') + '>NGN (Naira nigérian)</option>' +
      '</select>' +
      '<button class="btn btn-primary" onclick="saveCurrency()">Enregistrer</button>' +
    '</div>' +
    '<div class="card p-6 max-w-lg mt-6">' +
      '<h2 class="font-semibold text-gray-700 mb-4">Sauvegarde</h2>' +
      '<p class="text-sm text-gray-500 mb-4">Exportez votre base de données pour créer une sauvegarde, ou importez un fichier .db existant pour restaurer des données.</p>' +
      '<div class="flex gap-3">' +
        '<button class="btn btn-primary" onclick="exportBackup()">📤 Exporter</button>' +
        '<button class="btn btn-secondary" onclick="importBackup()">📥 Importer</button>' +
      '</div>' +
    '</div>';
}

async function saveCurrency() {
  var code = document.getElementById('sel-currency').value;
  await dbSetCurrency(code);
  setCurrency(code);
  showToast('Monnaie mise à jour : ' + code, 'success');
  renderParametres();
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

    // Valider que c'est bien une base Ekol
    try {
      var test = newDb.exec("SELECT count(*) AS cnt FROM cycles");
      if (!test || test.length === 0) throw new Error('Base invalide');
    } catch (e) {
      showToast('Le fichier sélectionné n\'est pas une base Ekol valide', 'error');
      return;
    }

    db = newDb;
    await saveDB();
    setCurrency(dbGetCurrency());
    showToast('Sauvegarde importée avec succès', 'success');
    routerNavigate('/dashboard');
  } catch (err) {
    showToast('Erreur lors de l\'import : ' + err.message, 'error');
  }
}

// ─── Route registration
routerAdd('/dashboard',      renderDashboard);
routerAdd('/cycles',         renderCycles);
routerAdd('/classes',        renderClasses);
routerAdd('/eleves',         renderEleves);
routerAdd('/inscription',    renderInscriptionForm);
routerAdd('/eleve/:id',      renderEleveFiche);
routerAdd('/paiement/:id',   renderPaiement);
routerAdd('/recherche',      renderRecherche);
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
    setCurrency(dbGetCurrency());
    router.init();
  } catch (err) {
    document.getElementById('app').innerHTML =
      '<div class="p-8 text-red-600 font-medium">Erreur critique : ' + err.message + '</div>';
    console.error(err);
  }
});
