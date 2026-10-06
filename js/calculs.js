// Calculs métier : uniquement des fonctions PURES.
// Elles reçoivent des données, renvoient un résultat, et ne touchent ni au DOM ni au stockage.
// Avantage : on peut les tester dans Node sans navigateur.

import { moisDe, decalerMois, dateDansMois } from './dates.js';
import { moisBudgetaire, finPeriode } from './periodes.js';

// Seuil (en %) à partir duquel une barre de budget passe à l'orange
export const SEUIL_ALERTE = 80;

// Nombre de couleurs disponibles pour les catégories (--serie-1 à --serie-8)
export const NB_COULEURS = 8;

// Garde les transactions d'un mois budgétaire donné (« 2026-10 »)
// debuts : débuts de mois indiqués par l'utilisateur (voir periodes.js) ; {} = mois calendaires classiques
export function transactionsDuMois(transactions, mois, debuts = {}) {
  return transactions.filter((t) => moisBudgetaire(t.date, debuts) === mois);
}

// Additionne les montants d'une liste de transactions
function somme(transactions) {
  return transactions.reduce((total, t) => total + t.montant, 0);
}

// Quatre types de mouvement : « depense » et « epargne » (versement) font sortir l'argent du budget,
// « revenu » et « retrait » (d'épargne) l'y font entrer.

// Vrai si le type concerne l'épargne (versement ou retrait)
export function estEpargne(type) {
  return type === 'epargne' || type === 'retrait';
}

// Type de catégorie attendu pour un type de transaction (« retrait » → catégorie « epargne »)
export function typeDeCategorie(typeTransaction) {
  return estEpargne(typeTransaction) ? 'epargne' : typeTransaction;
}

// Calcule revenus, dépenses, épargne nette (versements − retraits) et solde disponible
export function calculerTotaux(transactions) {
  const total = (type) => somme(transactions.filter((t) => t.type === type));
  const revenus = total('revenu');
  const depenses = total('depense');
  const epargne = total('epargne') - total('retrait');
  return { revenus, depenses, epargne, solde: revenus - depenses - epargne };
}

// Solde de chaque compte d'épargne jusqu'à une date incluse : Map { idCompte → centimes }
// - soldesInitiaux : ce que contenaient les comptes avant d'utiliser l'app ({ idCompte → centimes })
// - idExclu : transaction à ignorer (par exemple celle qu'on est en train de modifier)
export function calculerSoldesEpargne(transactions, { dateLimite = '9999-12-31', idExclu = null, soldesInitiaux = {} } = {}) {
  // On part du solde de départ de chaque compte, puis on ajoute les versements et retire les retraits
  const soldes = new Map(Object.entries(soldesInitiaux));
  for (const t of transactions) {
    if (!estEpargne(t.type) || t.date > dateLimite || t.id === idExclu) continue;
    const signe = t.type === 'epargne' ? 1 : -1;
    soldes.set(t.categorieId, (soldes.get(t.categorieId) ?? 0) + signe * t.montant);
  }
  return soldes;
}

// Solde cumulé : toutes les transactions depuis le début jusqu'à la fin du mois (budgétaire) donné
export function calculerSoldeCumule(transactions, mois, debuts = {}) {
  const limite = finPeriode(mois, debuts);
  return calculerTotaux(transactions.filter((t) => t.date <= limite)).solde;
}

// Total par catégorie pour un type (« depense », « revenu »…), trié du plus gros au plus petit
export function calculerTotalParCategorie(transactions, type = 'depense') {
  const totaux = new Map();
  for (const t of transactions) {
    if (t.type !== type) continue;
    totaux.set(t.categorieId, (totaux.get(t.categorieId) ?? 0) + t.montant);
  }
  return [...totaux.entries()]
    .map(([categorieId, total]) => ({ categorieId, total }))
    .sort((a, b) => b.total - a.total);
}

// Pourcentage entier de « partie » par rapport à « tout » (0 si tout vaut 0)
export function pourcentage(partie, tout) {
  return tout > 0 ? Math.round((partie * 100) / tout) : 0;
}

// État d'un budget : pourcentage consommé, reste, et niveau « ok » / « alerte » (≥ 80 %) / « depasse » (≥ 100 %)
export function calculerEtatBudget(depense, plafond) {
  let niveau = 'ok';
  // Comparaison en entiers (depense × 100 ≥ plafond × 80) : pas d'arrondi qui fausse le seuil
  if (depense >= plafond) niveau = 'depasse';
  else if (depense * 100 >= plafond * SEUIL_ALERTE) niveau = 'alerte';
  return { depense, plafond, reste: plafond - depense, pourcentage: pourcentage(depense, plafond), niveau };
}

// Trie les transactions de la plus récente à la plus ancienne (puis par heure de saisie)
export function trierParDateDecroissante(transactions) {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.creeLe - a.creeLe);
}

// Regroupe des transactions par jour : [{ date, transactions, solde }] du plus récent au plus ancien
export function grouperParJour(transactions) {
  const groupes = [];
  for (const t of trierParDateDecroissante(transactions)) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.date === t.date) dernier.transactions.push(t);
    else groupes.push({ date: t.date, transactions: [t] });
  }
  return groupes.map((g) => ({ ...g, solde: calculerTotaux(g.transactions).solde }));
}

// Liste les occurrences de transactions récurrentes à créer jusqu'à aujourd'hui inclus.
// Renvoie les nouvelles transactions (sans id) et le dernier mois traité pour chaque modèle.
export function genererOccurrences(recurrentes, dateDuJour) {
  const moisCourant = moisDe(dateDuJour);
  const nouvelles = [];
  const derniersMois = {};
  for (const modele of recurrentes) {
    let mois = decalerMois(modele.dernierMois, 1);
    while (mois <= moisCourant) {
      const date = dateDansMois(mois, modele.jour);
      if (date > dateDuJour) break; // le jour n'est pas encore arrivé ce mois-ci
      nouvelles.push({
        type: modele.type,
        montant: modele.montant,
        categorieId: modele.categorieId,
        date,
        note: modele.note,
        recurrenteId: modele.id,
      });
      derniersMois[modele.id] = mois;
      mois = decalerMois(mois, 1);
    }
  }
  return { nouvelles, derniersMois };
}

// Compte combien de transactions et de modèles récurrents utilisent une catégorie
export function compterUtilisations(categorieId, donnees) {
  const transactions = donnees.transactions.filter((t) => t.categorieId === categorieId).length;
  const recurrentes = donnees.recurrentes.filter((r) => r.categorieId === categorieId).length;
  return { transactions, recurrentes, total: transactions + recurrentes };
}

// Choisit la couleur (1 à 8) la moins utilisée parmi les catégories du même type
export function choisirCouleur(categories, type) {
  const compteurs = new Array(NB_COULEURS).fill(0);
  for (const c of categories) {
    if (c.type === type) compteurs[c.couleur - 1] += 1;
  }
  return compteurs.indexOf(Math.min(...compteurs)) + 1;
}

// Liste les catégories utilisées par des transactions, dans l'ordre de la liste des catégories
export function categoriesUtilisees(transactions, categories) {
  const ids = new Set(transactions.map((t) => t.categorieId));
  return categories.filter((c) => ids.has(c.id));
}
