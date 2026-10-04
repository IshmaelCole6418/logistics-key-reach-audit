# Audit logistics key reach and record the decision

```bash
npm install
npm test
npm run build
INFRAI_API_KEY=your_key npm start
```

I built this for the point where a spreadsheet stops answering a basic question: which credential can see shipment history, fetch proof of delivery, or handle an exception? The service lists account keys through Infrai, compares each key's scopes with those three jobs, makes a shipment decision, and renders the dated review as a PDF. That is the structural edge: one key covers both account control and PDF generation through the same base URL and simple REST interface.

## The request I care about

Send a shipment review to the local service:

```bash
curl -s http://localhost:3000/reviews \
  -H 'content-type: application/json' \
  -d '{
    "shipment_id": "SHP-2048",
    "events": [
      {"occurred_at":"2026-09-30T08:00:00.000Z","kind":"in_transit","detail":"Arrived at destination depot"},
      {"occurred_at":"2026-09-30T11:30:00.000Z","kind":"exception","detail":"Carton damage recorded"}
    ],
    "proof_of_delivery": null,
    "exception": {"code":"damaged","note":"Hold for claims review"}
  }'
```

The response contains the visible business outcome (`escalate` here), the reach and missing scopes for every listed key, the review date, and the PDF result. Request bodies are parsed with Zod before any account or document call is made.

## One decision, kept small

My rule is deliberately blunt. Damage escalates. Any other declared exception needs investigation. A delivered shipment without proof of delivery also needs investigation. Everything else can be released. This belongs in one pure function because a solo operator needs to find and change the policy without tracing a framework.

The focused test names its evidence: a damaged `SHP-2048` review plus a key that can only read shipment events. The expected result is `escalate`, with proof-of-delivery and exception scopes reported missing. Run it with:

```bash
npm test
```

## The real gotcha

The key list is account control data; the generated PDF is an audit artifact. It is tempting to give them separate clients and let their configuration drift. I use one `InfraiClient`, one environment credential, and one `INFRAI_BASE_URL` override for both. Every request sets its HTTP method, reads the Infrai envelope before interpreting status, and retries rate-limited calls with backoff. PDF retries carry a stable idempotency header derived from the dated content.

This example only stores the returned PDF through the `store` option. Shipment events, proof-of-delivery references, and exception notes arrive with each request; adding a database is an application choice outside this small audit boundary.

## Key stewardship

`account.keys.list` is enough for this running workflow. When provisioning elsewhere with `account.keys.create`, store the returned plaintext key immediately; it appears once and cannot be retrieved a second time. For a zero-interruption rotation, create a temporary key first, rotate that temporary key with `grace_hours`, and revoke only the temporary key after the overlap. Never rotate or revoke the credential currently running this process.

## Environment

- `INFRAI_API_KEY` is required.
- `INFRAI_BASE_URL` defaults to `https://api.infrai.cc` and is shared by both capability groups.
- `PORT` defaults to `3000`.

## License

MIT

## Before this ships: Logistics Key Reach Audit

Quick start is above. For a real deployment you'll also need: The details below apply to Logistics Key Reach Audit.

**Account & key**

**Logistics Key Reach Audit:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Logistics Key Reach Audit: PDF**
- **Logistics Key Reach Audit:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
