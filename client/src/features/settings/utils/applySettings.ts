import i18n from "../../../i18n";
import type { AppSettings } from "../../../../../shared/contracts/desktopContract";

export async function applySettings(settings: AppSettings): Promise<void> {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.accent = settings.accentColor;

  await i18n.changeLanguage(settings.language);
}