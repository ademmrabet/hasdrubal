#!/bin/sh
# Applique les migrations en attente puis lance la commande (le serveur par defaut).
# RUN_MIGRATIONS=false pour s'en passer (plusieurs instances, migration manuelle...).
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Migrations..."
  node src/migrate.js up
fi

# exec : le processus Node recoit directement SIGTERM et s'arrete proprement.
exec "$@"
