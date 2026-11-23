import { platform } from "os";
import { resolve } from "path";
import oracledb from "oracledb";
import type { ServiceConnectionResult } from "@/types/connections";

interface OracleState {
  isThickInitialized: boolean;
}

const g = globalThis as typeof globalThis & { __masterOracleState?: OracleState };
const state: OracleState = g.__masterOracleState ?? { isThickInitialized: false };
g.__masterOracleState = state;

function normalizeEnvPath(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function getOracleClientLibPath(): string {
  if (process.env.ORACLE_CLIENT_LIB_PATH) {
    return normalizeEnvPath(process.env.ORACLE_CLIENT_LIB_PATH);
  }
  const currentPlatform = platform();
  const folder =
    currentPlatform === "win32"
      ? "win64"
      : currentPlatform === "darwin"
        ? "mac"
        : "linux";
  return resolve(process.cwd(), "InstantClient", folder);
}

function ensureThickMode(): void {
  if (state.isThickInitialized) return;
  if (oracledb.initOracleClient) {
    const libDir = getOracleClientLibPath();
    oracledb.initOracleClient({ libDir });
    state.isThickInitialized = true;
  }
}

export function getOracleConfig() {
  const host = (process.env.ORACLE_HOST || "").trim();
  const port = parseInt(process.env.ORACLE_PORT || "1521", 10);
  const serviceName = (process.env.ORACLE_SERVICE_NAME || "").trim();
  const sid = (process.env.ORACLE_SID || "").trim();
  const user = (process.env.ORACLE_USER || "").trim();
  const password = (process.env.ORACLE_PASSWORD || "").trim();
  const schema = (process.env.ORACLE_SCHEMA || "").trim();

  const connectString = serviceName
    ? `${host}:${port}/${serviceName}`
    : sid
      ? `${host}:${port}:${sid}`
      : "";

  return { host, port, serviceName, sid, user, password, schema, connectString };
}

export async function testOracleConnection(): Promise<ServiceConnectionResult> {
  const start = Date.now();
  const cfg = getOracleConfig();
  const base: Omit<ServiceConnectionResult, "ok" | "latencyMs" | "checkedAt"> = {
    id: "oracle",
    name: "Oracle Database (HIS / Core Oracle)",
    category: "database",
    engine: "Oracle Database (oracledb Thick/Thin)",
    host: cfg.host || "-",
    port: cfg.port || 1521,
    targetName: cfg.serviceName
      ? `${cfg.serviceName}${cfg.schema ? ` (Schema: ${cfg.schema})` : ""}`
      : cfg.sid || "-",
    user: cfg.user || "-",
    envKeys: [
      "ORACLE_HOST",
      "ORACLE_PORT",
      "ORACLE_SERVICE_NAME",
      "ORACLE_SCHEMA",
      "ORACLE_USER",
      "ORACLE_PASSWORD",
      "ORACLE_CLIENT_LIB_PATH",
    ],
  };

  if (!cfg.host || !cfg.user || !cfg.password || !cfg.connectString) {
    return {
      ...base,
      ok: false,
      latencyMs: Date.now() - start,
      error: "ตั้งค่า ORACLE_HOST, ORACLE_SERVICE_NAME (หรือ ORACLE_SID), ORACLE_USER, ORACLE_PASSWORD ไม่ครบ",
      checkedAt: new Date().toISOString(),
    };
  }

  let connection: oracledb.Connection | null = null;
  try {
    ensureThickMode();
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    connection = await oracledb.getConnection({
      user: cfg.user,
      password: cfg.password,
      connectString: cfg.connectString,
      connectTimeout: 10,
    });

    if (cfg.schema) {
      const safeSchema = cfg.schema.replace(/[^a-zA-Z0-9_]/g, "");
      if (safeSchema) {
        await connection.execute(`ALTER SESSION SET CURRENT_SCHEMA = ${safeSchema}`);
      }
    }

    const res = await connection.execute<{
      INSTANCE_USER?: string;
      CURRENT_SCHEMA?: string;
      SYSDATE_STR?: string;
    }>(
      `SELECT USER AS INSTANCE_USER,
              SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS CURRENT_SCHEMA,
              TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') AS SYSDATE_STR
         FROM DUAL`,
    );

    const row = (res.rows?.[0] ?? {}) as {
      INSTANCE_USER?: string;
      CURRENT_SCHEMA?: string;
      SYSDATE_STR?: string;
    };

    return {
      ...base,
      ok: true,
      latencyMs: Date.now() - start,
      serverVersion: connection.oracleServerVersionString || "Oracle Server",
      details: `User: ${row.INSTANCE_USER ?? cfg.user} | Schema: ${row.CURRENT_SCHEMA ?? cfg.schema} | Server Time: ${row.SYSDATE_STR ?? "-"}`,
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
        await connection.close();
      } catch {
        // ignore close error
      }
    }
  }
}
