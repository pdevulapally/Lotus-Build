FROM e2bdev/code-interpreter:latest

# Prebaked lotus.build Vite template: the full verified dependency set is
# installed at /home/user/project so runtime `npm install` is a near-no-op
# top-up. node_modules and package-lock.json are kept in the image.
#
# package.json and baked-manifest.json are generated from the runtime version
# maps by `npm run template:prepare` (scripts/generate-template-package-json.mjs)
# — never edit them by hand.
#
# E2B runs sandbox commands as the unprivileged `user` (uid 1000, home
# /home/user); Docker build steps default to root, so copy with --chown and
# chown the install output to keep /home/user/project writable at runtime.
USER root
COPY --chown=user:user e2b-template/package.json /home/user/project/package.json
COPY --chown=user:user e2b-template/baked-manifest.json /home/user/project/.lotus-baked.json

RUN cd /home/user/project \
  && npm install --legacy-peer-deps --no-audit --no-fund \
  && chown -R user:user /home/user/project
