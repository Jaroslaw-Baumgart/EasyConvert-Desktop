import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

type RegisteredSource = {
  sourceId: string;
  path: string;
  originalPath: string;
  directory: string;
};

let currentSource: RegisteredSource | null = null;

export function getCurrentSourcePath(): string | null {
  return currentSource?.path ?? null;
}

export function registerSource(
  path: string,
  originalPath: string,
  directory: string,
): string {
  const newSourceId = randomUUID();
  clearSource();
  currentSource = {
    sourceId: newSourceId,
    path,
    originalPath,
    directory,
  };
  return newSourceId;
}

export function getSourcePath(sourceId: string): string {
  if (!currentSource || currentSource.sourceId !== sourceId) {
    throw new Error("Unknown source.");
  }
  return currentSource.path;
}

export function clearSource(): void {
  const directory = currentSource?.directory;
  currentSource = null;

  if (directory) {
    void rm(directory, { recursive: true, force: true }).catch(
      (error: unknown) => {
        console.error("Could not remove the source copy.", error);
      },
    );
  }
}

export function getOriginalSourcePath(): string | null {
  return currentSource?.originalPath ?? null;
}

export function getCurrentSourceDirectory(): string | null {
  return currentSource?.directory ?? null;
}
