import { useTranslation } from "react-i18next";

export default function ErrorBoundaryMessage() {
  const { t } = useTranslation();

  return <p role="alert">{t("errors.unexpected")}</p>;
}
