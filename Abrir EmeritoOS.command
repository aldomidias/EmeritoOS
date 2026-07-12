#!/bin/bash
# Abre o painel do EméritoOS — sobe o servidor local e abre o navegador.
# Duplo-clique no Finder executa esse arquivo no Terminal (extensão .command).
# Na primeira vez, dar permissão de execução: chmod +x "Abrir EméritoOS.command"

set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js não encontrado. Instale em https://nodejs.org e abra de novo."
  echo
  read -p "Pressione Enter pra fechar..."
  exit 1
fi

# Sobe o servidor em background
node mazyui-server.mjs >/tmp/mazyui.log 2>&1 &
SERVER_PID=$!

# Espera o servidor responder antes de abrir o browser (até 60s)
tries=0
while [ $tries -lt 60 ]; do
  if curl -sf -o /dev/null --max-time 1 "http://localhost:7777/"; then
    break
  fi
  tries=$((tries + 1))
  sleep 1
done

open "http://localhost:7777/"

# Mantém o terminal vivo enquanto o servidor roda; Cmd+W fecha a janela mas
# o servidor segue (basta usar o botão "Desligar" no painel pra parar).
echo
echo "MazyUI rodando em http://localhost:7777/"
echo "Logs em /tmp/mazyui.log"
echo "Servidor PID: $SERVER_PID"
echo
echo "Pra desligar: use o botão no painel, ou rode: kill $SERVER_PID"
