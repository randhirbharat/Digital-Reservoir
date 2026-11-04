import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Run the Engineering Lab and Digital Twin",
  description: "The Engineering Lab, Digital Twin and API need a server. How to run the complete platform locally with Docker.",
};

const REPO = "https://github.com/randhirbharat/Digital-Reservoir";

export default function RunLocally() {
  return (
    <>
      <PageHero title="Run the Engineering Lab and Digital Twin" crumbs={[{ href: "/run-locally/", label: "Run locally" }]}
        lead="This website is a static preview. The Engineering Lab, the Digital Twin and the API handle accounts, uploaded data and live monitoring, so they need a server and a database." />
      <div className="dr-container py-12 grid gap-10 lg:grid-cols-2 grid-cols-1 min-w-0">
        <div className="dr-prose min-w-0">
          <h2>Run everything with Docker</h2>
          <ol>
            <li>Clone the repository.</li>
            <li>Copy <code>.env.docker.example</code> to <code>.env.docker</code>, then set <code>DR_SECRET_KEY</code>, <code>POSTGRES_PASSWORD</code> and <code>DR_APP_DB_PASSWORD</code> (for example with <code>openssl rand -hex 32</code>).</li>
            <li>Start the stack: <code>docker compose --env-file .env.docker up --build -d</code></li>
            <li>Create the administrator. You are prompted for the password: <code>docker compose --env-file .env.docker exec api python -m app.cli create-admin --email you@example.org</code></li>
            <li>Optional: load the demonstration Digital Twin project, which uses simulated data: <code>docker compose --env-file .env.docker exec api python -m app.cli seed-demo --admin-email you@example.org</code></li>
          </ol>
          <p>Then open the public website at http://localhost:3000, the Engineering Lab at http://localhost:3001 and the Digital Twin at http://localhost:3002. The API documentation is at http://localhost:8000/api/docs.</p>
        </div>
        <div className="dr-prose min-w-0">
          <h2>Documentation</h2>
          <ul>
            <li><a href={`${REPO}#readme`}>README: installation, configuration and local development</a></li>
            <li><a href={`${REPO}/blob/main/documentation/USER_GUIDE.md`}>User guide</a></li>
            <li><a href={`${REPO}/blob/main/documentation/DEPLOYMENT.md`}>Deployment</a></li>
            <li><a href={`${REPO}/blob/main/documentation/LIMITATIONS.md`}>Known limitations</a></li>
          </ul>
          <p>To find out what each application does, read the <Link href="/engineering-lab/">Engineering Lab</Link> and <Link href="/digital-twin/">Digital Twin</Link> pages.</p>
        </div>
      </div>
    </>
  );
}
