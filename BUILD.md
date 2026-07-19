# Build & Installateur — Ekol

## Prérequis

- [Node.js](https://nodejs.org/) (pour le CLI Neutralinojs)
- [Inno Setup](https://jrsoftware.org/isdl.php) (pour l'installateur Windows)

## 1. Build l'application

```bash
cd D:\Desktop\Ekol
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

L'installateur est généré dans `dist/installer/Ekol-Setup-1.0.0.exe`.

## 3. Distribuer

Donner le fichier `Ekol-Setup-1.0.0.exe` aux utilisateurs — il installe l'app, crée les raccourcis et propose de la lancer.

## 4. Publier une mise à jour

L'app intègre `Neutralino.updater` (`resources/js/updater.js`) : à chaque démarrage, elle compare sa
version (`NL_APPVERSION`) au `manifest.json` publié sur la branche `updates` du dépôt. Si une version plus
récente existe, elle propose de télécharger et d'installer le nouveau `resources.neu`, puis redémarre.

**Important — CORS** : `Neutralino.updater` utilise `fetch()` côté navigateur. Les assets **GitHub Releases**
classiques (`github.com/.../releases/download/...`) ne renvoient **pas** de header
`Access-Control-Allow-Origin` (vérifié) et ne fonctionneront donc pas comme source pour `manifest.json` /
`resources.neu`. C'est pourquoi ces deux fichiers sont hébergés sur la branche `updates`, servie via
`raw.githubusercontent.com` (CORS `*` natif). L'installateur complet (`.exe`), lui, reste sur les GitHub
Releases classiques — il n'est jamais chargé via `fetch()`.

Étapes pour publier la version `X.Y.Z` :

1. **Bumper la version** aux 3 endroits (ils doivent rester synchronisés) :
   - `neutralino.config.json` → `"version"`
   - `installer.iss` → `#define MyAppVersion "X.Y.Z"`
   - (le `manifest.json` généré à l'étape 3 reprendra cette même version)

2. **Builder** : `neu build` → régénère `dist/Ekol/resources.neu` et `dist/Ekol/Ekol-win_x64.exe`.

3. **Générer `manifest.json`** (à la racine de `dist/Ekol/`, à côté de `resources.neu`) :
   ```json
   {
     "applicationId": "app.ekol.school",
     "version": "X.Y.Z",
     "resourcesURL": "https://raw.githubusercontent.com/foudroyant/ekol/updates/resources.neu"
   }
   ```
   `applicationId` doit être identique à celui de `neutralino.config.json`, sinon l'updater rejette le
   manifeste.

4. **Publier sur la branche `updates`** (contient uniquement `manifest.json` + `resources.neu`, historique
   séparé du code source) :
   ```bash
   git worktree add /tmp/ekol-updates -b updates-tmp origin/updates
   cp dist/Ekol/manifest.json dist/Ekol/resources.neu /tmp/ekol-updates/
   cd /tmp/ekol-updates
   git add manifest.json resources.neu
   git commit -m "Release vX.Y.Z - manifest + resources.neu"
   git push origin updates-tmp:updates
   cd D:\Desktop\Ekol
   git worktree remove /tmp/ekol-updates --force
   ```

5. **Compiler l'installateur** (voir étape 2 ci-dessus) → `dist/installer/Ekol-Setup-X.Y.Z.exe`.

6. **Publier la GitHub Release** avec l'installateur comme asset :
   ```bash
   gh release create vX.Y.Z "dist/installer/Ekol-Setup-X.Y.Z.exe" --title "Ekol vX.Y.Z" --notes "..."
   ```

Les utilisateurs déjà installés reçoivent la mise à jour automatiquement au prochain lancement (étapes 3-4
suffisent pour eux). L'étape 6 (nouvel installateur) ne sert qu'aux nouvelles installations, car
`Neutralino.updater` ne remplace jamais le binaire `Ekol.exe` — seulement `resources.neu`.

**Limite connue** : si une mise à jour nécessite de changer `Ekol.exe` lui-même (upgrade du runtime
Neutralino, changement de `neutralino.config.json`, nouvelle icône...), l'updater intégré ne suffit pas —
il faudra redistribuer le nouvel installateur manuellement (pas encore automatisé).
