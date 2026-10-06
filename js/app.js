// Point d'entrée de l'application : garde l'état, relie l'interface aux données.
//
// Principe (flux de données à sens unique) :
//   1. une action de l'utilisateur appelle store.js pour modifier les données ;
//   2. on recharge les données (rafraichir) ;
//   3. on redessine l'écran visible à partir de l'état (rendre).
// L'écran est donc toujours le reflet exact des données enregistrées.

import * as store from './store.js';
import { aujourdhui, moisDe, decalerMois, nomDuMois, libelleJour } from './dates.js';
import {
  genererOccurrences, transactionsDuMois, calculerTotaux, calculerTotalParCategorie, compterUtilisations, choisirCouleur,
  calculerSoldesEpargne,
} from './calculs.js';
import { formaterMontant, formaterMontantSigne } from './money.js';
import { afficherToast, informer, demanderConfirmation, fermerFeuille } from './ui.js';
import { ouvrirFormulaireTransaction, ouvrirFormulaireMontantCible, ouvrirFormulaireCategorie, ouvrirFormulaireCompte } from './formulaire.js';
import { rendreAccueil, rendreHistorique, rendreEpargne, rendreBudgets, rendreReglages } from './ecrans.js';
import { genererJSON, genererCSV, telecharger, nomFichier, validerImport } from './io.js';

// État de l'interface (les données elles-mêmes viennent toujours de store.js)
const etat = {
  donnees: null,
  mois: moisDe(aujourdhui()), // mois affiché, « AAAA-MM »
  ecran: 'accueil',
  filtre: null, // id de la catégorie filtrée dans l'historique (null = toutes)
};

/* ===================== Outils ===================== */

// Exécute une action ; en cas d'erreur, l'affiche dans une boîte de dialogue et renvoie false
async function executer(action) {
  try {
    await action();
    return true;
  } catch (erreur) {
    console.error(erreur);
    await informer('Oups, une erreur', erreur.message);
    return false;
  }
}

// Recharge les données depuis le store puis redessine
async function rafraichir() {
  etat.donnees = await store.chargerDonnees();
  rendre();
}

/* ===================== Affichage ===================== */

// Met à jour l'en-tête : nom du mois et bouton « Revenir à ce mois-ci »
function rendreEnTete() {
  document.getElementById('titre-mois').textContent = nomDuMois(etat.mois);
  document.getElementById('mois-actuel').hidden = etat.mois === moisDe(aujourdhui());
  const surReglages = etat.ecran === 'reglages';
  document.getElementById('nav-mois').hidden = surReglages;
  document.getElementById('titre-reglages').hidden = !surReglages;
}

// Fonctions de rendu de chaque écran
const RENDUS = {
  accueil: rendreAccueil,
  historique: rendreHistorique,
  epargne: rendreEpargne,
  budgets: rendreBudgets,
  reglages: rendreReglages,
};

// Affiche l'écran courant et met à jour l'onglet actif
function rendre() {
  rendreEnTete();
  const conteneur = document.getElementById(`ecran-${etat.ecran}`);
  RENDUS[etat.ecran]?.(conteneur, { donnees: etat.donnees, mois: etat.mois, filtre: etat.filtre, actions });
  document.querySelectorAll('.ecran').forEach((ecran) => {
    ecran.hidden = ecran.dataset.ecran !== etat.ecran;
  });
  document.querySelectorAll('.onglet').forEach((onglet) => {
    if (onglet.dataset.cible === etat.ecran) onglet.setAttribute('aria-current', 'page');
    else onglet.removeAttribute('aria-current');
  });
}

/* ===================== Récurrences ===================== */

// Crée les transactions récurrentes arrivées à échéance ; renvoie leur nombre
async function appliquerRecurrences() {
  const donnees = await store.chargerDonnees();
  const { nouvelles, derniersMois } = genererOccurrences(donnees.recurrentes, aujourdhui());
  if (nouvelles.length === 0) return 0;
  await store.ajouterTransactions(nouvelles);
  await store.enregistrerDerniersMois(derniersMois);
  return nouvelles.length;
}

// Construit un modèle récurrent à partir des valeurs du formulaire
function modeleDepuis(valeurs) {
  return {
    type: valeurs.type,
    montant: valeurs.montant,
    categorieId: valeurs.categorieId,
    note: valeurs.note,
    jour: Number(valeurs.date.slice(8, 10)),
  };
}

/* ===================== Transactions ===================== */

// Messages affichés après un ajout ou une suppression, selon le type
const MESSAGES = {
  depense: { ajout: 'Dépense ajoutée', suppression: 'Dépense supprimée', titre: 'Supprimer cette dépense ?' },
  revenu: { ajout: 'Revenu ajouté', suppression: 'Revenu supprimé', titre: 'Supprimer ce revenu ?' },
  epargne: { ajout: 'Argent mis de côté', suppression: 'Versement supprimé', titre: 'Supprimer ce versement d’épargne ?' },
  retrait: { ajout: 'Retrait enregistré', suppression: 'Retrait supprimé', titre: 'Supprimer ce retrait d’épargne ?' },
};

// Pour un retrait, vérifie que le compte contient assez d'argent ; renvoie un message d'erreur ou null
// (idExclu : en modification, on ne compte pas l'ancienne version de la transaction)
function verifierRetrait(valeurs, idExclu = null) {
  if (valeurs.type !== 'retrait') return null;
  const disponible = calculerSoldesEpargne(etat.donnees.transactions, { idExclu, soldesInitiaux: etat.donnees.soldesInitiaux })
    .get(valeurs.categorieId) ?? 0;
  if (valeurs.montant <= disponible) return null;
  const compte = etat.donnees.categories.find((c) => c.id === valeurs.categorieId);
  return `Il n’y a que ${formaterMontant(Math.max(disponible, 0))} sur « ${compte.nom} ». Tu ne peux pas retirer plus.`;
}

// Valide un formulaire de transaction : contrôle du retrait, puis enregistrement
async function validerTransaction(valeurs, idExclu, enregistrer) {
  const probleme = verifierRetrait(valeurs, idExclu);
  if (probleme) {
    await informer('Solde insuffisant', probleme);
    return false; // la feuille reste ouverte pour corriger le montant
  }
  return executer(enregistrer);
}

// Enregistre une nouvelle transaction (et son modèle mensuel si « Chaque mois » est coché)
async function ajouterTransaction(valeurs) {
  const { chaqueMois, ...champs } = valeurs;
  let recurrenteId = null;
  if (chaqueMois) {
    const modele = await store.ajouterRecurrente({ ...modeleDepuis(valeurs), dernierMois: moisDe(valeurs.date) });
    recurrenteId = modele.id;
  }
  await store.ajouterTransaction({ ...champs, recurrenteId });
  // Si la date est dans un mois passé, on rattrape les mois suivants
  if (chaqueMois) await appliquerRecurrences();
}

// Ouvre le formulaire d'ajout (bouton « + », ou boutons de l'écran Épargne)
function ouvrirAjout(typeParDefaut = 'depense') {
  ouvrirFormulaireTransaction({
    categories: etat.donnees.categories,
    typeParDefaut,
    surValider: (valeurs) => validerTransaction(valeurs, null, async () => {
      await ajouterTransaction(valeurs);
      const libelle = MESSAGES[valeurs.type].ajout;
      const autreMois = moisDe(valeurs.date) !== etat.mois;
      afficherToast(autreMois ? `${libelle} en ${nomDuMois(moisDe(valeurs.date)).toLowerCase()}` : libelle);
      await rafraichir();
    }),
  });
}

// Enregistre la modification d'une transaction et met à jour son modèle mensuel si besoin
async function enregistrerModification(transaction, modele, valeurs) {
  const { chaqueMois, ...champs } = valeurs;
  let recurrenteId = modele ? modele.id : null;
  if (modele && chaqueMois) {
    // Toujours mensuelle : les mois suivants reprendront les nouvelles valeurs
    await store.modifierRecurrente(modele.id, modeleDepuis(valeurs));
  } else if (modele && !chaqueMois) {
    // Case décochée : on arrête la répétition (les transactions passées restent)
    await store.supprimerRecurrente(modele.id);
    recurrenteId = null;
  } else if (!modele && chaqueMois) {
    const nouveau = await store.ajouterRecurrente({ ...modeleDepuis(valeurs), dernierMois: moisDe(valeurs.date) });
    recurrenteId = nouveau.id;
  }
  await store.modifierTransaction(transaction.id, { ...champs, recurrenteId });
  if (!modele && chaqueMois) await appliquerRecurrences();
}

// Demande confirmation puis supprime une transaction
async function confirmerSuppression(transaction) {
  const categorie = etat.donnees.categories.find((c) => c.id === transaction.categorieId);
  const ok = await demanderConfirmation({
    titre: MESSAGES[transaction.type].titre,
    message: `${categorie?.nom ?? 'Transaction'} · ${formaterMontant(transaction.montant)} · ${libelleJour(transaction.date).toLowerCase()}. Cette action est définitive.`,
    libelleValider: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  const reussi = await executer(() => store.supprimerTransaction(transaction.id));
  if (!reussi) return;
  fermerFeuille();
  afficherToast(MESSAGES[transaction.type].suppression);
  await rafraichir();
}

// Ouvre le formulaire pré-rempli pour modifier une transaction
function ouvrirModification(transaction) {
  const modele = etat.donnees.recurrentes.find((r) => r.id === transaction.recurrenteId) ?? null;
  ouvrirFormulaireTransaction({
    categories: etat.donnees.categories,
    transaction,
    estRecurrente: modele !== null,
    surValider: (valeurs) => validerTransaction(valeurs, transaction.id, async () => {
      await enregistrerModification(transaction, modele, valeurs);
      afficherToast('Transaction modifiée');
      await rafraichir();
    }),
    surSupprimer: () => confirmerSuppression(transaction),
  });
}

/* ===================== Budgets ===================== */

// Ouvre la saisie du plafond d'une catégorie, ou du budget global si categorieId vaut null
function ouvrirBudget(categorieId) {
  const duMois = transactionsDuMois(etat.donnees.transactions, etat.mois);
  const global = categorieId === null;
  const categorie = etat.donnees.categories.find((c) => c.id === categorieId);
  const depense = global
    ? calculerTotaux(duMois).depenses
    : (calculerTotalParCategorie(duMois).find((t) => t.categorieId === categorieId)?.total ?? 0);
  // Une seule fonction d'enregistrement : null = retirer le plafond
  const enregistrer = (plafond, message) => executer(async () => {
    if (global) await store.definirBudgetGlobal(plafond);
    else await store.definirBudget(categorieId, plafond);
    afficherToast(message);
    await rafraichir();
  });
  ouvrirFormulaireMontantCible({
    titre: global ? 'Budget global du mois' : `Budget ${categorie.emoji} ${categorie.nom}`,
    valeur: global ? etat.donnees.budgetGlobal : (etat.donnees.budgets[categorieId] ?? null),
    libelleChamp: 'Plafond mensuel',
    aide: `Dépensé ce mois-ci : ${formaterMontant(depense)}. Ce plafond s'applique à tous les mois.`,
    libelleRetirer: 'Retirer le plafond',
    surValider: (plafond) => enregistrer(plafond, 'Budget enregistré'),
    surRetirer: () => enregistrer(null, 'Plafond retiré'),
  });
}

/* ===================== Épargne ===================== */

// Ouvre la feuille d'un compte d'épargne : solde de départ et objectif
function ouvrirCompte(compteId) {
  const compte = etat.donnees.categories.find((c) => c.id === compteId);
  // Versements − retraits enregistrés dans l'app (sans le solde de départ)
  const mouvements = calculerSoldesEpargne(etat.donnees.transactions).get(compteId) ?? 0;
  ouvrirFormulaireCompte({
    compte,
    soldeInitial: etat.donnees.soldesInitiaux[compteId] ?? null,
    objectif: etat.donnees.objectifs[compteId] ?? null,
    mouvements,
    surValider: async (valeurs) => {
      // Baisser le solde de départ ne doit pas rendre le compte négatif (à cause de retraits déjà faits)
      if ((valeurs.soldeInitial ?? 0) + mouvements < 0) {
        await informer('Solde de départ trop bas',
          `Des retraits ont déjà été enregistrés sur ce compte : le solde de départ doit être d’au moins ${formaterMontant(-mouvements)}.`);
        return false;
      }
      return executer(async () => {
        await store.definirCompte(compteId, valeurs);
        afficherToast('Compte mis à jour');
        await rafraichir();
      });
    },
  });
}

/* ===================== Catégories ===================== */

// Ouvre la création d'une catégorie (couleur attribuée automatiquement)
function ouvrirAjoutCategorie(type) {
  const nomExiste = (nom, typeChoisi) => etat.donnees.categories
    .some((c) => c.type === typeChoisi && c.nom.toLocaleLowerCase('fr') === nom.toLocaleLowerCase('fr'));
  ouvrirFormulaireCategorie({
    type,
    nomExiste,
    surValider: (valeurs) => executer(async () => {
      const couleur = choisirCouleur(etat.donnees.categories, valeurs.type);
      await store.ajouterCategorie({ ...valeurs, couleur });
      afficherToast(valeurs.type === 'epargne' ? 'Compte ajouté' : 'Catégorie ajoutée');
      await rafraichir();
    }),
  });
}

// Précise ce qui disparaît avec une catégorie : plafond, solde de départ, objectif
function detailsSuppression(id) {
  const d = etat.donnees;
  if (d.soldesInitiaux[id]) return `, ainsi que son solde de départ de ${formaterMontant(d.soldesInitiaux[id])}`;
  if (d.budgets[id]) return ', ainsi que son plafond';
  if (d.objectifs[id]) return ', ainsi que son objectif';
  return '';
}

// Supprime une catégorie si elle n'est utilisée nulle part (sinon on explique pourquoi c'est impossible)
async function supprimerCategorie(categorie) {
  const utilisations = compterUtilisations(categorie.id, etat.donnees);
  if (utilisations.total > 0) {
    const details = [];
    if (utilisations.transactions > 0) details.push(`${utilisations.transactions} transaction${utilisations.transactions > 1 ? 's' : ''}`);
    if (utilisations.recurrentes > 0) details.push(`${utilisations.recurrentes} transaction${utilisations.recurrentes > 1 ? 's' : ''} mensuelle${utilisations.recurrentes > 1 ? 's' : ''}`);
    await informer('Catégorie utilisée',
      `« ${categorie.nom} » est utilisée par ${details.join(' et ')}. Change leur catégorie ou supprime-les d’abord.`);
    return;
  }
  const memeType = etat.donnees.categories.filter((c) => c.type === categorie.type);
  if (memeType.length === 1) {
    const quoi = { depense: 'une catégorie de dépenses', revenu: 'une catégorie de revenus', epargne: 'un compte d’épargne' }[categorie.type];
    await informer('Impossible de supprimer', `Il faut garder au moins ${quoi}.`);
    return;
  }
  const ok = await demanderConfirmation({
    titre: 'Supprimer cette catégorie ?',
    message: `« ${categorie.nom} » sera retirée de la liste${detailsSuppression(categorie.id)}.`,
    libelleValider: 'Supprimer',
    danger: true,
  });
  if (ok && await executer(() => store.supprimerCategorie(categorie.id))) {
    afficherToast('Catégorie supprimée');
    await rafraichir();
  }
}

// Arrête une transaction mensuelle (les transactions déjà créées restent)
async function arreterRecurrente(modele) {
  const nom = modele.note || etat.donnees.categories.find((c) => c.id === modele.categorieId)?.nom || 'Transaction';
  const ok = await demanderConfirmation({
    titre: 'Arrêter cette transaction mensuelle ?',
    message: `« ${nom} » (${formaterMontantSigne(modele.montant, modele.type)}) ne sera plus ajoutée les mois suivants. Les transactions déjà créées sont conservées.`,
    libelleValider: 'Arrêter',
    danger: true,
  });
  if (ok && await executer(() => store.supprimerRecurrente(modele.id))) {
    afficherToast('Répétition arrêtée');
    await rafraichir();
  }
}

/* ===================== Sauvegarde ===================== */

// Télécharge toutes les données au format JSON (sauvegarde complète, réimportable)
function exporterJSON() {
  telecharger(nomFichier('json'), genererJSON(etat.donnees), 'application/json');
  afficherToast('Sauvegarde exportée');
}

// Télécharge les transactions au format CSV (pour Excel / LibreOffice)
function exporterCSV() {
  if (etat.donnees.transactions.length === 0) {
    informer('Rien à exporter', 'Ajoute au moins une transaction avant d’exporter en CSV.');
    return;
  }
  telecharger(nomFichier('csv'), genererCSV(etat.donnees), 'text/csv;charset=utf-8');
  afficherToast('Fichier CSV exporté');
}

// Lit un fichier JSON choisi par l'utilisateur, le valide, puis remplace les données après confirmation
async function importerFichier(fichier) {
  let objet;
  try {
    objet = JSON.parse(await fichier.text());
  } catch {
    await informer('Import impossible', 'Ce fichier n’est pas un fichier JSON valide.');
    return;
  }
  const resultat = validerImport(objet);
  if (!resultat.ok) {
    await informer('Import impossible', resultat.erreur);
    return;
  }
  const nb = resultat.donnees.transactions.length;
  const ok = await demanderConfirmation({
    titre: 'Remplacer tes données ?',
    message: `Le fichier contient ${nb} transaction${nb > 1 ? 's' : ''}. Toutes tes données actuelles seront remplacées. Pense à exporter une sauvegarde avant si besoin.`,
    libelleValider: 'Remplacer',
    danger: true,
  });
  if (!ok) return;
  const reussi = await executer(async () => {
    await store.remplacerDonnees(resultat.donnees);
    await appliquerRecurrences();
  });
  if (reussi) {
    afficherToast('Données importées');
    await rafraichir();
  }
}

// Ouvre le sélecteur de fichier du téléphone pour l'import
function choisirFichierImport() {
  const champ = creerChampFichier();
  champ.value = ''; // permet de réimporter le même fichier deux fois de suite
  champ.click();
}

// Crée (une seule fois) le champ <input type="file"> invisible utilisé pour l'import
function creerChampFichier() {
  let champ = document.getElementById('champ-import');
  if (!champ) {
    champ = Object.assign(document.createElement('input'), { type: 'file', id: 'champ-import', accept: '.json,application/json', hidden: true });
    champ.addEventListener('change', () => {
      if (champ.files[0]) importerFichier(champ.files[0]);
    });
    document.body.append(champ);
  }
  return champ;
}

// Efface toutes les données après une confirmation explicite
async function toutEffacer() {
  const ok = await demanderConfirmation({
    titre: 'Tout effacer ?',
    message: 'Transactions, budgets et catégories personnalisées seront définitivement supprimés. Exporte une sauvegarde avant si tu veux pouvoir les récupérer.',
    libelleValider: 'Tout effacer',
    danger: true,
  });
  if (ok && await executer(store.reinitialiser)) {
    afficherToast('Données effacées');
    await rafraichir();
  }
}

/* ===================== Actions transmises aux écrans ===================== */

// Les écrans n'appellent jamais store.js directement : ils passent par ces fonctions
const actions = {
  modifierTransaction: ouvrirModification,
  modifierBudget: ouvrirBudget,
  ajouterEpargne: ouvrirAjout,
  modifierCompte: ouvrirCompte,
  ajouterCategorie: ouvrirAjoutCategorie,
  supprimerCategorie,
  arreterRecurrente,
  exporterJSON,
  exporterCSV,
  importer: choisirFichierImport,
  toutEffacer,
  changerFiltre(categorieId) {
    etat.filtre = categorieId;
    rendre();
  },
};

/* ===================== Navigation ===================== */

// Change d'écran (onglets du bas)
function changerEcran(nomEcran) {
  etat.ecran = nomEcran;
  rendre();
  window.scrollTo(0, 0);
}

// Avance ou recule d'un mois (n = 1 ou -1), ou revient au mois actuel (n = 0)
function changerMois(n) {
  etat.mois = n === 0 ? moisDe(aujourdhui()) : decalerMois(etat.mois, n);
  etat.filtre = null;
  rendre();
}

// Branche tous les écouteurs d'événements permanents
function brancherEvenements() {
  document.querySelector('.onglets').addEventListener('click', (evenement) => {
    const onglet = evenement.target.closest('.onglet');
    if (onglet) changerEcran(onglet.dataset.cible);
  });
  document.getElementById('mois-precedent').addEventListener('click', () => changerMois(-1));
  document.getElementById('mois-suivant').addEventListener('click', () => changerMois(1));
  document.getElementById('mois-actuel').addEventListener('click', () => changerMois(0));
  // Sur l'écran Épargne, le « + » propose directement de mettre de l'argent de côté
  document.getElementById('bouton-ajouter').addEventListener('click', () => ouvrirAjout(etat.ecran === 'epargne' ? 'epargne' : 'depense'));
}

/* ===================== Démarrage ===================== */

// Enregistre le service worker (hors connexion). Il n'existe qu'en HTTPS ou sur localhost.
function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch((erreur) => console.warn('Service worker non enregistré :', erreur));
}

// Quand on revient sur l'app (ouverte en arrière-plan depuis hier), on crée les récurrences du jour
function surRetourDansApp() {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const crees = await appliquerRecurrences().catch(() => 0);
    if (crees > 0) await rafraichir();
  });
}

// Lance l'application
async function demarrer() {
  brancherEvenements();
  surRetourDansApp();
  await executer(appliquerRecurrences);
  await rafraichir();
  enregistrerServiceWorker();
}

demarrer();
