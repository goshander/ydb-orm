FROM oven/bun:1.0

RUN mkdir -p /home/bun/app && chown -R bun:bun /home/bun/app

USER bun

WORKDIR /home/bun/app

COPY --chown=bun:bun package.json ./

COPY --chown=bun:bun bun.lockb ./

RUN bun install

COPY --chown=bun:bun . .
