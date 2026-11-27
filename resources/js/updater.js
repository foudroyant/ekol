// ─── Mise à jour automatique ────────────────────────────────────────────────
// Vérifie au démarrage si une nouvelle version des ressources (JS/CSS/HTML)
// est disponible, via le manifeste versionné dans le projet public lui-même
// (docs/updates/manifest.json, servi par GitHub Pages — CORS * natif,
// contrairement aux assets GitHub Releases classiques : Neutralino.updater
// utilise fetch() côté navigateur).
// Voir BUILD.md §4 pour publier une mise à jour (copier le resources.neu
// construit dans docs/updates/).

var UPDATE_MANIFEST_URL = 'https://foudroyant.github.io/ekol/updates/manifest.json';

function checkForAppUpdate() {
  Neutralino.updater.checkForUpdates(UPDATE_MANIFEST_URL).then(function(manifest) {
    if (manifest.version !== NL_APPVERSION) {
      promptAppUpdate(manifest);
    }
  }).catch(function(err) {
    console.warn('Vérification de mise à jour impossible :', err);
  });
}

function promptAppUpdate(manifest) {
  showModal(
    '<div class="text-center">' +
      '<div class="text-lg font-semibold text-indigo-900 mb-2">Mise à jour disponible</div>' +
      '<p class="text-sm text-gray-600 mb-6">La version ' + manifest.version + ' d\'Ekol est disponible (version actuelle : ' + NL_APPVERSION + ').</p>' +
      '<div class="flex justify-center gap-3">' +
        '<button class="btn btn-secondary" onclick="hideModal()">Plus tard</button>' +
        '<button class="btn btn-primary" id="btn-update-now">Mettre à jour</button>' +
      '</div>' +
    '</div>'
  );
  document.getElementById('btn-update-now').onclick = function() { installAppUpdate(); };
}

function installAppUpdate() {
  showModal(
    '<div class="text-center">' +
      '<div class="text-lg font-semibold text-indigo-900 mb-2">Mise à jour en cours</div>' +
      '<p class="text-sm text-gray-600">Téléchargement, veuillez patienter...</p>' +
    '</div>'
  );
  Neutralino.updater.install().then(function() {
    showModal(
      '<div class="text-center">' +
        '<div class="text-lg font-semibold text-indigo-900 mb-2">Mise à jour installée</div>' +
        '<p class="text-sm text-gray-600">L\'application va redémarrer.</p>' +
      '</div>'
    );
    setTimeout(function() { Neutralino.app.restartProcess(); }, 1200);
  }).catch(function(err) {
    hideModal();
    showToast('Échec de la mise à jour : ' + (err.message || err.code || 'erreur inconnue'), 'error');
  });
}
