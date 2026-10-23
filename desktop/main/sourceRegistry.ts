import { randomUUID } from "node:crypto";

type RegisteredSource = {
  sourceId: string;
  path: string;
};

let currentSource: RegisteredSource | null = null;

export function registerSource(path: string): string {
  const newSourceId = randomUUID();
  currentSource = { sourceId: newSourceId, path };
  return newSourceId;
}

export function getSourcePath(sourceId: string): string {
  if (!currentSource || currentSource.sourceId !== sourceId) {
    throw new Error("Unknown source.");
  }
  return currentSource.path;
}

export function clearSource(): void {
  currentSource = null;
}
