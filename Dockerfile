# ------------------------------------------------------
#                       Dockerfile
# ------------------------------------------------------
# image:    mou-deploy-action
# name:     minddocdev/mou-deploy-action
# repo:     https://github.com/minddocdev/mou-deploy-action
# Requires: minddocdev/kubernetes-deploy:3.0.0
# authors:  development@minddoc.com
# ------------------------------------------------------

FROM minddocdev/kubernetes-deploy:3.0.0

LABEL version="0.0.1"
LABEL repository="https://github.com/minddocdev/deploy-action"
LABEL maintainer="MindDoc Health GmbH"

RUN apk add --no-cache nodejs

COPY dist/ /usr/src/

ENTRYPOINT ["node", "/usr/src/run.js"]
