import path from "node:path";
import type { AppSettings } from "../../../shared/contracts/desktopContract";

export function parseSettings(value: unknown): AppSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid settings");
  }

  if (
    !("language" in value) ||
    !(value.language === "pl" || value.language === "en")
  ) {
    throw new Error("Invalid language settings");
  }

  if (
    !("theme" in value) ||
    !(value.theme === "light" || value.theme === "dark")
  ) {
    throw new Error("Invalid theme settings");
  }
  if (
    !("outputDirectory" in value) ||
    typeof value.outputDirectory !== "string" ||
    !path.isAbsolute(value.outputDirectory)
  ) {
    throw new Error("Invalid output directory settings");
  }

  const accentColor = "accentColor" in value ? value.accentColor : "white";

  if (
    !(
      accentColor === "blue" ||
      accentColor === "purple" ||
      accentColor === "pink" ||
      accentColor === "red" ||
      accentColor === "orange" ||
      accentColor === "green" ||
      accentColor === "teal" ||
      accentColor === "gray" ||
      accentColor === "black" ||
      accentColor === "white"
    )
  ) {
    throw new Error("Invalid accent color settings");
  }

  return {
    language: value.language,
    theme: value.theme,
    outputDirectory: path.resolve(value.outputDirectory),
    accentColor,
  };
}
