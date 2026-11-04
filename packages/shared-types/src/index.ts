/* API contract types shared by the frontends. Mirrors services/api/app/schemas.py. */
import type { ConditionLevel, DataProvenance } from "@dr/shared-utilities";

export type MembershipCategory = "general" | "student" | "researcher" | "professional" | "administrator";
export type ProjectRole = "project_admin" | "project_engineer" | "researcher" | "monitoring_operator" | "viewer";

export interface ProjectMembership { project_id: string; project_name: string; role: ProjectRole }

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  membership_category: MembershipCategory;
  is_superadmin: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  session_mfa_passed: boolean;
  session_expires_at: string;
  organisation: string;
  lab_access: boolean;
  lab_permissions: string[];
  twin_projects: ProjectMembership[];
  created_at: string;
}

export interface LabProject { id: string; name: string; description: string; created_at: string; updated_at: string; dataset_count: number; analysis_count: number }

export interface ColumnInfo { name: string; dtype: string; kind: "datetime" | "numeric" | "text"; missing: number; unique: number }

export interface DatasetVersion {
  id: string; version: number; label: string; is_original: boolean; rows: number; columns: ColumnInfo[];
  sha256: string; created_at: string; processing: ProcessingStep[]; parent_version_id: string | null;
}
export interface ProcessingStep { operation: string; params: Record<string, unknown>; summary: string; at: string }

export interface Dataset {
  id: string; name: string; filename: string; provenance: DataProvenance; description: string;
  project_id: string | null; created_at: string; versions: DatasetVersion[];
}

export interface AnalysisRun {
  id: string; kind: string; title: string; dataset_version_id: string | null; project_id: string | null;
  params: Record<string, unknown>; result: any; status: "completed" | "failed"; error: string | null;
  created_at: string; duration_ms: number; engine_version: string;
}

export interface TwinProject { id: string; name: string; code: string; description: string; organisation: string | null; role: ProjectRole | "superadmin"; data_mode: DataProvenance }

export interface Sensor {
  id: string; code: string; name: string; sensor_type: string; variable: string; unit: string;
  component: string | null; x: number; y: number; z: number; frequency_s: number; source: DataProvenance;
  calibration: Record<string, unknown>; status: "active" | "offline" | "fault" | "maintenance" | "decommissioned";
  installed_at: string | null; notes: string;
}

export interface Observation { t: string; v: number; q: QualityFlag; source?: DataProvenance }
export type QualityFlag = "good" | "suspect" | "bad" | "missing" | "unchecked";

export interface LatestReading {
  sensor_id: string; code: string; value: number | null; unit: string; timestamp: string | null; ingested_at: string | null;
  quality: QualityFlag | null; source: DataProvenance; comms: "online" | "late" | "offline" | "never";
  condition: ConditionLevel; condition_basis: string;
}

export interface Alert {
  id: string; sensor_id: string | null; kind: string; severity: ConditionLevel; message: string; status: "open" | "acknowledged" | "closed";
  created_at: string; value: number | null; rule_id: string | null; acknowledged_by: string | null; acknowledged_at: string | null;
  closed_by: string | null; closed_at: string | null; closure_note: string | null; source: DataProvenance;
}

export interface AlertRule {
  id: string; sensor_id: string; level: ConditionLevel; comparator: "gt" | "lt" | "abs_gt"; threshold: number;
  criteria_reference: string; created_by: string; created_at: string; enabled: boolean;
}
