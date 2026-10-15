import type { ConversionDefinition } from "../config/conversions";

export type ConversionOption = ConversionDefinition & {
  disabled: boolean;
};

export interface FileConverterProps {
  conversionOptions: readonly ConversionDefinition[];
}
