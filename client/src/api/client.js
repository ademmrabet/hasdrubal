import axios from 'axios';

/**
 * L'access token vit en memoire seulement (jamais dans localStorage : une faille
 * XSS le lirait). Le refresh token est un cookie httpOnly gere par le serveur.
 */
let accessToken = null;
let onSessionLost = () => {};

export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;
export const setSessionLostHandler = (fn) => { onSessionLost = fn; };

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Une seule tentative de rafraichissement a la fois, partagee par les requetes en vol.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthRoute = original?.url?.includes('/auth/');

    if (status === 401 && !original?._retried && !isAuthRoute) {
      original._retried = true;
      try {
        refreshPromise = refreshPromise ?? api.post('/auth/refresh').finally(() => { refreshPromise = null; });
        const { data } = await refreshPromise;
        setAccessToken(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        setAccessToken(null);
        onSessionLost();
      }
    }
    return Promise.reject(error);
  },
);

/** Message lisible a afficher : l'API renvoie toujours { error, details }. */
export function errorMessage(error, fallback = 'Une erreur est survenue') {
  const data = error?.response?.data;
  if (!data) return error?.message ?? fallback;
  if (Array.isArray(data.details) && data.details.length) {
    return data.details.map((d) => `${d.champ} : ${d.message}`).join(' · ');
  }
  return data.error ?? fallback;
}
