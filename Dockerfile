# =====================================================================
# Image combinee (client + API) pour un deploiement Render a UN SEUL
# service Web. Render (plan gratuit, sans carte bancaire) ne deploie
# qu'un conteneur par service : ce fichier construit le client (Vite),
# puis le fait servir par le meme serveur Express que l'API, plutot que
# par un second conteneur nginx.
#
# Le deploiement auto-heberge a deux conteneurs (docker-compose.yml /
# docker-compose.prod.yml, nginx + API separes) n'est pas touche : il
# continue d'utiliser server/Dockerfile et client/Dockerfile tels quels.
#
# Contexte de construction attendu : la racine du depot.
#   docker build -t hasdrubal .
#   docker run -p 4000:4000 --env-file server/.env hasdrubal
# =====================================================================

# --- Etape 1 : compilation du client (Vite) ---------------------------
FROM node:22-alpine AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace client --no-audit --no-fund
COPY client ./client
RUN npm run build --workspace client

# --- Etape 2 : dependances serveur, production uniquement --------------
FROM node:22-alpine AS server-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace server --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# --- Etape 3 : image finale --------------------------------------------
# Un seul processus Node : sert /api/* et /uploads/* (comme d'habitude) et,
# en plus, les fichiers du client compile pour toute autre route GET
# (voir server/src/app.js, SERVE_CLIENT). Le proprietaire choisit le theme
# clair/sombre dans l'interface ; clair par defaut (cf. client/public/theme-init.js).
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=4000

# Dependances hoistees par les workspaces npm, un niveau au-dessus de
# /app/server : Node les retrouve en remontant les dossiers parents depuis
# server/src, comme en developpement (chemins absolus : plus sur que ".."
# en destination de COPY, dont le support varie selon les versions de Docker).
COPY --from=server-deps /app/node_modules /app/node_modules
COPY --from=client-build --chown=node:node /app/client/dist /app/client-dist

WORKDIR /app/server
COPY --from=server-deps /app/server/package.json ./package.json
COPY --chown=node:node server/src ./src
COPY --chown=node:node server/migrations ./migrations
COPY --chown=node:node server/seeds ./seeds
COPY --chown=node:node server/docker-entrypoint.sh ./docker-entrypoint.sh

# - fins de ligne Unix forcees (un depot clone sous Windows peut passer le script en CRLF)
# - lecture garantie pour tous : les droits du contexte de build varient selon l'OS
# - dossier des photos de plats possede par "node" pour que le volume nomme en herite
RUN sed -i 's/\r$//' docker-entrypoint.sh \
 && chmod +x docker-entrypoint.sh \
 && chmod -R a+rX /app/server /app/client-dist /app/node_modules \
 && mkdir -p uploads && chown node:node uploads

# Render n'utilise PAS de volume persistant sur le plan gratuit : ce dossier
# est remis a zero a chaque nouveau deploiement et le disque est ephemere
# entre redemarrages. Voir README.md > Deploiement Render pour l'alternative
# (stockage objet externe) le jour ou les photos de plats doivent survivre.
VOLUME ["/app/server/uploads"]

USER node
EXPOSE 4000

# Render fournit sa propre verification de sante HTTP (voir render.yaml,
# healthCheckPath) et ignore ce HEALTHCHECK Docker ; il reste utile en local
# et sur tout autre hebergeur base sur Docker.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/health" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
