"use client";
import { useParams } from "next/navigation";
import { Gate } from "@/components/Gate";
import { ProjectShell } from "@/components/ProjectShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  const { pid } = useParams<{ pid: string }>();
  return <Gate><ProjectShell pid={pid}>{children}</ProjectShell></Gate>;
}
