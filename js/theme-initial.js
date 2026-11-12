// Script « classique » (pas un module) chargé dans le <head>, AVANT la feuille de style :
// il pose tout de suite le thème sur <html>, pour éviter un flash clair → sombre à l'ouverture.
// Il lit les mêmes préférences que js/preferences.js (même clé de stockage).
(function () {
  var preferences = {};
  try {
    preferences = JSON.parse(localStorage.getItem('budget-app:preferences')) || {};
  } catch {
    // Stockage indisponible ou illisible : on garde les valeurs par défaut
  }
  var racine = document.documentElement;
  var sombre = preferences.theme === 'sombre'
    || (preferences.theme !== 'clair' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  racine.dataset.theme = sombre ? 'dark' : 'light';
  if (preferences.fondAnime === false) racine.dataset.fondFixe = '';
})();
