import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Lit une variable obligatoire. En developpement une valeur de repli est
 * toleree pour demarrer vite ; en production jamais : un secret par defaut
 * publie sur GitHub permettrait de forger des jetons de connexion.
 */
function required(name, devFallback) {
  const value = process.env[name] ?? (isProd ? undefined : devFallback);
  if (value === undefined || value === '') {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
      (isProd ? 'Renseignez-la dans le fichier .env du deploiement.' : 'Copiez server/.env.example vers server/.env.'),
    );
  }
  return value;
}

function secret(name, devFallback) {
  const value = required(name, devFallback);
  if (isProd && value.length < 32) {
    throw new Error(`${name} est trop court (${value.length} caracteres, 32 minimum en production).`);
  }
  return value;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['true', '1', 'yes', 'oui'].includes(String(raw).toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd,
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/hasdrubal'),
  databaseSsl: bool('DATABASE_SSL', false),

  jwtAccessSecret: secret('JWT_ACCESS_SECRET', 'dev-access-secret-a-changer'),
  jwtRefreshSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret-a-changer'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),

  // Cookie de session "Secure" : obligatoire derriere HTTPS, mais un navigateur
  // le refuse sur http://192.168.x.x. A mettre a false tant que l'application
  // est servie en HTTP sur le reseau local du restaurant.
  cookieSecure: bool('COOKIE_SECURE', isProd),

  restaurantName: process.env.RESTAURANT_NAME ?? 'Hasdrubal',
  defaultVatRate: Number(process.env.DEFAULT_VAT_RATE ?? 19),
};
