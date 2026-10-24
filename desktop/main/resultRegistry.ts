import { randomUUID } from "node:crypto";

type RegisteredResult = {
  resultId: string;
  path: string;
};

let currentResult: RegisteredResult | null = null;

export function registerResult(path: string): string {
  const resultId = randomUUID();
  currentResult = { resultId, path };
  return resultId;
}

export function getResultPath(resultId: string): string {
  if (!currentResult || currentResult.resultId !== resultId) {
    throw new Error("Unknown result.");
  }
  return currentResult.path;
}

export function clearResult(): void {
  currentResult = null;
}
