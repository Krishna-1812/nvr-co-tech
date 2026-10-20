FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /app
COPY package.json reach-test.mjs ./
RUN npm install --omit=dev --no-audit --no-fund
CMD ["node", "reach-test.mjs"]
