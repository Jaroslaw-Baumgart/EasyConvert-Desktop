import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import styles from "./CloseConfirmation.module.css";

export default function CloseConfirmation() {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!window.easyConvert) return;
    return window.easyConvert.onCloseRequested(() => {
      setHasError(false);
      dialogRef.current?.showModal();
      returnButtonRef.current?.focus();
    });
  }, []);

  const respond = async (confirmed: boolean): Promise<void> => {
    if (isClosing) return;
    setHasError(false);
    setIsClosing(confirmed);
    try {
      await window.easyConvert.respondToCloseRequest(confirmed);
      if (!confirmed) dialogRef.current?.close();
    } catch {
      setIsClosing(false);
      setHasError(true);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="close-confirmation-title"
      aria-describedby="close-confirmation-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!isClosing) void respond(false);
      }}
    >
      <div className={styles.icon}><AlertTriangle size={24} aria-hidden="true" /></div>
      <h2 id="close-confirmation-title">{t("closeConfirmation.title")}</h2>
      <p id="close-confirmation-description">{t("closeConfirmation.description")}</p>
      {hasError && <p role="alert" className={styles.error}>{t("closeConfirmation.error")}</p>}
      <div className={styles.actions}>
        <button ref={returnButtonRef} type="button" disabled={isClosing} onClick={() => void respond(false)}>
          {t("closeConfirmation.return")}
        </button>
        <button className={styles.confirm} type="button" disabled={isClosing} onClick={() => void respond(true)}>
          {isClosing ? t("closeConfirmation.closing") : t("closeConfirmation.confirm")}
        </button>
      </div>
    </dialog>
  );
}
