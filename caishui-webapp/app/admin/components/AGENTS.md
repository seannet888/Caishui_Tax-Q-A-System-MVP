# AGENTS.md

Local rules for admin upload/status UI Modules.

## Owning Modules

- `UploadForm.tsx` owns upload form interaction.
- `upload-response-presenter.ts` owns upload success/failure response projection.
- `pipeline-status-presenter.ts` owns admin-facing projection of pipeline status payloads.
- `PipelineStatus.tsx` renders task progress or visible error messages from the presenter.

## Upload Failure Visibility

- Pipeline-start failures must persist `SourceDocument.error_message`, return the failed `sourceDocumentId`, and keep a link target to the failed SourceDocument.
- Upload UI should show `detail` from `/api/upload` when present.
- Duplicate-source responses use `detail`/`documentId` as the existing SourceDocument link target, not as a visible error message. Present a stable human-readable duplicate-source message instead of `Error: <documentId>`.
- Do not collapse pipeline startup failures to only `pipeline_unavailable`.

## Trusted Source Auto Verification

- Upload UI defaults official-source imports to "可信来源自动核验" by checking `seedVerified=true`.
- This is still the explicit seed verification path; do not silently verify uploads without the form field.
- Chunk review UI is for exceptions, retries, rejection, and spot checks. Do not force a normal trusted official import through per-chunk human review before retrieval readiness.
- If an administrator unchecks trusted auto verification, chunks remain unverified and require reviewer/human verification before embedding/retrieval.

## Pipeline Status UI

- Status payloads may represent task progress or transport failure.
- UI should not assume every payload is a task.
- Use `pipeline-status-presenter.ts` for visible admin text.
