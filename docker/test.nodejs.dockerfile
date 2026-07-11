FROM node:24-slim

RUN mkdir -p /home/node/app && chown -R node:node /home/node/app

USER node

WORKDIR /home/node/app

COPY --chown=node:node package.json ./
COPY --chown=node:node package-lock.json ./

RUN npm ci

COPY --chown=node:node . .
