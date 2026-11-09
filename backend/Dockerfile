# syntax=docker/dockerfile:1
#
# Ghostproof checker backend.
#
# IMPORTANT: the build context is the REPO ROOT, not backend/. The backend
# imports ../../shared/types.ts and ../../../shared/config.ts, and reads
# shared/abis from disk at runtime, so both folders must land in the image with
# their relative positions intact.
#
# The image carries Foundry because the whole job of this service is running a
# submitted exploit with `forge test` against a fork of Sepolia.

FROM node:22-bookworm-slim

# git   -> scripts/setup-sandbox.ts clones forge-std into sandbox-template/lib
# curl  -> foundryup downloads the toolchain
RUN apt-get update \
 && apt-get install -y --no-install-recommends git curl ca-certificates unzip \
 && rm -rf /var/lib/apt/lists/*

# Untrusted submitted Solidity is compiled and run in this container, so it does
# not run as root. Foundry lives in this user's home, which keeps the solc cache
# (~/.svm) writable at runtime.
RUN useradd --create-home --shell /bin/bash app
WORKDIR /app
RUN chown app:app /app
USER app

ENV FOUNDRY_DIR=/home/app/.foundry
ENV PATH=/home/app/.foundry/bin:$PATH
RUN curl -fsSL https://foundry.paradigm.xyz | bash && foundryup

# Dependencies first, for layer caching. --ignore-scripts because the
# postinstall hook (setup-sandbox) needs source files we have not copied yet.
COPY --chown=app:app backend/package.json backend/package-lock.json /app/backend/
WORKDIR /app/backend
RUN npm ci --ignore-scripts

# Now the sources. .dockerignore keeps node_modules and .env out of the context.
COPY --chown=app:app backend /app/backend
COPY --chown=app:app shared /app/shared

# Clone forge-std into the sandbox template, then compile the target contracts
# once. That pulls solc 0.8.24 into the image, so the first submission after a
# deploy does not pay for a solc download.
RUN npm run setup-sandbox \
 && (cd sandbox-template && forge build || echo "[build] solc warm-up skipped")

ENV NODE_ENV=production
# The checker resolves forge from FORGE_BIN first; set it so the health probe
# and the checker can never disagree about where the binary is.
ENV FORGE_BIN=/home/app/.foundry/bin/forge
# Render/Fly override PORT at runtime; this is only the local default.
ENV PORT=8787
EXPOSE 8787

CMD ["npm", "start"]
