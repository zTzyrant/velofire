# Project Structure Guide

## Tujuan

File ini menjelaskan struktur proyek target agar agent menaruh kode di tempat yang konsisten. Repo saat ini masih minimal, jadi struktur ini adalah arah pengembangan, bukan kondisi awal yang sudah lengkap.

## Struktur Monorepo Target

```txt
project-root/
├── apps/
│   ├── desktop/
│   │   ├── src/
│   │   ├── src-tauri/
│   │   └── package.json
│   └── mobile/
├── packages/
│   ├── ui/
│   ├── shared/
│   ├── api-schema/
│   └── editor/
├── rust-core/
│   ├── http_engine/
│   ├── websocket_engine/
│   ├── storage/
│   ├── encryption/
│   ├── collections/
│   ├── environments/
│   ├── ai_engine/
│   └── testing_engine/
├── docs/
├── scripts/
├── assets/
├── specs/
└── README.md
```

## Aturan Penempatan

- `apps/desktop`: shell aplikasi Tauri desktop dan frontend SolidJS.
- `apps/mobile`: placeholder future, jangan isi untuk MVP.
- `packages/ui`: komponen UI reusable lintas app.
- `packages/shared`: utilitas TypeScript bersama.
- `packages/api-schema`: tipe shared untuk command payload, response, DTO, dan schema kontrak.
- `packages/editor`: editor request/body/response jika perlu dipisah dari app.
- `rust-core`: crate atau module Rust yang memuat domain logic non-UI.
- `specs`: dokumen operasional kecil untuk AI dan developer.

## Struktur Frontend Target

```txt
apps/desktop/src/
├── components/
│   ├── common/
│   ├── layout/
│   ├── request/
│   ├── response/
│   ├── sidebar/
│   ├── ui/
│   └── editor/
├── stores/
├── services/
├── hooks/
├── lib/
├── styles.css
└── utils/
```

Panduan:

- `components/common`: button, input, tabs, splitter, modal, menu, command palette primitives.
- `components/ui`: shadcn-style local primitives berbasis SolidJS dan Tailwind CSS. Jangan import shadcn React.
- `components/layout`: topbar, shell, split pane, dan layout aplikasi desktop.
- `components/request`: method selector, URL bar, headers table, body editor, auth editor.
- `components/response`: response tabs, JSON viewer, raw viewer, header viewer, timing/status display.
- `components/sidebar`: collections, history, environments.
- `components/editor`: code editor wrappers dan technical text inputs.
- `stores`: state UI lokal, selected request, environment aktif, request tabs.
- `services`: wrapper Tauri commands dan API frontend-to-backend.
- `hooks`: reusable behavior seperti resize pane, keyboard shortcut, debounced input.
- `styles.css`: Tailwind v4 import, design tokens, global CSS, app-level layout, dan CSS khusus Tauri.
- `lib`: helper frontend seperti `cn`.
- `utils`: pure frontend helpers.

## Frontend Tooling Saat Ini

- Framework: SolidJS + Vite.
- Styling: Tailwind CSS v4 via `@tailwindcss/vite`.
- UI primitive: shadcn-style local components di `apps/desktop/src/components/ui`.
- Icons: `lucide-solid` bila tersedia.
- Notifications: `solid-sonner`.

## Struktur Rust/Tauri Target

```txt
src-tauri/src/
├── commands/
├── services/
├── models/
├── repositories/
├── database/
├── utils/
├── ai/
├── websocket/
└── main.rs
```

Panduan:

- `commands`: boundary Tauri command. Validasi input ringan, mapping payload, panggil service.
- `services`: business logic aplikasi seperti send request, save collection, import/export.
- `models`: struct request, response, collection, environment, history, auth, header, body.
- `repositories`: persistence abstraction untuk SQLite dan file-based collections.
- `database`: migration, connection pool, schema setup.
- `utils`: helper kecil non-domain.
- `ai`: placeholder fase masa depan, jangan jadikan dependency MVP.
- `websocket`: placeholder fase masa depan.

## Naming dan Modul

- Gunakan nama module berdasarkan domain, bukan teknologi UI.
- Hindari file raksasa. Pecah per fitur jika file mulai memuat banyak responsibility.
- Shared contract antara frontend dan Rust harus eksplisit, terdokumentasi, dan stabil.
- Request/response payload Tauri command harus serializable dengan serde.

## Kondisi Repo Saat Ini

Repo saat ini hanya punya Rust package minimal:

```txt
Cargo.toml
src/main.rs
AI_API_CLIENT_PROJECT.md
DESIGN.md
specs/
```

Saat migrasi ke Tauri/SolidJS, lakukan secara bertahap dan jangan menghapus file yang masih diperlukan tanpa alasan jelas.
