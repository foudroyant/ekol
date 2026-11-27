# Ekol Cloud — sauvegarde & synchronisation (PocketBase)

Backend payant d'Ekol : sauvegarde chiffrée par l'usage, synchronisation multi-postes et
abonnement **25 000 FCFA / an**. Tient dans **un seul binaire PocketBase** (+ ce dossier) :
aucun autre serveur, aucune dépendance.

```
cloud/
├── pb_migrations/   schéma : devices, pairing_codes, subscriptions, backups, exports (+ phone sur users)
├── pb_hooks/        logique métier : appairage, abonnement, expirations (cron quotidien 2h)
├── pb_public/       mini-site : compte, abonnement, appairage, sauvegardes, exports CSV
└── README.md        ce fichier
```

## Démarrage rapide (VPS)

```bash
# 1. Binaire (Linux x64, ~30 Mo) — prenez la version testée dans pb_migrations si possible
curl -sL -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.40.6/pocketbase_0.40.6_linux_amd64.zip
unzip pb.zip pocketbase && chmod +x pocketbase

# 2. Arborescence
mkdir -p ekol-cloud && cd ekol-cloud
cp -r <repo>/cloud/pb_migrations cloud/pb_hooks cloud/pb_public .

# 3. Premier superuser (2 min, puis Ctrl+C)
./pocketbase superuser upsert admin@example.com "mot-de-passe-solide"

# 4. Lancement (données dans ./pb_data)
./pocketbase serve --http=127.0.0.1:8090
```

Mettez un reverse proxy TLS devant (Caddy / Nginx) et exposez un domaine, ex.
`https://ekol-cloud.example.com`. Plusieurs clouds possibles : chaque établissement (ou
regroupement) a son domaine, et l'app de bureau mémorise **un domaine par établissement**.

## Modèle de données

| Collection | Type | Rôle |
| --- | --- | --- |
| `users` (+`phone`) | auth native | Comptes créés par les utilisateurs eux-mêmes sur le mini-site |
| `devices` | auth | Identité de chaque app de bureau (email `d-…@ekol-device.local` + secret local) ; `owner` = utilisateur après appairage ; `sub_active`/`sub_expires` recopiés depuis l'abonnement |
| `pairing_codes` | base | Codes d'appairage : **l'id du record EST le code** (10 caractères). TTL 15 min, statut pending/claimed/expired |
| `subscriptions` | base | `plan=annuel`, `amount=25000`, `currency=FCFA`, statuts pending/active/expired/cancelled, `payment_ref`, `started_at`, `expires_at` |
| `backups` | base | Instantanés `snapshot.json` (+ checksum SHA-256, compteurs, version app). Fichier **protégé** (token requis) |
| `exports` | base | CSV (`eleves`, `notes`, `paiements`) rattachés à une sauvegarde, **protégés**, suppression en cascade |

Règles : inscription et création d'appareil/code ouvertes ; tout le reste exige le bon
propriétaire (appareil lui-même ou utilisateur propriétaire). `backups` et `exports`
portent un champ `owner` dénormalisé (envoyé à l'upload, égalité vérifiée par la règle
avec `@request.auth.owner`) : les règles de lecture ne traversent **aucune** relation
(`device = @request.auth.id || owner = @request.auth.id`). L'upload exige
`sub_active = true` (vérifié dans la règle, pas seulement côté client).

## Abonnement 25 000 FCFA / an

1. L'utilisateur crée son compte sur le mini-site et clique **Demander** → abonnement `pending`.
2. Il paie (Mobile Money / espèces) et communique la référence.
3. L'admin ouvre l'interface PocketBase (`/_/`), passe l'abonnement à `active`, renseigne
   `payment_ref`, `started_at` et `expires_at` (= +365 jours) → les hooks activent aussitôt
   tous les appareils du compte.
4. Le cron quotidien expire les abonnements dépassés et coupe les flags appareils.
5. Renouvellement = nouvelle demande ; l'historique reste consultable.

Le connecteur de paiement automatique (ex. Mobile Money API) se branchera plus tard sur
`payment_ref` + webhook → passage à `active`. En attendant, activation manuelle (< 24 h).

## Flux d'appairage (sans mot de passe partagé)

1. Bureau : **Cloud → Générer un code** → crée `devices` + `pairing_codes/{CODE}` (public, 15 min).
2. L'app affiche `CODE` (ex. `k7x2k9pqa4b7de` (affiché `K7X2K-9PQA4-B7DE2`)).
3. Cloud (connecté) : **Compte → Associer** + `CODE` → `claimed_by = moi`.
4. Le hook lie `devices.owner`, recopie l'état d'abonnement ; l'app (qui scrute le code)
   s'authentifie ensuite **en tant qu'appareil** — le mot de passe utilisateur ne transite jamais.

## Sauvegarde / restauration

- **Montée** : l'app construit `snapshot.json` (tables de l'établissement + checksum SHA-256),
  l'envoie avec 3 CSV (`eleves`, `notes`, `paiements`). Sans abonnement actif → refus `403`.
- **Descente** : le mini-site liste par appareil avec téléchargement (snapshot + CSV).
- **Restauration bureau** : **Cloud → Restaurer depuis un fichier** (double confirmation ;
  remplace les données de l'établissement courant, puis déconnexion forcée par sécurité).

## Quirks PocketBase constatés (v0.40, vérifiés par tests)

- **Filtre serveur sur relation + règle qui traverse une relation = 400** :
  `GET /collections/backups/records?filter=device='…'` avec la règle
  `device.owner = @request.auth.id` échoue. Les règles restreignent déjà
  aux bonnes lignes : **filtrer côté client** après un list simple.
- **Tri serveur (`sort=`) + règles sur les mêmes collections = 400 intermittent** :
  trier côté client (`String(b.created).localeCompare(...)`).
- **IDs personnalisés** : 15 caractères exactement, `[a-z0-9]` uniquement
  (ni plus, ni moins, ni majuscules) — d'où les codes d'appairage à 15 car.
- **JSVM : aucun partage de portée entre handlers** : chaque handler
  `onRecord*`/`cronAdd` doit être **autonome** (tout le code inliné).
  Référencer une fonction ou constante de fichier lève `ReferenceError`.
  Seules les globales du runtime (`$app`, `console`, `BadRequestError`, …)
  sont utilisables. De même, `e.record.set()` dans un hook *Request ne
  persiste pas de façon fiable : les hooks Request **valident**,
  les mutations ont lieu après succès ou via `app.save()`.
- **`@request.auth.<champ_personnalisé>`** (ex. `sub_active`, `owner`)
  **fonctionne** dans les règles — c'est le socle du contrôle d'abonnement.

## Reverse proxy minimal (Caddy)

```
ekol-cloud.example.com {
    reverse_proxy 127.0.0.1:8090
}
```

Limitez le débit sur `/api/collections/pairing_codes` et `/api/collections/devices`
(créations publiques) si vous êtes exposé au spam.

## Sauvegarde du cloud lui-même

`./pocketbase backup create` (ou l'admin `/_/` → Settings → Backups), + copie `pb_data/`
chiffrée hors site. Sans cela, le cloud reste un point unique de défaillance : rappelez-le
aux clients dans le contrat annuel.
