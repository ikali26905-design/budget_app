// Point d'entrée de l'application : relie l'interface aux données.

// Affiche l'écran demandé et met à jour l'onglet actif
function afficherEcran(nomEcran) {
  document.querySelectorAll('.ecran').forEach((ecran) => {
    ecran.hidden = ecran.dataset.ecran !== nomEcran;
  });
  document.querySelectorAll('.onglet').forEach((onglet) => {
    if (onglet.dataset.cible === nomEcran) onglet.setAttribute('aria-current', 'page');
    else onglet.removeAttribute('aria-current');
  });
  // Les réglages ne dépendent pas du mois : on remplace la navigation par un titre
  const surReglages = nomEcran === 'reglages';
  document.getElementById('nav-mois').hidden = surReglages;
  document.getElementById('titre-reglages').hidden = !surReglages;
}

// Branche les clics sur les onglets
function brancherOnglets() {
  document.querySelector('.onglets').addEventListener('click', (evenement) => {
    const onglet = evenement.target.closest('.onglet');
    if (onglet) afficherEcran(onglet.dataset.cible);
  });
}

brancherOnglets();
afficherEcran('accueil');
