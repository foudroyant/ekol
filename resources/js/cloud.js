// ─── CLOUD — sauvegarde & synchronisation (PocketBase) ────────────────────────
// Par établissement : un domaine cloud + une identité d'appareil.
// L'app s'authentifie EN TANT QU'APPAREIL (jamais avec le mot de passe user).
// Abonnement : 25 000 FCFA / an, activé côté cloud après paiement.

var CLOUD_PRICE = 25000;
var CLOUD_CURRENCY = 'FCFA';
var CLOUD_PLAN = 'annuel';
var CLOUD_CHECK_INTERVAL_MS = 15 * 60 * 1000;
var CLOUD_PAIRING_TTL_MIN = 15;

var _cloudToken = null;
var _cloudDirty = false;
var _cloudTimer = null;
var _cloudLastStatus = null;

function _cloudHex(nBytes) {
  var bytes = new Uint8Array(nBytes);
  crypto.getRandomValues(bytes);
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += ('0' + bytes[i].toString(16)).slice(-2);
  return out;
}

function cloudGetSetting(key, fallback) {
  var v = dbGetOrgSetting(key, fallback === undefined ? null : fallback);
  return (v === null || v === undefined || v === '') ? (fallback === undefined ? null : fallback) : v;
}

async function cloudSetSetting(key, value) {
  await dbSetOrgSetting(key, value === null || value === undefined ? '' : String(value));
}

function cloudDomain() {
  var u = cloudGetSetting('cloud_url', '');
  return (u || '').trim().replace(/\/+$/, '');
}

function cloudIsLinked() {
  return !!(cloudDomain() && cloudGetSetting('cloud_device_email', '') && cloudGetSetting('cloud_device_secret', ''));
}

function cloudNewCode() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  var out = '';
  for (var i = 0; i < bytes.length && out.length < 15; i++) {
    out += chars[bytes[i] % chars.length];
  }
  while (out.length < 15) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function cloudFormatCode(code) {
  var c = String(code || '').toUpperCase();
  return c.slice(0, 5) + '-' + c.slice(5, 10) + '-' + c.slice(10, 15);
}

function cloudErrorMessage(err, fallback) {
  var m = (err && err.message) ? err.message : String(err || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
    return 'Cloud injoignable. Vérifiez le domaine et votre connexion.';
  }
  return m || fallback || 'Erreur cloud inconnue.';
}

// ─── Client HTTP PocketBase ────────────────────────────────────────────────

async function cloudApi(path, opts) {
  opts = opts || {};
  var domain = cloudDomain();
  if (!domain) throw new Error('Aucun domaine cloud configuré.');
  var headers = opts.headers || {};
  var token = opts.token !== undefined ? opts.token : _cloudToken;
  if (token) headers['Authorization'] = token;
  var body = opts.body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  var res = await fetch(domain + '/api' + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: (body === undefined || body === null) ? undefined : body
  });
  var text = await res.text();
  var data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (res.status === 401 && opts.retry !== false && cloudIsLinked()) {
    _cloudToken = null;
    try {
      await cloudDeviceAuth();
      return cloudApi(path, Object.assign({}, opts, { retry: false }));
    } catch (e) { /* propage l'erreur d'origine ci-dessous */ }
  }
  if (!res.ok) {
    var msg = (data && (data.message || (data.data && JSON.stringify(data.data)))) || ('Erreur cloud ' + res.status);
    var err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function cloudDeviceAuth() {
  var email = cloudGetSetting('cloud_device_email', '');
  var secret = cloudGetSetting('cloud_device_secret', '');
  if (!email || !secret) throw new Error('Appareil non enregistré. Générez un code d\'appairage.');
  var res = await cloudApi('/collections/devices/auth-with-password', {
    method: 'POST',
    token: null,
    retry: false,
    body: { identity: email, password: secret }
  });
  _cloudToken = res.token;
  return res;
}

// ─── Appairage ────────────────────────────────────────────────────────────

async function cloudRegister(deviceName) {
  var domain = cloudDomain();
  if (!domain) throw new Error('Renseignez d\'abord le domaine du cloud (ex. https://ekol-cloud.example.com).');
  var email = 'd-' + _cloudHex(6) + '@ekol-device.local';
  var secret = _cloudHex(16);
  var org = dbGetOrganizationById(currentOrgId) || { nom: '' };
  var dev = await cloudApi('/collections/devices/records', {
    method: 'POST',
    token: null,
    retry: false,
    body: {
      email: email,
      password: secret,
      passwordConfirm: secret,
      device_name: deviceName || 'Poste local',
      org_name: org.nom || '',
      app_version: (typeof NL_APPVERSION !== 'undefined' ? NL_APPVERSION : 'dev')
    }
  });
  var code = cloudNewCode();
  await cloudApi('/collections/pairing_codes/records', {
    method: 'POST',
    token: null,
    retry: false,
    body: {
      id: code,
      device: dev.id,
      status: 'pending',
      expires_at: new Date(Date.now() + CLOUD_PAIRING_TTL_MIN * 60000).toISOString()
    }
  });
  await cloudSetSetting('cloud_device_email', email);
  await cloudSetSetting('cloud_device_secret', secret);
  await cloudSetSetting('cloud_device_id', dev.id);
  await cloudSetSetting('cloud_code', code);
  _cloudToken = null;
  return code;
}

async function cloudCheckClaim(code) {
  var rec = await cloudApi('/collections/pairing_codes/records/' + code, { token: null, retry: false });
  if (rec.status === 'claimed') {
    await cloudSetSetting('cloud_code', '');
    await cloudDeviceAuth();
    var dev = await cloudApi('/collections/devices/records/' + rec.device, {});
    await cloudSetSetting('cloud_sub_active', dev.sub_active ? '1' : '0');
    await cloudSetSetting('cloud_sub_expires', dev.sub_expires || '');
    _cloudDirty = true;
  }
  return rec.status;
}

async function cloudUnlink() {
  var id = cloudGetSetting('cloud_device_id', '');
  if (id && _cloudToken !== false) {
    try {
      await cloudDeviceAuth();
      await cloudApi('/collections/devices/records/' + id, { method: 'DELETE' });
    } catch (e) { /* appareil déjà supprimé côté cloud : on nettoie quand même */ }
  }
  var keys = ['cloud_device_email', 'cloud_device_secret', 'cloud_device_id', 'cloud_code',
    'cloud_last_sync_at', 'cloud_last_checksum', 'cloud_sub_active', 'cloud_sub_expires'];
  for (var i = 0; i < keys.length; i++) {
    await cloudSetSetting(keys[i], '');
  }
  _cloudToken = null;
  _cloudDirty = false;
  _cloudLastStatus = null;
}

async function cloudDeviceInfo() {
  var id = cloudGetSetting('cloud_device_id', '');
  if (!id) return null;
  await cloudDeviceAuth();
  return cloudApi('/collections/devices/records/' + id, {});
}

// ─── Instantané local (canonique + checksum) ───────────────────────────────

function cloudStable(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return '[' + value.map(cloudStable).join(',') + ']';
  }
  if (typeof value === 'object') {
    var keys = Object.keys(value).sort();
    return '{' + keys.map(function(k) { return JSON.stringify(k) + ':' + cloudStable(value[k]); }).join(',') + '}';
  }
  return JSON.stringify(value);
}

function cloudOrgRows(table) {
  var orderCol = (table === 'org_settings') ? 'key' : 'id';
  return _query('SELECT * FROM ' + table + ' WHERE organization_id = ? ORDER BY ' + orderCol + ' ASC', [currentOrgId]);
}

// Clés volatiles : état de synchro local, exclu de l'instantané pour que le
// checksum reste stable entre deux synchronisations sans changement réel.
// (Les identifiants appareil/domaine, eux, sont conservés pour la reprise.)
var CLOUD_VOLATILE_SETTINGS = ['cloud_code', 'cloud_last_sync_at', 'cloud_last_checksum', 'cloud_sub_active', 'cloud_sub_expires'];

function cloudSnapshotSettings() {
  return cloudOrgRows('org_settings').filter(function(r) {
    return CLOUD_VOLATILE_SETTINGS.indexOf(r.key) === -1;
  });
}

function cloudBuildSnapshot() {
  var org = dbGetOrganizationById(currentOrgId) || {};
  var tables = {
    organizations: _query('SELECT * FROM organizations WHERE id = ?', [currentOrgId]),
    org_settings: cloudSnapshotSettings(),
    users: cloudOrgRows('users'),
    periodes: cloudOrgRows('periodes'),
    styles_notation: cloudOrgRows('styles_notation'),
    composantes_style: _query(
      'SELECT c.* FROM composantes_style c JOIN styles_notation s ON c.style_id = s.id ' +
      'WHERE s.organization_id = ? ORDER BY c.style_id ASC, c.ordre ASC, c.id ASC', [currentOrgId]),
    matieres: cloudOrgRows('matieres'),
    cycles: cloudOrgRows('cycles'),
    classes: cloudOrgRows('classes'),
    classe_matieres: cloudOrgRows('classe_matieres'),
    eleves: _query('SELECT * FROM eleves WHERE organization_id = ? ORDER BY id ASC', [currentOrgId]),
    paiements: _query(
      'SELECT p.* FROM paiements p JOIN eleves e ON p.eleve_id = e.id ' +
      'WHERE e.organization_id = ? ORDER BY p.id ASC', [currentOrgId]),
    notes: _query(
      'SELECT n.* FROM notes n JOIN classe_matieres cm ON n.classe_matiere_id = cm.id ' +
      'WHERE cm.organization_id = ? ORDER BY n.id ASC', [currentOrgId])
  };
  var counts = {};
  var names = Object.keys(tables);
  for (var i = 0; i < names.length; i++) counts[names[i]] = tables[names[i]].length;
  return {
    app: 'ekol-snapshot',
    format: 1,
    org_name: org.nom || '',
    org_local_id: currentOrgId,
    created_at: new Date().toISOString(),
    app_version: (typeof NL_APPVERSION !== 'undefined' ? NL_APPVERSION : 'dev'),
    counts: counts,
    tables: tables
  };
}

async function cloudChecksum(snapshot) {
  // Le checksum ne couvre que les DONNÉES (tables) : les métadonnées
  // (created_at, version…) changent à chaque construction et doivent
  // rester comparables entre la sauvegarde et la base courante.
  var bytes = new TextEncoder().encode(cloudStable({ tables: (snapshot.tables || snapshot) }));
  var digest = await crypto.subtle.digest('SHA-256', bytes);
  var arr = new Uint8Array(digest);
  var out = '';
  for (var i = 0; i < arr.length; i++) out += ('0' + arr[i].toString(16)).slice(-2);
  return out;
}

// ─── CSV embarqués (locaux + envoyés au cloud) ────────────────────────────

function cloudBuildCSVs() {
  var periodes = dbGetAllPeriodes();
  var periodeId = periodes.length ? periodes[0].id : null;
  var eleves = dbGetElevesWithGrades({ periode_id: periodeId });
  var elevesRows = eleves.map(function(e) {
    return [e.matricule, e.nom, e.prenom, e.sexe || '', e.classe_nom, e.cycle_nom,
      e.a_des_notes ? gradeFormat(e.moyenne_generale) : '',
      (e.rang === null || e.rang === undefined) ? '' : e.rang,
      e.mention === '—' ? '' : e.mention, e.montant_total_du, e.solde_restant];
  });
  var notesRows = [];
  if (periodeId) {
    var classes = dbGetAllClasses();
    for (var i = 0; i < classes.length; i++) {
      var cr = dbGetClassResults(classes[i].id, periodeId);
      if (!cr) continue;
      for (var j = 0; j < cr.results.length; j++) {
        var r = cr.results[j];
        for (var k = 0; k < r.rows.length; k++) {
          var row = r.rows[k];
          var line = [r.eleve.matricule, r.eleve.nom, r.eleve.prenom, cr.classe.nom,
            row.matiere_nom, row.coefficient];
          for (var c = 0; c < cr.composantes.length; c++) {
            var v = row.valeurs[cr.composantes[c].id];
            line.push(v === null || v === undefined ? '' : v);
          }
          line.push(row.moyenne === null ? '' : gradeFormat(row.moyenne));
          line.push(r.saisies > 0 ? gradeFormat(r.moyenne_generale) : '');
          notesRows.push(line);
        }
      }
    }
  }
  var compHead = ['Composante'];
  if (periodeId) {
    var cr0 = null;
    var allClasses = dbGetAllClasses();
    for (var m = 0; m < allClasses.length && !cr0; m++) cr0 = dbGetClassResults(allClasses[m].id, periodeId);
    if (cr0) {
      for (var n = 0; n < cr0.composantes.length; n++) compHead.push(cr0.composantes[n].nom);
    }
  }
  var payRows = [];
  var allEleves = dbGetAllEleves({});
  for (var p = 0; p < allEleves.length; p++) {
    var pays = dbGetPaiementsByEleve(allEleves[p].id);
    for (var q = 0; q < pays.length; q++) {
      payRows.push([allEleves[p].matricule, allEleves[p].nom, allEleves[p].prenom,
        allEleves[p].classe_nom, (pays[q].date_paiement || '').slice(0, 10),
        pays[q].montant, pays[q].mode_paiement || '', pays[q].reference || '']);
    }
  }
  return [
    { kind: 'eleves', label: 'Élèves (moyennes, rangs, mentions)', filename: 'eleves.csv',
      content: exportBuildCSV(['Matricule', 'Nom', 'Prénom', 'Sexe', 'Classe', 'Cycle', 'Moyenne', 'Rang', 'Mention', 'Total dû', 'Solde'], elevesRows) },
    { kind: 'notes', label: 'Notes détaillées par matière', filename: 'notes.csv',
      content: exportBuildCSV(['Matricule', 'Nom', 'Prénom', 'Classe', 'Matière', 'Coef'].concat(compHead.slice(1)).concat(['Moyenne matière', 'Moyenne générale']), notesRows) },
    { kind: 'paiements', label: 'Paiements', filename: 'paiements.csv',
      content: exportBuildCSV(['Matricule', 'Nom', 'Prénom', 'Classe', 'Date', 'Montant', 'Mode', 'Référence'], payRows) }
  ];
}

// ─── Synchronisation ──────────────────────────────────────────────────────

async function cloudSyncNow(note) {
  if (!cloudIsLinked()) throw new Error('Appareil non associé. Générez un code d\'appairage.');
  var auth = await cloudDeviceAuth();
  var owner = (auth.record && auth.record.owner) || '';
  if (!owner) throw new Error('Appareil non associé : saisissez le code sur le site du cloud, rubrique Compte.');
  var deviceId = cloudGetSetting('cloud_device_id', '');
  var snapshot = cloudBuildSnapshot();
  var checksum = await cloudChecksum(snapshot);
  var csvs = cloudBuildCSVs();
  var org = dbGetOrganizationById(currentOrgId) || {};

  var form = new FormData();
  form.append('device', deviceId);
  form.append('owner', owner);
  form.append('org_local_id', String(currentOrgId));
  form.append('org_name', org.nom || '');
  form.append('checksum', checksum);
  form.append('app_version', snapshot.app_version);
  form.append('counts', JSON.stringify(snapshot.counts));
  if (note) form.append('note', String(note).slice(0, 300));
  form.append('snapshot', new Blob([JSON.stringify(snapshot)], { type: 'application/json' }), 'snapshot.json');
  var backup = await cloudApi('/collections/backups/records', { method: 'POST', body: form });

  for (var i = 0; i < csvs.length; i++) {
    var f = new FormData();
    f.append('backup', backup.id);
    f.append('device', deviceId);
    f.append('owner', owner);
    f.append('kind', csvs[i].kind);
    f.append('label', csvs[i].label);
    f.append('file', new Blob([csvs[i].content], { type: 'text/csv' }), csvs[i].filename);
    await cloudApi('/collections/exports/records', { method: 'POST', body: f });
  }

  var dev = await cloudApi('/collections/devices/records/' + cloudGetSetting('cloud_device_id', ''), {});
  await cloudSetSetting('cloud_last_sync_at', new Date().toISOString());
  await cloudSetSetting('cloud_last_checksum', checksum);
  await cloudSetSetting('cloud_sub_active', dev.sub_active ? '1' : '0');
  await cloudSetSetting('cloud_sub_expires', dev.sub_expires || '');
  _cloudDirty = false;
  _cloudLastStatus = await cloudVerifyStatus(checksum);
  return backup;
}

async function cloudLatestBackup() {
  var id = cloudGetSetting('cloud_device_id', '');
  if (!id) return null;
  await cloudDeviceAuth();
  // Note : tri + filtre serveur évités (voir cloud/README.md « Quirks PocketBase ») :
  // la règle d'accès restreint déjà aux sauvegardes de l'appareil.
  var res = await cloudApi('/collections/backups/records?perPage=50', {});
  var items = (res.items || []).filter(function(b) { return b.device === id; });
  items.sort(function(a, b) { return String(b.created).localeCompare(String(a.created)); });
  return items.length ? items[0] : null;
}

async function cloudVerifyStatus(currentChecksum) {
  var dev = await cloudDeviceInfo();
  if (!dev) return { state: 'unlinked' };
  var subActive = !!dev.sub_active;
  var subExpires = dev.sub_expires || '';
  var expired = subExpires && new Date(subExpires).getTime() < Date.now();
  if (!subActive || expired) {
    return { state: 'no-sub', sub_expires: subExpires, last_sync_at: cloudGetSetting('cloud_last_sync_at', '') };
  }
  var latest = await cloudLatestBackup();
  if (!latest) return { state: 'never', sub_expires: subExpires };
  var checksum = currentChecksum;
  if (!checksum) {
    checksum = await cloudChecksum(cloudBuildSnapshot());
  }
  if (checksum === latest.checksum) {
    return { state: 'synced', at: latest.created, checksum: checksum, sub_expires: subExpires };
  }
  return { state: 'dirty', cloud_checksum: latest.checksum, local_checksum: checksum,
    cloud_at: latest.created, sub_expires: subExpires };
}

async function cloudVerify() {
  if (!cloudIsLinked()) {
    _cloudLastStatus = { state: 'unlinked' };
    return _cloudLastStatus;
  }
  _cloudLastStatus = await cloudVerifyStatus(null);
  if (_cloudLastStatus.state === 'synced') {
    await cloudSetSetting('cloud_last_sync_at', _cloudLastStatus.at || new Date().toISOString());
    await cloudSetSetting('cloud_last_checksum', _cloudLastStatus.checksum || '');
    // Après les écritures (chaque saveDB remarque dirty) : état vraiment propre.
    _cloudDirty = false;
  }
  return _cloudLastStatus;
}

async function cloudDownloadBackup(backupId) {
  await cloudDeviceAuth();
  var rec = await cloudApi('/collections/backups/records/' + backupId, {});
  var ft = await cloudApi('/files/token', { method: 'POST', body: {} });
  var res = await fetch(cloudDomain() + '/api/files/backups/' + backupId + '/' + rec.snapshot + '?token=' + ft.token);
  if (!res.ok) throw new Error('Téléchargement impossible (HTTP ' + res.status + ').');
  var snap = JSON.parse(await res.text());
  if (!snap || snap.app !== 'ekol-snapshot' || !snap.tables) {
    throw new Error('Fichier de sauvegarde invalide.');
  }
  var checksum = await cloudChecksum(snap);
  if (rec.checksum && checksum !== rec.checksum) {
    throw new Error('Checksum incohérent : sauvegarde corrompue, restauration refusée.');
  }
  return snap;
}

// ─── État, notifications ──────────────────────────────────────────────────

function cloudMarkDirty() {
  _cloudDirty = true;
}

function cloudStatusLabel(status) {
  if (!status) return null;
  switch (status.state) {
    case 'unlinked': return null;
    case 'synced': return { level: 'ok', text: 'Synchronisé' + (status.at ? ' le ' + String(status.at).slice(0, 16).replace('T', ' ') : '') };
    case 'dirty': return { level: 'warn', text: 'Modifications locales non synchronisées' };
    case 'never': return { level: 'warn', text: 'Aucune sauvegarde cloud pour cet établissement' };
    case 'no-sub': return { level: 'error', text: 'Abonnement cloud inactif ou expiré (25 000 FCFA / an)' };
    default: return null;
  }
}

async function cloudBootCheck() {
  if (!cloudIsLinked()) return;
  try {
    var st = await cloudVerify();
    var label = cloudStatusLabel(st);
    if (label && label.level !== 'ok' && typeof showToast === 'function') {
      showToast('Cloud : ' + label.text, label.level === 'error' ? 'error' : 'success');
    }
  } catch (e) { /* silencieux au démarrage : voir page Cloud */ }
  if (_cloudTimer) clearInterval(_cloudTimer);
  _cloudTimer = setInterval(function() {
    if (!_cloudDirty || !cloudIsLinked()) return;
    cloudVerify().catch(function() {});
  }, CLOUD_CHECK_INTERVAL_MS);
}
