# Build from the project root: docker build -f backend/Dockerfile -t codehealth-backend .
FROM eclipse-temurin:21-jdk-jammy AS java

FROM node:22-bookworm-slim

COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/venv/bin:/opt/java/openjdk/bin:/opt/sonar-scanner/bin:/opt/gradle/bin:${PATH}"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# These are build dependencies/versions, not application connection settings.
ARG SONAR_SCANNER_VERSION=8.0.1.6346
ARG GRADLE_VERSION=8.14.3

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates curl unzip git python3 python3-venv maven libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fSL --retry 3 \
      "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux-x64.zip" \
      -o /tmp/scanner.zip \
    && unzip -q /tmp/scanner.zip -d /opt \
    && mv "/opt/sonar-scanner-${SONAR_SCANNER_VERSION}-linux-x64" /opt/sonar-scanner \
    && chmod +x /opt/sonar-scanner/bin/sonar-scanner \
    && rm /tmp/scanner.zip

RUN curl -fSL --retry 3 \
      "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" \
      -o /tmp/gradle.zip \
    && curl -fSL --retry 3 \
      "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip.sha256" \
      -o /tmp/gradle.sha256 \
    && printf '%s  /tmp/gradle.zip\n' "$(cat /tmp/gradle.sha256)" | sha256sum -c - \
    && unzip -q /tmp/gradle.zip -d /opt \
    && mv "/opt/gradle-${GRADLE_VERSION}" /opt/gradle \
    && rm /tmp/gradle.zip /tmp/gradle.sha256

RUN python3 -m venv /opt/venv
COPY processing/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/ ./
COPY processing/ /app/processing/

RUN mkdir -p results tmp && chown -R node:node /app
USER node
CMD ["node", "server.js"]
