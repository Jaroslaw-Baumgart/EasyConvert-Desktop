import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

let currentResults = new Map<string, string>();
let currentDirectory: string | null = null;

export function registerResults(
  paths: readonly string[],
  directory: string,
): string[] {
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

  clearResult();
  currentResults = nextResults;
  currentDirectory = directory;

  return resultIds;
}

export function registerResult(path: string, directory: string): string {
  return registerResults([path], directory)[0]!;
}

export function getResultPath(resultId: string): string {
  const path = currentResults.get(resultId);

  if (path === undefined) {
    throw new Error("Unknown result.");
  }

  return path;
}

export async function clearResult(): Promise<void> {
  currentResults.clear();
  const directoryToRemove = currentDirectory;
  currentDirectory = null;

  if (directoryToRemove) {
    try {
      await rm(directoryToRemove, { recursive: true, force: true });
    } catch (error: unknown) {
      console.error("Could not remove the result directory.", error);
    }
  }
}
