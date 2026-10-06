# School logos and campus photos

Run `npm run migrate` after pulling the frontend and backend updates. Migrations
014 and 015 add media fields and a private-to-the-database asset table. Existing
school/program/tuition data is preserved. No scheduled scrape downloads images.

In **Admin → Universities → Edit university → School logo & campus photos**:

1. Upload a logo or enter its direct HTTPS image URL.
2. Upload campus photos or choose **Add campus photo** to enter image URLs.
3. Add captions, photographers/owners, source pages and license information.
4. Use arrows to reorder photos or the remove button to remove a slide.
5. Click **Save university**. Uploading a file alone does not attach it to a school.

Accepted uploads are PNG, JPEG and WebP, at most 5 MB each, up to 10 slides per
school. SVG/HTML uploads are rejected. Uploaded school images are public assets
stored persistently in PostgreSQL, not the Vercel filesystem; file uploads
therefore need no separate storage keys. Only the verified administrator can
upload or change them. A future large image collection should use object storage
to avoid consuming the database's storage quota. Replacing an image creates a new
asset; old/unattached uploads are retained (no destructive automatic cleanup).

The initial schools have logos and reviewed source credits. Eight schools have
two campus images. STI Global City's official website refuses cross-site image
embedding, so its photos are intentionally empty for the team to supply; its
school logo is provided through the Wikipedia file source. Do not replace it with
another STI campus. Images may be archival; captions identify archival images.

Photos rotate every five seconds, with previous/next and pause/play controls.
Reduced-motion users start paused. Rotation pauses while the page is hidden or
the banner is hovered/focused. Missing images are skipped; no available images
show a neutral banner. Logos fall back to school initials when unavailable.

Use only photos you own or have permission to display. Creative Commons sources
have photographer/source/license information displayed on the banner. School
logos identify institutions, not endorsement; third-party school branding retains
its trademark rights. Source URLs may change, so administrators should review
them periodically. Public GET `/api/school-media/:id` serves only uploaded images.
