FROM oven/bun:1.2

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public

RUN mkdir -p data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server.js"]