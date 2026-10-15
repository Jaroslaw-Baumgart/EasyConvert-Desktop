import FileConverter from "../components/FileConverter";
import { conversions } from "../config/conversions";

export default function ConverterPage() {
  return (
    <>
      <FileConverter conversionOptions={conversions} />
    </>
  );
}