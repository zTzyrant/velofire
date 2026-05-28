# Specs Index

Dokumen ini adalah peta baca untuk agent AI yang mengerjakan Velofire. Muat file yang relevan saja sesuai tugas agar konteks tetap kecil.

## Urutan Baca Minimum

1. `01-product-vision.md`
2. `02-project-boundaries.md`
3. `03-project-structure.md`
4. `04-design-guide.md`

## Specs Per Area

- `01-product-vision.md`: tujuan produk, target platform, filosofi, dan prioritas.
- `02-project-boundaries.md`: batasan MVP, non-goals, performa, privacy, dan keputusan yang tidak boleh dilanggar.
- `03-project-structure.md`: struktur monorepo target, struktur frontend, struktur Rust/Tauri, dan aturan penempatan file.
- `04-design-guide.md`: panduan visual dan UX berdasarkan `DESIGN.md`.
- `05-mvp-features.md`: fitur MVP yang perlu dibangun lebih dulu dan acceptance notes per fitur.
- `06-architecture.md`: layer aplikasi, flow data, command boundary, service boundary, dan prinsip modularitas.
- `07-data-storage.md`: skema data MVP, format koleksi Git-friendly, history, import/export.
- `08-security-privacy.md`: strategi secret handling, enkripsi, penyimpanan lokal, dan privasi.
- `09-ai-roadmap.md`: rencana fitur AI, batasan local-first, integrasi cloud opsional, dan fase masa depan.

## Agent Briefs

- `agents/00-coordinator.md`: koordinator pembagian kerja dan batas write scope.
- `agents/01-core-rest-agent.md`: agent core REST request engine.
- `agents/02-import-agent.md`: agent import Postman Collection dan OpenAPI.
- `agents/03-ui-design-agent.md`: agent UI awal berdasarkan `DESIGN.md` dan referensi Stitch.
- `agents/04-workspace-agent.md`: agent workspace, environment, collection, dan history.

## Sumber Asli

- `AI_API_CLIENT_PROJECT.md`
- `DESIGN.md`

Jika ada konflik, specs di folder ini menjadi sumber operasional untuk implementasi. File sumber asli tetap menjadi referensi konteks historis.
