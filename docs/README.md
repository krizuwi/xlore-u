# Frontend documentation

Reviewed against the source on **19 October 2026**. Start with the root [README](../README.md).

| Guide | Read it when you need to… |
| --- | --- |
| [Student and administrator guide](user-guide.md) | Explain or demonstrate the screens |
| [Institution accounts and school community](institutions.md) | Register a school representative, review claims, edit own school, and use posts/likes/comments and notifications |
| [Frontend architecture](frontend-guide.md) | Find components, understand API/auth integration, or troubleshoot |
| [Engagement and refresh](engagement.md) | Understand inactivity notices and background polling |
| [Google AdSense setup](adsense.md) | Verify the publisher, review privacy/consent prerequisites, and deliberately enable the prepared homepage ad |
| [Student enrollment and account management](student-enrollment.md) | Report enrollment, review private school/city charts and manage student account access |
| [Static logo notes](../public/school-logos/README.txt) | Add a bundled logo without assuming automatic UUID discovery |

The repository has separate `frontend` and `backend` branches. The backend branch contains `docs/system-overview.md`, `docs/api-reference.md`, `docs/database-guide.md`, and `docs/operations.md`. Use those for server, schema, and deployment details; the frontend should not carry private server configuration.

These guides explain implemented behavior, not a promise of psychometric validity, legal compliance, uptime, automatic Vercel scheduling, or fully verified catalog information. README dates are source-review dates, not live health-check receipts.
