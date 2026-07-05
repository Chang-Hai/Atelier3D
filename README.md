# Vision3D AI Generator

Single-page MVP for the `image to 3d model` hackathon keyword.

## Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy on Vercel

Import this folder into Vercel or run:

```bash
vercel
```

Set this environment variable when the Meshy API key is available:

```bash
MESHY_API_KEY=your_meshy_key
```

Google sign-in is required for generation, preprocessing, and task status APIs:

```bash
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
AUTH_SECRET=generate_a_long_random_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

For production, set `GOOGLE_REDIRECT_URI` to `https://your-domain.com/api/auth/callback` and add the same URL to the Google OAuth client's authorized redirect URIs.

Optional:

```bash
MESHY_BASE_URL=https://api.meshy.ai/openapi/v1
MESHY_AI_MODEL=meshy-5
MESHY_TOPOLOGY=triangle
MESHY_TARGET_POLYCOUNT=30000
MESHY_SHOULD_REMESH=true
MESHY_SHOULD_TEXTURE=true
MESHY_ENABLE_PBR=true
FREE_DAILY_LIMIT=10
TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
ARK_API_KEY=your_volcengine_ark_key
ARK_IMAGE_MODEL=doubao-seedream-5-0-260128
```

Without `MESHY_API_KEY`, the page falls back to a local demo 3D preview so the front end remains usable for review and presentation.
