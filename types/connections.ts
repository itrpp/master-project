export type ServiceTargetId =
  | "oracle"
  | "mysql_main"
  | "mysql_inventory"
  | "mysql_gotowin"
  | "ldap"
  | "smtp";

export type ServiceCategory = "database" | "directory" | "mail";

export interface ServiceConnectionResult {
  id: ServiceTargetId;
  name: string;
  category: ServiceCategory;
  engine: string;
  host: string;
  port: string | number;
  targetName: string;
  user: string;
  envKeys: string[];
  ok: boolean;
  latencyMs: number;
  serverVersion?: string;
  details?: string;
  error?: string;
  checkedAt: string;
}

export interface EmailSendResult {
  ok: boolean;
  to: string;
  from: string;
  host: string;
  port: number;
  secure: boolean;
  messageId?: string;
  response?: string;
  latencyMs: number;
  error?: string;
  sentAt: string;
}
