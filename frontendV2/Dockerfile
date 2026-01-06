# 1. Build fáze
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. Produkční fáze (Nginx)
FROM nginx:stable-alpine
# Kopírujeme tvůj upravený config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Zkopírujeme build z předchozí fáze
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]