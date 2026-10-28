import type {
  ConversionJobState,
  EasyConvertApi,
} from "../../../shared/desktopContract";

export async function waitForDesktopJob(
  api: EasyConvertApi,
  jobId: string,
  signal?: AbortSignal,
): Promise<string> {
  let removeAbortListener: () => void = () => {};
  let unsubscribe: () => void = () => {};
  signal?.throwIfAborted();

  try {
    return await new Promise<string>((resolve, reject) => {
      const handleAbort = (): void => {
        reject(
          signal?.reason ??
            new DOMException("Conversion cancelled.", "AbortError"),
        );
      };

      signal?.addEventListener("abort", handleAbort, { once: true });

      removeAbortListener = () => {
        signal?.removeEventListener("abort", handleAbort);
      };

      const handleState = (state: ConversionJobState): void => {
        if (state.status === "idle" || state.jobId !== jobId) {
          return;
        }

        if (state.status === "running") {
          return;
        }

        if (state.status === "succeeded") {
          resolve(state.resultId);
          return;
        }

        if (state.status === "failed") {
          reject(new Error(state.message));
          return;
        }

        if (state.status === "cancelled") {
          reject(new Error("Conversion cancelled."));
        }
      };

      unsubscribe = api.onJobStateChanged(handleState);

      void api.getJobState().then((state) => {
        if (state.status === "idle" || state.jobId !== jobId) {
          reject(new Error("Job is no longer available."));
          return;
        }

        handleState(state);
      }, reject);
    });
  } finally {
    removeAbortListener();
    unsubscribe();
  }
}
