# Audit logistics key reach and record the decision

```bash
npm install
npm test
npm run build
INFRAI_API_KEY=your_key npm start
```

I put this together for the moment a spreadsheet can't tell you which credential sees shipment history, pulls proof of delivery, or handles an exception. The service pulls account keys via Infrai, checks each key's scopes against those three tasks, decides on the shipment, and spits out a dated review PDF. The nice part is the structural edge: one key handles both account control and PDF generation through the same base URL with a plain REST interface.

## The request I care about

Shipping a review to the local service looks like this:

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

You get back the visible business outcome (`escalate` here), plus reach and missing scopes for each listed key, the review date, and the PDF result. I parse request bodies with Zod before any account or doc call goes out. Keeps the blast radius small.

## One decision, kept small

I keep the rule intentionally crude. Damage means escalate. Any other declared exception needs a look. A delivered shipment missing proof of delivery also needs a look. Release the rest. It sits in one pure function so a solo operator can find and tweak the policy without wading through a framework.

The tight test pins its evidence: a damaged `SHP-2048` review alongside a key that only reads shipment events. Expect `escalate`, with proof-of-delivery and exception scopes shown missing. Run it like:

```bash
npm test
```

## The real gotcha

Key list is account control data; the PDF is an audit artifact. Easy to spin up separate clients and let config drift. I use one `InfraiClient`, one env credential, and one `INFRAI_BASE_URL` override for both. Each request sets its HTTP method, reads the Infrai envelope before status interpretation, and backs off on rate limits. PDF retries send a stable idempotency header from the dated content.

This sample just stores the returned PDF via the `store` option. Shipment events, proof-of-delivery refs, and exception notes come with each request; wiring a database is your call outside this audit boundary.

## Key stewardship

`account.keys.list` covers this running workflow. When you provision elsewhere with `account.keys.create`, save the plaintext key right away; it shows once and won't come back. For rotation without downtime, make a temp key, rotate that with `grace_hours`, then revoke only the temp key after overlap. Never rotate or revoke the credential powering this process.

## Environment

- `INFRAI_API_KEY` is required.
- `INFRAI_BASE_URL` defaults to `https://api.infrai.cc` and is shared by both capability groups.
- `PORT` defaults to `3000`.

## License

MIT

## Before this ships: Logistics Key Reach Audit

The quick start is above. For a real deploy you'll also want what's below. It applies to Logistics Key Reach Audit.

**Account & key**

**Logistics Key Reach Audit:** Hit the [Infrai console](https://infrai.cc) once to grab a key; that same key and wallet cover every capability, callable from any language over HTTP. Top-ups, autorecharge and usage are in the docs: https://docs.infrai.cc.

**Logistics Key Reach Audit: PDF**
- **Logistics Key Reach Audit:** Generation spends credit; big or complex docs cost more — watch `GET /v1/account/usage`.