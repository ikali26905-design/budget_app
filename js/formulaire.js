// Feuille « Ajouter / Modifier une transaction ».
// Objectif : une saisie en 3 gestes → « + », taper le montant, toucher une catégorie, valider.

import { creer, ouvrirFeuille, fermerFeuille } from './ui.js';
import { parserMontant, centimesVersSaisie } from './money.js';
import { aujourdhui, estDateValide } from './dates.js';
import { typeDeCategorie } from './calculs.js';

// Les trois grandes familles (aussi utilisées pour les catégories)
const FAMILLES = [['depense', 'Dépense'], ['revenu', 'Revenu'], ['epargne', 'Épargne']];
// Pour l'épargne : mettre de côté (versement) ou reprendre de l'argent (retrait)
const SENS_EPARGNE = [['epargne', 'Mettre de côté'], ['retrait', 'Retirer']];

// Texte du bouton principal selon le mode et le type
const LIBELLES_AJOUT = {
  depense: 'Ajouter la dépense',
  revenu: 'Ajouter le revenu',
  epargne: 'Mettre de côté',
  retrait: 'Retirer de l’épargne',
};

// Renvoie le texte du bouton principal
function libelleBouton(modification, type) {
  return modification ? 'Enregistrer' : LIBELLES_AJOUT[type];
}

// Crée un sélecteur en segment (boutons radio stylés) ; options = [[valeur, libellé], ...]
function creerSelecteurType(valeurInitiale, { nom = 'type', options = FAMILLES, libelle = 'Type de transaction' } = {}) {
  const option = ([valeur, texte]) => [
    creer('input', { type: 'radio', name: nom, id: `${nom}-${valeur}`, value: valeur, checked: valeur === valeurInitiale }),
    creer('label', { for: `${nom}-${valeur}` }, texte),
  ];
  return creer('div', { class: 'segment', role: 'radiogroup', 'aria-label': libelle }, options.map(option));
}

// Type réel saisi : « depense », « revenu », ou pour l'épargne « epargne » / « retrait »
function typeSaisi(formulaire) {
  const famille = formulaire.querySelector('input[name="type"]:checked').value;
  return famille === 'epargne' ? formulaire.querySelector('input[name="sens"]:checked').value : famille;
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

// Crée la grille de pastilles de catégories pour une famille (« depense », « revenu », « epargne »)
function creerPastilles(categories, famille, categorieChoisie) {
  const pastilles = categories
    .filter((c) => c.type === famille)
    .map((c) => creer('div', { class: 'pastille' },
      creer('input', { type: 'radio', name: 'categorie', id: `cat-${c.id}`, value: c.id, checked: c.id === categorieChoisie }),
      creer('label', { for: `cat-${c.id}` },
        creer('span', { class: 'pastille__emoji', 'aria-hidden': 'true' }, c.emoji),
        c.nom),
    ));
  return creer('fieldset', { class: 'pastilles', id: 'pastilles' },
    creer('legend', { class: 'champ__label' }, famille === 'epargne' ? 'Compte d’épargne' : 'Catégorie'),
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
  const type = typeSaisi(formulaire);
  const montant = parserMontant(donnees.get('montant'));
  if (montant === null) return { erreur: 'Saisis un montant valide, par exemple 12,50.', champ: 'champ-montant' };
  const categorieId = donnees.get('categorie');
  if (!categorieId) {
    return { erreur: typeDeCategorie(type) === 'epargne' ? 'Choisis un compte d’épargne.' : 'Choisis une catégorie.', champ: 'pastilles' };
  }
  const date = donnees.get('date');
  if (!estDateValide(date)) return { erreur: 'Choisis une date valide.', champ: 'champ-date' };
  return {
    valeurs: {
      type,
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

  const famille = typeDeCategorie(initial.type);
  const boutonValider = creer('button', { type: 'submit', class: 'bouton bouton--plein' }, libelleBouton(modification, initial.type));
  // Second sélecteur, visible seulement pour l'épargne : « Mettre de côté » ou « Retirer »
  const selecteurSens = creerSelecteurType(initial.type === 'retrait' ? 'retrait' : 'epargne',
    { nom: 'sens', options: SENS_EPARGNE, libelle: 'Sens du mouvement d’épargne' });
  selecteurSens.classList.add('segment--secondaire');
  selecteurSens.hidden = famille !== 'epargne';
  const formulaire = creer('form', { class: 'formulaire', novalidate: true },
    creerSelecteurType(famille),
    selecteurSens,
    creerChampMontant(initial.montant ? centimesVersSaisie(initial.montant) : '', !modification),
    creerPastilles(categories, famille, initial.categorieId),
    creerDateEtNote(initial.date, initial.note),
    creerCaseRecurrente(estRecurrente),
    creer('p', { class: 'erreur', role: 'alert', hidden: true }),
    creer('div', { class: 'feuille__actions' },
      boutonValider,
      modification && creer('button', { type: 'button', class: 'bouton bouton--contour-danger bouton--plein', 'data-action': 'supprimer' }, 'Supprimer'),
    ),
  );

  // Changement de type : on réaffiche les pastilles de la bonne famille et le libellé du bouton
  formulaire.addEventListener('change', (evenement) => {
    const { name, value } = evenement.target;
    if (name === 'type') {
      formulaire.querySelector('#pastilles').replaceWith(creerPastilles(categories, value, null));
      selecteurSens.hidden = value !== 'epargne';
    }
    if (name === 'type' || name === 'sens') boutonValider.textContent = libelleBouton(modification, typeSaisi(formulaire));
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

/**
 * Ouvre une feuille « montant limite » : plafond de budget ou objectif d'épargne.
 * - titre : ex. « Budget Courses »
 * - valeur : montant actuel en centimes (ou null)
 * - libelleChamp / aide / libelleRetirer : textes affichés
 * - surValider(centimes) / surRetirer() : fonctions async fournies par app.js
 */
export function ouvrirFormulaireMontantCible({ titre, valeur, libelleChamp, aide, libelleRetirer, surValider, surRetirer }) {
  const boutonValider = creer('button', { type: 'submit', class: 'bouton bouton--plein' }, 'Enregistrer');
  const formulaire = creer('form', { class: 'formulaire', novalidate: true },
    creerChampMontant(valeur ? centimesVersSaisie(valeur) : '', true),
    creer('p', { class: 'aide aide--sous-champ' }, aide),
    creer('p', { class: 'erreur', role: 'alert', hidden: true }),
    creer('div', { class: 'feuille__actions' },
      boutonValider,
      valeur && creer('button', { type: 'button', class: 'bouton bouton--contour-danger bouton--plein', 'data-action': 'retirer' }, libelleRetirer)),
  );
  formulaire.querySelector('label').textContent = libelleChamp;

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    const montant = parserMontant(formulaire.querySelector('#champ-montant').value);
    if (montant === null) {
      afficherErreur(formulaire, { erreur: 'Saisis un montant valide, par exemple 250.', champ: 'champ-montant' });
      return;
    }
    boutonValider.disabled = true;
    const reussi = await surValider(montant);
    boutonValider.disabled = false;
    if (reussi !== false) fermerFeuille();
  });
  formulaire.addEventListener('input', () => {
    formulaire.querySelector('.erreur').hidden = true;
  });
  formulaire.querySelector('[data-action="retirer"]')?.addEventListener('click', async () => {
    if ((await surRetirer()) !== false) fermerFeuille();
  });

  ouvrirFeuille(titre, formulaire);
}

// Emojis proposés pour une nouvelle catégorie
const EMOJIS = [
  '🍔', '☕', '🍕', '🍺', '🛍️', '👕', '💇', '🎁', '🎬', '🎵', '🏋️', '⚽',
  '✈️', '🚗', '⛽', '🚲', '🐶', '👶', '💡', '📶', '💻', '🧾', '🏦', '💶',
  '📈', '🤝', '🎨', '🍼', '🌱', '❤️',
];

/**
 * Ouvre la feuille « Nouvelle catégorie » : nom, type et emoji (la couleur est choisie automatiquement).
 * - type : type présélectionné (« depense » ou « revenu »)
 * - nomExiste(nom, type) : renvoie true si une catégorie du même type porte déjà ce nom
 * - surValider({ nom, emoji, type }) : fonction async fournie par app.js
 */
export function ouvrirFormulaireCategorie({ type, nomExiste, surValider }) {
  const boutonValider = creer('button', { type: 'submit', class: 'bouton bouton--plein' }, 'Créer la catégorie');
  const grilleEmojis = creer('fieldset', { class: 'emojis', id: 'emojis' },
    creer('legend', { class: 'champ__label' }, 'Icône'),
    EMOJIS.map((emoji, i) => creer('div', { class: 'emoji' },
      creer('input', { type: 'radio', name: 'emoji', id: `emoji-${i}`, value: emoji, checked: i === 0 }),
      creer('label', { for: `emoji-${i}` }, emoji))));
  const formulaire = creer('form', { class: 'formulaire', novalidate: true },
    creerSelecteurType(type, { libelle: 'Type de catégorie' }),
    creer('div', { class: 'champ' },
      creer('label', { class: 'champ__label', for: 'champ-nom' }, 'Nom'),
      creer('input', { class: 'champ__input', id: 'champ-nom', name: 'nom', maxlength: 24, autocomplete: 'off', autofocus: true, placeholder: 'Ex. : Restaurants' })),
    grilleEmojis,
    creer('p', { class: 'erreur', role: 'alert', hidden: true }),
    creer('div', { class: 'feuille__actions' }, boutonValider),
  );

  formulaire.addEventListener('input', () => {
    formulaire.querySelector('.erreur').hidden = true;
    formulaire.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid');
  });

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(formulaire);
    const nom = donnees.get('nom').trim();
    const typeChoisi = donnees.get('type');
    if (!nom) {
      afficherErreur(formulaire, { erreur: 'Donne un nom à la catégorie.', champ: 'champ-nom' });
      return;
    }
    if (nomExiste(nom, typeChoisi)) {
      afficherErreur(formulaire, { erreur: `La catégorie « ${nom} » existe déjà.`, champ: 'champ-nom' });
      return;
    }
    boutonValider.disabled = true;
    const reussi = await surValider({ nom, emoji: donnees.get('emoji'), type: typeChoisi });
    boutonValider.disabled = false;
    if (reussi !== false) fermerFeuille();
  });

  ouvrirFeuille('Nouvelle catégorie', formulaire);
}
