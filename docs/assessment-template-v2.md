# Editable assessment template: 2026-10-12

Source: the user-supplied `xlore-u-complete-assessment.html`. Only its literal questionnaire, routing and cluster data were parsed; none of the uploaded script or remote Tailwind code was executed or installed.

The user explicitly chose to retain **15 career-profile questions plus five unscored practical questions**, rather than the prototype's 20-vote rule. Original validated prompts, answer labels and IDs are retained. All 20 source prompts match the original prompts after normalizing numbering/case/whitespace; 14 source answer labels are shortened, paraphrased or typographically changed, so the validated originals are not silently replaced. Q9's explicit answer-to-profile order from the reference (A/D/C/B) is imported only if the original question and unchanged original answer IDs/labels still have the original A/B/C/D mapping. A previous administrator customization is not overwritten.

## Student flow

1. Current active questionnaire, grouped by the editable sections and ordered by current positions within each section.
2. One profile-specific specialization question: A (technical), B (creative), C (people-oriented), D (practical/business). A tied macro-profile triggers a student-choice signpost first by default. Administrators can explicitly select a deterministic tie-priority policy instead.
3. The shared, unscored career-launch question: corporate employment; independent work/entrepreneurship; public service/research. It can be edited or disabled.
4. Results with the macro vote breakdown, selected umbrella cluster, saved career preference, **real active catalog programs and school offerings**, existing practical filters and the full cluster directory. The source omitted its maritime cluster from the directory; the import includes all 11 referenced clusters.

Answers are counted from the complete latest answer list on the server. Revisiting or changing an answer does not increment a running counter again. A missing or forged specialization/career choice cannot produce a final result. The initial policy remains one completed assessment per account; the prototype's unrestricted retake button is not copied by default.

## Admin controls

Assessment Management has **Core questions** and **Routing & results settings** views:

- Prompts, answers, active/draft/archive status, section membership and question order.
- Answer A/B/C/D assignment using the agreed one-vote rule. The practical questions remain unscored and have explicit tuition/distance priority settings.
- All four profile labels; section labels, additions/removals and section ordering.
- Each profile-specific prompt, section title, answer label, answer addition/removal and cluster association.
- Shared career-launch prompt, labels, enable/disable, answer addition/removal, result notes and explicitly associated preferred school records.
- Cluster names, descriptions, program examples, addition/removal, literal program-title keyword rules and explicit included/excluded catalog-program IDs. Catalog pickers include inactive programs so old associations can be removed; inactive programs are still not recommended.
- Degree eligibility, school-priority order, tie policy/priority and one-time versus explicitly enabled repeat-attempt policy. Repeat mode preserves old results instead of deleting them.
- Result program-preview count; vote/constraint/cluster visibility; tuition and straight-line-distance filter amounts; core/routing/result headings, explanatory text and primary action labels.
- Read-only full preview uses the same server functions as student assessment. Preview never writes an assessment or consumes an attempt.

Settings are validated and saved as one version-checked transaction. A stale edit returns 409. A removed referenced section/cluster, duplicate/missing practical key, invalid catalog ID, malformed routing choice or unsupported policy is rejected. Final assessment storage locks both question and settings tables and rechecks the combined bank/configuration version. Unsaved settings are guarded when switching tabs, refreshing settings or leaving the page.

The admin menu's outside-click handler now closes only navigation/account menus, not editing disclosures. Otherwise collapsing a large editor on pointer-down could move a targeted button before pointer-up and lose the click. Mobile settings use a single-column form; related catalog selectors remain searchable/scrollable and closed by default.

## Matching and safeguards

- Program-title matching uses normalized literal whole words, not editable executable regex or arbitrary code. Explicit inclusions override keyword rules; explicit exclusions always win.
- Only eligible, active degrees with actual available school offerings are candidates. No prototype example institution is injected into results. Program examples are labelled descriptive examples, not verified school offerings.
- Career preference is stored. Its school priority has no effect unless an administrator deliberately associates real schools with that answer. Such priority cannot create an offering or bypass tuition/distance limits. No corporate partnership, incubator or commute time is inferred from the source's example notes.
- Tuition/distance filtering, missing-data exclusions and city-center straight-line estimates keep their existing semantics. Travel minutes are never converted into kilometres.
- Each new result snapshots profile names, routing choices, career preference, selected cluster rule, matching/display settings and versioned question/answer data. Existing results are not reset, rescored or assigned fabricated career preferences.
- This remains a configurable rule-based decision-support method, not a newly validated psychometric key. Original question-content review does not validate new scoring or catalog rules.

## Rollout and verification

Migration `019_assessment_template_settings.sql` creates the single RLS-protected settings row, installs `database/assessment-template-v2.json`, adds section metadata to the original core records and conditionally updates the original Q9 mapping. It does not change question wording, answer IDs, active statuses or saved user results. Migrations 018 and 019 are applied in production. New installations must apply both before running the new backend/frontend.

Tests cover all four macro outcomes, unscored practical/career answers, explicit ties, repeated/back answer calculations, actual editable program mapping, zero/unknown limits, preferred-school eligibility, version conflicts, question/section reorder, admin authorization and final snapshots. The actual final-save and saved-result API passed against PostgreSQL with 36 program recommendations in one rollback-only transaction that temporarily included migration 019. All fixture data and the temporary schema/settings changes were rolled back. Local full-app browser fixtures verify settings save, keyword typing, searchable school selection, guarded tab changes, both follow-ups, result filters/cluster display and mobile layout, with production network requests blocked.

## Production rollout: 2026-10-12

At the user's explicit deployment request, migration 019 was applied and both applications deployed to Vercel:

- Backend: `dpl_9EppARBsGZugDRmL4pmffi9eL5oV`, production alias `https://xlore-u-api.vercel.app`.
- Frontend: `dpl_9pgbSPVBEdwAvqqXBk4RR2oCUTD4`, production alias `https://xlore-u-beta.vercel.app`, bundle `/assets/index-DAQlc0_4.js`.

Both deployments are Ready. Live checks confirmed the authenticated settings editor reads the real catalog (678 programs and 100 schools), public questions report template version 2 with 20 active questions, and admin preview runs specialization plus career-launch routing with exactly 15 votes and five unscored practical questions. Anonymous settings requests return 401. The preview checks did not save an assessment or alter settings. Question wording/answer-ID hashes and saved-record hashes matched before and after rollout: seven assessments, 140 responses, seven career profiles and 285 recommendations were preserved. The question-bank backup and verification receipts remain outside Git in the workspace `work` directory; user answer data was not exported.

The localhost sample-data demo was not deployed. No commit or push was requested or performed during rollout. Existing completed accounts remain subject to the one-time policy; administrator preview does not consume an attempt.

A subsequent frontend-only deployment (`dpl_D61vrjWobw5dhAXzKur3u8incFBN`, bundle `/assets/index-BfxUdcBH.js`) added recommended-program keyword search, category/degree filters, and optional name sorting. Filters narrow only the saved recommendations, never rescore or mutate an assessment, and are independent of school filters. Administrator sign-in now requires a manually entered email instead of displaying a preset address; authorized-account checks and Google sign-in remain unchanged. All 114 frontend tests, lint and build passed; isolated browser checks verified filtering, expansion, empty states, mobile layout, clean navigation and a blank email field. Read-only production checks verified the new bundle and blank admin sign-in without submitting a login.
