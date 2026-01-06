# 1. Build fáze
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. Produkční fáze (Nginx)
FROM nginx:stable-alpine
# Zkopírujeme build z předchozí fáze do Nginxu
COPY --from=build /app/dist /usr/share/nginx/html
# Volitelně: zkopíruj nginx config pro správné fungování React Routeru (SPA)
# COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]