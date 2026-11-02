const MODEL_DEFAULT = "text-embedding-3-small";
const DIMENSIONS_DEFAULT = 1536;

export function getEmbeddingConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY in apps/web/.env.local to enable semantic search.");
  const model = process.env.EMBEDDING_MODEL ?? MODEL_DEFAULT;
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? DIMENSIONS_DEFAULT);
  if (!Number.isInteger(dimensions) || dimensions < 1) throw new Error("EMBEDDING_DIMENSIONS must be a positive integer.");
  return { apiKey, model, dimensions };
}

export async function embedText(input: string): Promise<number[]> {
  const { apiKey, model, dimensions } = getEmbeddingConfig();
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: input.slice(0, 8000), dimensions }),
    cache: "no-store",
  });
  const result = await response.json() as { data?: Array<{ embedding?: number[] }>; error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message ?? `Embedding request failed (${response.status}).`);
  const vector = result.data?.[0]?.embedding;
  if (!vector || vector.length !== dimensions || !vector.every(Number.isFinite)) {
    throw new Error(`Embedding response did not contain ${dimensions} finite vector values.`);
  }
  return vector;
}
