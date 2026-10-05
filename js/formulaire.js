// Feuille « Ajouter / Modifier une transaction ».
// Objectif : une saisie en 3 gestes → « + », taper le montant, toucher une catégorie, valider.

import { creer, ouvrirFeuille, fermerFeuille } from './ui.js';
import { parserMontant, centimesVersSaisie } from './money.js';
import { aujourdhui, estDateValide } from './dates.js';

// Texte du bouton principal selon le mode et le type
function libelleBouton(modification, type) {
  if (modification) return 'Enregistrer';
  return type === 'revenu' ? 'Ajouter le revenu' : 'Ajouter la dépense';
}

// Crée le sélecteur « Dépense / Revenu » (deux boutons radio stylés en segment)
function creerSelecteurType(typeInitial) {
  const option = (valeur, libelle) => [
    creer('input', { type: 'radio', name: 'type', id: `type-${valeur}`, value: valeur, checked: valeur === typeInitial }),
    creer('label', { for: `type-${valeur}` }, libelle),
  ];
  return creer('div', { class: 'segment', role: 'radiogroup', 'aria-label': 'Type de transaction' },
    option('depense', 'Dépense'), option('revenu', 'Revenu'));
}

// Crée le gros champ « Montant » qui ouvre le clavier numérique
function creerChampMontant(valeurInitiale, autofocus) {
  return creer('div', { class: 'champ champ-montant' },
    creer('label', { class: 'champ__label', for: 'champ-montant' }, 'Montant'),
    creer('input', {
      class: 'champ__input',
      id: 'champ-montant',
      name: 'montant',
      // inputmode="decimal" : clavier numérique AVEC virgule (type="number" gère mal la virgule française)
      inputmode: 'decimal',
      autocomplete: 'off',
      enterkeyhint: 'done',
      placeholder: '0,00',
      value: valeurInitiale,
      autofocus,
    }),
    creer('span', { class: 'champ-montant__devise', 'aria-hidden': 'true' }, '€'),
  );
}

// Crée la grille de pastilles de catégories pour un type donné
function creerPastilles(categories, type, categorieChoisie) {
  const pastilles = categories
    .filter((c) => c.type === type)
    .map((c) => creer('div', { class: 'pastille' },
      creer('input', { type: 'radio', name: 'categorie', id: `cat-${c.id}`, value: c.id, checked: c.id === categorieChoisie }),
      creer('label', { for: `cat-${c.id}` },
        creer('span', { class: 'pastille__emoji', 'aria-hidden': 'true' }, c.emoji),
        c.nom),
    ));
  return creer('fieldset', { class: 'pastilles', id: 'pastilles' },
    creer('legend', { class: 'champ__label' }, 'Catégorie'),
    pastilles);
}

// Crée les champs date et note sur une même rangée
function creerDateEtNote(date, note) {
  return creer('div', { class: 'rangee' },
    creer('div', { class: 'champ' },
      creer('label', { class: 'champ__label', for: 'champ-date' }, 'Date'),
      creer('input', { class: 'champ__input', type: 'date', id: 'champ-date', name: 'date', value: date, required: true })),
    creer('div', { class: 'champ' },
      creer('label', { class: 'champ__label', for: 'champ-note' }, 'Note (facultatif)'),
      creer('input', { class: 'champ__input', id: 'champ-note', name: 'note', value: note, maxlength: 80, autocomplete: 'off', placeholder: 'Ex. : pizza du vendredi' })),
  );
}

// Crée la case « Chaque mois » avec son explication
function creerCaseRecurrente(cochee) {
  return creer('label', { class: 'case' },
    creer('input', { type: 'checkbox', name: 'chaqueMois', checked: cochee }),
    creer('span', {},
      creer('strong', {}, 'Chaque mois'),
      creer('br'),
      creer('span', { class: 'aide', id: 'aide-recurrente' }, 'Ajoutée automatiquement chaque mois, à la même date.')),
  );
}

// Lit et valide le formulaire ; renvoie { valeurs } ou { erreur, champ }
function lireFormulaire(formulaire) {
  const donnees = new FormData(formulaire);
  const montant = parserMontant(donnees.get('montant'));
  if (montant === null) return { erreur: 'Saisis un montant valide, par exemple 12,50.', champ: 'champ-montant' };
  const categorieId = donnees.get('categorie');
  if (!categorieId) return { erreur: 'Choisis une catégorie.', champ: 'pastilles' };
  const date = donnees.get('date');
  if (!estDateValide(date)) return { erreur: 'Choisis une date valide.', champ: 'champ-date' };
  return {
    valeurs: {
      type: donnees.get('type'),
      montant,
      categorieId,
      date,
      note: donnees.get('note').trim(),
      chaqueMois: donnees.get('chaqueMois') === 'on',
    },
  };
}

// Affiche une erreur dans le formulaire et place le focus sur le champ concerné
function afficherErreur(formulaire, { erreur, champ }) {
  const zone = formulaire.querySelector('.erreur');
  zone.textContent = erreur;
  zone.hidden = false;
  const cible = formulaire.querySelector(`#${champ}`);
  if (cible.tagName === 'INPUT') {
    cible.setAttribute('aria-invalid', 'true');
    cible.focus();
  } else {
    cible.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/**
 * Ouvre la feuille de saisie.
 * - categories : toutes les catégories
 * - transaction : la transaction à modifier (ou null pour un ajout)
 * - estRecurrente : true si la transaction est liée à un modèle mensuel actif
 * - surValider(valeurs) : fonction async appelée avec les valeurs validées
 * - surSupprimer() : fonction async appelée au clic sur « Supprimer » (mode modification)
 */
export function ouvrirFormulaireTransaction({ categories, transaction = null, estRecurrente = false, typeParDefaut = 'depense', surValider, surSupprimer }) {
  const modification = transaction !== null;
  const initial = transaction ?? { type: typeParDefaut, montant: null, categorieId: null, date: aujourdhui(), note: '' };

  const boutonValider = creer('button', { type: 'submit', class: 'bouton bouton--plein' }, libelleBouton(modification, initial.type));
  const formulaire = creer('form', { class: 'formulaire', novalidate: true },
    creerSelecteurType(initial.type),
    creerChampMontant(initial.montant ? centimesVersSaisie(initial.montant) : '', !modification),
    creerPastilles(categories, initial.type, initial.categorieId),
    creerDateEtNote(initial.date, initial.note),
    creerCaseRecurrente(estRecurrente),
    creer('p', { class: 'erreur', role: 'alert', hidden: true }),
    creer('div', { class: 'feuille__actions' },
      boutonValider,
      modification && creer('button', { type: 'button', class: 'bouton bouton--contour-danger bouton--plein', 'data-action': 'supprimer' }, 'Supprimer'),
    ),
  );

  // Changement de type : on réaffiche les pastilles correspondantes et le libellé du bouton
  formulaire.addEventListener('change', (evenement) => {
    if (evenement.target.name !== 'type') return;
    const type = evenement.target.value;
    formulaire.querySelector('#pastilles').replaceWith(creerPastilles(categories, type, null));
    boutonValider.textContent = libelleBouton(modification, type);
  });

  // Dès qu'on corrige un champ, on retire le message d'erreur
  formulaire.addEventListener('input', () => {
    formulaire.querySelector('.erreur').hidden = true;
    formulaire.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid');
  });

  // Validation : on lit, on vérifie, puis on confie l'enregistrement à app.js
  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    const resultat = lireFormulaire(formulaire);
    if (resultat.erreur) {
      afficherErreur(formulaire, resultat);
      return;
    }
    boutonValider.disabled = true; // évite un double enregistrement en cas de double appui
    const reussi = await surValider(resultat.valeurs);
    boutonValider.disabled = false;
    if (reussi !== false) fermerFeuille();
  });

  formulaire.querySelector('[data-action="supprimer"]')?.addEventListener('click', () => surSupprimer());

  ouvrirFeuille(modification ? 'Modifier la transaction' : 'Nouvelle transaction', formulaire);
}
