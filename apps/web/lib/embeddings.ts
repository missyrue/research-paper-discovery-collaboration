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

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0 || inputs.length > 64) throw new Error("An embedding batch must contain 1 to 64 inputs.");
  const { apiKey, model, dimensions } = getEmbeddingConfig();
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: inputs.map((input) => input.slice(0, 8000)), dimensions }),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json() as { data?: Array<{ index: number; embedding?: number[] }>; error?: { message?: string } };
      if (!response.ok) {
        const error = new Error(result.error?.message ?? `Embedding request failed (${response.status}).`);
        if (response.status !== 429 && response.status < 500) {
          error.name = "NonRetryableEmbeddingError";
          throw error;
        }
        lastError = error;
      } else {
        const ordered = [...(result.data ?? [])].sort((a, b) => a.index - b.index);
        const vectors = ordered.map((item) => item.embedding);
        if (vectors.length !== inputs.length || vectors.some((vector) => !vector || vector.length !== dimensions || !vector.every(Number.isFinite))) {
          throw new Error(`Embedding response must contain ${inputs.length} vectors of ${dimensions} finite values.`);
        }
        return vectors as number[][];
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Embedding request failed.");
      if (lastError.name === "NonRetryableEmbeddingError") throw lastError;
      if (attempt === 2) throw lastError;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
  }
  throw lastError ?? new Error("Embedding request failed.");
}

export async function embedText(input: string): Promise<number[]> {
  return (await embedTexts([input]))[0];
}
