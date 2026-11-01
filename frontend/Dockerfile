FROM node:22-bookworm-slim

WORKDIR /app/frontend

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN chown -R node:node /app/frontend && chmod -R u+rwX /app/frontend

USER node

CMD ["npm", "run", "dev"]