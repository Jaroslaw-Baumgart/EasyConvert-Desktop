import styles from "../layouts/AppLayout.module.css";

export default function ConverterLogo() {
  return (
    <svg
      className={styles["converter-logo-mark"]}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="30" height="30" rx="9" />

      <path
        className={styles["converter-logo-file"]}
        d="M13 11h9l5 5v13H13z"
      />

      <path
        className={styles["converter-logo-fold"]}
        d="M22 11v6h5"
      />

      <path
        className={styles["converter-logo-arrow"]}
        d="M15 25h9m-3-3 3 3-3 3"
      />
    </svg>
  );
}
