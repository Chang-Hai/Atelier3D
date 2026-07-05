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

Set this environment variable when the Tripo API key is available:

```bash
TRIPO_API_KEY=your_tripo_key
```

Optional:

```bash
TRIPO_MODEL=tripo-p1
TRIPO_BASE_URL=https://openapi.tripo3d.ai/v3
TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
ARK_API_KEY=your_volcengine_ark_key
ARK_IMAGE_MODEL=doubao-seedream-5-0-260128
```

Without `TRIPO_API_KEY`, the page falls back to a local demo 3D preview so the front end remains usable for review and presentation.
