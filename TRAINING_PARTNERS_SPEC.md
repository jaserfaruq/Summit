# Summit Planner — Training Partners Feature Spec

> **Standalone feature spec.** This document can be fed to Claude Code independently of `CLAUDE.md`. It assumes familiarity with the Summit Planner codebase and references existing tables, API routes, and prompts defined in `CLAUDE.md` (Implementation Specification v2). Do not merge into `CLAUDE.md` unless explicitly instructed.

-----

## Feature Overview

**Training Partners** adds a social layer to Summit Planner — not a social network, but a training partnership tool. Users connect with mutual invites, see each other's weekly sessions side-by-side, get notified when their weeks overlap, and can optionally swap sessions to train together. The feature leverages the existing Alternatives system (Prompt 6) for session swaps and requires no new AI prompts.

### Design Philosophy

Summit Planner's brand is **purposeful, ambitious, human**. Training partners fits because serious athletes often train with partners. The social element should feel like a climbing partnership — trust-based, practical, and grounded in shared effort — not like a fitness influencer feed. No leaderboards, no public profiles, no gamification. Just: "My partner also has climbing this week. Let's go together."

-----

## Design Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Connection model | Mutual invite (both accept) | Respects privacy; partnerships are intentional |
| Partner limit | Unlimited | Different partners for different activities |
| Default visibility | Session names, dimensions, objective name — **no scores** | Scores are deeply personal coaching data |
| Score sharing | Opt-in, **both** partners must agree | Score sharing = deeper trust level |
| Completion visibility | Visible to partners by default | Natural accountability without gamification |
| Match grain | Environment OR dimension overlap | Broad enough to surface useful overlaps |
| Notifications | Active ("Alex also has climbing this week") | Nudge users toward training together |
| Timing/scheduling | External (text, phone, etc.) | Avoids building calendar/messaging infrastructure |
| Plan impact | Optional session swap via existing Alternatives (Prompt 6) | Reuses existing system; no new prompts needed |
| Dimension intelligence | None — just show overlap, don't analyze dimensions | Keeps UI simple; users can judge for themselves |
| Location awareness | Deferred to v2 | MVP assumes partners are local enough to train together |
| Primary UI | New `/partners` page with side-by-side week view | Clean separation; doesn't clutter existing pages |

-----

## Database Schema

### Migration 006: Training Partners

```sql
-- partnerships: the connection between two users
CREATE TABLE partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',          -- pending | accepted | declined
  requester_shares_scores BOOLEAN DEFAULT FALSE,   -- requester opts in to show scores
  recipient_shares_scores BOOLEAN DEFAULT FALSE,   -- recipient opts in to show scores
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- prevent duplicate partnerships
  CONSTRAINT unique_partnership UNIQUE (requester_id, recipient_id),
  -- prevent self-partnerships
  CONSTRAINT no_self_partner CHECK (requester_id != recipient_id)
);

-- Indexes for common queries
CREATE INDEX idx_partnerships_requester ON partnerships(requester_id, status);
CREATE INDEX idx_partnerships_recipient ON partnerships(recipient_id, status);

-- RLS: users can only see partnerships they are part of
ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own partnerships" ON partnerships
  FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can create partnership requests" ON partnerships
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id AND status = 'pending'
  );

CREATE POLICY "Users can update partnerships they're part of" ON partnerships
  FOR UPDATE USING (
    auth.uid() = requester_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can delete partnerships they're part of" ON partnerships
  FOR DELETE USING (
    auth.uid() = requester_id OR auth.uid() = recipient_id
  );


-- partner_notifications: match alerts when weeks overlap
CREATE TABLE partner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),          -- who receives the notification
  partner_id UUID NOT NULL REFERENCES profiles(id),        -- the matched partner
  partner_name TEXT NOT NULL,                               -- denormalized for display
  partnership_id UUID NOT NULL REFERENCES partnerships(id), -- link to the partnership
  week_number INT NOT NULL,                                 -- which week the match is for
  plan_id UUID NOT NULL REFERENCES training_plans(id),     -- user's plan
  partner_plan_id UUID NOT NULL REFERENCES training_plans(id), -- partner's plan
  match_type TEXT NOT NULL,                                 -- environment | dimension | both
  match_summary TEXT NOT NULL,                              -- "Alex also has climbing this week"
  matched_sessions JSONB NOT NULL,                          -- array of { yourSessionIndex, yourSessionName, partnerSessionIndex, partnerSessionName, matchReason }
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- one notification per partner per user per week
  CONSTRAINT unique_notification UNIQUE (user_id, partner_id, plan_id, week_number)
);

CREATE INDEX idx_partner_notifications_user ON partner_notifications(user_id, is_read);
CREATE INDEX idx_partner_notifications_week ON partner_notifications(user_id, plan_id, week_number);

-- RLS: users can only see their own notifications
ALTER TABLE partner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON partner_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON partner_notifications
  FOR INSERT WITH CHECK (TRUE);  -- inserted by API, not directly by users

CREATE POLICY "Users can update own notifications" ON partner_notifications
  FOR UPDATE USING (auth.uid() = user_id);
```

### Score Sharing Logic

Score sharing is only active when **both** users in a partnership have opted in:

```
scoresVisible = partnership.requester_shares_scores AND partnership.recipient_shares_scores
```

Either user can revoke at any time by setting their flag to `FALSE`. This immediately hides scores from the partner — no confirmation needed to revoke.

-----

## Session Environment Tagging

To match sessions between partners, each session needs an inferred environment. Sessions are stored as JSONB in `weekly_targets.sessions` and generated by Prompt 2B. Rather than modifying the prompt, the environment is **derived at match time** using a heuristic function.

### `inferSessionEnvironment(session): string`

```
Input: a single session object from weekly_targets.sessions JSONB
Output: "gym" | "outdoor" | "climbing_gym" | "crag" | "home"

Rules (evaluated in order, first match wins):

1. If session.dimension === "climbing_technical":
   - If session name or exercises contain "indoor", "gym", "bouldering gym" → "climbing_gym"
   - If session name or exercises contain "outdoor", "crag", "multi-pitch", "trad" → "crag"
   - Default for climbing → "climbing_gym"

2. If session.dimension === "cardio":
   - If session name or exercises contain "trail", "hike", "ruck", "outdoor", "run" → "outdoor"
   - If session name or exercises contain "treadmill", "bike", "row", "stair" → "gym"
   - Default for cardio → "outdoor"

3. If session.dimension === "strength":
   - If session name or exercises contain "bodyweight only", "no equipment" → "home"
   - Default for strength → "gym"

4. If session.dimension === "flexibility":
   - Default → "home"
```

This function scans the session `name` field and the `exercises` array (exercise names and descriptions) for keyword matches. It is intentionally simple — if the heuristic proves unreliable, we can later add an `environment` field to Prompt 2B's output schema.

### Location in codebase

Create as `src/lib/session-matching.ts` alongside the matching algorithm (below).

-----

## Matching Algorithm

### `findPartnerMatches(userWeek, partnerWeek): MatchResult[]`

```
Input:
  userWeek: { sessions[] } from weekly_targets for the user
  partnerWeek: { sessions[] } from weekly_targets for the partner

Output: array of MatchResult:
  {
    yourSessionIndex: number,
    yourSessionName: string,
    partnerSessionIndex: number,
    partnerSessionName: string,
    matchType: "environment" | "dimension" | "both",
    matchReason: string   // e.g., "Both in the gym" or "Both doing cardio"
  }

Logic:
  For each userSession × partnerSession:
    userEnv = inferSessionEnvironment(userSession)
    partnerEnv = inferSessionEnvironment(partnerSession)

    envMatch = (userEnv === partnerEnv)
    dimMatch = (userSession.dimension === partnerSession.dimension)

    if envMatch AND dimMatch:
      matchType = "both", reason = "Both doing {dimension} at {environment}"
    else if envMatch:
      matchType = "environment", reason = "Both at {environment}"
    else if dimMatch:
      matchType = "dimension", reason = "Both doing {dimension}"
    else:
      no match, skip

  Deduplicate: each user session appears in at most one match (pick strongest: "both" > "environment" > "dimension").
  Each partner session appears in at most one match.
```

### When matching runs

Matching is triggered at two points:

1. **After session generation** — when `/api/generate-week-sessions` completes for a week, check all accepted partners. If the partner's same week also has sessions, run the matching algorithm and write to `partner_notifications`.

2. **On `/partners` page load** — if the user's current week has sessions but no notifications exist yet (e.g., partner generated sessions after the user did), run matching for the current week.

Matching does **not** run in real-time or on a cron. It is event-driven.

### Notification content

One notification per partner per week. The `match_summary` field is a human-readable string for the notification banner:

- 1 match: "Alex also has climbing this week"
- 2+ matches: "Alex has 3 overlapping sessions this week — climbing, cardio, and strength"

The `matched_sessions` JSONB stores the full match details for the side-by-side view to highlight.

-----

## API Routes

### POST /api/partners/invite

**Input:** `{ recipientEmail: string }`

**Logic:**
1. Look up recipient by email in `profiles` (join to `auth.users` for email lookup).
2. If no user found, return error: "No Summit Planner account found for that email."
3. Check for existing partnership (either direction) — prevent duplicates.
4. Insert into `partnerships` with `status: "pending"`.

**Output:** `{ partnershipId, recipientName, status: "pending" }`

### POST /api/partners/respond

**Input:** `{ partnershipId: UUID, action: "accept" | "decline" }`

**Logic:**
1. Verify the authenticated user is the `recipient_id` of this partnership.
2. Update `status` to `accepted` or `declined`.
3. If accepted, run matching for both users' current weeks (if sessions exist).

**Output:** `{ partnership }`

### POST /api/partners/toggle-scores

**Input:** `{ partnershipId: UUID, shareScores: boolean }`

**Logic:**
1. Verify the authenticated user is part of this partnership.
2. Update the appropriate flag (`requester_shares_scores` or `recipient_shares_scores` depending on which user is calling).

**Output:** `{ partnership }` (with both flags so the UI can show mutual status)

### DELETE /api/partners/remove

**Input:** `{ partnershipId: UUID }`

**Logic:**
1. Verify the authenticated user is part of this partnership.
2. Delete the partnership row.
3. Delete all `partner_notifications` for this pair.

**Output:** `{ success: true }`

### GET /api/partners/list

**Input:** none (uses authenticated user)

**Logic:**
1. Fetch all partnerships where user is requester or recipient.
2. For accepted partnerships, fetch each partner's:
   - Name (from `profiles`)
   - Active objective name (from `objectives`)
   - Current week number and total weeks (from `training_plans`)
   - Current week's session names + dimensions + completion status (from `weekly_targets` + `workout_logs`)
   - Scores (only if mutual score sharing is active)
3. For pending partnerships, return just name + status + direction (sent vs received).

**Output:**
```json
{
  "accepted": [{
    "partnershipId": "uuid",
    "partnerId": "uuid",
    "partnerName": "string",
    "objectiveName": "string",
    "weekLabel": "Week 4 of 12",
    "scoresVisible": false,
    "scores": null,
    "currentWeekSessions": [{
      "name": "string",
      "dimension": "string",
      "completed": false
    }]
  }],
  "pending": [{
    "partnershipId": "uuid",
    "partnerName": "string",
    "direction": "sent" | "received"
  }]
}
```

### GET /api/partners/week/:partnerId

**Input:** `partnerId` as URL param

**Logic:**
1. Verify an accepted partnership exists between the authenticated user and this partner.
2. Fetch the partner's active plan's current week from `weekly_targets`.
3. Fetch workout_logs for the partner's current week to determine completion status.
4. If mutual score sharing is active, include current scores.
5. Run matching algorithm between the user's current week and the partner's current week.

**Output:**
```json
{
  "partnerId": "uuid",
  "partnerName": "string",
  "objectiveName": "string",
  "weekNumber": 4,
  "totalWeeks": 12,
  "weekType": "regular",
  "sessions": [{
    "name": "string",
    "dimension": "string",
    "environment": "string",
    "completed": false,
    "sessionIndex": 0
  }],
  "scoresVisible": false,
  "scores": null,
  "matches": [{
    "yourSessionIndex": 0,
    "yourSessionName": "string",
    "partnerSessionIndex": 2,
    "partnerSessionName": "string",
    "matchType": "environment",
    "matchReason": "Both at the gym"
  }]
}
```

### GET /api/partners/notifications

**Input:** none (uses authenticated user)

**Logic:**
1. Fetch unread/undismissed `partner_notifications` for the user, ordered by `created_at` DESC.
2. Limit to current week's notifications.

**Output:**
```json
{
  "notifications": [{
    "id": "uuid",
    "partnerName": "string",
    "matchType": "both",
    "matchSummary": "Alex also has climbing this week",
    "weekNumber": 4,
    "isRead": false,
    "matchedSessions": [...]
  }]
}
```

### POST /api/partners/notifications/dismiss

**Input:** `{ notificationId: UUID }`

**Logic:** Set `is_dismissed = TRUE` on the notification.

**Output:** `{ success: true }`

-----

## Integration with Existing Alternatives System

### "Sync Up" Button Flow

When a user sees a matched session in the side-by-side view:

1. User taps **"Sync Up"** on their matched session.
2. App calls the existing **`POST /api/generate-alternatives`** with:
   - `planId`: user's plan
   - `weekNumber`: current week
   - `sessionIndex`: the matched session's index
3. Prompt 6 generates 2 alternatives (already provides outdoor/gym options, bodyweight/equipment options, bouldering/outdoor climbing options, etc.).
4. User picks the alternative that best aligns with their partner's session.
5. App calls the existing **`POST /api/replace-session`** to swap.

**No changes to Prompt 6 or the alternatives API are needed.** The existing alternatives are diverse enough that one of the two will typically be compatible with what the partner is doing.

### Future Enhancement (v2)

In v2, the "Sync Up" button could pass partner context into Prompt 6: "Generate alternatives that would pair well with someone doing [partner's session description]." This would require a minor Prompt 6 modification to accept an optional `partnerContext` field. Not needed for MVP.

-----

## Pages & UI

### /partners (New Page)

Add to `AppShell` navigation: Dashboard, Plan, Progress, **Partners**, Admin.

**Top section: Partner list + invites**

- List of accepted partners as compact cards:
  - Partner name
  - Objective name (e.g., "Training for Mont Blanc")
  - "Week 4 of 12" label
  - Small dots or checkmarks showing session completion status for the week
  - Settings icon → opens: toggle score sharing, remove partner
- Pending invites section:
  - Received: partner name + Accept/Decline buttons
  - Sent: partner name + "Pending" label + Cancel button
- **"Add Partner" button** → opens inline form: enter partner's email, send invite

**Main section: Side-by-side week view**

- Triggered by selecting a partner from the list above
- **Left column: Your week**
  - Same session card format as `/plan`: session name, dimension badge, duration
  - Completed sessions show checkmark
  - Matched sessions highlighted (colored left border or glow matching the connection line)
- **Right column: Partner's week**
  - Session cards in the same format, read-only
  - Completed sessions show checkmark
  - Matched sessions highlighted
- **Match connections:**
  - Visual connecting lines or shared highlight color between matched sessions
  - Match type label: "Both at the gym", "Both doing cardio", "Both doing climbing at the gym"
- **"Sync Up" button** on each of your matched sessions → triggers Alternatives flow
- **Score arcs** (partner's column header, only if mutual score sharing is active):
  - 4 compact score arcs showing partner's current vs target scores
  - If scores not shared: "Scores hidden" label in muted text

**Empty states:**

- No partners: "Invite a training partner to see each other's weeks and train together." + Add Partner CTA
- Partner has no active plan: "Alex hasn't started a training plan yet."
- Partner's week has no sessions generated: "Alex's sessions for this week haven't been generated yet."
- No matches this week: "No overlapping sessions this week. Check back next week!"

### /dashboard modification

- **New notification banner** (below the existing "This Week" section):
  - Shows the most recent unread partner notification
  - Format: mountain icon + "Alex also has climbing this week — want to sync up?" + "View" CTA (links to `/partners`)
  - Dismissible (X button calls `/api/partners/notifications/dismiss`)
  - Max 1 notification shown at a time; if multiple, show the most recent
  - Only shows for the current week
  - Styled with the sage (#8B9D83) background, subtle and non-intrusive

-----

## Components

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| PartnerList | `src/components/PartnerList.tsx` | List of accepted partners + pending invites |
| PartnerCard | `src/components/PartnerCard.tsx` | Compact card for a single partner (name, objective, week status) |
| PartnerInviteForm | `src/components/PartnerInviteForm.tsx` | Email input + send invite button |
| PartnerWeekView | `src/components/PartnerWeekView.tsx` | Side-by-side week view with match highlighting |
| PartnerSessionCard | `src/components/PartnerSessionCard.tsx` | Read-only session card for partner's sessions |
| MatchConnector | `src/components/MatchConnector.tsx` | Visual connection between matched sessions (lines or shared color) |
| SyncUpButton | `src/components/SyncUpButton.tsx` | Triggers alternatives generation for a matched session |
| PartnerNotificationBanner | `src/components/PartnerNotificationBanner.tsx` | Dashboard banner for match notifications |
| PartnerScoreToggle | `src/components/PartnerScoreToggle.tsx` | Toggle for opting in/out of score sharing |

-----

## Key Library Files

### New Files

| File | Purpose |
|------|---------|
| `src/lib/session-matching.ts` | `inferSessionEnvironment()`, `findPartnerMatches()`, `generateMatchSummary()` |
| `src/lib/partner-notifications.ts` | `checkAndCreateNotifications()` — called after session generation and on `/partners` page load |

-----

## RLS Policy Summary

| Table | Read | Write | Delete |
|-------|------|-------|--------|
| partnerships | Both users in pair | Both users in pair | Both users in pair |
| partner_notifications | Notification recipient only | API (service role) | Cascade on partnership delete |

**Important:** When fetching a partner's week data, the API route (not the client) performs the cross-user query using the service role, after verifying an accepted partnership exists. The client never directly queries another user's `weekly_targets` or `workout_logs`.

-----

## Privacy Model

### What partners can always see (accepted partnership)

- Your name
- Your active objective name (e.g., "Mont Blanc via Goûter Route")
- Your current week number and total weeks
- Your current week's session names and dimensions
- Which sessions you've completed this week

### What partners can see with mutual score opt-in

- Your current scores across all 4 dimensions
- Your target scores
- Score arc visualization (current vs target with green/yellow/red)

### What partners can never see

- Your assessment answers
- Your ratings and comments on specific sessions
- Your weekly reports
- Your graduation benchmark progress
- Your programming hints
- Your workout log details (duration, weight, reps, etc.)

-----

## Build Order

### Phase 1: Foundation (partnership CRUD)

1. Create migration `006_training_partners.sql` with `partnerships` and `partner_notifications` tables
2. Create API routes: `/api/partners/invite`, `/api/partners/respond`, `/api/partners/remove`, `/api/partners/toggle-scores`
3. Create `/api/partners/list` endpoint
4. Create `/partners` page with `PartnerList`, `PartnerCard`, `PartnerInviteForm`
5. Add "Partners" to `AppShell` navigation

### Phase 2: Side-by-side view

6. Create `inferSessionEnvironment()` in `src/lib/session-matching.ts`
7. Create `/api/partners/week/:partnerId` endpoint
8. Build `PartnerWeekView` and `PartnerSessionCard` components
9. Implement side-by-side layout with partner selection

### Phase 3: Matching and notifications

10. Create `findPartnerMatches()` and `generateMatchSummary()` in `src/lib/session-matching.ts`
11. Create `checkAndCreateNotifications()` in `src/lib/partner-notifications.ts`
12. Hook notification generation into `/api/generate-week-sessions` (post-hook)
13. Create `/api/partners/notifications` and `/api/partners/notifications/dismiss` endpoints
14. Build `MatchConnector` component for visual match highlighting
15. Build `PartnerNotificationBanner` for `/dashboard`

### Phase 4: Session sync

16. Build `SyncUpButton` component (calls existing `/api/generate-alternatives`)
17. Wire alternative selection → existing `/api/replace-session`
18. Show "synced" state on the matched session after swap

-----

## v2 Enhancements (Deferred)

- **Location awareness** — use `profiles.location` to flag nearby partners, surface "nearby" badge, potentially filter matches by proximity
- **Partner context in Prompt 6** — pass partner's session description to alternatives generation for better-aligned swap suggestions
- **In-app workout invites** — "Propose a session" action that sends a notification to the partner with a suggested time/place
- **Shared completion celebration** — brief acknowledgment when both partners complete a matched session in the same week
- **Partner search/discovery** — find partners training for the same objective (privacy-gated, opt-in only)
- **Group training** — support for small groups ("crews") with shared week views and group matching

-----

## Design System Notes

All new components should follow the existing design system:

- **Primary (#1B4D3E):** Partner card headers, "Sync Up" button
- **Accent (#D4782F):** Match highlights, notification banner CTA
- **Background (#F4F1EC):** Page background
- **Mid (#8B9D83):** Partner session cards (read-only feel), secondary text, notification banner background
- **Match connection color:** Use accent (#D4782F) for match highlight lines/borders — it draws the eye without feeling like an alert
- **Completion checkmarks:** Primary green (#1B4D3E)

The side-by-side view should feel like two training plans sitting next to each other on a table — clean, data-forward, no decorative elements. The match connections should be subtle (a shared colored left border on both cards, not a literal drawn line) unless the visual design warrants it.
