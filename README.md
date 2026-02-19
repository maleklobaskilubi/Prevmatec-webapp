# Prevmatec – Evidencia inštalácií robotov

Webová aplikácia pre evidenciu inštalácií robotov na Slovensku. Mapa, prihlásenie, tímová spolupráca, remindere, poznámky, návštevy.

## Tech stack

| Vrstva | Technológia |
|--------|-------------|
| Frontend | Vite + React + TypeScript + TailwindCSS |
| API | Cloudflare Pages Functions + Hono |
| DB | Neon Postgres (free tier) + Drizzle ORM |
| Auth | Email/PBKDF2 + Google OAuth2 + DB sessions |
| Mapa | MapLibre GL JS + OSM dlaždice (free) |
| Hosting | Cloudflare Pages (free tier) |

---

## Rýchly štart (lokálny vývoj)

### 1. Klonovanie a inštalácia závislostí

```bash
git clone https://github.com/YOUR-ORG/prevmatec-webapp.git
cd prevmatec-webapp
npm install
```

### 2. Environment premenné

```bash
cp .dev.vars.example .dev.vars
```

Uprav `.dev.vars` – **nikdy ho necommituj do gitu**:

```ini
NEON_DATABASE_URL=postgres://user:password@ep-xxx.neon.tech/neondb?sslmode=require
SESSION_SECRET=min-32-nahodnych-znakov-napr-openssl-rand-hex-32
INVITE_CODE=prevmatec2026
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
APP_ORIGIN=http://localhost:8788
```

### 3. Databáza – migrácie

#### Možnosť A – priamy SQL (odporúčané pri prvom setupi)

Otvor Neon SQL editor a spusti obsah `db/migrations/0000_initial.sql`.

#### Možnosť B – Drizzle migrate

```bash
npm run db:generate   # vygeneruje migrácie z db/schema.ts
npm run db:migrate    # aplikuje migrácie na Neon DB
```

### 4. Spustenie vývojového servera

```bash
npm run dev
```

Aplikácia beží na **http://localhost:8788**

---

## Nasadenie na Cloudflare Pages

### 1. GitHub → Cloudflare Pages

- Pushni kód na GitHub
- Cloudflare Dashboard → Pages → **Create project** → Connect to Git

### 2. Build nastavenia

| Pole | Hodnota |
|------|---------|
| Framework preset | None |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | 20 |

### 3. Environment premenné (Cloudflare Dashboard → Settings → Environment variables)

```
NEON_DATABASE_URL     = postgres://...
SESSION_SECRET        = (openssl rand -hex 32)
INVITE_CODE           = tvoj-tajny-kod
GOOGLE_CLIENT_ID      = xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET  = GOCSPX-xxx
APP_ORIGIN            = https://tvoja-app.pages.dev
```

---

## Google OAuth – nastavenie

1. [Google Cloud Console](https://console.cloud.google.com/) → nový projekt
2. APIs & Services → OAuth consent screen → External
3. APIs & Services → Credentials → **Create OAuth client ID** → Web application
4. Authorized redirect URIs:
   - `http://localhost:8788/api/auth/google/callback`
   - `https://tvoja-app.pages.dev/api/auth/google/callback`
5. Skopíruj Client ID + Secret do env premenných

---

## Štruktúra projektu

```
prevmatec-webapp/
├── src/                     # Frontend (Vite + React)
│   ├── components/          # MapView, Layout, AddInstallationModal
│   ├── ctx/                 # AuthContext
│   ├── lib/                 # api.ts, queryClient.ts
│   └── pages/               # Login, Invite, Map, Detail, Profile
├── functions/api/           # Cloudflare Pages Functions (Hono API)
│   ├── [[route]].ts         # Hlavný Hono app
│   ├── lib/                 # crypto.ts, session.ts
│   └── routes/              # auth, robots, installations, geocode, reminders
├── shared/                  # Zdieľané typy + Zod schémy
├── db/                      # Drizzle schema + migrácie
├── tests/                   # Vitest testy
└── public/                  # PWA manifest, favicon
```

---

## Lokálne testovanie

```bash
npm run test        # Vitest
npm run typecheck   # TypeScript check
```

---

## API prehľad

**Auth:** POST `/api/auth/register` · `/api/auth/login` · `/api/auth/logout` | GET `/api/me` · `/api/auth/google/start` · `/api/auth/google/callback` | POST `/api/auth/google/complete`

**Inštalácie:** GET/POST `/api/installations` · GET/PATCH `/api/installations/:id` · POST `/api/installations/:id/members` · GET/POST `/api/installations/:id/notes|visits|reminders`

**Ostatné:** GET `/api/geocode?q=` · `/api/reverse?lat=&lon=` | GET/POST `/api/robots` | PATCH `/api/reminders/:id`

---

## Pridanie nových používateľov

Zdieľaj `INVITE_CODE` s novými členmi tímu. Na zmenu kódu uprav env premennú v Cloudflare a redeploy.
