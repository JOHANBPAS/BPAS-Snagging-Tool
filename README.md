# BPAS Snagging App

A mobile-first React + TypeScript + Vite frontend powered by Firebase (Auth, Firestore, Storage) for capturing, tracking, and reporting construction snags.

## Architecture & file structure

- `src/`
  - `App.tsx` – routing + protected layout
  - `components/` – UI building blocks (layout, lists, plan viewer, uploads, reports)
  - `hooks/useAuth.tsx` – Firebase auth + profile context
  - `lib/` – Firebase client and shared helpers
  - `pages/` – Dashboard, Projects, Project detail, Settings, Auth screens
  - `types/` – shared TypeScript domain models
- `.env.example` – environment variables
- `tailwind.config.cjs` / `postcss.config.cjs` – styling

## Key features implemented

- Firebase email/password auth with profile bootstrap
- Projects CRUD with template-aware snag forms
- Snag lifecycle (open → in progress → completed → verified), quick capture, assignment, due dates, categories
- Multiple photos per snag (Firebase Storage), comment threads, activity log stub
- Floor plan upload & pin-based snag placement (normalized coordinates)
- Dashboard with project cards and status breakdown chart
- Automated PDF export (jsPDF + autotable) uploaded to Firebase Storage with public link
- Checklist templates (fields pulled into snag form)
- Mobile-first Tailwind UI with loading/error awareness

## Firebase setup

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com).
2. Enable email/password authentication in **Authentication > Sign-in method**.
3. Create Firestore database in **Firestore Database** with your desired security rules.
4. Create Cloud Storage buckets:
   - `snag-photos` – for snag photo uploads
   - `plans` – for floor plan images/PDFs
   - `reports` – for generated PDF/Word reports
5. Set all buckets to public read access or add appropriate security rules.

### Environment variables

Copy `.env.example` to `.env` and fill with your Firebase config:

```
VITE_FIREBASE_CONFIG={
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "your-messaging-id",
  "appId": "your-app-id"
}
```

## Local development

```bash
npm install
npm run dev
```

> Note: if npm registry access is restricted, install dependencies in an environment with internet access first.

The dev server runs at http://localhost:5173.

## Testing

- Run tests once (non-watch): `npm run test:run`
- Run tests in watch mode: `npm test`
- Emulator-dependent tests auto-skip if Firebase Emulator Suite is not running.

## Workflows

- **Auth**: login/register/forgot-password screens connect to Firebase Auth. User profiles are stored in Firestore with `full_name`, `email`, and `role` fields. Admin role detected via custom claims.
- **Projects**: create a project with client, address, schedule. Firestore stores projects in the `projects` collection with snags as subcollections.
- **Snags**: add snags from the list or by tapping the floor plan (auto-creates a pin-based snag with normalized x/y coordinates). Update status/assignee/due dates. Photos stored as subcollection.
- **Comments & photos**: add threaded comments and upload photos to Firebase Storage `snag-photos/` bucket. Multiple photos per snag supported.
- **Reports**: generate PDF or Word reports from the project detail page with floor plan overlays, snag annotations, and newest photos. Files upload to `reports` bucket.
- **Dashboard**: displays project counts, open/due snags, and status chart using Firestore queries.
- **Offline**: all mutations are queued in IndexedDB and synced when reconnected.

## Offline-friendly notes

- All mutations (create/update/delete) are queued in IndexedDB via `offlineStorage.ts`.
- When reconnected, mutations are synced to Firestore via `syncService.ts`.
- Photos are batched and uploaded to Firebase Storage after mutations complete.
- Offline IDs are mapped to server IDs during sync for consistency.

## Security / Firestore Rules

- Firestore security rules scope access to project owners and authenticated users. Rules are managed in the Firebase Console under **Firestore Database > Rules**.
- Never expose service account keys in the client. Only use the public Firebase config in `VITE_FIREBASE_CONFIG`.
- All data access respects Firestore rules configured in Firebase Console. Client queries auto-filter by user permissions.

## BPAS branding

- Brand primitives live in `tailwind.config.cjs` (colors + fonts) and `src/lib/brand.ts` (asset paths, contact copy). Global font imports and utility classes are defined in `src/index.css` (`font-syne`, `font-raleway`, `.btn-primary`, `.btn-secondary`, `.card`, `.section-accent`).
- Place brand assets under `public/brand/` with these filenames:
  - `logo-dark.png` (black on white), `logo-light.png` (white on dark)
  - `fingerprint.png` (used for watermarking/empty states)
  - `letterhead.png` (used in PDF/export header)
  - You can add alt variants and point `brandAssets` to them.
- Storage buckets: set `plans`, `snag-photos`, and `reports` to public read or add appropriate Firebase Storage rules for authenticated users.
- Report export (`src/components/ReportPreview.tsx`) pulls letterhead/logo/fingerprint from `/brand/...`, applies BPAS colors to headings/status chips, and includes contact details from `brand.ts`. Keep the letterhead image sized to ~40px high when drawn across the page to preserve margins.
- Buttons/components: use the provided utility classes to keep primary actions yellow on black, secondary actions grey on white, and headings in Syne with the yellow underline (`section-accent`).
- If you change palette or fonts, update both `tailwind.config.cjs` and `brand.ts` for consistency across UI and exports.
