# Event Access & Org Vouchers (MVP)

## Overview
- Scans 0/2 → 2/2 via QR or substitution with QCM.
- Leads create activation links; vouchers grant seats with daily caps.
- Org caps roll up tokens/messages per day; org freeze/unfreeze daily.

## Env
- EVENT_ENABLED=true
- EVENT_QR_DYNAMIC_TTL_SECONDS=120
- EVENT_STAMP_TTL_HOURS=72
- EVENT_ACTIVATION_TTL_DAYS=14
- EVENT_DEFAULT_MAX_SEATS=5
- EVENT_MAX_SEATS_ABSOLUTE=10
- EVENT_USER_DAILY_MSG_CAP=200
- EVENT_USER_DAILY_TOKEN_CAP=100000
- EVENT_ORG_DAILY_TOKEN_CAP=1000000
- BLOCK_WEBMAILS=true
- MEILI_NO_ANALYTICS=true

## Public API
- POST /api/event/stamp { token }
- POST /api/event/lead { email, company, seats_requested, consent_* }
- POST /api/event/issue-voucher { type: personal|org, allowed_domains? }
- GET  /api/event/activation/:token
- GET  /api/event/qcm/questions
- POST /api/event/qcm/submit { answers: [{id, choice}] }

## Auth API
- POST /api/auth/redeem { voucher_id, email }
- GET  /api/user/me/usage
- GET  /api/user/me/limits

## Admin API
- POST /api/admin/event/voucher { voucher_id, update }
- POST /api/admin/event/seat/revoke { seat_id }
- POST /api/admin/event/freeze-org { voucher_id, freeze }
- POST /api/admin/event/export-leads (CSV)
- GET  /api/admin/event/analytics (funnel + usage)
- POST /api/admin/event/extend { voucher_id, extend_days?, max_seats? }
- POST /api/admin/event/issue-qr { stand: A|B }
- GET  /api/admin/event/voucher/:voucher_id

## Client Routes
- /event (landing + form)
- /event/qcm
- /event/activation/:token
- /admin/event (internal)
- /org/event (org self-service)

## Notes
- Caps enforced via middlewares and transactions.
- Model allowlist enforced in validateModel by voucher.
- LiteLLM provisioning to be added when gateway available.
