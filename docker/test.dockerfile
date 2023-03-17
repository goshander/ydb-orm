FROM node:18-buster-slim

RUN mkdir -p /home/node/app && chown -R node:node /home/node/app

USER node

WORKDIR /home/node/app

COPY --chown=node:node package*.json ./

RUN npm i

COPY --chown=node:node . .
