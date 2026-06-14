export interface DeterministicSmokeRetrievalInput {
  verifiedChunkIds: string[];
}

export interface DeterministicSmokeRetrievalResult {
  chunks: Array<{ id: string }>;
}

export function retrieveVerifiedSmokeChunks(
  input: DeterministicSmokeRetrievalInput,
): DeterministicSmokeRetrievalResult {
  return {
    chunks: input.verifiedChunkIds.map((id) => ({ id })),
  };
}
