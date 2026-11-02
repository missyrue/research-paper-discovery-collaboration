# Atlas web prototype

This is the first Next.js App Router interface for the Research Paper Discovery
& Collaboration System. It provides a responsive discovery screen, topic
filters, local save interactions, sample paper cards, and a sign-in screen.

## Run locally

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. This prototype uses sample papers in
`app/page.tsx`; the search field and filters do not call PostgreSQL or MongoDB
yet. The sign-in screen is a visual flow only and does not authenticate users.

## Next integration work

1. Configure PostgreSQL and apply `database/sql/schema.sql`.
2. Choose the authentication and session approach, then connect sign-up and
   sign-in to the `users` and `roles` tables. Store only password hashes.
3. Connect paper records to PostgreSQL and semantic retrieval to Atlas Vector
   Search, then replace the sample cards and local filters.
4. Add collections, group collaboration, and discussions after account access
   is in place.

The current Next.js App Router structure and recommended authentication
patterns are documented in the [Next.js App Router docs](https://nextjs.org/docs/app)
and [authentication guide](https://nextjs.org/docs/app/guides/authentication).
