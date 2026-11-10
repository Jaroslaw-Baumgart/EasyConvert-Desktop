import type { ConversionDefinition } from "../../../shared/conversions";

export type ConversionOption = ConversionDefinition & {
  disabled: boolean;
};

export interface FileConverterProps {
  conversionOptions: readonly ConversionDefinition[];
}
