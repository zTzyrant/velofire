# Architecture

## Tujuan

Velofire memakai arsitektur berlapis agar UI tetap ringan dan domain logic berada di Rust.

## Layer

```txt
Frontend Layer
↓
Tauri Commands
↓
Rust Service Layer
↓
Storage / Network Layer
```

## Frontend Layer

Tanggung jawab:

- Render UI.
- Mengelola state visual.
- Mengirim command ke Tauri.
- Menampilkan progress, response, validation, dan error.
- Menyediakan keyboard-first workflow.

Frontend tidak boleh menjadi tempat utama networking API eksternal. Pengiriman HTTP harus lewat Rust layer.

## Tauri Commands

Tanggung jawab:

- Boundary komunikasi frontend ke Rust.
- Menerima payload serializable.
- Melakukan validasi input ringan.
- Memanggil service.
- Mengembalikan response yang jelas dan typed.

Command tidak boleh berisi business logic besar.

## Rust Service Layer

Tanggung jawab:

- Send request.
- Resolve environment variables.
- Apply authentication.
- Normalize headers/body.
- Save/load collections.
- Save/load history.
- Import/export.
- Error mapping.

Service harus mudah dites tanpa UI.

## Storage / Network Layer

Storage:

- SQLite untuk data lokal yang cocok sebagai database.
- File-based `.collections/` untuk koleksi Git-friendly.
- Repository abstraction untuk menghindari logic SQL/file tersebar.

Network:

- `reqwest` untuk HTTP.
- `tokio` untuk async runtime.
- Timeout, redirect, TLS, dan error harus dikonfigurasi eksplisit.

## Data Flow Request

1. User mengedit request di frontend.
2. Frontend mengirim payload ke Tauri command.
3. Command memanggil request service.
4. Service resolve environment variables.
5. Service apply auth dan headers.
6. HTTP engine mengirim request.
7. Response dinormalisasi.
8. History disimpan jika enabled.
9. Response dikirim balik ke frontend.

## Error Handling

Error harus dikategorikan:

- Validation error.
- Environment variable missing.
- Authentication configuration error.
- Network error.
- Timeout.
- TLS error.
- Response parsing error.
- Storage error.
- Import/export parsing error.

Frontend harus menerima error yang dapat ditampilkan tanpa parsing string bebas.

## Modul Masa Depan

Modul berikut boleh disiapkan sebagai boundary, tetapi jangan menjadi dependency MVP:

- WebSocket engine.
- GraphQL.
- AI engine.
- Testing engine.
- Plugin system.
- Sync engine.
