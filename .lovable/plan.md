

# Job Vacancies & Application System

## Current State
- Job positions = flat string array in `system_settings` (no descriptions, no status, no requirements)
- `JobSelector` shows buttons with just the job title
- No concept of "applying" — candidates just pick a title and start an interview

## Proposed Changes

### New `job_vacancies` Table
```sql
CREATE TABLE job_vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  requirements JSONB DEFAULT '[]',
  department TEXT,
  location TEXT,
  employment_type TEXT DEFAULT 'full_time', -- full_time, part_time, contract
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- RLS: admins full access, HR read, candidates read active only

### New `job_applications` Table
```sql
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id UUID REFERENCES job_vacancies(id),
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'applied', -- applied, interviewing, accepted, rejected
  interview_id UUID REFERENCES interviews(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- RLS: candidates manage own, admins/HR view all

### UI Changes

**Candidate Side — Job Browsing Page (`/jobs`)**
- Card-based listing of active vacancies with title, description, department, location
- "Apply" button on each card → creates application + navigates to interview type selection
- Filter by department/type

**Admin Side — Vacancy Management (new tab in AdminSettings)**
- CRUD for job vacancies: title, description, requirements, department, location, employment type
- Toggle active/inactive status
- View applicant count per vacancy

**Modified Files**
- `src/pages/AdminSettings.tsx` — add "Vacancies" tab with CRUD
- `src/components/interview/JobSelector.tsx` — replace flat buttons with vacancy cards from `job_vacancies` table
- `src/pages/CandidateDashboard.tsx` — add link to browse vacancies
- `src/App.tsx` — add `/jobs` route
- `src/hooks/useInterviewSession.ts` — link interview to application
- New: `src/pages/JobVacancies.tsx` — candidate-facing vacancy browser

**Data Migration**
- Existing `system_settings.job_positions` stays for backward compatibility
- New vacancies are the primary source going forward

