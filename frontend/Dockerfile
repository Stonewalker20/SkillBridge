FROM node:18-alpine

WORKDIR /app
COPY package*.json /app/
RUN npm ci

COPY . /app
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
