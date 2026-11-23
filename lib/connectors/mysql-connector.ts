import mysql from "mysql2/promise";
import type { ServiceConnectionResult, ServiceTargetId } from "@/types/connections";

export type MySQLProfileKey =
  | "mysql_main"
  | "mysql_egp"
  | "mysql_purchase"
  | "mysql_inventory"
  | "mysql_gotowin";

interface MySQLTargetSpec {
  id: MySQLProfileKey;
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  envKeys: string[];
}

function envInt(value: string | undefined, fallback: number): number {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getMySQLTargetSpecs(): MySQLTargetSpec[] {
  const defaultHost = (process.env.DB_HOST || "").trim();
  const defaultPort = envInt(process.env.DB_PORT, 3306);
  const defaultUser = (process.env.DB_USER || "").trim();
  const defaultPassword = process.env.DB_PASSWORD ?? "";

  return [
    {
      id: "mysql_main",
      name: "MySQL — Main Database (DB_*)",
      host: defaultHost,
      port: defaultPort,
      user: defaultUser,
      password: defaultPassword,
      database: (process.env.DB_NAME || "").trim(),
      envKeys: ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"],
    },
    {
      id: "mysql_egp",
      name: "MySQL — e-GP Database (EGP_DB_*)",
      host: (process.env.EGP_DB_HOST || defaultHost).trim(),
      port: envInt(process.env.EGP_DB_PORT, defaultPort),
      user: (process.env.EGP_DB_USER || defaultUser).trim(),
      password: process.env.EGP_DB_PASSWORD ?? defaultPassword,
      database: (process.env.EGP_DB_NAME || "egp_db").trim(),
      envKeys: ["EGP_DB_NAME", "EGP_DB_HOST", "DB_HOST", "DB_USER", "DB_PASSWORD"],
    },
    {
      id: "mysql_purchase",
      name: "MySQL — Purchase / BudgetPlan (PURCHASE_DB_*)",
      host: (process.env.PURCHASE_DB_HOST || defaultHost).trim(),
      port: envInt(process.env.PURCHASE_DB_PORT, defaultPort),
      user: (process.env.PURCHASE_DB_USER || defaultUser).trim(),
      password: process.env.PURCHASE_DB_PASSWORD ?? defaultPassword,
      database: (process.env.PURCHASE_DB_NAME || "purchase_db").trim(),
      envKeys: [
        "PURCHASE_DB_HOST",
        "PURCHASE_DB_PORT",
        "PURCHASE_DB_USER",
        "PURCHASE_DB_PASSWORD",
        "PURCHASE_DB_NAME",
      ],
    },
    {
      id: "mysql_inventory",
      name: "MySQL — Inventory Database (INVENTORY_DB_*)",
      host: (process.env.INVENTORY_DB_HOST || defaultHost).trim(),
      port: envInt(process.env.INVENTORY_DB_PORT, defaultPort),
      user: (process.env.INVENTORY_DB_USER || defaultUser).trim(),
      password: process.env.INVENTORY_DB_PASSWORD ?? defaultPassword,
      database: (process.env.INVENTORY_DB_NAME || "inventory").trim(),
      envKeys: [
        "INVENTORY_DB_NAME",
        "INVENTORY_DB_HOST",
        "DB_HOST",
        "DB_USER",
        "DB_PASSWORD",
      ],
    },
    {
      id: "mysql_gotowin",
      name: "MySQL — GOTOWIN HR / Backoffice (GOTOWIN_DB_*)",
      host: (process.env.GOTOWIN_DB_HOST || "").trim(),
      port: envInt(process.env.GOTOWIN_DB_PORT, 3306),
      user: (process.env.GOTOWIN_DB_USER || "").trim(),
      password: process.env.GOTOWIN_DB_PASSWORD ?? "",
      database: (process.env.GOTOWIN_DB_NAME || "").trim(),
      envKeys: [
        "GOTOWIN_DB_HOST",
        "GOTOWIN_DB_PORT",
        "GOTOWIN_DB_USER",
        "GOTOWIN_DB_PASSWORD",
        "GOTOWIN_DB_NAME",
      ],
    },
  ];
}

export async function testMySQLTarget(key: MySQLProfileKey): Promise<ServiceConnectionResult> {
  const start = Date.now();
  const spec = getMySQLTargetSpecs().find((item) => item.id === key);

  if (!spec) {
    return {
      id: key as ServiceTargetId,
      name: key,
      category: "database",
      engine: "MySQL / MariaDB",
      host: "-",
      port: "-",
      targetName: "-",
      user: "-",
      envKeys: [],
      ok: false,
      latencyMs: 0,
      error: `ไม่พบการตั้งค่าโปรไฟล์ ${key}`,
      checkedAt: new Date().toISOString(),
    };
  }

  const base: Omit<ServiceConnectionResult, "ok" | "latencyMs" | "checkedAt"> = {
    id: spec.id,
    name: spec.name,
    category: "database",
    engine: "MySQL / MariaDB (mysql2)",
    host: spec.host || "-",
    port: spec.port,
    targetName: spec.database || "-",
    user: spec.user || "-",
    envKeys: spec.envKeys,
  };

  if (!spec.host || !spec.user || !spec.database) {
    return {
      ...base,
      ok: false,
      latencyMs: Date.now() - start,
      error: `ตั้งค่า host / user / database สำหรับ ${spec.name} ใน .env.local ไม่ครบ`,
      checkedAt: new Date().toISOString(),
    };
  }

  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: spec.host,
      port: spec.port,
      user: spec.user,
      password: spec.password,
      database: spec.database,
      connectTimeout: 10_000,
      charset: "utf8mb4",
    });

    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT VERSION() AS server_version,
              DATABASE() AS current_db,
              CURRENT_USER() AS current_user_str,
              DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS server_time`,
    );

    const [tableCountRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS table_count
         FROM information_schema.tables
        WHERE table_schema = DATABASE()`,
    );

    const info = rows[0] ?? {};
    const tableCount = Number(tableCountRows[0]?.table_count ?? 0);

    return {
      ...base,
      ok: true,
      latencyMs: Date.now() - start,
      serverVersion: String(info.server_version ?? "MySQL"),
      details: `DB: ${info.current_db ?? spec.database} | Tables: ${tableCount} | Server Time: ${info.server_time ?? "-"}`,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      ok: false,
      latencyMs: Date.now() - start,
      error: message,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {
        // ignore close error
      }
    }
  }
}
