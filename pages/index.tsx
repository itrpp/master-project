import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import { Spinner } from "@heroui/spinner";

import { siteConfig } from "@/config/site";
import { appBuildId, appName, appVersion } from "@/lib/version";
import type {
  EmailSendResult,
  ServiceConnectionResult,
  ServiceTargetId,
} from "@/types/connections";

const INITIAL_TARGETS: Array<{
  id: ServiceTargetId;
  name: string;
  category: "database" | "directory" | "mail";
  engine: string;
}> = [
  {
    id: "oracle",
    name: "Oracle Database (HIS / Core Oracle)",
    category: "database",
    engine: "Oracle Database (oracledb)",
  },
  {
    id: "mysql_main",
    name: "MySQL — Main Database (DB_*)",
    category: "database",
    engine: "MySQL / MariaDB",
  },
  {
    id: "mysql_inventory",
    name: "MySQL — Inventory Database (INVENTORY_DB_*)",
    category: "database",
    engine: "MySQL / MariaDB",
  },
  {
    id: "mysql_gotowin",
    name: "MySQL — GOTOWIN HR / Backoffice (GOTOWIN_DB_*)",
    category: "database",
    engine: "MySQL / MariaDB",
  },
  {
    id: "ldap",
    name: "Active Directory / LDAP Server",
    category: "directory",
    engine: "LDAP / LDAPS",
  },
  {
    id: "smtp",
    name: "SMTP Mail Server (ระบบส่งอีเมล)",
    category: "mail",
    engine: "Nodemailer SMTP",
  },
];

export default function MasterProjectDiagnosticPage() {
  const [results, setResults] = useState<Record<string, ServiceConnectionResult>>({});
  const [testingAll, setTestingAll] = useState(false);
  const [testingSingle, setTestingSingle] = useState<Record<string, boolean>>({});
  const [lastCheckedAllAt, setLastCheckedAllAt] = useState<string | null>(null);

  // Email test state
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState(
    "[Master Project] ทดสอบการเชื่อมต่อและส่งอีเมล SMTP",
  );
  const [mailMessage, setMailMessage] = useState(
    "ข้อความทดสอบจากโปรเจกต์ต้นแบบ (Master Project Template) ยืนยันว่าระบบสามารถส่งอีเมลผ่าน SMTP Server ที่ตั้งค่าใน .env.local ได้สำเร็จ",
  );
  const [sendingMail, setSendingMail] = useState(false);
  const [mailResult, setMailResult] = useState<EmailSendResult | null>(null);

  const runAllTests = useCallback(async () => {
    setTestingAll(true);
    try {
      const res = await fetch("/api/system/connections", {
        method: "GET",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: ServiceConnectionResult[];
        summary?: { checkedAt?: string };
      };

      if (Array.isArray(json.data)) {
        const map: Record<string, ServiceConnectionResult> = {};
        for (const item of json.data) {
          map[item.id] = item;
        }
        setResults(map);
        setLastCheckedAllAt(json.summary?.checkedAt ?? new Date().toISOString());
      }
    } catch (err) {
      console.error("Failed to test connections:", err);
    } finally {
      setTestingAll(false);
    }
  }, []);

  const runSingleTest = useCallback(async (targetId: ServiceTargetId) => {
    setTestingSingle((prev) => ({ ...prev, [targetId]: true }));
    try {
      const res = await fetch(`/api/system/connections?target=${encodeURIComponent(targetId)}`, {
        method: "GET",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: ServiceConnectionResult[];
      };
      const item = json.data?.[0];
      if (item) {
        setResults((prev) => ({ ...prev, [item.id]: item }));
      }
    } catch (err) {
      console.error(`Failed to test ${targetId}:`, err);
    } finally {
      setTestingSingle((prev) => ({ ...prev, [targetId]: false }));
    }
  }, []);

  useEffect(() => {
    void runAllTests();
  }, [runAllTests]);

  const handleSendTestMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailTo.trim()) return;

    setSendingMail(true);
    setMailResult(null);
    try {
      const res = await fetch("/api/system/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: mailTo.trim(),
          subject: mailSubject.trim(),
          message: mailMessage.trim(),
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: EmailSendResult;
        error?: string;
      };
      if (json.data) {
        setMailResult(json.data);
      } else {
        setMailResult({
          ok: false,
          to: mailTo.trim(),
          from: "-",
          host: "-",
          port: 0,
          secure: false,
          latencyMs: 0,
          error: json.error || "ส่งอีเมลไม่สำเร็จ",
          sentAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      setMailResult({
        ok: false,
        to: mailTo.trim(),
        from: "-",
        host: "-",
        port: 0,
        secure: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ API",
        sentAt: new Date().toISOString(),
      });
    } finally {
      setSendingMail(false);
    }
  };

  const resultList = INITIAL_TARGETS.map((t) => results[t.id]).filter(Boolean);
  const totalCount = INITIAL_TARGETS.length;
  const passedCount = resultList.filter((r) => r?.ok).length;
  const failedCount = resultList.filter((r) => r && !r.ok).length;

  return (
    <>
      <Head>
        <title>{siteConfig.name} — ระบบทดสอบการเชื่อมต่อฐานข้อมูลและอีเมล</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-900">
        {/* Top Header */}
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-20">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold tracking-wide text-white shadow-xs">
                  MASTER PROJECT
                </span>
                <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                  โปรเจกต์ต้นแบบ &amp; ศูนย์ทดสอบการเชื่อมต่อระบบ (Infrastructure &amp; DB Connectivity)
                </h1>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                App: <code className="font-mono font-semibold text-slate-700">{appName}</code> · Version:{" "}
                <code className="font-mono font-semibold text-slate-700">v{appVersion}</code>
                {appBuildId ? (
                  <>
                    {" "}
                    · Build ID: <code className="font-mono text-indigo-700">{appBuildId}</code>
                  </>
                ) : null}{" "}
                · รองรับ <code className="font-mono text-emerald-700">npm run deploy</code> (Standalone PM2)
              </p>
            </div>

            <div className="flex items-center gap-3">
              {lastCheckedAllAt ? (
                <span className="hidden text-xs text-slate-500 sm:inline">
                  ตรวจล่าสุด: {new Date(lastCheckedAllAt).toLocaleTimeString("th-TH")}
                </span>
              ) : null}
              <Button
                color="primary"
                isLoading={testingAll}
                size="sm"
                className="font-semibold shadow-xs"
                onPress={() => void runAllTests()}
              >
                {testingAll ? "กำลังทดสอบทุกการเชื่อมต่อ..." : "ทดสอบการเชื่อมต่อทั้งหมดอีกครั้ง"}
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
          {/* Summary Banner */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardBody className="py-3.5">
                <p className="text-xs font-medium text-slate-500">รายการเชื่อมต่อทั้งหมดใน .env.local</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
                  {totalCount} <span className="text-sm font-normal text-slate-500">บริการ</span>
                </p>
              </CardBody>
            </Card>

            <Card className="border border-emerald-200 bg-emerald-50/60 shadow-xs">
              <CardBody className="py-3.5">
                <p className="text-xs font-medium text-emerald-800">เชื่อมต่อสำเร็จ (Connected)</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700">
                  {passedCount} <span className="text-sm font-normal text-emerald-700">รายการ</span>
                </p>
              </CardBody>
            </Card>

            <Card className="border border-rose-200 bg-rose-50/60 shadow-xs">
              <CardBody className="py-3.5">
                <p className="text-xs font-medium text-rose-800">เชื่อมต่อไม่สำเร็จ (Failed)</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-rose-700">
                  {failedCount} <span className="text-sm font-normal text-rose-700">รายการ</span>
                </p>
              </CardBody>
            </Card>

            <Card className="border border-indigo-200 bg-indigo-50/60 shadow-xs">
              <CardBody className="py-3.5">
                <p className="text-xs font-medium text-indigo-800">สถานะความพร้อม Master Project</p>
                <div className="mt-1.5 flex items-center gap-2">
                  {testingAll && resultList.length === 0 ? (
                    <Spinner size="sm" />
                  ) : passedCount === totalCount && totalCount > 0 ? (
                    <Chip color="success" size="sm" variant="flat" className="font-semibold">
                      พร้อมใช้งานครบทุกบริการ (100%)
                    </Chip>
                  ) : (
                    <Chip color="warning" size="sm" variant="flat" className="font-semibold">
                      เชื่อมต่อได้ {passedCount}/{totalCount} บริการ
                    </Chip>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Connection Cards Grid */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                1. สถานะการเชื่อมต่อฐานข้อมูล (Oracle / MySQL), Active Directory (LDAP) และ Mail Server (SMTP)
              </h2>
              <span className="text-xs text-slate-500">
                กดปุ่ม &quot;ทดสอบ&quot; ในแต่ละการ์ดเพื่อแยกตรวจสอบรายตัวได้ทันที
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {INITIAL_TARGETS.map((item) => {
                const res = results[item.id];
                const isLoading = Boolean(testingSingle[item.id]) || (testingAll && !res);

                const borderClass = !res
                  ? "border-slate-200 bg-white"
                  : res.ok
                    ? "border-emerald-300 border-l-4 border-l-emerald-500 bg-white"
                    : "border-rose-300 border-l-4 border-l-rose-500 bg-rose-50/20";

                return (
                  <Card key={item.id} className={`border shadow-xs ${borderClass}`}>
                    <CardHeader className="flex items-start justify-between gap-3 pb-2 pt-3.5 px-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{item.name}</span>
                          {res ? (
                            <Chip
                              color={res.ok ? "success" : "danger"}
                              size="sm"
                              variant="flat"
                              className="font-semibold"
                            >
                              {res.ok ? `เชื่อมต่อสำเร็จ (${res.latencyMs} ms)` : "เชื่อมต่อไม่สำเร็จ"}
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="flat">
                              กำลังตรวจสอบ...
                            </Chip>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{res?.engine || item.engine}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="bordered"
                        isLoading={isLoading}
                        className="shrink-0 text-xs font-medium"
                        onPress={() => void runSingleTest(item.id)}
                      >
                        ทดสอบ
                      </Button>
                    </CardHeader>

                    <CardBody className="space-y-2.5 px-4 pb-3.5 pt-1 text-xs">
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 sm:grid-cols-3">
                        <div>
                          <span className="block text-[11px] text-slate-400">Host : Port</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {res ? `${res.host}:${res.port}` : "..."}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">Database / Base / Target</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {res?.targetName || "..."}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">User / Bind Account</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {res?.user || "..."}
                          </span>
                        </div>
                      </div>

                      {res?.ok && res.details ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-emerald-950">
                          <p className="font-medium">
                            {res.serverVersion ? (
                              <span className="mr-1.5 inline-block rounded bg-emerald-200/80 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-950">
                                {res.serverVersion}
                              </span>
                            ) : null}
                            {res.details}
                          </p>
                        </div>
                      ) : null}

                      {res && !res.ok && res.error ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
                          <p className="font-semibold">สาเหตุข้อผิดพลาด:</p>
                          <p className="mt-0.5 font-mono text-[11px] break-all">{res.error}</p>
                        </div>
                      ) : null}

                      {res?.envKeys && res.envKeys.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          <span className="text-[11px] text-slate-400">ตัวแปร .env:</span>
                          {res.envKeys.map((k) => (
                            <code
                              key={k}
                              className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                            >
                              {k}
                            </code>
                          ))}
                        </div>
                      ) : null}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* SMTP Send Test Email Section */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Card className="border border-slate-200 bg-white shadow-xs lg:col-span-7">
              <CardHeader className="border-b border-slate-100 px-5 py-3.5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    2. ทดสอบส่งอีเมลจริงผ่าน SMTP Server (Email Delivery Test)
                  </h2>
                  <p className="text-xs text-slate-500">
                    ใช้ค่า <code className="font-mono">SMTP_HOST</code>,{" "}
                    <code className="font-mono">SMTP_PORT</code>,{" "}
                    <code className="font-mono">SMTP_USER</code>,{" "}
                    <code className="font-mono">SMTP_FROM</code> จาก{" "}
                    <code className="font-mono">.env.local</code>
                  </p>
                </div>
              </CardHeader>

              <CardBody className="px-5 py-4">
                <form className="space-y-4" onSubmit={handleSendTestMail}>
                  <Input
                    isRequired
                    label="อีเมลผู้รับทดสอบ (To Email)"
                    labelPlacement="outside"
                    placeholder="ระบุอีเมลผู้รับ เช่น yourname@rpphosp.go.th หรือ gmail.com"
                    type="email"
                    value={mailTo}
                    variant="bordered"
                    onValueChange={setMailTo}
                  />

                  <Input
                    label="หัวข้ออีเมล (Subject)"
                    labelPlacement="outside"
                    placeholder="หัวข้ออีเมลทดสอบ"
                    value={mailSubject}
                    variant="bordered"
                    onValueChange={setMailSubject}
                  />

                  <Textarea
                    label="ข้อความทดสอบ (Message Body)"
                    labelPlacement="outside"
                    minRows={3}
                    value={mailMessage}
                    variant="bordered"
                    onValueChange={setMailMessage}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-slate-500">
                      ผู้ส่ง (From):{" "}
                      <code className="font-mono font-semibold text-slate-700">
                        {results.smtp?.targetName || "noreply@rpphosp.go.th"}
                      </code>
                    </span>
                    <Button
                      color="primary"
                      isDisabled={!mailTo.trim()}
                      isLoading={sendingMail}
                      type="submit"
                      className="font-semibold"
                    >
                      {sendingMail ? "กำลังส่งอีเมลทดสอบ..." : "ส่งอีเมลทดสอบ"}
                    </Button>
                  </div>
                </form>

                {mailResult ? (
                  <div
                    className={`mt-4 rounded-xl border p-3.5 text-xs ${
                      mailResult.ok
                        ? "border-emerald-300 bg-emerald-50/80 text-emerald-950"
                        : "border-rose-300 bg-rose-50 text-rose-950"
                    }`}
                  >
                    <p className="font-bold">
                      {mailResult.ok
                        ? `ส่งอีเมลทดสอบสำเร็จ (${mailResult.latencyMs} ms)`
                        : "ส่งอีเมลทดสอบไม่สำเร็จ"}
                    </p>
                    <div className="mt-1.5 space-y-1 font-mono text-[11px]">
                      <p>
                        <strong>To:</strong> {mailResult.to} | <strong>From:</strong> {mailResult.from}
                      </p>
                      <p>
                        <strong>SMTP Server:</strong> {mailResult.host}:{mailResult.port} (secure=
                        {String(mailResult.secure)})
                      </p>
                      {mailResult.messageId ? (
                        <p>
                          <strong>Message-ID:</strong> {mailResult.messageId}
                        </p>
                      ) : null}
                      {mailResult.response ? (
                        <p>
                          <strong>Server Response:</strong> {mailResult.response}
                        </p>
                      ) : null}
                      {mailResult.error ? (
                        <p className="text-rose-800">
                          <strong>Error:</strong> {mailResult.error}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            {/* Guide & Deploy Instructions Card */}
            <Card className="border border-slate-200 bg-white shadow-xs lg:col-span-5">
              <CardHeader className="border-b border-slate-100 px-5 py-3.5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    3. โครงสร้างโปรเจกต์ต้นแบบ &amp; การ Deploy
                  </h2>
                  <p className="text-xs text-slate-500">
                    พร้อมสำหรับการนำไปโคลนขึ้นระบบใหม่และ Build Standalone ขึ้น Server
                  </p>
                </div>
              </CardHeader>

              <CardBody className="space-y-3 px-5 py-4 text-xs leading-relaxed text-slate-700">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-bold text-slate-900">โครงสร้างไฟล์หลัก (Clean Architecture)</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 font-mono text-[11px] text-slate-600">
                    <li>
                      <strong>lib/connectors/</strong> — โมดูลเชื่อมต่อ Oracle, MySQL (3 โปรไฟล์), LDAP, SMTP
                    </li>
                    <li>
                      <strong>pages/api/system/connections.ts</strong> — API ตรวจสอบการเชื่อมต่อทั้งหมด
                    </li>
                    <li>
                      <strong>pages/api/system/test-email.ts</strong> — API ทดสอบส่งอีเมลผ่าน SMTP
                    </li>
                    <li>
                      <strong>pages/api/version.ts</strong> — Health check &amp; Auto-reload หลัง Deploy
                    </li>
                    <li>
                      <strong>scripts/deploy.mjs</strong> — สคริปต์ Build Standalone &amp; Push ขึ้น branch{" "}
                      <code>deploy</code>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
                  <p className="font-bold text-indigo-950">คำสั่งสำคัญสำหรับพัฒนาและ Deploy</p>
                  <div className="mt-1.5 space-y-1.5 font-mono text-[11px] text-indigo-950">
                    <p>
                      <code className="rounded bg-white px-1.5 py-0.5 font-bold">npm run dev</code> — รันโหมดพัฒนา
                      (พอร์ต 3005)
                    </p>
                    <p>
                      <code className="rounded bg-white px-1.5 py-0.5 font-bold">npm run build</code> — ตรวจสอบและ
                      Build โปรเจกต์แบบ Standalone
                    </p>
                    <p>
                      <code className="rounded bg-white px-1.5 py-0.5 font-bold">npm run deploy</code> — Build
                      Standalone สำหรับ Linux Server, ตรวจ secret, ทดสอบ smoke test และ push ขึ้น branch{" "}
                      <code>deploy</code>
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </section>
        </main>
      </div>
    </>
  );
}
