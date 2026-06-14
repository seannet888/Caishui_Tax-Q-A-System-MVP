// caishui-webapp/types/pipeline.ts
// 唯一类型契约：与 data-pipeline/output/schemas.py 保持结构同步（铁律三）。
// 禁止在此文件以外重新定义 PipelineOutput / ChunkOutput / TaxMetadata。

export type DocType =
  | "regulation"
  | "announcement"
  | "notice"
  | "interpretation"
  | "case"
  | "guide";

export type ChunkType = "text" | "table" | "image_caption";

export interface TaxMetadata {
  doc_number?: string;
  article_number?: string;
  publish_date?: string; // ISO 8601 date string
  effective_date?: string;
  expire_date?: string | null;
  is_expired: boolean;
  jurisdiction?: string;
  issuing_body?: string;
  source_channel?: string;
  source_page?: number;
  source_section?: string;
  has_table: boolean;
  has_formula: boolean;
  // 检索/排序用，部分场景从 chunk 字段冗余
  doc_type?: DocType;
  authority_rank?: number;
}

export interface ChunkOutput {
  chunk_id: string; // Pipeline 稳定位置 ID；写库后映射为 pipeline_chunk_id
  document_id: string;
  chunk_index: number;
  chunk_type: ChunkType;
  content: string;
  content_hash: string;
  embedding: number[] | null;
  embedding_model: string | null;
  metadata: TaxMetadata;
  created_at: string;
}

export interface PipelineOutput {
  task_id: string;
  document_id: string;
  status: "success" | "partial_failure" | "failed";
  chunks: ChunkOutput[];
  total_chunks: number;
  processing_time_ms: number;
  errors: string[];
  created_at: string;
}
