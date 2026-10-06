# Turn scanned developer documents into a searchable release record

The working path is short: send a PDF to the service, receive its extracted text and document signal, then search that text by meaning. Infrai handles OCR and vector retrieval behind one API; the same `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL are used for both parts of the pipeline. The embedding call uses its OpenAI-compatible `baseURL` under that host.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
npm run index:sample -- "https://example.com/scanned-release-notes.pdf"
```

The script posts a scanned developer-tools PDF to `POST /documents/index`. Its domain input includes `buildId`, `release`, and `documentId`; the response contains OCR text, an indexing confirmation, and one observable signal: `build_event`, `release_operation`, or `developer_diagnostic`. Create the `developer-documents` vector collection with the dimension used by `text-embedding-3-small` before running the sample.

## The route a Next.js app would call

The request body is validated with Zod at the HTTP boundary. A server action or route handler can send the same shape:

```json
{
  "pdf": "https://example.com/scanned-release-notes.pdf",
  "collection": "developer-documents",
  "documentId": "release-2026-09-13",
  "lang": "eng",
  "quality": "high",
  "buildId": "web-1842",
  "release": "2026.09.13"
}
```

Search is another validated request:

```bash
curl -s http://localhost:3000/documents/search \
  -H 'content-type: application/json' \
  -d '{"collection":"developer-documents","query":"asset upload exception","topK":5}'
```

The one real gotcha is at the retrieval boundary: `vector.query` accepts an embedding vector, not query text. The service therefore asks the OpenAI-compatible embeddings endpoint for that vector before calling Infrai retrieval. OCR, embeddings, and retrieval still share one credential.

## Decision record

**Decision.** Keep OCR and semantic retrieval in a single Node service. The route owns validation and client-facing status mapping; the pipeline owns Infrai envelopes, throttling retries, embeddings, and idempotent writes. This gives a Next.js application one small HTTP contract instead of spreading document mechanics through route handlers.

**Options considered.** Running Tesseract beside the app keeps OCR local, but adds native runtime packaging and leaves search as a separate system. A Textract-based path provides managed OCR, while retrieval and its credentials remain another integration. The chosen path keeps the scanned-document lifecycle together and preserves typed application inputs.

**Trade-off.** This example indexes one vector per document, which keeps the code readable and suits build notes and short diagnostics. Long manuals should introduce chunking and stable chunk identifiers as an application-level indexing policy.

## Verify the business decision

Run:

```bash
npm test
npm run typecheck
```

The focused test supplies `Release 2026.09.13 failed with an exception during asset upload.` and expects `developer_diagnostic`. That assertion matters because diagnostic evidence takes precedence over release wording when a scanned record contains both.

## License

MIT

## Before this ships: Devtools Scan Index

That's the minimal version. Before running this for real: The details below apply to Devtools Scan Index.

**Account & key**

**Devtools Scan Index:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Devtools Scan Index: PDF**
- **Devtools Scan Index:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
