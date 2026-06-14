# Pipeline service trust boundary uses signed short-lived principals

The WebApp signs every call to the data pipeline with HMAC-SHA256 using
`PIPELINE_SHARED_SECRET`. The canonical message binds auth version, Unix
timestamp, HTTP method, request path, actor ID, and sorted roles. The pipeline
accepts at most five minutes of clock skew and constructs its audit principal
only from the verified headers.

Multipart fields are untrusted domain input. They never supply `actor_id`,
`verified_by`, or roles. Seed ingestion additionally requires the signed
principal to contain the explicit `admin` role.

`/ingest`, `/preview`, and `/status/*` require this service credential.
`/health` remains unauthenticated for container health checks. In Compose the
pipeline port is exposed only to the internal network, not published to the
host. HMAC authentication is still mandatory because network placement alone
is not an identity boundary.
