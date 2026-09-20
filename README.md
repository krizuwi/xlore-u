# Xlore U Frontend

React/Vite frontend for the Xlore U school-matching platform. It connects to the Express/PostgreSQL backend in the adjacent `xlore-u-backend` folder.

## Run both applications in VS Code

### Terminal 1 - backend

```powershell
Set-Location "C:\Users\crisz\Documents\Codex\2026-09-17\mak\outputs\xlore-u-backend"
npm run dev
```
For downloading it for the first time:
git clone -b frontend https://github.com/krizuwi/xlore-u.git xlore-u-frontend

for github push: 
cd "YOUR PATH FILE"
git push -u origin frontend

for github pull:
cd "YOUR PATH FILE"
git switch frontend
git pull origin frontend


Confirm [http://localhost:4001/api/health](http://localhost:4001/api/health) reports `"database":"connected"`.

### Terminal 2 - frontend

```powershell
Set-Location "C:\Users\crisz\Documents\Codex\2026-09-17\mak\outputs\xlore-u-frontend"
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Included pages

- Responsive landing page
- Dark mode by default with a persistent light/dark theme toggle
- Account registration, development verification, resend code, and login
- School directory with keyword, city, type, strand, tuition, and sorting controls
- School details with programs, tuition, scholarships, accreditation, and map link
- Searchable Google Maps page with pinned institution locations
- Program directory with search, category filtering, requirements, and careers
- Five-step profile assessment and recommendation results
- Saved schools and programs
- Three-school comparison with per-school program and tuition comparison
- Personalized dashboard and assessment history
- Automatic access-token refresh and protected routes

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start on `http://localhost:5173` |
| `npm run build` | Create the production build |
| `npm run preview` | Preview the production build |
| `npm run check` | Run ESLint |

## Configuration

The included frontend `.env` contains only:

```env
VITE_API_URL=http://localhost:4001/api
```

Never put `DATABASE_URL`, a database password, or JWT signing secrets in the frontend environment.

## Adding school logos

Place each logo in `public/school-logos` as a PNG named with the school's database ID. For example:

```text
public/school-logos/40000000-0000-4000-8000-000000000001.png
```

The map automatically uses the matching image. Until a logo is added, it displays `placeholder.svg`.
