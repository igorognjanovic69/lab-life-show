# LabLifeHub

Website for Dr. Nevena Jeremic - static site (HTML, Tailwind, DaisyUI) deployed on Vercel.

## Forms

The booking, contact, and testimonial moderation forms use Vercel Serverless
Functions and Resend. They always send to `nevenajeremic@lablifehub.com`.
Configure this environment variable in Vercel:

- `RESEND_API_KEY`

Optional overrides:

- `BOOKING_FROM_EMAIL` - defaults to `LabLifeHub <nevenajeremic@lablifehub.com>` and must be a verified sender/domain in Resend
- `BOOKING_ACTION_SECRET` - optional HMAC secret for secure Accept / Propose / Decline booking links
- `BOOKING_TIME_ZONE` - defaults to `Europe/Belgrade`
- `BOOKING_DEFAULT_TIME` - defaults to `10:00`

Booking notification emails include secure action links:

- Accept - sends a confirmation email with an `.ics` invite and creates a Google Calendar event when Google Calendar is connected
- Propose new date & time - sends an alternative slot to the requester
- Decline - sends a polite decline/update email

To enable direct Google Calendar insertion, connect OAuth for the calendar
account and configure:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID` - optional, defaults to `primary`
- `GOOGLE_CALENDAR_EMAIL` - optional dashboard label, defaults to `lablifehub@gmail.com`

## Admin

The private admin page is available at `/admin/`, is not linked publicly, and is
excluded from indexing. Configure these Vercel environment variables:

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET` - optional; otherwise the app reuses `BOOKING_ACTION_SECRET` or `RESEND_API_KEY`

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

## SEO and AI discovery

The final canonical domain is `https://lablifehub.com`.

Prepared discovery files:

- `/robots.txt`
- `/sitemap.xml`
- `/llms.txt`

After the domain is connected in Vercel and DNS is propagated, submit
`https://lablifehub.com/sitemap.xml` in Google Search Console.
