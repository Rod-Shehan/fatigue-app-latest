"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { OfflineBar } from "@/components/OfflineBar";
import { OfflineAuthSync } from "@/components/auth/OfflineAuthSync";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { ProductPwaInstallCapture } from "@/components/pwa/ProductPwaInstallCapture";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider>
      <SessionProvider>
        <OfflineAuthSync />
        <ProductPwaInstallCapture />
        <ServiceWorkerRegister />
        <QueryClientProvider client={queryClient}>
          {children}
          <OfflineBar />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
