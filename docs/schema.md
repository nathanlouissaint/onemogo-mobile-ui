# ONEMOGO — Canonical Schema

## MVP definition (3 bullets max)
- [ ] User can register/login/logout and stays signed in between app restarts
- [ ] User can start a workout session and see it on the Workouts list and Dashboard
- [ ] User can complete a workout session and then see duration + completed status in the Workouts list and the session detail screen

## Routing contract
- `/workout/[id]` is: **SESSION detail**
- The `id` param is a `workout_sessions.id`

## Conventions
- **Database + API field casing:** `snake_case`
- **Time:** `timestamptz` (UTC)
- **IDs:** `uuid`
- **Ownership:** every user can only access rows where `user_id = auth.uid()`

---

## Entities

## 1) `workout_sessions` (MVP required)
Purpose: represents a single workout session the user starts and later completes.

### Fields
- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, not null, fk → `auth.users.id`)
- `title` (text, nullable)
- `activity_type` (text, not null)  
  Examples: `strength`, `cardio`, `mobility`, `hiit`
- `started_at` (timestamptz, not null, default `now()`)
- `ended_at` (timestamptz, nullable)
- `duration_min` (int, nullable)  
  Set when completing a session (see rules)
- `created_at` (timestamptz, not null, default `now()`)
- `updated_at` (timestamptz, not null, default `now()`)

### Derived status (do not store)
- `status`:
  - `active` if `ended_at IS NULL`
  - `completed` if `ended_at IS NOT NULL`

### Rules (hard constraints)
- **Start session**
  - Insert a row with:
    - `user_id = auth.uid()`
    - `started_at = now()` (or provided)
    - `ended_at = null`
    - `duration_min = null`
- **Complete session**
  - Update the row to set:
    - `ended_at = now()` (or provided)
    - `duration_min = CEIL(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)`
  - `ended_at` must be `>= started_at`
- **Idempotency**
  - Completing a session that is already completed should be a no-op or return an explicit “already completed” response (implementation choice; document it in API)

### Indexes (minimum)
- `(user_id, started_at DESC)` for list screens
- `(user_id, ended_at)` if you later query active vs completed frequently

### RLS (required)
- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()` (optional; MVP doesn’t require delete)

---

## 2) `workout_templates` (optional, NOT MVP)
Purpose: library of planned workouts the user can start from later.

### Fields
- `id` (uuid, pk)
- `title` (text, not null)
- `description` (text, nullable)
- `difficulty` (text, nullable)  
  Examples: `beginner`, `intermediate`, `advanced`
- `duration_min` (int, nullable)
- `created_at` (timestamptz, not null, default `now()`)
- `updated_at` (timestamptz, not null, default `now()`)

### Notes
- Templates are not required for MVP. Do not block MVP on templates.

---

## 3) `workout_exercises` (optional; only if templates exist)
Purpose: exercises that belong to a template (planned workout).

### Fields
- `id` (uuid, pk)
- `template_id` (uuid, not null, fk → `workout_templates.id`)
- `name` (text, not null)
- `sets` (int, nullable)
- `reps` (int, nullable)
- `duration_seconds` (int, nullable)
- `notes` (text, nullable)
- `sort_order` (int, not null, default 0)

### Notes
- Not required for MVP session tracking.

---

## API contract (mobile app)
These function names should map 1:1 to your Supabase calls.

### Sessions (MVP)
- `startWorkoutSession(payload)`
  - inserts into `workout_sessions`
- `listWorkoutSessions(userId)`
  - queries `workout_sessions` by `user_id`
- `getWorkoutSessionById(id)`
  - reads `workout_sessions` where `id = :id` (RLS enforces ownership)
- `completeWorkoutSession(id)`
  - updates `ended_at` + `duration_min`

### Field expectations in the app
- Use `started_at`, `ended_at`, `duration_min`, `activity_type` everywhere
- Do not use `durationMinutes` or mixed casing for any session objects

---

## UI alignment checklist
- Workouts tab list:
  - title, activity_type, started_at, ended_at (or “active”), duration_min (if completed)
- Dashboard “Today”:
  - show the most recent session (or current active one)
- Session detail `/workout/[id]`:
  - show status + duration
  - “Mark Complete” enabled only when `ended_at` is null