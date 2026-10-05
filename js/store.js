// Couche d'accès aux données : c'est le SEUL fichier qui connaît localStorage.
//
// Toutes les fonctions exportées sont « async » (elles renvoient une Promise), même si
// localStorage est synchrone. Ainsi, le jour où on remplace ce fichier par des appels
// à une vraie base de données (forcément asynchrones), le reste de l'app ne change pas.

const CLE_STOCKAGE = 'budget-app:donnees';
export const VERSION_DONNEES = 2; // 2 = ajout de l'épargne (comptes + objectifs)

// Comptes d'épargne créés au premier lancement (et ajoutés aux données d'avant la version 2)
const COMPTES_EPARGNE_PAR_DEFAUT = [
  { id: 'livret-a', nom: 'Livret A', emoji: '🏦', type: 'epargne', couleur: 1 },
  { id: 'projets', nom: 'Projets', emoji: '✈️', type: 'epargne', couleur: 2 },
  { id: 'imprevus', nom: 'Imprévus', emoji: '🛟', type: 'epargne', couleur: 3 },
];

// Catégories créées au premier lancement. « couleur » = numéro de teinte (1 à 8), voir style.css
const CATEGORIES_PAR_DEFAUT = [
  { id: 'logement', nom: 'Logement', emoji: '🏠', type: 'depense', couleur: 1 },
  { id: 'courses', nom: 'Courses', emoji: '🛒', type: 'depense', couleur: 2 },
  { id: 'transport', nom: 'Transport', emoji: '🚌', type: 'depense', couleur: 3 },
  { id: 'loisirs', nom: 'Loisirs', emoji: '🎮', type: 'depense', couleur: 4 },
  { id: 'sante', nom: 'Santé', emoji: '💊', type: 'depense', couleur: 5 },
  { id: 'abonnements', nom: 'Abonnements', emoji: '📱', type: 'depense', couleur: 6 },
  { id: 'etudes', nom: 'Études', emoji: '📚', type: 'depense', couleur: 7 },
  { id: 'autre', nom: 'Autre', emoji: '📦', type: 'depense', couleur: 8 },
  { id: 'bourse', nom: 'Bourse', emoji: '🎓', type: 'revenu', couleur: 1 },
  { id: 'job', nom: 'Job / Alternance', emoji: '💼', type: 'revenu', couleur: 2 },
  { id: 'aides', nom: 'Aides (APL, CAF)', emoji: '🏛️', type: 'revenu', couleur: 3 },
  { id: 'famille', nom: 'Famille', emoji: '👪', type: 'revenu', couleur: 4 },
  { id: 'autre-revenu', nom: 'Autre revenu', emoji: '💰', type: 'revenu', couleur: 5 },
  ...COMPTES_EPARGNE_PAR_DEFAUT,
];

// Copie en mémoire des données, pour ne pas relire localStorage à chaque appel
let cache = null;

// Crée la structure de données d'un tout premier lancement
function creerDonneesInitiales() {
  return {
    version: VERSION_DONNEES,
    categories: CATEGORIES_PAR_DEFAUT.map((c) => ({ ...c })),
    transactions: [],
    recurrentes: [],
    budgets: {},
    budgetGlobal: null,
    objectifs: {}, // objectif de chaque compte d'épargne, en centimes
  };
}

// Génère un identifiant unique (crypto.randomUUID n'existe pas hors HTTPS, d'où le plan B)
export function creerId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Copie profonde : on ne donne jamais à l'extérieur une référence vers le cache
function copier(objet) {
  return structuredClone(objet);
}

// Met à niveau des données d'une ancienne version (ou d'un import) vers la version actuelle
function migrer(donnees) {
  // Les champs absents (ex. « objectifs » avant la version 2) prennent leur valeur par défaut
  const resultat = { ...creerDonneesInitiales(), ...donnees, version: VERSION_DONNEES };
  // Avant la version 2, il n'y avait pas d'épargne : on ajoute les comptes par défaut
  if (!resultat.categories.some((c) => c.type === 'epargne')) {
    const idsPris = new Set(resultat.categories.map((c) => c.id));
    const comptes = COMPTES_EPARGNE_PAR_DEFAUT.map((c) => ({ ...c, id: idsPris.has(c.id) ? creerId() : c.id }));
    resultat.categories = [...resultat.categories, ...comptes];
  }
  return resultat;
}

// Lit les données depuis localStorage (ou crée les données initiales)
function lire() {
  if (cache) return cache;
  let texte = null;
  try {
    texte = localStorage.getItem(CLE_STOCKAGE);
  } catch {
    // Stockage inaccessible (navigation privée stricte…) : on travaille en mémoire
  }
  cache = texte ? lireTexteSauvegarde(texte) : creerDonneesInitiales();
  return cache;
}

// Décode le texte stocké ; s'il est corrompu, on le met de côté au lieu de l'écraser
function lireTexteSauvegarde(texte) {
  try {
    return migrer(JSON.parse(texte));
  } catch {
    try {
      localStorage.setItem(`${CLE_STOCKAGE}:corrompu`, texte);
    } catch {
      // rien de plus à faire
    }
    return creerDonneesInitiales();
  }
}

// Écrit les données dans localStorage ; lève une erreur lisible en cas d'échec
function ecrire(donnees) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
    cache = donnees;
  } catch {
    cache = null; // on se resynchronisera sur ce qui est vraiment enregistré
    throw new Error("Impossible d'enregistrer : la mémoire du navigateur est pleine ou bloquée.");
  }
}

// Applique une modification à une copie des données puis l'enregistre (tout ou rien)
function modifier(transformation) {
  const donnees = copier(lire());
  const resultat = transformation(donnees);
  ecrire(donnees);
  return resultat === undefined ? undefined : copier(resultat);
}

// Cherche un élément par id dans une liste, ou lève une erreur
function trouver(liste, id) {
  const element = liste.find((e) => e.id === id);
  if (!element) throw new Error('Élément introuvable (il a peut-être déjà été supprimé).');
  return element;
}

/* ===================== Lecture ===================== */

// Renvoie une copie de toutes les données
export async function chargerDonnees() {
  return copier(lire());
}

/* ===================== Transactions ===================== */

// Ajoute une transaction et la renvoie avec son id
export async function ajouterTransaction(champs) {
  return modifier((d) => {
    const transaction = { id: creerId(), creeLe: Date.now(), note: '', recurrenteId: null, ...champs };
    d.transactions.push(transaction);
    return transaction;
  });
}

// Ajoute plusieurs transactions d'un coup (utilisé par les récurrences)
export async function ajouterTransactions(liste) {
  return modifier((d) => {
    const maintenant = Date.now();
    for (const champs of liste) {
      d.transactions.push({ id: creerId(), creeLe: maintenant, note: '', recurrenteId: null, ...champs });
    }
  });
}

// Modifie les champs d'une transaction existante
export async function modifierTransaction(id, champs) {
  return modifier((d) => Object.assign(trouver(d.transactions, id), champs));
}

// Supprime une transaction
export async function supprimerTransaction(id) {
  return modifier((d) => {
    trouver(d.transactions, id);
    d.transactions = d.transactions.filter((t) => t.id !== id);
  });
}

/* ===================== Transactions récurrentes ===================== */

// Crée un modèle de transaction récurrente (renvoie le modèle avec son id)
export async function ajouterRecurrente(champs) {
  return modifier((d) => {
    const modele = { id: creerId(), note: '', ...champs };
    d.recurrentes.push(modele);
    return modele;
  });
}

// Modifie un modèle récurrent
export async function modifierRecurrente(id, champs) {
  return modifier((d) => Object.assign(trouver(d.recurrentes, id), champs));
}

// Met à jour le dernier mois généré de plusieurs modèles : { idModele: « AAAA-MM » }
export async function enregistrerDerniersMois(derniersMois) {
  return modifier((d) => {
    for (const modele of d.recurrentes) {
      if (derniersMois[modele.id]) modele.dernierMois = derniersMois[modele.id];
    }
  });
}

// Supprime un modèle récurrent (les transactions déjà créées sont conservées)
export async function supprimerRecurrente(id) {
  return modifier((d) => {
    trouver(d.recurrentes, id);
    d.recurrentes = d.recurrentes.filter((r) => r.id !== id);
    // Les transactions passées restent, mais ne sont plus liées au modèle
    for (const t of d.transactions) {
      if (t.recurrenteId === id) t.recurrenteId = null;
    }
  });
}

/* ===================== Catégories ===================== */

// Ajoute une catégorie (nom, emoji, type, couleur) et la renvoie
export async function ajouterCategorie(champs) {
  return modifier((d) => {
    const categorie = { id: creerId(), ...champs };
    d.categories.push(categorie);
    return categorie;
  });
}

// Supprime une catégorie, son éventuel plafond ou objectif (la vérification d'usage est faite avant, dans app.js)
export async function supprimerCategorie(id) {
  return modifier((d) => {
    trouver(d.categories, id);
    d.categories = d.categories.filter((c) => c.id !== id);
    delete d.budgets[id];
    delete d.objectifs[id];
  });
}

/* ===================== Budgets ===================== */

// Définit le plafond mensuel d'une catégorie (en centimes), ou le retire si null
export async function definirBudget(categorieId, plafond) {
  return modifier((d) => {
    if (plafond === null) delete d.budgets[categorieId];
    else d.budgets[categorieId] = plafond;
  });
}

// Définit le budget global mensuel (en centimes), ou le retire si null
export async function definirBudgetGlobal(plafond) {
  return modifier((d) => {
    d.budgetGlobal = plafond;
  });
}

// Définit l'objectif d'un compte d'épargne (en centimes), ou le retire si null
export async function definirObjectif(compteId, objectif) {
  return modifier((d) => {
    if (objectif === null) delete d.objectifs[compteId];
    else d.objectifs[compteId] = objectif;
  });
}

/* ===================== Sauvegarde ===================== */

// Remplace toutes les données (import). Les données doivent avoir été validées avant.
export async function remplacerDonnees(donnees) {
  ecrire(migrer(copier(donnees)));
}

// Efface tout et revient à l'état du premier lancement
export async function reinitialiser() {
  ecrire(creerDonneesInitiales());
}
