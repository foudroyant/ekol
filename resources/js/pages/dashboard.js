// ─── Bandeau Cloud : alerte si désynchronisé ou sans abonnement ──────────────
function cloudBanner() {
  if (typeof cloudIsLinked !== 'function' || typeof canManage !== 'function') return '';
  if (!canManage()) return '';
  var linked = false;
  try { linked = cloudIsLinked(); } catch (e) { return ''; }
  if (!linked) return '';
  var dirty = (typeof _cloudDirty !== 'undefined') && _cloudDirty;
  var st = (typeof _cloudLastStatus !== 'undefined') ? _cloudLastStatus : null;
  if (st && st.state === 'synced' && !dirty) return '';
  var label = (typeof cloudStatusLabel === 'function') ? cloudStatusLabel(st) : null;
  var text = label ? label.text : (dirty ? 'Modifications locales non synchronisées' : 'Vérification cloud en attente');
  var isErr = !!((label && label.level === 'error') || (st && st.state === 'no-sub'));
  var cls = isErr ? 'border-red-200 bg-red-50' : 'bg-indigo-50 border border-indigo-100';
  return '<div class="card p-4 mb-5 ' + cls + '">' +
    '<div class="flex items-center justify-between flex-wrap gap-2">' +
      '<div class="text-sm text-indigo-900"><span class="font-semibold">Cloud : </span>' + escapeHtml(text) + '</div>' +
      '<a href="#/cloud" class="btn btn-sm btn-secondary">' + (isErr ? 'Gérer l\'abonnement' : 'Ouvrir Cloud') + '</a>' +
    '</div>' +
  '</div>';
}

function renderDashboard() {
  var stats = dbGetDashboardStats();
  var pct = stats.expected > 0 ? Math.round((stats.collected / stats.expected) * 100) : 0;
  var pctCapped = Math.min(pct, 100);

  var periodes = dbGetAllPeriodes();
  var periode = periodes.length ? periodes[0] : null;
  var gradeStats = periode ? dbGetGradesDashboardStats(periode.id) : null;
  var noteMax = dbGetNoteMax();

  var retardRows = stats.enRetard.map(function(e) {
    return '<tr>' +
      '<td>' + escapeHtml(e.matricule) + '</td>' +
      '<td class="font-medium">' + escapeHtml(e.prenom + ' ' + e.nom) + '</td>' +
      '<td>' + escapeHtml(e.classe_nom) + '</td>' +
      '<td class="font-semibold text-red-600">' + formatMoney(e.solde_restant) + '</td>' +
      '<td><a href="#/eleve/' + e.id + '" class="btn btn-sm btn-secondary">Voir</a></td>' +
      '</tr>';
  }).join('');

  var cycleRows = stats.byCycle.map(function(c) {
    var cpct = c.attendu > 0 ? Math.round((c.collecte / c.attendu) * 100) : 0;
    return '<tr>' +
      '<td class="font-medium">' + escapeHtml(c.nom) + '</td>' +
      '<td>' + c.eleves + ' élève(s)</td>' +
      '<td>' + formatMoney(c.attendu) + '</td>' +
      '<td>' + formatMoney(c.collecte) + '</td>' +
      '<td>' +
        '<div class="flex items-center gap-2">' +
          '<div class="progress-bar-outer flex-1 mb-0" style="margin-top:0"><div class="progress-bar-inner" style="width:' + Math.min(cpct, 100) + '%"></div></div>' +
          '<span class="text-xs font-medium text-gray-500">' + cpct + '%</span>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');

  var months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  var maxMonthly = stats.monthly.length > 0 ? Math.max.apply(null, stats.monthly.map(function(m) { return m.total; })) : 1;

  // ── Bloc notes ──
  var gradeCards = '';
  if (periode && gradeStats) {
    var bestClasse = null;
    for (var i = 0; i < gradeStats.by_classe.length; i++) {
      var bc = gradeStats.by_classe[i];
      if (bc.moyenne !== null && (!bestClasse || bc.moyenne > bestClasse.moyenne)) bestClasse = bc;
    }
    var notesPct = gradeStats.total_notes > 0 ? Math.round((gradeStats.saisies / gradeStats.total_notes) * 100) : 0;

    gradeCards =
      '<div class="grid grid-cols-4 gap-5 mb-8">' +
        '<div class="card p-6">' +
          '<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Moyenne générale · ' + escapeHtml(periode.nom) + '</div>' +
          '<div class="stat-card-value text-indigo-700 mt-2">' + (gradeStats.moyenne === null ? '—' : gradeFormat(gradeStats.moyenne) + ' /' + noteMax) + '</div>' +
        '</div>' +
        '<div class="card p-6">' +
          '<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes saisies</div>' +
          '<div class="stat-card-value text-gray-700 mt-2">' + gradeStats.saisies + ' / ' + gradeStats.total_notes + '</div>' +
          '<div class="progress-bar-outer mt-3"><div class="progress-bar-inner" style="width:' + Math.min(notesPct, 100) + '%"></div></div>' +
          '<div class="text-xs text-gray-400 mt-1">' + notesPct + '% de complétion</div>' +
        '</div>' +
        '<div class="card p-6">' +
          '<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Élèves notés</div>' +
          '<div class="stat-card-value text-gray-700 mt-2">' + gradeStats.nb_notes + '</div>' +
          '<div class="text-xs text-gray-400 mt-1">sur ' + gradeStats.nb_eleves + ' élève(s)</div>' +
        '</div>' +
        '<div class="card p-6">' +
          '<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Meilleure classe</div>' +
          '<div class="text-lg font-bold text-indigo-700 mt-2">' + (bestClasse ? escapeHtml(bestClasse.classe_nom) : '—') + '</div>' +
          '<div class="text-xs text-gray-400 mt-1">' + (bestClasse ? 'Moyenne ' + gradeFormat(bestClasse.moyenne) : 'Aucune note') + '</div>' +
        '</div>' +
      '</div>';
  }

  var topRows = '';
  if (gradeStats && gradeStats.top.length) {
    topRows = gradeStats.top.map(function(t, idx) {
      var mention = gradeMention(t.moyenne_generale, noteMax);
      return '<tr>' +
        '<td class="font-bold text-indigo-700">' + (idx + 1) + '</td>' +
        '<td class="font-medium">' + escapeHtml(t.eleve.prenom + ' ' + t.eleve.nom) + '</td>' +
        '<td class="text-xs text-gray-500">' + escapeHtml(t.classe_nom) + '</td>' +
        '<td class="font-semibold">' + gradeFormat(t.moyenne_generale) + '</td>' +
        '<td><span class="' + gradeMentionClass(mention) + '">' + mention + '</span></td>' +
      '</tr>';
    }).join('');
  } else {
    topRows = '<tr><td colspan="5" class="empty-state">Aucune note saisie pour cette période.</td></tr>';
  }

  var classRows = '';
  if (gradeStats && gradeStats.by_classe.length) {
    classRows = gradeStats.by_classe.map(function(c) {
      return '<tr>' +
        '<td class="font-medium">' + escapeHtml(c.classe_nom) + '</td>' +
        '<td class="text-xs text-gray-500">' + escapeHtml(c.cycle_nom) + '</td>' +
        '<td>' + c.effectif + '</td>' +
        '<td>' + c.notes + '</td>' +
        '<td class="font-semibold">' + (c.moyenne === null ? '—' : gradeFormat(c.moyenne)) + '</td>' +
      '</tr>';
    }).join('');
  } else {
    classRows = '<tr><td colspan="5" class="empty-state">Aucune classe.</td></tr>';
  }

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<h1 class="page-title mb-0">Tableau de bord</h1>' +
      (periode ? '<span class="chip chip-indigo">Période : ' + escapeHtml(periode.nom) + '</span>' : '') +
    '</div>' +

    cloudBanner() +

    '<div class="grid grid-cols-4 gap-5 mb-8">' +
      '<div class="card p-6">' +
        '<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Élèves actifs</div>' +
        '<div class="stat-card-value text-indigo-700 mt-2">' + stats.total + '</div>' +
      '</div>' +
      '<div class="card p-6">' +
        '<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total collecté</div>' +
        '<div class="stat-card-value text-green-600 mt-2">' + formatMoney(stats.collected) + '</div>' +
      '</div>' +
      '<div class="card p-6">' +
        '<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total attendu</div>' +
        '<div class="stat-card-value text-gray-700 mt-2">' + formatMoney(stats.expected) + '</div>' +
      '</div>' +
      '<div class="card p-6">' +
        '<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Taux de collecte</div>' +
        '<div class="stat-card-value text-gray-700 mt-2">' + pct + '%</div>' +
        '<div class="progress-bar-outer mt-3">' +
          '<div class="progress-bar-inner" style="width:' + pctCapped + '%"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    gradeCards +

    '<div class="grid grid-cols-2 gap-5 mb-8">' +
      '<div class="card">' +
        '<div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-700">Top 5 élèves' +
          (periode ? ' · ' + escapeHtml(periode.nom) : '') + '</div>' +
        '<table>' +
          '<thead><tr><th>#</th><th>Élève</th><th>Classe</th><th>Moyenne</th><th>Mention</th></tr></thead>' +
          '<tbody>' + topRows + '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="card">' +
        '<div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-700">Moyennes par classe</div>' +
        '<table>' +
          '<thead><tr><th>Classe</th><th>Cycle</th><th>Effectif</th><th>Notés</th><th>Moyenne</th></tr></thead>' +
          '<tbody>' + classRows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>' +

    '<div class="grid grid-cols-2 gap-5 mb-8">' +
      '<div class="card">' +
        '<div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-700">Collecte par cycle</div>' +
        '<table>' +
          '<thead><tr><th>Cycle</th><th>Élèves</th><th>Attendu</th><th>Collecté</th><th>Taux</th></tr></thead>' +
          '<tbody>' + (cycleRows || '<tr><td colspan="5" class="empty-state">Aucun cycle.</td></tr>') + '</tbody>' +
        '</table>' +
      '</div>' +

      '<div class="card p-6">' +
        '<div class="font-semibold text-gray-700 mb-4">Tendance mensuelle (12 mois)</div>' +
        '<div class="flex items-end gap-2" style="height:120px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">' +
          (stats.monthly.length
            ? stats.monthly.map(function(m) {
                var h = Math.round((m.total / maxMonthly) * 100);
                return '<div class="flex-1 flex flex-col items-center justify-end">' +
                  '<div class="text-xs text-gray-400 font-medium mb-1">' + formatMoney(m.total) + '</div>' +
                  '<div style="height:' + Math.max(h, 4) + '%;width:100%;background:#4f46e5;border-radius:4px 4px 0 0;min-height:4px"></div>' +
                  '<div class="text-xs text-gray-500 mt-1">' + months[parseInt(m.mois) - 1] + '</div>' +
                '</div>';
              }).join('')
            : '<div class="empty-state w-full">Aucun paiement sur la période.</div>') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">' +
        '<span class="font-semibold text-gray-700">Élèves en retard de paiement</span>' +
        '<span class="text-xs text-gray-400">' + stats.retardTotal + ' élève(s)</span>' +
      '</div>' +
      '<table>' +
        '<thead><tr>' +
          '<th>Matricule</th><th>Nom</th><th>Classe</th><th>Solde restant</th><th></th>' +
        '</tr></thead>' +
        '<tbody>' + (retardRows || '<tr><td colspan="5" class="empty-state">Tous les élèves sont à jour ✓</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';
}
