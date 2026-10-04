import test from "node:test";
import assert from "node:assert/strict";
import { auditKeyReach, decideException, shipmentReviewSchema } from "../src/logistics_audit.js";

test("a damaged shipment escalates and exposes missing key reach", () => {
  const review = shipmentReviewSchema.parse({
    shipment_id: "SHP-2048",
    events: [
      { occurred_at: "2026-09-30T08:00:00.000Z", kind: "in_transit", detail: "Arrived at destination depot" },
      { occurred_at: "2026-09-30T11:30:00.000Z", kind: "exception", detail: "Carton damage recorded" }
    ],
    proof_of_delivery: null,
    exception: { code: "damaged", note: "Hold for claims review" }
  });
  const access = auditKeyReach([
    { id: "key_01", name: "dispatch-reader", scopes: ["logistics.shipment.events.read"] }
  ]);

  assert.equal(decideException(review), "escalate");
  assert.deepEqual(access[0]?.reachable, ["logistics.shipment.events.read"]);
  assert.deepEqual(access[0]?.missing, [
    "logistics.proof_of_delivery.read",
    "logistics.exceptions.manage"
  ]);
});
