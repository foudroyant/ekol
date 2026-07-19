var SQL = null;
var db  = null;
var DB_PATH = null;

async function initDB() {
  var wasmBinary = Uint8Array.from(atob(_WASM_B64), function(c) { return c.charCodeAt(0); });
  SQL = await initSqlJs({ wasmBinary: wasmBinary });

  DB_PATH = NL_PATH + '/ekol.db';

  try {
    var buf = await Neutralino.filesystem.readBinaryFile(DB_PATH);
    db = new SQL.Database(new Uint8Array(buf));
    _runSchema();
  } catch (e) {
    db = new SQL.Database();
    _runSchema();
    await saveDB();
  }
}

async function saveDB() {
  await Neutralino.filesystem.writeBinaryFile(DB_PATH, db.export().buffer);
}

function _runSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      ordre INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id),
      nom TEXT NOT NULL,
      montant_inscription REAL NOT NULL DEFAULT 0,
      montant_mensuel REAL NOT NULL DEFAULT 0,
      annee_scolaire TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS eleves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      eleve_id INTEGER NOT NULL REFERENCES eleves(id),
      montant REAL NOT NULL,
      mode_paiement TEXT,
      reference TEXT,
      date_paiement TEXT DEFAULT CURRENT_TIMESTAMP,
      commentaire TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'FCFA')");
}

function _query(sql, params) {
  var stmt = db.prepare(sql);
  if (params && params.length > 0) stmt.bind(params);
  var rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ─── CYCLES ───────────────────────────────────────────────────────────────────

function dbGetAllCycles() {
  return _query('SELECT * FROM cycles ORDER BY COALESCE(ordre, 999) ASC, nom ASC');
}

async function dbCreateCycle(nom, ordre) {
  db.run('INSERT INTO cycles (nom, ordre) VALUES (?, ?)', [nom, ordre || null]);
  await saveDB();
}

async function dbUpdateCycle(id, nom, ordre) {
  db.run('UPDATE cycles SET nom = ?, ordre = ? WHERE id = ?', [nom, ordre || null, id]);
  await saveDB();
}

async function dbDeleteCycle(id) {
  var count = _query('SELECT COUNT(*) as n FROM classes WHERE cycle_id = ?', [id])[0].n;
  if (count > 0) throw new Error('Ce cycle a des classes associées. Supprimez-les d\'abord.');
  db.run('DELETE FROM cycles WHERE id = ?', [id]);
  await saveDB();
}

// ─── CLASSES ──────────────────────────────────────────────────────────────────

function dbGetAllClasses() {
  return _query(`
    SELECT cl.*, cy.nom as cycle_nom
    FROM classes cl
    JOIN cycles cy ON cl.cycle_id = cy.id
    ORDER BY cy.ordre ASC, cy.nom ASC, cl.nom ASC
  `);
}

function dbGetClasseById(id) {
  var rows = _query(`
    SELECT cl.*, cy.nom as cycle_nom
    FROM classes cl
    JOIN cycles cy ON cl.cycle_id = cy.id
    WHERE cl.id = ?
  `, [id]);
  return rows[0] || null;
}

async function dbCreateClasse(cycle_id, nom, montant_inscription, montant_mensuel, annee_scolaire) {
  db.run(
    'INSERT INTO classes (cycle_id, nom, montant_inscription, montant_mensuel, annee_scolaire) VALUES (?,?,?,?,?)',
    [cycle_id, nom, montant_inscription || 0, montant_mensuel || 0, annee_scolaire || null]
  );
  await saveDB();
}

async function dbUpdateClasse(id, cycle_id, nom, montant_inscription, montant_mensuel, annee_scolaire) {
  db.run(
    'UPDATE classes SET cycle_id=?, nom=?, montant_inscription=?, montant_mensuel=?, annee_scolaire=? WHERE id=?',
    [cycle_id, nom, montant_inscription || 0, montant_mensuel || 0, annee_scolaire || null, id]
  );
  await saveDB();
}

async function dbDeleteClasse(id) {
  var count = _query('SELECT COUNT(*) as n FROM eleves WHERE classe_id = ?', [id])[0].n;
  if (count > 0) throw new Error('Cette classe a des élèves inscrits. Désinscrivez-les d\'abord.');
  db.run('DELETE FROM classes WHERE id = ?', [id]);
  await saveDB();
}

// ─── ÉLÈVES ───────────────────────────────────────────────────────────────────

async function dbCreateEleve(data) {
  db.run(
    `INSERT INTO eleves
     (classe_id, nom, prenom, sexe, date_naissance, nom_parent, contact_parent,
      montant_total_du, solde_restant, matricule)
     VALUES (?,?,?,?,?,?,?,?,?,'')`,
    [data.classe_id, data.nom, data.prenom, data.sexe || null,
     data.date_naissance || null, data.nom_parent || null, data.contact_parent || null,
     data.montant_total_du, data.montant_total_du]
  );
  var id = _query('SELECT last_insert_rowid() as id')[0].id;
  var year = new Date().getFullYear();
  var matricule = 'EKL-' + year + '-' + String(id).padStart(4, '0');
  db.run('UPDATE eleves SET matricule = ? WHERE id = ?', [matricule, id]);
  await saveDB();
  return id;
}

function dbGetAllEleves(filters) {
  filters = filters || {};
  var sql = `
    SELECT e.*, c.nom as classe_nom, cy.nom as cycle_nom
    FROM eleves e
    JOIN classes c ON e.classe_id = c.id
    JOIN cycles cy ON c.cycle_id = cy.id
    WHERE e.actif = 1`;
  var params = [];
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
  return _query(sql, params.length ? params : null);
}

function dbGetEleveById(id) {
  var rows = _query(`
    SELECT e.*, c.nom as classe_nom, c.montant_inscription, c.montant_mensuel,
           cy.nom as cycle_nom
    FROM eleves e
    JOIN classes c ON e.classe_id = c.id
    JOIN cycles cy ON c.cycle_id = cy.id
    WHERE e.id = ?
  `, [id]);
  return rows[0] || null;
}

// ─── PAIEMENTS ────────────────────────────────────────────────────────────────

function dbGetPaiementsByEleve(eleve_id) {
  return _query(
    'SELECT * FROM paiements WHERE eleve_id = ? ORDER BY date_paiement DESC',
    [eleve_id]
  );
}

async function dbCreatePaiement(eleve_id, montant, mode, reference, commentaire) {
  var ref = reference || (function() {
    var d = new Date();
    var ds = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var seq = _query('SELECT COUNT(*) as n FROM paiements')[0].n + 1;
    return 'REC-' + ds + '-' + String(seq).padStart(4, '0');
  })();
  db.run(
    'INSERT INTO paiements (eleve_id, montant, mode_paiement, reference, commentaire) VALUES (?,?,?,?,?)',
    [eleve_id, montant, mode || null, ref, commentaire || null]
  );
  db.run('UPDATE eleves SET solde_restant = MAX(0, solde_restant - ?) WHERE id = ?', [montant, eleve_id]);
  await saveDB();
}

async function dbUpdateEleve(id, data) {
  db.run(`
    UPDATE eleves SET
      nom = ?, prenom = ?, sexe = ?, date_naissance = ?,
      nom_parent = ?, contact_parent = ?, classe_id = ?
    WHERE id = ?
  `, [
    data.nom, data.prenom, data.sexe || null,
    data.date_naissance || null, data.nom_parent || null,
    data.contact_parent || null, data.classe_id, id
  ]);
  await saveDB();
}

async function dbDesactivateEleve(id) {
  db.run('UPDATE eleves SET actif = 0 WHERE id = ?', [id]);
  await saveDB();
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

function dbGetCurrency() {
  var r = _query("SELECT value FROM settings WHERE key = 'currency'");
  return r.length ? r[0].value : 'FCFA';
}

async function dbSetCurrency(code) {
  db.run("UPDATE settings SET value = ? WHERE key = 'currency'", [code]);
  await saveDB();
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function dbGetDashboardStats() {
  var total     = _query('SELECT COUNT(*) as n FROM eleves WHERE actif = 1')[0].n;
  var collected = _query(`
    SELECT COALESCE(SUM(p.montant), 0) as s
    FROM paiements p JOIN eleves e ON p.eleve_id = e.id WHERE e.actif = 1
  `)[0].s;
  var expected  = _query('SELECT COALESCE(SUM(montant_total_du), 0) as s FROM eleves WHERE actif = 1')[0].s;
  var enRetard  = _query(`
    SELECT e.id, e.nom, e.prenom, e.matricule, e.solde_restant, c.nom as classe_nom
    FROM eleves e JOIN classes c ON e.classe_id = c.id
    WHERE e.actif = 1 AND e.solde_restant > 0
    ORDER BY e.solde_restant DESC LIMIT 50
  `);
  var byCycle = _query(`
    SELECT cy.nom, cy.id,
      COUNT(e.id) as eleves,
      COALESCE(SUM(e.montant_total_du), 0) as attendu,
      COALESCE(SUM(p.montant), 0) as collecte
    FROM cycles cy
    LEFT JOIN classes c ON c.cycle_id = cy.id
    LEFT JOIN eleves e ON e.classe_id = c.id AND e.actif = 1
    LEFT JOIN paiements p ON p.eleve_id = e.id
    GROUP BY cy.id ORDER BY cy.ordre ASC, cy.nom ASC
  `);
  var monthly = _query(`
    SELECT strftime('%m', date_paiement) as mois,
      COUNT(*) as nb,
      COALESCE(SUM(montant), 0) as total
    FROM paiements p
    JOIN eleves e ON p.eleve_id = e.id AND e.actif = 1
    WHERE date_paiement >= date('now', '-11 months')
    GROUP BY mois ORDER BY mois ASC
  `);
  return { total: total, collected: collected, expected: expected, enRetard: enRetard, byCycle: byCycle, monthly: monthly };
}
