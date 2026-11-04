export function WorkflowFigure({ steps, title }: { steps: string[]; title: string }) {
  return (
    <figure className="m-0">
      <ol aria-label={title} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-cols-1 min-w-0">
        {steps.map((s, i) => (
          <li key={s} className="relative flex gap-3 rounded-xl border border-line bg-surface p-4">
            <span className="font-mono text-sm text-bronze-ink shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-[0.95rem]">{s}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
