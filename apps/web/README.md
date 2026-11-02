# Atlas web prototype

This is the Next.js App Router application for the Research Paper Discovery
& Collaboration System. Keyword search uses local MySQL. Signed-in users can
also use semantic search through MongoDB Atlas Vector Search and OpenAI embeddings.
Registration assigns the Researcher role; the protected `/admin` page allows
Admin users to create, update, and delete papers. Passwords are hashed and
sessions are signed HTTP-only cookies.

## Run locally

From this directory, create the local database and `.env.local`, then start the app:

```powershell
cd ../..
powershell -ExecutionPolicy Bypass -File database/mysql/setup-local.ps1 -Port 3306
cd apps/web
npm install
npm run dev
```

The setup script asks for the MySQL administrator password, creates the
`atlas_research` schema and a restricted `atlas_app` account, loads sample
papers, and writes app credentials to the ignored `.env.local` file. Open
`http://localhost:3000`; check `/api/health` to see whether the app can connect.
To enable semantic search, configure Atlas and embedding API variables in
`.env.local` as described in [`../../database/vector/README.md`](../../database/vector/README.md).
An Admin can index the current MySQL paper library from `/admin`; signed-in
Researchers and Admins can then select Semantic vectors on the discovery page.

After registering the account intended for administration, follow
[`../../database/mysql/AUTHORIZATION.md`](../../database/mysql/AUTHORIZATION.md)
to promote it using `promote-admin.sql`. Ordinary users cannot select or grant
themselves the Admin role.

## Remaining work

1. Configure Atlas and the embedding provider on each deployment and verify semantic retrieval.
2. Add persisted, authenticated bookmarks, collections, groups, and discussions.

The Admin paper API verifies the current role from MySQL on every request and
returns 401 to signed-out users and 403 to Researchers.
