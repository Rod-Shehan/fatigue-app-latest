import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { commandContainer, commandContainerWide, commandPageShell } from "@/components/command/command-styles";

type Props = {
  children: ReactNode;
  wide?: boolean;
  className?: string;
};

export function CommandShell({ children, wide = false, className }: Props) {
  return (
    <main className={cn(commandPageShell, className)}>
      <div className={wide ? commandContainerWide : commandContainer}>{children}</div>
    </main>
  );
}
