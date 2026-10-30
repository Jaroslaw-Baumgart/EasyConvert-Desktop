import { useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  conversionReducer,
  initialConversionState,
} from "../reducers/conversionReducer";
import type { ConversionOption } from "../types/converter";
import { ConversionError, isConversionErrorCode } from "../api/conversionError";
import { downloadFile } from "../utils/downloadFile";
import { convertFile } from "../api/conversionClient";
import type { ConversionSettings } from "../schemas/conversionSettings";
import { createConversionFormData } from "../api/conversionFormData";
import type {
  ConvertedResult,
  ConvertedResults,
} from "../types/conversionResult";
import { createZipFile } from "../utils/createZipFile";
import { convertDesktopFile } from "../api/desktopConversionClient";

type UseConversionResult = {
  file: File | null;
  convertedResults: ConvertedResults | null;
  conversionError: string | null;
  isConverting: boolean;
  isPreparingArchive: boolean;
  isRemoving: boolean;
  selectFile: (selectedFile: File, sourceId?: string) => void;
  removeFile: () => Promise<void>;
  convert: (
    option: ConversionOption,
    settings?: ConversionSettings,
  ) => Promise<void>;
  downloadConvertedFile: (result: ConvertedResult) => void;
  downloadAllConvertedFiles: () => Promise<void>;
};

export function useConversion(): UseConversionResult {
  const { t } = useTranslation();
  const [conversionState, dispatch] = useReducer(
    conversionReducer,
    initialConversionState,
  );

  const requestIdRef = useRef(0);
  const archiveIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sourceIdRef = useRef<string | null>(null);
  const removalPendingRef = useRef(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removalError, setRemovalError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      archiveIdRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  const [isPreparingArchive, setIsPreparingArchive] = useState(false);

  const file = conversionState.kind === "empty" ? null : conversionState.file;

  const isConverting = conversionState.kind === "loading";

  const convertedResults =
    conversionState.kind === "downloadError" ||
    conversionState.kind === "success"
      ? conversionState.convertedResults
      : null;

  const conversionError =
    removalError ??
    (conversionState.kind === "downloadError" ||
    conversionState.kind === "conversionError"
      ? isConversionErrorCode(conversionState.error)
        ? t(`errors.${conversionState.error}`)
        : conversionState.error
      : null);

  const selectFile = (selectedFile: File, sourceId?: string) => {
    if (removalPendingRef.current) return;
    setRemovalError(null);
    sourceIdRef.current = sourceId ?? null;
    requestIdRef.current += 1;
    archiveIdRef.current += 1;
    abortControllerRef.current?.abort();
    setIsPreparingArchive(false);
    dispatch({
      type: "fileSelected",
      file: selectedFile,
    });
  };

  const removeFile = async (): Promise<void> => {
    if (!file || removalPendingRef.current) {
      return;
    }

    const isDesktop = window.easyConvert?.platform === "desktop";

    if (
      isDesktop &&
      (isConverting ||
        (abortControllerRef.current !== null &&
          !abortControllerRef.current.signal.aborted))
    ) {
      return;
    }

    removalPendingRef.current = true;
    setIsRemoving(true);
    setRemovalError(null);

    try {
      if (isDesktop) {
        await window.easyConvert.resetSource();
      }

      if (!isMountedRef.current) return;

      sourceIdRef.current = null;
      requestIdRef.current += 1;
      archiveIdRef.current += 1;
      abortControllerRef.current?.abort();
      setIsPreparingArchive(false);

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
  ) => {
    if (!file || removalPendingRef.current) {
      return;
    }

    if (
      conversionState.kind === "loading" ||
      (abortControllerRef.current && !abortControllerRef.current.signal.aborted)
    ) {
      return;
    }

    requestIdRef.current += 1;
    archiveIdRef.current += 1;
    setIsPreparingArchive(false);
    const requestId = requestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    dispatch({ type: "conversionStarted", requestId });

    try {
      let convertedResults: ConvertedResults;

      if (window.easyConvert?.platform === "desktop") {
        const sourceId = sourceIdRef.current;

        if (!sourceId) {
          throw new Error("Select the file using the native dialog.");
        }

        if (option.conversionType !== "jpg-to-png") {
          throw new Error("This desktop conversion is not available yet.");
        }

        convertedResults = await convertDesktopFile(
          window.easyConvert,
          sourceId,
          file.name,
          controller.signal,
        );
      } else {
        const formData = createConversionFormData(file, option, settings);
        convertedResults = await convertFile(formData, controller.signal);
      }

      dispatch({
        type: "conversionSucceeded",
        convertedResults,
        requestId,
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      console.error(err);

      const errorCode =
        err instanceof ConversionError ? err.code : "conversion-failed";

      dispatch({
        type: "conversionFailed",
        error: errorCode,
        requestId,
      });
    } finally {
      if (abortControllerRef.current === controller)
        abortControllerRef.current = null;
    }
  };

  const downloadConvertedFile = (result: ConvertedResult) => {
    try {
      downloadFile(result.file);
      dispatch({ type: "downloadSucceeded" });
    } catch (cause: unknown) {
      const downloadError = new ConversionError("download-failed", cause);

      console.error(downloadError);
      dispatch({
        type: "downloadFailed",
        error: downloadError.code,
      });
    }
  };

  const downloadAllConvertedFiles = async () => {
    if (!convertedResults || isPreparingArchive) {
      return;
    }

    const archiveId = archiveIdRef.current + 1;
    archiveIdRef.current = archiveId;
    const resultsToArchive = convertedResults;
    setIsPreparingArchive(true);

    try {
      const filesToZip = resultsToArchive.map((result) => result.file);
      const zipFile = await createZipFile(filesToZip);
      if (archiveIdRef.current !== archiveId || !isMountedRef.current) return;
      downloadFile(zipFile);
      dispatch({ type: "downloadSucceeded" });
    } catch (cause: unknown) {
      if (archiveIdRef.current !== archiveId || !isMountedRef.current) return;
      const downloadError = new ConversionError("download-failed", cause);

      console.error(downloadError);
      dispatch({
        type: "downloadFailed",
        error: downloadError.code,
      });
    } finally {
      if (archiveIdRef.current === archiveId && isMountedRef.current) {
        setIsPreparingArchive(false);
      }
    }
  };

  return {
    file,
    convertedResults,
    conversionError,
    isConverting,
    isRemoving,
    selectFile,
    removeFile,
    convert,
    downloadConvertedFile,
    isPreparingArchive,
    downloadAllConvertedFiles,
  };
}
