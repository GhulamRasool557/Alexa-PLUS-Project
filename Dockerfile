# Container image for free hosting on Hugging Face Spaces (or any Docker host).
FROM node:22-slim

# Hugging Face runs containers as user 1000.
USER node
WORKDIR /home/node/app

COPY --chown=node web/package*.json web/
RUN cd web && npm ci
COPY --chown=node backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

COPY --chown=node . .
RUN cd web && npm run build

ENV PORT=7860
EXPOSE 7860
CMD ["node", "backend/src/server.js"]
