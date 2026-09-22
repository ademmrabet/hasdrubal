/**
 * Applique le theme AVANT le premier rendu (evite un flash clair/sombre).
 * Charge en <script> classique (pas de type="module") dans <head>, avant tout style :
 * un fichier statique servi par la meme origine passe la CSP par defaut de helmet
 * (script-src 'self'), pas besoin d'"unsafe-inline".
 *
 * Par defaut : theme clair, quelles que soient les preferences du systeme
 * d'exploitation. Le patron de Hasdrubal a explicitement prefere la version
 * claire ; le mode sombre reste disponible via le bouton bascule, memorise
 * par navigateur (localStorage), mais n'est jamais choisi automatiquement.
 */
(function () {
  try {
    var stored = window.localStorage.getItem('hasdrubal-theme');
    var theme = stored === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (err) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
