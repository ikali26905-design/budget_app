// Gestion des montants : stockés en CENTIMES (entiers), formatés en euros à l'affichage.
//
// Pourquoi des centimes ? En JavaScript, 0.1 + 0.2 === 0.30000000000000004.
// Avec des entiers, 10 + 20 === 30, toujours. On ne divise par 100 qu'au moment d'afficher.

// Montant maximum accepté pour une transaction (10 millions d'euros, en centimes)
export const MONTANT_MAX = 1_000_000_000;

// Formateur réutilisé (le créer coûte cher, on le fait une seule fois)
const formateurEuros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const formateurEurosRond = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

// Transforme une saisie (« 12 », « 12,5 », « 1 234,56 », « 12.50 ») en centimes, ou null si invalide
export function parserMontant(texte) {
  if (typeof texte !== 'string') return null;
  // On retire espaces (y compris insécables) et le symbole €
  const nettoye = texte.replace(/[\s  €]/g, '').replace('.', ',');
  // Format attendu : des chiffres, puis éventuellement une virgule et 1 ou 2 chiffres
  const correspondance = /^(\d{1,9})(?:,(\d{0,2}))?$/.exec(nettoye);
  if (!correspondance) return null;
  const euros = Number(correspondance[1]);
  // « 5 » après la virgule veut dire 50 centimes : on complète à droite avec des zéros
  const centimes = Number((correspondance[2] ?? '').padEnd(2, '0'));
  const total = euros * 100 + centimes;
  if (total <= 0 || total > MONTANT_MAX) return null;
  return total;
}

// Formate des centimes en texte français : 123456 → « 1 234,56 € »
export function formaterMontant(centimes) {
  return formateurEuros.format(centimes / 100);
}

// Comme formaterMontant, mais sans « ,00 » pour les montants ronds : 25000 → « 250 € »
export function formaterMontantCourt(centimes) {
  return centimes % 100 === 0 ? formateurEurosRond.format(centimes / 100) : formaterMontant(centimes);
}

// Formate avec un signe explicite selon le type : « +1 200,00 € » ou « −45,90 € »
export function formaterMontantSigne(centimes, type) {
  const signe = type === 'revenu' ? '+' : '−';
  return signe + formaterMontant(centimes);
}

// Prépare des centimes pour un champ de saisie : 1250 → « 12,50 »
export function centimesVersSaisie(centimes) {
  const euros = Math.floor(centimes / 100);
  const reste = String(centimes % 100).padStart(2, '0');
  return `${euros},${reste}`;
}
