# Assessment structure and algorithm review

Historical review: the user subsequently chose the equal-vote macro-profile and unscored-routing method on 2026-10-12. The new local core workflow is described in [assessment-macro-routing-v1.md](assessment-macro-routing-v1.md). Its recognition of the unchanged core supersedes the unavailable-key behavior below for that workflow; the earlier eight-tag draft is still inactive. Legacy results and non-core legacy scoring remain compatible.

Prepared 2026-10-11. Local implementation version: `interest-alignment-v2`.

## Current live scoring problem

The inspected database contains 20 active questions with four choices each. All 80 choices have the same `{technology: 3}` mapping. Therefore any complete submission receives 60 technology points, irrespective of its answers. This key cannot discriminate interests. Content review of the questionnaire does not by itself validate this scoring key or the recommendation algorithm.

No approved numerical scoring key was supplied. The attached questionnaire review documents contain reviewer comments, not a numerical scoring specification or evidence of scoring reliability/predictive validity. No question prompts, answer labels, existing assessments or live point mappings were changed during this work.

## What has changed locally

1. A technical audit verifies recognized dimensions, integer weights from 0 to 5, option structure and score variation. An all-constant bank is unavailable rather than returning a misleading match. This is only a technical suitability check, not a psychometric approval gate.
2. Every submission must contain exactly one valid choice for every active question. Unknown options, duplicate or missing answers are rejected.
3. An edited bank invalidates an in-progress submission. The question version is rechecked within a transaction while a shared table lock prevents edits during the commit. The existing account-level one-time rule remains enforced.
4. Scores are normalized against the configured minimum/maximum attainable for each dimension. Unmeasured dimensions are not assigned fabricated zero scores.
5. Program alignment has no minimum-score floor. Active program/offering eligibility and degree level are checked.
6. Saved results retain raw points, normalized metrics, question-bank/algorithm versions, the selected-answer snapshots and the recommended-program contribution snapshots. Later question edits do not silently rescore them.
7. The admin editor no longer defaults every new option to three technology points. It exposes the scoring audit and warns when the bank cannot differentiate answers.

These are local code changes, not a Vercel deployment. Deploying them with the existing constant key will temporarily make new assessments unavailable pending a reviewed key. No attempts are consumed by this unavailable response. Existing saved results remain readable and are marked as legacy/unvalidated-key results in the updated results view.

## Scoring equations

For dimension `d`, question `q` and chosen answer `a(q)`, let `w(q,a,d)` be the configured weight. A missing tag has weight zero.

```text
Raw(d) = sum over questions of w(q, a(q), d)
Min(d) = sum over questions of min over options w(q, option, d)
Max(d) = sum over questions of max over options w(q, option, d)
Alignment(d) = (Raw(d) - Min(d)) / (Max(d) - Min(d))
```

Alignment is defined only when `Max(d) > Min(d)`. A constant baseline contributes no discrimination and does not create a high match. The range is 0–1. Tied leading dimensions are reported as mixed interests rather than an arbitrary primary career. No positive evidence produces a guidance-counselor/exploration message.

Normalization removes point-range inflation. It does not prove that eight dimensions are comparable, resolve overlapping answer choices, correct poorly represented constructs, or establish reliability.

## Program recommendations

A program's distinct recognized interest tags are matched against measured dimensions:

```text
Program alignment = mean of Alignment(d) for each program tag d
Displayed program score = round(100 × program alignment)
```

Example: technology alignment 0.80 and analytical alignment 0.60 gives a two-tag computing program 70% interest alignment. This is NOT a 70% chance of admission, completion, employment or psychological suitability. The score is a transparent rule-based index, not an accuracy estimate.

Programs with empty/unknown tags or unmeasured required tags are excluded rather than guessed. A program must be active, have at least one active available school offering, and be Bachelor, Associate, Diploma or Certificate level. Postgraduate medicine is not recommended to school leavers. Zero alignment is not offered as a positive recommendation. Candidates are sorted by unrounded alignment, then program name/ID for deterministic ties; the first six are saved.

Tags are curated catalog metadata. Their quality must also be reviewed: an accurate formula cannot repair an incorrectly tagged program. Current top-six selection can contain closely related majors; diversification is a separate future policy requiring explicit decisions.

## School recommendations

Only active available schools offering the recommended active programs are eligible. The school's displayed academic alignment is the highest stored score among its matched programs. Default ordering uses that score first, approximate distance second for equal scores, then school name/ID. Public star ratings do not determine academic fit. User-selected distance or tuition sorts remain separate choices in the interface.

Distance is a straight-line Haversine estimate from the recognized address area, not the user's exact home location or road travel time. Unknown coordinates/location remain unknown. Tuition, facilities, assistance and teaching preferences are not automatically inferred from the questionnaire or invented when school metadata is missing.

## Inactive draft for review

`database/assessment-scoring-draft-2026-10-11.json` and its readable `.md` companion propose answer mappings while preserving all 20 prompts and all 80 labels verbatim. They have no database import/activation path. Their status is DRAFT-REQUIRES-PSYCHOMETRICIAN-APPROVAL and `activationAllowed` is false.

- Proposed interest evidence: Q1, Q2, Q3, Q5, Q6, Q7, Q8, Q9, Q10 and Q15.
- Proposed context-only preferences: Q4, Q11, Q12, Q13, Q14, Q16, Q17, Q18, Q19 and Q20.
- Tentative weights range from 0 to 3, not statistically calibrated values.
- Context-only answers create no career-interest points; their labels are retained for later approved preference handling.
- Several choices combine distinct fields. Health and education are not independently separable from every relevant choice. Health has only two informative draft items, while other dimensions have more. Normalization cannot fix this coverage problem.
- Self-reported strengths are not measured aptitude. Disliking numbers is not affirmative evidence of an arts career. Broad hands-on/sports choices cannot be confidently assigned one field.

The current admin editor requires a positive weight for every option. Activating context-only/zero-evidence choices requires an explicitly approved schema/editor policy and preference logic; the draft must not be pasted directly into the current live bank.

## Review and validation before activation

The psychometricians should approve construct definitions, item roles, the exact option weights and interpretation. Academic advisers should review program tags and known example recommendations. Pilot the approved key, assess recommendation agreement/usefulness and relevant reliability/fairness evidence, and document limitations. If approved weights or supported preference rules change, version them and retest without changing the reviewed wording.

No claim of psychometric accuracy, established scales, diagnostic validity or admission probability is justified by these engineering changes alone.

## Verification

Tests cover a constant 20-question key, point-range normalization, constant baselines, mixed interests, malformed answers/weights, unmeasured/unknown tags, original saved snapshots, one-time access, transaction rollback on question edits, school fit-versus-distance ordering and the inactive draft's wording hash/context-only weights. Database maintenance additionally compares the full question-bank hash before/after import and preserves pre-existing offering metadata.
