# LabLifeHub

Website for Dr. Nevena Jeremic — static site (HTML, Tailwind, DaisyUI) deployed on Vercel.

## Forms

The booking, contact, and testimonial moderation forms use Vercel Serverless
Functions and Resend. Configure these environment variables in Vercel:

- `RESEND_API_KEY`
- `BOOKING_TO_EMAIL`
- `BOOKING_FROM_EMAIL`

Testimonials are sent for manual approval and are never published automatically.
