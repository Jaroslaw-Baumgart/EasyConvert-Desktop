import FileConverter from "../components/FileConverter";
import { conversions } from "../../../shared/conversions";

export default function ConverterPage() {
  return (
    <>
      <FileConverter conversionOptions={conversions} />
    </>
  );
}