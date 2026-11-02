# Atlas roles and authorization

Atlas uses two database-backed application roles:

| Role | Access |
|---|---|
| Researcher | Search and filter the paper library; no paper-management access. |
| Admin | Researcher access plus permission to create, update, and delete paper records. |

Public registration always assigns `Researcher`. The selected role is never accepted from a browser request. The API reads the signed-in user's current role from MySQL on each request; `/api/admin/papers` returns HTTP 401 for signed-out requests and HTTP 403 for non-admin users. Password hashes use scrypt, and sessions use signed HTTP-only cookies.

## Create the first administrator

1. Run `database/mysql/setup-local.ps1` so both role rows exist.
2. Register the account that will be the administrator at `/login`.
3. Open `promote-admin.sql`, replace `replace-with-the-registered-admin-email` with that account's exact email, and run it as a MySQL administrator against `atlas_research`.
4. Sign out and sign back in. The current role is loaded from MySQL; the admin session will open `/admin`.
5. Confirm a Researcher account receives `403` from `GET /api/admin/papers`, while the Admin account can add, edit, and delete paper records from `/admin`.

Do not add an Admin option to public registration. Promotion is an administrator-controlled database operation.
