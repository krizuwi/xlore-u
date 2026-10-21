# Student enrollment and account management

Added 22 October 2026. Requires backend migration **029_student_enrollment.sql** before deploying the matching API/frontend. This guide describes implemented behavior, not a deployment receipt.

## Student dashboard

Verified students see **Enrolled?** on the dashboard. The dialog searches available catalog schools by name, known acronym and city (30 results; closest name matches first). Keywords can be combined in any order, such as `PUP Taguig` or `Taguig PUP`; capitalization, accents and punctuation are normalized. All keywords must match the same school/campus, and programs are not searched. Selecting a school collapses the search and suggestions, leaving the selected school's name/city and a **Change school** button. Opening an existing report also starts collapsed. The form requires an explicit school selection and home-city confirmation, and starts the required declaration checkbox unchecked:

> I confirm that I am enrolled at this school, used Xlore U to help find it, and found Xlore U helpful.

Participation is optional. Students should submit only if the entire statement is true; declining does not block normal features. Reports are self-reported, not institution-verified. Name/email come from the authenticated account, not from user-supplied IDs. Only a city/municipality is requested—not a street address or home pin. The account's recognizable profile city may prefill the field, but the student must review it.

One account has one current enrollment report. Updating replaces the current school/city/declaration time without double-counting. Students can explicitly confirm withdrawal, which removes the current report from the statistics. Every new/update submission requires checking the declaration again. The separately versioned declaration is not retroactively backfilled and does not alter account-policy acceptance history.

## Admin: Students & enrollment

The sidebar item opens `/admin/students`, behind the existing verified-admin gate. Search name, email, city or enrolled school; filter active/suspended accounts, reported/unreported enrollment and completed/not-completed assessment. Results are paginated at 20 rows, with search/filters applied before pagination. Search characters such as `%` are literal, not SQL wildcards.

The private table shows student identity/email, city (self-reported or explicitly labeled profile-address estimate), completed-assessment flag, reported school, report date and account status. No report means **Not reported**, not a claim that the student is not enrolled. No full address, home coordinates, passwords or tokens are returned in this report API. Institution/admin accounts are excluded.

Two accessible bar charts show the top ten schools and home cities among the current enrollment reports matching the filters, across all pages. Each student contributes at most once. Blank/empty filters are genuine empty states. This sample includes only students who voluntarily submit a positive-helpfulness declaration, and is not representative evidence of overall platform effectiveness, verified admissions or school quality. Suspended-account reports stay included unless the account-status filter excludes them.

## Suspend / restore

The admin must open the deliberate confirmation dialog and provide a reason (1–2,000 characters). Suspension blocks authenticated access, increments the account token version and revokes refresh sessions. Restoring does not make old access tokens valid again. The student must sign in again. The API cannot target admin/institution accounts or change identity/ownership through body fields; stale expected-status requests receive 409.

Suspension and its private reason/email work are committed together. The reason is emailed to the stored account email, never an address supplied in the request. Provider acceptance is distinct from confirmed inbox delivery; failure remains visible with a bounded admin retry. Old/restored suspension notices are cancelled instead of resent. No real student is suspended by automated tests, and implementation does not send bulk mail.

## Operations

- Apply migration 029 using the normal reviewed migration workflow before deploying the API: it adds private enrollment/action tables and the auth-version column.
- Deploy backend first, then frontend. Existing access tokens without a version remain compatible while their account's version is zero.
- Do not run schema migration automatically during a build. No existing enrollments or positive declarations are invented.
- Review the added privacy disclosure and the existing project-owner contact/retention/minor-user policy gaps before wider release.
- Automated tests include filter/role/ownership checks and an opt-in rollback-only PostgreSQL test; they never need real student passwords, bank details or paid providers.
