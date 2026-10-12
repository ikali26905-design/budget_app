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

// Barre de progression simple (ex. objectif d'épargne) : proportion de 0 à 1, couleur CSS
export function creerBarreProgression(proportion, couleur, libelleAccessible) {
  return dessinerBarre(proportion, couleur, libelleAccessible);
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

/* ===================== Graphique d'évolution (PEA) ===================== */

// Dimensions du dessin (unités du viewBox : le SVG s'adapte ensuite à la largeur disponible)
const LARGEUR = 320;
const HAUTEUR = 150;
const MARGES = { gauche: 8, droite: 8, haut: 12, bas: 12 };

// Construit l'attribut « d » d'une ligne brisée à partir de points { x, y }
function tracerLigne(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/**
 * Graphique d'évolution : valeur relevée (trait plein) et montant investi (pointillés) dans le temps.
 * - points : [{ date, valeur, investi }] triés par date (au moins 2)
 * - formaterMontant / formaterDate : fonctions d'affichage fournies par l'appelant
 * Toucher (ou sélectionner au clavier) un point affiche son détail sous le graphique.
 */
export function creerGraphiqueEvolution(points, { formaterMontant, formaterDate }) {
  // Échelle verticale : de la plus petite à la plus grande valeur, avec un peu de marge
  const valeurs = points.flatMap((p) => [p.valeur, p.investi]);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const marge = Math.max((max - min) * 0.1, 100);
  const bas = min - marge;
  const haut = max + marge;
  const zoneX = LARGEUR - MARGES.gauche - MARGES.droite;
  const zoneY = HAUTEUR - MARGES.haut - MARGES.bas;
  // Les relevés sont espacés régulièrement : un point par relevé, de gauche à droite
  const x = (i) => MARGES.gauche + (points.length === 1 ? zoneX / 2 : (i * zoneX) / (points.length - 1));
  const y = (montant) => MARGES.haut + ((haut - montant) / (haut - bas)) * zoneY;

  const svg = creerSvg('svg', { class: 'evolution__svg', viewBox: `0 0 ${LARGEUR} ${HAUTEUR}`, role: 'img', 'aria-label': 'Évolution de la valeur du PEA et du montant investi' });
  // Lignes de repère horizontales (haut et bas de l'échelle)
  for (const montant of [max, min]) {
    svg.append(creerSvg('line', { class: 'evolution__repere', x1: MARGES.gauche, x2: LARGEUR - MARGES.droite, y1: y(montant), y2: y(montant) }));
  }
  svg.append(creerSvg('path', { class: 'evolution__investi', d: tracerLigne(points.map((p, i) => ({ x: x(i), y: y(p.investi) }))) }));
  svg.append(creerSvg('path', { class: 'evolution__valeur', d: tracerLigne(points.map((p, i) => ({ x: x(i), y: y(p.valeur) }))) }));
  const curseur = creerSvg('line', { class: 'evolution__curseur', y1: MARGES.haut, y2: HAUTEUR - MARGES.bas });
  svg.append(curseur);
  const marqueurs = points.map((p, i) => {
    const cercle = creerSvg('circle', { class: 'evolution__point', cx: x(i), cy: y(p.valeur), r: 4 });
    svg.append(cercle);
    return cercle;
  });

  const detail = creer('p', { class: 'evolution__detail', 'aria-live': 'polite' });
  // Met en avant un point : curseur vertical, point agrandi, détail en texte
  const selectionner = (i) => {
    const p = points[i];
    curseur.setAttribute('x1', x(i));
    curseur.setAttribute('x2', x(i));
    marqueurs.forEach((m, j) => m.setAttribute('r', j === i ? 6 : 4));
    remplirDetail(detail, p, formaterMontant, formaterDate);
  };

  // Zones tactiles : une bande verticale par point, bien plus large que le point lui-même
  const largeurBande = points.length === 1 ? zoneX : zoneX / (points.length - 1);
  points.forEach((p, i) => {
    const zone = creerSvg('rect', {
      class: 'evolution__zone', x: x(i) - largeurBande / 2, y: 0, width: largeurBande, height: HAUTEUR,
      tabindex: 0, role: 'button', 'aria-label': `Relevé du ${formaterDate(p.date)}`,
    });
    zone.addEventListener('click', () => selectionner(i));
    zone.addEventListener('focus', () => selectionner(i));
    svg.append(zone);
  });
  selectionner(points.length - 1);

  return creer('figure', { class: 'evolution' },
    creer('div', { class: 'evolution__legende', 'aria-hidden': 'true' },
      creer('span', { class: 'evolution__cle evolution__cle--valeur' }, 'Valeur'),
      creer('span', { class: 'evolution__cle evolution__cle--investi' }, 'Investi')),
    creer('div', { class: 'evolution__cadre' },
      creer('span', { class: 'evolution__echelle evolution__echelle--haut' }, formaterMontant(max)),
      svg,
      creer('span', { class: 'evolution__echelle evolution__echelle--bas' }, formaterMontant(min))),
    creer('div', { class: 'evolution__axe' },
      creer('span', {}, formaterDate(points[0].date)),
      creer('span', {}, formaterDate(points[points.length - 1].date))),
    detail,
  );
}

// Texte sous le graphique : « 30 sept. · Valeur 3 240 € · Investi 3 000 € »
function remplirDetail(element, point, formaterMontant, formaterDate) {
  element.replaceChildren(
    creer('strong', {}, formaterDate(point.date)),
    ` · Valeur ${formaterMontant(point.valeur)} · Investi ${formaterMontant(point.investi)}`,
  );
}
