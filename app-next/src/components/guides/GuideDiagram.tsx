/** Monospace diagram block for ESL / manager guides (renders without Mermaid). */
export function GuideDiagram({ children, title }: { children: string; title?: string }) {
  return (
    <figure className="my-4">
      {title ? (
        <figcaption className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{title}</figcaption>
      ) : null}
      <pre
        className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-snug text-slate-800 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-200 font-mono"
        aria-label={title ?? "Diagram"}
      >
        {children.trimEnd()}
      </pre>
    </figure>
  );
}
