# System documentation

Reviewed against the source on **19 October 2026**. The [backend README](../README.md) is the quick start. These guides describe the current implementation; dated rollout notes are historical evidence, not current deployment or catalog counts.

## Recommended reading order

1. [System overview](system-overview.md) — simple walkthrough, architecture, technologies, and student/admin flow.
2. [Operations](operations.md) — local setup, environment settings, testing, deployment, maintenance, and troubleshooting.
3. [API reference](api-reference.md) — mounted endpoints, access rules, and current payload examples.
4. [Database guide](database-guide.md) — table relationships, data ownership, and migrations.
5. [Assessment template](assessment-template-v2.md) — live admin-editable questionnaire and routing behavior.

The frontend branch has its own `docs/README.md`, `docs/user-guide.md`, and `docs/frontend-guide.md`. They describe screens and client-side integration, not backend secret configuration.

## Feature references

Added 20 October 2026: [Institution portal and community](institution-portal.md) covers ownership approval, school edits, posts, likes/comments/replies, account-scoped notifications, private moderation reasons, suspension emails with retry, new endpoints, migrations 024–028, and coordinated rollout. Do not treat this source update as a live migration/deployment receipt.

| Document | Scope |
| --- | --- |
| [Contact Admin conversations](contact-messages.md) | Private support requests/replies, account notifications, admin search/status workflow and migrations 030–031 |
| [Health checks](health-checks.md) | Current health statuses, probes, caching, and exclusions |
| [Vercel database pooling](vercel-database-pooling.md) | Serverless runtime pooling versus migration connections |
| [School media](school-media.md) | Image uploads, attribution, storage, and school-photo playback |
| [Student feedback](user-feedback.md) | Feedback sections, release identity, and reporting |
| [Student enrollment and account access](student-enrollment.md) | Voluntary enrollment reports, private student management, school/city charts, suspension emails and migration 029 |
| [Current catalog collection guide](catalog-collection.md) | Standard/AI/Hybrid flow, source discovery, transactions, and results |
| [Scraping reliability](scraping-reliability.md) | Collection safeguards plus dated findings/rollout evidence |
| [Scraper source-save issue](scraper-source-save-error.md) | Specific diagnosed failure and implementation context |

## Historical design and review notes

These records are retained rather than rewritten as though earlier releases never existed. Use current source and the guides above when their rollout statements differ.

- [Macro-routing v1](assessment-macro-routing-v1.md): original routing design, subsequently extended by template v2.
- [Assessment algorithm review, 11 October](assessment-algorithm-review-2026-10-11.md): review of an earlier state, not a claim that every finding is still open or fixed.
- [Catalog maintenance, 11 October](catalog-maintenance-2026-10-11.md): dated catalog work, not current record totals.
- [Health resilience](health-resilience.md): diagnosis and rollout record; current contract is in health-checks.md.
- [Reference adaptation](REFERENCE-ADAPTATION.md): provenance/design adaptation context, not an alternative runtime specification.

## Documentation maintenance

Update API documentation when mounting/changing routes, database documentation when adding migrations, and environment/operations guidance when changing configuration. Keep old migration filenames and historical records intact. Do not paste secrets, student responses, private home pins, tokens, or raw database exports into documentation.

Only `src/app.js` and the routers it registers define the application's mounted API; a route-shaped file, installed dependency, or historical screenshot is not proof of an active feature.
