# The browser and its system libraries come with Microsoft's Playwright image,
# pinned to the same version as package.json so they always match.
FROM mcr.microsoft.com/playwright:v1.63.0-noble
ENV TZ=Asia/Kolkata NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
CMD ["node", "src/run.mjs"]
