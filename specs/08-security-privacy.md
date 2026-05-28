# Security and Privacy

## Tujuan

Velofire menangani token, API key, auth header, dan request history. Security policy harus jelas sejak awal agar local-first tidak berarti secret tersebar dalam plain text.

## Data Sensitif

Anggap data berikut sensitif:

- Bearer token.
- Basic auth password.
- API key.
- Cookie auth.
- Header seperti `Authorization`, `X-API-Key`, `X-Auth-Token`.
- Environment variable dengan nama mengandung `token`, `secret`, `password`, `key`, atau `credential`.

## Enkripsi

Secret yang disimpan harus dienkripsi.

Crate kandidat:

- `ring`
- `aes-gcm`

Integrasi masa depan:

- OS keychain.

## Never Store

Jangan menyimpan plain password.

Jika user memasukkan Basic Auth, simpan dengan mekanisme secret storage. Jika mekanisme belum tersedia, jangan persist password tanpa konfirmasi eksplisit.

## Local-First Privacy

- App harus bisa berjalan tanpa akun.
- Tidak ada telemetry wajib.
- Tidak ada upload request/response otomatis.
- AI cloud harus opt-in.
- Secret tidak boleh dikirim ke provider AI tanpa aksi eksplisit dan preview.

## History Policy

History berguna untuk replay dan debugging, tetapi bisa menyimpan data sensitif.

Aturan:

- Sanitasi header sensitif pada tampilan history jika perlu.
- Sediakan clear history.
- Jangan tampilkan secret penuh secara default.
- Pertimbangkan masking dengan reveal action.

## Export Policy

Default export harus aman:

- Secret disanitasi atau dipisah ke environment.
- Jika user memilih export dengan secret, tindakan harus eksplisit.
- Format export harus jelas agar reviewer Git dapat melihat risiko.

## UI Security Behavior

- Field secret memakai masked input secara default.
- Reveal secret harus tindakan eksplisit.
- Copy secret harus tidak terjadi dari klik tidak sengaja.
- Focus ring tetap jelas untuk keyboard users.

## Error Privacy

Error message tidak boleh membocorkan secret.

Contoh:

- Jangan tampilkan full Authorization header di error.
- Jangan log body sensitif secara otomatis.
- Jangan kirim full request ke AI analyzer tanpa sanitasi dan persetujuan.
