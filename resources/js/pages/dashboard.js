function renderDashboard() {
  var stats = dbGetDashboardStats();
  var pct = stats.expected > 0 ? Math.round((stats.collected / stats.expected) * 100) : 0;
  var pctCapped = Math.min(pct, 100);

  var retardRows = stats.enRetard.map(function(e) {
    return '<tr>' +
      '<td>' + e.matricule + '</td>' +
      '<td class="font-medium">' + e.prenom + ' ' + e.nom + '</td>' +
      '<td>' + e.classe_nom + '</td>' +
      '<td class="font-semibold text-red-600">' + formatMoney(e.solde_restant) + '</td>' +
      '<td><a href="#/eleve/' + e.id + '" class="btn btn-sm btn-secondary">Voir</a></td>' +
      '</tr>';
  }).join('');

  var cycleRows = stats.byCycle.map(function(c) {
    var cpct = c.attendu > 0 ? Math.round((c.collecte / c.attendu) * 100) : 0;
    return '<tr>' +
      '<td class="font-medium">' + c.nom + '</td>' +
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

  document.getElementById('app').innerHTML =
    '<h1 class="page-title">Tableau de bord</h1>' +

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

    '<div class="grid grid-cols-2 gap-5 mb-8">' +

      '<div class="card">' +
        '<div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-700">Collecte par cycle</div>' +
        '<table>' +
          '<thead><tr><th>Cycle</th><th>Élèves</th><th>Attendu</th><th>Collecté</th><th>Taux</th></tr></thead>' +
          '<tbody>' + cycleRows + '</tbody>' +
        '</table>' +
      '</div>' +

      '<div class="card p-6">' +
        '<div class="font-semibold text-gray-700 mb-4">Tendance mensuelle (12 mois)</div>' +
        '<div class="flex items-end gap-2" style="height:120px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">' +
          stats.monthly.map(function(m) {
            var h = Math.round((m.total / maxMonthly) * 100);
            return '<div class="flex-1 flex flex-col items-center justify-end">' +
              '<div class="text-xs text-gray-400 font-medium mb-1">' + formatMoney(m.total) + '</div>' +
              '<div style="height:' + Math.max(h, 4) + '%;width:100%;background:#4f46e5;border-radius:4px 4px 0 0;min-height:4px"></div>' +
              '<div class="text-xs text-gray-500 mt-1">' + months[parseInt(m.mois) - 1] + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +

    '</div>' +

    '<div class="card">' +
      '<div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">' +
        '<span class="font-semibold text-gray-700">Élèves en retard de paiement</span>' +
        '<span class="text-xs text-gray-400">' + stats.enRetard.length + ' élève(s)</span>' +
      '</div>' +
      '<table>' +
        '<thead><tr>' +
          '<th>Matricule</th><th>Nom</th><th>Classe</th><th>Solde restant</th><th></th>' +
        '</tr></thead>' +
        '<tbody>' + (retardRows || '<tr><td colspan="5" class="text-center py-10 text-gray-400">Tous les élèves sont à jour ✓</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';
}
