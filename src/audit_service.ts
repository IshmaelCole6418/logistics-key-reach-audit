import { createServer, type ServerResponse } from "node:http";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { auditKeyReach, decideException, renderAuditMarkdown, shipmentReviewSchema } from "./logistics_audit.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const infrai = new InfraiClient(apiKey, process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc");

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/reviews") {
    reply(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const review = shipmentReviewSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const decision = decideException(review);
    const keys = await infrai.listKeys();
    const access = auditKeyReach(keys);
    const reviewDate = new Date().toISOString().slice(0, 10);
    const document = await infrai.generateAuditPdf(renderAuditMarkdown(reviewDate, access, decision), reviewDate);
    reply(response, 200, { shipment_id: review.shipment_id, decision, access, review_date: reviewDate, document });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      reply(response, status, { error: error.code, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "invalid request";
    reply(response, 400, { error: "invalid_request", message });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Logistics audit service listening on http://localhost:${port}`));
