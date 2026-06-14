import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PipelineContractShape {
  docTypeValues: string[];
  chunkTypeValues: string[];
  taxMetadataFields: string[];
  chunkOutputFields: string[];
  pipelineOutputFields: string[];
}

export interface PipelineContractParity {
  typescript: PipelineContractShape;
  python: PipelineContractShape;
}

export function readPipelineContractParity(input?: {
  typescriptPath?: string;
  pythonPath?: string;
}): PipelineContractParity {
  const typescriptSource = readFileSync(
    input?.typescriptPath ?? join(process.cwd(), "types", "pipeline.ts"),
    "utf8",
  );
  const pythonSource = readFileSync(
    input?.pythonPath ??
      join(process.cwd(), "..", "data-pipeline", "output", "schemas.py"),
    "utf8",
  );

  return {
    typescript: {
      docTypeValues: readTypeScriptUnionValues(typescriptSource, "DocType"),
      chunkTypeValues: readTypeScriptUnionValues(typescriptSource, "ChunkType"),
      taxMetadataFields: readTypeScriptInterfaceFields(
        typescriptSource,
        "TaxMetadata",
      ),
      chunkOutputFields: readTypeScriptInterfaceFields(
        typescriptSource,
        "ChunkOutput",
      ),
      pipelineOutputFields: readTypeScriptInterfaceFields(
        typescriptSource,
        "PipelineOutput",
      ),
    },
    python: {
      docTypeValues: readPythonEnumValues(pythonSource, "DocType"),
      chunkTypeValues: readPythonEnumValues(pythonSource, "ChunkType"),
      taxMetadataFields: readPythonModelFields(pythonSource, "TaxMetadata"),
      chunkOutputFields: readPythonModelFields(pythonSource, "ChunkOutput"),
      pipelineOutputFields: readPythonModelFields(pythonSource, "PipelineOutput"),
    },
  };
}

function readTypeScriptUnionValues(source: string, typeName: string): string[] {
  const body = matchRequired(
    source,
    new RegExp(`export\\s+type\\s+${typeName}\\s*=([\\s\\S]*?);`, "m"),
    `TypeScript union ${typeName}`,
  );
  return readQuotedValues(body);
}

function readTypeScriptInterfaceFields(
  source: string,
  interfaceName: string,
): string[] {
  const body = matchRequired(
    source,
    new RegExp(`export\\s+interface\\s+${interfaceName}\\s*{([\\s\\S]*?)}`, "m"),
    `TypeScript interface ${interfaceName}`,
  );
  return [...body.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??:/gm)].map(
    (match) => requiredCapture(match, 1),
  );
}

function readPythonEnumValues(source: string, enumName: string): string[] {
  const body = readPythonClassBody(source, enumName);
  return readQuotedValues(body);
}

function readPythonModelFields(source: string, modelName: string): string[] {
  const body = readPythonClassBody(source, modelName);
  return [...body.matchAll(/^ {4}([A-Za-z_][A-Za-z0-9_]*):/gm)].map(
    (match) => requiredCapture(match, 1),
  );
}

function readPythonClassBody(source: string, className: string): string {
  return matchRequired(
    source,
    new RegExp(`class\\s+${className}\\([^\\n]+\\):\\n([\\s\\S]*?)(?=\\nclass\\s|\\n# ─|$)`),
    `Python class ${className}`,
  );
}

function readQuotedValues(source: string): string[] {
  return [...source.matchAll(/"([^"]+)"/g)].map((match) =>
    requiredCapture(match, 1),
  );
}

function matchRequired(
  source: string,
  pattern: RegExp,
  label: string,
): string {
  const match = source.match(pattern);
  if (!match?.[1]) {
    throw new Error(`contract_parity_missing:${label}`);
  }
  return match[1];
}

function requiredCapture(match: RegExpMatchArray, index: number): string {
  const value = match[index];
  if (!value) {
    throw new Error(`contract_parity_missing_capture:${index}`);
  }
  return value;
}
