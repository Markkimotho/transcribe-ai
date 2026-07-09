# services/billing contract

Phase 4 billing/metering seam.

- Input: transcript/job usage events with duration seconds and storage bytes.
- Output: monthly usage aggregates and plan-limit decisions.
- Stripe webhook verification is pure HMAC-SHA256 over the raw body.
- Live checkout/portal calls require Stripe credentials and are environment-dependent.
