#!/usr/bin/env bash
set -Eeuo pipefail

BASE="$(cd -- "$(dirname -- "$0")" && pwd)"
SITE_ROOT="/var/www/calcadosrainha"
API_DIR="/opt/rainha-catalogo/releases/20261001-193832"
NODE_BIN="/opt/rainha-node22/bin/node"
DATA_FILE="/var/lib/rainha-catalogo/catalog.json"
TOKEN_FILE="/var/lib/rainha-catalogo/google-token.json"
DRIVE_FILE="$API_DIR/drive.mjs"
DRIVE_CONFIG="/etc/rainha-catalogo/google.json"
SOURCE_FOLDER_ID="1GWxT8ITqM1dQbI_4TxVc8tpmW_AATCbI"
CLIENT_FOLDER_ID="1ugGUOKrsGs30ZOxtPrvf1CMrQOa-QhDF"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/var/backups/rainha-ux-${STAMP}"

[[ "${EUID}" -eq 0 ]] || { echo "Execute como root." >&2; exit 1; }
[[ -d "$SITE_ROOT" ]] || { echo "Pasta do site não encontrada: $SITE_ROOT" >&2; exit 1; }
[[ -f "$API_DIR/server.mjs" ]] || { echo "Servidor da API não encontrado: $API_DIR/server.mjs" >&2; exit 1; }
[[ -f "$DRIVE_FILE" ]] || { echo "Módulo do Google Drive não encontrado: $DRIVE_FILE" >&2; exit 1; }
[[ -f "$DRIVE_CONFIG" ]] || { echo "Configuração do Google Drive não encontrada: $DRIVE_CONFIG" >&2; exit 1; }
[[ -f "$DATA_FILE" ]] || { echo "Catálogo não encontrado: $DATA_FILE" >&2; exit 1; }
[[ -f "$TOKEN_FILE" ]] || { echo "Conexão atual do Google Drive não encontrada: $TOKEN_FILE" >&2; exit 1; }
[[ -x "$NODE_BIN" ]] || { echo "Node da Rainha não encontrado: $NODE_BIN" >&2; exit 1; }

echo "Validando os arquivos da atualização…"
"$NODE_BIN" --check "$BASE/api/server.mjs"
"$NODE_BIN" --check "$BASE/api/switch-drive-folder.mjs"
"$NODE_BIN" --check "$BASE/api/migrate-drive.mjs"
"$NODE_BIN" --check "$BASE/web/assets/storefront.js"
"$NODE_BIN" --check "$BASE/web/assets/product.js"
"$NODE_BIN" --check "$BASE/web/cliente/admin.js"

echo "Criando cópia de segurança em $BACKUP…"
mkdir -p "$BACKUP/site/assets" "$BACKUP/site/cliente" "$BACKUP/api" "$BACKUP/config" "$BACKUP/data"
cp -a "$SITE_ROOT/index.html" "$BACKUP/site/index.html"
cp -a "$SITE_ROOT/assets/storefront.js" "$BACKUP/site/assets/storefront.js"
[[ -f "$SITE_ROOT/assets/product.js" ]] && cp -a "$SITE_ROOT/assets/product.js" "$BACKUP/site/assets/product.js"
cp -a "$SITE_ROOT/cliente/index.html" "$BACKUP/site/cliente/index.html"
cp -a "$SITE_ROOT/cliente/admin.js" "$BACKUP/site/cliente/admin.js"
[[ -f "$SITE_ROOT/produto.html" ]] && cp -a "$SITE_ROOT/produto.html" "$BACKUP/site/produto.html"
[[ -f "$SITE_ROOT/assets/rainha-ux.css" ]] && cp -a "$SITE_ROOT/assets/rainha-ux.css" "$BACKUP/site/assets/rainha-ux.css"
cp -a "$API_DIR/server.mjs" "$BACKUP/api/server.mjs"
cp -a "$DRIVE_FILE" "$BACKUP/api/drive.mjs"
cp -a "$DRIVE_CONFIG" "$BACKUP/config/google.json"
cp -a "$DATA_FILE" "$BACKUP/data/catalog.json"

restore_server() {
  echo "Restaurando a configuração anterior…" >&2
  cp -a "$BACKUP/api/server.mjs" "$API_DIR/server.mjs"
  cp -a "$BACKUP/api/drive.mjs" "$DRIVE_FILE"
  cp -a "$BACKUP/config/google.json" "$DRIVE_CONFIG"
  cp -a "$BACKUP/data/catalog.json" "$DATA_FILE"
  systemctl restart rainha-catalogo.service || true
}

echo "Preparando a pasta Google Drive da cliente…"
if ! switch_output="$("$NODE_BIN" "$BASE/api/switch-drive-folder.mjs" "$DRIVE_FILE" "$DRIVE_CONFIG" "$SOURCE_FOLDER_ID" "$CLIENT_FOLDER_ID" 2>&1)"; then
  printf '%s\n' "$switch_output" >&2
  restore_server
  echo "Atualização interrompida. Backup preservado em: $BACKUP" >&2
  exit 1
fi
printf '%s\n' "$switch_output"

echo "Copiando imagens atuais para o Drive da cliente…"
if ! migration_output="$("$NODE_BIN" "$BASE/api/migrate-drive.mjs" "$DATA_FILE" "$DRIVE_CONFIG" "$TOKEN_FILE" "$DRIVE_FILE" 2>&1)"; then
  printf '%s\n' "$migration_output" >&2
  restore_server
  echo "Atualização interrompida. Backup preservado em: $BACKUP" >&2
  exit 1
fi
printf '%s\n' "$migration_output"
SAMPLE_URL="$(printf '%s\n' "$migration_output" | sed -n 's/^MIGRATION_SAMPLE=//p' | tail -n 1)"

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
  restore_server
  echo "Atualização interrompida. Backup preservado em: $BACKUP" >&2
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3187/api/catalog >/dev/null; then
  echo "A nova API não respondeu ao catálogo. Restaurando o servidor anterior…" >&2
  restore_server
  echo "Atualização interrompida. Backup preservado em: $BACKUP" >&2
  exit 1
fi

if [[ -n "$SAMPLE_URL" ]] && ! curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:3187$SAMPLE_URL" -o /dev/null; then
  echo "Uma imagem migrada não respondeu. Restaurando o servidor anterior…" >&2
  restore_server
  echo "Atualização interrompida. Backup preservado em: $BACKUP" >&2
  exit 1
fi

echo
echo "Migração concluída. As imagens do catálogo agora estão na pasta da cliente."
echo "Backup: $BACKUP"
echo "Agora abra https://calcadosrainha.com.br/cliente/ e clique em Reconectar Google Drive usando o Gmail da cliente."
echo "Teste uma foto de produto ou banner antes de remover o Gmail antigo do compartilhamento."
