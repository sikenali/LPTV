FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=20

RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    wget \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /lzcapp/pkg/content/frontend /lzcapp/pkg/content/scripts /lzcapp/var/data /app/data /app/logs

COPY _lpk_content/frontend/ /lzcapp/pkg/content/frontend/
COPY _lpk_content/scripts/ /lzcapp/pkg/content/scripts/
COPY icon.png /lzcapp/pkg/content/icon.png

RUN chmod +x /lzcapp/pkg/content/scripts/*.sh

CMD ["/bin/bash", "/lzcapp/pkg/content/scripts/start.sh"]
