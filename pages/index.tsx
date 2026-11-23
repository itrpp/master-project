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
  shortName: string;
  category: "database" | "directory" | "mail";
  engine: string;
  role: string;
}> = [
  {
    id: "oracle",
    name: "Oracle Database (HIS / Core Oracle)",
    shortName: "Oracle HIS",
    category: "database",
    engine: "Oracle Database (oracledb)",
    role: "ฐานข้อมูลหลักระบบโรงพยาบาล (HIS)",
  },
  {
    id: "mysql_main",
    name: "MySQL — Main Database (DB_*)",
    shortName: "MySQL Main",
    category: "database",
    engine: "MySQL / MariaDB",
    role: "ฐานข้อมูลหลักของเว็บแอปพลิเคชัน",
  },
  {
    id: "mysql_inventory",
    name: "MySQL — Inventory Database (INVENTORY_DB_*)",
    shortName: "MySQL Inventory",
    category: "database",
    engine: "MySQL / MariaDB",
    role: "ฐานข้อมูลระบบคลังพัสดุและครุภัณฑ์",
  },
  {
    id: "mysql_gotowin",
    name: "MySQL — GOTOWIN HR / Backoffice (GOTOWIN_DB_*)",
    shortName: "MySQL GOTOWIN",
    category: "database",
    engine: "MySQL / MariaDB",
    role: "ฐานข้อมูลระบบบุคลากรและงานบริหาร",
  },
  {
    id: "ldap",
    name: "Active Directory / LDAP Server",
    shortName: "AD / LDAP",
    category: "directory",
    engine: "LDAP / LDAPS",
    role: "ระบบยืนยันตัวตนกลางขององค์กร (Single Sign-On)",
  },
  {
    id: "smtp",
    name: "SMTP Mail Server (ระบบส่งอีเมล)",
    shortName: "SMTP Mail",
    category: "mail",
    engine: "Nodemailer SMTP",
    role: "ระบบแจ้งเตือนและส่งอีเมลอัตโนมัติ",
  },
];

interface CommandStep {
  step: string;
  title: string;
  badge: string;
  description: string;
  note?: string;
  commands: Array<{
    label: string;
    code: string;
  }>;
}

const LOCAL_SETUP_STEPS: CommandStep[] = [
  {
    step: "01",
    title: "โคลนโปรเจกต์ต้นแบบ (Clone Master Template) และสร้างโฟลเดอร์ระบบใหม่",
    badge: "Git Clone",
    description:
      "ดึงซอร์สโค้ดจาก GitHub Repository ต้นแบบมาไว้ที่เครื่อง Local โดยสามารถตั้งชื่อโฟลเดอร์ปลายทางเป็นชื่อโปรเจกต์ใหม่ได้ทันที",
    note: "เปลี่ยน my-new-project เป็นชื่อโปรเจกต์ใหม่ของคุณ หรือใช้ชื่อ master-project หากต้องการพัฒนาต่อบนต้นแบบ",
    commands: [
      {
        label: "1.1 โคลนเป็นชื่อโปรเจกต์ใหม่แล้วเข้าโฟลเดอร์ทันที (แนะนำสำหรับขึ้นระบบใหม่)",
        code: `git clone https://github.com/itrpp/master-project.git my-new-project\ncd my-new-project`,
      },
      {
        label: "1.2 หรือโคลนด้วยชื่อเดิม (master-project)",
        code: `git clone https://github.com/itrpp/master-project.git\ncd master-project`,
      },
    ],
  },
  {
    step: "02",
    title: "ผูก Git Remote ไปยัง Repository ของโปรเจกต์ใหม่ (กรณีแยกโปรเจกต์ใหม่)",
    badge: "Git Remote",
    description:
      "หากนำเทมเพลตนี้ไปสร้างระบบใหม่ ให้เปลี่ยน URL ของ origin ไปยัง Git Repository ใหม่ เพื่อไม่ให้เผลอ push ทับตัวเทมเพลตต้นแบบ",
    commands: [
      {
        label: "2.1 ตรวจสอบ Remote ปัจจุบัน และเปลี่ยนชี้ไปยัง Repo ใหม่",
        code: `git remote -v\ngit remote set-url origin https://github.com/itrpp/<ชื่อ-repo-ใหม่>.git`,
      },
      {
        label: "2.2 หรือล้างประวัติ Git เดิมเพื่อเริ่มต้น Commit แรกใหม่ทั้งหมด (ทางเลือก)",
        code: `Remove-Item -Recurse -Force .git\ngit init\ngit add .\ngit commit -m "chore: initialize project from master-project template"\ngit branch -M main`,
      },
    ],
  },
  {
    step: "03",
    title: "ติดตั้ง Dependencies และตั้งค่าไฟล์ Environment (.env.local)",
    badge: "Dependencies & Env",
    description:
      "ติดตั้งแพ็กเกจทั้งหมดของระบบ และคัดลอกไฟล์ตัวอย่าง .env.example มาเป็น .env.local เพื่อกำหนดค่ารหัสผ่านฐานข้อมูล Oracle, MySQL, LDAP และ SMTP",
    commands: [
      {
        label: "3.1 ติดตั้ง Node Modules (รองรับ Node.js 18 / 20 / 22+)",
        code: `npm install`,
      },
      {
        label: "3.2 คัดลอกไฟล์ .env.example เป็น .env.local (Windows PowerShell)",
        code: `Copy-Item .env.example .env.local`,
      },
      {
        label: "3.3 คัดลอกไฟล์ .env.example เป็น .env.local (macOS / Linux / Git Bash)",
        code: `cp .env.example .env.local`,
      },
    ],
  },
  {
    step: "04",
    title: "เริ่มต้นรันเซิร์ฟเวอร์พัฒนา (Start Local Development Server)",
    badge: "Run Local",
    description:
      "รันโปรเจกต์บนเครื่อง Local เพื่อเริ่มต้นพัฒนา โดยค่าเริ่มต้นตั้งไว้ที่พอร์ต 3020 หรือสามารถระบุพอร์ตที่ต้องการได้เอง",
    commands: [
      {
        label: "4.1 รันโหมดพัฒนาปกติ (Port 3020)",
        code: `npm run dev`,
      },
      {
        label: "4.2 รันโหมดพัฒนาด้วย Turbopack (คอมไพล์ไวพิเศษ)",
        code: `npm run dev:turbo`,
      },
      {
        label: "4.3 ล้างแคช .next แล้วรันใหม่ (ใช้เมื่อสลับ branch หรือโมดูลค้าง)",
        code: `npm run dev:clean`,
      },
      {
        label: "4.4 รันโดยระบุหมายเลขพอร์ตเองตามต้องการ (เช่น Port 3050)",
        code: `npx next dev -p 3050`,
      },
    ],
  },
];

const CHEAT_SHEET_GROUPS = [
  {
    category: "Development & Code Quality",
    subtitle: "คำสั่งระหว่างเขียนโค้ด ตรวจสอบ Type และจัดระเบียบโค้ด",
    items: [
      {
        title: "รันเซิร์ฟเวอร์โหมดพัฒนา (Port 3020)",
        cmd: "npm run dev",
      },
      {
        title: "ตรวจสอบและแก้ไข ESLint อัตโนมัติ",
        cmd: "npm run lint",
      },
      {
        title: "จัดรูปแบบโค้ดทั้งหมดด้วย Prettier",
        cmd: "npm run format",
      },
      {
        title: "ตรวจสอบความถูกต้องของรูปแบบโค้ด (Format Check)",
        cmd: "npm run format:check",
      },
      {
        title: "ทดสอบ Build โปรเจกต์แบบ Production Standalone บนเครื่อง",
        cmd: "npm run build",
      },
    ],
  },
  {
    category: "Zero-Build Standalone Deployment",
    subtitle: "คำสั่ง Build สำเร็จรูปจากเครื่องพัฒนาแล้วส่งขึ้น branch deploy",
    items: [
      {
        title: "Build Standalone + ตรวจ Secret + Smoke Test + Push ขึ้น branch deploy",
        cmd: "npm run deploy",
      },
      {
        title: "ทดลอง Build และรัน Smoke Test โดยไม่ต้อง Push ขึ้น Git",
        cmd: "node ./scripts/deploy.mjs --no-push",
      },
    ],
  },
  {
    category: "Production Server & PM2 Commands",
    subtitle: "คำสั่งสำหรับรันที่เครื่องเซิร์ฟเวอร์ปลายทาง (Windows / Linux Server)",
    items: [
      {
        title: "ครั้งแรกบน Server: ดึง branch deploy และสั่งรันด้วย PM2",
        cmd: `git fetch origin deploy\ngit checkout -f deploy\ngit pull origin deploy\npm2 start ecosystem.config.cjs --only master-project\npm2 save`,
      },
      {
        title: "อัปเดตเวอร์ชันถัดไปบน Server (ไม่ต้อง npm install / ไม่ต้อง build บน Server)",
        cmd: `git pull origin deploy\npm2 restart master-project --update-env`,
      },
      {
        title: "ตรวจสอบสถานะและดู Log ของ PM2 แบบ Real-time",
        cmd: `pm2 status\npm2 logs master-project --lines 100`,
      },
    ],
  },
];

function CodeCopyBlock({
  label,
  code,
  id,
  copiedId,
  onCopy,
}: {
  label?: string;
  code: string;
  id: string;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  const isCopied = copiedId === id;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/95 shadow-inner transition-all hover:border-indigo-500/50">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/70 px-3.5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex gap-1.5 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </span>
          {label ? (
            <span className="truncate pl-1 text-xs font-medium text-slate-300">
              {label}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onCopy(id, code)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
            isCopied
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
              : "border-slate-700 bg-slate-800/90 text-slate-200 hover:border-indigo-400 hover:bg-indigo-600 hover:text-white"
          }`}
        >
          {isCopied ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>คัดลอกแล้ว!</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy คำสั่ง</span>
            </>
          )}
        </button>
      </div>

      <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-emerald-300 sm:text-[13px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function MasterTemplatePortalPage() {
  const [activeTab, setActiveTab] = useState<"guide" | "commands" | "connections">("guide");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Connection monitoring state
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

  const handleCopy = useCallback((id: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  }, []);

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
        <title>{`${siteConfig.name} — Enterprise Master Project Blueprint`}</title>
      </Head>

      <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
        {/* Background Ambient Glow */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute top-1/4 right-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        {/* Sticky Enterprise Top Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 font-black text-white shadow-lg shadow-indigo-500/25">
                MP
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-extrabold tracking-tight text-white">
                    MASTER PROJECT
                  </span>
                  <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
                    Enterprise Blueprint v{appVersion}
                  </span>
                  {appBuildId ? (
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      #{appBuildId}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-400">
                  เทมเพลตต้นแบบมาตรฐานองค์กร · Next.js 15 Standalone · Oracle / MySQL / LDAP / SMTP
                </p>
              </div>
            </div>

            {/* Compact Live DB Status Pill on Top Right */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTab("connections")}
                className="inline-flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-indigo-500/50 hover:bg-slate-900 cursor-pointer"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                      testingAll
                        ? "bg-amber-400"
                        : passedCount === totalCount && totalCount > 0
                          ? "bg-emerald-400"
                          : "bg-amber-400"
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                      testingAll
                        ? "bg-amber-400"
                        : passedCount === totalCount && totalCount > 0
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                    }`}
                  />
                </span>
                <span>
                  ฐานข้อมูล &amp; บริการ:{" "}
                  <strong className="text-white">
                    {testingAll && resultList.length === 0
                      ? "กำลังตรวจสอบ..."
                      : `${passedCount}/${totalCount} ออนไลน์`}
                  </strong>
                </span>
              </button>

              <Button
                size="sm"
                color="primary"
                variant="flat"
                isLoading={testingAll}
                className="border border-indigo-500/30 bg-indigo-500/20 text-xs font-semibold text-indigo-200"
                onPress={() => void runAllTests()}
              >
                รีเฟรชสถานะ
              </Button>
            </div>
          </div>

          {/* Mini Database Connection Strip */}
          <div className="border-t border-slate-800/60 bg-slate-900/60">
            <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Connected Services:
              </span>
              {INITIAL_TARGETS.map((item) => {
                const res = results[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab("connections")}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                      !res
                        ? "border-slate-800 bg-slate-900 text-slate-400"
                        : res.ok
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        !res ? "bg-slate-500" : res.ok ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    <span className="font-semibold">{item.shortName}</span>
                    {res ? (
                      <span className="font-mono text-[10px] opacity-80">
                        {res.ok ? `${res.targetName} (${res.latencyMs}ms)` : "Offline"}
                      </span>
                    ) : (
                      <span className="text-[10px] opacity-60">...</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
          {/* Hero Section */}
          <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/80 p-6 shadow-2xl sm:p-10">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
              <div className="space-y-4 lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                  <span>✨ ENTERPRISE STARTER TEMPLATE</span>
                  <span className="text-slate-600">|</span>
                  <span className="font-mono text-cyan-300">Port 3020 Ready</span>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl sm:leading-tight">
                  เทมเพลตต้นแบบสำหรับพัฒนาระบบใหม่{" "}
                  <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                    พร้อมเชื่อมต่อฐานข้อมูลองค์กรครบวงจร
                  </span>
                </h1>

                <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                  โปรเจกต์ต้นแบบ (<code className="font-mono text-indigo-300">{appName}</code>) ออกแบบมาเพื่อให้นักพัฒนาสามารถ{" "}
                  <strong className="text-white">Clone จาก Git ลงเครื่อง Local</strong> แล้วเริ่มพัฒนาระบบใหม่ได้ทันทีภายใน 2 นาที
                  มาพร้อมตัวเชื่อมต่อฐานข้อมูล{" "}
                  <strong className="text-white">Oracle HIS, MySQL 3 โปรไฟล์, Active Directory (LDAP), ระบบส่งอีเมล SMTP</strong>{" "}
                  และสคริปต์ <strong className="text-emerald-300">Zero-Build Standalone Deploy</strong> ขึ้น Production Server
                </p>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <span className="rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200">
                    ⚡ Next.js 15.5 + React 18
                  </span>
                  <span className="rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200">
                    🎨 HeroUI + Tailwind CSS 4
                  </span>
                  <span className="rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200">
                    🗄️ Oracle + MySQL + LDAP + SMTP
                  </span>
                  <span className="rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200">
                    🚀 PM2 Standalone Deploy
                  </span>
                </div>
              </div>

              {/* Quick Clone Box in Hero */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-indigo-500/30 bg-slate-950/90 p-4 shadow-xl">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      ⚡ Quick Start (Clone &amp; Run Local)
                    </span>
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                      http://localhost:3020
                    </span>
                  </div>
                  <CodeCopyBlock
                    id="hero-quick-start"
                    label="รันชุดคำสั่งนี้ใน PowerShell / Terminal"
                    code={`git clone https://github.com/itrpp/master-project.git\ncd master-project\nnpm install\nCopy-Item .env.example .env.local\nnpm run dev`}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("guide")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:text-sm cursor-pointer ${
                  activeTab === "guide"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                    : "border border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white"
                }`}
              >
                <span>📘 1. คู่มือดึงโปรเจกต์จาก Git ลงเครื่อง Local (Step-by-Step)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("commands")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:text-sm cursor-pointer ${
                  activeTab === "commands"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                    : "border border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white"
                }`}
              >
                <span>⌨️ 2. รวมคำสั่งทั้งหมด (Dev / Build / Deploy / PM2)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("connections")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:text-sm cursor-pointer ${
                  activeTab === "connections"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                    : "border border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white"
                }`}
              >
                <span>🗄️ 3. สถานะการเชื่อมต่อฐานข้อมูล &amp; ระบบ ({passedCount}/{totalCount})</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    passedCount === totalCount && totalCount > 0
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {passedCount === totalCount && totalCount > 0 ? "ONLINE" : `${passedCount}/${totalCount}`}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: STEP-BY-STEP LOCAL SETUP GUIDE */}
          {activeTab === "guide" ? (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-white sm:text-xl">
                    ขั้นตอนการนำโปรเจกต์ต้นแบบจาก Git มาติดตั้งที่เครื่อง Local แบบละเอียด
                  </h2>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    ทำตามลำดับขั้นตอนที่ 01 ถึง 04 ด้านล่าง พร้อมปุ่มกด Copy คำสั่งไปวางใน Terminal / PowerShell ได้ทันที
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {LOCAL_SETUP_STEPS.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-lg backdrop-blur-sm sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/15 font-mono text-sm font-black text-indigo-300">
                          {item.step}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-white sm:text-lg">
                              {item.title}
                            </h3>
                            <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
                              {item.badge}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                            {item.description}
                          </p>
                          {item.note ? (
                            <p className="mt-1.5 text-xs text-amber-300/90">
                              💡 หมายเหตุ: {item.note}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {item.commands.map((cmd, idx) => (
                        <CodeCopyBlock
                          key={`${item.step}-${idx}`}
                          id={`step-${item.step}-${idx}`}
                          label={cmd.label}
                          code={cmd.code}
                          copiedId={copiedId}
                          onCopy={handleCopy}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* TAB 2: ALL COMMANDS CHEAT SHEET */}
          {activeTab === "commands" ? (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-extrabold text-white sm:text-xl">
                  รวมคำสั่งที่เกี่ยวข้องทั้งหมด (Complete Command Reference)
                </h2>
                <p className="text-xs text-slate-400 sm:text-sm">
                  ครอบคลุมตั้งแต่การพัฒนาบนเครื่อง Local, การตรวจสอบคุณภาพโค้ด, การ Build Standalone และการ Deploy ขึ้น PM2 บน Server
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {CHEAT_SHEET_GROUPS.map((group, gIdx) => (
                  <div
                    key={group.category}
                    className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-lg"
                  >
                    <div className="space-y-4">
                      <div className="border-b border-slate-800 pb-3">
                        <h3 className="text-base font-bold text-white">{group.category}</h3>
                        <p className="mt-0.5 text-xs text-slate-400">{group.subtitle}</p>
                      </div>

                      <div className="space-y-3.5">
                        {group.items.map((item, iIdx) => (
                          <CodeCopyBlock
                            key={`${gIdx}-${iIdx}`}
                            id={`cheat-${gIdx}-${iIdx}`}
                            label={item.title}
                            code={item.cmd}
                            copiedId={copiedId}
                            onCopy={handleCopy}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Project Directory Blueprint */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-base font-bold text-white">
                  📂 โครงสร้างสถาปัตยกรรมไฟล์หลักของเทมเพลต (Project Architecture)
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                    <p className="font-mono font-bold text-indigo-300">lib/connectors/</p>
                    <p className="mt-1 text-slate-400">
                      โมดูลเชื่อมต่อฐานข้อมูล Oracle (`oracledb`), MySQL 3 ระบบ (`mysql2`), Active Directory (`ldapts`) และ SMTP (`nodemailer`)
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                    <p className="font-mono font-bold text-cyan-300">pages/api/system/</p>
                    <p className="mt-1 text-slate-400">
                      API สำหรับตรวจสอบสถานะการเชื่อมต่อ (`connections.ts`) และทดสอบส่งอีเมล (`test-email.ts`)
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                    <p className="font-mono font-bold text-emerald-300">scripts/deploy.mjs</p>
                    <p className="mt-1 text-slate-400">
                      สคริปต์ Build Standalone อัตโนมัติ ตรวจจับ Secret, ทดสอบรัน Smoke Test และ Push ขึ้น branch `deploy`
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* TAB 3: DATABASE & INFRASTRUCTURE CONNECTIVITY STATUS */}
          {activeTab === "connections" ? (
            <section className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-xs text-slate-400">บริการที่กำหนดใน .env.local</p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {totalCount} <span className="text-xs font-normal text-slate-400">รายการ</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4">
                  <p className="text-xs text-emerald-300">เชื่อมต่อสำเร็จ (Online)</p>
                  <p className="mt-1 text-2xl font-black text-emerald-400">
                    {passedCount} <span className="text-xs font-normal text-emerald-300/80">รายการ</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-4">
                  <p className="text-xs text-rose-300">เชื่อมต่อไม่สำเร็จ (Offline)</p>
                  <p className="mt-1 text-2xl font-black text-rose-400">
                    {failedCount} <span className="text-xs font-normal text-rose-300/80">รายการ</span>
                  </p>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-indigo-500/30 bg-indigo-950/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-indigo-300">ตรวจสอบล่าสุด</p>
                    {testingAll ? <Spinner size="sm" /> : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-300">
                      {lastCheckedAllAt
                        ? new Date(lastCheckedAllAt).toLocaleTimeString("th-TH")
                        : "กำลังโหลด..."}
                    </span>
                    <Button
                      size="sm"
                      color="primary"
                      isLoading={testingAll}
                      className="h-7 text-xs font-semibold"
                      onPress={() => void runAllTests()}
                    >
                      ทดสอบทั้งหมด
                    </Button>
                  </div>
                </div>
              </div>

              {/* Connection Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {INITIAL_TARGETS.map((item) => {
                  const res = results[item.id];
                  const isLoading = Boolean(testingSingle[item.id]) || (testingAll && !res);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-5 transition ${
                        !res
                          ? "border-slate-800 bg-slate-900/70"
                          : res.ok
                            ? "border-emerald-500/35 bg-slate-900/85 shadow-lg shadow-emerald-950/20"
                            : "border-rose-500/40 bg-rose-950/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-white sm:text-base">
                              {item.name}
                            </h3>
                            {res ? (
                              <Chip
                                color={res.ok ? "success" : "danger"}
                                size="sm"
                                variant="flat"
                                className="font-semibold"
                              >
                                {res.ok ? `ออนไลน์ (${res.latencyMs} ms)` : "เชื่อมต่อไม่สำเร็จ"}
                              </Chip>
                            ) : (
                              <Chip size="sm" variant="flat">
                                กำลังตรวจสอบ...
                              </Chip>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {item.role} · <span className="font-mono text-slate-300">{res?.engine || item.engine}</span>
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="bordered"
                          isLoading={isLoading}
                          className="shrink-0 border-slate-700 text-xs font-semibold text-slate-200 hover:border-indigo-400"
                          onPress={() => void runSingleTest(item.id)}
                        >
                          ทดสอบ
                        </Button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-slate-800/90 bg-slate-950/80 p-3 text-xs sm:grid-cols-3">
                        <div>
                          <span className="block text-[11px] text-slate-400">Host : Port</span>
                          <span className="font-mono font-semibold text-slate-200">
                            {res ? `${res.host}:${res.port}` : "..."}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">Database / Target</span>
                          <span className="font-mono font-semibold text-cyan-300">
                            {res?.targetName || "..."}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">User / Account</span>
                          <span className="font-mono font-semibold text-slate-200">
                            {res?.user || "..."}
                          </span>
                        </div>
                      </div>

                      {res?.ok && res.details ? (
                        <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-200">
                          {res.serverVersion ? (
                            <span className="mr-2 inline-block rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                              {res.serverVersion}
                            </span>
                          ) : null}
                          {res.details}
                        </div>
                      ) : null}

                      {res && !res.ok && res.error ? (
                        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-200">
                          <span className="font-bold">สาเหตุ: </span>
                          <span className="font-mono text-[11px] break-all">{res.error}</span>
                        </div>
                      ) : null}

                      {res?.envKeys && res.envKeys.length > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-slate-400">Env Keys:</span>
                          {res.envKeys.map((k) => (
                            <code
                              key={k}
                              className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
                            >
                              {k}
                            </code>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Quick SMTP Email Test inside Connection Tab */}
              <Card className="border border-slate-800 bg-slate-900/80 text-slate-100 shadow-lg">
                <CardHeader className="border-b border-slate-800 px-5 py-3.5">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      ✉️ ทดสอบส่งอีเมลจริงผ่านระบบ SMTP (SMTP Delivery Test)
                    </h3>
                    <p className="text-xs text-slate-400">
                      ทดสอบส่งอีเมลด้วยค่า <code className="font-mono text-slate-300">SMTP_*</code> ที่ตั้งไว้ใน{" "}
                      <code className="font-mono text-slate-300">.env.local</code>
                    </p>
                  </div>
                </CardHeader>
                <CardBody className="px-5 py-4">
                  <form className="grid grid-cols-1 gap-4 md:grid-cols-12" onSubmit={handleSendTestMail}>
                    <div className="md:col-span-5">
                      <Input
                        isRequired
                        label="อีเมลผู้รับทดสอบ (To)"
                        labelPlacement="outside"
                        placeholder="yourname@rpphosp.go.th"
                        type="email"
                        value={mailTo}
                        variant="bordered"
                        onValueChange={setMailTo}
                      />
                    </div>
                    <div className="md:col-span-7">
                      <Input
                        label="หัวข้ออีเมล (Subject)"
                        labelPlacement="outside"
                        value={mailSubject}
                        variant="bordered"
                        onValueChange={setMailSubject}
                      />
                    </div>
                    <div className="md:col-span-12">
                      <Textarea
                        label="ข้อความทดสอบ"
                        labelPlacement="outside"
                        minRows={2}
                        value={mailMessage}
                        variant="bordered"
                        onValueChange={setMailMessage}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-12">
                      <span className="text-xs text-slate-400">
                        ผู้ส่ง (From):{" "}
                        <code className="font-mono text-slate-200">
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
                        {sendingMail ? "กำลังส่งอีเมล..." : "ส่งอีเมลทดสอบ"}
                      </Button>
                    </div>
                  </form>

                  {mailResult ? (
                    <div
                      className={`mt-4 rounded-xl border p-3.5 text-xs ${
                        mailResult.ok
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                      }`}
                    >
                      <p className="font-bold">
                        {mailResult.ok
                          ? `ส่งอีเมลสำเร็จ (${mailResult.latencyMs} ms)`
                          : `ส่งอีเมลไม่สำเร็จ: ${mailResult.error}`}
                      </p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </section>
          ) : null}
        </main>
      </div>
    </>
  );
}
