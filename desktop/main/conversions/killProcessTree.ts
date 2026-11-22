import { execFile } from "node:child_process";

export function killProcessTree(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!Number.isSafeInteger(pid) || pid <= 0) {
      reject(new Error("Invalid process identifier."));
      return;
    }

    execFile(
      "taskkill",
      ["/PID", String(pid), "/T", "/F"],
      { windowsHide: true, timeout: 10_000 },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
}
