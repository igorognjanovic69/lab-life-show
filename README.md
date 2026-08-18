# LabLifeHub

Website for Dr. Nevena Jeremic - static site (HTML, Tailwind, DaisyUI) deployed on Vercel.

## Forms

The booking, contact, and testimonial moderation forms use Vercel Serverless
Functions and Resend. They always send to `nevenajeremic@lablifehub.com`.
Configure this environment variable in Vercel:

- `RESEND_API_KEY`

Optional overrides:

- `BOOKING_FROM_EMAIL` - defaults to `LabLifeHub <nevenajeremic@lablifehub.com>` and must be a verified sender/domain in Resend

Testimonials are sent for manual approval and are never published automatically.

## Instagram feed

The Instagram section loads recent posts through `/api/instagram`.

For a reliable automatic feed, set one of these Vercel environment variables to
an official Meta/Instagram access token:

- `IG_ACCESS_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN`

Without a token, the endpoint tries Instagram's public web profile endpoint as a
best-effort fallback. If Instagram rate-limits Vercel, the site still shows the
local curated fallback images from the first LabLifeHub post.

## YouTube podcast feed

The podcast sections load recent LabLifePodcast videos through `/api/episodes`.
The endpoint uses YouTube's public RSS feed, so new videos appear automatically
without a YouTube API key.

Optional Vercel environment variables:

- `YOUTUBE_CHANNEL_ID` or `YT_CHANNEL_ID`
- `YOUTUBE_HANDLE` or `YT_HANDLE`
