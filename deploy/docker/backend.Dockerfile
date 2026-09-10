FROM maven:3.9-eclipse-temurin-17 AS builder
ARG MODULE
WORKDIR /src
# .dockerignore 已裁剪 target/node_modules/dist/docs 等
COPY . .
RUN --mount=type=cache,target=/root/.m2 mvn -q install -DskipTests

FROM eclipse-temurin:17-jre-jammy
ARG MODULE
ENV TZ=Asia/Shanghai JAVA_OPTS="-XX:MaxRAMPercentage=70.0 -XX:+UseG1GC"
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /src/${MODULE}/target/${MODULE}-1.0.0.jar /app/app.jar
WORKDIR /app
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
