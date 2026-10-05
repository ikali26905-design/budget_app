// Graphiques faits maison en SVG (aucune librairie).
//
// Astuce SVG : un <rect width="72%"> sans viewBox prend 72 % de la largeur du <svg>.
// On obtient ainsi des barres qui s'adaptent à l'écran sans déformer les coins arrondis.

import { creer } from './ui.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HAUTEUR_BARRE = 12;

// Crée un élément SVG avec ses attributs (les éléments SVG exigent createElementNS)
function creerSvg(balise, attributs = {}) {
  const element = document.createElementNS(SVG_NS, balise);
  for (const [nom, valeur] of Object.entries(attributs)) element.setAttribute(nom, valeur);
  return element;
}

// Dessine une barre horizontale : piste grise + remplissage coloré sur « proportion » (0 à 1)
function dessinerBarre(proportion, couleur, libelleAccessible) {
  const svg = creerSvg('svg', {
    class: 'barre-svg',
    width: '100%',
    height: HAUTEUR_BARRE,
    role: 'img',
    'aria-label': libelleAccessible,
  });
  svg.append(creerSvg('rect', { class: 'barre-svg__piste', x: 0, y: 0, width: '100%', height: HAUTEUR_BARRE, rx: 4 }));
  // Une barre non nulle reste visible (au moins 2 %), et ne dépasse jamais 100 %
  const largeur = proportion > 0 ? Math.min(100, Math.max(2, proportion * 100)) : 0;
  if (largeur > 0) {
    svg.append(creerSvg('rect', { x: 0, y: 0, width: `${largeur}%`, height: HAUTEUR_BARRE, rx: 4, fill: couleur }));
  }
  return svg;
}

/**
 * Graphique en barres horizontales triées (répartition des dépenses).
 * lignes : [{ emoji, libelle, valeur (centimes), couleur (CSS), texteValeur, textePourcent }]
 * Chaque barre est proportionnelle à la part du total : sa longueur correspond au pourcentage affiché.
 */
export function creerGraphiqueBarres(lignes, titreAccessible) {
  const total = lignes.reduce((s, l) => s + l.valeur, 0);
  const elements = lignes.map((ligne) => creer('li', { class: 'graphique__ligne' },
    creer('div', { class: 'graphique__legende' },
      creer('span', { class: 'graphique__nom' },
        creer('span', { 'aria-hidden': 'true' }, ligne.emoji), ' ', ligne.libelle),
      creer('span', { class: 'graphique__valeur montant' },
        ligne.texteValeur, ' ', creer('span', { class: 'graphique__pourcent' }, ligne.textePourcent)),
    ),
    dessinerBarre(total > 0 ? ligne.valeur / total : 0, ligne.couleur, `${ligne.libelle} : ${ligne.texteValeur}, ${ligne.textePourcent}`),
  ));
  return creer('ul', { class: 'graphique', 'aria-label': titreAccessible }, elements);
}

// Couleur et libellé associés à chaque niveau de budget (la couleur n'est jamais seule)
const NIVEAUX = {
  ok: { couleur: 'var(--etat-ok)', symbole: '✓', libelle: 'Dans le budget' },
  alerte: { couleur: 'var(--etat-alerte)', symbole: '!', libelle: 'Attention, plus de 80 %' },
  depasse: { couleur: 'var(--etat-depasse)', symbole: '✕', libelle: 'Plafond atteint ou dépassé' },
};

// Renvoie les infos d'affichage d'un niveau (« ok », « alerte », « depasse »)
export function infosNiveau(niveau) {
  return NIVEAUX[niveau];
}

/**
 * Jauge de budget : barre verte, orange (≥ 80 %) ou rouge (≥ 100 %).
 * etat : résultat de calculerEtatBudget() (dans calculs.js)
 */
export function creerJauge(etat, libelleAccessible) {
  const { couleur } = NIVEAUX[etat.niveau];
  return dessinerBarre(etat.plafond > 0 ? etat.depense / etat.plafond : 0, couleur, libelleAccessible);
}
