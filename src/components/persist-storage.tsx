"use client";

import { useEffect } from "react";
import { persistState, requestPersistence } from "@/lib/storage/persist";

/** Asks once per visit for persistent storage, so that progress is not cleared by the system. */
export function PersistStorage() {
  useEffect(() => {
    void persistState().then((state) => {
      if (state === "not-persisted") void requestPersistence();
    });
  }, []);
  return null;
}
