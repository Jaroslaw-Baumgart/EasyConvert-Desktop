import type { ConversionOption } from "../types/converter";
import PngToJpgControls from "./conversion-settings/PngToJpgControls";
import type { ConversionSettings } from "../schemas/conversionSettings";
import PdfPageControls from "./conversion-settings/PdfPageControls";
import { useEffect, useRef, useState } from "react";
import styles from "./ConversionOptions.module.css";
import panelStyles from "./ConverterPanel.module.css";
import primaryActionStyles from "./PrimaryAction.module.css";
import stateStyles from "./PreviewState.module.css";
import { FileIcon } from "./UiIcons";
import { useTranslation } from "react-i18next";

interface ConversionOptionsProps {
  options: ConversionOption[];
  onConvert: (option: ConversionOption, settings?: ConversionSettings) => void;
  isConverting: boolean;
  selectedXlsxSheetName: string | undefined | null;
}

export default function ConversionOptions({
  options,
  onConvert,
  isConverting,
  selectedXlsxSheetName,
}: ConversionOptionsProps) {
  const { t } = useTranslation();
  const [selectedConversionType, setSelectedConversionType] = useState<
    string | null
  >(null);
  const [shouldFocusSettings, setShouldFocusSettings] = useState(false);
  const settingsHeadingRef = useRef<HTMLHeadingElement>(null);

  const availableOptions = options.filter((option) => !option.disabled);

  const selectedOption =
    availableOptions.find(
      (option) => option.conversionType === selectedConversionType,
    ) ?? availableOptions[0];

  useEffect(() => {
    if (!shouldFocusSettings || !selectedOption) {
      return;
    }

    settingsHeadingRef.current?.focus();
    setShouldFocusSettings(false);
  }, [selectedOption, shouldFocusSettings]);

  const selectConversionOption = (conversionType: string) => {
    setSelectedConversionType(conversionType);
    setShouldFocusSettings(true);
  };

  return (
    <div
      className={`${panelStyles.panel} ${styles["options-section"]}`}
      aria-busy={isConverting}
    >
      {isConverting ? (
        <p className={stateStyles["visually-hidden"]} role="status">
          {t("common.converting")}
        </p>
      ) : null}
      <h2 className={panelStyles.heading}>{t("options.title")}</h2>
      <p className={styles["conversion-section-description"]}>{t("options.description")}</p>
      <div className={styles["options-grid"]} aria-label={t("options.available")}>
        {availableOptions.length === 0 ? (
          <p>{t("options.noOptions")}</p>
        ) : (
          availableOptions.map((option) => (
            <button
              key={option.conversionType}
              type="button"
              className={styles["option-card"]}
              aria-pressed={option.conversionType === selectedOption?.conversionType}
              onClick={() => selectConversionOption(option.conversionType)}
              disabled={isConverting}
            >
              <FileIcon className={styles["format-icon"]} />
              <span className={styles.format}>
                {option.sourceFormat.toUpperCase()}
              </span>
              <span className={styles.arrow}>→</span>
              <span className={styles.format}>
                {option.targetFormat.toUpperCase()}
              </span>
            </button>
          ))
        )}
      </div>
      {selectedOption ? (
        <div className={styles["conversion-settings"]}>
          <h3 ref={settingsHeadingRef} tabIndex={-1}>
            {t("options.settings")}
          </h3>

          {selectedOption.conversionType === "png-to-jpg" ? (
            <PngToJpgControls
              disabled={isConverting}
              isConverting={isConverting}
              onConvert={(settings) => onConvert(selectedOption, settings)}
            />
          ) : selectedOption.conversionType === "jpg-to-pdf" ||
            selectedOption.conversionType === "txt-to-pdf" ||
            selectedOption.conversionType === "csv-to-pdf" ||
            selectedOption.conversionType === "xlsx-to-pdf" ? (
            <PdfPageControls
              disabled={
                isConverting ||
                (selectedOption.conversionType === "xlsx-to-pdf" &&
                  selectedXlsxSheetName === null)
              }
              isConverting={isConverting}
              onConvert={(settings) => {
                if (selectedOption.conversionType !== "xlsx-to-pdf") {
                  onConvert(selectedOption, settings);
                  return;
                }

                if (selectedXlsxSheetName === null) {
                  return;
                }

                const xlsxSettings =
                  selectedXlsxSheetName === undefined
                    ? settings
                    : {
                        ...settings,
                        sheetName: selectedXlsxSheetName,
                      };

                onConvert(selectedOption, xlsxSettings);
              }}
            />
          ) : (
            <button
              type="button"
              className={`${primaryActionStyles.button} ${styles["convert-btn"]}`}
              onClick={() => onConvert(selectedOption)}
              disabled={isConverting}
            >
              {isConverting ? (
                <>
                  <span className={primaryActionStyles.spinner} aria-hidden="true" />
                  {t("common.converting")}
                </>
              ) : (
                t("common.convert")
              )}
            </button>
          )}
        </div>
      ) : (
        <p className={styles["conversion-choice-hint"]}>
          {t("options.choose")}
        </p>
      )}
    </div>
  );
}
