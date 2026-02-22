#!/bin/sh
set -eu

envsubst '${VITE_API_URL}' \
  < /opt/runtime-env.js.template \
  > /usr/share/nginx/html/runtime-env.js
