#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(dirname -- "$(realpath -- "${BASH_SOURCE[0]}")")"
BASHRC_PATH="${BASHRC_PATH:-${HOME}/.bashrc}"
VENV_PATH="${PROJECT_ROOT}/.venv"
SHORTCUT_MARKER="# >>> ai-code-guard >>>"

require_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'Required command is missing: %s\n' "$command_name" >&2
        exit 1
    fi
}

require_command node
require_command python3

if ! command -v pnpm >/dev/null 2>&1; then
    if ! command -v corepack >/dev/null 2>&1; then
        printf 'pnpm is missing. Install pnpm 8 or newer, then run this script again.\n' >&2
        exit 1
    fi
    corepack enable
    corepack prepare pnpm@8 --activate
fi

if ! python3 -m venv --help >/dev/null 2>&1; then
    printf 'Python virtual-environment support is missing. Install it with:\n' >&2
    printf '  sudo apt update && sudo apt install -y python3-venv\n' >&2
    exit 1
fi

pnpm --dir "$PROJECT_ROOT" install

if [[ ! -d "$VENV_PATH" ]]; then
    python3 -m venv "$VENV_PATH"
fi
"${VENV_PATH}/bin/python" -m pip install --upgrade pip
"${VENV_PATH}/bin/python" -m pip install -r "${PROJECT_ROOT}/requirements.txt"

if [[ ! -f "$BASHRC_PATH" ]]; then
    touch "$BASHRC_PATH"
fi

if ! grep -Fq "$SHORTCUT_MARKER" "$BASHRC_PATH"; then
    ESCAPED_PROJECT_ROOT="$(printf '%q' "$PROJECT_ROOT")"
    {
        printf '\n%s\n' "$SHORTCUT_MARKER"
        printf 'ai-code-guard() {\n'
        printf '    local guard_root=%s\n' "$ESCAPED_PROJECT_ROOT"
        printf '    PATH="$guard_root/.venv/bin:$PATH" pnpm --dir "$guard_root" exec tsx \\\n'
        printf '        "$guard_root/src/bridge/ts/core/cli.ts" \\\n'
        printf '        --root "$PWD" "$@"\n'
        printf '}\n'
        printf '%s\n' "$SHORTCUT_MARKER"
    } >> "$BASHRC_PATH"
    printf 'Added ai-code-guard to %s.\n' "$BASHRC_PATH"
else
    printf 'ai-code-guard is already configured in %s.\n' "$BASHRC_PATH"
fi

printf '\nSetup complete. Reload Bash with:\n'
printf '  source %q\n' "$BASHRC_PATH"
printf 'Then run ai-code-guard from any project directory.\n'
