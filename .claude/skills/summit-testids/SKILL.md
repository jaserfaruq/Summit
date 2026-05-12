---
name: summit-testids
description: Convention for data-testid attributes in Summit components. Ensures Playwright tests have stable selectors. Follow when creating or modifying any React component with interactive elements or assertion targets.
user-invocable: false
---

# Summit data-testid Convention

`data-testid` attributes are how Playwright e2e tests target elements. Follow this convention whenever you create or modify a component.

## When to Add

Add testids to:

1. **Interactive elements**: buttons, inputs, selects, links, dropdowns, toggles, sliders, checkboxes, textareas.
2. **Assertion targets**: score values, status badges, error messages, success messages, loading states, conditional content a test would check.
3. **Scoping containers**: modal roots, results containers, page headings that anchor a flow.

## When NOT to Add

- Decorative elements (icons, SVGs, dividers, background images)
- Static copy that no test will assert on (marketing text, descriptions)
- Layout wrappers with no test relevance
- Deep children when the parent already has a testid and items are addressable by index

## Naming Rules

- **kebab-case only**: `score-arc-cardio`, never `scoreArcCardio`
- **Namespaced by component family** using these established prefixes:

| Prefix | Scope |
|--------|-------|
| `signup-` | `/signup` page |
| `login-` | `/login` page |
| `objective-` | ObjectiveModal component |
| `assessment-` | `/assessment/[id]` page (all phases: layer1, layer2, scoring, results) |
| `dashboard-` | DashboardClient component |
| `score-arc-` | ScoreArc component (used on dashboard and elsewhere) |
| `plan-` | `/plan` page |
| `log-` | `/log` page |

- **New components** get a new prefix matching their name (e.g., `settings-` for a settings page, `admin-` for admin pages)
- **Describe behavior, not appearance**: `assessment-continue-button` not `gold-bottom-button`

## Dynamic IDs

For repeated or indexed elements, use template literals matching these patterns:

```tsx
// Week and session indexing (plan page)
data-testid={`plan-week-${week.week_number}`}           // week_number is 1-based (as displayed)
data-testid={`plan-session-${week.week_number}-${i}`}   // i is 0-based array index
data-testid={`plan-session-log-${week.week_number}-${i}`}

// Score arcs — keyed by label prop, lowercased
// Labels in practice: "Cardio", "Strength", "Climbing", "Flexibility"
data-testid={`score-arc-${label.toLowerCase()}`}         // → score-arc-cardio, score-arc-climbing
data-testid={`score-arc-value-${label.toLowerCase()}`}
data-testid={`score-arc-target-${label.toLowerCase()}`}

// Assessment scores — keyed by dimension key
// Dimension keys: cardio, strength, climbing_technical, flexibility
data-testid={`assessment-score-${dim}`}                  // → assessment-score-climbing_technical
data-testid={`assessment-target-${dim}`}

// AI-generated questions — keyed by map index and question ID
data-testid={`assessment-ai-question-${index}`}          // 0-based map index
data-testid={`assessment-ai-answer-${q.id}`}             // question ID from API

// Climbing skills — skill.id with underscores replaced by hyphens
data-testid={`assessment-climbing-skill-${skill.id.replace(/_/g, "-")}`}
// → assessment-climbing-skill-indoor-gym, assessment-climbing-skill-trad

// Rating buttons
data-testid={`log-rating-${opt.value}`}                  // 1-5

// Plan score results after week completion — uses raw dimension keys
data-testid={`plan-score-result-${dimensionKey}`}        // includes underscore: climbing_technical
```

**Important inconsistency to preserve:** ScoreArc uses display labels (lowercase: "climbing"), while assessment scores and plan results use dimension keys ("climbing_technical" with underscore). This matches what's in the code — don't "fix" it.

## Conditional Elements

Add testids even to conditionally rendered elements. The test for that condition needs the selector. Examples already in the codebase:

- `log-comment` — only renders when rating ≠ 3
- `assessment-climbing-role` — only renders when climbing role was set
- `assessment-climbing-style` — only renders when a YDS grade is selected
- `plan-week-now-badge` — only renders on the current week
- `plan-week-done-badge` — only renders on scored weeks

## Current Coverage (93 testids, 8 files)

| File | Count | Prefix |
|------|-------|--------|
| `src/app/signup/page.tsx` | 5 | `signup-` |
| `src/app/login/page.tsx` | 6 | `login-` |
| `src/components/ObjectiveModal.tsx` | 13 | `objective-` |
| `src/app/(open)/assessment/[objectiveId]/page.tsx` | 37 | `assessment-` |
| `src/components/DashboardClient.tsx` | 6 | `dashboard-` |
| `src/components/ScoreArc.tsx` | 6 | `score-arc-` |
| `src/app/(open)/plan/page.tsx` | 14 | `plan-` |
| `src/app/(app)/log/page.tsx` | 6 | `log-` |

## When Adding to New Components

1. Pick a kebab-case prefix matching the component name.
2. Add testids to all interactive elements and assertion targets.
3. For lists, use `{prefix}-{item}-{index}` pattern.
4. Run `npm run build` to verify no breakage.
5. Update the coverage table above.
