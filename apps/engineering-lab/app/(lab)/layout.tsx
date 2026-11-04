import { LabShell } from "@/components/LabShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <LabShell>{children}</LabShell>;
}
