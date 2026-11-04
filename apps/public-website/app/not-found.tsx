import Link from "next/link";
export default function NotFound() {
  return (
    <div className="dr-container py-24 space-y-4">
      <h1 className="font-display font-extrabold text-4xl">Page not found</h1>
      <p className="text-muted">The page you requested does not exist or has moved.</p>
      <Link href="/" className="text-accent-ink underline">Return to the homepage</Link>
    </div>
  );
}
