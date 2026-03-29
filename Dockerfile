FROM node:22-bookworm

WORKDIR /app

# Install all language runtimes and build tools
RUN apt-get update && apt-get install -y \
    # Core build tools
    gcc g++ make flex bison python3-dev \
    # JVM
    default-jdk \
    # Scripting languages
    python3 python3-pip \
    php \
    ruby \
    # Systems languages
    golang-go \
    rustc cargo \
    # Shell & utilities
    bash sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Dart
RUN apt-get update && apt-get install -y apt-transport-https gnupg \
    && wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/dart.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/dart.gpg arch=amd64] https://storage.googleapis.com/download.dartlang.org/linux/debian stable main' \
       | tee /etc/apt/sources.list.d/dart_stable.list \
    && apt-get update && apt-get install -y dart \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="$PATH:/usr/lib/dart/bin"

# Install Node.js deps first (layer cache)
COPY package*.json ./
RUN npm install

# Copy project
COPY . .

# Build compiler from Flex + Bison sources
RUN cd compiler && make clean && make

# Declare Firebase build-time args (must be passed via --build-arg or Render buildArgs)
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID

# Expose them as env vars so Vite can read them during build
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

# Build frontend + bundle server
RUN npm run build

ENV NODE_ENV=production
EXPOSE 10000

CMD ["npm", "run", "start"]
