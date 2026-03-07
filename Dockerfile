FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y \
    default-jdk \
    gcc \
    g++ \
    python3 \
    flex \
    bison \
    make \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

RUN cd compiler && make
RUN npm run build

ENV NODE_ENV=production
EXPOSE 10000

CMD ["npm", "run", "start"]
