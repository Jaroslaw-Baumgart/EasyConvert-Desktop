import { useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  conversionReducer,
  initialConversionState,
} from "../reducers/conversionReducer";
import type { ConversionOption } from "../types/converter";
import { ConversionError, isConversionErrorCode } from "../api/conversionError";
import type { ConversionSettings } from "../schemas/conversionSettings";
import type {
  ConvertedResult,
  ConvertedResults,
} from "../types/conversionResult";
import { convertDesktopFile } from "../api/desktopConversionClient";
import { createConversionRequest } from "../api/createConversionRequest";

type UseConversionResult = {
  file: File | null;
  convertedResults: ConvertedResults | null;
  conversionError: string | null;
  isConverting: boolean;
  isPreparingArchive: boolean;
  isRemoving: boolean;
  isSaving: boolean;
  selectFile: (selectedFile: File, sourceId?: string) => void;
  removeFile: () => Promise<void>;
  convert: (
    option: ConversionOption,
    settings?: ConversionSettings,
  ) => Promise<void>;
  downloadConvertedFile: (
    result: ConvertedResult,
    saveAs?: boolean,
  ) => Promise<void>;
  downloadAllConvertedFiles: (saveAs?: boolean) => Promise<void>;
  savedFileName: string | null;
  dismissSaveNotification: () => void;
};

export function useConversion(): UseConversionResult {
  const { t } = useTranslation();
  const [conversionState, dispatch] = useReducer(
    conversionReducer,
    initialConversionState,
  );

  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sourceIdRef = useRef<string | null>(null);
  const removalPendingRef = useRef(false);
  const savingPendingRef = useRef(false);

  const [isRemoving, setIsRemoving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingArchive, setIsPreparingArchive] = useState(false);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [savedFileName, setSavedFileName] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const file = conversionState.kind === "empty" ? null : conversionState.file;

  const isConverting = conversionState.kind === "loading";

  const convertedResults =
    conversionState.kind === "downloadError" ||
    conversionState.kind === "success"
      ? conversionState.convertedResults
      : null;

  const stateError =
    conversionState.kind === "downloadError" ||
    conversionState.kind === "conversionError"
      ? conversionState.error
      : null;

  const conversionError =
    removalError ??
    (stateError && isConversionErrorCode(stateError)
      ? t(`errors.${stateError}`)
      : stateError);

  const isFileActionPending = (): boolean =>
    removalPendingRef.current || savingPendingRef.current;

  const isConversionPending = (): boolean =>
    isConverting ||
    (abortControllerRef.current !== null &&
      !abortControllerRef.current.signal.aborted);

  const isCurrentRequest = (requestId: number): boolean =>
    isMountedRef.current && requestIdRef.current === requestId;

  const invalidatePendingWork = (): void => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    setIsPreparingArchive(false);
  };

  const reportDownloadError = (cause: unknown): void => {
    const error = new ConversionError("download-failed", cause);
    console.error(error);
    dispatch({ type: "downloadFailed", error: error.code });
  };

  const selectFile = (selectedFile: File, sourceId?: string) => {
    if (!isMountedRef.current || isFileActionPending()) return;
    setRemovalError(null);
    sourceIdRef.current = sourceId ?? null;
    invalidatePendingWork();
    dispatch({
      type: "fileSelected",
      file: selectedFile,
    });
  };

  const removeFile = async (): Promise<void> => {
    if (
      !isMountedRef.current ||
      !file ||
      isFileActionPending() ||
      isConversionPending()
    ) {
      return;
    }

    removalPendingRef.current = true;
    setIsRemoving(true);
    setRemovalError(null);

    try {
      await window.easyConvert.resetSource();

      if (!isMountedRef.current) return;

      sourceIdRef.current = null;
      invalidatePendingWork();

      dispatch({ type: "fileRemoved" });
    } catch (error: unknown) {
      if (!isMountedRef.current) return;

      setRemovalError(
        error instanceof Error ? error.message : "Could not remove the file.",
      );
    } finally {
      removalPendingRef.current = false;

      if (isMountedRef.current) {
        setIsRemoving(false);
      }
    }
  };

  const convert = async (
    option: ConversionOption,
    settings?: ConversionSettings,
  ): Promise<void> => {
    if (
      !isMountedRef.current ||
      !file ||
      isFileActionPending() ||
      isConversionPending()
    ) {
      return;
    }

    invalidatePendingWork();
    const requestId = requestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    dispatch({ type: "conversionStarted", requestId });

    try {
      if (!window.easyConvert) {
        throw new Error("Desktop API is unavailable.");
      }

      const sourceId = sourceIdRef.current;

      if (!sourceId) {
        throw new Error("Select the file using the native dialog.");
      }

      const request = createConversionRequest(
        sourceId,
        option.conversionType,
        settings,
      );

      const convertedResults = await convertDesktopFile(
        window.easyConvert,
        request,
        file.name,
        controller.signal,
      );

      if (!isCurrentRequest(requestId) || controller.signal.aborted) return;

      dispatch({
        type: "conversionSucceeded",
        convertedResults,
        requestId,
      });
    } catch (err: unknown) {
      if (!isCurrentRequest(requestId) || controller.signal.aborted) return;
      console.error(err);

      const errorCode =
        err instanceof ConversionError ? err.code : "conversion-failed";

      dispatch({
        type: "conversionFailed",
        error: errorCode,
        requestId,
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const downloadConvertedFile = async (
    result: ConvertedResult,
    saveAs = false,
  ): Promise<void> => {
    if (
      !isMountedRef.current ||
      isFileActionPending() ||
      isConversionPending()
    ) {
      return;
    }

    const requestId = requestIdRef.current;
    savingPendingRef.current = true;
    setSavedFileName(null);
    setIsSaving(true);

    try {
      const response = saveAs
        ? await window.easyConvert.saveResultAs(result.resultId)
        : await window.easyConvert.saveResult(result.resultId);

      if (!isCurrentRequest(requestId) || response.status === "cancelled")
        return;

      setSavedFileName(response.fileName);

      dispatch({ type: "downloadSucceeded" });
    } catch (cause: unknown) {
      if (!isCurrentRequest(requestId)) return;
      reportDownloadError(cause);
    } finally {
      savingPendingRef.current = false;

      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  const downloadAllConvertedFiles = async (saveAs = false): Promise<void> => {
    if (
      !isMountedRef.current ||
      !convertedResults ||
      isPreparingArchive ||
      isFileActionPending()
    ) {
      return;
    }

    const requestId = requestIdRef.current;
    savingPendingRef.current = true;
    setIsSaving(true);
    setSavedFileName(null);
    setIsPreparingArchive(true);

    try {
      const resultIds = convertedResults.map((result) => result.resultId);
      const response = saveAs
        ? await window.easyConvert.saveArchive(resultIds, true)
        : await window.easyConvert.saveArchive(resultIds);

      if (!isCurrentRequest(requestId)) return;
      if (response.status === "cancelled") return;

      setSavedFileName(response.fileName);

      dispatch({ type: "downloadSucceeded" });
    } catch (cause: unknown) {
      if (!isCurrentRequest(requestId)) return;
      reportDownloadError(cause);
    } finally {
      savingPendingRef.current = false;

      if (isMountedRef.current) {
        setIsSaving(false);
        setIsPreparingArchive(false);
      }
    }
  };

  const dismissSaveNotification = (): void => {
    setSavedFileName(null);
  };

  return {
    file,
    convertedResults,
    conversionError,
    isConverting,
    isRemoving,
    isSaving,
    selectFile,
    removeFile,
    convert,
    downloadConvertedFile,
    isPreparingArchive,
    savedFileName,
    dismissSaveNotification,
    downloadAllConvertedFiles,
  };
}
