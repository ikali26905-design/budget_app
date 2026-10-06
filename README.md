# Mon Budget

Application web de suivi de budget personnel, pensée pour le téléphone et pour une utilisation à une main.
En quelques secondes, tu sais où va ton argent ce mois-ci et s'il te reste de la marge.

- **Accueil** : solde du mois en grand (revenus − dépenses − épargne), revenus, dépenses et épargne du mois, budget global, répartition des dépenses par catégorie, solde cumulé.
- **Ajout rapide** : « + » → montant (clavier numérique) → catégorie → valider. La date du jour est déjà remplie.
- **Historique** : transactions du mois groupées par jour, filtre par catégorie, modification, suppression avec confirmation.
- **Épargne** : tu mets de l'argent de côté sur des comptes (Livret A, Projets, Imprévus… personnalisables) ou tu en retires. L'écran affiche le total épargné, le solde de chaque compte et un objectif facultatif avec sa barre de progression. Touche un compte pour indiquer son **solde de départ** (ce qu'il contenait avant d'utiliser l'app).
- **Budgets** : plafond mensuel par catégorie et budget global. La barre est verte, devient orange à 80 % et rouge à 100 %.
- **Transactions mensuelles** : la case « Chaque mois » répète automatiquement une transaction (loyer, bourse, abonnement…).
- **Début des mois** : un mois peut commencer le jour où ta paye arrive (ex. octobre commence le 28 septembre). Quand tu saisis un revenu en fin de mois, l'app te propose de faire commencer le mois suivant ce jour-là. Les débuts se modifient ou se suppriment dans les Réglages.
- **Réglages** : catégories personnalisées, début des mois, export JSON/CSV, import JSON.
- **PWA** : l'app s'installe sur l'écran d'accueil et fonctionne hors connexion. Le thème clair ou sombre suit le réglage du téléphone.

Technologies : HTML, CSS et JavaScript « vanilla » (modules ES), sans framework, sans dépendance et sans étape de build.
Les graphiques sont dessinés en SVG fait maison.

---

## 1. Lancer l'application en local

Les modules ES (`<script type="module">`) et le service worker **ne fonctionnent pas** si on ouvre `index.html` par un double-clic (adresse `file://`).
Il faut passer par un petit serveur web local :

```bash
cd budget_app
python -m http.server 8000      # ou : python3 -m http.server 8000
```

Ouvre ensuite **http://localhost:8000** dans ton navigateur.

> Astuce : dans Chrome ou Firefox, les outils de développement (F12) proposent un mode « appareil mobile » (Ctrl+Maj+M).
> Il permet de voir l'app en largeur 375 px, comme sur un téléphone.

### Lancer les tests

Les fonctions de calcul (montants, dates, budgets, récurrences, export/import) sont testées avec le lanceur de tests intégré à Node.js (version 18 ou plus) :

```bash
npm test          # équivaut à : node --test
```

Aucune installation n'est nécessaire : `package.json` ne contient aucune dépendance et sert uniquement à déclarer la commande `npm test`.

---

## 2. Installer l'app sur ton téléphone

Pour être **installable** et fonctionner **hors connexion**, une PWA doit être servie en **HTTPS**.
Seule exception : `localhost`, qui n'existe que sur l'ordinateur.

### Méthode recommandée : GitHub Pages (gratuit, HTTPS)

1. Pousse le projet sur GitHub (c'est déjà le cas pour ce dépôt).
2. Sur GitHub, ouvre **Settings → Pages**, puis choisis **Deploy from a branch**, la branche voulue et le dossier `/ (root)`.
3. Attends une minute. L'app est alors en ligne à l'adresse `https://<ton-pseudo>.github.io/budget_app/`.
4. Ouvre cette adresse sur ton téléphone :
   - **Android (Chrome)** : menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
   - **iPhone (Safari)** : bouton Partager → **Sur l'écran d'accueil**.

L'icône apparaît avec tes autres applications. Elle s'ouvre en plein écran et fonctionne même en mode avion.

### Pour tester rapidement sur le même Wi-Fi (sans installation)

```bash
python -m http.server 8000 --bind 0.0.0.0
```

Trouve l'adresse IP de ton ordinateur (`ipconfig` sous Windows, `ip a` sous Linux, `ifconfig` sous macOS). Ouvre ensuite `http://192.168.x.x:8000` sur le téléphone.
L'app fonctionne, mais **sans** le mode hors connexion ni l'installation, car on est en HTTP et non sur localhost.

### Important : tes données restent sur l'appareil

Les données sont stockées dans le navigateur (`localStorage`), **séparément pour chaque appareil et chaque adresse**.
Les données saisies sur `localhost` ne sont donc pas visibles sur la version GitHub Pages, et inversement.
Pour les transférer ou les sauvegarder, utilise **Réglages → Sauvegarder (JSON)**, puis **Importer une sauvegarde** sur l'autre appareil.

> ⚠️ Si tu effaces les données du navigateur (ou désinstalles l'app), elles sont perdues. Exporte une sauvegarde de temps en temps.

---

## 3. Organisation du code

```
budget_app/
├── index.html          Structure de la page : en-tête, 4 écrans, onglets, bouton +, dialogues
├── manifest.json       Carte d'identité de la PWA (nom, icônes, couleurs, mode plein écran)
├── sw.js               Service worker : cache des fichiers pour le hors connexion
├── package.json        Uniquement pour « npm test » (aucune dépendance)
├── css/
│   └── style.css       Variables de thème (clair/sombre), mise en page mobile-first, composants
├── icons/              Icône SVG + versions PNG (180, 192, 512 px)
├── js/
│   ├── app.js          Point d'entrée : état de l'interface, actions, navigation
│   ├── store.js        Couche d'accès aux données : SEUL fichier qui touche à localStorage
│   ├── money.js        Montants : saisie → centimes → « 1 234,56 € »
│   ├── dates.js        Dates « AAAA-MM-JJ » : mois suivant, noms de mois, « Hier »…
│   ├── calculs.js      Calculs purs : totaux, soldes, état des budgets, récurrences
│   ├── periodes.js     Mois « budgétaires » : à quel mois appartient une date selon les débuts de mois
│   ├── charts.js       Graphiques SVG : barres de répartition et jauges de budget
│   ├── ui.js           Briques d'interface : création d'éléments, feuille, confirmation, toast
│   ├── ecrans.js       Rendu des 5 écrans
│   ├── formulaire.js   Feuilles de saisie : transaction, plafond/objectif, catégorie
│   └── io.js           Export JSON/CSV, validation de l'import JSON
└── tests/
    └── calculs.test.js Tests unitaires des fonctions pures
```

Par rapport à l'arborescence de départ, quatre fichiers ont été ajoutés pour garder des fichiers courts et spécialisés : `money.js`, `dates.js`, `calculs.js` et `io.js`. Deux autres, `ecrans.js` et `formulaire.js`, contiennent ce qui aurait rendu `ui.js` trop long.

### Le flux de données (à sens unique)

```
 Clic de l'utilisateur
        │
        ▼
 app.js (action) ──► store.js (modifie et enregistre)
        │
        ▼
 rafraichir() : relit les données ──► rendre() : redessine l'écran visible
```

Les écrans (`ecrans.js`) ne modifient jamais les données eux-mêmes : ils reçoivent un objet `actions` et appellent ses fonctions.
L'écran affiché est ainsi toujours le reflet exact de ce qui est enregistré.

### Fonctions pures et fonctions avec effets

- `money.js`, `dates.js`, `calculs.js` et une partie de `io.js` ne contiennent que des **fonctions pures** : mêmes entrées → même résultat, sans toucher au DOM ni au stockage. Elles se testent dans Node, sans navigateur.
- `store.js` (stockage), `ui.js`, `ecrans.js` et `formulaire.js` (DOM) ont des **effets de bord**, isolés dans ces fichiers.

---

## 4. Structure des données

Toutes les données sont enregistrées sous **une seule clé** `localStorage` : `budget-app:donnees`, au format JSON.

```jsonc
{
  "version": 2,                       // pour migrer les données si le format évolue
  "categories": [
    { "id": "courses", "nom": "Courses", "emoji": "🛒", "type": "depense", "couleur": 2 },
    { "id": "livret-a", "nom": "Livret A", "emoji": "🏦", "type": "epargne", "couleur": 1 }
  ],                                  // type : "depense", "revenu" ou "epargne" (compte d'épargne)
  "transactions": [
    {
      "id": "2f1c…",                  // identifiant unique (crypto.randomUUID)
      "type": "depense",              // "depense", "revenu", "epargne" (mettre de côté) ou "retrait"
      "montant": 1890,                // EN CENTIMES, entier positif → 18,90 €
      "categorieId": "courses",
      "date": "2026-10-05",           // AAAA-MM-JJ
      "note": "Lidl",
      "recurrenteId": null,           // id du modèle mensuel qui l'a créée, sinon null
      "creeLe": 1791190000000         // horodatage de saisie (pour trier les transactions d'un même jour)
    }
  ],
  "recurrentes": [
    {
      "id": "8a0d…", "type": "depense", "montant": 45000, "categorieId": "logement",
      "jour": 5,                      // jour du mois (31 → ramené au 30 ou au 28 selon le mois)
      "note": "Loyer",
      "dernierMois": "2026-10"        // dernier mois déjà généré
    }
  ],
  "budgets": { "courses": 25000 },    // plafond mensuel par catégorie, en centimes
  "budgetGlobal": 90000,              // plafond pour toutes les dépenses du mois (ou null)
  "objectifs": { "livret-a": 100000 }, // objectif de chaque compte d'épargne, en centimes
  "soldesInitiaux": { "livret-a": 120000 }, // ce que contenait le compte avant d'utiliser l'app
  "debutsMois": { "2026-11": "2026-10-28" }  // novembre commence le 28 octobre (jour de la paye)
}
```

### Choix importants

- **Montants en centimes (entiers).** En JavaScript, `0.1 + 0.2` vaut `0.30000000000000004`. Avec des entiers, aucun arrondi ne fausse les totaux. La saisie « 12,5 » est analysée comme du **texte** (`"12"` et `"5"` → 1250 centimes), sans jamais passer par un nombre à virgule. On ne divise par 100 qu'au moment d'afficher.
- **Montants toujours positifs.** C'est le champ `type` qui indique le sens, ce qui évite les erreurs de signe.
- **Dates en texte `AAAA-MM-JJ`.** Pas de problème de fuseau horaire, et l'ordre alphabétique correspond à l'ordre chronologique.
- **L'épargne.** Un versement (`epargne`) fait sortir l'argent du budget du mois, un retrait (`retrait`) l'y fait revenir. Le solde du mois vaut donc revenus − dépenses − (versements − retraits). Le solde d'un compte d'épargne vaut son solde de départ + ses versements − ses retraits, et il est **recalculé**, jamais stocké. Le solde de départ n'est pas une transaction : il ne modifie donc pas le solde du mois (cet argent était déjà de côté). On ne peut pas retirer plus que ce que contient le compte.
- **Migration.** Les données enregistrées avant l'ajout de l'épargne (version 1) sont mises à niveau automatiquement à l'ouverture : la fonction `migrer()` de `store.js` ajoute les comptes d'épargne par défaut et le champ `objectifs`. Un ancien fichier de sauvegarde reste importable.
- **Début des mois.** Un mois sans début indiqué commence le 1er ; sinon il commence à la date indiquée et se termine la veille du début du mois suivant. Le début du mois M doit tomber entre le 15 du mois précédent et le 14 du mois M : deux mois ne peuvent donc jamais se chevaucher, et une date suffit à savoir quel mois elle fait commencer. Les transactions gardent leur **vraie date** ; seul leur regroupement par mois est calculé (`moisBudgetaire()` dans `periodes.js`). Modifier ou supprimer un début de mois recalcule donc tout instantanément, sans toucher aux transactions. L'export CSV contient une colonne « Mois » avec ce mois budgétaire.
- **Rien n'est stocké en double.** Les totaux, le solde cumulé et l'état des budgets sont **recalculés** à chaque affichage, donc ils ne peuvent jamais être faux.
- **Transactions mensuelles.** À l'ouverture de l'app (et quand on y revient), `genererOccurrences()` crée les transactions manquantes jusqu'à aujourd'hui, puis met à jour `dernierMois`. Supprimer une occurrence ne la fait donc pas réapparaître.
- **Suppression d'une catégorie.** Elle est impossible tant qu'une transaction ou une transaction mensuelle l'utilise. L'app affiche combien d'éléments la bloquent.

### Remplacer localStorage par une vraie base de données

`store.js` est le seul fichier qui connaît `localStorage`, et toutes ses fonctions sont `async`.
Pour passer à une API ou à IndexedDB, il suffit de réécrire l'intérieur de ces fonctions, par exemple :

```js
export async function ajouterTransaction(champs) {
  const reponse = await fetch('/api/transactions', { method: 'POST', body: JSON.stringify(champs) });
  return reponse.json();
}
```

Le reste de l'application (`app.js`, les écrans…) n'a pas à changer.

---

## 5. Accessibilité et confort d'utilisation

- Zones tactiles d'au moins 44 px et texte de 16 px dans les champs : Safari iOS ne zoome pas automatiquement.
- Contrastes des textes ≥ 4,5:1 dans les deux thèmes.
- La couleur n'est jamais la seule information : les jauges affichent aussi un symbole (✓ ! ✕) et un texte (« Reste 5 € », « Dépassé de 4 € »).
- Dialogues natifs `<dialog>` : le focus est géré, la touche Échap ferme, et le focus revient sur le bouton d'origine.
- Les textes saisis (notes, noms de catégories) sont insérés avec `textContent`, jamais `innerHTML`. Une note contenant `<script>` s'affiche telle quelle, sans être exécutée (protection XSS).
- L'export CSV neutralise les cellules commençant par `=`, `+`, `-` ou `@`, pour qu'un tableur ne les exécute pas comme des formules.
- Le réglage « réduire les animations » du téléphone est respecté.

---

## 6. Mettre à jour l'app installée

Le service worker utilise la stratégie **« réseau d'abord, cache en secours »** : dès que le téléphone est en ligne, il récupère la dernière version des fichiers.
Si tu ajoutes un **nouveau fichier JS ou CSS**, pense à l'ajouter à la liste `FICHIERS_APP` de `sw.js` et à incrémenter `VERSION`, par exemple `'v2'`.
