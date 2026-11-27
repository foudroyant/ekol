function renderEleveFiche(params) {
  var eleve = dbGetEleveById(Number(params.id));
  if (!eleve) {
    document.getElementById('app').innerHTML =
      '<a href="#/eleves" class="back-link">← Retour aux élèves</a>' +
      '<p class="mt-4 text-gray-500">Élève introuvable.</p>';
    return;
  }

  var paiements = dbGetPaiementsByEleve(eleve.id);
  var isSolde = eleve.solde_restant <= 0;
  var pct = eleve.montant_total_du > 0
    ? Math.min(100, Math.round(((eleve.montant_total_du - eleve.solde_restant) / eleve.montant_total_du) * 100))
    : 100;

  var periodes = dbGetAllPeriodes();
  var periodeId = periodes.length ? periodes[0].id : null;
  var grade = periodeId ? dbGetStudentResult(eleve.id, periodeId) : null;
  var noteMax = dbGetNoteMax();

  var paiRows = paiements.map(function(p) {
    return '<tr>' +
      '<td class="text-xs text-gray-500">' + escapeHtml((p.date_paiement || '').slice(0, 10)) + '</td>' +
      '<td class="font-semibold text-green-700">+ ' + formatMoney(p.montant) + '</td>' +
      '<td>' + escapeHtml(p.mode_paiement || '—') + '</td>' +
      '<td class="font-mono text-xs">' + escapeHtml(p.reference || '—') + '</td>' +
      '<td class="text-gray-400 text-xs">' + escapeHtml(p.commentaire || '') + '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div class="flex items-center gap-3">' +
        '<a href="#/eleves" class="back-link">← Retour aux élèves</a>' +
      '</div>' +
      '<div class="flex gap-2">' +
        (canManage() ? '<button class="btn btn-sm btn-secondary" onclick="openEditEleveModal(' + eleve.id + ')">Modifier</button>' : '') +
        (canManage() ? '<button class="btn btn-sm btn-danger" onclick="confirmDeleteEleve(' + eleve.id + ')">Désactiver</button>' : '') +
      '</div>' +
    '</div>' +

    '<div class="grid gap-5" style="grid-template-columns: 1fr 280px">' +

      '<div class="space-y-5">' +
        '<div class="card p-6">' +
          '<div class="flex items-start justify-between mb-4">' +
            '<div>' +
              '<h1 class="text-2xl font-bold text-gray-900">' + escapeHtml(eleve.prenom + ' ' + eleve.nom) + '</h1>' +
              '<p class="text-sm font-mono text-gray-400 mt-0.5">' + escapeHtml(eleve.matricule) + '</p>' +
            '</div>' +
            '<span class="' + (isSolde ? 'badge-solde' : 'badge-retard') + '">' + (isSolde ? 'Soldé' : 'En retard') + '</span>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">' +
            '<div><span class="text-gray-400">Classe</span><div class="font-medium">' + escapeHtml(eleve.cycle_nom + ' › ' + eleve.classe_nom) + '</div></div>' +
            '<div><span class="text-gray-400">Sexe</span><div class="font-medium">' + escapeHtml(eleve.sexe || '—') + '</div></div>' +
            '<div><span class="text-gray-400">Date de naissance</span><div class="font-medium">' + escapeHtml(eleve.date_naissance || '—') + '</div></div>' +
            '<div><span class="text-gray-400">Date d\'inscription</span><div class="font-medium">' + escapeHtml((eleve.date_inscription || '').slice(0, 10)) + '</div></div>' +
            '<div><span class="text-gray-400">Parent / tuteur</span><div class="font-medium">' + escapeHtml(eleve.nom_parent || '—') + '</div></div>' +
            '<div><span class="text-gray-400">Contact</span><div class="font-medium">' + escapeHtml(eleve.contact_parent || '—') + '</div></div>' +
          '</div>' +
        '</div>' +

        '<div class="card" id="eleve-notes-card">' +
          '<div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">' +
            '<span class="font-semibold text-gray-700">Notes et résultats</span>' +
            '<div class="flex items-center gap-2 flex-wrap">' +
              (periodes.length
                ? '<select id="eleve-periode" class="form-input" style="width:auto;padding:0.3rem 0.6rem;font-size:0.8rem">' +
                    periodes.map(function(p) {
                      return '<option value="' + p.id + '"' + (p.id === periodeId ? ' selected' : '') + '>' +
                        escapeHtml(p.nom) + '</option>';
                    }).join('') +
                  '</select>' +
                  '<button class="btn btn-sm btn-secondary" onclick="exportEleveFiche(' + eleve.id + ', document.getElementById(\'eleve-periode\').value, \'csv\')">CSV</button>' +
                  '<button class="btn btn-sm btn-secondary" onclick="exportEleveFiche(' + eleve.id + ', document.getElementById(\'eleve-periode\').value, \'xls\')">Excel</button>'
                : '<span class="text-xs text-gray-400">Aucune période configurée</span>') +
            '</div>' +
          '</div>' +
          '<div id="eleve-notes-body"></div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-700">Historique des paiements</div>' +
          '<table>' +
            '<thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Référence</th><th>Commentaire</th></tr></thead>' +
            '<tbody>' + (paiRows || '<tr><td colspan="5" class="text-center py-8 text-gray-400">Aucun paiement enregistré</td></tr>') + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +

      '<div class="space-y-5">' +
        '<div class="card p-6 text-center">' +
          '<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Solde restant</div>' +
          '<div class="text-5xl font-black ' + (isSolde ? 'text-green-600' : 'text-red-600') + ' leading-none">' +
            formatMoney(eleve.solde_restant) +
          '</div>' +
          '<div class="text-xs text-gray-400 mt-2">sur ' + formatMoney(eleve.montant_total_du) + '</div>' +
          '<div class="progress-bar-outer mt-4">' +
            '<div class="progress-bar-inner ' + (isSolde ? '' : 'bg-red-400') + '" style="width:' + pct + '%"></div>' +
          '</div>' +
          '<div class="text-xs text-gray-400 mt-1">' + pct + '% payé</div>' +
          (isSolde
            ? '<div class="mt-5 text-green-600 text-sm font-medium">✓ Compte soldé</div>'
            : '<a href="#/paiement/' + eleve.id + '" class="btn btn-primary w-full mt-5 justify-center">Enregistrer un paiement</a>'
          ) +
        '</div>' +
      '</div>' +

    '</div>';

  var periodeSelect = document.getElementById('eleve-periode');
  if (periodeSelect) {
    periodeSelect.addEventListener('change', function() {
      renderEleveNotes(eleve.id, Number(this.value), noteMax);
    });
  }
  if (periodeId) renderEleveNotes(eleve.id, periodeId, noteMax);
}

function renderEleveNotes(eleveId, periodeId, noteMax) {
  var body = document.getElementById('eleve-notes-body');
  if (!body) return;

  var sr = dbGetStudentResult(eleveId, periodeId);
  if (!sr || !sr.result) {
    body.innerHTML = '<div class="empty-state">Aucun résultat pour cette période.</div>';
    return;
  }

  var r = sr.result;
  var has = r.saisies > 0;
  var mention = has ? gradeMention(r.moyenne_generale, sr.note_max) : '—';
  var max = sr.note_max || noteMax || 20;

  var summary =
    '<div class="grid grid-cols-4 gap-3 p-4 border-b border-gray-100">' +
      '<div class="text-center">' +
        '<div class="text-xs text-gray-400 uppercase tracking-wider">Moyenne</div>' +
        '<div class="text-xl font-bold ' + (has ? 'text-indigo-700' : 'text-gray-400') + ' mt-1">' +
          (has ? gradeFormat(r.moyenne_generale) + ' /' + max : '—') +
        '</div>' +
      '</div>' +
      '<div class="text-center">' +
        '<div class="text-xs text-gray-400 uppercase tracking-wider">Rang</div>' +
        '<div class="text-xl font-bold text-gray-700 mt-1">' + (r.rang === null ? '—' : r.rang) + '</div>' +
      '</div>' +
      '<div class="text-center">' +
        '<div class="text-xs text-gray-400 uppercase tracking-wider">Mention</div>' +
        '<div class="mt-1"><span class="' + gradeMentionClass(mention) + '">' + mention + '</span></div>' +
      '</div>' +
      '<div class="text-center">' +
        '<div class="text-xs text-gray-400 uppercase tracking-wider">Notes saisies</div>' +
        '<div class="text-xl font-bold text-gray-700 mt-1">' + r.saisies + ' / ' + r.total_notes + '</div>' +
      '</div>' +
    '</div>';

  if (!r.rows.length) {
    body.innerHTML = summary +
      '<div class="empty-state">Aucune matière associée à cette classe.</div>';
    return;
  }

  var head1 = '<th rowspan="2" class="sticky-col">Matière</th><th rowspan="2" class="text-center">Coef.</th>';
  var groups = [];
  for (var g = 0; g < sr.composantes.length; g++) {
    var groupe = sr.composantes[g].groupe || 'Notes';
    var last = groups[groups.length - 1];
    if (last && last.nom === groupe) last.count++;
    else groups.push({ nom: groupe, count: 1 });
  }
  for (var h = 0; h < groups.length; h++) {
    head1 += '<th colspan="' + groups[h].count + '" class="text-center group-head">' + escapeHtml(groups[h].nom) + '</th>';
  }
  head1 += '<th rowspan="2" class="text-center">Moyenne</th>';

  var head2 = '';
  for (var c = 0; c < sr.composantes.length; c++) {
    var comp = sr.composantes[c];
    head2 += '<th class="text-center comp-head-cell">' + escapeHtml(comp.nom) +
      '<div class="text-xs text-gray-400 font-normal">poids ' + comp.poids + '</div></th>';
  }

  var rows = r.rows.map(function(row) {
    var cells = '';
    for (var k = 0; k < sr.composantes.length; k++) {
      var v = row.valeurs[sr.composantes[k].id];
      cells += '<td class="text-center">' + (v === null || v === undefined ? '<span class="text-gray-300">—</span>' : escapeHtml(v)) + '</td>';
    }
    return '<tr>' +
      '<td class="sticky-col font-medium">' + escapeHtml(row.matiere_nom) + '</td>' +
      '<td class="text-center"><span class="chip chip-indigo">' + row.coefficient + '</span></td>' +
      cells +
      '<td class="text-center font-semibold ' + (row.moyenne === null ? 'text-gray-400' : 'text-indigo-700') + '">' +
        gradeFormat(row.moyenne) + '</td>' +
    '</tr>';
  }).join('');

  body.innerHTML = summary +
    '<div class="table-wrap">' +
      '<table class="table-compact">' +
        '<thead><tr>' + head1 + '</tr><tr>' + head2 + '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    (sr.style
      ? '<div class="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">Style « ' + escapeHtml(sr.style.nom) + ' » · ' +
          (sr.missing_as_zero ? 'note absente = 0' : 'notes absentes ignorées') + '</div>'
      : '');
}

function openEditEleveModal(id) {
  var eleve = dbGetEleveById(id);
  if (!eleve) return;
  var classes = dbGetAllClasses();
  var classeOptions = classes.map(function(c) {
    var sel = c.id === eleve.classe_id ? ' selected' : '';
    return '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.cycle_nom + ' › ' + c.nom) + '</option>';
  }).join('');

  showModal(
    '<h2 class="text-lg font-bold text-gray-800 mb-5">Modifier l\'élève</h2>' +
    '<form id="edit-eleve-form" class="space-y-4">' +
      '<div>' +
        '<label class="form-label">Classe *</label>' +
        '<select name="classe_id" required class="form-input"><option value="">— Choisir —</option>' + classeOptions + '</select>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-4">' +
        '<div>' +
          '<label class="form-label">Nom *</label>' +
          '<input type="text" name="nom" value="' + escapeHtml(eleve.nom) + '" required class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Prénom *</label>' +
          '<input type="text" name="prenom" value="' + escapeHtml(eleve.prenom) + '" required class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Sexe</label>' +
          '<select name="sexe" class="form-input"><option value="">—</option><option' + (eleve.sexe === 'Masculin' ? ' selected' : '') + '>Masculin</option><option' + (eleve.sexe === 'Féminin' ? ' selected' : '') + '>Féminin</option></select>' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Date de naissance</label>' +
          '<input type="date" name="date_naissance" value="' + escapeHtml(eleve.date_naissance || '') + '" class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Parent</label>' +
          '<input type="text" name="nom_parent" value="' + escapeHtml(eleve.nom_parent || '') + '" class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Contact</label>' +
          '<input type="text" name="contact_parent" value="' + escapeHtml(eleve.contact_parent || '') + '" class="form-input">' +
        '</div>' +
      '</div>' +
      '<div class="flex justify-end gap-3 pt-2">' +
        '<button type="button" class="btn btn-secondary" onclick="hideModal()">Annuler</button>' +
        '<button type="submit" class="btn btn-primary">Enregistrer</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('edit-eleve-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var nom = (fd.get('nom') || '').trim().toUpperCase();
    var prenom = (fd.get('prenom') || '').trim();
    if (!nom || !prenom || !fd.get('classe_id')) { showToast('Champs obligatoires manquants', 'error'); return; }
    try {
      await dbUpdateEleve(eleve.id, {
        classe_id: Number(fd.get('classe_id')),
        nom: nom, prenom: prenom,
        sexe: fd.get('sexe') || null,
        date_naissance: fd.get('date_naissance') || null,
        nom_parent: (fd.get('nom_parent') || '').trim() || null,
        contact_parent: (fd.get('contact_parent') || '').trim() || null
      });
      hideModal();
      showToast('Élève mis à jour', 'success');
      renderEleveFiche({ id: eleve.id });
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}

async function confirmDeleteEleve(id) {
  var eleve = dbGetEleveById(id);
  if (!eleve) return;
  var ok = await showConfirm('Désactiver l\'élève "' + eleve.prenom + ' ' + eleve.nom + '" ? Il pourra être réactivé plus tard.');
  if (!ok) return;
  try {
    await dbDesactivateEleve(id);
    showToast('Élève désactivé', 'success');
    routerNavigate('/eleves');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}
