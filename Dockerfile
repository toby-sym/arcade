FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=build_ca,target=/run/secrets/build-ca,required=false \
    if [ -s /run/secrets/build-ca ]; then npm ci --cafile=/run/secrets/build-ca; \
    else npm ci; fi
COPY . ./
ARG APP_VERSION
RUN if [ -z "$APP_VERSION" ]; then \
      if [ -f release-version.txt ]; then APP_VERSION="$(cat release-version.txt)"; \
      else APP_VERSION=Development; fi; \
    fi && VITE_APP_VERSION="$APP_VERSION" npm run build

FROM nginxinc/nginx-unprivileged:alpine
COPY --chmod=644 deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -Y off -q -O /dev/null http://127.0.0.1:8080/health || exit 1
