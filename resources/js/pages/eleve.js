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

  var paiRows = paiements.map(function(p) {
    return '<tr>' +
      '<td class="text-xs text-gray-500">' + (p.date_paiement || '').slice(0, 10) + '</td>' +
      '<td class="font-semibold text-green-700">+ ' + formatMoney(p.montant) + '</td>' +
      '<td>' + (p.mode_paiement || '—') + '</td>' +
      '<td class="font-mono text-xs">' + (p.reference || '—') + '</td>' +
      '<td class="text-gray-400 text-xs">' + (p.commentaire || '') + '</td>' +
    '</tr>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div class="flex items-center gap-3">' +
        '<a href="#/eleves" class="back-link">← Retour aux élèves</a>' +
      '</div>' +
      '<div class="flex gap-2">' +
        '<button class="btn btn-sm btn-secondary" onclick="openEditEleveModal(' + eleve.id + ')">Modifier</button>' +
        '<button class="btn btn-sm btn-danger" onclick="confirmDeleteEleve(' + eleve.id + ')">Désactiver</button>' +
      '</div>' +
    '</div>' +

    '<div class="grid gap-5" style="grid-template-columns: 1fr 280px">' +

      '<div class="space-y-5">' +
        '<div class="card p-6">' +
          '<div class="flex items-start justify-between mb-4">' +
            '<div>' +
              '<h1 class="text-2xl font-bold text-gray-900">' + eleve.prenom + ' ' + eleve.nom + '</h1>' +
              '<p class="text-sm font-mono text-gray-400 mt-0.5">' + eleve.matricule + '</p>' +
            '</div>' +
            '<span class="' + (isSolde ? 'badge-solde' : 'badge-retard') + '">' + (isSolde ? 'Soldé' : 'En retard') + '</span>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">' +
            '<div><span class="text-gray-400">Classe</span><div class="font-medium">' + eleve.cycle_nom + ' › ' + eleve.classe_nom + '</div></div>' +
            '<div><span class="text-gray-400">Sexe</span><div class="font-medium">' + (eleve.sexe || '—') + '</div></div>' +
            '<div><span class="text-gray-400">Date de naissance</span><div class="font-medium">' + (eleve.date_naissance || '—') + '</div></div>' +
            '<div><span class="text-gray-400">Date d\'inscription</span><div class="font-medium">' + (eleve.date_inscription || '').slice(0, 10) + '</div></div>' +
            '<div><span class="text-gray-400">Parent / tuteur</span><div class="font-medium">' + (eleve.nom_parent || '—') + '</div></div>' +
            '<div><span class="text-gray-400">Contact</span><div class="font-medium">' + (eleve.contact_parent || '—') + '</div></div>' +
          '</div>' +
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
}

function openEditEleveModal(id) {
  var eleve = dbGetEleveById(id);
  if (!eleve) return;
  var classes = dbGetAllClasses();
  var classeOptions = classes.map(function(c) {
    var sel = c.id === eleve.classe_id ? ' selected' : '';
    return '<option value="' + c.id + '"' + sel + '>' + c.cycle_nom + ' \u203a ' + c.nom + '</option>';
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
          '<input type="text" name="nom" value="' + eleve.nom + '" required class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Prénom *</label>' +
          '<input type="text" name="prenom" value="' + eleve.prenom + '" required class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Sexe</label>' +
          '<select name="sexe" class="form-input"><option value="">—</option><option' + (eleve.sexe === 'Masculin' ? ' selected' : '') + '>Masculin</option><option' + (eleve.sexe === 'Féminin' ? ' selected' : '') + '>Féminin</option></select>' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Date de naissance</label>' +
          '<input type="date" name="date_naissance" value="' + (eleve.date_naissance || '') + '" class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Parent</label>' +
          '<input type="text" name="nom_parent" value="' + (eleve.nom_parent || '') + '" class="form-input">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">Contact</label>' +
          '<input type="text" name="contact_parent" value="' + (eleve.contact_parent || '') + '" class="form-input">' +
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
    var nom = fd.get('nom').trim().toUpperCase();
    var prenom = fd.get('prenom').trim();
    if (!nom || !prenom || !fd.get('classe_id')) { showToast('Champs obligatoires manquants', 'error'); return; }
    try {
      await dbUpdateEleve(eleve.id, {
        classe_id: Number(fd.get('classe_id')),
        nom: nom, prenom: prenom,
        sexe: fd.get('sexe') || null,
        date_naissance: fd.get('date_naissance') || null,
        nom_parent: fd.get('nom_parent').trim() || null,
        contact_parent: fd.get('contact_parent').trim() || null
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
