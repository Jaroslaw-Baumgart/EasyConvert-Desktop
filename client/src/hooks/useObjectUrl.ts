import { useEffect, useState } from "react";

export function useObjectUrl(file: File | null): string | null {
  const [objectUrlState, setObjectUrlState] = useState<{
    file: File;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrlState(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setObjectUrlState({
      file,
      url,
    });

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return objectUrlState?.file === file ? objectUrlState.url : null;
}
