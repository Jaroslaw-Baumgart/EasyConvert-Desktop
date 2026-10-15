import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { z } from "zod";

import {
  pdfPageSettingsSchema,
  type PdfPageSettings,
} from "../../schemas/conversionSettings";
import styles from "../ConversionOptions.module.css";
import primaryActionStyles from "../PrimaryAction.module.css";
import { useTranslation } from "react-i18next";

interface PdfPageControlsProps {
  disabled: boolean;
  isConverting?: boolean;
  onConvert: (settings: PdfPageSettings) => void;
}

export default function PdfPageControls({
  disabled,
  isConverting = false,
  onConvert,
}: PdfPageControlsProps) {
  const { t } = useTranslation();
  const { register, handleSubmit } = useForm<
    z.input<typeof pdfPageSettingsSchema>,
    unknown,
    PdfPageSettings
  >({
    resolver: zodResolver(pdfPageSettingsSchema),
    defaultValues: pdfPageSettingsSchema.parse({}),
  });

  return (
    <form onSubmit={handleSubmit(onConvert)}>
      <div>
        <fieldset id="pdf-page-orientation">
          <legend>{t("options.orientation")}</legend>
          <input
            type="radio"
            id="pdf-page-orientation-portrait"
            value="portrait"
            {...register("pageOrientation")}
          />
          <label htmlFor="pdf-page-orientation-portrait">{t("options.portrait")}</label>
          <input
            type="radio"
            id="pdf-page-orientation-landscape"
            value="landscape"
            {...register("pageOrientation")}
          />
          <label htmlFor="pdf-page-orientation-landscape">{t("options.landscape")}</label>
        </fieldset>
        <fieldset id="pdf-page-size">
          <legend>{t("options.pageSize")}</legend>
          <input
            type="radio"
            id="pdf-page-size-a4"
            value="A4"
            {...register("pageSize")}
          />
          <label htmlFor="pdf-page-size-a4">A4</label>
          <input
            type="radio"
            id="pdf-page-size-a3"
            value="A3"
            {...register("pageSize")}
          />
          <label htmlFor="pdf-page-size-a3">A3</label>
        </fieldset>
      </div>
      <button
        type="submit"
        className={`${primaryActionStyles.button} ${styles["convert-btn"]}`}
        disabled={disabled}
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
    </form>
  );
}
