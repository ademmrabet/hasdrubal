# API Hasdrubal. Contexte de construction : la racine du depot (lockfile commun aux workspaces).
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

# Dependances de production uniquement, versions figees par package-lock.json.
# Couche separee : reconstruite seulement quand les manifestes changent.
COPY package.json package-lock.json ./
COPY --chown=node:node server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace server --omit=dev --no-audit --no-fund \
 && npm cache clean --force

WORKDIR /app/server
COPY --chown=node:node server/src ./src
COPY --chown=node:node server/migrations ./migrations
COPY --chown=node:node server/seeds ./seeds
COPY --chown=node:node server/docker-entrypoint.sh ./docker-entrypoint.sh

# - fins de ligne Unix forcees sur le script (un depot clone sous Windows peut le passer en CRLF)
# - lecture garantie pour tous : les droits du contexte de build varient selon l'OS
# - photos des plats : dossier possede par "node" pour que le volume nomme en herite
RUN sed -i 's/\r$//' docker-entrypoint.sh \
 && chmod +x docker-entrypoint.sh \
 && chmod -R a+rX /app/server /app/package.json \
 && mkdir -p uploads && chown node:node uploads
VOLUME ["/app/server/uploads"]

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
