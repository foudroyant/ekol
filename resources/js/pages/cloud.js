// ─── CLOUD — sauvegarde & synchronisation ──────────────────────────────────────
// Abonnement : 25 000 FCFA / an, géré sur le site du cloud.

var _cloudPollTimer = null;

function renderCloud() {
  if (!canManage()) {
    document.getElementById('app').innerHTML =
      '<h1 class="page-title">Cloud</h1>' +
      '<div class="card p-8 text-center text-gray-500">Accès réservé aux administrateurs.</div>';
    return;
  }
  if (_cloudPollTimer) { clearInterval(_cloudPollTimer); _cloudPollTimer = null; }

  var linked = cloudIsLinked();
  var domain = cloudDomain();
  var lastSync = cloudGetSetting('cloud_last_sync_at', '');
  var subActive = cloudGetSetting('cloud_sub_active', '') === '1';
  var subExpires = cloudGetSetting('cloud_sub_expires', '');
  var code = cloudGetSetting('cloud_code', '');

  var statusChip = !linked
    ? '<span class="chip chip-neutral">Non configuré</span>'
    : (_cloudLastStatus && _cloudLastStatus.state === 'synced'
        ? '<span class="chip chip-green">Synchronisé</span>'
        : (_cloudLastStatus && (_cloudLastStatus.state === 'no-sub')
            ? '<span class="chip chip-purple">Sans abonnement</span>'
            : '<span class="chip chip-indigo">À synchroniser</span>'));

  var subBlock = !linked
    ? '<p class="text-sm text-gray-500">Associez d\'abord cet établissement, puis souscrivez sur le site du cloud.</p>'
    : '<div class="text-sm space-y-2">' +
        '<div>Abonnement : ' + (subActive
          ? '<span class="chip chip-green">Actif</span>'
          : '<span class="chip chip-purple">Inactif / expiré</span>') + '</div>' +
        (subExpires ? '<div class="text-gray-500">Expire le ' + escapeHtml(String(subExpires).slice(0, 10)) + '</div>' : '') +
        '<div class="text-gray-500">Dernière synchronisation : ' + (lastSync ? escapeHtml(String(lastSync).slice(0, 16).replace('T', ' ')) : 'jamais') + '</div>' +
      '</div>';

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div>' +
        '<h1 class="page-title mb-1">Cloud <span class="ml-1">' + statusChip + '</span></h1>' +
        '<p class="text-sm text-gray-500">Sauvegarde et synchronisation — <b>25 000 FCFA / an</b> par établissement.</p>' +
      '</div>' +
      '<div class="flex gap-2">' +
        (linked ? '<button class="btn btn-primary" onclick="cloudDoSync()">Synchroniser maintenant</button>' : '') +
        (linked ? '<button class="btn btn-secondary" onclick="cloudDoVerify()">Vérifier</button>' : '') +
      '</div>' +
    '</div>' +

    '<div class="grid grid-cols-2 gap-5 mb-5">' +
      '<div class="card p-6">' +
        '<h2 class="font-semibold text-gray-700 mb-1">Connexion au cloud</h2>' +
        '<p class="text-xs text-gray-400 mb-4">Un domaine par établissement : vous pouvez utiliser plusieurs clouds.</p>' +
        (linked
          ? '<div class="text-sm space-y-2 mb-4">' +
              '<div><span class="text-gray-400">Domaine</span><div class="font-mono text-xs break-all">' + escapeHtml(domain) + '</div></div>' +
              '<div><span class="text-gray-400">Appareil</span><div class="font-medium">' + escapeHtml(cloudGetSetting('cloud_device_email', '')) + '</div></div>' +
            '</div>' +
            (code
              ? '<div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4 text-center">' +
                  '<div class="text-xs text-gray-500 mb-1">Code d\'appairage (15 min) — saisissez-le sur le site du cloud, rubrique Compte</div>' +
                  '<div class="text-2xl font-mono font-bold tracking-widest text-indigo-700">' + escapeHtml(cloudFormatCode(code)) + '</div>' +
                  '<button class="btn btn-sm btn-primary mt-3" onclick="cloudDoPoll()">J\'ai saisi le code — vérifier</button>' +
                '</div>'
              : '') +
            '<div class="flex gap-2 flex-wrap">' +
              '<button class="btn btn-sm btn-secondary" onclick="cloudDoNewCode()">Nouveau code</button>' +
              '<button class="btn btn-sm btn-danger" onclick="cloudDoUnlink()">Dissocier cet appareil</button>' +
            '</div>'
          : '<form id="cloud-link-form" class="space-y-3">' +
              '<div><label class="form-label">Domaine du cloud *</label>' +
                '<input type="url" id="cloud-domain" value="' + escapeHtml(domain) + '" required class="form-input" placeholder="https://ekol-cloud.example.com"></div>' +
              '<div><label class="form-label">Nom de cet appareil *</label>' +
                '<input type="text" id="cloud-device-name" value="Poste secrétariat" required class="form-input"></div>' +
              '<button type="submit" class="btn btn-primary">Générer un code d\'appairage</button>' +
            '</form>') +
      '</div>' +

      '<div class="card p-6">' +
        '<h2 class="font-semibold text-gray-700 mb-4">Abonnement</h2>' +
        '<div class="text-3xl font-black text-gray-800">25 000 <span class="text-lg font-semibold">FCFA / an</span></div>' +
        '<div class="mt-3">' + subBlock + '</div>' +
        (linked && domain
          ? '<a class="btn btn-secondary mt-4" href="#" onclick="return cloudOpenSite(\'' + escapeHtml(domain).replace(/'/g, '%27') + '\')">Ouvrir le site du cloud</a>'
          : '') +
      '</div>' +
    '</div>' +

    (linked
      ? '<div class="card p-6 mb-5">' +
          '<h2 class="font-semibold text-gray-700 mb-1">Sauvegarde &amp; restauration</h2>' +
          '<p class="text-xs text-gray-400 mb-4">La synchronisation envoie un instantané vérifié (checksum SHA-256) + 3 exports CSV. La restauration remplace les données de l\'établissement courant.</p>' +
          '<div class="flex gap-2 flex-wrap">' +
            '<button class="btn btn-secondary" onclick="cloudDoListBackups()">Voir les sauvegardes</button>' +
            '<label class="btn btn-secondary" style="cursor:pointer">Restaurer depuis un fichier<input type="file" id="cloud-restore-file" accept="application/json,.json" class="hidden" onchange="cloudDoRestoreFile(this)"></label>' +
          '</div>' +
          '<div id="cloud-backups"></div>' +
        '</div>' +

        '<div class="card p-6">' +
          '<h2 class="font-semibold text-gray-700 mb-1">Exports CSV locaux</h2>' +
          '<p class="text-xs text-gray-400 mb-4">Les mêmes fichiers sont envoyés au cloud à chaque synchronisation et téléchargeables depuis le site.</p>' +
          '<div class="flex gap-2 flex-wrap">' +
            '<button class="btn btn-secondary" onclick="cloudDoLocalCsv(\'eleves\')">Élèves CSV</button>' +
            '<button class="btn btn-secondary" onclick="cloudDoLocalCsv(\'notes\')">Notes CSV</button>' +
            '<button class="btn btn-secondary" onclick="cloudDoLocalCsv(\'paiements\')">Paiements CSV</button>' +
          '</div>' +
        '</div>'
      : '');

  var form = document.getElementById('cloud-link-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      cloudDoRegister();
    });
  }
  if (linked && code) cloudStartPolling();
  if (linked) cloudRefreshStatus();
}

function cloudOpenSite(url) {
  if (typeof Neutralino !== 'undefined' && Neutralino.os && Neutralino.os.open) {
    Neutralino.os.open(url).catch(function() {
      showToast('Ouvrez manuellement : ' + url, 'error');
    });
  }
  return false;
}

async function cloudDoRegister() {
  var domain = document.getElementById('cloud-domain').value.trim().replace(/\/+$/, '');
  var name = document.getElementById('cloud-device-name').value.trim() || 'Poste local';
  if (!domain) { showToast('Renseignez le domaine du cloud', 'error'); return; }
  try {
    await cloudSetSetting('cloud_url', domain);
    var code = await cloudRegister(name);
    showToast('Code généré : ' + cloudFormatCode(code), 'success');
    renderCloud();
  } catch (err) {
    showToast(cloudErrorMessage(err), 'error');
  }
}

async function cloudDoNewCode() {
  try {
    var org = dbGetOrganizationById(currentOrgId) || {};
    var email = 'd-' + _cloudHex(6) + '@ekol-device.local';
    var secret = _cloudHex(16);
    await cloudDeviceAuth().catch(function() {});
    var dev = await cloudApi('/collections/devices/records', {
      method: 'POST', token: null, retry: false,
      body: { email: email, password: secret, passwordConfirm: secret,
        device_name: 'Poste local', org_name: org.nom || '',
        app_version: (typeof NL_APPVERSION !== 'undefined' ? NL_APPVERSION : 'dev') }
    });
    var code = cloudNewCode();
    await cloudApi('/collections/pairing_codes/records', {
      method: 'POST', token: null, retry: false,
      body: { id: code, device: dev.id, status: 'pending',
        expires_at: new Date(Date.now() + CLOUD_PAIRING_TTL_MIN * 60000).toISOString() }
    });
    await cloudSetSetting('cloud_device_email', email);
    await cloudSetSetting('cloud_device_secret', secret);
    await cloudSetSetting('cloud_device_id', dev.id);
    await cloudSetSetting('cloud_code', code);
    showToast('Nouveau code : ' + cloudFormatCode(code), 'success');
    renderCloud();
  } catch (err) {
    showToast(cloudErrorMessage(err), 'error');
  }
}

function cloudStartPolling() {
  if (_cloudPollTimer) clearInterval(_cloudPollTimer);
  _cloudPollTimer = setInterval(function() {
    cloudDoPoll(true);
  }, 5000);
}

async function cloudDoPoll(silent) {
  var code = cloudGetSetting('cloud_code', '');
  if (!code) {
    if (_cloudPollTimer) { clearInterval(_cloudPollTimer); _cloudPollTimer = null; }
    return;
  }
  try {
    var status = await cloudCheckClaim(code);
    if (status === 'claimed') {
      if (_cloudPollTimer) { clearInterval(_cloudPollTimer); _cloudPollTimer = null; }
      showToast('Appareil associé au compte cloud', 'success');
      renderCloud();
    } else if (!silent) {
      showToast('Code en attente — saisissez-le sur le site du cloud', 'success');
    }
  } catch (err) {
    if (!silent) showToast(cloudErrorMessage(err), 'error');
  }
}

async function cloudDoUnlink() {
  var ok = await showConfirm('Dissocier cet appareil du cloud ? Les sauvegardes restent disponibles sur le site.');
  if (!ok) return;
  try {
    await cloudUnlink();
    showToast('Appareil dissocié', 'success');
    renderCloud();
  } catch (err) {
    showToast(cloudErrorMessage(err), 'error');
  }
}

async function cloudDoSync() {
  showToast('Synchronisation en cours…', 'success');
  try {
    var backup = await cloudSyncNow('');
    showToast('Synchronisé le ' + String(backup.created).slice(0, 16).replace('T', ' '), 'success');
    renderCloud();
  } catch (err) {
    showToast(cloudErrorMessage(err), 'error');
  }
}

async function cloudDoVerify() {
  try {
    var st = await cloudVerify();
    var label = cloudStatusLabel(st);
    if (!label) { showToast('État inconnu', 'error'); return; }
    showToast(label.text, label.level === 'error' ? 'error' : 'success');
    _cloudLastStatus = st;
    renderCloud();
  } catch (err) {
    showToast(cloudErrorMessage(err), 'error');
  }
}

async function cloudRefreshStatus() {
  try {
    _cloudLastStatus = await cloudVerify();
  } catch (e) { /* affiché à la prochaine visite */ }
}

async function cloudDoListBackups() {
  var box = document.getElementById('cloud-backups');
  if (!box) return;
  box.innerHTML = '<p class="text-sm text-gray-400 mt-3">Chargement…</p>';
  try {
    var latest = null;
    var res = await (async function() {
      await cloudDeviceAuth();
      var id = cloudGetSetting('cloud_device_id', '');
      return cloudApi('/collections/backups/records?filter=' + encodeURIComponent("device = '" + id + "'") + '&sort=-created&perPage=10', {});
    })();
    if (!res.items.length) {
      box.innerHTML = '<p class="text-sm text-gray-400 mt-3">Aucune sauvegarde pour cet appareil.</p>';
      return;
    }
    box.innerHTML = '<table class="mt-3"><thead><tr><th>Date</th><th>Checksum</th><th>Contenu</th><th></th></tr></thead><tbody>' +
      res.items.map(function(b) {
        return '<tr><td class="text-xs">' + escapeHtml(String(b.created).slice(0, 16).replace('T', ' ')) + '</td>' +
          '<td class="font-mono text-xs">' + escapeHtml(String(b.checksum || '').slice(0, 12)) + '…</td>' +
          '<td class="text-xs text-gray-500">' + escapeHtml(JSON.stringify(b.counts || {})) + '</td>' +
          '<td><button class="btn btn-sm btn-secondary" onclick="cloudDoRestoreCloud(\'' + b.id + '\')">Restaurer</button></td></tr>';
      }).join('') + '</tbody></table>';
  } catch (err) {
    box.innerHTML = '<p class="text-sm text-red-600 mt-3">' + escapeHtml(cloudErrorMessage(err)) + '</p>';
  }
}

async function cloudDoRestoreCloud(backupId) {
  var ok = await showConfirm('Restaurer cette sauvegarde ? Les données actuelles de l\'établissement seront REMPLACÉES. Exportez d\'abord si besoin.');
  if (!ok) return;
  var ok2 = await showConfirm('Confirmation finale : écraser les données locales par la sauvegarde cloud ?');
  if (!ok2) return;
  try {
    var snap = await cloudDownloadBackup(backupId);
    await dbRestoreSnapshot(snap);
    showToast('Restauration terminée. Reconnectez-vous.', 'success');
    setTimeout(function() { logout(); }, 800);
  } catch (err) {
    showToast(cloudErrorMessage(err), 'error');
  }
}

async function cloudDoRestoreFile(input) {
  if (!input.files || !input.files.length) return;
  var ok = await showConfirm('Restaurer depuis ce fichier ? Les données actuelles de l\'établissement seront REMPLACÉES.');
  if (!ok) { input.value = ''; return; }
  try {
    var text = await new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { reject(new Error('Lecture impossible.')); };
      reader.readAsText(input.files[0]);
    });
    var snap = JSON.parse(text);
    if (!snap || snap.app !== 'ekol-snapshot' || !snap.tables) throw new Error('Fichier invalide : snapshot Ekol attendu.');
    var checksum = await cloudChecksum(snap);
    var ok2 = await showConfirm('Snapshot du ' + (snap.created_at || '?').slice(0, 16).replace('T', ' ') + ' — ' + (snap.org_name || '') + ' — checksum ' + checksum.slice(0, 12) + '… Confirmer l\'écrasement ?');
    if (!ok2) { input.value = ''; return; }
    await dbRestoreSnapshot(snap);
    showToast('Restauration terminée. Reconnectez-vous.', 'success');
    setTimeout(function() { logout(); }, 800);
  } catch (err) {
    showToast(err.message || 'Restauration impossible.', 'error');
  }
  input.value = '';
}

function cloudDoLocalCsv(kind) {
  var csvs = cloudBuildCSVs();
  for (var i = 0; i < csvs.length; i++) {
    if (csvs[i].kind === kind) {
      var base = 'ekol-' + exportSlug((dbGetOrganizationById(currentOrgId) || {}).nom) + '-' + kind + '-' + exportTimestamp();
      exportSaveText(base + '.csv', csvs[i].content, 'CSV', 'csv');
      return;
    }
  }
}
