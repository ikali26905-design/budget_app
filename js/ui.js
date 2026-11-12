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

// Petite coche dans un rond, qui se dessine quand le toast apparaît (animation en CSS)
function creerCoche() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'toast__coche');
  svg.setAttribute('aria-hidden', 'true');
  const rond = document.createElementNS(ns, 'circle');
  rond.setAttribute('cx', '12');
  rond.setAttribute('cy', '12');
  rond.setAttribute('r', '12');
  const trait = document.createElementNS(ns, 'path');
  trait.setAttribute('d', 'M7 12.5l3.2 3.2L17 9');
  svg.append(rond, trait);
  return svg;
}

/**
 * Affiche un court message en bas de l'écran.
 * Options : coche (coche animée devant le texte), action ({ libelle, surClic } : ex. « Annuler »).
 * Avec une action, le message reste plus longtemps (5 s) pour laisser le temps de toucher le bouton.
 */
export function afficherToast(message, { coche = false, action = null } = {}) {
  const toast = document.getElementById('toast');
  const masquer = () => toast.classList.remove('toast--visible');
  const bouton = action && creer('button', {
    type: 'button',
    class: 'toast__action',
    onclick: () => {
      clearTimeout(minuteurToast);
      masquer();
      action.surClic();
    },
  }, action.libelle);
  remplir(toast, coche && creerCoche(), creer('span', {}, message), bouton);
  // On retire puis remet la classe : l'animation de la coche se rejoue à chaque toast
  toast.classList.remove('toast--visible');
  void toast.offsetWidth;
  toast.classList.add('toast--visible');
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(masquer, action ? 5000 : 2500);
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
  // On place le focus sur le champ marqué autofocus ; s'il est pré-rempli, on sélectionne
  // son contenu pour que la première frappe remplace la valeur au lieu de s'y ajouter
  const champ = corps.querySelector('[autofocus]');
  champ?.focus();
  if (champ?.value) champ.select();
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
feuille.addEventListener('close', () => {
  document.getElementById('feuille-corps').replaceChildren();
  feuille.style.transform = '';
  feuille.classList.remove('feuille--relache');
});

// Fermeture en faisant glisser la feuille vers le bas (depuis la poignée ou le titre).
// Pointer Events : un seul code pour le doigt, la souris et le stylet.
function brancherGlissementFeuille() {
  const zones = feuille.querySelectorAll('.feuille__poignee, .feuille__entete');
  let depart = null; // position verticale du doigt au début du geste
  let decalage = 0;

  const debut = (evenement) => {
    if (evenement.target.closest('button')) return; // le bouton ✕ garde son clic normal
    depart = evenement.clientY;
    decalage = 0;
    feuille.classList.remove('feuille--relache');
    evenement.currentTarget.setPointerCapture(evenement.pointerId);
  };
  const deplacement = (evenement) => {
    if (depart === null) return;
    decalage = Math.max(0, evenement.clientY - depart); // on ne la tire que vers le bas
    feuille.style.transform = `translateY(${decalage}px)`;
  };
  const fin = () => {
    if (depart === null) return;
    depart = null;
    feuille.classList.add('feuille--relache');
    // Assez tirée (plus d'un quart de sa hauteur, ou 120 px) : elle se ferme en glissant jusqu'en bas
    if (decalage > Math.min(120, feuille.offsetHeight / 4)) {
      // Sans animation (réglage « réduire les animations »), on ferme tout de suite
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return fermerFeuille();
      feuille.style.transform = 'translateY(100%)';
      feuille.addEventListener('transitionend', fermerFeuille, { once: true });
    } else {
      feuille.style.transform = ''; // sinon elle reprend sa place
    }
  };
  for (const zone of zones) {
    zone.addEventListener('pointerdown', debut);
    zone.addEventListener('pointermove', deplacement);
    zone.addEventListener('pointerup', fin);
    zone.addEventListener('pointercancel', fin);
  }
}
brancherGlissementFeuille();

/* ===================== Confirmation (remplace confirm()) ===================== */

const dialogue = document.getElementById('dialogue');

/**
 * Affiche une boîte de confirmation et renvoie une Promise<boolean>.
 * Utilisation : if (await demanderConfirmation({ titre, message })) { ... }
 */
export function demanderConfirmation({ titre, message, libelleValider = 'Confirmer', libelleAnnuler = 'Annuler', danger = false, sansAnnuler = false }) {
  document.getElementById('dialogue-titre').textContent = titre;
  document.getElementById('dialogue-message').textContent = message;
  const boutonValider = document.getElementById('dialogue-valider');
  const boutonAnnuler = document.getElementById('dialogue-annuler');
  boutonValider.textContent = libelleValider;
  boutonAnnuler.textContent = libelleAnnuler;
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

/* ===================== Ligne qu'on fait glisser (Historique) ===================== */

const SEUIL_GLISSEMENT = 0.35; // part de la largeur à dépasser pour déclencher l'action

/**
 * Rend une ligne de liste « glissable » :
 * - vers la gauche → surGauche() (ex. supprimer), vers la droite → surDroite() (ex. modifier).
 * ligne : le <li> qui contient le bouton de la ligne. Le simple toucher garde son effet normal.
 * Le geste ne démarre que s'il est franchement horizontal : le défilement vertical n'est pas gêné.
 */
export function rendreGlissable(ligne, { libelleGauche, surGauche, libelleDroite, surDroite }) {
  const contenu = ligne.firstElementChild;
  ligne.classList.add('glissable');
  ligne.prepend(
    creer('div', { class: 'glissable__fond glissable__fond--modifier', 'aria-hidden': 'true' }, creer('span', {}, libelleDroite)),
    creer('div', { class: 'glissable__fond glissable__fond--supprimer', 'aria-hidden': 'true' }, creer('span', {}, libelleGauche)),
  );
  const fondModifier = ligne.querySelector('.glissable__fond--modifier');
  const fondSupprimer = ligne.querySelector('.glissable__fond--supprimer');

  let depart = null; // { x, y } au début du toucher
  let horizontal = false; // vrai une fois qu'on sait que le geste est horizontal
  let dx = 0;
  let aGlisse = false; // pour annuler le « clic » qui suit un glissement

  const nettoyer = () => ligne.classList.remove('glissable--actif', 'glissable--relache', 'glissable--pret');
  const remettre = () => {
    contenu.style.transform = '';
    // Sans animation (réglage « réduire les animations »), aucun transitionend n'arrivera
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return nettoyer();
    ligne.classList.add('glissable--relache');
    contenu.addEventListener('transitionend', nettoyer, { once: true });
  };

  contenu.addEventListener('pointerdown', (evenement) => {
    if (evenement.pointerType === 'mouse' && evenement.button !== 0) return;
    depart = { x: evenement.clientX, y: evenement.clientY };
    horizontal = false;
    dx = 0;
    aGlisse = false;
  });
  contenu.addEventListener('pointermove', (evenement) => {
    if (!depart) return;
    const ecartX = evenement.clientX - depart.x;
    const ecartY = evenement.clientY - depart.y;
    if (!horizontal) {
      // On attend 10 px de mouvement pour décider : horizontal → glissement, vertical → on laisse défiler
      if (Math.abs(ecartX) < 10 && Math.abs(ecartY) < 10) return;
      if (Math.abs(ecartY) > Math.abs(ecartX)) { depart = null; return; }
      horizontal = true;
      aGlisse = true;
      contenu.setPointerCapture(evenement.pointerId);
      ligne.classList.remove('glissable--relache');
      ligne.classList.add('glissable--actif');
    }
    dx = ecartX;
    contenu.style.transform = `translateX(${dx}px)`;
    // Un seul fond visible : celui du côté découvert
    fondModifier.style.visibility = dx > 0 ? 'visible' : 'hidden';
    fondSupprimer.style.visibility = dx < 0 ? 'visible' : 'hidden';
    ligne.classList.toggle('glissable--pret', Math.abs(dx) > ligne.offsetWidth * SEUIL_GLISSEMENT);
  });
  const fin = () => {
    if (!depart) return;
    depart = null;
    if (!horizontal) return;
    const largeur = ligne.offsetWidth;
    if (dx < -largeur * SEUIL_GLISSEMENT) {
      // Supprimer : la ligne part complètement à gauche, puis l'action s'exécute
      ligne.classList.add('glissable--relache');
      contenu.style.transform = `translateX(${-largeur}px)`;
      setTimeout(surGauche, 180);
    } else if (dx > largeur * SEUIL_GLISSEMENT) {
      remettre();
      surDroite();
    } else {
      remettre();
    }
  };
  contenu.addEventListener('pointerup', fin);
  contenu.addEventListener('pointercancel', () => { depart = null; if (horizontal) remettre(); });
  // Le navigateur envoie un « click » à la fin du geste : on l'ignore s'il y a eu glissement
  contenu.addEventListener('click', (evenement) => {
    if (aGlisse) {
      evenement.stopImmediatePropagation();
      evenement.preventDefault();
      aGlisse = false;
    }
  }, { capture: true });
  return ligne;
}
