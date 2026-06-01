# AI Roadmap

## Tujuan

AI adalah fitur pendukung, bukan fondasi MVP. Semua fitur AI harus menghormati local-first, privacy, dan performa.

## Phase 3 AI Features

Fitur yang direncanakan:

- Generate request from prompt.
- Explain API errors.
- Generate cURL.
- Generate OpenAPI.
- Auto-detect schema.
- Generate tests.

## Local-First AI

Opsi local:

- Local LLM.
- Ollama integration.
- `candle`.
- llama.cpp bindings.

Local AI harus opsional dan tidak membuat startup lambat. Jangan bundling model besar tanpa keputusan produk eksplisit.

## Cloud AI

Opsi cloud:

- OpenAI.
- Claude.
- Gemini.

Cloud AI harus:

- Opt-in.
- Memiliki provider configuration yang jelas.
- Memberi preview data yang dikirim jika berisi request/response.
- Mengikuti sanitasi secret.

## AI Feature Boundaries

Jangan implementasikan AI di MVP kecuali instruksi eksplisit.

Jika membangun placeholder:

- Buat boundary service.
- Jangan hardcode provider.
- Jangan campur prompt logic ke komponen UI.
- Jangan kirim data otomatis.

## Suggested AI Workflows

Error explanation:

1. User memilih response/error.
2. App membuat sanitized context.
3. User meninjau data.
4. User menjalankan AI explain.
5. Hasil ditampilkan sebagai panel bantuan, bukan mengganti response asli.

Request generation:

1. User menulis prompt.
2. AI menghasilkan draft request.
3. User review method, URL, headers, body, auth.
4. User menyimpan atau mengirim manual.

OpenAPI generation:

1. User memilih collection.
2. App membuat schema draft.
3. User dapat export.

## Future Non-AI Roadmap

Phase 2:

- GraphQL query builder.
- GraphQL schema explorer.
- WebSocket client.
- Socket.IO client.
- gRPC client.
- MQTT client.
- Multipart file upload.
- Bottom console drawer with request/script/network logs.
- JSON formatter, JSON linting, and common variable/key suggestions.
- User settings for suggestion language/locale.
- Mock server.
- Request chaining.
- Testing engine.
- Collection runner.
- Environment sync via Git.

Phase 3+:

- API documentation generator.
- Team collaboration.
- Cloud sync.
- Plugin system.
- Enterprise features seperti self-hosted sync, SSO, audit logs.
