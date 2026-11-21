# Rhema Developer Guide

The full developer onboarding and setup guide is maintained at the root of the repository:

👉 **[View the Developer Guide (DEVELOPMENT.md)](../DEVELOPMENT.md)**

### Quick Reference Commands

```bash
# 1. Install frontend dependencies
bun install

# 2. Build the SQLite database with all 10 Bible translations & cross-references
bun run build:bible

# 3. Seed songs and lyrics catalog
bun run seed:songs

# 4. Run full desktop development app (Vite + Tauri)
bun run tauri dev

# 5. Run tests
bun run test --run
cd src-tauri && cargo test --workspace
```
