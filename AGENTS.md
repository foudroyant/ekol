# Ekol — Gestion Scolaire

## Stack technique

- **Framework** : Neutralinojs v6.8.0 (desktop app cross-platform)
- **Base de données** : SQLite via sql.js (WASM), fichier unique `ekol.db`
- **UI** : Vanilla JS + CSS custom + Tailwind CSS (build purgé, suppléments inline)
- **Rendu** : WebView2 (Windows) / WebKit (macOS/Linux)
- **Sécurité** : authentification locale, mots de passe PBKDF2-SHA256 (Web Crypto)

## Architecture

```
resources/
├── index.html          # Écran d'auth, sidebar, footer utilisateur, modales
├── css/
│   ├── style.css       # Tous les styles (inclut les suppléments Tailwind)
│   └── tailwind.min.css
├── js/
│   ├── neutralino.js   # SDK client Neutralinojs (généré par `neu update`, non versionné)
│   ├── sql-wasm.js     # sql.js (WebAssembly SQLite)
│   ├── wasm-b64.js     # WASM embarqué en base64
│   ├── db.js           # Schéma, migrations, CRUD, calculs, dashboard
│   ├── auth.js         # PBKDF2, connexion, session, rôles, changement d'établissement
│   ├── grades.js       # Moteur pur : moyennes, mentions, rangs
│   ├── export.js       # Exports CSV / Excel (aucune dépendance)
│   ├── cloud.js        # Client PocketBase : snapshot, checksum, sync, restore
│   ├── router.js       # Routeur SPA (hash) + garde d'authentification
│   ├── app.js          # Globals, routes, paramètres, sauvegarde/restauration
│   ├── updater.js      # Mise à jour automatique des ressources
│   └── pages/          # Route handlers
│       ├── dashboard.js
│       ├── cycles.js
│       ├── classes.js
│       ├── classe.js   # Fiche classe : matières, style, classement, exports
│       ├── eleves.js   # Liste filtrable/triable + inscription + recherche
│       ├── eleve.js    # Fiche élève : notes, paiements, exports
│       ├── notes.js    # Grille de saisie dynamique par composantes
│       ├── matieres.js
│       ├── styles.js
│       ├── utilisateurs.js
│       ├── organisations.js
│       ├── cloud.js        # Domaine, appairage, sync, restauration, exports CSV
│       └── paiement.js
└── icons/
└── cloud/                  # Backend optionnel : PocketBase + mini-site (25 000 FCFA/an)
    ├── pb_migrations/      # Schéma : devices, pairing_codes, subscriptions, backups, exports
    ├── pb_hooks/           # Appairage, abonnement, expirations (cron)
    ├── pb_public/          # Mini-site : compte, abonnement, appareils, sauvegardes, CSV
    └── README.md           # Déploiement du cloud (un seul binaire)              # Logo SVG + icônes PNG
```

## Modèle de données

Toutes les tables métier portent un `organization_id` : les données de plusieurs établissements
coexistent dans une seule base et sont cloisonnées.

```
organizations ─┬─ users
               ├─ org_settings (note_max, notes_manquantes_zero, currency)
               ├─ periodes
               ├─ styles_notation ── composantes_style
               ├─ matieres ── classe_matieres ── classes
               ├─ cycles ── classes ── eleves ── paiements
               └─ notes (eleve × classe_matiere × periode × composante)
```

- Une matière = `nom` + `coefficient` ; le couple est unique par établissement.
- `classes.style_id` est une surcharge optionnelle du style par défaut (`organizations.style_id`).
- `notes` a une contrainte `UNIQUE(eleve_id, classe_matiere_id, periode_id, composante_id)`.

## Calculs

- Moyenne matière = Σ(note × poids) / Σ(poids).
- Moyenne générale = Σ(moyenne matière × coefficient) / Σ(coefficients).
- Les élèves sans aucune note ne sont pas classés (rang `null`).
- Le détail des formules, presets et mentions est dans [`docs/notation.md`](docs/notation.md).

## Conventions

- **Langue** : Français (interface + commentaires de code)
- **Style JS** : ES5 compatible (`var`, `function`), pas de modules ES6 ; `async/await` autorisé
- **Échappement** : toute donnée utilisateur insérée dans du HTML passe par `escapeHtml()`
- **Base de données** : schéma et migrations idempotents au démarrage (`_runSchema`, `_migrate`)
- **Sauvegarde** : `saveDB()` réécrit le fichier SQLite complet après chaque mutation ; les saisies
  de notes groupées utilisent une transaction puis un seul `saveDB()`
- **Route** : hash-based SPA, format `#/route/:param` ; aucune route n'est rendue sans session
- **Rôles** : `canManage()` (admin + super admin) pour les mutations structurelles,
  `isSuperAdmin()` pour les établissements et la sauvegarde complète

## Commandes

```bash
# Lancer l'application (Windows)
bin/neutralino-win_x64.exe

# Lancer en mode dev (si Neutralinojs CLI installé)
neu update
neu run
```

## Build

Pas de build step nécessaire (vanilla JS). Le binaire Neutralinojs est pré-compilé dans `bin/`.
Voir [`BUILD.md`](BUILD.md) pour l'installateur et la publication des mises à jour.

## Notes importantes

- Le fichier `tailwind.min.css` est un build purgé — les classes manquantes sont dans `style.css`
- `resources/js/neutralino.js` est gitignoré et généré par `neu update`
- L'allowlist native de `neutralino.config.json` doit contenir `filesystem.writeFile`
  (exports CSV/Excel) et `filesystem.writeBinaryFile` (base de données)
- Les exports CSV utilisent `;` + BOM UTF-8 ; les exports Excel sont des `.xls` HTML
- Les références de paiement sont auto-générées au format `REC-YYYYMMDD-XXXX`
- Les matricules sont auto-générés au format `EKL-YYYY-XXXX`

## Prochaines étapes

### Reçus de paiement en image/PDF
- **Objectif** : Générer un reçu imprimable après chaque paiement, exportable en PNG/PDF
- **Approche possible** : `html2canvas` (JS côté client, pas de dépendance externe) pour le PNG
- **Approche lourde** : Puppeteer/Playwright headless pour du PDF pixel-perfect
- **Fichier cible** : `resources/js/pages/recu.js` (nouveau handler de route ou popup)
- **Voir** : `docs/rendu-html.md` pour les détails techniques
