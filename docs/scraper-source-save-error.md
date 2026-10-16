# Add university source: server error

The Automation dialog showed **“An unexpected server error occurred.”** when saving
a source for Air Link International Aviation College. The selected catalog URL
used the university's official domain, so URL validation passed.

The save failed on the first `catalog_sources` insert. The configured database
requires a non-null `catalog_sources.name`, while the new source endpoint did
not include that column. PostgreSQL returned error `23502` (`null value in
column "name" violates not-null constraint`). The transaction rolled back, so
the failed request did not add either source. The error middleware masks
unhandled database errors as the generic message shown in the dialog.

The endpoint now supplies `School profile` and `Program catalog` as source
names. Migration `022_catalog_source_name.sql` brings databases created from
this repository's older migrations into line with the required field. The
source insertion test checks that both names are supplied.
