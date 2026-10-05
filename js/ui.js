// Composants d'interface génériques : création d'éléments, feuille modale, confirmation, toast.
// Ce fichier ne connaît pas les données métier : il fournit des briques aux autres modules.

/**
 * Crée un élément HTML en une ligne.
 * Les textes passent par des nœuds texte (jamais innerHTML) : un nom de catégorie
 * ou une note contenant « <script> » s'affiche tel quel, sans être exécuté (protection XSS).
 * Exemple : creer('p', { class: 'aide' }, 'Bonjour')
 */
export function creer(balise, attributs = {}, ...enfants) {
  const element = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs)) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (nom === 'class') element.className = valeur;
    else if (nom === 'style') element.style.cssText = valeur;
    else if (nom.startsWith('on') && typeof valeur === 'function') element.addEventListener(nom.slice(2), valeur);
    else if (valeur === true) element.setAttribute(nom, '');
    else element.setAttribute(nom, valeur);
  }
  ajouterEnfants(element, enfants);
  return element;
}

// Ajoute des enfants (éléments, textes, tableaux) à un élément, en ignorant null/false
function ajouterEnfants(parent, enfants) {
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    parent.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
}

// Remplace tout le contenu d'un élément
export function remplir(element, ...enfants) {
  element.replaceChildren();
  ajouterEnfants(element, enfants);
}

// Crée une icône SVG à partir d'un ou plusieurs tracés « d »
export function icone(...traces) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of traces) {
    const chemin = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chemin.setAttribute('d', d);
    svg.append(chemin);
  }
  return svg;
}

// Pastille ronde colorée avec l'emoji d'une catégorie
export function badgeCategorie(categorie) {
  return creer(
    'span',
    { class: 'badge', style: `--couleur: var(--serie-${categorie?.couleur ?? 8})`, 'aria-hidden': 'true' },
    categorie?.emoji ?? '❔',
  );
}

// Bloc « état vide » : icône, titre et explication
export function etatVide(emoji, titre, texte) {
  return creer(
    'div',
    { class: 'etat-vide' },
    creer('div', { class: 'etat-vide__icone', 'aria-hidden': 'true' }, emoji),
    creer('p', { class: 'etat-vide__titre' }, titre),
    texte && creer('p', {}, texte),
  );
}

/* ===================== Toast ===================== */

let minuteurToast = null;

// Affiche un court message en bas de l'écran pendant 2,5 secondes
export function afficherToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('toast--visible');
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => toast.classList.remove('toast--visible'), 2500);
}

/* ===================== Feuille modale (bottom sheet) ===================== */

const feuille = document.getElementById('feuille');

// Ouvre la feuille avec un titre et un contenu ; renvoie le corps de la feuille
export function ouvrirFeuille(titre, contenu) {
  document.getElementById('feuille-titre').textContent = titre;
  const corps = document.getElementById('feuille-corps');
  remplir(corps, contenu);
  corps.scrollTop = 0;
  if (!feuille.open) feuille.showModal();
  // showModal() donne le focus au premier élément ayant l'attribut autofocus
  corps.querySelector('[autofocus]')?.focus();
  return corps;
}

// Ferme la feuille
export function fermerFeuille() {
  if (feuille.open) feuille.close();
}

// Fermeture au clic sur le bouton ✕ ou sur le fond assombri (le clic arrive alors sur <dialog> lui-même)
feuille.addEventListener('click', (evenement) => {
  if (evenement.target === feuille || evenement.target.closest('[data-fermer]')) fermerFeuille();
});

// Vide la feuille une fois fermée (libère les écouteurs du formulaire)
feuille.addEventListener('close', () => document.getElementById('feuille-corps').replaceChildren());

/* ===================== Confirmation (remplace confirm()) ===================== */

const dialogue = document.getElementById('dialogue');

/**
 * Affiche une boîte de confirmation et renvoie une Promise<boolean>.
 * Utilisation : if (await demanderConfirmation({ titre, message })) { ... }
 */
export function demanderConfirmation({ titre, message, libelleValider = 'Confirmer', danger = false, sansAnnuler = false }) {
  document.getElementById('dialogue-titre').textContent = titre;
  document.getElementById('dialogue-message').textContent = message;
  const boutonValider = document.getElementById('dialogue-valider');
  const boutonAnnuler = document.getElementById('dialogue-annuler');
  boutonValider.textContent = libelleValider;
  boutonValider.className = danger ? 'bouton bouton--danger' : 'bouton';
  boutonAnnuler.hidden = sansAnnuler;
  dialogue.classList.toggle('dialogue--simple', sansAnnuler);

  return new Promise((resoudre) => {
    // Une seule fonction de fin, appelée quel que soit le moyen de fermer
    const terminer = (reponse) => {
      boutonValider.removeEventListener('click', surValider);
      boutonAnnuler.removeEventListener('click', surAnnuler);
      dialogue.removeEventListener('close', surFermer);
      if (dialogue.open) dialogue.close();
      resoudre(reponse);
    };
    const surValider = () => terminer(true);
    const surAnnuler = () => terminer(false);
    const surFermer = () => terminer(false); // touche Échap
    boutonValider.addEventListener('click', surValider);
    boutonAnnuler.addEventListener('click', surAnnuler);
    dialogue.addEventListener('close', surFermer);
    dialogue.showModal();
    // Par sécurité, le focus va sur « Annuler » pour une action destructrice
    (danger && !sansAnnuler ? boutonAnnuler : boutonValider).focus();
  });
}

// Affiche une information avec un seul bouton « Compris » (remplace alert())
export function informer(titre, message) {
  return demanderConfirmation({ titre, message, libelleValider: 'Compris', sansAnnuler: true });
}
