FROM node:22-slim AS base

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN npm install

RUN npm run build

CMD ["node", "build/index.js"]