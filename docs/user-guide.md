# Student and administrator guide

Source reviewed **19 October 2026**. Screen labels and available records may change through admin settings.

## Student walkthrough

### 1. Explore schools and programs

Use **Schools** to search/filter institutions and open **View details** for programs, tuition information, scholarship/accreditation details, media, and location. School-card actions stay at the bottom of each card. Use **Programs** to explore categories, degree levels, requirements, careers, and offering schools. Unknown fees are not a zero-cost promise.

The map page searches the school directory and displays the selected school's coordinates in Google Maps. Schools without a campus pin use a name/address search instead. It is not a route-duration calculator.

### 2. Create an account or sign in

Email registration requires name parts, address, email, matching passwords, and the unchecked-by-default agreement. Open Terms/Privacy links to read them; then enter the verification code from email. Password recovery also uses an emailed code.

Google sign-in is available when configured. If it would create a new account, the system asks for agreement first. Existing accounts are not forced to register again. Do not share passwords or email verification/reset codes during a demo.

### 3. Complete the assessment

The starting bank has 15 career questions and five practical questions. Answer all currently active questions, then follow the profile-specific choices. A tie may ask you to choose between leading profiles. Complete the configured career-launch follow-up when shown.

The assessment is a rule-based exploration tool, not an aptitude test or admission guarantee. Practical answers do not contribute career-profile votes. One completed attempt is the default; the administrator can explicitly change that policy.

On results, use the program search/category/degree controls and the separate school filters. **See more / Show fewer** changes how much is displayed, not your answers. Filtering does not rescore the assessment. If there are no matches, explain the selected field/filters and missing catalog data instead of inventing recommendations.

### 4. Save and compare

Use the shared heart save controls for schools/programs, then open **Saved** to revisit them. Compare up to three schools. The comparison includes school information and actual program offerings; tuition can differ by school. Remove an item to make space before adding a fourth.

### 5. Dashboard and profile

The dashboard summarizes account activity and assessment-related schools. Its slideshow uses a fixed responsive frame and 10-second timer. Previous/next and pause/play controls remain available. Hidden tabs pause playback; reduced-motion users initially start paused. Focus can pause playback for reading; explicit Play resumes it.

In **Profile**, update your details. You may open the optional home-pin map, select/enter coordinates or request device location while at home, confirm the pin, and save changes. Address changes invalidate an old pin; you can remove it. Never select a classroom location and describe it as the student's home.

Distances prefer a saved home pin, otherwise a labeled city-center estimate if recognized. They are straight-line kilometres, not a Google Maps driving distance, travel time, or guarantee of geolocation accuracy.

### 6. Feedback and inactivity

Verified student accounts can give section feedback when prompted. Submissions are limited by section and release; the existing response is not silently overwritten. A 20-minute inactivity notice asks whether you are still there; it is not an automatic logout or assessment reset. See [engagement behavior](engagement.md).

## Administrator walkthrough

Open `/admin/login` and use an authorized, verified account. Ordinary students cannot gain admin access by entering an admin URL. The sign-in field is not prefilled with the administrator's identity.

| Area | What to do |
| --- | --- |
| Dashboard | Check live catalog counts, collection activity, service health, recent logs, and feedback |
| Universities | Add/edit/archive school records; maintain coordinates, official sites, logos, campus photos, and credits |
| Programs | Add/edit/archive programs; choose interest tags, search offering schools, and enter known per-semester fees |
| Categories | Manage program category assignments; compact lists/expansion keep long content manageable |
| Assessment | Edit core questions/mappings and routing/result settings; preview before changing the live configuration |
| Scraping overview/automation | Review trusted school sources, enable/disable sources, choose mode/schedule, and start an intended university-specific run |
| Run results | Search/filter/paginate finished runs; inspect source outcomes, returned records, and saved changes |
| Settings/logs | Review saved workspace settings and administrator/catalog activity |

For media, upload alone does not attach an asset: save the university record. Supported backend uploads are PNG, JPEG, and WebP up to 4 MB; supply source/permission information. Missing logos show initials.

Assessment edits affect new submissions, not an automatic rescore of old answers. Core roles must remain valid; settings saves can reject a stale version or invalid references. Preview does not consume a student attempt. Do not delete/reset real student results for a demonstration.

Collection can change catalog data and consume AI credits. Check the selected university, sources, and mode before starting. A blocked source needs permission, a valid official source, or verified manual maintenance—not a bypass. A saved schedule does not create Vercel cron.

## A safe demonstration

1. Show public directories and school details.
2. Sign in with an approved demo account; do not expose real student data.
3. Use an existing saved result or admin preview instead of resetting an account.
4. Demonstrate filters, saves, comparison, and dashboard controls.
5. Explain a labeled distance estimate and optional home pin without displaying a real home.
6. Show admin settings/history read-only; do not start paid collection simply to demonstrate a button.

Policy pages are still drafts until owner review is complete. Describe planned safeguards as planned, not as already implemented.
