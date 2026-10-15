import { describe, expect, it } from "vitest";
import type { ConvertedResults } from "../types/conversionResult";

import {
  conversionReducer,
  initialConversionState,
  type ConversionAction,
  type ConversionState,
} from "./conversionReducer";

const createTestFile = {
  pdf: (name = "document.pdf") =>
    new File(["source"], name, {
      type: "application/pdf",
    }),

  jpg: (name = "converted.jpg") =>
    new File(["result"], name, {
      type: "image/jpeg",
    }),
};

const sourceFile = createTestFile.pdf();

const createConvertedResult = (name: string) => ({
  url: `http://localhost:5000/output/${name}`,
  file: createTestFile.jpg(name),
});

const convertedResults = [
  createConvertedResult("page-1.jpg"),
  createConvertedResult("page-2.jpg"),
] satisfies ConvertedResults;

const conversionErrorMessage = "The file could not be converted.";
const downloadErrorMessage = "The converted file could not be downloaded.";

const activeRequestId = 2;
const staleRequestId = 1;

const createTestState = {
  ready: () => ({
    kind: "ready" as const,
    file: sourceFile,
  }),
  loading: (requestId = activeRequestId) => ({
    kind: "loading" as const,
    file: sourceFile,
    requestId,
  }),
  success: () => ({
    kind: "success" as const,
    file: sourceFile,
    convertedResults,
  }),
  conversionError: () => ({
    kind: "conversionError" as const,
    file: sourceFile,
    error: conversionErrorMessage,
  }),
  downloadError: () => ({
    kind: "downloadError" as const,
    file: sourceFile,
    convertedResults,
    error: downloadErrorMessage,
  }),
};

const invalidTransitions = [
  {
    name: "conversion success from ready",
    state: createTestState.ready(),
    action: {
      type: "conversionSucceeded",
      convertedResults,
      requestId: activeRequestId,
    },
  },
  {
    name: "conversion failure from ready",
    state: createTestState.ready(),
    action: {
      type: "conversionFailed",
      error: conversionErrorMessage,
      requestId: activeRequestId,
    },
  },
  {
    name: "download failure from ready",
    state: createTestState.ready(),
    action: {
      type: "downloadFailed",
      error: downloadErrorMessage,
    },
  },
  {
    name: "download success from ready",
    state: createTestState.success(),
    action: {
      type: "downloadSucceeded",
    },
  },
] satisfies readonly {
  name: string;
  state: ConversionState;
  action: ConversionAction;
}[];

describe("conversionReducer", () => {
  it("moves from empty to ready after selecting a file", () => {
    const nextState = conversionReducer(initialConversionState, {
      type: "fileSelected",
      file: sourceFile,
    });

    expect(nextState).toEqual(createTestState.ready());
  });

  it("moves from ready to empty after removing the file", () => {
    const nextState = conversionReducer(createTestState.ready(), {
      type: "fileRemoved",
    });

    expect(nextState).toEqual(initialConversionState);
  });

  it("moves from ready to loading after starting conversion", () => {
    const nextState = conversionReducer(createTestState.ready(), {
      type: "conversionStarted",
      requestId: activeRequestId,
    });

    expect(nextState).toEqual(createTestState.loading());
  });

  it("ignores conversion start when no file is selected", () => {
    const nextState = conversionReducer(initialConversionState, {
      type: "conversionStarted",
      requestId: activeRequestId,
    });

    expect(nextState).toBe(initialConversionState);
  });

  it("moves from loading to success with the converted files", () => {
    const nextState = conversionReducer(createTestState.loading(), {
      type: "conversionSucceeded",
      convertedResults,
      requestId: activeRequestId,
    });

    expect(nextState).toEqual(createTestState.success());
  });

  it("moves from loading to conversion error when conversion fails", () => {
    const nextState = conversionReducer(createTestState.loading(), {
      type: "conversionFailed",
      error: conversionErrorMessage,
      requestId: activeRequestId,
    });

    expect(nextState).toEqual(createTestState.conversionError());
  });

  it("retries conversion from the conversion error state", () => {
    const nextState = conversionReducer(createTestState.conversionError(), {
      type: "conversionStarted",
      requestId: activeRequestId,
    });

    expect(nextState).toEqual(createTestState.loading());
  });

  it("starts another conversion from the success state", () => {
    const nextState = conversionReducer(createTestState.success(), {
      type: "conversionStarted",
      requestId: activeRequestId,
    });

    expect(nextState).toEqual(createTestState.loading());
  });

  it("keeps the converted results when downloading it fails", () => {
    const nextState = conversionReducer(createTestState.success(), {
      type: "downloadFailed",
      error: downloadErrorMessage,
    });

    expect(nextState).toEqual(createTestState.downloadError());
  });

  it("clears the download error after a successful retry", () => {
    const nextState = conversionReducer(createTestState.downloadError(), {
      type: "downloadSucceeded",
    });

    expect(nextState).toEqual(createTestState.success());
  });

  it("starts another conversion from the download error state", () => {
    const nextState = conversionReducer(createTestState.downloadError(), {
      type: "conversionStarted",
      requestId: activeRequestId,
    });

    expect(nextState).toEqual(createTestState.loading());
  });

  it("clears the previous result after selecting a new file", () => {
    const newFile = createTestFile.pdf("new-document.pdf");

    const nextState = conversionReducer(createTestState.success(), {
      type: "fileSelected",
      file: newFile,
    });

    expect(nextState).toEqual({
      kind: "ready",
      file: newFile,
    });
  });

  it.each(["success", "conversionError", "downloadError"] as const)(
    "moves from %s to empty after removing the file",
    (kind) => {
      const currentState = createTestState[kind]();

      const nextState = conversionReducer(currentState, {
        type: "fileRemoved",
      });

      expect(nextState).toEqual(initialConversionState);
    },
  );

  it.each(invalidTransitions)("ignores $name", ({ state, action }) => {
    const nextState = conversionReducer(state, action);

    expect(nextState).toBe(state);
  });

  it("ignores a stale success from an older conversion request", () => {
    const activeState = createTestState.loading(activeRequestId);

    const staleAction = {
      type: "conversionSucceeded" as const,
      requestId: staleRequestId,
      convertedResults,
    };

    const nextState = conversionReducer(activeState, staleAction);

    expect(nextState).toBe(activeState);
  });

  it("ignores a stale failure from an older conversion request", () => {
    const activeState = createTestState.loading(activeRequestId);

    const staleAction = {
      type: "conversionFailed" as const,
      requestId: staleRequestId,
      error: conversionErrorMessage,
    };

    const nextState = conversionReducer(activeState, staleAction);

    expect(nextState).toBe(activeState);
  });
});
