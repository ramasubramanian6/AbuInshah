FROM node:18

WORKDIR /app


# Install system fonts for image/text rendering
RUN apt-get update && apt-get install -y fonts-dejavu-core fonts-freefont-ttf

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001
CMD ["npm", "start"]
