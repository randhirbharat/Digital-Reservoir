import { refById, formatReference } from "@/content/references";

export function References({ ids }: { ids: string[] }) {
  const refs = ids.map(refById).filter(Boolean);
  if (!refs.length) return null;
  return (
    <div>
      <ol className="space-y-2 text-[0.92rem] list-decimal pl-5">
        {refs.map((r) => (
          <li key={r!.id}>
            {formatReference(r!)}{" "}
            {r!.doi ? <a className="text-accent-ink underline underline-offset-2" href={`https://doi.org/${r!.doi}`} rel="noopener noreferrer">doi:{r!.doi}</a> : null}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">External works cited for further reading. Bibliographic details should be verified against the publisher before citation.</p>
    </div>
  );
}
