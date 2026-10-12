# Core questionnaire → targeted routing → program and school roadmap

Implemented locally on 2026-10-12 using the user's confirmed counting rule. Workflow version: `macro-routing-v1`.

The subsequent attached-HTML template implementation is documented in [assessment-template-v2.md](assessment-template-v2.md). It retains this counting rule, adds a career-launch follow-up and makes routing/cluster/matching/display settings editable. Migration 019 and deployment of that update are still pending; the migration 018 rollout below describes the currently deployed implementation.

## Section 1: unchanged core questionnaire

The existing 20 questions and all 80 answer labels are unchanged. Questions 1–15 each cast one vote according to the selected option's stable ID:

| Original option | Macro-profile | Contribution |
| --- | --- | ---: |
| A | Analytical | 1 vote |
| B | Creative | 1 vote |
| C | People-Oriented | 1 vote |
| D | Practical | 1 vote |

The original bank totals 15 votes. The current total is derived from active core-interest questions, not a hard-coded 15: adding or archiving a mapped core question changes the count. The largest count determines the broad preference profile. A tie is not resolved alphabetically or by an arbitrary hidden bonus. Questions 16–20 retain tuition importance, distance importance, maximum travel-time preference, resource preference and financial-assistance preference; these cast no career-profile votes.

This rule was explicitly confirmed by the user. It is not a psychometrician-approved scoring key, and content review of the original wording does not establish the scoring method's reliability or predictive validity. The old `{technology:3}` mappings are ignored by this workflow. The earlier eight-tag scoring proposal stays inactive and separate.

After migration `018_live_assessment_mapping.sql`, the effective key is the database question bank: `routing_config` specifies each question's role / practical-preference key, and each answer stores its `macro` or explicit `prioritize` setting. `database/assessment-macro-routing-v1.json` is now only the original migration seed and an identification safeguard, not the scoring authority. Admin changes to wording, answer labels or mappings are read by the next attempt instead of being blocked by a fixed wording snapshot. Reordering does not change a vote or its practical priority because settings stay attached to answer IDs. The bank version is checked when entering routing and again inside final submission; in-progress attempts must refresh after an edit. Wording changes still need content review; configurable scoring is not evidence of psychometric validity.

## Live Assessment Management

- Core editor: four answer mappings, once each to Analytical (A), Creative (B), People-Oriented (C), Practical (D). Every selected answer casts exactly one vote. All-identical mappings are rejected; no arbitrary numeric weight can silently bias a question.
- Practical editor: one active question each for tuition, distance, travel, resources and assistance. No positive career-weight requirement. Tuition/distance answers explicitly specify whether to prioritize lower known fees / nearer known straight-line distances.
- Active edits, additions and core archives affect new calculations. Drafts / archived questions are excluded. Changes that would leave an incomplete live mapping, duplicate a practical key or remove a required practical question roll back atomically, retaining the previous working bank.
- Full admin preview calls the same `buildRoutingPlan` / `completeRouting` functions through an admin-only, version-checked endpoint. It shows votes, tied-profile signposts and field / cluster; it writes no user attempt or recommendations. The per-question view is explicitly a wording-only preview.
- Student responses snapshot the selected live role, answer mapping and bank version. Existing results never reload or rescore against admin edits.

Migration 018 checks all original IDs / wording before backfilling. It keeps prompts, labels, order, IDs and statuses unchanged; replaces obsolete `technology:3` option metadata with the original user-approved A/B/C/D rule and unscored practical choices; and preserves old option metadata in `legacy_scoring_backup`. No account, assessment, response, profile or recommendation is deleted or reset. Test edits and the migration were first verified in a real PostgreSQL transaction that was rolled back. The migration was then applied and both applications deployed on 2026-10-12 at the user's request.

## Section 2: one or two unscored signposts

- A single leading macro-profile triggers one field-choice question.
- Tied profiles trigger a choice among only the leading profiles, followed by the selected profile's field-choice question.
- Follow-up answers add no votes or psychological points; they choose a catalog branch.

| Macro-profile | Offered branches |
| --- | --- |
| Analytical | Computing; Engineering/Built Environment; Science/Quantitative Studies; Maritime |
| Creative | Visual Design; Communication/Media; Music/Performance |
| People-Oriented | Health; Education; Social Sciences/Public Service |
| Practical | Business; Hospitality/Tourism; Applied Technology/Skilled Trades; Maritime |

The core does not specify an actual peso budget. Travel minutes are not kilometres. The duplicate pre-result limit fields were removed at the user's request; numeric tuition / straight-line distance filtering remains on the results screen. The API still accepts explicit limits for compatible clients: blank means no hard numeric limit and zero is a real zero limit. Tuition importance does not silently create a budget, and travel preference is never converted into a distance using an invented speed.

The student routing preview is authenticated and read-only. It stores no assessment attempt. Users can review core answers or change the signpost before final submission; unsaved-progress protection covers answers and the selected field.

## Section 3: roadmap and matching

The result shows:

1. The selected macro-profile and all four core vote counts.
2. The unscored specific field and corresponding umbrella cluster.
3. Active Bachelor, Associate, Diploma or Certificate programs whose published titles belong to that field and have an active available school offering.
4. Schools offering those programs and meeting the explicit known limits.

Program classification is a transparent, versioned title-based catalog rule, not statistical similarity or AI prediction. For example, Information Technology/Computer Science route to computing; Civil Engineering routes to engineering; Marine Engineering routes to maritime. Accounting Information Systems are not treated as computing by their name alone, and teacher-education majors are not treated as standalone science or media degrees. Postgraduate degrees are excluded for this school-leaver flow. Closely related branches can legitimately overlap for mixed programs.

Every eligible program in the selected field is saved, not only six arbitrary awards. The result initially shows eight cards, with a control to show the rest. This avoids removing schools merely because their offering was outside an arbitrary top-six program list. There is no invented match percentage: the API exposes `matchScore: null` for routed results and labels schools as offering the selected field. The database's required legacy numeric match field uses a documented zero placeholder; it is not a psychological score and is not shown as a 0% match.

### Practical constraints

- Each matched program offering is tested against the budget before school aggregation. An unrelated cheap degree or another over-budget degree cannot make a displayed program appear affordable.
- Unknown tuition is excluded when a tuition cap is set. Unknown coordinates/distance are excluded when a distance cap is set. No cap does not mean the unknown information is verified.
- Distance uses the existing approximate straight-line estimate from the recognized address area. It does not represent the exact home address, road distance or commute time.
- A new distance-capped submission requires a recognizable location before saving; failure does not consume an attempt. An old saved result whose profile location becomes unknown remains readable, with no unverified within-distance schools shown.
- If the selected distance answer has `prioritize:true`, closer known schools are ordered first. If the selected tuition answer has `prioritize:true`, known lower-cost options break remaining ties (or are primary when distance is not prioritized). Original migration defaults retain the very/extremely important answers' original behavior. Old saved results without an explicit setting retain their original index-based interpretation. Otherwise ordering is deterministic by school name/ID. Public ratings do not determine academic fit.
- Travel-time preference, resource preference and assistance preference are retained, but are not represented as verified matches without corresponding reliable school/route metadata. Commutes, scholarships and facilities must be confirmed separately.
- Empty results stay empty rather than silently widening the budget or distance. The school directory remains available for further exploration.

## Saving, one-time access and compatibility

Only final completion records the one-time assessment, selected-answer snapshots, macro votes, field/cluster, constraint answers, numeric limits, workflow/bank versions and program-route explanations. The account is locked and checked inside the transaction, preventing concurrent double completion. Recommendations are bulk-inserted to avoid one database round trip per program.

Existing results remain readable using their original scoring snapshots. They are not reset, rescored, or supplied fabricated follow-up answers. Saved routed results and the dashboard reuse the stored field/limits while applying them to current active offerings. The existing JSONB score-breakdown field stores the versioned roadmap metadata. Migration `017_assessment_program_capacity.sql` is required: the original schema limited recommendation ranks to 20, while routing retains all eligible programs. It widens the rank column to integer and requires a positive rank without an artificial upper bound; existing rows, uniqueness, foreign keys and match-score checks remain unchanged.

Production rollout completed on 2026-10-12: migration 018 applied; backend deployment `dpl_14DDXSxpXWyeawQYBRALh7KsR12P` and frontend deployment `dpl_Fm4thoGqpowebEACusEzXmuXCykb` are Ready at their existing production aliases. Post-migration verification found the identical question-wording / ID / label / status / order hash, 20 backed-up questions, 15 core questions, five practical questions and zero obsolete score objects in active options. Saved assessment / profile / response counts were unchanged. The live student questions endpoint reports an available 20-question routed workflow, the deployed admin bundle contains the new mapping editor and backend preview, and anonymous admin requests are rejected. Deployment did not commit or push these code changes.

## Verification

Tests cover four macro outcomes, constraints excluded from votes, explicit ties, stable ID-based mapping, changed wording, malformed/forged inputs, zero/unknown limits, degree eligibility, field boundaries, relevant-offering budget filtering, location failures, empty matches, authenticated read-only preview, final atomic storage, one-time rollback, saved-result compatibility, dashboard constraints, rendered follow-up UI and unsaved-progress payload coverage. Read-only checks against the connected database confirmed the current core matches the pinned routing configuration, the question-bank hash is unchanged, and the assessment read queries are valid PostgreSQL.

An opt-in real PostgreSQL regression check runs the actual final-submission and saved-result routes with more than 20 programs. Set `ASSESSMENT_STORAGE_POSTGRES_TEST=true` and run `node --test test/assessment-storage-postgres.test.js` against the configured database after migration 017. It intercepts commit, rolls back all temporary fixture records, and confirms no test account remains. The check reproduced the original rank-21 failure before migration and passed with 37 programs afterward. It is skipped in the normal offline test suite.
