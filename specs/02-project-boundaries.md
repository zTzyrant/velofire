# Project Boundaries

## Tujuan

File ini mendefinisikan batas kerja agar implementasi tetap fokus dan tidak melebar dari MVP.

## Scope MVP

MVP hanya mencakup API client REST lokal dengan:

- Request editor untuk GET, POST, PUT, PATCH, DELETE.
- Headers manager.
- Body editor untuk JSON, form data, URL encoded, raw text, dan XML.
- Authentication untuk Bearer Token, Basic Auth, dan API Key.
- Collections dengan folder dan saved requests.
- Environment variables dengan format `{{variable_name}}`.
- Request history dan replay.
- Import cURL.
- Import Postman Collection.
- Export JSON dan YAML.
- Response viewer dengan pretty JSON, raw, headers, status, dan timing.

## Non-Goals MVP

Jangan implementasikan di MVP kecuali ada instruksi eksplisit:

- Cloud sync.
- Team collaboration.
- GraphQL.
- WebSocket client.
- Mock server.
- Testing engine.
- Collection runner.
- Plugin system.
- Local LLM runtime.
- Mobile apps.
- Account system.
- Billing atau monetization.

## Performance Boundaries

Target performa:

- Startup desktop kurang dari 1 detik untuk app kosong atau workspace kecil.
- Idle RAM kurang dari 200MB.
- Request dikirim lewat native Rust networking, bukan browser fetch dari frontend.
- UI harus tetap responsif saat request berjalan.
- Release build harus dioptimalkan agar binary tidak membengkak tanpa alasan.

## Privacy Boundaries

- Fungsi inti harus berjalan tanpa login.
- Data request, response, history, environment, dan collections disimpan lokal.
- Secret tidak boleh dikirim ke layanan eksternal tanpa aksi eksplisit pengguna.
- Fitur AI cloud harus opt-in.
- Integrasi cloud bukan dependency untuk MVP.

## UX Boundaries

- UI harus compact, dense, dan developer-first.
- Hindari whitespace berlebihan.
- Hindari animasi berat.
- Hindari layout mobile-style yang oversized.
- Keyboard-first workflow harus dipertimbangkan sejak awal.
- Command palette adalah fitur UX penting, tetapi bisa bertahap setelah request workflow inti stabil.

## Technical Boundaries

- Core runtime: Rust.
- Desktop framework target: Tauri v2.
- Frontend target: SolidJS.
- Storage utama: SQLite.
- Serialisasi: serde, serde_json, TOML/YAML support sesuai kebutuhan import/export.
- Networking utama: reqwest di Rust layer.

Alternative frontend seperti SvelteKit atau Vue hanya boleh dipakai jika keputusan proyek berubah secara eksplisit.
