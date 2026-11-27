# Ekol — Gestion Scolaire

## Description

Ekol est une application de bureau cross-platform de gestion scolaire développée avec Neutralinojs.
Elle permet aux établissements de gérer leurs cycles, classes, élèves, paiements et notes, le tout
en local dans une base SQLite, sans serveur ni connexion internet.

## Fonctionnalités

- **Authentification locale** — comptes SQLite, mots de passe hachés en PBKDF2-SHA256, rôles
  super administrateur / administrateur / enseignant, changement d'établissement.
- **Multi-établissements** — plusieurs établissements cloisonnés dans une même base
  (`organization_id` sur toutes les données).
- **Dashboard** — élèves actifs, collecte, attendu, taux de collecte, moyenne générale de la
  période, notes saisies, top 5 élèves, moyennes par classe, tendance mensuelle.
- **Cycles** — CRUD des cycles pédagogiques (Primaire, Collège, Lycée, etc.).
- **Classes** — CRUD des classes, montants d'inscription et mensualités, matières rattachées,
  style de notation avec surcharge possible.
- **Matières** — catalogue réutilisable, couple nom + coefficient (une même matière peut avoir
  plusieurs coefficients).
- **Styles de notation** — composantes libres avec poids relatifs, presets fournis dont
  **Standard 40/60** par défaut, duplication et style par défaut par établissement.
- **Notes** — grille de saisie par classe / période / matière, calcul en direct, navigation
  clavier, barème paramétrable, périodes renommables.
- **Résultats** — moyenne matière, moyenne générale pondérée par coefficient, rang (ex-aequo),
  mentions, notes absentes comptées 0 ou ignorées.
- **Élèves** — inscription avec matricule auto-généré (EKL-YYYY-XXXX), fiche complète, liste
  triable et filtrable (nom, matricule, classe, moyenne, rang, mention, période).
- **Paiements** — référence auto-générée (REC-YYYYMMDD-XXXX), validation de solde, modes de
  paiement, historique.
- **Exports** — CSV (`;` + BOM UTF-8) et Excel (`.xls` HTML), par classe, par étudiant ou fiche
  individuelle ; les mêmes CSV sont envoyés au cloud à chaque synchronisation.
- **Cloud (option payante, 25 000 FCFA / an)** — sauvegarde et synchronisation
  via PocketBase : domaine + code d'appairage, abonnement annuel, vérification checksum,
  alertes de désynchronisation, restauration, exports CSV côté cloud.
- **Paramètres** — monnaie, barème, gestion des notes absentes, périodes, sauvegarde/restauration.

## Crédits

**Bambyno Studio App** — Studio de création d'applications sur mesure
Créé par Stéphane Bamby Bazebibouta
- Email : stephanebazebibouta@gmail.com
- WhatsApp : +242 06 483 76 37

## Stack

- Neutralinojs v6.8.0 (desktop app)
- SQLite via sql.js (WASM)
- Vanilla JS (ES5 compatible)
- Tailwind CSS (suppléments inline)
- Web Crypto (PBKDF2-SHA256)

## Documentation

- `docs/notation.md` — formules, presets et mentions.
- `BUILD.md` — build, installateur et mises à jour.
- `AGENTS.md` — architecture et conventions.

## Prochaines étapes

### Reçus de paiement en image/PDF
- Générer un reçu imprimable (HTML/CSS → PNG/PDF) après chaque paiement
- Approche légère : `html2canvas` côté client pour le PNG
- Approche lourde : Puppeteer/Playwright headless pour le PDF
- Voir `docs/rendu-html.md` pour les détails
