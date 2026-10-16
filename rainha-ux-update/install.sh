#!/usr/bin/env bash
set -Eeuo pipefail

BASE="$(cd -- "$(dirname -- "$0")" && pwd)"
SITE_ROOT="/var/www/calcadosrainha"
API_DIR="/opt/rainha-catalogo/releases/20261001-193832"
NODE_BIN="/opt/rainha-node22/bin/node"
DATA_FILE="/var/lib/rainha-catalogo/catalog.json"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/var/backups/rainha-ux-${STAMP}"

[[ "${EUID}" -eq 0 ]] || { echo "Execute como root." >&2; exit 1; }
[[ -d "$SITE_ROOT" ]] || { echo "Pasta do site não encontrada: $SITE_ROOT" >&2; exit 1; }
[[ -f "$API_DIR/server.mjs" ]] || { echo "Servidor da API não encontrado: $API_DIR/server.mjs" >&2; exit 1; }
[[ -x "$NODE_BIN" ]] || { echo "Node da Rainha não encontrado: $NODE_BIN" >&2; exit 1; }

echo "Validando os arquivos da atualização…"
"$NODE_BIN" --check "$BASE/api/server.mjs"
"$NODE_BIN" --check "$BASE/web/assets/storefront.js"
"$NODE_BIN" --check "$BASE/web/assets/product.js"
"$NODE_BIN" --check "$BASE/web/cliente/admin.js"

echo "Criando cópia de segurança em $BACKUP…"
mkdir -p "$BACKUP/site/assets" "$BACKUP/site/cliente" "$BACKUP/api" "$BACKUP/data"
cp -a "$SITE_ROOT/index.html" "$BACKUP/site/index.html"
cp -a "$SITE_ROOT/assets/storefront.js" "$BACKUP/site/assets/storefront.js"
cp -a "$SITE_ROOT/cliente/index.html" "$BACKUP/site/cliente/index.html"
cp -a "$SITE_ROOT/cliente/admin.js" "$BACKUP/site/cliente/admin.js"
[[ -f "$SITE_ROOT/produto.html" ]] && cp -a "$SITE_ROOT/produto.html" "$BACKUP/site/produto.html"
[[ -f "$SITE_ROOT/assets/rainha-ux.css" ]] && cp -a "$SITE_ROOT/assets/rainha-ux.css" "$BACKUP/site/assets/rainha-ux.css"
cp -a "$API_DIR/server.mjs" "$BACKUP/api/server.mjs"
[[ -f "$DATA_FILE" ]] && cp -a "$DATA_FILE" "$BACKUP/data/catalog.json"

echo "Instalando vitrine, página de produto, painel e API…"
install -Dm644 "$BASE/web/index.html" "$SITE_ROOT/index.html"
install -Dm644 "$BASE/web/produto.html" "$SITE_ROOT/produto.html"
install -Dm644 "$BASE/web/assets/storefront.js" "$SITE_ROOT/assets/storefront.js"
install -Dm644 "$BASE/web/assets/product.js" "$SITE_ROOT/assets/product.js"
install -Dm644 "$BASE/web/assets/rainha-ux.css" "$SITE_ROOT/assets/rainha-ux.css"
install -Dm644 "$BASE/web/cliente/index.html" "$SITE_ROOT/cliente/index.html"
install -Dm644 "$BASE/web/cliente/admin.js" "$SITE_ROOT/cliente/admin.js"
install -Dm644 "$BASE/api/server.mjs" "$API_DIR/server.mjs"

echo "Reiniciando a API…"
ready=0
if systemctl restart rainha-catalogo.service; then
  echo "Aguardando a API ficar pronta…"
  for attempt in $(seq 1 20); do
    if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3187/health >/dev/null; then
      ready=1
      break
    fi
    sleep 1
  done
fi
if [[ "$ready" -ne 1 ]]; then
  echo "A nova API não respondeu. Restaurando o servidor anterior…" >&2
  install -Dm644 "$BACKUP/api/server.mjs" "$API_DIR/server.mjs"
  [[ -f "$BACKUP/data/catalog.json" ]] && cp -a "$BACKUP/data/catalog.json" "$DATA_FILE"
  systemctl restart rainha-catalogo.service || true
  echo "Atualização interrompida. Backup preservado em: $BACKUP" >&2
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3187/api/catalog >/dev/null; then
  echo "A nova API não respondeu ao catálogo. Restaurando o servidor anterior…" >&2
  install -Dm644 "$BACKUP/api/server.mjs" "$API_DIR/server.mjs"
  [[ -f "$BACKUP/data/catalog.json" ]] && cp -a "$BACKUP/data/catalog.json" "$DATA_FILE"
  systemctl restart rainha-catalogo.service || true
  echo "Atualização interrompida. Backup preservado em: $BACKUP" >&2
  exit 1
fi
echo
echo "Atualização concluída."
echo "Backup: $BACKUP"
echo "Teste: https://calcadosrainha.com.br/ e https://calcadosrainha.com.br/cliente/"
