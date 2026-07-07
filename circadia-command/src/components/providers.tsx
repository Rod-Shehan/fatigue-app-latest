"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PushAlarmListener } from "@/components/pwa/PushAlarmListener";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { CommandThemeToggleInLayout } from "@/components/theme/command-theme-toggle-in-layout";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ServiceWorkerRegister />
        <PushAlarmListener />
        <CommandThemeToggleInLayout />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
