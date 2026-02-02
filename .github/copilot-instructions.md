# Copilot Instructions for BPAS Snagging Tool

Use these project-specific guidelines to work productively and safely in this repo.

## Big Picture
- React + TypeScript + Vite app, PWA-enabled via `vite-plugin-pwa`. Routing in `src/App.tsx` guarded by `AuthProvider`.
- Backend: Firebase (Auth, Firestore, Cloud Storage). Client in `src/lib/firebase.ts`; typed with `src/types/index.ts` for domain types.
- Offline: IndexedDB queue in `src/services/offlineStorage.ts` with sync in `src/services/syncService.ts` (mutations + photo batching).
- Plans and reports: plan assets (PDF/image) are cached via SW; reports generated client-side with jsPDF in `src/services/reportGenerator.ts`.

## How Data Flows
- Auth: `hooks/useAuth.tsx` bootstraps profile on signup/login via Firebase Auth, custom claims detect admin role, exposes `user`, `profile`, and auth methods.
- Read paths: Firestore `getDocs`/`query` from `services/dataService.ts` via components/pages; PWA `workbox.runtimeCaching` caches REST and public storage calls.
- Write paths:
  - Standard UI: call Firestore directly; on offline, queue via `queueMutation()` and photos via `queuePhoto()` then let `syncMutations()` flush when back online.
  - Reports: Generated client-side with jsPDF (PDF) and docx library (Word), including floor plan overlays and snag annotations.

## Conventions & Patterns
- Routing: All app routes live under a protected shell (`<Protected><Layout>…</Layout></Protected>`). Use nested `Routes` inside `Layout`.
- IDs: Firestore auto-generates UUIDs for documents. Keep IDs stable across offline/online transitions via sync layer.
- Coordinates: Snag pin positions are normalized `0..1` (`plan_x/plan_y`). Respect this when adding plan interactions or exports.
- Images: Always downscale/compress before upload (see `lib/imageUtils.ts`) and store in Firebase Storage `snag-photos` folder. Avoid uploading raw large images.
- PDF/Word Exports: Use `reportGenerator.ts` helpers and brand primitives from `lib/brand.ts`. Avoid duplicating drawing logic. Photos sorted newest-first from Firebase Storage.
- Types: Prefer `src/types/index.ts` (domain) over ad-hoc shapes. Reference Firestore schema types for collection queries.

## Firebase Architecture
- **Auth**: Email/password with Firebase Auth, profiles stored in Firestore `profiles` collection, admin role via custom claims.
- **Database**: Firestore collections: `projects`, `snags` (subcollection), `photos` (subcollection), `comments` (subcollection), `plans` (subcollection), `reports`, `invites`, `profiles`.
- **Storage**: Firebase Cloud Storage buckets: `snag-photos/`, `plans/`, `reports/`. All publicly accessible with appropriate CORS.
- **Functions**: Cloud Functions for admin operations and background tasks in `functions/src/index.ts`.

## Build, Run, Deploy
- Commands:
  - `npm run dev` – start Vite on port 5173
  - `npm run build` – type-check and build PWA
  - `npm run preview` – preview build locally
  - `npm run test` – run Vitest unit/integration tests with Firebase Emulator
- Env required: `VITE_FIREBASE_CONFIG` (client-side Firebase config). Never include service account keys.
- Hosting: `vercel.json` rewrites all paths to `index.html` for client routing.
- Bundling: `vite.config.ts` prebundles `pdfjs-dist` to a separate chunk and sets `GlobalWorkerOptions.workerSrc` at runtime in `reportGenerator.ts`.

## Caching & Offline
- Workbox rules:
  - `NetworkOnly` for `?report=…` URLs to bypass caches during PDF generation.
  - `CacheFirst` for public plan images from Firebase Storage.
  - `NetworkFirst` for Firestore REST with 7‑day TTL.
- Offline Sync: `offlineStorage.ts` queues mutations; `syncService.ts` flushes on reconnect, mapping offline IDs to server IDs.

## Guardrails
- Firebase Security: All data access respects Firestore rules configured in Firebase Console. Client queries auto-filter by user permissions.
- Storage: Buckets must have public read policies or user-specific rules. Never embed service account keys in client.
- Performance: Avoid blocking the main thread in heavy loops (PDF/image work); prefer async/`await` and `yieldToMain` patterns used in `reportGenerator.ts`.

## Good Starting Points
- Add/modify pages: `src/pages/*` within the protected routes in `App.tsx`.
- Add new Firestore queries: extend `services/dataService.ts` with new query functions.
- Extend report generation: modify `services/reportGenerator.ts` with new sections or styling.
