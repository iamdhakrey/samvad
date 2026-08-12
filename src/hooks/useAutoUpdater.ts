import { useState, useEffect } from "react";
import { check, DownloadEvent } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

export function useAutoUpdater() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await check();
        if (!update) return;

        const shouldInstall = await ask(
          `Samvad ${update.version} is available.\n\nRelease notes:\n${update.body}\n\nInstall now?`,
          { title: "Update Available", kind: "info" },
        );

        if (shouldInstall) {
          setIsUpdating(true);
          let downloaded = 0;
          let contentLength = 0;

          await update.downloadAndInstall((event: DownloadEvent) => {
            switch (event.event) {
              case "Started":
                contentLength = event.data.contentLength || 0;
                break;
              case "Progress":
                downloaded += event.data.chunkLength;
                if (contentLength > 0) {
                  // Calculate percentage and cap at 100
                  setProgress(
                    Math.min((downloaded / contentLength) * 100, 100),
                  );
                }
                break;
              case "Finished":
                setProgress(100);
                break;
            }
          });

          await relaunch();
        }
      } catch (err) {
        console.error("Update failed:", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsUpdating(false);
      }
    }

    checkForUpdates();
  }, []);

  return { isUpdating, progress, error };
}
