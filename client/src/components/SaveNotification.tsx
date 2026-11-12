import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import styles from "./SaveNotification.module.css";
import primaryActionStyles from "./PrimaryAction.module.css";

type SaveNotificationProps = {
  fileName: string;
  onClose: () => void;
  onShowInFolder: () => Promise<void>;
};

export default function SaveNotification({
  fileName,
  onClose,
  onShowInFolder,
}: SaveNotificationProps) {
  const { t } = useTranslation();

  const [folderError, setFolderError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const remainingTime = useRef(10_000);

  useEffect(() => {
    if (isHovered || hasFocus || folderError) return;

    const startedAt = performance.now();
    const timer = window.setTimeout(onClose, remainingTime.current);

    return () => {
      window.clearTimeout(timer);
      remainingTime.current = Math.max(
        0,
        remainingTime.current - (performance.now() - startedAt),
      );
    };
  }, [isHovered, hasFocus, folderError, onClose]);

  const showInFolder = async (): Promise<void> => {
    setFolderError(false);

    try {
      await onShowInFolder();
      onClose();
    } catch {
      setFolderError(true);
    }
  };

  return (
    <div
      className={styles.toast}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setHasFocus(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocus(false);
        }
      }}
    >
      <p role="status" className={styles.message}>
        {t("download.saved", { fileName })}
      </p>
      <button
        type="button"
        className={`${primaryActionStyles.button} ${styles.show}`}
        onClick={showInFolder}
      >
        {t("download.showInFolder")}
      </button>
      {folderError && (
        <p role="alert" className={styles.message}>
          {t("download.folderError")}
        </p>
      )}
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label={t("download.closeNotification")}
      >
        ×
      </button>
    </div>
  );
}
