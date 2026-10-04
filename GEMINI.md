# WebV8-Arcade Project Rules

## Ignore
Never read, scan or modify:
- node_modules/
- src_backup_stable/
- public/cores/*.wasm
- Any ROM files (.bin, .iso, .cue) or save files (.state)

## Core Invariant
- Do NOT alter `src/emulator.worker.ts` emulation logic or change canvas resolution (must stay 640x480).
- Always ensure COOP/COEP headers (`same-origin` and `require-corp`) are preserved in development and production.
