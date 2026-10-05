// Service worker : permet à l'app de fonctionner hors connexion.
//
// Stratégie « réseau d'abord, cache en secours » :
//  - en ligne, on récupère toujours la dernière version des fichiers (et on met le cache à jour) ;
//  - hors ligne (ou réseau trop lent), on sert la copie gardée en cache.
// Avantage : pas besoin de vider le cache à la main pendant le développement.

const VERSION = 'v1';
const NOM_CACHE = `mon-budget-${VERSION}`;
const DELAI_RESEAU_MS = 3000; // au-delà, on considère le réseau comme indisponible

// Fichiers mis en cache dès l'installation : l'app complète fonctionne alors sans réseau
const FICHIERS_APP = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/money.js',
  './js/dates.js',
  './js/calculs.js',
  './js/charts.js',
  './js/ui.js',
  './js/ecrans.js',
  './js/formulaire.js',
  './js/io.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Installation : on télécharge et on range tous les fichiers de l'app
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(NOM_CACHE)
      .then((cache) => cache.addAll(FICHIERS_APP))
      .then(() => self.skipWaiting()), // la nouvelle version s'active sans attendre
  );
});

// Activation : on supprime les caches des anciennes versions
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((nom) => nom !== NOM_CACHE).map((nom) => caches.delete(nom))))
      .then(() => self.clients.claim()), // prend le contrôle des onglets déjà ouverts
  );
});

// Essaie le réseau, avec un délai maximum
function depuisReseau(requete) {
  return new Promise((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error('Réseau trop lent')), DELAI_RESEAU_MS);
    fetch(requete).then((reponse) => {
      clearTimeout(minuteur);
      resoudre(reponse);
    }, (erreur) => {
      clearTimeout(minuteur);
      rejeter(erreur);
    });
  });
}

// Réseau d'abord (et mise à jour du cache), puis cache en secours
async function reseauPuisCache(requete) {
  const cache = await caches.open(NOM_CACHE);
  try {
    const reponse = await depuisReseau(requete);
    if (reponse.ok) cache.put(requete, reponse.clone());
    return reponse;
  } catch {
    const enCache = await cache.match(requete, { ignoreSearch: true });
    if (enCache) return enCache;
    // Navigation vers une page inconnue hors ligne : on sert l'application
    if (requete.mode === 'navigate') return cache.match('./index.html');
    return Response.error();
  }
}

// Interception des requêtes : seulement les GET vers notre propre site
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET' || new URL(requete.url).origin !== self.location.origin) return;
  evenement.respondWith(reseauPuisCache(requete));
});
