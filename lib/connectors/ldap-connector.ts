import { Client } from "ldapts";
import type { ServiceConnectionResult } from "@/types/connections";

export function getLdapConfig() {
  const url = (process.env.LDAP_URL || "").trim();
  const baseDN = (process.env.LDAP_BASE_DN || "").trim();
  const bindDN = (process.env.LDAP_BIND_DN || "").trim();
  const bindPassword = (process.env.LDAP_BIND_PASSWORD || "").trim();

  let host = url;
  let port: string | number = url.startsWith("ldaps://") ? 636 : 389;
  try {
    if (url) {
      const parsed = new URL(url);
      host = parsed.hostname;
      port = parsed.port || (parsed.protocol === "ldaps:" ? 636 : 389);
    }
  } catch {
    // keep raw url
  }

  return { url, host, port, baseDN, bindDN, bindPassword };
}

export async function testLdapConnection(): Promise<ServiceConnectionResult> {
  const start = Date.now();
  const cfg = getLdapConfig();

  const base: Omit<ServiceConnectionResult, "ok" | "latencyMs" | "checkedAt"> = {
    id: "ldap",
    name: "Active Directory / LDAP Server",
    category: "directory",
    engine: "LDAP / LDAPS (ldapts)",
    host: cfg.host || "-",
    port: cfg.port,
    targetName: cfg.baseDN || "-",
    user: cfg.bindDN || "-",
    envKeys: ["LDAP_URL", "LDAP_BASE_DN", "LDAP_BIND_DN", "LDAP_BIND_PASSWORD"],
  };

  if (!cfg.url || !cfg.baseDN || !cfg.bindDN || !cfg.bindPassword) {
    return {
      ...base,
      ok: false,
      latencyMs: Date.now() - start,
      error: "ตั้งค่า LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD ไม่ครบ",
      checkedAt: new Date().toISOString(),
    };
  }

  const client = new Client({
    url: cfg.url,
    timeout: 8000,
    connectTimeout: 8000,
    tlsOptions: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.bind(cfg.bindDN, cfg.bindPassword);
    const { searchEntries } = await client.search(cfg.baseDN, {
      scope: "base",
      filter: "(objectClass=*)",
      attributes: ["dn", "dc", "name"],
    });

    return {
      ...base,
      ok: true,
      latencyMs: Date.now() - start,
      serverVersion: cfg.url.startsWith("ldaps://") ? "LDAPS (TLS)" : "LDAP",
      details: `Bind สำเร็จ (${cfg.bindDN}) | Base DN verified (${searchEntries.length} root entry)`,
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
    try {
      await client.unbind();
    } catch {
      // ignore
    }
  }
}
