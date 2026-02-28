"use client";

import { useEffect } from "react";
import { createLogger } from "@/lib/logger";

const logger = createLogger("sw");

/**
 * Registers the service worker on mount.
 * Place in the root layout to ensure SW registers on every page load.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          logger.info("Registered with scope", { scope: registration.scope });

          // Check for updates periodically (every 60 minutes)
          setInterval(
            () => {
              registration.update();
            },
            60 * 60 * 1000
          );
        })
        .catch((err) => {
          logger.error("Registration failed", { error: String(err) });
        });
    }
  }, []);

  return null;
}
