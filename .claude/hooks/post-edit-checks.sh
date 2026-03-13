#!/usr/bin/env bash
# .claude/hooks/post-edit-checks.sh
#
# PostToolUse hook — eseguito automaticamente dopo ogni Edit/Write su file TS/TSX.
# Controlli (bloccanti se falliscono):
#   1. Stub/TODO detector  — grep su pattern vietati (TODO, FIXME, not implemented, pass)
#   2. Empty-catch detector — grep su catch blocks vuoti
#   3. ESLint              — con regola no-empty forzata a error
#   4. TypeScript typecheck — tsc --noEmit sull'intero progetto
#   5. Unit test correlato  — vitest run sul file di test corrispondente, se esiste

set -uo pipefail

# ── 1. Leggi il file_path dal payload JSON di Claude Code (stdin) ──────────────
PAYLOAD=$(cat)
FILE_PATH=$(echo "$PAYLOAD" | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
  2>/dev/null || echo "")

# Processa solo file TypeScript/JavaScript sorgente
if [[ -z "$FILE_PATH" ]] || [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

if [[ ! -f "$FILE_PATH" ]]; then
  exit 0
fi

# Root del progetto (due livelli sopra .claude/hooks/)
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

FAILED=0
SEPARATOR="────────────────────────────────────────"

echo ""
echo "$SEPARATOR"
echo "🔎  Code Quality Hook: $(basename "$FILE_PATH")"
echo "$SEPARATOR"

# ── 2. Stub / TODO detection ───────────────────────────────────────────────────
echo "▶ Stub detector..."
STUBS=$(grep -nE \
  "TODO|FIXME|throw new Error\(.*[Nn]ot [Ii]mplemented|^\s*pass\s*$" \
  "$FILE_PATH" 2>/dev/null || true)

if [[ -n "$STUBS" ]]; then
  echo "❌ Stub/TODO rilevato in $FILE_PATH:" >&2
  echo "$STUBS" >&2
  FAILED=1
else
  echo "   ✅ Nessun stub trovato"
fi

# ── 3. Empty catch block detection ────────────────────────────────────────────
echo "▶ Empty-catch detector..."
# Cerca pattern: catch(...) { } oppure catch(...) { // commento }
EMPTY_CATCH=$(grep -nP "catch\s*\([^)]*\)\s*\{\s*(\/\/[^\n]*)?\s*\}" \
  "$FILE_PATH" 2>/dev/null || true)

if [[ -n "$EMPTY_CATCH" ]]; then
  echo "❌ Empty catch block in $FILE_PATH:" >&2
  echo "$EMPTY_CATCH" >&2
  FAILED=1
else
  echo "   ✅ Nessun empty catch trovato"
fi

# ── 4. ESLint (no-empty forzato a error, override del config) ─────────────────
echo "▶ ESLint..."
ESLINT_OUT=$(npx eslint "$FILE_PATH" \
  --rule '{"no-empty": ["error", {"allowEmptyCatch": false}]}' \
  --max-warnings 0 2>&1) || {
  echo "❌ ESLint fallito su $FILE_PATH:" >&2
  echo "$ESLINT_OUT" >&2
  FAILED=1
}
if [[ $FAILED -eq 0 ]] || [[ -z "$ESLINT_OUT" ]]; then
  echo "   ✅ ESLint OK"
fi

# ── 5. TypeScript typecheck ────────────────────────────────────────────────────
# Salta file in api/ (esclusi dalla tsconfig frontend)
if [[ "$FILE_PATH" != */api/* ]]; then
  echo "▶ TypeScript typecheck..."
  TSC_OUT=$(npx tsc --noEmit 2>&1) || {
    echo "❌ TypeScript typecheck fallito:" >&2
    echo "$TSC_OUT" >&2
    FAILED=1
  }
  if [[ $? -eq 0 ]]; then
    echo "   ✅ TypeScript OK"
  fi
fi

# ── 6. Unit test correlato ────────────────────────────────────────────────────
BASENAME=$(basename "$FILE_PATH" | sed 's/\.[^.]*$//')
DIR=$(dirname "$FILE_PATH")
TEST_FILE=""

for candidate in \
  "${DIR}/__tests__/${BASENAME}.test.ts" \
  "${DIR}/__tests__/${BASENAME}.test.tsx" \
  "${DIR}/${BASENAME}.test.ts" \
  "${DIR}/${BASENAME}.test.tsx" \
  "${DIR}/${BASENAME}.spec.ts" \
  "${DIR}/${BASENAME}.spec.tsx"; do
  if [[ -f "$candidate" ]]; then
    TEST_FILE="$candidate"
    break
  fi
done

if [[ -n "$TEST_FILE" ]]; then
  echo "▶ Unit test: $(basename "$TEST_FILE")..."
  TEST_OUT=$(npx vitest run "$TEST_FILE" --reporter=verbose 2>&1) || {
    echo "❌ Unit test fallito ($TEST_FILE):" >&2
    echo "$TEST_OUT" >&2
    FAILED=1
  }
  if [[ $? -eq 0 ]]; then
    echo "   ✅ Test OK"
  fi
else
  echo "▶ Unit test: nessun file di test trovato per $(basename "$FILE_PATH"), skip."
fi

# ── Risultato finale ──────────────────────────────────────────────────────────
echo "$SEPARATOR"
if [[ $FAILED -eq 1 ]]; then
  echo "🚨  HOOK FALLITO — correggi i problemi sopra prima di continuare."
  echo "$SEPARATOR"
  exit 1
fi

echo "✅  Tutti i controlli superati per: $(basename "$FILE_PATH")"
echo "$SEPARATOR"
exit 0
