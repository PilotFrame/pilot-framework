FROM node:20.11-alpine AS base
WORKDIR /app

ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM base AS build-deps
COPY package.json package-lock.json* ./
RUN npm install

FROM build-deps AS build
COPY . .
RUN npm run build

FROM base AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 4000
CMD ["node", "dist/server/index.js"]

