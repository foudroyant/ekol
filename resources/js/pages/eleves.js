function _buildElevesTable(eleves) {
  if (!eleves.length) {
    return '<tr><td colspan="6" class="text-center py-10 text-gray-400">Aucun élève trouvé.</td></tr>';
  }
  return eleves.map(function(e) {
    var isSolde = e.solde_restant <= 0;
    return '<tr>' +
      '<td class="font-mono text-xs text-gray-500">' + e.matricule + '</td>' +
      '<td class="font-medium">' + e.prenom + ' ' + e.nom + '</td>' +
      '<td><span class="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">' + e.cycle_nom + ' › ' + e.classe_nom + '</span></td>' +
      '<td>' + formatMoney(e.montant_total_du) + '</td>' +
      '<td>' +
        '<span class="' + (isSolde ? 'badge-solde' : 'badge-retard') + '">' +
          (isSolde ? 'Soldé' : formatMoney(e.solde_restant) + ' restant') +
        '</span>' +
      '</td>' +
      '<td><a href="#/eleve/' + e.id + '" class="btn btn-sm btn-secondary">Voir</a></td>' +
    '</tr>';
  }).join('');
}

function renderEleves() {
  var classes = dbGetAllClasses();
  var cycles  = dbGetAllCycles();
  var eleves  = dbGetAllEleves({});

  var classeOptions = classes.map(function(c) {
    return '<option value="' + c.id + '">' + c.cycle_nom + ' › ' + c.nom + '</option>';
  }).join('');
  var cycleOptions = cycles.map(function(c) {
    return '<option value="' + c.id + '">' + c.nom + '</option>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<h1 class="page-title mb-0">Élèves</h1>' +
      '<a href="#/inscription" class="btn btn-primary">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' +
        'Nouvelle inscription' +
      '</a>' +
    '</div>' +

    '<div class="card p-4 mb-5">' +
      '<div class="grid grid-cols-4 gap-3">' +
        '<input type="text" id="f-search" class="form-input col-span-2" placeholder="Rechercher par nom, prénom, matricule...">' +
        '<select id="f-cycle" class="form-input"><option value="">Tous les cycles</option>' + cycleOptions + '</select>' +
        '<select id="f-classe" class="form-input"><option value="">Toutes les classes</option>' + classeOptions + '</select>' +
        '<select id="f-statut" class="form-input col-span-2"><option value="">Tous les statuts</option><option value="solde">Soldé</option><option value="retard">En retard</option></select>' +
        '<div class="col-span-2 flex items-center text-sm text-gray-400" id="f-count">' + eleves.length + ' élève(s)</div>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<table>' +
        '<thead><tr><th>Matricule</th><th>Nom</th><th>Classe</th><th>Total dû</th><th>Solde</th><th></th></tr></thead>' +
        '<tbody id="eleves-tbody">' + _buildElevesTable(eleves) + '</tbody>' +
      '</table>' +
    '</div>';

  function doFilter() {
    var filtered = dbGetAllEleves({
      search:    document.getElementById('f-search').value.trim(),
      cycle_id:  document.getElementById('f-cycle').value,
      classe_id: document.getElementById('f-classe').value,
      statut:    document.getElementById('f-statut').value
    });
    document.getElementById('eleves-tbody').innerHTML = _buildElevesTable(filtered);
    document.getElementById('f-count').textContent = filtered.length + ' élève(s)';
  }

  document.getElementById('f-search').addEventListener('input', doFilter);
  document.getElementById('f-cycle').addEventListener('change', doFilter);
  document.getElementById('f-classe').addEventListener('change', doFilter);
  document.getElementById('f-statut').addEventListener('change', doFilter);
}

function renderInscriptionForm() {
  var classes = dbGetAllClasses();

  if (classes.length === 0) {
    document.getElementById('app').innerHTML =
      '<a href="#/eleves" class="back-link mb-4 inline-flex">← Retour</a>' +
      '<div class="card p-8 text-center text-gray-500 max-w-md mx-auto mt-8">' +
        '<p class="text-lg font-medium mb-2">Aucune classe disponible</p>' +
        '<p class="text-sm">Créez d\'abord un cycle et une classe avant d\'inscrire un élève.</p>' +
        '<div class="flex gap-3 justify-center mt-4">' +
          '<a href="#/cycles" class="btn btn-secondary">Gérer les cycles</a>' +
          '<a href="#/classes" class="btn btn-primary">Gérer les classes</a>' +
        '</div>' +
      '</div>';
    return;
  }

  var classeOptions = classes.map(function(c) {
    return '<option value="' + c.id + '"' +
      ' data-inscription="' + c.montant_inscription + '"' +
      ' data-mensuel="' + c.montant_mensuel + '">' +
      c.cycle_nom + ' › ' + c.nom + (c.annee_scolaire ? ' (' + c.annee_scolaire + ')' : '') +
      '</option>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center gap-3 mb-6">' +
      '<a href="#/eleves" class="back-link">← Retour aux élèves</a>' +
      '<span class="text-gray-300">/</span>' +
      '<h1 class="text-xl font-bold text-gray-800">Nouvelle inscription</h1>' +
    '</div>' +

    '<div class="card p-8 max-w-2xl">' +
      '<form id="inscription-form" class="space-y-5">' +

        '<div>' +
          '<label class="form-label">Classe *</label>' +
          '<select name="classe_id" id="sel-classe" required class="form-input">' +
            '<option value="">— Choisir une classe —</option>' + classeOptions +
          '</select>' +
        '</div>' +

        '<div class="grid grid-cols-2 gap-4">' +
          '<div>' +
            '<label class="form-label">Nom *</label>' +
            '<input type="text" name="nom" required class="form-input" placeholder="NOM (majuscules)">' +
          '</div>' +
          '<div>' +
            '<label class="form-label">Prénom *</label>' +
            '<input type="text" name="prenom" required class="form-input" placeholder="Prénom">' +
          '</div>' +
          '<div>' +
            '<label class="form-label">Sexe</label>' +
            '<select name="sexe" class="form-input"><option value="">—</option><option>Masculin</option><option>Féminin</option></select>' +
          '</div>' +
          '<div>' +
            '<label class="form-label">Date de naissance</label>' +
            '<input type="date" name="date_naissance" class="form-input">' +
          '</div>' +
          '<div>' +
            '<label class="form-label">Nom du parent</label>' +
            '<input type="text" name="nom_parent" class="form-input" placeholder="Nom complet">' +
          '</div>' +
          '<div>' +
            '<label class="form-label">Contact parent</label>' +
            '<input type="text" name="contact_parent" class="form-input" placeholder="Téléphone">' +
          '</div>' +
        '</div>' +

        '<div class="bg-indigo-50 rounded-xl p-5 border border-indigo-100">' +
          '<div class="text-sm font-semibold text-indigo-800 mb-3">Calcul du montant dû</div>' +
          '<div class="space-y-2 text-sm">' +
            '<div class="flex justify-between items-center">' +
              '<span class="text-gray-600">Frais d\'inscription</span>' +
              '<span id="disp-inscription" class="font-medium">—</span>' +
            '</div>' +
            '<div class="flex justify-between items-center">' +
              '<div class="flex items-center gap-2">' +
                '<span class="text-gray-600">Mensualité ×</span>' +
                '<input type="number" id="inp-mois" value="9" min="1" max="12" class="w-14 text-center border border-indigo-200 rounded-lg px-1 py-1 text-sm bg-white focus:outline-none focus:border-indigo-400">' +
                '<span class="text-gray-600">mois</span>' +
              '</div>' +
              '<span id="disp-mensuel-total" class="font-medium">—</span>' +
            '</div>' +
            '<div class="flex justify-between items-center border-t border-indigo-200 pt-3 mt-1">' +
              '<span class="font-bold text-indigo-900">Total dû</span>' +
              '<span id="disp-total" class="font-extrabold text-indigo-700 text-lg">—</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="flex justify-end gap-3">' +
          '<a href="#/eleves" class="btn btn-secondary">Annuler</a>' +
          '<button type="submit" class="btn btn-primary">Inscrire l\'élève</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  function recalc() {
    var sel = document.getElementById('sel-classe');
    var opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) {
      document.getElementById('disp-inscription').textContent = '—';
      document.getElementById('disp-mensuel-total').textContent = '—';
      document.getElementById('disp-total').textContent = '—';
      return 0;
    }
    var inscription = parseFloat(opt.dataset.inscription) || 0;
    var mensuel = parseFloat(opt.dataset.mensuel) || 0;
    var mois = parseInt(document.getElementById('inp-mois').value) || 9;
    var total = inscription + mensuel * mois;
    document.getElementById('disp-inscription').textContent = formatMoney(inscription);
    document.getElementById('disp-mensuel-total').textContent = formatMoney(mensuel * mois);
    document.getElementById('disp-total').textContent = formatMoney(total);
    return total;
  }

  document.getElementById('sel-classe').addEventListener('change', recalc);
  document.getElementById('inp-mois').addEventListener('input', recalc);

  document.getElementById('inscription-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    if (!fd.get('classe_id')) { showToast('Veuillez choisir une classe', 'error'); return; }
    var total = recalc();
    try {
      var id = await dbCreateEleve({
        classe_id:       Number(fd.get('classe_id')),
        nom:             fd.get('nom').trim().toUpperCase(),
        prenom:          fd.get('prenom').trim(),
        sexe:            fd.get('sexe') || null,
        date_naissance:  fd.get('date_naissance') || null,
        nom_parent:      fd.get('nom_parent').trim() || null,
        contact_parent:  fd.get('contact_parent').trim() || null,
        montant_total_du: total
      });
      showToast('Élève inscrit avec succès', 'success');
      routerNavigate('/eleve/' + id);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}

function renderRecherche() {
  var classes = dbGetAllClasses();
  var cycles  = dbGetAllCycles();

  var classeOptions = classes.map(function(c) {
    return '<option value="' + c.id + '">' + c.cycle_nom + ' › ' + c.nom + '</option>';
  }).join('');
  var cycleOptions = cycles.map(function(c) {
    return '<option value="' + c.id + '">' + c.nom + '</option>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<h1 class="page-title">Recherche avancée</h1>' +
    '<div class="card p-5 mb-6">' +
      '<div class="grid grid-cols-2 gap-3 mb-3">' +
        '<input type="text" id="f-search" class="form-input col-span-2" placeholder="Nom, prénom, matricule...">' +
        '<select id="f-cycle" class="form-input"><option value="">Tous les cycles</option>' + cycleOptions + '</select>' +
        '<select id="f-classe" class="form-input"><option value="">Toutes les classes</option>' + classeOptions + '</select>' +
        '<select id="f-statut" class="form-input"><option value="">Tous les statuts</option><option value="solde">Soldé</option><option value="retard">En retard</option></select>' +
        '<div class="flex items-center text-sm text-gray-400" id="f-count"></div>' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<table>' +
        '<thead><tr><th>Matricule</th><th>Nom</th><th>Classe</th><th>Total dû</th><th>Solde</th><th></th></tr></thead>' +
        '<tbody id="search-tbody"></tbody>' +
      '</table>' +
    '</div>';

  function doSearch() {
    var results = dbGetAllEleves({
      search:    document.getElementById('f-search').value.trim(),
      cycle_id:  document.getElementById('f-cycle').value,
      classe_id: document.getElementById('f-classe').value,
      statut:    document.getElementById('f-statut').value
    });
    document.getElementById('search-tbody').innerHTML = _buildElevesTable(results);
    document.getElementById('f-count').textContent = results.length + ' résultat(s)';
  }

  document.getElementById('f-search').addEventListener('input', doSearch);
  document.getElementById('f-cycle').addEventListener('change', doSearch);
  document.getElementById('f-classe').addEventListener('change', doSearch);
  document.getElementById('f-statut').addEventListener('change', doSearch);
  doSearch();
}
