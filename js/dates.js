// Outils de dates. On manipule des chaînes « AAAA-MM-JJ » (jour) et « AAAA-MM » (mois) :
// pas de problème de fuseau horaire, et l'ordre alphabétique = l'ordre chronologique.

const formateurMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const formateurJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const formateurMoisSeul = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });
const formateurDateCourte = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const formateurDateLongue = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

// Ajoute un zéro devant les nombres à un chiffre : 5 → « 05 »
function deuxChiffres(nombre) {
  return String(nombre).padStart(2, '0');
}

// Met une majuscule à la première lettre : « octobre 2026 » → « Octobre 2026 »
function majuscule(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// Date du jour (heure locale du téléphone) au format « AAAA-MM-JJ »
export function aujourdhui(maintenant = new Date()) {
  return `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`;
}

// Mois d'une date : « 2026-10-05 » → « 2026-10 »
export function moisDe(date) {
  return date.slice(0, 7);
}

// Décale un mois de n mois (n peut être négatif) : (« 2026-12 », 1) → « 2027-01 »
export function decalerMois(mois, n) {
  const [annee, numero] = mois.split('-').map(Number);
  const total = annee * 12 + (numero - 1) + n;
  return `${Math.floor(total / 12)}-${deuxChiffres((total % 12) + 1)}`;
}

// Nombre de jours dans un mois : « 2028-02 » → 29
export function joursDansMois(mois) {
  const [annee, numero] = mois.split('-').map(Number);
  // Le jour 0 du mois suivant = le dernier jour du mois demandé
  return new Date(Date.UTC(annee, numero, 0)).getUTCDate();
}

// Construit une date dans un mois, en ramenant le jour au dernier jour possible (31 → 30, 29 ou 28)
export function dateDansMois(mois, jour) {
  return `${mois}-${deuxChiffres(Math.min(jour, joursDansMois(mois)))}`;
}

// Dernier jour d'un mois au format « AAAA-MM-JJ »
export function finDuMois(mois) {
  return dateDansMois(mois, 31);
}

// Convertit « AAAA-MM-JJ » en objet Date à midi UTC (uniquement pour Intl)
function versDateUTC(date) {
  const [a, m, j] = date.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12));
}

// Nom lisible d'un mois : « 2026-10 » → « Octobre 2026 »
export function nomDuMois(mois) {
  return majuscule(formateurMois.format(versDateUTC(`${mois}-01`)));
}

// Nom du mois sans l'année : « 2026-10 » → « octobre »
export function nomDuMoisSeul(mois) {
  return formateurMoisSeul.format(versDateUTC(`${mois}-01`));
}

// « de octobre » → « d'octobre » : élision devant une voyelle (avril, août, octobre)
export function deMois(mois) {
  const nom = nomDuMoisSeul(mois);
  return /^[aeiouéâ]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}

// Décale une date de n jours (n peut être négatif) : (« 2026-11-01 », -1) → « 2026-10-31 »
export function decalerJour(date, n) {
  const d = versDateUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Date courte : « 2026-09-28 » → « 28 sept. »
export function dateCourte(date) {
  return formateurDateCourte.format(versDateUTC(date));
}

// Date longue sans le jour de la semaine : « 2026-09-28 » → « 28 septembre »
export function dateLongue(date) {
  return formateurDateLongue.format(versDateUTC(date));
}

// Libellé d'un jour : « Aujourd'hui », « Hier » ou « Lundi 5 octobre »
export function libelleJour(date, reference = aujourdhui()) {
  if (date === reference) return "Aujourd'hui";
  const hier = versDateUTC(reference);
  hier.setUTCDate(hier.getUTCDate() - 1);
  if (date === hier.toISOString().slice(0, 10)) return 'Hier';
  return majuscule(formateurJour.format(versDateUTC(date)));
}

// Vérifie qu'une chaîne est une vraie date « AAAA-MM-JJ » (refuse le 31 février)
export function estDateValide(texte) {
  if (typeof texte !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
  const [, m, j] = texte.split('-').map(Number);
  return m >= 1 && m <= 12 && j >= 1 && j <= joursDansMois(texte.slice(0, 7));
}
