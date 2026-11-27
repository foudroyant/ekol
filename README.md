# Ekol — Gestion scolaire

Ekol est une application de bureau **hors-ligne** de gestion scolaire pour les établissements
(Primaire, Collège, Lycée…). Elle réunit la gestion des élèves, des paiements et des notes dans
une seule base SQLite locale, sans serveur ni compte en ligne.

Développée avec [Neutralinojs](https://neutralino.js.org/) (WebView native) et **sql.js** (SQLite
compilé en WebAssembly), elle fonctionne sous Windows, macOS et Linux.

## Fonctionnalités

### Élèves & scolarité
- Cycles, classes, matières et coefficients configurables.
- Inscription avec matricule auto-généré (`EKL-YYYY-XXXX`).
- Fiche élève : informations, historique des paiements, solde, notes.
- Liste triable et filtrable (nom, matricule, classe, moyenne, rang, mention, période).

### Paiements
- Enregistrement des paiements avec référence auto-générée (`REC-YYYYMMDD-XXXX`).
- Suivi du solde, des retards et de la collecte par cycle.
- Dashboard : effectifs, collecte, tendance mensuelle.

### Notes & évaluation
- **Composantes libres** : devoirs, TP/exposé, session… avec poids relatifs configurables.
- **Styles de notation** au niveau de l'établissement, avec surcharge possible par classe.
- Presets fournis, dont **Standard 40/60** (Devoir 20, TP/Exposé 20, Session 60), défini par défaut.
- Barème paramétrable (/20 par défaut), périodes renommables (« Séquence 1 » par défaut).
- Moyenne matière = Σ(note × poids) / Σ(poids).
- Moyenne générale = Σ(moyenne matière × coefficient) / Σ(coefficients).
- Mentions : Excellent, Très bien, Bien, Assez bien, Passable, Insuffisant.
- Saisie en grille avec navigation clavier et calcul en direct.
- Exports **CSV** (séparateur `;` + BOM, compatible Excel FR) et **Excel** (`.xls` HTML).

### Comptes & établissements
- Authentification **locale** : comptes SQLite, mots de passe hachés en PBKDF2-SHA256.
- Trois rôles : super administrateur (tous les établissements), administrateur (le sien),
  enseignant (consultation et saisie des notes).
- Plusieurs établissements cloisonnés dans une même base (`organization_id` sur toutes les tables).
- Sauvegarde / restauration complète de la base (super administrateur).

## Démarrage

### Utiliser l'application

Télécharger et lancer l'installateur (`Ekol-Setup-X.Y.Z.exe` sur Windows), ou exécuter le binaire
Neutralinojs fourni.

Au premier lancement, l'application demande de créer l'établissement et le premier compte
(super administrateur). Les lancements suivants affichent l'écran de connexion.

### Développement

```bash
# Prérequis : CLI Neutralinojs (https://neutralino.js.org/docs/cli/installation)
neu update      # télécharge le client JS + les binaires
neu run         # lance l'app en mode développement
```

Le fichier `resources/js/neutralino.js` est généré par `neu update` et n'est pas versionné.

## Structure

```
resources/
├── index.html              # Écran d'authentification, navigation, modales
├── css/
│   ├── style.css           # Styles de l'application (+ suppléments Tailwind)
│   └── tailwind.min.css
├── js/
│   ├── db.js               # Schéma SQLite, migrations, CRUD, calculs
│   ├── auth.js             # PBKDF2, connexion, rôles, changement d'établissement
│   ├── grades.js           # Moteur de calcul des moyennes et mentions
│   ├── export.js           # Exports CSV / Excel
│   ├── router.js           # Routeur SPA (hash)
│   ├── app.js              # Globals, paramètres, sauvegarde
│   └── pages/              # Écrans (dashboard, classes, notes, styles…)
└── icons/
```

La base est enregistrée dans le dossier de données de l'application (`ekol.db`).

## Documentation

- [`docs/notation.md`](docs/notation.md) — système de notation, formules et presets.
- [`BUILD.md`](BUILD.md) — build, installateur et publication des mises à jour.
- [`AGENTS.md`](AGENTS.md) — architecture et conventions pour les contributeurs.

## Crédits

**Bambyno Studio App** — Studio de création d'applications sur mesure
Créé par Stéphane Bamby Bazebibouta — <stephanebazebibouta@gmail.com> · WhatsApp +242 06 483 76 37

## Licence

[MIT](LICENSE)
