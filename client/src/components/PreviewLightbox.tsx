import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./PreviewLightbox.module.css";
import { useTranslation } from "react-i18next";

type PreviewLightboxProps = {
  children: ReactNode;
};

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

export default function PreviewLightbox({
  children,
}: PreviewLightboxProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  const closeLightbox = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        openButtonRef.current?.focus();
      }
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
        focusableSelector,
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`${styles["preview-lightbox"]} ${isOpen ? styles["is-open"] : ""}`}>
      <button
        ref={openButtonRef}
        type="button"
        className={styles["preview-expand-btn"]}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        {t("preview.expand")}
      </button>

      {isOpen ? (
        <div
          className={styles["preview-lightbox-backdrop"]}
          aria-hidden="true"
          onClick={closeLightbox}
        />
      ) : null}

      <section
        ref={panelRef}
        className={styles["preview-lightbox-panel"]}
        role={isOpen ? "dialog" : undefined}
        aria-modal={isOpen || undefined}
        aria-label={isOpen ? t("preview.label") : undefined}
      >
        {isOpen ? (
          <button
            ref={closeButtonRef}
            type="button"
            className={styles["preview-close-btn"]}
            onClick={closeLightbox}
          >
            {t("preview.close")}
          </button>
        ) : null}

        <div className={styles["preview-lightbox-content"]}>{children}</div>
      </section>
    </div>
  );
}
