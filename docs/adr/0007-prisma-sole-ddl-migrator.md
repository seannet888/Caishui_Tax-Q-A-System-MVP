# Prisma is the sole DDL migrator, even for the Python service's table

All database DDL is owned by Prisma migrations — including `ingest_tasks`, a table that only the Python `data-pipeline` reads and writes. The pipeline runs **no Alembic**, never calls `create_all`, and treats `db/models.py` as a hand-written *mirror* of the Prisma-managed schema for ORM convenience only.

## Why

One database, one source of truth for its shape. Two migrators against the same Postgres instance (Prisma + Alembic) race, produce divergent histories, and make "what is the real schema?" unanswerable. Centralising on Prisma keeps migrations linear and reviewable in one place.

## The cost, and the guard

The hand-written SQLAlchemy mirror can silently drift from the real table; a mismatch would otherwise surface as a random runtime query error. To convert silent drift into a loud boot-time failure, the pipeline runs `check_ingest_tasks_schema` at FastAPI startup: it reflects `ingest_tasks` from `information_schema.columns` and asserts the model's column names and nullability match, failing fast (with "run Prisma migrations first") otherwise.

## Consequences

- Do **not** add Alembic to `data-pipeline`, and do **not** "fix" the mirror by having Python create/alter the table. Schema changes go through a Prisma migration; then update `db/models.py` to match.
- Extra columns present in the DB but absent from the model are tolerated (Prisma may land ahead of the mirror); missing columns or nullability mismatches fail startup.
