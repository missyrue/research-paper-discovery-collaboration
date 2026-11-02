const DEFAULT_MODEL = "nomic-embed-text";
const DEFAULT_DIMENSIONS = 768;
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

export function getEmbeddingConfig() {
  const model = process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL;
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? DEFAULT_DIMENSIONS);
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
  if (!Number.isInteger(dimensions) || dimensions < 1) {
    throw new Error("EMBEDDING_DIMENSIONS must be a positive integer.");
  }
  return { model, dimensions, baseUrl };
}

export async function embedTexts(
  inputs: string[],
  purpose: "document" | "query" = "document",
): Promise<number[][]> {
  if (inputs.length === 0 || inputs.length > 64) {
    throw new Error("An embedding batch must contain 1 to 64 inputs.");
  }
  const { model, dimensions, baseUrl } = getEmbeddingConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: inputs.map((input) => `${purpose === "document" ? "search_document" : "search_query"}: ${input}`),
        truncate: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach local Ollama at ${baseUrl}. Start Ollama and pull ${model}. (${detail})`);
  }

  const responseBody = await response.text();
  let result: { embeddings?: number[][]; error?: string };
  try {
    result = JSON.parse(responseBody) as typeof result;
  } catch {
    throw new Error(responseBody.trim()
      ? `Ollama returned a non-JSON response (HTTP ${response.status}).`
      : `Ollama returned an empty response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(result.error ?? `Ollama embedding request failed (HTTP ${response.status}).`);
  }

  const vectors = result.embeddings;
  if (!vectors || vectors.length !== inputs.length || vectors.some((vector) =>
    vector.length !== dimensions || !vector.every(Number.isFinite))) {
    throw new Error(`Ollama must return ${inputs.length} vectors of ${dimensions} finite values.`);
  }
  return vectors;
}

export async function embedText(input: string): Promise<number[]> {
  return (await embedTexts([input], "query"))[0];
}
