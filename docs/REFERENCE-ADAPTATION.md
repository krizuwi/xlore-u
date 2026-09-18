# STI Vio-Log reference adaptation

The supplied STI Vio-Log archive was used as an architectural reference only. No violation, clearance, student-discipline, private credential, or institution-specific business logic was copied into Xlore U.

## Patterns adopted

- PostgreSQL rather than the earlier MySQL/Docker development database
- The `pg` Node.js driver with a bounded connection pool
- `DATABASE_URL` configuration compatible with Supabase
- Ordered SQL migrations and a `schema_migrations` tracking table
- One transaction per migration plus an advisory migration lock
- Separate backend configuration, routes, middleware, services, utilities, and tests
- A backend health endpoint that checks database connectivity
- Environment-only secrets and a frontend API base URL
- A hosted database workflow that does not require Docker Desktop

## Xlore U-specific implementation

The following remain purpose-built for Xlore U:

- Users and verified student accounts
- Institutions, SHS strands, programs, and institution offerings
- Tuition, scholarship, accreditation, and map information
- Profile assessments and explainable recommendation scores
- Saved schools/programs, comparisons, and student dashboard history

## Database choice

The adapted system uses PostgreSQL hosted by Supabase. The Express backend connects through the private PostgreSQL connection string using `pg`. The browser never receives that connection string and never queries the Xlore U tables directly.

For local development on a typical IPv4 desktop, use the Supabase Session pooler URL on port 5432. For a future serverless deployment, use the provider's Transaction pooler instructions and review driver limitations before changing modes.
