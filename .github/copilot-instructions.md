# Copilot Instructions for BPAS Snagging Tool

Use these project-specific guidelines to work productively and safely in this repo.

## Big Picture
- React + TypeScript + Vite app, PWA-enabled via `vite-plugin-pwa`. Routing in `src/App.tsx` guarded by `AuthProvider`.
- Backend: Supabase (Auth, Postgres, Storage). Client in `src/lib/supabaseClient.ts`; typed with `src/types/supabase.ts` and domain types in `src/types/`.
- Two offline paths exist:
  - General app: IndexedDB queue in `src/services/offlineStorage.ts` with sync in `src/services/syncService.ts` (mutations + photo batching).
  - Site Mode (field capture): Local IndexedDB stores (`src/site-mode/db.ts`), a sync queue, and a periodic worker (`src/site-mode/syncWorker.ts`) that hits Supabase via `src/site-mode/api.ts`.
- Plans and reports: plan assets (PDF/image) are cached via SW; reports generated client-side with jsPDF in `src/services/reportGenerator.ts`.

## How Data Flows
- Auth: `hooks/useAuth.tsx` bootstraps profile on signup/login and exposes `user`, `profile`, and auth methods.
- Read paths: Supabase `select` queries from components/pages; PWA `workbox.runtimeCaching` caches REST and public storage calls.
- Write paths:
  - Standard UI: call Supabase directly; on offline, queue via `queueMutation()` and photos via `queuePhoto()` then let `syncMutations()` flush when back online.
  - Site Mode: create/update/delete snags by enqueueing a `SyncQueueItem` and local `SnagRecord`; the `createSyncWorker()` periodically syncs when online and then uploads pending photos.

## Conventions & Patterns
- Routing: All app routes live under a protected shell (`<Protected><Layout>…</Layout></Protected>`). Use nested `Routes` inside `Layout`.
- IDs: Some flows create client-side UUIDs for snags; mapping to server IDs is handled by sync layers. Keep IDs stable across offline/online transitions.
- Coordinates: Snag pin positions are normalized `0..1` (`plan_x/plan_y`). Respect this when adding plan interactions or exports.
- Images: Always downscale/compress before upload (see `lib/imageUtils.ts`) and store in `snag-photos` bucket. Avoid uploading raw large images.
- PDF/Exports: Use `reportGenerator.ts` helpers and brand primitives from `lib/brand.ts`. Avoid duplicating PDF drawing logic.
- Types: Prefer `src/types/index.ts` (domain) and `src/types/supabase.ts` (DB) over ad-hoc shapes. Narrow with `Database["public"]["Tables"]…` where appropriate.

## Site Mode (Preferred for new field capture)
- Local stores: `snags` and `sync_queue` via `createSiteModeRepositories()`.
- Sync worker: Start with `createSyncWorker({ queueRepo, snagRepo, api: siteModeApi, isOnline, uploadPendingPhotos… })` and let it run on an interval.
- UI: Use `PlanCanvasSkia`, `QuickCaptureSheet`, and `SyncDrawer` from `src/site-mode/components/` to place pins, capture details, and show queue state.
- When extending: add fields to `SnagRecord.metadataJson` and map to DB columns in `siteModeApi`.

## Legacy Offline Queue (still used outside Site Mode)
- Queue writes with `queueMutation(table, type, payload, offlineId?)` and photos with `queuePhoto(snagId, blob, filename)`; call `syncMutations()` on reconnect or via `useSyncEffect()`.
- `syncService.ts` maps offline IDs to real IDs and updates photo associations; reuse its helpers rather than duplicating sync logic.

## Build, Run, Deploy
- Commands:
  - `npm run dev` – start Vite on port 5173
  - `npm run build` – type-check and build PWA
  - `npm run preview` – preview build locally
- Env required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client-only keys). Do not use service role keys in the client.
- Hosting: `vercel.json` rewrites all paths to `index.html` for client routing.
- Bundling: `vite.config.ts` prebundles `pdfjs-dist` to a separate chunk and sets `GlobalWorkerOptions.workerSrc` at runtime in `reportGenerator.ts`.

## Caching & Offline
- Workbox rules:
  - `NetworkOnly` for `?report=…` URLs to bypass caches during PDF generation.
  - `CacheFirst` for public plan images from Supabase Storage.
  - `NetworkFirst` for Supabase REST (`/rest/v1`) with 7‑day TTL.
- Preloading: `services/offlineService.ts` can warm caches for projects, plans, comments, and photos.

## Guardrails
- RLS-aware: All data access assumes Supabase RLS is active; queries should include filters (`eq`, `in`, `order`) consistent with policies in `supabase/schema.sql`.
- Storage: Buckets `plans`, `snag-photos`, `reports` must be public or have appropriate storage policies. Never embed secrets.
- Performance: Avoid blocking the main thread in heavy loops (PDF/image work); prefer async/`await` and `yieldToMain` patterns used in `reportGenerator.ts`.

## Good Starting Points
- Add/modify pages: `src/pages/*` within the protected routes in `App.tsx`.
- Add a new offline mutation: extend `offlineStorage.ts` and handle mapping in `syncService.ts`.
- Extend Site Mode: adjust `site-mode/types.ts` + `site-mode/api.ts`, then update `SiteMode.tsx` UI.
