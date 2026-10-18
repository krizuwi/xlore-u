Xlore U school logos — reviewed 19 October 2026

This folder contains public static assets. Do not store credentials, student
images, or other private files here.

The shared SchoolLogo component reads the school's logoUrl returned by the API.
It does NOT automatically discover an image from the school's UUID filename.
Missing or failed logos fall back to school initials.

Preferred workflow:
1. Open Admin > Universities > Edit university > School logo & campus photos.
2. Upload a permitted PNG, JPEG, or WebP image (up to 4 MB), or enter its HTTPS URL.
3. Add source/credit information and save the university. Uploading alone does
   not attach the asset to the school.

Backend uploads are persisted in PostgreSQL and served through
/api/school-media/:id. They are not written to this frontend folder.

If maintaining a bundled static logo here, a UUID-based filename can be a useful
convention, but the school record must explicitly reference its public path,
for example /school-logos/<school-id>.png. Adding the file alone is insufficient.
Bundled file changes require a frontend build/deployment.

Use only images the project is permitted to display. A school logo identifies
the institution; it does not imply endorsement.

See ../../docs/user-guide.md and the backend docs/school-media.md for details.
