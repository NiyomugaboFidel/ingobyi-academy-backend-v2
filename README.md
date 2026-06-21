# Ingobyi Academy — Backend API

NestJS 10 + Prisma 5 + PostgreSQL 16 multi-tenant learning platform API.

## Stack

- **Runtime:** Node.js 20+
- **Framework:** NestJS 10 (TypeScript, strict)
- **ORM:** Prisma 5
- **Database:** PostgreSQL 16
- **Auth:** JWT + httpOnly refresh cookies
- **Docs:** Swagger at `/api/docs`

## Quick Start

```bash
# 1. Copy environment
cp .env.example .env

# 2. Configure PostgreSQL in .env (DATABASE_URL)

# 3. Install dependencies
npm install

# 4. Generate Prisma client & run migrations
npm run prisma:generate
npm run prisma:migrate

# 5. Start dev server
npm run start:dev
```

API: `https://ingobyi-academy-backend-v2-production.up.railway.app/api`  
Swagger: `https://ingobyi-academy-backend-v2-production.up.railway.app/api/docs`  
Route index: `https://ingobyi-academy-backend-v2-production.up.railway.app/api/routes`  
Health: `https://ingobyi-academy-backend-v2-production.up.railway.app/api/health`  
Frontend: `https://ingobyi-academy-frontend-v2.vercel.app`

## Testing

```bash
make setup          # install + migrate + seed
make dev            # start dev server
make test-e2e       # run 12 e2e tests
make full-test      # build + e2e
make routes         # print endpoint index
make docs           # print doc URLs
```

### Postman

Import these files from `postman/`:
- `Ingobyi-Academy-API.postman_collection.json`
- `Ingobyi-Academy-Environment.postman_environment.json`

Run **Login (Superadmin)** first — it auto-saves the JWT token.

### Seed test accounts

After `npm run prisma:seed`, use password `password123` for all:

| Role | Email |
|------|-------|
| Superadmin | `fidelniyomugabo67@gmail.com` |
| Admin | `cyubahirorichard250@gmail.com` |
| Student | `holly.worshiptv@gmail.com` |
| Parent | `nfidele290@gmail.com` (linked to Holly) |

## Project Structure

```
prisma/          # Schema, migrations, seed
src/
  config/        # Zod-validated env config
  common/        # Guards, decorators, filters, interceptors
  prisma/        # PrismaService
  modules/       # Feature modules (Phase 2+)
  shared/        # Email, Cloudinary (Phase 2+)
```

## Brand Colors

- Primary: `#013537`
- Accent: `#8CE66B`
- CTA: `#FFCC00`

## Multi-tenant workspaces

Ingobyi Academy is a **multi-tenant platform**: each school/organization is an isolated workspace.

### Concepts

| Concept | Model | Notes |
|---------|-------|-------|
| Platform operator | `User.platformRole = SUPERADMIN` | Sees all tenants |
| Organization | `Organization` | School, training center, etc. |
| Membership | `Membership` | User ↔ org with per-org `role` |
| Active workspace | JWT `orgId` + `orgRole` | Switched without re-login |
| Tenant content | `Course.visibility` | `PUBLIC_GLOBAL` or `ORG_PRIVATE` |

### Auth flow

1. **Login** — picks the most recent active membership (non-superadmin).
2. **JWT payload** — `{ sub, role, orgId, orgRole, rv }` where `role` is platform role.
3. **Switch workspace** — `POST /api/auth/switch-org` with `{ "organizationId": "..." }` mints a new access token.
4. **Refresh** — re-issues token with default (most recent) workspace; call `switch-org` again if needed.

### Key endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/me` | Current user + `activeOrgId`, `activeOrgRole` |
| POST | `/api/auth/switch-org` | Change active workspace |
| GET | `/api/organizations/me` | All memberships (workspace picker UI) |
| POST | `/api/organizations/bootstrap` | Create org (creator becomes admin) |
| GET | `/api/organizations/directory` | Public org directory |

### RBAC

Default permissions are seeded into `Permission` + `RolePermission` on startup. Each new org gets a copy in `OrgPermission` (per-org overrides). Course creation requires `courses.create` via `PermissionsGuard`.

### Backfill existing data

```bash
npm run prisma:backfill-org
```

Assigns orphan courses and users without memberships to the default `ingobyi-platform` organization.

### Multi-org test account

`admin@ingobyi.com` is **Admin** in Kigali Tech School and **Student** in Rwanda Training Center — use for workspace-switch testing.

### Self-registration & onboarding

1. User registers at `/login` → verifies email via OTP.
2. Users **without an organization** are sent to `/onboarding`.
3. On onboarding they can:
   - **Request to join** an org with a role (`STUDENT`, `TRAINER`, `PARENT`) — `POST /api/organizations/join-requests`
   - **Create their own org** — `POST /api/organizations/bootstrap`
4. Admins approve requests at `/admin/join-requests` (role shown on each request).
5. Admins can also **add existing users directly** — `POST /api/organizations/:id/members` or email invite.

Track pending requests: `GET /api/organizations/my-join-requests`

## Development Phases

- **Phase 1** ✅ Prisma schema + NestJS scaffold
- **Phase 2** ✅ Auth, users, orgs, courses modules
- **Phase 3** ✅ Socket.io gateway
- **Phase 4** ✅ Guards & RBAC enforcement
- **Phase 5** ✅ Infrastructure
- **Phase 6** ✅ Seed data + multi-tenant tests
