# Repository Guidelines

## Project Structure & Module Organization

Velofire is split between a Rust core library and a Tauri desktop UI.

- `src/` contains the core Rust crate: workspace orchestration, SQLite storage, secure storage, importers, HTTP execution, and domain models.
- `apps/desktop/` contains the Solid/Vite frontend. Components live in `src/components/`, app services in `src/services/`, and client state in `src/stores/`.
- `apps/desktop/src-tauri/` contains the Tauri shell and depends on the root `velofire` crate.
- `specs/` and `DESIGN.md` document product scope, architecture, security, storage, and UI decisions.
- `stitch_vector_api_client/` holds generated/reference HTML prototypes.

## Build, Test, and Development Commands

Prefix shell commands with `rtk` when working as an agent in this repository.

- `rtk cargo test` runs unit tests.
- `rtk cargo build` builds the root crate.
- `cd apps/desktop && bun install` installs desktop app dependencies from `bun.lock`.
- `cd apps/desktop && bun run dev` starts the Vite frontend on `127.0.0.1`.
- `cd apps/desktop && bun run build` builds the frontend bundle.
- `cd apps/desktop && bun run tauri dev` runs the full Tauri desktop app during development.

## Coding Style & Naming Conventions

Rust uses edition 2024 conventions. Keep modules focused, prefer domain types from `src/models.rs`, and use `snake_case` for functions, modules, and fields. Run `rtk cargo fmt` before submitting Rust changes.

Frontend code is TypeScript/Solid. Use `PascalCase` for components and `camelCase` for functions and stores. Keep Tauri command wrappers in `apps/desktop/src/services/`.

## Testing Guidelines

Rust tests are colocated in `#[cfg(test)]` modules inside files such as `src/workspace.rs`, `src/importers.rs`, and `src/http_engine.rs`. Add focused tests next to changed code, especially for parsing, request resolution, persistence, and security-sensitive behavior. Use descriptive test names.

No frontend test runner is configured yet. For UI changes, run `cd apps/desktop && bun run build` and manually verify the affected Tauri or Vite workflow.

## Commit & Pull Request Guidelines

The history uses Conventional Commits, for example `feat: implement core domain models and workspace architecture for Velofire project`. Continue with `feat:`, `fix:`, `docs:`, `test:`, or `refactor:`.

Pull requests should include a summary, commands run, linked issues or spec sections when relevant, and screenshots for visible UI changes. Call out storage, encryption, network, or migration implications.

## Security & Configuration Tips

Do not commit secrets, API keys, workspace data, or local database files. Treat `secure_store`, auth headers, environment variables, and request bodies as sensitive. Prefer adding examples to specs or fixtures with clearly fake values such as `https://api.test`.
