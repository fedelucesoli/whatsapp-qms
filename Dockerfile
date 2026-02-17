# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Environment variables (can be overridden at runtime)
ENV PORT=8080
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379

# Define the command to run the app
CMD ["npm", "start"]
