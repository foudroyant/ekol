var SQL = null;
var db  = null;
var DB_PATH = null;

// Session courante (renseignée par auth.js après connexion)
var currentOrgId = null;
var currentUser  = null;

async function initDB() {
  var wasmBinary = Uint8Array.from(atob(_WASM_B64), function(c) { return c.charCodeAt(0); });
  SQL = await initSqlJs({ wasmBinary: wasmBinary });

  DB_PATH = NL_PATH + '/ekol.db';

  // On distingue « fichier absent » (première ouverture) d'une vraie erreur de
  // lecture : dans le second cas, on ne doit surtout pas écraser la base.
  var exists = false;
  try {
    await Neutralino.filesystem.getStats(DB_PATH);
    exists = true;
  } catch (e) {
    exists = false;
  }

  if (exists) {
    var existing = await Neutralino.filesystem.readBinaryFile(DB_PATH);
    db = new SQL.Database(new Uint8Array(existing));
  } else {
    db = new SQL.Database();
  }
  _runSchema();
  // Persiste les migrations (nouvelles tables, colonnes, org par défaut…)
  await saveDB();
}

async function saveDB() {
  await Neutralino.filesystem.writeBinaryFile(DB_PATH, db.export().buffer);
}

function _runSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      adresse TEXT,
      telephone TEXT,
      email TEXT,
      style_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER REFERENCES organizations(id),
      nom TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      actif INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    );
    CREATE TABLE IF NOT EXISTS org_settings (
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (organization_id, key)
    );
    CREATE TABLE IF NOT EXISTS periodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      nom TEXT NOT NULL,
      ordre INTEGER DEFAULT 1,
      annee_scolaire TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS styles_notation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      nom TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS composantes_style (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      style_id INTEGER NOT NULL REFERENCES styles_notation(id),
      nom TEXT NOT NULL,
      groupe TEXT,
      poids REAL NOT NULL DEFAULT 1,
      ordre INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS matieres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      nom TEXT NOT NULL,
      coefficient REAL NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER,
      nom TEXT NOT NULL,
      ordre INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id),
      style_id INTEGER,
      nom TEXT NOT NULL,
      montant_inscription REAL NOT NULL DEFAULT 0,
      montant_mensuel REAL NOT NULL DEFAULT 0,
      annee_scolaire TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS classe_matieres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      classe_id INTEGER NOT NULL REFERENCES classes(id),
      matiere_id INTEGER NOT NULL REFERENCES matieres(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(classe_id, matiere_id)
    );
    CREATE TABLE IF NOT EXISTS eleves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER,
      classe_id INTEGER NOT NULL REFERENCES classes(id),
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      sexe TEXT,
      date_naissance TEXT,
      nom_parent TEXT,
      contact_parent TEXT,
      matricule TEXT UNIQUE,
      montant_total_du REAL NOT NULL,
      solde_restant REAL NOT NULL,
      date_inscription TEXT DEFAULT CURRENT_TIMESTAMP,
      actif INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS paiements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER,
      eleve_id INTEGER NOT NULL REFERENCES eleves(id),
      montant REAL NOT NULL,
      mode_paiement TEXT,
      reference TEXT,
      date_paiement TEXT DEFAULT CURRENT_TIMESTAMP,
      commentaire TEXT
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      eleve_id INTEGER NOT NULL REFERENCES eleves(id),
      classe_matiere_id INTEGER NOT NULL REFERENCES classe_matieres(id),
      periode_id INTEGER NOT NULL REFERENCES periodes(id),
      composante_id INTEGER NOT NULL REFERENCES composantes_style(id),
      valeur REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(eleve_id, classe_matiere_id, periode_id, composante_id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'FCFA')");
  _migrate();
  // Les index sont créés après la migration : les anciennes bases n'ont pas
  // encore les colonnes organization_id au moment de la création des tables.
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_eleves_org      ON eleves(organization_id);
    CREATE INDEX IF NOT EXISTS idx_classes_org     ON classes(organization_id);
    CREATE INDEX IF NOT EXISTS idx_cycles_org      ON cycles(organization_id);
    CREATE INDEX IF NOT EXISTS idx_paiements_org   ON paiements(organization_id);
    CREATE INDEX IF NOT EXISTS idx_notes_lookup    ON notes(eleve_id, classe_matiere_id, periode_id);
    CREATE INDEX IF NOT EXISTS idx_notes_periode   ON notes(periode_id);
  `);
}

// ─── MIGRATIONS ───────────────────────────────────────────────────────────────

function _columnExists(table, column) {
  var rows = _query('PRAGMA table_info(' + table + ')');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name === column) return true;
  }
  return false;
}

function _migrate() {
  var orgId = _ensureDefaultOrg();

  var legacyTables = ['cycles', 'classes', 'eleves', 'paiements'];
  for (var i = 0; i < legacyTables.length; i++) {
    var t = legacyTables[i];
    if (!_columnExists(t, 'organization_id')) {
      db.run('ALTER TABLE ' + t + ' ADD COLUMN organization_id INTEGER');
    }
    db.run('UPDATE ' + t + ' SET organization_id = ? WHERE organization_id IS NULL', [orgId]);
  }

  if (!_columnExists('classes', 'style_id')) {
    db.run('ALTER TABLE classes ADD COLUMN style_id INTEGER');
  }
  if (!_columnExists('organizations', 'style_id')) {
    db.run('ALTER TABLE organizations ADD COLUMN style_id INTEGER');
  }

  _ensureOrgDefaults(orgId);
}

function _ensureDefaultOrg() {
  var rows = _query('SELECT id FROM organizations ORDER BY id ASC LIMIT 1');
  if (rows.length) return rows[0].id;
  db.run("INSERT INTO organizations (nom) VALUES ('Mon établissement')");
  return _query('SELECT last_insert_rowid() AS id')[0].id;
}

function _ensureOrgDefaults(orgId) {
  if (_query('SELECT COUNT(*) AS n FROM periodes WHERE organization_id = ?', [orgId])[0].n === 0) {
    db.run('INSERT INTO periodes (organization_id, nom, ordre) VALUES (?, ?, ?)', [orgId, 'Séquence 1', 1]);
  }

  if (_query('SELECT COUNT(*) AS n FROM styles_notation WHERE organization_id = ?', [orgId])[0].n === 0) {
    _seedDefaultStyles(orgId);
  }

  var org = _query('SELECT style_id FROM organizations WHERE id = ?', [orgId])[0];
  if (org && !org.style_id) {
    var first = _query('SELECT id FROM styles_notation WHERE organization_id = ? ORDER BY id ASC LIMIT 1', [orgId]);
    if (first.length) db.run('UPDATE organizations SET style_id = ? WHERE id = ?', [first[0].id, orgId]);
  }

  var defaults = [['note_max', '20'], ['notes_manquantes_zero', '1']];
  for (var i = 0; i < defaults.length; i++) {
    var key = defaults[i][0];
    var value = defaults[i][1];
    var exists = _query('SELECT 1 FROM org_settings WHERE organization_id = ? AND key = ?', [orgId, key]);
    if (!exists.length) {
      db.run('INSERT INTO org_settings (organization_id, key, value) VALUES (?, ?, ?)', [orgId, key, value]);
    }
  }
}

function _seedDefaultStyles(orgId) {
  var presets = [
    {
      nom: 'Standard 40/60',
      description: 'Modèle par défaut : 40 % contrôle continu (devoir + TP), 60 % session.',
      composantes: [
        { nom: 'Devoir', groupe: 'Classe', poids: 20 },
        { nom: 'TP/Exposé', groupe: 'Classe', poids: 20 },
        { nom: 'Session', groupe: 'Session', poids: 60 }
      ]
    },
    {
      nom: 'Équilibré 50/50',
      description: 'Contrôle continu et session comptent pour moitié chacun.',
      composantes: [
        { nom: 'Devoir', groupe: 'Classe', poids: 25 },
        { nom: 'TP/Exposé', groupe: 'Classe', poids: 25 },
        { nom: 'Session', groupe: 'Session', poids: 50 }
      ]
    },
    {
      nom: 'Continu 30/70',
      description: 'La session domine : 30 % contrôle continu, 70 % session.',
      composantes: [
        { nom: 'Devoir', groupe: 'Classe', poids: 15 },
        { nom: 'TP/Exposé', groupe: 'Classe', poids: 15 },
        { nom: 'Session', groupe: 'Session', poids: 70 }
      ]
    },
    {
      nom: 'Sans session',
      description: 'Évaluation continue uniquement (devoir + TP).',
      composantes: [
        { nom: 'Devoir', groupe: 'Classe', poids: 50 },
        { nom: 'TP/Exposé', groupe: 'Classe', poids: 50 }
      ]
    },
    {
      nom: 'Sans TP',
      description: 'Devoir et session seulement, sans TP/exposé.',
      composantes: [
        { nom: 'Devoir', groupe: 'Classe', poids: 40 },
        { nom: 'Session', groupe: 'Session', poids: 60 }
      ]
    },
    {
      nom: 'Devoirs multiples',
      description: 'Deux devoirs, un TP et une session.',
      composantes: [
        { nom: 'Devoir 1', groupe: 'Classe', poids: 25 },
        { nom: 'Devoir 2', groupe: 'Classe', poids: 25 },
        { nom: 'TP/Exposé', groupe: 'Classe', poids: 10 },
        { nom: 'Session', groupe: 'Session', poids: 40 }
      ]
    }
  ];

  for (var i = 0; i < presets.length; i++) {
    var p = presets[i];
    db.run('INSERT INTO styles_notation (organization_id, nom, description) VALUES (?, ?, ?)',
      [orgId, p.nom, p.description]);
    var styleId = _query('SELECT last_insert_rowid() AS id')[0].id;
    for (var j = 0; j < p.composantes.length; j++) {
      var c = p.composantes[j];
      db.run('INSERT INTO composantes_style (style_id, nom, groupe, poids, ordre) VALUES (?, ?, ?, ?, ?)',
        [styleId, c.nom, c.groupe, c.poids, j]);
    }
  }
}

function _query(sql, params) {
  var stmt = db.prepare(sql);
  if (params && params.length > 0) stmt.bind(params);
  var rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ─── ORGANISATIONS ────────────────────────────────────────────────────────────

function dbGetAllOrganizations() {
  return _query(`
    SELECT o.*,
      (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS nb_users,
      (SELECT COUNT(*) FROM classes c WHERE c.organization_id = o.id) AS nb_classes,
      (SELECT COUNT(*) FROM eleves e WHERE e.organization_id = o.id) AS nb_eleves
    FROM organizations o
    ORDER BY o.nom ASC
  `);
}

function dbGetOrganizationById(id) {
  var rows = _query('SELECT * FROM organizations WHERE id = ?', [id]);
  return rows[0] || null;
}

async function dbCreateOrganization(data) {
  db.run(
    'INSERT INTO organizations (nom, adresse, telephone, email) VALUES (?, ?, ?, ?)',
    [data.nom, data.adresse || null, data.telephone || null, data.email || null]
  );
  var id = _query('SELECT last_insert_rowid() AS id')[0].id;
  _ensureOrgDefaults(id);
  await saveDB();
  return id;
}

async function dbUpdateOrganization(id, data) {
  db.run(
    'UPDATE organizations SET nom = ?, adresse = ?, telephone = ?, email = ? WHERE id = ?',
    [data.nom, data.adresse || null, data.telephone || null, data.email || null, id]
  );
  await saveDB();
}

async function dbDeleteOrganization(id) {
  var checks = ['classes', 'eleves', 'cycles'];
  for (var i = 0; i < checks.length; i++) {
    var n = _query('SELECT COUNT(*) AS n FROM ' + checks[i] + ' WHERE organization_id = ?', [id])[0].n;
    if (n > 0) throw new Error('Cet établissement contient encore des données (classes, élèves ou cycles).');
  }
  // Les comptes et les notes appartiennent à l'établissement : ils sont
  // supprimés avec lui. Les classes/élèves/cycles doivent d'abord être vidés.
  db.run('DELETE FROM notes WHERE organization_id = ?', [id]);
  db.run('DELETE FROM users WHERE organization_id = ?', [id]);
  db.run('DELETE FROM composantes_style WHERE style_id IN (SELECT id FROM styles_notation WHERE organization_id = ?)', [id]);
  db.run('DELETE FROM styles_notation WHERE organization_id = ?', [id]);
  db.run('DELETE FROM periodes WHERE organization_id = ?', [id]);
  db.run('DELETE FROM matieres WHERE organization_id = ?', [id]);
  db.run('DELETE FROM org_settings WHERE organization_id = ?', [id]);
  db.run('DELETE FROM organizations WHERE id = ?', [id]);
  await saveDB();
}

// ─── UTILISATEURS & AUTH ──────────────────────────────────────────────────────

function dbGetAllUsersAll() {
  return _query('SELECT id, organization_id, nom, username, role, actif FROM users ORDER BY nom ASC');
}

function dbGetAllUsers() {
  if (!currentUser) return [];
  if (currentUser.role === 'super_admin') {
    return _query(`
      SELECT u.id, u.organization_id, u.nom, u.username, u.role, u.actif,
             u.created_at, u.last_login, o.nom AS organization_nom
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      ORDER BY o.nom ASC, u.nom ASC
    `);
  }
  return _query(`
    SELECT u.id, u.organization_id, u.nom, u.username, u.role, u.actif,
           u.created_at, u.last_login, o.nom AS organization_nom
    FROM users u
    LEFT JOIN organizations o ON u.organization_id = o.id
    WHERE u.organization_id = ?
    ORDER BY u.nom ASC
  `, [currentOrgId]);
}

function dbGetUserByUsername(username) {
  var rows = _query('SELECT * FROM users WHERE lower(username) = lower(?)', [username]);
  return rows[0] || null;
}

async function dbCreateUser(data) {
  var existing = dbGetUserByUsername(data.username);
  if (existing) throw new Error('Ce nom d\'utilisateur existe déjà.');
  if (typeof hashPassword !== 'function') throw new Error('Module d\'authentification indisponible.');
  var h = await hashPassword(data.password);
  db.run(
    `INSERT INTO users (organization_id, nom, username, password_hash, password_salt, role, actif)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.organization_id || currentOrgId || null,
      data.nom,
      data.username,
      h.hash,
      h.salt,
      data.role || 'enseignant',
      data.actif === 0 ? 0 : 1
    ]
  );
  var id = _query('SELECT last_insert_rowid() AS id')[0].id;
  await saveDB();
  return id;
}

async function dbUpdateUser(id, data) {
  db.run(
    'UPDATE users SET nom = ?, role = ?, actif = ?, organization_id = ? WHERE id = ?',
    [data.nom, data.role, data.actif ? 1 : 0, data.organization_id || null, id]
  );
  if (data.password) {
    await dbSetUserPassword(id, data.password);
  } else {
    await saveDB();
  }
}

async function dbSetUserPassword(id, password) {
  if (typeof hashPassword !== 'function') throw new Error('Module d\'authentification indisponible.');
  var h = await hashPassword(password);
  db.run('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', [h.hash, h.salt, id]);
  await saveDB();
}

async function dbDeactivateUser(id) {
  db.run('UPDATE users SET actif = 0 WHERE id = ?', [id]);
  await saveDB();
}

async function dbActivateUser(id) {
  db.run('UPDATE users SET actif = 1 WHERE id = ?', [id]);
  await saveDB();
}

async function dbTouchUserLogin(id) {
  db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  await saveDB();
}

async function dbAuthenticate(username, password) {
  var user = dbGetUserByUsername(username);
  if (!user || !user.actif) return null;
  if (typeof verifyPassword !== 'function') return null;
  var ok = await verifyPassword(password, user.password_salt, user.password_hash);
  return ok ? user : null;
}

// ─── RÉGLAGES PAR ÉTABLISSEMENT ───────────────────────────────────────────────

function dbGetOrgSetting(key, fallback) {
  if (!currentOrgId) return fallback;
  var rows = _query('SELECT value FROM org_settings WHERE organization_id = ? AND key = ?', [currentOrgId, key]);
  return rows.length && rows[0].value !== null ? rows[0].value : fallback;
}

async function dbSetOrgSetting(key, value) {
  var exists = _query('SELECT 1 FROM org_settings WHERE organization_id = ? AND key = ?', [currentOrgId, key]);
  if (exists.length) {
    db.run('UPDATE org_settings SET value = ? WHERE organization_id = ? AND key = ?', [String(value), currentOrgId, key]);
  } else {
    db.run('INSERT INTO org_settings (organization_id, key, value) VALUES (?, ?, ?)', [currentOrgId, key, String(value)]);
  }
  await saveDB();
}

function dbGetNoteMax() {
  var v = parseFloat(dbGetOrgSetting('note_max', '20'));
  return (!v || v <= 0) ? 20 : v;
}

function dbGetMissingAsZero() {
  return dbGetOrgSetting('notes_manquantes_zero', '1') === '1';
}

// ─── STYLES DE NOTATION ───────────────────────────────────────────────────────

function dbGetStyles() {
  return _query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM composantes_style c WHERE c.style_id = s.id) AS nb_composantes,
      (SELECT GROUP_CONCAT(c.nom || ' ' || c.poids, ' · ') FROM composantes_style c WHERE c.style_id = s.id) AS resume,
      (SELECT COUNT(*) FROM classes cl WHERE cl.style_id = s.id AND cl.organization_id = s.organization_id) AS nb_classes
    FROM styles_notation s
    WHERE s.organization_id = ?
    ORDER BY s.id ASC
  `, [currentOrgId]);
}

function dbGetStyleById(id) {
  var rows = _query('SELECT * FROM styles_notation WHERE id = ? AND organization_id = ?', [id, currentOrgId]);
  if (!rows.length) return null;
  var style = rows[0];
  style.composantes = dbGetStyleComponents(id);
  return style;
}

function dbGetStyleComponents(styleId) {
  return _query(
    'SELECT * FROM composantes_style WHERE style_id = ? ORDER BY ordre ASC, id ASC',
    [styleId]
  );
}

function dbGetDefaultStyleId() {
  if (!currentOrgId) return null;
  var org = _query('SELECT style_id FROM organizations WHERE id = ?', [currentOrgId])[0];
  if (org && org.style_id) return org.style_id;
  var first = _query('SELECT id FROM styles_notation WHERE organization_id = ? ORDER BY id ASC LIMIT 1', [currentOrgId]);
  return first.length ? first[0].id : null;
}

async function dbSetDefaultStyle(styleId) {
  db.run('UPDATE organizations SET style_id = ? WHERE id = ?', [styleId, currentOrgId]);
  await saveDB();
}

async function dbCreateStyle(nom, description, composantes) {
  db.run(
    'INSERT INTO styles_notation (organization_id, nom, description) VALUES (?, ?, ?)',
    [currentOrgId, nom, description || null]
  );
  var id = _query('SELECT last_insert_rowid() AS id')[0].id;
  for (var i = 0; i < composantes.length; i++) {
    var c = composantes[i];
    db.run(
      'INSERT INTO composantes_style (style_id, nom, groupe, poids, ordre) VALUES (?, ?, ?, ?, ?)',
      [id, c.nom, c.groupe || null, c.poids, i]
    );
  }
  await saveDB();
  return id;
}

async function dbUpdateStyle(id, nom, description, composantes) {
  db.run(
    'UPDATE styles_notation SET nom = ?, description = ? WHERE id = ? AND organization_id = ?',
    [nom, description || null, id, currentOrgId]
  );

  var existing = _query('SELECT * FROM composantes_style WHERE style_id = ?', [id]);
  var keep = {};
  for (var i = 0; i < composantes.length; i++) {
    if (composantes[i].id) keep[composantes[i].id] = true;
  }
  for (var j = 0; j < existing.length; j++) {
    if (!keep[existing[j].id]) {
      db.run('DELETE FROM notes WHERE composante_id = ?', [existing[j].id]);
      db.run('DELETE FROM composantes_style WHERE id = ?', [existing[j].id]);
    }
  }

  for (var k = 0; k < composantes.length; k++) {
    var c = composantes[k];
    if (c.id) {
      db.run(
        'UPDATE composantes_style SET nom = ?, groupe = ?, poids = ?, ordre = ? WHERE id = ? AND style_id = ?',
        [c.nom, c.groupe || null, c.poids, k, c.id, id]
      );
    } else {
      db.run(
        'INSERT INTO composantes_style (style_id, nom, groupe, poids, ordre) VALUES (?, ?, ?, ?, ?)',
        [id, c.nom, c.groupe || null, c.poids, k]
      );
    }
  }
  await saveDB();
}

async function dbDuplicateStyle(id, nom) {
  var style = dbGetStyleById(id);
  if (!style) throw new Error('Style introuvable.');
  db.run(
    'INSERT INTO styles_notation (organization_id, nom, description) VALUES (?, ?, ?)',
    [currentOrgId, nom, style.description || null]
  );
  var newId = _query('SELECT last_insert_rowid() AS id')[0].id;
  for (var i = 0; i < style.composantes.length; i++) {
    var c = style.composantes[i];
    db.run(
      'INSERT INTO composantes_style (style_id, nom, groupe, poids, ordre) VALUES (?, ?, ?, ?, ?)',
      [newId, c.nom, c.groupe || null, c.poids, i]
    );
  }
  await saveDB();
  return newId;
}

async function dbDeleteStyle(id) {
  var used = _query('SELECT COUNT(*) AS n FROM classes WHERE style_id = ? AND organization_id = ?', [id, currentOrgId])[0].n;
  if (used > 0) throw new Error('Ce style est utilisé par une ou plusieurs classes.');
  if (dbGetDefaultStyleId() === id) throw new Error('Impossible de supprimer le style par défaut de l\'établissement.');
  var comps = _query('SELECT id FROM composantes_style WHERE style_id = ?', [id]);
  for (var i = 0; i < comps.length; i++) {
    db.run('DELETE FROM notes WHERE composante_id = ?', [comps[i].id]);
  }
  db.run('DELETE FROM composantes_style WHERE style_id = ?', [id]);
  db.run('DELETE FROM styles_notation WHERE id = ? AND organization_id = ?', [id, currentOrgId]);
  await saveDB();
}

function dbCountNotesForStyle(styleId) {
  return _query(`
    SELECT COUNT(*) AS n FROM notes n
    JOIN composantes_style c ON n.composante_id = c.id
    WHERE c.style_id = ?
  `, [styleId])[0].n;
}

function dbGetEffectiveStyleForClasse(classeId) {
  var classe = dbGetClasseById(classeId);
  if (!classe) return null;
  var styleId = classe.style_id || dbGetDefaultStyleId();
  return styleId ? dbGetStyleById(styleId) : null;
}

async function dbSetClasseStyle(classeId, styleId) {
  db.run('UPDATE classes SET style_id = ? WHERE id = ? AND organization_id = ?', [styleId || null, classeId, currentOrgId]);
  await saveDB();
}

// ─── MATIÈRES ─────────────────────────────────────────────────────────────────

function dbGetAllMatieres() {
  return _query(`
    SELECT m.*,
      (SELECT COUNT(*) FROM classe_matieres cm WHERE cm.matiere_id = m.id) AS nb_classes
    FROM matieres m
    WHERE m.organization_id = ?
    ORDER BY m.nom ASC, m.coefficient ASC
  `, [currentOrgId]);
}

function dbGetMatiereById(id) {
  var rows = _query('SELECT * FROM matieres WHERE id = ? AND organization_id = ?', [id, currentOrgId]);
  return rows[0] || null;
}

function dbFindMatiere(nom, coefficient, excludeId) {
  var sql = 'SELECT * FROM matieres WHERE organization_id = ? AND lower(nom) = lower(?) AND coefficient = ?';
  var params = [currentOrgId, nom, coefficient];
  if (excludeId) { sql += ' AND id <> ?'; params.push(excludeId); }
  return _query(sql, params)[0] || null;
}

async function dbCreateMatiere(nom, coefficient) {
  if (dbFindMatiere(nom, coefficient)) {
    throw new Error('Cette matière avec ce coefficient existe déjà.');
  }
  db.run('INSERT INTO matieres (organization_id, nom, coefficient) VALUES (?, ?, ?)',
    [currentOrgId, nom, coefficient]);
  await saveDB();
}

async function dbUpdateMatiere(id, nom, coefficient) {
  if (dbFindMatiere(nom, coefficient, id)) {
    throw new Error('Cette matière avec ce coefficient existe déjà.');
  }
  db.run('UPDATE matieres SET nom = ?, coefficient = ? WHERE id = ? AND organization_id = ?',
    [nom, coefficient, id, currentOrgId]);
  await saveDB();
}

async function dbDeleteMatiere(id) {
  var used = _query('SELECT COUNT(*) AS n FROM classe_matieres WHERE matiere_id = ?', [id])[0].n;
  if (used > 0) throw new Error('Cette matière est utilisée par une ou plusieurs classes.');
  db.run('DELETE FROM matieres WHERE id = ? AND organization_id = ?', [id, currentOrgId]);
  await saveDB();
}

function dbGetClasseMatieresWithDetails(classeId) {
  return _query(`
    SELECT cm.id, cm.matiere_id, m.nom, m.coefficient
    FROM classe_matieres cm
    JOIN matieres m ON cm.matiere_id = m.id
    WHERE cm.classe_id = ? AND cm.organization_id = ?
    ORDER BY m.nom ASC, m.coefficient ASC
  `, [classeId, currentOrgId]);
}

async function dbSetClasseMatieres(classeId, matiereIds) {
  var keep = {};
  for (var i = 0; i < matiereIds.length; i++) keep[Number(matiereIds[i])] = true;

  var existing = _query(
    'SELECT id, matiere_id FROM classe_matieres WHERE classe_id = ? AND organization_id = ?',
    [classeId, currentOrgId]
  );
  var existingMatiereIds = {};
  for (var j = 0; j < existing.length; j++) {
    var row = existing[j];
    existingMatiereIds[row.matiere_id] = true;
    if (!keep[row.matiere_id]) {
      db.run('DELETE FROM notes WHERE classe_matiere_id = ?', [row.id]);
      db.run('DELETE FROM classe_matieres WHERE id = ?', [row.id]);
    }
  }

  for (var k = 0; k < matiereIds.length; k++) {
    var mid = Number(matiereIds[k]);
    if (!existingMatiereIds[mid]) {
      db.run(
        'INSERT INTO classe_matieres (organization_id, classe_id, matiere_id) VALUES (?, ?, ?)',
        [currentOrgId, classeId, mid]
      );
    }
  }
  await saveDB();
}

async function dbRemoveMatiereFromClasse(classeId, matiereId) {
  var rows = _query(
    'SELECT id FROM classe_matieres WHERE classe_id = ? AND matiere_id = ? AND organization_id = ?',
    [classeId, matiereId, currentOrgId]
  );
  for (var i = 0; i < rows.length; i++) {
    db.run('DELETE FROM notes WHERE classe_matiere_id = ?', [rows[i].id]);
    db.run('DELETE FROM classe_matieres WHERE id = ?', [rows[i].id]);
  }
  await saveDB();
}

// ─── PÉRIODES D'ÉVALUATION ────────────────────────────────────────────────────

function dbGetAllPeriodes() {
  return _query(
    'SELECT * FROM periodes WHERE organization_id = ? ORDER BY ordre ASC, nom ASC',
    [currentOrgId]
  );
}

function dbGetPeriodeById(id) {
  var rows = _query('SELECT * FROM periodes WHERE id = ? AND organization_id = ?', [id, currentOrgId]);
  return rows[0] || null;
}

async function dbCreatePeriode(nom, ordre, annee_scolaire) {
  if (!ordre) {
    var max = _query('SELECT COALESCE(MAX(ordre), 0) AS n FROM periodes WHERE organization_id = ?', [currentOrgId])[0].n;
    ordre = max + 1;
  }
  db.run(
    'INSERT INTO periodes (organization_id, nom, ordre, annee_scolaire) VALUES (?, ?, ?, ?)',
    [currentOrgId, nom, ordre, annee_scolaire || null]
  );
  await saveDB();
}

async function dbUpdatePeriode(id, nom, ordre, annee_scolaire) {
  db.run(
    'UPDATE periodes SET nom = ?, ordre = ?, annee_scolaire = ? WHERE id = ? AND organization_id = ?',
    [nom, ordre || null, annee_scolaire || null, id, currentOrgId]
  );
  await saveDB();
}

async function dbDeletePeriode(id) {
  var n = _query('SELECT COUNT(*) AS n FROM notes WHERE periode_id = ? AND organization_id = ?', [id, currentOrgId])[0].n;
  if (n > 0) throw new Error('Cette période contient des notes. Supprimez-les d\'abord.');
  db.run('DELETE FROM periodes WHERE id = ? AND organization_id = ?', [id, currentOrgId]);
  await saveDB();
}

// ─── NOTES ────────────────────────────────────────────────────────────────────

function dbGetNotesForClasseMatierePeriode(classeMatiereId, periodeId) {
  return _query(
    'SELECT * FROM notes WHERE classe_matiere_id = ? AND periode_id = ? AND organization_id = ?',
    [classeMatiereId, periodeId, currentOrgId]
  );
}

function dbGetNotesForElevePeriode(eleveId, periodeId) {
  return _query(
    'SELECT * FROM notes WHERE eleve_id = ? AND periode_id = ? AND organization_id = ?',
    [eleveId, periodeId, currentOrgId]
  );
}

async function dbSaveNotesBatch(rows) {
  db.run('BEGIN');
  try {
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var v = (r.valeur === '' || r.valeur === null || r.valeur === undefined) ? null : Number(r.valeur);
      if (v !== null && (isNaN(v) || v < 0 || v > dbGetNoteMax())) {
        throw new Error('Note invalide : ' + r.valeur + ' (barème /' + dbGetNoteMax() + ').');
      }
      var existing = _query(
        `SELECT id FROM notes
         WHERE eleve_id = ? AND classe_matiere_id = ? AND periode_id = ? AND composante_id = ?`,
        [r.eleve_id, r.classe_matiere_id, r.periode_id, r.composante_id]
      );
      if (v === null) {
        if (existing.length) db.run('DELETE FROM notes WHERE id = ?', [existing[0].id]);
      } else if (existing.length) {
        db.run('UPDATE notes SET valeur = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [v, existing[0].id]);
      } else {
        db.run(
          `INSERT INTO notes (organization_id, eleve_id, classe_matiere_id, periode_id, composante_id, valeur)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [currentOrgId, r.eleve_id, r.classe_matiere_id, r.periode_id, r.composante_id, v]
        );
      }
    }
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  await saveDB();
}

function dbCountNotesForClasseMatiere(classeMatiereId) {
  return _query(
    'SELECT COUNT(*) AS n FROM notes WHERE classe_matiere_id = ? AND organization_id = ?',
    [classeMatiereId, currentOrgId]
  )[0].n;
}

function dbCountNotesForClassePeriode(classeId, periodeId) {
  return _query(`
    SELECT COUNT(*) AS n FROM notes n
    JOIN classe_matieres cm ON n.classe_matiere_id = cm.id
    WHERE cm.classe_id = ? AND n.periode_id = ? AND n.organization_id = ?
  `, [classeId, periodeId, currentOrgId])[0].n;
}

// ─── RÉSULTATS & CALCULS ──────────────────────────────────────────────────────

function dbGetElevesByClasse(classeId) {
  return _query(
    'SELECT * FROM eleves WHERE classe_id = ? AND actif = 1 AND organization_id = ? ORDER BY nom ASC, prenom ASC',
    [classeId, currentOrgId]
  );
}

function dbGetClassResults(classeId, periodeId) {
  var classe = dbGetClasseById(classeId);
  if (!classe) return null;

  var style = dbGetEffectiveStyleForClasse(classeId);
  var composantes = style ? dbGetStyleComponents(style.id) : [];
  var subjects = dbGetClasseMatieresWithDetails(classeId);
  var students = dbGetElevesByClasse(classeId);
  var notes = _query(`
    SELECT n.* FROM notes n
    JOIN classe_matieres cm ON n.classe_matiere_id = cm.id
    WHERE cm.classe_id = ? AND n.periode_id = ? AND n.organization_id = ?
  `, [classeId, periodeId, currentOrgId]);

  var noteMap = {};
  for (var i = 0; i < notes.length; i++) {
    var n = notes[i];
    noteMap[n.eleve_id + '|' + n.classe_matiere_id + '|' + n.composante_id] = n.valeur;
  }

  var missingAsZero = dbGetMissingAsZero();
  var noteMax = dbGetNoteMax();
  var results = [];

  for (var s = 0; s < students.length; s++) {
    var st = students[s];
    var rows = [];
    for (var m = 0; m < subjects.length; m++) {
      var subject = subjects[m];
      var valeurs = {};
      for (var c = 0; c < composantes.length; c++) {
        var comp = composantes[c];
        var val = noteMap[st.id + '|' + subject.id + '|' + comp.id];
        valeurs[comp.id] = (val === undefined ? null : val);
      }
      var mm = gradeComputeMoyenneMatiere(valeurs, composantes, missingAsZero);
      rows.push({
        classe_matiere_id: subject.id,
        matiere_id: subject.matiere_id,
        matiere_nom: subject.nom,
        coefficient: subject.coefficient,
        valeurs: valeurs,
        moyenne: mm.moyenne,
        saisies: mm.saisies,
        total: mm.total
      });
    }
    var mg = gradeComputeMoyenneGenerale(rows, missingAsZero);
    results.push({
      eleve: st,
      rows: rows,
      moyenne_generale: mg.moyenne,
      coef_total: mg.coefTotal,
      saisies: mg.saisies,
      total_notes: mg.totalNotes
    });
  }

  gradeAssignRanks(results);

  return {
    classe: classe,
    style: style,
    composantes: composantes,
    subjects: subjects,
    students: students,
    results: results,
    note_max: noteMax,
    missing_as_zero: missingAsZero,
    periode_id: periodeId
  };
}

function dbGetStudentResult(eleveId, periodeId) {
  var eleve = dbGetEleveById(eleveId);
  if (!eleve) return null;
  var cr = dbGetClassResults(eleve.classe_id, periodeId);
  if (!cr) return null;
  var result = null;
  for (var i = 0; i < cr.results.length; i++) {
    if (cr.results[i].eleve.id === Number(eleveId)) { result = cr.results[i]; break; }
  }
  return {
    eleve: eleve,
    classe: cr.classe,
    style: cr.style,
    composantes: cr.composantes,
    subjects: cr.subjects,
    result: result,
    note_max: cr.note_max,
    missing_as_zero: cr.missing_as_zero,
    periode_id: periodeId
  };
}

function dbGetElevesWithGrades(filters) {
  filters = filters || {};
  var periodes = dbGetAllPeriodes();
  var periodeId = filters.periode_id ? Number(filters.periode_id) : (periodes.length ? periodes[0].id : null);
  var eleves = dbGetAllEleves(filters);

  var resultMap = {};
  var done = {};
  for (var i = 0; i < eleves.length; i++) {
    var e = eleves[i];
    if (!done[e.classe_id]) {
      done[e.classe_id] = true;
      var cr = dbGetClassResults(e.classe_id, periodeId);
      if (cr) {
        for (var j = 0; j < cr.results.length; j++) {
          resultMap[cr.results[j].eleve.id] = cr.results[j];
        }
      }
    }
  }

  var noteMax = dbGetNoteMax();
  var out = [];
  for (var k = 0; k < eleves.length; k++) {
    var el = eleves[k];
    var r = resultMap[el.id];
    var hasNotes = r && r.saisies > 0;
    out.push({
      id: el.id,
      classe_id: el.classe_id,
      nom: el.nom,
      prenom: el.prenom,
      matricule: el.matricule,
      sexe: el.sexe,
      classe_nom: el.classe_nom,
      cycle_nom: el.cycle_nom,
      montant_total_du: el.montant_total_du,
      solde_restant: el.solde_restant,
      moyenne_generale: r ? r.moyenne_generale : null,
      rang: r ? r.rang : null,
      mention: hasNotes ? gradeMention(r.moyenne_generale, noteMax) : '—',
      notes_saisies: r ? r.saisies : 0,
      notes_total: r ? r.total_notes : 0,
      a_des_notes: !!hasNotes
    });
  }

  if (filters.mention) {
    out = out.filter(function(x) { return x.mention === filters.mention; });
  }

  var sort = filters.sort || 'nom';
  out.sort(function(a, b) {
    if (sort === 'moyenne_desc' || sort === 'moyenne_asc') {
      var am = a.a_des_notes ? a.moyenne_generale : null;
      var bm = b.a_des_notes ? b.moyenne_generale : null;
      if (am === null && bm === null) return (a.nom + ' ' + a.prenom).localeCompare(b.nom + ' ' + b.prenom);
      if (am === null) return 1;
      if (bm === null) return -1;
      return sort === 'moyenne_desc' ? bm - am : am - bm;
    }
    if (sort === 'rang') {
      var ar = (a.rang === null || a.rang === undefined) ? 999999 : a.rang;
      var br = (b.rang === null || b.rang === undefined) ? 999999 : b.rang;
      if (ar !== br) return ar - br;
      return (a.nom + ' ' + a.prenom).localeCompare(b.nom + ' ' + b.prenom);
    }
    if (sort === 'matricule') return String(a.matricule || '').localeCompare(String(b.matricule || ''));
    if (sort === 'classe') {
      return String(a.classe_nom || '').localeCompare(String(b.classe_nom || '')) ||
             (a.nom + ' ' + a.prenom).localeCompare(b.nom + ' ' + b.prenom);
    }
    if (sort === 'nom_desc') return (b.nom + ' ' + b.prenom).localeCompare(a.nom + ' ' + a.prenom);
    return (a.nom + ' ' + a.prenom).localeCompare(b.nom + ' ' + b.prenom);
  });

  return out;
}

function dbGetGradesDashboardStats(periodeId) {
  var classes = dbGetAllClasses();
  var all = [];
  var byClasse = [];

  for (var i = 0; i < classes.length; i++) {
    var c = classes[i];
    var cr = dbGetClassResults(c.id, periodeId);
    if (!cr) continue;
    var withNotes = cr.results.filter(function(r) { return r.saisies > 0; });
    var avg = withNotes.length
      ? withNotes.reduce(function(s, r) { return s + r.moyenne_generale; }, 0) / withNotes.length
      : null;
    byClasse.push({
      classe_id: c.id,
      classe_nom: c.nom,
      cycle_nom: c.cycle_nom,
      effectif: cr.results.length,
      notes: withNotes.length,
      moyenne: avg
    });
    for (var j = 0; j < cr.results.length; j++) {
      var r = cr.results[j];
      all.push({
        eleve: r.eleve,
        classe_nom: c.nom,
        cycle_nom: c.cycle_nom,
        moyenne_generale: r.moyenne_generale,
        rang: r.rang,
        saisies: r.saisies,
        total_notes: r.total_notes
      });
    }
  }

  var withNotes = all.filter(function(r) { return r.saisies > 0; });
  var moyenne = withNotes.length
    ? withNotes.reduce(function(s, r) { return s + r.moyenne_generale; }, 0) / withNotes.length
    : null;
  var top = withNotes.slice().sort(function(a, b) {
    return b.moyenne_generale - a.moyenne_generale;
  }).slice(0, 5);

  var saisies = all.reduce(function(s, r) { return s + r.saisies; }, 0);
  var totalNotes = all.reduce(function(s, r) { return s + r.total_notes; }, 0);

  return {
    moyenne: moyenne,
    saisies: saisies,
    total_notes: totalNotes,
    nb_eleves: all.length,
    nb_notes: withNotes.length,
    top: top,
    by_classe: byClasse
  };
}

// ─── CYCLES ───────────────────────────────────────────────────────────────────

function dbGetAllCycles() {
  return _query(
    'SELECT * FROM cycles WHERE organization_id = ? ORDER BY COALESCE(ordre, 999) ASC, nom ASC',
    [currentOrgId]
  );
}

async function dbCreateCycle(nom, ordre) {
  db.run('INSERT INTO cycles (organization_id, nom, ordre) VALUES (?, ?, ?)',
    [currentOrgId, nom, ordre || null]);
  await saveDB();
}

async function dbUpdateCycle(id, nom, ordre) {
  db.run('UPDATE cycles SET nom = ?, ordre = ? WHERE id = ? AND organization_id = ?',
    [nom, ordre || null, id, currentOrgId]);
  await saveDB();
}

async function dbDeleteCycle(id) {
  var count = _query('SELECT COUNT(*) AS n FROM classes WHERE cycle_id = ? AND organization_id = ?', [id, currentOrgId])[0].n;
  if (count > 0) throw new Error('Ce cycle a des classes associées. Supprimez-les d\'abord.');
  db.run('DELETE FROM cycles WHERE id = ? AND organization_id = ?', [id, currentOrgId]);
  await saveDB();
}

// ─── CLASSES ──────────────────────────────────────────────────────────────────

function dbGetAllClasses() {
  return _query(`
    SELECT cl.*, cy.nom AS cycle_nom,
      o.style_id AS org_style_id,
      COALESCE(cl.style_id, o.style_id) AS style_id_effective,
      st.nom AS style_nom,
      (SELECT COUNT(*) FROM eleves e WHERE e.classe_id = cl.id AND e.actif = 1) AS nb_eleves,
      (SELECT COUNT(*) FROM classe_matieres cm WHERE cm.classe_id = cl.id) AS nb_matieres
    FROM classes cl
    JOIN cycles cy ON cl.cycle_id = cy.id
    LEFT JOIN organizations o ON o.id = cl.organization_id
    LEFT JOIN styles_notation st ON st.id = COALESCE(cl.style_id, o.style_id)
    WHERE cl.organization_id = ?
    ORDER BY cy.ordre ASC, cy.nom ASC, cl.nom ASC
  `, [currentOrgId]);
}

function dbGetClasseById(id) {
  var rows = _query(`
    SELECT cl.*, cy.nom AS cycle_nom,
      o.style_id AS org_style_id,
      COALESCE(cl.style_id, o.style_id) AS style_id_effective,
      st.nom AS style_nom,
      (SELECT COUNT(*) FROM eleves e WHERE e.classe_id = cl.id AND e.actif = 1) AS nb_eleves,
      (SELECT COUNT(*) FROM classe_matieres cm WHERE cm.classe_id = cl.id) AS nb_matieres
    FROM classes cl
    JOIN cycles cy ON cl.cycle_id = cy.id
    LEFT JOIN organizations o ON o.id = cl.organization_id
    LEFT JOIN styles_notation st ON st.id = COALESCE(cl.style_id, o.style_id)
    WHERE cl.id = ? AND cl.organization_id = ?
  `, [id, currentOrgId]);
  return rows[0] || null;
}

async function dbCreateClasse(cycle_id, nom, montant_inscription, montant_mensuel, annee_scolaire, style_id) {
  db.run(
    `INSERT INTO classes (organization_id, cycle_id, nom, montant_inscription, montant_mensuel, annee_scolaire, style_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [currentOrgId, cycle_id, nom, montant_inscription || 0, montant_mensuel || 0, annee_scolaire || null, style_id || null]
  );
  await saveDB();
}

async function dbUpdateClasse(id, cycle_id, nom, montant_inscription, montant_mensuel, annee_scolaire, style_id) {
  db.run(
    `UPDATE classes SET cycle_id = ?, nom = ?, montant_inscription = ?, montant_mensuel = ?,
       annee_scolaire = ?, style_id = ? WHERE id = ? AND organization_id = ?`,
    [cycle_id, nom, montant_inscription || 0, montant_mensuel || 0, annee_scolaire || null, style_id || null, id, currentOrgId]
  );
  await saveDB();
}

async function dbDeleteClasse(id) {
  var count = _query('SELECT COUNT(*) AS n FROM eleves WHERE classe_id = ? AND organization_id = ?', [id, currentOrgId])[0].n;
  if (count > 0) throw new Error('Cette classe a des élèves inscrits. Désinscrivez-les d\'abord.');
  var cms = _query('SELECT id FROM classe_matieres WHERE classe_id = ? AND organization_id = ?', [id, currentOrgId]);
  for (var i = 0; i < cms.length; i++) {
    db.run('DELETE FROM notes WHERE classe_matiere_id = ?', [cms[i].id]);
  }
  db.run('DELETE FROM classe_matieres WHERE classe_id = ? AND organization_id = ?', [id, currentOrgId]);
  db.run('DELETE FROM classes WHERE id = ? AND organization_id = ?', [id, currentOrgId]);
  await saveDB();
}

// ─── ÉLÈVES ───────────────────────────────────────────────────────────────────

async function dbCreateEleve(data) {
  db.run(
    `INSERT INTO eleves
     (organization_id, classe_id, nom, prenom, sexe, date_naissance, nom_parent, contact_parent,
      montant_total_du, solde_restant, matricule)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`,
    [currentOrgId, data.classe_id, data.nom, data.prenom, data.sexe || null,
     data.date_naissance || null, data.nom_parent || null, data.contact_parent || null,
     data.montant_total_du, data.montant_total_du]
  );
  var id = _query('SELECT last_insert_rowid() AS id')[0].id;
  var year = new Date().getFullYear();
  var matricule = 'EKL-' + year + '-' + String(id).padStart(4, '0');
  db.run('UPDATE eleves SET matricule = ? WHERE id = ?', [matricule, id]);
  await saveDB();
  return id;
}

function dbGetAllEleves(filters) {
  filters = filters || {};
  var sql = `
    SELECT e.*, c.nom AS classe_nom, cy.nom AS cycle_nom
    FROM eleves e
    JOIN classes c ON e.classe_id = c.id
    JOIN cycles cy ON c.cycle_id = cy.id
    WHERE e.actif = 1 AND e.organization_id = ?`;
  var params = [currentOrgId];
  if (filters.search) {
    sql += ' AND (e.nom LIKE ? OR e.prenom LIKE ? OR e.matricule LIKE ?)';
    var s = '%' + filters.search + '%';
    params.push(s, s, s);
  }
  if (filters.classe_id) { sql += ' AND e.classe_id = ?'; params.push(Number(filters.classe_id)); }
  if (filters.cycle_id)  { sql += ' AND c.cycle_id = ?';  params.push(Number(filters.cycle_id)); }
  if (filters.statut === 'solde')  sql += ' AND e.solde_restant <= 0';
  if (filters.statut === 'retard') sql += ' AND e.solde_restant > 0';
  sql += ' ORDER BY e.nom ASC, e.prenom ASC';
  return _query(sql, params);
}

function dbGetEleveById(id) {
  var rows = _query(`
    SELECT e.*, c.nom AS classe_nom, c.montant_inscription, c.montant_mensuel,
           cy.nom AS cycle_nom
    FROM eleves e
    JOIN classes c ON e.classe_id = c.id
    JOIN cycles cy ON c.cycle_id = cy.id
    WHERE e.id = ? AND e.organization_id = ?
  `, [id, currentOrgId]);
  return rows[0] || null;
}

async function dbUpdateEleve(id, data) {
  db.run(`
    UPDATE eleves SET
      nom = ?, prenom = ?, sexe = ?, date_naissance = ?,
      nom_parent = ?, contact_parent = ?, classe_id = ?
    WHERE id = ? AND organization_id = ?
  `, [
    data.nom, data.prenom, data.sexe || null,
    data.date_naissance || null, data.nom_parent || null,
    data.contact_parent || null, data.classe_id, id, currentOrgId
  ]);
  await saveDB();
}

async function dbDesactivateEleve(id) {
  db.run('UPDATE eleves SET actif = 0 WHERE id = ? AND organization_id = ?', [id, currentOrgId]);
  await saveDB();
}

// ─── PAIEMENTS ────────────────────────────────────────────────────────────────

function dbGetPaiementsByEleve(eleve_id) {
  return _query(
    'SELECT * FROM paiements WHERE eleve_id = ? AND organization_id = ? ORDER BY date_paiement DESC',
    [eleve_id, currentOrgId]
  );
}

async function dbCreatePaiement(eleve_id, montant, mode, reference, commentaire) {
  var ref = reference || (function() {
    var d = new Date();
    var ds = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var seq = _query('SELECT COUNT(*) AS n FROM paiements WHERE organization_id = ?', [currentOrgId])[0].n + 1;
    return 'REC-' + ds + '-' + String(seq).padStart(4, '0');
  })();
  db.run(
    'INSERT INTO paiements (organization_id, eleve_id, montant, mode_paiement, reference, commentaire) VALUES (?, ?, ?, ?, ?, ?)',
    [currentOrgId, eleve_id, montant, mode || null, ref, commentaire || null]
  );
  db.run('UPDATE eleves SET solde_restant = MAX(0, solde_restant - ?) WHERE id = ? AND organization_id = ?',
    [montant, eleve_id, currentOrgId]);
  await saveDB();
}

// ─── PARAMÈTRES ───────────────────────────────────────────────────────────────

function dbGetCurrency() {
  if (currentOrgId) {
    var r = _query("SELECT value FROM org_settings WHERE organization_id = ? AND key = 'currency'", [currentOrgId]);
    if (r.length && r[0].value) return r[0].value;
  }
  var g = _query("SELECT value FROM settings WHERE key = 'currency'");
  return g.length ? g[0].value : 'FCFA';
}

async function dbSetCurrency(code) {
  if (currentOrgId) {
    var r = _query("SELECT 1 FROM org_settings WHERE organization_id = ? AND key = 'currency'", [currentOrgId]);
    if (r.length) {
      db.run("UPDATE org_settings SET value = ? WHERE organization_id = ? AND key = 'currency'", [code, currentOrgId]);
    } else {
      db.run("INSERT INTO org_settings (organization_id, key, value) VALUES (?, 'currency', ?)", [currentOrgId, code]);
    }
  }
  db.run("UPDATE settings SET value = ? WHERE key = 'currency'", [code]);
  await saveDB();
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function dbGetDashboardStats() {
  var total = _query(
    'SELECT COUNT(*) AS n FROM eleves WHERE actif = 1 AND organization_id = ?',
    [currentOrgId]
  )[0].n;

  var collected = _query(`
    SELECT COALESCE(SUM(p.montant), 0) AS s
    FROM paiements p JOIN eleves e ON p.eleve_id = e.id
    WHERE e.actif = 1 AND e.organization_id = ?
  `, [currentOrgId])[0].s;

  var expected = _query(
    'SELECT COALESCE(SUM(montant_total_du), 0) AS s FROM eleves WHERE actif = 1 AND organization_id = ?',
    [currentOrgId]
  )[0].s;

  var enRetard = _query(`
    SELECT e.id, e.nom, e.prenom, e.matricule, e.solde_restant, c.nom AS classe_nom
    FROM eleves e JOIN classes c ON e.classe_id = c.id
    WHERE e.actif = 1 AND e.solde_restant > 0 AND e.organization_id = ?
    ORDER BY e.solde_restant DESC LIMIT 50
  `, [currentOrgId]);

  var retardTotal = _query(
    'SELECT COUNT(*) AS n FROM eleves WHERE actif = 1 AND solde_restant > 0 AND organization_id = ?',
    [currentOrgId]
  )[0].n;

  var byCycle = _query(`
    SELECT cy.nom, cy.id,
      (SELECT COUNT(*) FROM eleves e
        JOIN classes c2 ON e.classe_id = c2.id
        WHERE c2.cycle_id = cy.id AND e.actif = 1) AS eleves,
      (SELECT COALESCE(SUM(e.montant_total_du), 0) FROM eleves e
        JOIN classes c2 ON e.classe_id = c2.id
        WHERE c2.cycle_id = cy.id AND e.actif = 1) AS attendu,
      (SELECT COALESCE(SUM(p.montant), 0) FROM paiements p
        JOIN eleves e ON p.eleve_id = e.id
        JOIN classes c2 ON e.classe_id = c2.id
        WHERE c2.cycle_id = cy.id AND e.actif = 1) AS collecte
    FROM cycles cy
    WHERE cy.organization_id = ?
    ORDER BY cy.ordre ASC, cy.nom ASC
  `, [currentOrgId]);

  var monthly = _query(`
    SELECT strftime('%m', date_paiement) AS mois,
      COUNT(*) AS nb,
      COALESCE(SUM(montant), 0) AS total
    FROM paiements p
    JOIN eleves e ON p.eleve_id = e.id AND e.actif = 1
    WHERE e.organization_id = ? AND date_paiement >= date('now', '-11 months')
    GROUP BY mois ORDER BY mois ASC
  `, [currentOrgId]);

  return { total: total, collected: collected, expected: expected, enRetard: enRetard, retardTotal: retardTotal, byCycle: byCycle, monthly: monthly };
}
