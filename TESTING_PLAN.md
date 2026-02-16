# Testing Plan

## 1. Introduction
This document outlines the testing strategy for the BPAS Snagging Tool. It covers current manual testing procedures to ensure the application's stability and correctness, and proposes a roadmap for implementing automated tests.

**Scope:**
- Authentication & User Profile
- Project Management
- Snagging Workflow (Creation, Management, Floor Plans)
- Report Generation (PDF/Word) - *Critical Path*
- Deployment & Security

---

## 2. Test Environment

### Local Development
- **URL:** `http://localhost:5173`
- **Database:** Firebase Emulator Suite or a linked development Firebase project.
- **Browser:** Latest Chrome/Edge (primary), Firefox/Safari (secondary).

### Staging (Recommended)
- **URL:** [https://bpas-snagging-tool.vercel.app](https://bpas-snagging-tool.vercel.app)
- **Database:** Dedicated Staging Firebase project (separate from Production).
- **Purpose:** Final verification before production deployment, sharing with stakeholders.

---

## 3. Manual Test Cases

### 3.1. Authentication & Profile
| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|:----------------|:---------|
| A-01 | Sign Up | 1. Go to Register.<br>2. Enter valid email/password.<br>3. Submit. | Account created, redirected to Dashboard. | High |
| A-02 | Login | 1. Go to Login.<br>2. Enter valid credentials.<br>3. Submit. | Logged in successfully. | CRITICAL |
| A-03 | Forgot Password | 1. Click "Forgot Password".<br>2. Enter email. | Password reset email sent. | Medium |
| A-04 | Profile Update | 1. Go to Settings.<br>2. Update Name/Title.<br>3. Save. | Profile updated, values persist on reload. | Medium |
| A-05 | Logout | 1. Click Logout. | Redirected to Login, session cleared. | High |

### 3.2. Projects
| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|:----------------|:---------|
| P-01 | Create Project | 1. Click "New Project".<br>2. Fill details (Client, Address).<br>3. Save. | Project appears in list. | CRITICAL |
| P-02 | Edit Project | 1. Open Project.<br>2. Edit details.<br>3. Save. | Changes reflected immediately. | High |
| P-03 | Upload Plan | 1. Edit Project.<br>2. Upload PDF/Image Plan.<br>3. Save. | Plan processes and displays in viewer. | High |
| P-04 | Delete Project | 1. Project List -> Delete.<br>2. Confirm. | Project removed from list. | Low |

### 3.3. Snags & Floor Plans
| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|:----------------|:---------|
| S-01 | Add Snag (List) | 1. Project -> Snags -> Add.<br>2. Fill Title, Desc. | Snag created. | High |
| S-02 | Add Snag (Plan) | 1. Project -> Floor Plan.<br>2. Click on location.<br>3. Fill details. | Snag created with pin on map. | CRITICAL |
| S-03 | Edit Snag | 1. Open Snag.<br>2. Change Status/Priority.<br>3. Save. | Updates saved. Card updates color. | High |
| S-04 | Add Photos | 1. Open Snag.<br>2. Upload Photo.<br>3. Save. | Photo appears in carousel. | High |
| S-05 | Comments | 1. Open Snag.<br>2. Add Comment. | Comment appears with timestamp. | Medium |

### 3.4. Report Generation (Critical Feature)
*Refer to `IMPLEMENTATION_GUIDE.md` for detailed scenarios.*

| ID | Test Case | Scenario | Expected Result | Priority |
|----|-----------|----------|:----------------|:---------|
| R-01 | Minimal Report | Project with 5 snags, no photos. | 4-5 pages, clean layout. | High |
| R-02 | Full Report | Project with ~50 snags with photos and plans. | Report generates < 30s. Images align. | CRITICAL |
| R-03 | PDF Structure | Check generated PDF. | Cover -> Exec Summary -> Plans -> List -> Details -> Footer. | High |
| R-04 | Word Export | Click "Generate Word". | .docx file downloads, structure matches PDF. | Medium |
| R-05 | Field Handling | Empty fields in snags. | Shows "Not Specified", no "null/undefined". | Medium |

### 3.5. Security & Offline
| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|:----------------|:---------|
| SE-01| RLS Access | 1. Login as User A.<br>2. Try to access User B's project (via URL ID). | Access denied / 404 / Empty list. | CRITICAL |
| OF-01| Offline Form | 1. Go offline.<br>2. Fill snag form.<br>3. Errors? | Should gracefully handle or warn user (Note: Full offline sync is future). | Low |

---

## 4. Automated Testing Strategy (Roadmap)

Currently, the project relies on manual testing. To improve reliability and speed up refactoring, we recommend the following phases:

### Phase 1: Unit Testing (Immediate)
**Tools:** `vitest` (compatible with Vite)
**Target:** Helper functions and logic that don't depend on the DOM or Network.
- **`src/services/reportGenerator.ts`**:
    - `getStatusColor()`, `getPriorityColor()`
    - `formatFieldValue()`
    - `formatFileName()`
- **`src/lib/brand.ts`**: Verify constants.
- **`src/utils/*.ts`**: Any shared utility functions.

**Action Plan:**
1. Install `vitest`: `npm install -D vitest`
2. Create `src/services/reportGenerator.test.ts`.
3. Add simple assertions for helper functions.

### Phase 2: Component Testing
**Tools:** `vitest` + `react-testing-library`
**Target:** Shared UI components.
- **`src/components/ReportPreview.tsx`**: Ensure it renders.
- **`src/components/SnagCard.tsx`**: Verify badges render correct colors based on props.

### Phase 3: End-to-End (E2E) Testing
**Tools:** `Playwright` or `Cypress`
**Target:** Critical user flows.
- Login Flow.
- Create Project -> Add Snag -> Generate Report.
- Verify the PDF generation request completes successfully.

---

## 5. Test Execution Log (Template)

| Date | Version | Tester | Scope | Pass/Fail | Critical Issues Found |
|------|---------|--------|-------|:---------:|-----------------------|
| 2026-01-20 | 2.0.0 | Dev | Report Refactor | PASS | None. |
| | | | | | |

---

## 6. Known Issues / Limitations
- **PDF Generation**: Large images (>5MB) may cause memory spikes. Logic includes downscaling, but extreme cases should be tested.
- **Offline Mode**: Currently limited; form state is local but uploads require connection.
