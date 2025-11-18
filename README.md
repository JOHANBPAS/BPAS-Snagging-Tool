# BPAS Snagging App

A mobile-first React + TypeScript + Vite frontend powered by Supabase (PostgreSQL, Auth, Storage) for capturing, tracking, and reporting construction snags.

## Architecture & file structure

- `src/`
  - `App.tsx` – routing + protected layout
  - `components/` – UI building blocks (layout, lists, plan viewer, uploads, reports)
  - `hooks/useAuth.tsx` – Supabase auth + profile context
  - `lib/` – Supabase client and generated database types
  - `pages/` – Dashboard, Projects, Project detail, Settings, Auth screens
  - `types/` – shared TypeScript domain models
- `supabase/schema.sql` – database tables + RLS policies
- `.env.example` – environment variables
- `tailwind.config.cjs` / `postcss.config.cjs` – styling

## Key features implemented

- Supabase email/password auth with profile bootstrap
- Projects CRUD with template-aware snag forms
- Snag lifecycle (open → in progress → completed → verified), quick capture, assignment, due dates, categories
- Multiple photos per snag (Supabase Storage), comment threads, activity log stub
- Floor plan upload & pin-based snag placement (normalized coordinates)
- Dashboard with project cards and status breakdown chart
- Automated PDF export (jsPDF + autotable) uploaded to Supabase Storage with public link
- Checklist templates (fields pulled into snag form)
- Mobile-first Tailwind UI with loading/error awareness

## Supabase setup

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` via the SQL editor or CLI:
   ```sql
   -- copy contents of supabase/schema.sql
   ```
3. Create Storage buckets: `plans`, `snag-photos`, `reports`.
4. Enable email/password auth in Supabase Auth settings.

### Environment variables

Copy `.env.example` to `.env` and fill with your project values:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Local development

1. Install dependencies

   ```bash
   npm install
   ```

   > If your environment blocks registry access, install on a network with internet access, or mirror the npm registry locally.

2. Create your `.env` from `.env.example` and supply your Supabase project URL and anon key.

3. Start the dev server

   ```bash
   npm run dev
   ```

   Vite will serve the app at http://localhost:5173. All Supabase calls point to the project specified by your env vars.

4. (Optional) Type-check and build the production bundle

   ```bash
   npm run build
   npm run preview # serve the built bundle locally
   ```

5. (Optional) Lint placeholder is available for custom rules; replace the script in `package.json` with your preferred lint tool.

## Workflows

- **Auth**: login/register/forgot-password screens connect to Supabase auth. Profiles table stores `full_name` and `role`.
- **Projects**: create a project with client, address, schedule. Select a checklist template via DB column `checklist_template_id` if desired.
- **Snags**: add snags from the list or by tapping the floor plan (auto-creates a pin-based snag). Update status/assignee/dates.
- **Comments & photos**: add threaded comments and upload photos to Storage buckets.
- **Reports**: generate a PDF from the project detail page; file uploads to the `reports` bucket and returns a shareable link.
- **Dashboard**: displays project counts, open/due snags, and status chart.

## Offline-friendly notes

- Forms hold local state until submission; errors are surfaced inline.
- Architecture is ready for caching/offline plugins (e.g., add SW/IndexedDB later).

## Security / RLS

- Policies in `supabase/schema.sql` scope access to project owners and authenticated users; adjust for your org rules (e.g., per-tenant filters).
- Avoid exposing the service role key on the client; only use the anon key in `.env`.
