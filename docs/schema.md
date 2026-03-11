# ONEMOGO — Canonical Schema

## MVP definition (3 bullets max)
- [ ] User can register/login/logout and stays signed in between app restarts
- [ ] User can start a workout session and see it on the Workouts list and Dashboard
- [ ] User can complete a workout session and then see duration + completed status in the Workouts list and the session detail screen

---

# Routing contract

- `/sessions/[id]` is: **SESSION detail**
- The `id` param is a `workout_sessions.id`

Optional session entry route:

- `/sessions/start` starts a new workout session flow

---

# Conventions

- **Database + API field casing:** `snake_case`
- **Time:** `timestamptz` (UTC)
- **IDs:** `uuid`
- **Ownership:** every user can only access rows where `user_id = auth.uid()`

---

# Entities

---

# 1) `workout_sessions` (MVP required)

Purpose: represents a single workout session the user starts and later completes.

## Fields

- `id` (uuid, pk, default `gen_random_uuid()`)
- `user_id` (uuid, not null, fk → `auth.users.id`)
- `title` (text, nullable)
- `activity_type` (text, not null)  
  Examples:
  - `strength`
  - `cardio`
  - `mobility`
  - `hiit`

- `plan_id` (uuid, nullable, fk → `planned_workouts.id`)
  - Links a session to a planned workout
  - Used for **plan → execution tracking**

- `template_id` (uuid, nullable, fk → `workout_templates.id`)
  - Used when starting a session from a template

- `started_at` (timestamptz, not null, default `now()`)
- `ended_at` (timestamptz, nullable)

- `duration_min` (int, nullable)  
  Set when completing a session.

- `created_at` (timestamptz, not null, default `now()`)
- `updated_at` (timestamptz, not null, default `now()`)

---

# Derived status (do not store)

`status` is derived:

- `active` if `ended_at IS NULL`
- `completed` if `ended_at IS NOT NULL`

---

# Rules (hard constraints)

## Start session

Insert a row with:

- `user_id = auth.uid()`
- `started_at = now()` (or provided)
- `ended_at = null`
- `duration_min = null`

Optional relationships:

- `plan_id`
- `template_id`

---

## Complete session

Update the row to set:

- `ended_at = now()` (or provided)
- `duration_min = CEIL(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)`

Constraint:

- `ended_at >= started_at`

---

## Idempotency

Completing a session that is already completed should either:

- return a no-op response
- or return an explicit `"already completed"` response

Implementation choice.

---

# Indexes (minimum)
