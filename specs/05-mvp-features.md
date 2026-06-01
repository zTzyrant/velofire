# MVP Features

## Tujuan

File ini memecah fitur MVP menjadi unit kecil yang bisa dikerjakan bertahap.

## 1. REST Request Client

Harus mendukung:

- GET
- POST
- PUT
- PATCH
- DELETE

Acceptance notes:

- User bisa memilih method.
- User bisa memasukkan URL.
- Request dikirim dari Rust backend.
- UI menampilkan loading, success, error, status, dan timing.

## 2. Headers Manager

Harus mendukung:

- Add header.
- Remove header.
- Edit key/value.
- Enable/disable header jika memungkinkan.
- Bulk edit sebagai mode lanjutan.

Acceptance notes:

- Header kosong tidak dikirim.
- Duplicate header ditangani secara eksplisit.
- Secret-looking header harus dipertimbangkan dalam security handling.

## 3. Body Types

Harus mendukung:

- JSON.
- Form Data.
- URL Encoded.
- Raw Text.
- XML.
- Multipart file upload.

Acceptance notes:

- Body editor mengikuti tipe yang dipilih.
- JSON bisa pretty format.
- Content-Type bisa disarankan otomatis, tetapi user tetap bisa override.
- File upload butuh model field berbeda dari text field: `text` vs `file`, path lokal, content type opsional, dan masking path bila perlu.
- File upload harus dikirim dari Rust backend, bukan frontend browser fetch.

## 4. Authentication

Harus mendukung:

- Bearer Token.
- Basic Auth.
- API Key.

Acceptance notes:

- Auth menghasilkan header atau query param sesuai tipe.
- Secret tidak ditampilkan sembarangan.
- Penyimpanan secret mengikuti `08-security-privacy.md`.

## 5. Collections

Harus mendukung:

- Folder structure.
- Save request.
- Organize request.
- Reorder request dengan drag/drop di dalam root collection, folder, dan antar folder.

Acceptance notes:

- Koleksi bisa digunakan lokal tanpa cloud.
- Struktur file harus Git-friendly jika disimpan sebagai file.
- UI sidebar bisa browse koleksi dan membuka request.
- Drag/drop reorder harus pointer-based dan memberi indikator posisi sebelum/sesudah target row.
- Collapse collection/folder tidak boleh terpicu hanya karena user sedang drag request.

## 6. Environment Variables

Format variable:

```txt
{{base_url}}
{{token}}
```

Acceptance notes:

- Variable dapat dipakai di URL, headers, auth, dan body.
- Resolver harus menampilkan error jelas jika variable hilang.
- Environment aktif harus terlihat di UI.

## 7. Request History

Harus mendukung:

- Menyimpan request terakhir.
- Menyimpan response snapshot yang cukup untuk debugging.
- Replay request.

Acceptance notes:

- History tidak mengganti saved collection.
- Secret handling tetap berlaku.
- History dapat dibersihkan.

## 8. Import

Harus mendukung:

- Import cURL.
- Import Postman Collection.

Acceptance notes:

- Import menghasilkan request/collection internal.
- Error parsing harus actionable.
- Jangan crash karena format parsial.

## 9. Export

Harus mendukung:

- JSON.
- YAML.

Acceptance notes:

- Export stabil dan mudah di-diff.
- Secret export harus eksplisit atau disanitasi sesuai mode.

## 10. Response Viewer

Harus mendukung:

- Pretty JSON.
- Raw response.
- Headers.
- Status.
- Timing.

Acceptance notes:

- JSON invalid tetap bisa dilihat sebagai raw.
- Large response tidak boleh membuat UI freeze.
- Status code tampil sebagai chip yang mudah dipindai.

## 11. Console Drawer

Harus mendukung:

- Drawer bawah seperti developer console.
- Log level: info, warning, error.
- Timestamp.
- Clear log.
- Log request lifecycle, script log, variable resolution warning, dan network errors.

Acceptance notes:

- Console tidak menggantikan response viewer.
- Console harus bisa dibuka/tutup tanpa mengubah layout utama.

## 12. Advanced Request Types

Target bertahap setelah REST stabil:

- GraphQL.
- WebSocket.
- Socket.IO.
- gRPC.
- MQTT.

Acceptance notes:

- Setiap tipe request harus punya model, editor, executor, dan response/event viewer sendiri.
- Jangan memaksa semua protokol masuk ke `HttpMethod`.
- REST tetap default dan paling ringan.
