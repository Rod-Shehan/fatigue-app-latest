"use client";

import { useEffect } from "react";

export function useKeyboardTriage(
  selectedId: string | null,
  onDismiss: () => void,
  onVerifyFatigue: () => void,
  onVerifyDistraction: () => void
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!selectedId) return;
      if (event.key === "F1" || event.key === "1") {
        event.preventDefault();
        onDismiss();
      }
      if (event.key === "F2" || event.key === "2") {
        event.preventDefault();
        onVerifyFatigue();
      }
      if (event.key === "F3" || event.key === "3") {
        event.preventDefault();
        onVerifyDistraction();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, onDismiss, onVerifyFatigue, onVerifyDistraction]);
}
