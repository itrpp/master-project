import dns from "dns";
import nodemailer from "nodemailer";
import type { EmailSendResult, ServiceConnectionResult } from "@/types/connections";

let cachedResolvedHost: string | null = null;

async function resolveSmtpHost(host: string): Promise<string> {
  if (host !== "mail.rpphosp.go.th") {
    return host;
  }
  if (cachedResolvedHost) {
    return cachedResolvedHost;
  }
  try {
    await dns.promises.lookup(host);
    cachedResolvedHost = host;
  } catch {
    cachedResolvedHost = "203.151.152.21";
  }
  return cachedResolvedHost;
}

export function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || "").trim();
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = (process.env.SMTP_USER || "").trim();
  const pass = process.env.SMTP_PASS ?? "";
  const from = (process.env.SMTP_FROM || user || "").trim();

  return { host, port, secure, user, pass, from };
}

export async function createSmtpTransporter() {
  const cfg = getSmtpConfig();
  const resolvedHost = await resolveSmtpHost(cfg.host);

  const transporter = nodemailer.createTransport({
    host: resolvedHost,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.user && cfg.pass ? { auth: { user: cfg.user, pass: cfg.pass } } : {}),
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 25_000,
    requireTLS: cfg.port === 587,
    tls: {
      servername: cfg.host,
    },
  });

  return { transporter, cfg, resolvedHost };
}

export async function testSmtpConnection(): Promise<ServiceConnectionResult> {
  const start = Date.now();
  const cfg = getSmtpConfig();

  const base: Omit<ServiceConnectionResult, "ok" | "latencyMs" | "checkedAt"> = {
    id: "smtp",
    name: "SMTP Mail Server (ระบบส่งอีเมล)",
    category: "mail",
    engine: `Nodemailer SMTP (${cfg.secure ? "SSL/TLS" : "STARTTLS"})`,
    host: cfg.host || "-",
    port: cfg.port || 465,
    targetName: `From: ${cfg.from || "-"}`,
    user: cfg.user || "-",
    envKeys: ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"],
  };

  if (!cfg.host || !cfg.port) {
    return {
      ...base,
      ok: false,
      latencyMs: Date.now() - start,
      error: "ตั้งค่า SMTP_HOST หรือ SMTP_PORT ใน .env.local ไม่ครบ",
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const { transporter, resolvedHost } = await createSmtpTransporter();
    await transporter.verify();

    return {
      ...base,
      ok: true,
      latencyMs: Date.now() - start,
      serverVersion: `${cfg.secure ? "SMTPS" : "SMTP"} Port ${cfg.port}`,
      details: `SMTP Handshake & Auth สำเร็จ | Host: ${cfg.host}${resolvedHost !== cfg.host ? ` (${resolvedHost})` : ""} | Sender: ${cfg.from}`,
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
  }
}

export async function sendTestEmail(params: {
  to: string;
  subject?: string;
  message?: string;
}): Promise<EmailSendResult> {
  const start = Date.now();
  const { cfg, transporter } = await createSmtpTransporter();
  const to = params.to.trim();
  const subject =
    params.subject?.trim() ||
    `[Master Project] ทดสอบการส่งอีเมล (${new Date().toLocaleString("th-TH")})`;
  const message =
    params.message?.trim() ||
    "นี่คืออีเมลทดสอบจากระบบ Master Project Template เพื่อยืนยันว่าการตั้งค่า SMTP ใน .env.local สามารถเชื่อมต่อและส่งอีเมลได้ตามปกติ";

  try {
    if (!to || !to.includes("@")) {
      throw new Error("กรุณาระบุอีเมลผู้รับ (To) ให้ถูกต้อง");
    }

    const info = await transporter.sendMail({
      from: cfg.from || cfg.user,
      to,
      subject,
      text: message,
      html: `
        <div style="font-family: 'Sarabun', 'Prompt', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Master Project — ทดสอบการส่งอีเมลสำเร็จ</h2>
          <p style="color: #334155; line-height: 1.6;">${message.replace(/\n/g, "<br/>")}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <table style="width: 100%; font-size: 13px; color: #64748b;">
            <tr><td><strong>SMTP Host:</strong></td><td>${cfg.host}:${cfg.port} (secure=${String(cfg.secure)})</td></tr>
            <tr><td><strong>Sender (From):</strong></td><td>${cfg.from}</td></tr>
            <tr><td><strong>Recipient (To):</strong></td><td>${to}</td></tr>
            <tr><td><strong>Timestamp:</strong></td><td>${new Date().toLocaleString("th-TH")}</td></tr>
          </table>
        </div>
      `,
    });

    return {
      ok: true,
      to,
      from: cfg.from || cfg.user,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      messageId: info.messageId,
      response: info.response,
      latencyMs: Date.now() - start,
      sentAt: new Date().toISOString(),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      to,
      from: cfg.from || cfg.user,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      latencyMs: Date.now() - start,
      error: errorMsg,
      sentAt: new Date().toISOString(),
    };
  }
}
