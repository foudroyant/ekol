// ─── EXPORTS CSV / EXCEL ──────────────────────────────────────────────────────
// CSV : séparateur ";" + BOM UTF-8 (Excel FR).
// Excel : fichier .xls au format HTML, ouvert nativement par Excel, sans dépendance.

function exportCsvCell(value) {
  var s = (value === null || value === undefined) ? '' : String(value);
  if (/[";\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function exportBuildCSV(headers, rows) {
  var lines = [];
  lines.push(headers.map(exportCsvCell).join(';'));
  for (var i = 0; i < rows.length; i++) {
    lines.push(rows[i].map(exportCsvCell).join(';'));
  }
  return '\uFEFF' + lines.join('\r\n');
}

function _xlsEscape(value) {
  var s = (value === null || value === undefined) ? '' : String(value);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function exportBuildXLS(title, headers, rows) {
  var head = headers.map(function(h) { return '<th>' + _xlsEscape(h) + '</th>'; }).join('');
  var body = rows.map(function(r) {
    return '<tr>' + r.map(function(c) { return '<td>' + _xlsEscape(c) + '</td>'; }).join('') + '</tr>';
  }).join('');
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
    '<title>' + _xlsEscape(title) + '</title>' +
    '<style>table{border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:4px 6px;' +
    'font-family:Calibri,Arial,sans-serif;font-size:11pt}th{background:#eef2ff;font-weight:bold}' +
    'h3{font-family:Calibri,Arial,sans-serif}</style></head><body>' +
    '<h3>' + _xlsEscape(title) + '</h3><table><thead><tr>' + head + '</tr></thead>' +
    '<tbody>' + body + '</tbody></table></body></html>';
}

function exportSlug(s) {
  return String(s || 'export')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'export';
}

function exportTimestamp() {
  var d = new Date();
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
    '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
}

async function exportSaveText(defaultName, content, label, ext) {
  try {
    if (typeof Neutralino !== 'undefined' && Neutralino.os && Neutralino.filesystem) {
      var path = await Neutralino.os.showSaveDialog('Exporter — ' + label, {
        filters: [{ name: label, extensions: [ext] }],
        defaultPath: defaultName
      });
      if (!path) return false;
      await Neutralino.filesystem.writeFile(path, content);
    } else {
      var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
    }
    if (typeof showToast === 'function') showToast('Export réussi : ' + defaultName, 'success');
    return true;
  } catch (err) {
    if (typeof showToast === 'function') showToast('Erreur d\'export : ' + err.message, 'error');
    return false;
  }
}

async function exportDispatch(format, baseName, title, headers, rows) {
  if (format === 'xls') {
    return exportSaveText(baseName + '.xls', exportBuildXLS(title, headers, rows), 'Excel', 'xls');
  }
  return exportSaveText(baseName + '.csv', exportBuildCSV(headers, rows), 'CSV', 'csv');
}

function _exportPeriodeName(periodeId) {
  var p = dbGetPeriodeById(periodeId);
  return p ? p.nom : '—';
}

// ─── LISTE DES ÉTUDIANTS D'UNE CLASSE ─────────────────────────────────────────

async function exportClasseSummary(classeId, periodeId, format) {
  var cr = dbGetClassResults(classeId, periodeId);
  if (!cr) return;
  var headers = ['Matricule', 'Nom', 'Prénom', 'Sexe', 'Classe', 'Cycle', 'Période',
    'Notes saisies', 'Total notes', 'Moyenne générale', 'Rang', 'Mention'];
  var results = cr.results.slice().sort(function(a, b) {
    var ar = a.rang === null ? 999999 : a.rang;
    var br = b.rang === null ? 999999 : b.rang;
    if (ar !== br) return ar - br;
    return (a.eleve.nom + ' ' + a.eleve.prenom).localeCompare(b.eleve.nom + ' ' + b.eleve.prenom);
  });
  var rows = results.map(function(r) {
    var has = r.saisies > 0;
    return [
      r.eleve.matricule, r.eleve.nom, r.eleve.prenom, r.eleve.sexe || '',
      cr.classe.nom, cr.classe.cycle_nom, _exportPeriodeName(periodeId),
      r.saisies, r.total_notes,
      has ? gradeFormat(r.moyenne_generale) : '',
      r.rang === null ? '' : r.rang,
      has ? gradeMention(r.moyenne_generale, cr.note_max) : ''
    ];
  });
  var base = 'ekol-' + exportSlug(cr.classe.nom) + '-' + exportSlug(_exportPeriodeName(periodeId)) + '-etudiants-' + exportTimestamp();
  await exportDispatch(format, base, 'Liste des étudiants — ' + cr.classe.nom + ' — ' + _exportPeriodeName(periodeId), headers, rows);
}

// ─── NOTES DÉTAILLÉES D'UNE CLASSE ────────────────────────────────────────────

async function exportClasseDetailed(classeId, periodeId, format) {
  var cr = dbGetClassResults(classeId, periodeId);
  if (!cr) return;
  var headers = ['Matricule', 'Nom', 'Prénom', 'Classe', 'Période', 'Matière', 'Coefficient'];
  for (var c = 0; c < cr.composantes.length; c++) {
    headers.push(cr.composantes[c].nom + (cr.composantes[c].groupe ? ' (' + cr.composantes[c].groupe + ')' : ''));
  }
  headers.push('Moyenne matière', 'Moyenne pondérée', 'Moyenne générale', 'Rang', 'Mention');

  var rows = [];
  for (var i = 0; i < cr.results.length; i++) {
    var r = cr.results[i];
    for (var j = 0; j < r.rows.length; j++) {
      var row = r.rows[j];
      var line = [
        r.eleve.matricule, r.eleve.nom, r.eleve.prenom, cr.classe.nom,
        _exportPeriodeName(periodeId), row.matiere_nom, row.coefficient
      ];
      for (var k = 0; k < cr.composantes.length; k++) {
        var v = row.valeurs[cr.composantes[k].id];
        line.push(v === null || v === undefined ? '' : v);
      }
      line.push(row.moyenne === null ? '' : gradeFormat(row.moyenne));
      line.push(row.moyenne === null ? '' : gradeFormat(row.moyenne * row.coefficient));
      line.push(r.saisies > 0 ? gradeFormat(r.moyenne_generale) : '');
      line.push(r.rang === null ? '' : r.rang);
      line.push(r.saisies > 0 ? gradeMention(r.moyenne_generale, cr.note_max) : '');
      rows.push(line);
    }
  }

  var base = 'ekol-' + exportSlug(cr.classe.nom) + '-' + exportSlug(_exportPeriodeName(periodeId)) + '-notes-' + exportTimestamp();
  await exportDispatch(format, base, 'Notes détaillées — ' + cr.classe.nom + ' — ' + _exportPeriodeName(periodeId), headers, rows);
}

// ─── LISTE GÉNÉRALE DES ÉTUDIANTS (FILTRÉE / TRIÉE) ───────────────────────────

async function exportElevesList(eleves, periodeId, format) {
  var headers = ['Matricule', 'Nom', 'Prénom', 'Sexe', 'Classe', 'Cycle', 'Période',
    'Notes saisies', 'Total notes', 'Moyenne générale', 'Rang', 'Mention', 'Total dû', 'Solde restant'];
  var rows = eleves.map(function(e) {
    return [
      e.matricule, e.nom, e.prenom, e.sexe || '', e.classe_nom, e.cycle_nom,
      _exportPeriodeName(periodeId), e.notes_saisies, e.notes_total,
      e.a_des_notes ? gradeFormat(e.moyenne_generale) : '',
      e.rang === null || e.rang === undefined ? '' : e.rang,
      e.mention === '—' ? '' : e.mention,
      e.montant_total_du, e.solde_restant
    ];
  });
  var base = 'ekol-etudiants-' + exportSlug(_exportPeriodeName(periodeId)) + '-' + exportTimestamp();
  await exportDispatch(format, base, 'Liste des étudiants — ' + _exportPeriodeName(periodeId), headers, rows);
}

// ─── FICHE D'UN ÉTUDIANT ──────────────────────────────────────────────────────

async function exportEleveFiche(eleveId, periodeId, format) {
  var sr = dbGetStudentResult(eleveId, periodeId);
  if (!sr || !sr.result) return;
  var headers = ['Matière', 'Coefficient'];
  for (var c = 0; c < sr.composantes.length; c++) {
    headers.push(sr.composantes[c].nom + (sr.composantes[c].groupe ? ' (' + sr.composantes[c].groupe + ')' : ''));
  }
  headers.push('Moyenne matière', 'Moyenne pondérée');

  var rows = sr.result.rows.map(function(row) {
    var line = [row.matiere_nom, row.coefficient];
    for (var k = 0; k < sr.composantes.length; k++) {
      var v = row.valeurs[sr.composantes[k].id];
      line.push(v === null || v === undefined ? '' : v);
    }
    line.push(row.moyenne === null ? '' : gradeFormat(row.moyenne));
    line.push(row.moyenne === null ? '' : gradeFormat(row.moyenne * row.coefficient));
    return line;
  });

  rows.push([]);
  rows.push(['Élève', sr.eleve.prenom + ' ' + sr.eleve.nom]);
  rows.push(['Matricule', sr.eleve.matricule]);
  rows.push(['Classe', sr.classe.cycle_nom + ' › ' + sr.classe.nom]);
  rows.push(['Période', _exportPeriodeName(periodeId)]);
  rows.push(['Moyenne générale', sr.result.saisies > 0 ? gradeFormat(sr.result.moyenne_generale) : '']);
  rows.push(['Rang', sr.result.rang === null ? '' : sr.result.rang]);
  rows.push(['Mention', sr.result.saisies > 0 ? gradeMention(sr.result.moyenne_generale, sr.note_max) : '']);
  rows.push(['Notes saisies', sr.result.saisies + ' / ' + sr.result.total_notes]);

  var base = 'ekol-fiche-' + exportSlug(sr.eleve.matricule) + '-' + exportSlug(_exportPeriodeName(periodeId)) + '-' + exportTimestamp();
  await exportDispatch(format, base, 'Fiche de notes — ' + sr.eleve.prenom + ' ' + sr.eleve.nom, headers, rows);
}
