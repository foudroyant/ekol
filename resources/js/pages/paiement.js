function renderPaiement(params) {
  var eleve = dbGetEleveById(Number(params.id));
  if (!eleve) {
    document.getElementById('app').innerHTML =
      '<a href="#/eleves" class="back-link">← Retour</a><p class="mt-4 text-gray-500">Élève introuvable.</p>';
    return;
  }

  var isSolde = eleve.solde_restant <= 0;
  var headerCard =
    '<div class="card p-5 mb-5 flex items-center justify-between">' +
      '<div>' +
        '<div class="font-bold text-gray-900">' + eleve.prenom + ' ' + eleve.nom + '</div>' +
        '<div class="text-xs text-gray-400 font-mono">' + eleve.matricule + ' · ' + eleve.classe_nom + '</div>' +
      '</div>' +
      '<div class="text-right">' +
        '<div class="text-xs text-gray-400">Solde restant</div>' +
        '<div class="text-2xl font-extrabold ' + (isSolde ? 'text-green-600' : 'text-red-600') + '">' + formatMoney(eleve.solde_restant) + '</div>' +
      '</div>' +
    '</div>';

  var bodyCard = isSolde
    ? '<div class="card p-8 text-center text-green-700">' +
        '<div class="text-4xl mb-3">✓</div>' +
        '<p class="font-semibold">Ce compte est déjà soldé.</p>' +
        '<a href="#/eleve/' + eleve.id + '" class="btn btn-secondary mt-4 inline-flex">Retour à la fiche</a>' +
      '</div>'
    : '<div class="card p-6">' +
        '<h2 class="font-bold text-gray-800 mb-5">Enregistrer un paiement</h2>' +
        '<form id="paiement-form" class="space-y-4">' +
          '<div>' +
            '<label class="form-label">Montant *</label>' +
            '<input type="number" name="montant" required min="1" step="1" class="form-input text-lg font-bold" placeholder="0">' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-4">' +
            '<div>' +
              '<label class="form-label">Mode de paiement</label>' +
              '<select name="mode" class="form-input">' +
                '<option value="">— Choisir —</option>' +
                '<option>Espèces</option>' +
                '<option>Chèque</option>' +
                '<option>Virement</option>' +
                '<option>Mobile Money</option>' +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label class="form-label">N° reçu (auto)</label>' +
              '<input type="text" id="disp-ref" class="form-input font-mono text-sm bg-gray-50" readonly>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="form-label">Commentaire</label>' +
            '<textarea name="commentaire" rows="2" class="form-input" placeholder="Note optionnelle..."></textarea>' +
          '</div>' +
          '<div class="flex justify-end gap-3 pt-1">' +
            '<a href="#/eleve/' + eleve.id + '" class="btn btn-secondary">Annuler</a>' +
            '<button type="submit" class="btn btn-primary">Valider le paiement</button>' +
          '</div>' +
        '</form>' +
      '</div>';

  document.getElementById('app').innerHTML =
    '<div class="flex items-center gap-3 mb-6">' +
      '<a href="#/eleve/' + eleve.id + '" class="back-link">← Fiche de ' + eleve.prenom + ' ' + eleve.nom + '</a>' +
    '</div>' +
    '<div class="max-w-lg">' +
      headerCard +
      bodyCard +
    '</div>';

  if (!isSolde) {
    var d = new Date();
    var ds = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var seq = _query('SELECT COUNT(*) as n FROM paiements')[0].n + 1;
    document.getElementById('disp-ref').value = 'REC-' + ds + '-' + String(seq).padStart(4, '0');

    document.getElementById('paiement-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var montant = parseFloat(fd.get('montant'));
      if (isNaN(montant) || montant <= 0) { showToast('Montant invalide', 'error'); return; }
      if (montant > eleve.solde_restant) { showToast('Le montant dépasse le solde restant (' + formatMoney(eleve.solde_restant) + ')', 'error'); return; }
      try {
        await dbCreatePaiement(
          eleve.id, montant,
          fd.get('mode') || null,
          null,
          (fd.get('commentaire') || '').trim() || null
        );
        showToast('Paiement enregistré', 'success');
        routerNavigate('/eleve/' + eleve.id);
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  }
}
