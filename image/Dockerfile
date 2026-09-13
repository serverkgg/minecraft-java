FROM eclipse-temurin:8-jre-noble AS java8
FROM eclipse-temurin:17-jre-noble AS java17
FROM eclipse-temurin:21-jre-noble AS java21
FROM eclipse-temurin:25-jre-noble

ARG BRIDGE_VERSION

LABEL gg.serverk.bridge.version="${BRIDGE_VERSION}"

LABEL org.opencontainers.image.source="https://github.com/serverkgg/minecraft"
LABEL gg.serverk.game="minecraft"

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      tini ca-certificates util-linux tzdata zip; \
    rm -rf /var/lib/apt/lists/*; \
    if getent passwd 1000 > /dev/null; then \
      userdel -r "$(getent passwd 1000 | cut -d: -f1)"; \
    fi; \
    groupadd -g 1000 container; \
    useradd -M -d /home/container -u 1000 -g 1000 -s /usr/sbin/nologin container; \
    mkdir -p /home/container /serverk/run

COPY --from=java8 /opt/java/openjdk /opt/java/8
COPY --from=java17 /opt/java/openjdk /opt/java/17
COPY --from=java21 /opt/java/openjdk /opt/java/21

RUN set -eux; \
    ln -s /opt/java/openjdk /opt/java/25; \
    for major in 8 17 21 25; do \
      "/opt/java/$major/bin/java" -version; \
    done

ENV TZ=UTC \
    HOME=/home/container

COPY dist/bridge /serverk/bridge

RUN chmod 0755 /serverk/bridge

WORKDIR /home/container

ENTRYPOINT ["/usr/bin/tini", "--", "/serverk/bridge"]
