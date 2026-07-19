# Ekol — Gestion Scolaire

## Description

Ekol est une application de bureau cross-platform de gestion scolaire développée avec Neutralinojs. Elle permet aux établissements scolaires de gérer leurs cycles, classes, élèves et paiements, le tout en local sur une base SQLite.

## Fonctionnalités

- **Dashboard** — Vue d'ensemble avec statistiques (élèves actifs, total collecté, attendu, taux de collecte par cycle, tendance mensuelle des paiements)
- **Cycles** — CRUD des cycles pédagogiques (Primaire, Collège, Lycée, etc.)
- **Classes** — CRUD des classes liées aux cycles, avec montants d'inscription et mensualités par classe
- **Élèves** — Inscription avec matricule auto-généré (EKL-YYYY-XXXX), liste avec filtres (nom, classe, cycle, statut), recherche avancée
- **Fiche élève** — Détail complet, historique des paiements, solde, modification des infos, désactivation
- **Paiements** — Enregistrement avec référence auto-générée (REC-YYYYMMDD-XXXX), validation de solde, modes de paiement (Espèces, Chèque, Virement, Mobile Money)
- **Paramètres** — Monnaie générale configurable (XAF, XOF, FCFA, EUR, USD, GBP, NGN)

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

## Prochaines étapes

### Reçus de paiement en image/PDF
- Générer un reçu imprimable (HTML/CSS → PNG/PDF) après chaque paiement
- Approche légère : `html2canvas` côté client pour le PNG
- Approche lourde : Puppeteer/Playwright headless pour le PDF
- Voir `docs/rendu-html.md` pour les détails
