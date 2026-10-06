import express from "express";
import { z } from "zod";
import { classifyDocument } from "./document_signal.js";
import { createInfraiPipeline, InfraiError } from "./infrai_pipeline.js";

const indexBody = z.object({
  pdf: z.string().min(1),
  collection: z.string().min(1),
  documentId: z.string().min(1),
  lang: z.string().min(1).optional(),
  quality: z.string().min(1).optional(),
  buildId: z.string().min(1),
  release: z.string().min(1),
});

const searchBody = z.object({
  collection: z.string().min(1),
  query: z.string().min(1),
  topK: z.number().int().min(1).max(20).default(5),
});

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const pipeline = createInfraiPipeline(apiKey);
const app = express();
app.use(express.json({ limit: "12mb" }));

app.post("/documents/index", async (req, res, next) => {
  try {
    const input = indexBody.parse(req.body);
    const result = await pipeline.extractAndIndex({
      ...input,
      metadata: { buildId: input.buildId, release: input.release },
    });
    res.status(201).json({
      documentId: input.documentId,
      signal: classifyDocument(result.text),
      indexed: result.indexed,
      text: result.text,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/documents/search", async (req, res, next) => {
  try {
    const input = searchBody.parse(req.body);
    res.json(await pipeline.search(input));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "invalid_request", issues: error.issues });
    return;
  }
  if (error instanceof InfraiError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 502;
    res.status(status).json({ error: error.code, message: error.message });
    return;
  }
  console.error(error);
  res.status(502).json({ error: "upstream_transport", message: "The document could not be processed" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Document index listening on http://localhost:${port}`));
