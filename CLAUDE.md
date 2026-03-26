# LBF Stock v2 — Guide pour Claude Code

## Vue d'ensemble

Application de gestion d'inventaire acier pour **Le Bras Frères** (métallerie).
Refonte propre de la v1 avec les améliorations suivantes :
- CSS dans des fichiers `.css` séparés (jamais inline dans les HTML)
- Mots de passe SHA-256 dès le départ (jamais en clair, même en base)
- Schéma Supabase propre avec vraies contraintes PostgreSQL
- Authentification via RPC `verify_user` (SECURITY DEFINER) — protège `password_hash`
- Historique git propre

## Stack technique

- **Frontend** : Vanilla JS, HTML5, CSS3 — **aucun framework, aucun npm**
- **Base de données** : Supabase (PostgreSQL + REST API)
- **Déploiement cible** : SharePoint / OneDrive Entreprise
- **Build** : aucun — ouvrir `index.html` directement dans un navigateur

Pour les tests locaux avec Supabase : `python3 -m http.server 8080` (évite les CORS).

## Structure des fichiers

```
lbf-stock-v2/
├── index.html                 # Page de connexion
├── views/
│   ├── stock.html             # Inventaire principal
│   ├── bibliotheque.html      # Catalogue des profilés
│   ├── demandes.html          # Demandes d'affectation
│   └── comptes.html           # Gestion des comptes (admin)
├── auth/
│   └── auth.js                # Session, RBAC, guards (requireAuth)
├── js/
│   ├── config.js              # URL + clé anon Supabase (NE PAS COMMITTER les vraies valeurs)
│   ├── supabase.js            # Client REST Supabase (sans SDK)
│   ├── utils.js               # SHA-256, formatters, flash, debounce…
│   ├── login.js               # Logique du formulaire de connexion
│   ├── stock.js               # Module inventaire
│   ├── bibliotheque.js        # Module bibliothèque des sections
│   ├── demandes.js            # Module demandes
│   └── comptes.js             # Module comptes (admin)
├── css/
│   ├── main.css               # Variables, reset, composants globaux
│   ├── login.css              # Page de connexion
│   ├── stock.css              # Page inventaire
│   ├── bibliotheque.css       # Page bibliothèque
│   ├── demandes.css           # Page demandes
│   └── comptes.css            # Page comptes
├── data/
│   └── sections.json          # Profilés acier (fallback hors-ligne)
└── sql/
    ├── 01_schema.sql          # Tables, triggers, fonction verify_user
    ├── 02_rls.sql             # Row Level Security
    └── 03_seed.sql            # Admin initial + catalogue sections
```

## Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor** et exécuter dans l'ordre :
   - `sql/01_schema.sql`
   - `sql/02_rls.sql`
   - `sql/03_seed.sql` (avec la **service_role key** pour bypasser RLS)
3. Dans `js/config.js`, renseigner :
   ```js
   const SUPABASE_URL      = 'https://xxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```
4. Pour le seed : générer le SHA-256 du mot de passe admin initial :
   ```bash
   echo -n "VotreMotDePasse" | shasum -a 256
   ```
   Ou utiliser `utils.hashPassword("VotreMotDePasse")` dans la console navigateur
   après avoir ouvert `index.html` avec config.js rempli.

## Modèles de données

### Table `users`
| Champ          | Type    | Notes                          |
|----------------|---------|--------------------------------|
| id             | UUID    | PK auto                        |
| username       | TEXT    | Unique, clé de session         |
| password_hash  | TEXT    | SHA-256 hex — jamais exposé anon|
| nom / prenom   | TEXT    |                                |
| role           | TEXT    | consultation / gestion / administration |
| actif          | BOOLEAN | Désactiver sans supprimer      |

### Table `stock`
| Champ              | Type    | Notes                          |
|--------------------|---------|--------------------------------|
| id                 | TEXT    | PK : BAR-XXXXXXXX ou TOL-XXXXXXXX |
| categorie          | TEXT    | 'profil' ou 'tole'             |
| designation        | TEXT    | Libellé complet                |
| section_type       | TEXT    | IPE, HEA, UPN… (profils)      |
| section_designation| TEXT    | Taille : 200, 300…             |
| longueur_m         | NUMERIC | Longueur en mètres (profils)   |
| poids_ml           | NUMERIC | kg/m (profils)                 |
| poids_barre_kg     | NUMERIC | Poids total (profils)          |
| nuance             | TEXT    | S235, S355… (tôles)           |
| epaisseur_mm       | NUMERIC | Épaisseur (tôles)              |
| largeur_mm         | NUMERIC | Largeur (tôles)                |
| longueur_tole_mm   | NUMERIC | Longueur (tôles)               |
| poids_kg           | NUMERIC | Poids total (tôles)            |
| lieu_stockage      | TEXT    |                                |
| disponibilite      | TEXT    | disponible / reserve / sorti   |
| statut             | TEXT    | valide / en_attente / rejete / archive |
| ajoute_par         | TEXT    | → users.username               |
| valide_par         | TEXT    | → users.username               |

### Table `sections` (bibliothèque)
Catalogue des profilés standards avec dimensions et poids/ml.
Familles : IPE, IPN, HEA, HEB, HEM, UPE, UPN, Cornière, Tube carré, Tube rond, Plat, Rond plein.

### Table `demandes`
Demandes d'affectation d'un item de stock à un chantier.
Statuts : `en_attente` → `approuvee` / `refusee` / `annulee`.

## Architecture auth

### Flux de connexion
1. L'utilisateur saisit identifiant + mot de passe
2. `utils.hashPassword()` calcule le SHA-256 via `crypto.subtle`
3. `auth.login()` appelle `db.rpc('verify_user', {...})`
4. La fonction PG SECURITY DEFINER vérifie le hash en base (sans exposer `password_hash`)
5. Si OK → objet user stocké dans `sessionStorage` (pas localStorage → vidé à la fermeture)
6. Redirection vers `views/stock.html`

### Guards RBAC
```js
// En tête de chaque page protégée :
const user = auth.requireAuth();                          // tout rôle connecté
const user = auth.requireAuth(['gestion','administration']); // rôle minimum
```

### Rôles
| Rôle           | Droits |
|----------------|--------|
| `consultation` | Lecture + demande d'affectation |
| `gestion`      | + Ajout/modification (statut en_attente, validation requise) |
| `administration` | Tout + validation + gestion comptes |

## RLS (Row Level Security)

La clé `anon` (exposée dans le JS) a des droits restreints :
- **sections** : SELECT uniquement
- **stock** : SELECT (valide + en_attente), INSERT (statut forcé à en_attente par trigger), UPDATE (limité)
- **demandes** : SELECT + INSERT + UPDATE (statut annulée)
- **users** : accès via `verify_user()` uniquement (password_hash jamais exposé)

La page **comptes** nécessite la `service_role key` pour lire la vue `users_public`.
Pour une config production, envisager un **Supabase Edge Function** dédié.

## Client Supabase (js/supabase.js)

API fluide sans SDK :
```js
// Lecture
const { data, error } = await db.from('stock')
  .select('*')
  .eq('statut', 'valide')
  .order('created_at', false)
  .get();

// Écriture
await db.from('stock').insert({ id: 'BAR-0001', ... });
await db.from('stock').eq('id', 'BAR-0001').update({ disponibilite: 'sorti' });

// RPC
await db.rpc('verify_user', { p_username: 'admin', p_password_hash: '...' });
```

## Conventions de code

- **Pas de framework** — DOM natif, `fetch`, `sessionStorage`, `crypto.subtle`
- **Pas de bundler** — les scripts sont chargés via `<script src="...">` dans l'ordre
- **CSS variables** — design system dans `css/main.css` (`:root { --color-primary: ... }`)
- **Sécurité** — utiliser `utils.escHtml()` pour toute valeur injectée dans `.innerHTML`
- **Commits** — messages en français, une fonctionnalité par commit

## Points d'attention

1. **config.js** ne doit jamais contenir de vraies clés en production dans git
2. Le trigger `enforce_stock_statut_on_insert` empêche un insert avec `statut='valide'` via anon
3. La fonction `verify_user` doit avoir `GRANT EXECUTE ON FUNCTION verify_user TO anon`
4. La vue `users_public` exclut `password_hash` — à utiliser pour la page comptes
5. Pour SharePoint : uploader tout le dossier, pas besoin de build

## Aucune commande build/test

```bash
# Serveur de dev local
python3 -m http.server 8080
# Puis ouvrir http://localhost:8080
```
