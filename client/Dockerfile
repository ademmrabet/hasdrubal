# Contexte de construction : la racine du depot.

# Etape 1 : compilation Vite.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace client --no-audit --no-fund
COPY client ./client
RUN npm run build --workspace client

# Etape 2 : fichiers statiques servis par nginx, qui relaie /api et /uploads vers l'API.
FROM nginx:1.31-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
# Les droits du contexte de build dependent de l'OS (fichiers en 700 sous WSL ou sur un
# montage reseau) : sans cela nginx ne peut pas lire le logo et renvoie 403.
RUN chmod -R a+rX /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
