import { randomUUID } from "node:crypto";

let currentResults = new Map<string, string>();

export function registerResults(paths: readonly string[]): string[] {
  if (paths.length === 0 || paths.length > 100) {
    throw new Error("Invalid number of paths provided.");
  }

  const nextResults = new Map<string, string>();
  const resultIds: string[] = [];

  for (const path of paths) {
    const resultId = randomUUID();

    nextResults.set(resultId, path);
    resultIds.push(resultId);
  }

  currentResults = nextResults;

  return resultIds;
}

export function registerResult(path: string): string {
  return registerResults([path])[0]!;
}

export function getResultPath(resultId: string): string {
  const path = currentResults.get(resultId);

  if (path === undefined) {
    throw new Error("Unknown result.");
  }

  return path;
}

export function clearResult(): void {
  currentResults.clear();
}
