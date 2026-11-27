# Système de notation

Ce document décrit le fonctionnement des notes dans Ekol : les objets manipulés, les formules de
calcul, les presets fournis et les exports.

## Concepts

| Objet | Description |
| --- | --- |
| **Période** | Découpage de l'année : « Séquence 1 » par défaut, renommable (trimestre, semestre…). |
| **Matière** | Nom + **coefficient** (1 par défaut). Une même matière peut exister avec plusieurs coefficients (ex. Mathématiques coef 2 et Mathématiques coef 4). |
| **Classe-matière** | Rattachement d'une matière (avec son coefficient) à une classe. Une matière peut être utilisée par plusieurs classes. |
| **Style de notation** | Ensemble de **composantes** avec des poids. Applicable au niveau de l'établissement, avec surcharge par classe. |
| **Composante** | Élément noté librement : Devoir, TP/Exposé, Session, Oral, Projet… Chaque composante a un nom, un groupe d'affichage et un poids. |
| **Note** | Valeur d'une composante pour un élève, une matière et une période donnés. |

Les composantes sont **libres** : aucun vocabulaire n'est imposé. Le champ « groupe » sert
uniquement à regrouper les colonnes à l'affichage (par exemple `Classe` et `Session`).

## Barème

Le barème est défini par établissement (`note_max`, **20 par défaut**). Toute note saisie doit être
comprise entre 0 et le barème. Les mentions sont calculées en pourcentage du barème, ce qui reste
correct si le barème change.

## Formules

### Moyenne d'une matière

```
moyenne_matière = Σ(note_composante × poids_composante) / Σ(poids_composantes)
```

Les poids sont **relatifs** : ils n'ont pas besoin de totaliser 100. Un style
`Devoir 20 / TP 20 / Session 60` et un style `Devoir 1 / TP 1 / Session 3` produisent le même
résultat.

### Moyenne générale

```
moyenne_générale = Σ(moyenne_matière × coefficient) / Σ(coefficients)
```

Seules les matières qui ont au moins une note comptent dans le numérateur. Le comportement des
notes absentes est décrit ci-dessous.

### Notes absentes

Deux modes, réglables dans **Paramètres → Notation** :

- **Une note absente compte 0** (par défaut) : la composante reste dans le dénominateur.
- **Les notes absentes sont ignorées** : la composante est retirée du calcul ; la moyenne porte
  alors uniquement sur les notes saisies.

Un élève qui n'a **aucune note** sur une période n'est pas classé : sa moyenne et son rang
affichent « — ». Il n'est pas pénalisé par un rang calculé à partir de zéros.

### Rang et mentions

Le rang est attribué par classe et par période. Les élèves à égalité de moyenne partagent le même
rang (ex. 1, 1, 3).

| Mention | Seuil (% du barème) |
| --- | --- |
| Excellent | ≥ 80 % |
| Très bien | ≥ 70 % |
| Bien | ≥ 60 % |
| Assez bien | ≥ 50 % |
| Passable | ≥ 40 % |
| Insuffisant | < 40 % |

Avec un barème /20 : Excellent ≥ 16, Très bien ≥ 14, Bien ≥ 12, Assez bien ≥ 10, Passable ≥ 8.

## Styles fournis

Chaque établissement reçoit six presets à sa création. **Standard 40/60** est le style par défaut.

| Style | Devoir | TP/Exposé | Session | Autres |
| --- | --- | --- | --- | --- |
| **Standard 40/60** (défaut) | 20 | 20 | 60 | — |
| Équilibré 50/50 | 25 | 25 | 50 | — |
| Continu 30/70 | 15 | 15 | 70 | — |
| Sans session | 50 | 50 | — | — |
| Sans TP | 40 | — | 60 | — |
| Devoirs multiples | 25 | 10 | 40 | Devoir 2 : 25 |

Les presets sont **modifiables et dupliquables**. Un style utilisé par une classe ou défini par
défaut ne peut pas être supprimé ; il peut être dupliqué puis adapté.

## Surcharge par classe

1. L'établissement définit un **style par défaut** (onglet *Styles de notation*).
2. Une classe peut choisir un autre style (fiche de la classe → *Style de la classe*).
3. Sans surcharge, la classe hérite du style par défaut.

Changer le style d'une classe change les composantes utilisées pour le calcul. Les notes saisies
pour des composantes qui n'existent plus ne sont pas affichées ; elles sont supprimées lorsqu'une
composante ou un style est supprimé (une confirmation est demandée).

## Exports

Depuis les écrans **Notes**, **Classes**, **Élèves** et **Fiche élève** :

- **CSV** : encodage UTF-8 avec BOM, séparateur `;`, compatible Excel français.
- **Excel** : fichier `.xls` au format HTML, ouvert nativement par Excel et LibreOffice, sans
  dépendance externe.

Les exports disponibles sont : liste des étudiants d'une classe (moyennes, rangs, mentions), notes
détaillées par matière et composante, liste générale filtrée/triée, et fiche individuelle.

## Rôles

| Rôle | Droits |
| --- | --- |
| **Super administrateur** | Tous les établissements, comptes, sauvegarde/restauration. |
| **Administrateur** | Données, classes, matières, styles, périodes et comptes de son établissement. |
| **Enseignant** | Consultation et saisie des notes ; pas de modification structurelle. |

Toutes les données sont filtrées par `organization_id` : un utilisateur ne voit jamais les données
d'un autre établissement.
