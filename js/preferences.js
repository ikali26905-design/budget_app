// Préférences d'affichage de CET appareil : thème, fond animé, mode discret.
// Ce ne sont pas des données de budget : elles ne sont ni exportées ni importées avec la sauvegarde,
// d'où une clé de stockage séparée de celle de store.js.
// (js/theme-initial.js relit la même clé au démarrage, avant l'affichage.)

const CLE = 'budget-app:preferences';
const DEFAUTS = { theme: 'auto', fondAnime: true, discret: false };
export const THEMES = [['auto', 'Automatique'], ['clair', 'Clair'], ['sombre', 'Sombre']];

// Lit les préférences (valeurs par défaut si rien d'enregistré ou si le stockage est indisponible)
export function lirePreferences() {
  try {
    const lues = JSON.parse(localStorage.getItem(CLE)) ?? {};
    return {
      theme: THEMES.some(([valeur]) => valeur === lues.theme) ? lues.theme : DEFAUTS.theme,
      fondAnime: typeof lues.fondAnime === 'boolean' ? lues.fondAnime : DEFAUTS.fondAnime,
      discret: typeof lues.discret === 'boolean' ? lues.discret : DEFAUTS.discret,
    };
  } catch {
    return { ...DEFAUTS };
  }
}

// Enregistre une préférence et renvoie l'ensemble mis à jour
export function enregistrerPreference(nom, valeur) {
  const preferences = { ...lirePreferences(), [nom]: valeur };
  try {
    localStorage.setItem(CLE, JSON.stringify(preferences));
  } catch {
    // Stockage plein ou bloqué : la préférence s'applique quand même jusqu'à la fermeture
  }
  return preferences;
}

const sombreSysteme = window.matchMedia('(prefers-color-scheme: dark)');

// Applique thème et fond animé sur <html> ; la couleur de la barre du navigateur suit le thème
export function appliquerPreferences(preferences) {
  const racine = document.documentElement;
  const sombre = preferences.theme === 'sombre' || (preferences.theme === 'auto' && sombreSysteme.matches);
  racine.dataset.theme = sombre ? 'dark' : 'light';
  racine.toggleAttribute('data-fond-fixe', !preferences.fondAnime);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sombre ? '#000000' : '#f1f1ee');
}

// En mode « Automatique », on suit le téléphone quand il change de thème (ex. le soir)
export function suivreThemeSysteme(rappel) {
  sombreSysteme.addEventListener('change', rappel);
}
