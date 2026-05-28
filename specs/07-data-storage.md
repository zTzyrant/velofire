# Data Storage

## Tujuan

Velofire memakai local-first storage. Data harus bisa digunakan offline, cepat diakses, dan sebagian formatnya Git-friendly.

## SQLite Schema MVP

### collections

Fields:

- `id`
- `name`
- `created_at`
- `updated_at`

### requests

Fields:

- `id`
- `collection_id`
- `name`
- `method`
- `url`
- `headers`
- `body`
- `auth`
- `created_at`
- `updated_at`

### environments

Fields:

- `id`
- `name`
- `variables`

### history

Fields:

- `id`
- `request_snapshot`
- `response_snapshot`
- `created_at`

## Serialization

Gunakan structured serialization:

- JSON untuk payload internal dan export.
- YAML untuk Git-friendly collection files dan export.
- TOML hanya jika cocok untuk config proyek.

Hindari ad hoc string parsing untuk data terstruktur jika parser tersedia.

## Git-Friendly Collections

Koleksi disimpan sebagai:

```txt
.collections/
```

Contoh file:

```txt
request-name.yaml
```

Keuntungan:

- Mudah di-diff.
- Mudah direview.
- Portable.
- Bisa dikolaborasikan lewat Git tanpa cloud.

## Collection File Guidelines

Request file minimal harus memuat:

- Name.
- Method.
- URL.
- Headers.
- Body type.
- Body value.
- Auth config.
- Optional metadata.

Folder dapat direpresentasikan oleh direktori atau field path. Pilih satu pendekatan dan konsisten.

## History

History menyimpan snapshot, bukan reference yang dapat berubah.

Snapshot request:

- Method.
- URL resolved.
- Headers setelah sanitasi sesuai security policy.
- Body metadata atau body value sesuai ukuran dan sensitivity.
- Timestamp.

Snapshot response:

- Status.
- Headers.
- Timing.
- Body raw atau truncated jika besar.
- Parse metadata.

## Import / Export

Import:

- cURL ke request internal.
- Postman Collection ke collection internal.

Export:

- JSON.
- YAML.

Security:

- Export secret harus eksplisit.
- Default export sebaiknya sanitasi secret atau memberi prompt/opsi yang jelas.
