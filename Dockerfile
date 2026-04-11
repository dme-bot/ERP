FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm install --production

# Install and build frontend
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Copy server
COPY server/ ./server/

# Create data directory
RUN mkdir -p data

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "server/index.js"]
