import type { ConvertedResults } from "../types/conversionResult";

export type ConversionState =
  | {
      kind: "empty";
    }
  | {
      kind: "ready";
      file: File;
    }
  | {
      kind: "loading";
      file: File;
      requestId: number;
    }
  | {
      kind: "success";
      file: File;
      convertedResults: ConvertedResults;
    }
  | {
      kind: "conversionError";
      file: File;
      error: string;
    }
  | {
      kind: "downloadError";
      file: File;
      convertedResults: ConvertedResults;
      error: string;
    };

export type ConversionAction =
  | {
      type: "fileSelected";
      file: File;
    }
  | {
      type: "fileRemoved";
    }
  | {
      type: "conversionStarted";
      requestId: number;
    }
  | {
      type: "conversionSucceeded";
      requestId: number;
      convertedResults: ConvertedResults;
    }
  | {
      type: "conversionFailed";
      requestId: number;
      error: string;
    }
  | {
      type: "downloadFailed";
      error: string;
    }
  | {
      type: "downloadSucceeded";
    };

function assertNever(value: never): never {
  throw new Error(`Unhandled conversion action: ${JSON.stringify(value)}`);
}

export const initialConversionState: ConversionState = {
  kind: "empty",
};

export function conversionReducer(
  state: ConversionState,
  action: ConversionAction,
): ConversionState {
  switch (action.type) {
    case "fileSelected":
      return {
        kind: "ready",
        file: action.file,
      };

    case "fileRemoved":
      return {
        kind: "empty",
      };

    case "conversionStarted":
      if (
        state.kind !== "ready" &&
        state.kind !== "conversionError" &&
        state.kind !== "success" &&
        state.kind !== "downloadError"
      ) {
        return state;
      }

      return {
        kind: "loading",
        file: state.file,
        requestId: action.requestId,
      };

    case "conversionSucceeded":
      if (state.kind !== "loading" || state.requestId !== action.requestId) {
        return state;
      }

      return {
        kind: "success",
        file: state.file,
        convertedResults: action.convertedResults,
      };

    case "conversionFailed":
      if (state.kind !== "loading" || state.requestId !== action.requestId) {
        return state;
      }

      return {
        kind: "conversionError",
        file: state.file,
        error: action.error,
      };

    case "downloadFailed":
      if (state.kind !== "success") {
        return state;
      }

      return {
        kind: "downloadError",
        file: state.file,
        convertedResults: state.convertedResults,
        error: action.error,
      };

    case "downloadSucceeded":
      if (state.kind !== "downloadError") {
        return state;
      }

      return {
        kind: "success",
        file: state.file,
        convertedResults: state.convertedResults,
      };
  }

  return assertNever(action);
}
