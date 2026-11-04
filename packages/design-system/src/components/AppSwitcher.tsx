import { appUrls, type AppId } from "@dr/shared-utilities";

const APPS: { id: AppId; label: string; note: string }[] = [
  { id: "public", label: "Website", note: "Open to everyone" },
  { id: "lab", label: "Engineering Lab", note: "Registered members" },
  { id: "twin", label: "Digital Twin", note: "Authorised projects" },
];

/** Cross-application switcher shared by all three apps. */
export function AppSwitcher({ current, className = "" }: { current: AppId; className?: string }) {
  const urls = appUrls();
  return (
    <nav aria-label="Digital Reservoir applications" className={`flex gap-1 text-xs ${className}`}>
      {APPS.map((a) => (
        <a
          key={a.id}
          href={urls[a.id]}
          aria-current={a.id === current ? "page" : undefined}
          title={a.note}
          className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
            a.id === current ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {a.label}
        </a>
      ))}
    </nav>
  );
}
