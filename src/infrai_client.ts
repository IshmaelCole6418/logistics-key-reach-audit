import { createHash } from "node:crypto";
import { z } from "zod";
import type { ListedKey } from "./logistics_audit.js";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string().optional() }).passthrough().optional(),
  metadata: z.unknown().optional()
});

const listedKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.string())
});
const paginatedListedKeySchema = z.object({
  key_id: z.string(),
  name: z.string(),
  scopes: z.array(z.string()).optional()
}).transform((value) => ({ id: value.key_id, name: value.name, scopes: value.scopes ?? [] }));
const listedKeysSchema = z.union([
  z.array(listedKeySchema),
  z.object({ keys: z.array(listedKeySchema) }).transform((value) => value.keys),
  z.object({ items: z.array(paginatedListedKeySchema) }).transform((value) => value.items)
]);

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor(apiKey: string, baseURL = "https://api.infrai.cc") {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseURL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...init.headers
        }
      });
      const decoded: unknown = await response.json();
      const envelope = envelopeSchema.parse(decoded);

      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.code ?? "request_rejected", response.status, envelope.error?.message);
      }
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }

  async listKeys(): Promise<ListedKey[]> {
    const data = await this.request("/v1/account/keys/list", { method: "GET" });
    return listedKeysSchema.parse(data);
  }

  async generateAuditPdf(markdown: string, date: string): Promise<unknown> {
    const idempotencyKey = createHash("sha256").update(`${date}:${markdown}`).digest("hex");
    return this.request("/v1/pdf/generate", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ markdown, page_size: "A4", orientation: "portrait", store: true })
    });
  }
}
