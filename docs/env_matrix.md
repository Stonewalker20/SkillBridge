# Environment Matrix

This matrix lists the runtime variables required to deploy SkillBridge safely.

## Backend Runtime

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `APP_ENV` | yes | Runtime mode. Use `staging` or `production` outside local dev. | `production` |
| `ALLOWED_ORIGINS` | yes | Comma-separated frontend origins allowed by CORS. | `https://skillbridge.app` |
| `MONGO_URI` | yes | MongoDB connection string. Must not use localhost outside development. | `mongodb+srv://...` |
| `MONGO_DB` | yes | Database name for the target environment. | `skillbridge` |
| `PUBLIC_APP_URL` | yes | Public frontend base URL used for links and billing callbacks. | `https://skillbridge.app` |
| `PUBLIC_API_URL` | yes | Public backend base URL. | `https://api.skillbridge.app` |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | recommended | Lifetime for password reset tokens. | `60` |
| `ADMIN_OWNER_EMAILS` | recommended | Comma-separated emails that should receive owner access on registration. | `owner@example.com` |
| `ADMIN_TEAM_EMAILS` | recommended | Comma-separated emails that should receive team access on registration. | `team@example.com` |

## Billing

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | yes for live billing | Stripe API secret key. | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | yes for live billing | Verifies webhook deliveries from Stripe. | `whsec_...` |
| `STRIPE_PRICE_ID_STARTER` | yes for tiered checkout | Stripe price for Starter. | `price_...` |
| `STRIPE_PRICE_ID_PRO` | yes for tiered checkout | Stripe price for Pro. | `price_...` |
| `STRIPE_PRICE_ID_ELITE` | yes for tiered checkout | Stripe price for Elite. | `price_...` |
| `STRIPE_PRICE_ID` | optional fallback | Legacy fallback for Pro if `STRIPE_PRICE_ID_PRO` is omitted. | `price_...` |
| `STRIPE_CURRENCY` | optional | Display currency passed through billing status. | `usd` |
| `STRIPE_SUCCESS_URL` | recommended | Checkout success redirect. | `https://skillbridge.app/app/account?checkout=success` |
| `STRIPE_CANCEL_URL` | recommended | Checkout cancellation redirect. | `https://skillbridge.app/app/account?checkout=cancelled` |
| `STRIPE_BILLING_PORTAL_RETURN_URL` | recommended | Return target from the Stripe billing portal. | `https://skillbridge.app/app/account` |

## Media Storage

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `MEDIA_STORAGE_MODE` | yes | `local` for local dev only, `s3` for deploys. | `s3` |
| `MEDIA_S3_ENDPOINT_URL` | yes when `MEDIA_STORAGE_MODE=s3` | S3 or R2 endpoint URL. | `https://<account>.r2.cloudflarestorage.com` |
| `MEDIA_S3_BUCKET` | yes when `MEDIA_STORAGE_MODE=s3` | Bucket name for avatar/media assets. | `skillbridge-media` |
| `MEDIA_S3_REGION` | yes when `MEDIA_STORAGE_MODE=s3` | Bucket region. | `auto` |
| `MEDIA_S3_ACCESS_KEY_ID` | yes when `MEDIA_STORAGE_MODE=s3` | Object storage access key. | `replace-me` |
| `MEDIA_S3_SECRET_ACCESS_KEY` | yes when `MEDIA_STORAGE_MODE=s3` | Object storage secret key. | `replace-me` |
| `MEDIA_S3_PUBLIC_BASE_URL` | recommended | Public base URL for served media. | `https://media.skillbridge.app` |
| `MEDIA_S3_KEY_PREFIX` | optional | Prefix used for stored avatar objects. | `avatars` |
| `USER_AVATAR_UPLOAD_DIR` | optional | Local fallback upload directory. | `backend/data/uploads/avatars` |

## Model Selection

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | optional | Enables hosted OpenAI inference when configured. | `sk-...` |
| `OPENAI_EMBED_MODEL` | optional | Hosted embedding model. | `text-embedding-3-small` |
| `OPENAI_CHAT_MODEL` | optional | Hosted chat/rewrite model. | `gpt-4o-mini` |
| `LOCAL_EMBEDDING_MODEL` | optional | Local embeddings model. | `sentence-transformers/all-MiniLM-L6-v2` |
| `LOCAL_ZERO_SHOT_MODEL` | optional | Local zero-shot skill filter model. | `MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33` |
| `LOCAL_REWRITE_MODEL` | optional | Local rewrite model. | `google/flan-t5-small` |
| `LOCAL_MODEL_DEVICE` | optional | `-1` for CPU, GPU index otherwise. | `-1` |
| `LOCAL_MODEL_PREWARM` | optional | Whether to load local models at startup. | `true` |

## Frontend Runtime

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `VITE_API_BASE` | yes outside local dev | Public API base URL for the deployed frontend. | `https://api.skillbridge.app` |

## Notes

- `frontend/.env.staging.example` and `frontend/.env.production.example` cover the public frontend runtime.
- `backend/.env.staging.example` and `backend/.env.production.example` cover the backend runtime.
- Password reset is implemented in-app, but real customer email delivery still requires an outbound email provider and sender configuration outside this repo.
