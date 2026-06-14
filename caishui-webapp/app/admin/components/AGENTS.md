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
- Do not collapse pipeline startup failures to only `pipeline_unavailable`.

## Pipeline Status UI

- Status payloads may represent task progress or transport failure.
- UI should not assume every payload is a task.
- Use `pipeline-status-presenter.ts` for visible admin text.
