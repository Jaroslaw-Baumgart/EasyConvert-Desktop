import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  pngToJpgSettingsSchema,
  type PngToJpgSettings,
} from "../../schemas/conversionSettings";
import styles from "../ConversionOptions.module.css";
import primaryActionStyles from "../PrimaryAction.module.css";
import { useTranslation } from "react-i18next";

interface PngToJpgControlsProps {
  disabled: boolean;
  isConverting?: boolean;
  onConvert: (settings: PngToJpgSettings) => void;
}

export default function PngToJpgControls({
  disabled,
  isConverting = false,
  onConvert,
}: PngToJpgControlsProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(pngToJpgSettingsSchema),
    defaultValues: pngToJpgSettingsSchema.parse({}),
  });

  return (
    <form onSubmit={handleSubmit(onConvert)}>
      <div>
        <label htmlFor="png-to-jpg-quality">{t("options.quality")}</label>
        <input id="png-to-jpg-quality" type="number" {...register("quality")} />
        {errors.quality && <p role="alert">{t("validation.quality")}</p>}
        <label htmlFor="png-to-jpg-background-color">
          {t("options.transparent")}
        </label>
        <input
          id="png-to-jpg-background-color"
          type="color"
          {...register("backgroundColor")}
        />
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
