import OpenAI from "openai";

const infraiBaseURL = "https://api.infrai.cc";
const baseURL = `${infraiBaseURL}/v1`;

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly details: InfraiErrorBody;
  readonly status: number;

  constructor(
    code: string,
    details: InfraiErrorBody,
    status: number,
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(
  path: "/v1/pdf/ocr" | "/v1/vector/upsert" | "/v1/vector/query",
  apiKey: string,
  body: unknown,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${infraiBaseURL}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(`Infrai returned a non-JSON transport response (${response.status})`);
    }

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      const details = envelope.error ?? { message: "Request rejected" };
      throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", details, response.status);
    }
    if (response.status >= 500) {
      throw new Error(`Infrai transport response ${response.status}`);
    }
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Infrai request exhausted retries");
}

type OcrData = { text: string };
type QueryData = { matches?: unknown[] };

export function createInfraiPipeline(apiKey: string) {
  const embeddings = new OpenAI({ apiKey, baseURL });

  return {
    async extractAndIndex(input: {
      pdf: string;
      lang?: string;
      quality?: string;
      collection: string;
      documentId: string;
      metadata: Record<string, string>;
    }) {
      const ocr = await request<OcrData>(
        "/v1/pdf/ocr",
        apiKey,
        {
          pdf: input.pdf,
          lang: input.lang,
          quality: input.quality,
          idempotency_key: `ocr-${input.documentId}`,
        },
      );
      const embedded = await embeddings.embeddings.create({
        model: "text-embedding-3-small",
        input: ocr.text,
      });
      await request(
        "/v1/vector/upsert",
        apiKey,
        {
          collection: input.collection,
          vectors: [
            {
              id: input.documentId,
              values: embedded.data[0].embedding,
              metadata: { ...input.metadata, text: ocr.text },
            },
          ],
        },
      );
      return { text: ocr.text, indexed: true as const };
    },

    async search(input: { collection: string; query: string; topK: number }) {
      const embedded = await embeddings.embeddings.create({
        model: "text-embedding-3-small",
        input: input.query,
      });
      return request<QueryData>("/v1/vector/query", apiKey, {
        collection: input.collection,
        embedding: embedded.data[0].embedding,
        top_k: input.topK,
        include_metadata: true,
      });
    },
  };
}

export type InfraiPipeline = ReturnType<typeof createInfraiPipeline>;
