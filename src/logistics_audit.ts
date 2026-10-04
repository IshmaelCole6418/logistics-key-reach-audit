import { z } from "zod";

export const shipmentReviewSchema = z.object({
  shipment_id: z.string().min(1),
  events: z.array(z.object({
    occurred_at: z.string().datetime(),
    kind: z.enum(["picked_up", "in_transit", "out_for_delivery", "delivered", "exception"]),
    detail: z.string().min(1)
  })).min(1),
  proof_of_delivery: z.object({
    object_ref: z.string().min(1),
    signed_by: z.string().min(1),
    captured_at: z.string().datetime()
  }).nullable(),
  exception: z.object({
    code: z.enum(["address_mismatch", "damaged", "recipient_unavailable"]),
    note: z.string().min(1)
  }).nullable()
});

export type ShipmentReview = z.infer<typeof shipmentReviewSchema>;
export type ExceptionDecision = "release" | "investigate" | "escalate";

export function decideException(review: ShipmentReview): ExceptionDecision {
  const delivered = review.events.some((event) => event.kind === "delivered");
  if (review.exception?.code === "damaged") return "escalate";
  if (review.exception || (delivered && !review.proof_of_delivery)) return "investigate";
  return "release";
}

export const requiredLogisticsScopes = [
  "logistics.shipment.events.read",
  "logistics.proof_of_delivery.read",
  "logistics.exceptions.manage"
] as const;

export type ListedKey = { id: string; name: string; scopes: string[] };

export function auditKeyReach(keys: ListedKey[]) {
  return keys.map((key) => {
    const reachable = requiredLogisticsScopes.filter((scope) => key.scopes.includes(scope));
    const missing = requiredLogisticsScopes.filter((scope) => !key.scopes.includes(scope));
    return { id: key.id, name: key.name, reachable, missing };
  });
}

export function renderAuditMarkdown(date: string, audit: ReturnType<typeof auditKeyReach>, decision: ExceptionDecision) {
  const rows = audit.map((key) =>
    `| ${key.name} | ${key.reachable.join(", ") || "none"} | ${key.missing.join(", ") || "none"} |`
  ).join("\n");
  return `# Logistics access review — ${date}\n\n` +
    `Shipment decision: **${decision}**\n\n` +
    `| Key | Can reach | Missing |\n| --- | --- | --- |\n${rows}\n`;
}
