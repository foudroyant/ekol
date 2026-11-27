# Build & Installateur — Ekol

## Prérequis

- [Node.js](https://nodejs.org/) (pour le CLI Neutralinojs)
- [Inno Setup](https://jrsoftware.org/isdl.php) (pour l'installateur Windows)

## 1. Build l'application

```bash
cd /chemin/vers/ekol
neu build
```

Le livrable est généré dans `dist/Ekol/` :
```
dist/Ekol/
├── Ekol-win_x64.exe  # Exécutable principal (Windows)
├── resources.neu     # Bundle des ressources
└── ...
```

## 2. Compiler l'installateur

Ouvrir `installer.iss` dans Inno Setup puis cliquer sur **Compiler** (`Ctrl+F9`).

Ou en ligne de commande (si `ISCC.exe` est dans le PATH) :

```bash
ISCC installer.iss
```

L'installateur est généré dans `dist/installer/Ekol-Setup-1.1.0.exe`.

## 3. Distribuer

Donner le fichier `Ekol-Setup-1.1.0.exe` aux utilisateurs — il installe l'app, crée les raccourcis et propose de la lancer.

## 4. Publier une mise à jour

L'app intègre `Neutralino.updater` (`resources/js/updater.js`) : à chaque démarrage, elle compare sa
version (`NL_APPVERSION`) au `manifest.json` versionné **dans le projet public lui-même**
(`docs/updates/manifest.json`, servi par GitHub Pages à
`https://foudroyant.github.io/ekol/updates/manifest.json`). Si une version plus
récente existe, elle propose de télécharger et d'installer le nouveau `resources.neu`, puis redémarre.

**Important — CORS** : `Neutralino.updater` utilise `fetch()` côté navigateur. Les assets **GitHub Releases**
classiques (`github.com/.../releases/download/...`) ne renvoient **pas** de header
`Access-Control-Allow-Origin` (vérifié) et ne fonctionneront donc pas comme source pour `manifest.json` /
`resources.neu`. C'est pourquoi ces deux fichiers vivent dans `docs/updates/`, servi par
GitHub Pages (CORS `*` natif, comme `raw.githubusercontent.com`) — sans branche ni dépôt séparé.
L'installateur complet (`.exe`), lui, reste sur les GitHub Releases classiques — il n'est jamais chargé
via `fetch()`.

Étapes pour publier la version `X.Y.Z` :

1. **Bumper la version** aux 3 endroits (ils doivent rester synchronisés) :
   - `neutralino.config.json` → `"version"`
   - `installer.iss` → `#define MyAppVersion "X.Y.Z"`
   - `docs/updates/manifest.json` → `"version"` (reprendre cette même version)

2. **Builder** : `neu build` → régénère `dist/Ekol/resources.neu` et `dist/Ekol/Ekol-win_x64.exe`.

3. **Publier les ressources** (remplace le précédent `resources.neu`, un seul fichier versionné à la fois) :
   ```bash
   cp dist/Ekol/resources.neu docs/updates/resources.neu
   git add docs/updates/manifest.json docs/updates/resources.neu
   git commit -m "Release vX.Y.Z - manifest + resources.neu"
   git push
   ```
   `applicationId` dans `docs/updates/manifest.json` doit rester identique à celui de
   `neutralino.config.json`, sinon l'updater rejette le manifeste. GitHub Pages déploie
   `docs/` automatiquement : prévoyez quelques minutes avant que la mise à jour soit visible
   par les apps installées.

4. **Compiler l'installateur** (voir étape 2 ci-dessus) → `dist/installer/Ekol-Setup-X.Y.Z.exe`.

5. **Publier la GitHub Release** avec l'installateur comme asset :
   ```bash
   gh release create vX.Y.Z "dist/installer/Ekol-Setup-X.Y.Z.exe" --title "Ekol vX.Y.Z" --notes "..."
   ```

Les utilisateurs déjà installés reçoivent la mise à jour automatiquement au prochain lancement (étape 3
suffit pour eux). L'étape 5 (nouvel installateur) ne sert qu'aux nouvelles installations, car
`Neutralino.updater` ne remplace jamais le binaire `Ekol.exe` — seulement `resources.neu`.

**Limite connue** : si une mise à jour nécessite de changer `Ekol.exe` lui-même (upgrade du runtime
Neutralino, changement de `neutralino.config.json`, nouvelle icône...), l'updater intégré ne suffit pas —
il faudra redistribuer le nouvel installateur manuellement (pas encore automatisé).
