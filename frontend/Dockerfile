FROM node:alpine

# Set working directory
WORKDIR /usr/app

# Install PM2 globally
RUN npm install --global pm2

# Copy package files first (layer cache)
COPY ./package*.json ./

# Install ALL dependencies (not just production)
# next, react etc. are needed at runtime for next start
RUN npm install

# Copy all files
COPY ./ ./

# Build app
RUN npm run build

# Expose the listening port
EXPOSE 3000

# Run container as non-root (unprivileged) user
USER node

# Launch with PM2, explicitly bind Next.js to 0.0.0.0
CMD ["pm2-runtime", "start", "npm", "--", "start"]