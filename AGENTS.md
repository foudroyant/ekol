# Ekol — Gestion Scolaire

## Stack technique

- **Framework** : Neutralinojs v6.8.0 (desktop app cross-platform)
- **Base de données** : SQLite via sql.js (WASM), fichier unique `ekol.db`
- **UI** : Vanilla JS + CSS custom + Tailwind CSS (build purgé, suppléments inline)
- **Rendu** : WebView2 (Windows) / WebKit (macOS/Linux)

## Architecture

```
resources/
├── index.html          # Point d'entrée, sidebar, modales
├── css/
│   ├── style.css       # Tous les styles (inclut les suppléments Tailwind)
│   └── tailwind.min.css
├── js/
│   ├── neutralino.js   # SDK client Neutralinojs
│   ├── sql-wasm.js     # sql.js (WebAssembly SQLite)
│   ├── db.js           # Accès base de données (CRUD)
│   ├── router.js       # Hash-based SPA router
│   ├── app.js          # App globals (formatMoney, toast, modal, confirm, about, settings)
│   └── pages/          # Route handlers
│       ├── dashboard.js
│       ├── cycles.js
│       ├── classes.js
│       ├── eleves.js   # + inscription, recherche
│       ├── eleve.js    # Fiche élève + édition, désactivation
│       └── paiement.js
└── icons/              # Logo SVG + icônes PNG
```

## Conventions

- **Langue** : Français (interface + code comments)
- **Style JS** : ES5 compatible (var, function), pas de modules ES6
- **Base de données** : Schéma créé automatiquement au premier lancement
- **Sauvegarde** : `saveDB()` écrit le fichier SQLite complet après chaque mutation
- **Route** : Hash-based SPA, format `#/route/:param`

## Commandes

```bash
# Lancer l'application (Windows)
bin/neutralino-win_x64.exe

# Lancer en mode dev (si Neutralinojs CLI installé)
neu run
```

## Build

Pas de build step nécessaire (vanilla JS). Le binaire Neutralinojs est pré-compilé dans `bin/`.

## Notes importantes

- Le fichier `tailwind.min.css` est un build purgé — les classes manquantes sont dans `style.css`
- Les icônes PNG sont générées via PowerShell/System.Drawing
- Le logo SVG est une création originale (toque + livre ouvert)
- Les références de paiement sont auto-générées au format `REC-YYYYMMDD-XXXX`

## Prochaines étapes

### Reçus de paiement en image/PDF
- **Objectif** : Générer un reçu imprimable après chaque paiement, exportable en PNG/PDF
- **Approche possible** : `html2canvas` (JS côté client, pas de dépendance externe) pour le PNG
- **Approche lourde** : Puppeteer/Playwright headless pour du PDF pixel-perfect
- **Fichier cible** : `resources/js/pages/reçu.js` (nouveau handler de route ou popup)
- **Voir** : `docs/rendu-html.md` pour les détails techniques
