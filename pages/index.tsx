import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/button";
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
    name: "Oracle Database (HIS)",
    shortName: "Oracle HIS",
    category: "database",
    engine: "oracledb",
    role: "ฐานข้อมูลหลักโรงพยาบาล",
  },
  {
    id: "mysql_main",
    name: "MySQL — Main Database",
    shortName: "MySQL Main",
    category: "database",
    engine: "MySQL / MariaDB",
    role: "ฐานข้อมูลหลักแอปพลิเคชัน",
  },
  {
    id: "mysql_inventory",
    name: "MySQL — Inventory",
    shortName: "MySQL Inventory",
    category: "database",
    engine: "MySQL / MariaDB",
    role: "คลังพัสดุและครุภัณฑ์",
  },
  {
    id: "mysql_gotowin",
    name: "MySQL — GOTOWIN HR",
    shortName: "MySQL GOTOWIN",
    category: "database",
    engine: "MySQL / MariaDB",
    role: "บุคลากรและงานบริหาร",
  },
  {
    id: "ldap",
    name: "Active Directory / LDAP",
    shortName: "AD / LDAP",
    category: "directory",
    engine: "LDAP / LDAPS",
    role: "ยืนยันตัวตนกลางองค์กร",
  },
  {
    id: "smtp",
    name: "SMTP Mail Server",
    shortName: "SMTP Mail",
    category: "mail",
    engine: "Nodemailer",
    role: "ระบบส่งอีเมลแจ้งเตือน",
  },
];

interface SetupStep {
  step: string;
  title: string;
  subtitle: string;
  commands: Array<{
    label: string;
    code: string;
  }>;
}

const LOCAL_SETUP_STEPS: SetupStep[] = [
  {
    step: "1",
    title: "Clone โปรเจกต์ต้นแบบจาก Git",
    subtitle: "ดึงซอร์สโค้ดลงเครื่อง Local โดยตั้งชื่อโฟลเดอร์โปรเจกต์ใหม่ได้ทันที",
    commands: [
      {
        label: "โคลนเป็นชื่อโปรเจกต์ใหม่ (แนะนำ)",
        code: `git clone https://github.com/itrpp/master-project.git my-new-project\ncd my-new-project`,
      },
      {
        label: "หรือโคลนด้วยชื่อ master-project เดิม",
        code: `git clone https://github.com/itrpp/master-project.git\ncd master-project`,
      },
    ],
  },
  {
    step: "2",
    title: "เปลี่ยน Git Remote ไปยัง Repo ใหม่",
    subtitle: "ป้องกันการเผลอ push ทับโปรเจกต์ต้นแบบ",
    commands: [
      {
        label: "ชี้ origin ไปยัง Git Repository ของระบบใหม่",
        code: `git remote set-url origin https://github.com/itrpp/<ชื่อ-repo-ใหม่>.git\ngit remote -v`,
      },
      {
        label: "หรือรีเซ็ต .git เพื่อเริ่มประวัติ Commit แรกใหม่",
        code: `Remove-Item -Recurse -Force .git\ngit init && git add . && git commit -m "chore: init from master-project"`,
      },
    ],
  },
  {
    step: "3",
    title: "ติดตั้งแพ็กเกจ & ตั้งค่า .env.local",
    subtitle: "ติดตั้ง dependencies และคัดลอกไฟล์ตั้งค่าฐานข้อมูล",
    commands: [
      {
        label: "ติดตั้ง Node Modules",
        code: `npm install`,
      },
      {
        label: "สร้างไฟล์ .env.local (Windows PowerShell)",
        code: `Copy-Item .env.example .env.local`,
      },
      {
        label: "สร้างไฟล์ .env.local (macOS / Linux / Git Bash)",
        code: `cp .env.example .env.local`,
      },
    ],
  },
  {
    step: "4",
    title: "รันเซิร์ฟเวอร์พัฒนาบนเครื่อง Local",
    subtitle: "เปิดใช้งานที่ http://localhost:3020",
    commands: [
      {
        label: "รันโหมดพัฒนาปกติ (Port 3020)",
        code: `npm run dev`,
      },
      {
        label: "รันด้วย Turbopack / หรือล้างแคชก่อนรัน",
        code: `npm run dev:turbo\nnpm run dev:clean`,
      },
      {
        label: "รันโดยระบุพอร์ตอื่นตามต้องการ",
        code: `npx next dev -p 3050`,
      },
    ],
  },
];

const COMMAND_GROUPS = [
  {
    title: "คำสั่งพัฒนา & ตรวจสอบโค้ด (Local Dev)",
    desc: "ใช้ระหว่างพัฒนาและตรวจสอบความถูกต้องก่อนขึ้นระบบ",
    items: [
      { label: "รันเซิร์ฟเวอร์พัฒนา (Port 3020)", code: "npm run dev" },
      { label: "รันด้วย Turbopack (คอมไพล์เร็ว)", code: "npm run dev:turbo" },
      { label: "ล้างแคช .next แล้วรันใหม่", code: "npm run dev:clean" },
      { label: "ตรวจและแก้ ESLint อัตโนมัติ", code: "npm run lint" },
      { label: "จัดระเบียบโค้ดด้วย Prettier", code: "npm run format" },
      { label: "ทดสอบ Build Production บนเครื่อง", code: "npm run build" },
    ],
  },
  {
    title: "คำสั่ง Build & Deploy ขึ้น Server",
    desc: "Build แบบ Standalone จากเครื่องพัฒนาแล้วส่งขึ้น branch deploy",
    items: [
      {
        label: "Build + ตรวจ Secret + Smoke Test + Push ขึ้น branch deploy",
        code: "npm run deploy",
      },
      {
        label: "ทดลอง Build และทดสอบโดยไม่ Push ขึ้น Git",
        code: "node ./scripts/deploy.mjs --no-push",
      },
    ],
  },
  {
    title: "คำสั่งรัน PM2 บนเครื่อง Server ปลายทาง",
    desc: "รันบน Server โดยไม่ต้อง npm install หรือ next build บน Server",
    items: [
      {
        label: "ติดตั้งครั้งแรกบน Server (สลับไป branch deploy แล้วเริ่ม PM2)",
        code: `git fetch origin deploy\ngit checkout -f deploy\ngit pull origin deploy\npm2 start ecosystem.config.cjs --only master-project\npm2 save`,
      },
      {
        label: "อัปเดตเวอร์ชันถัดไปบน Server",
        code: `git pull origin deploy\npm2 restart master-project --update-env`,
      },
      {
        label: "ดูสถานะและ Log ของ PM2",
        code: `pm2 status\npm2 logs master-project --lines 100`,
      },
    ],
  },
];

function AppleCodeCard({
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
    <div className="group rounded-xl border border-[#d2d2d7] bg-[#fafafa] transition-all hover:border-[#0071e3]/60 hover:bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-[#e8e8ed] px-3.5 py-2">
        <span className="truncate text-xs font-medium text-[#515154]">
          {label || "Terminal"}
        </span>
        <button
          type="button"
          onClick={() => onCopy(id, code)}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
            isCopied
              ? "bg-emerald-600 text-white"
              : "bg-[#0071e3] text-white hover:bg-[#0077ed] active:scale-95"
          }`}
        >
          {isCopied ? (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>คัดลอกแล้ว</span>
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-2.5 font-mono text-xs leading-relaxed text-[#1d1d1f]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function MasterTemplateApplePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"quickstart" | "commands" | "connections">("quickstart");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Connection states
  const [results, setResults] = useState<Record<string, ServiceConnectionResult>>({});
  const [testingAll, setTestingAll] = useState(false);
  const [testingSingle, setTestingSingle] = useState<Record<string, boolean>>({});
  const [lastCheckedAllAt, setLastCheckedAllAt] = useState<string | null>(null);

  // Email test states
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("[Master Project] ทดสอบการส่งอีเมล SMTP");
  const [mailMessage, setMailMessage] = useState(
    "ข้อความทดสอบจาก Master Project Template ยืนยันการเชื่อมต่อ SMTP สำเร็จ",
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
    }, 1800);
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

  const navItems: Array<{
    id: "quickstart" | "commands" | "connections";
    label: string;
    sub: string;
    badge?: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "quickstart",
      label: "วิธีดึงโปรเจกต์ลง Local",
      sub: "4 ขั้นตอนพร้อมใช้",
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: "commands",
      label: "รวมคำสั่งทั้งหมด",
      sub: "Dev · Build · Deploy · PM2",
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      ),
    },
    {
      id: "connections",
      label: "สถานะฐานข้อมูล & ระบบ",
      sub: "Oracle · MySQL · LDAP · SMTP",
      badge: `${passedCount}/${totalCount}`,
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <Head>
        <title>{`${siteConfig.name} — Enterprise Master Template`}</title>
      </Head>

      {/* Pure White Apple-inspired Theme, Full-Width Edge-to-Edge */}
      <div className="min-h-screen w-full bg-white text-[#1d1d1f] antialiased selection:bg-[#0071e3] selection:text-white">
        {/* Top Apple-style Minimal Navigation Bar */}
        <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#d2d2d7]/70 bg-white/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? "ขยายเมนูด้านซ้าย" : "ย่อเมนูด้านซ้าย"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] transition hover:bg-[#f5f5f7] cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-base font-bold tracking-tight text-[#1d1d1f]">
                Master Project
              </span>
              <span className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#515154]">
                v{appVersion}
              </span>
              {appBuildId ? (
                <span className="hidden rounded-full border border-[#d2d2d7] px-2 py-0.5 font-mono text-[11px] text-[#86868b] sm:inline-block">
                  #{appBuildId}
                </span>
              ) : null}
            </div>
          </div>

          {/* Right: Compact Live DB Status Pills */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="hidden items-center gap-1.5 xl:flex">
              {INITIAL_TARGETS.map((t) => {
                const r = results[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveMenu("connections")}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                      !r
                        ? "border-[#d2d2d7] bg-[#f5f5f7] text-[#86868b]"
                        : r.ok
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        !r ? "bg-gray-400" : r.ok ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    <span>{t.shortName}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveMenu("connections")}
              className="inline-flex items-center gap-2 rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-[#1d1d1f] transition hover:border-[#0071e3] cursor-pointer"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  testingAll
                    ? "bg-amber-500"
                    : passedCount === totalCount && totalCount > 0
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                }`}
              />
              <span>
                DB Online: {passedCount}/{totalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void runAllTests()}
              disabled={testingAll}
              className="inline-flex items-center gap-1 rounded-full bg-[#0071e3] px-3.5 py-1 text-xs font-semibold text-white transition hover:bg-[#0077ed] disabled:opacity-50 cursor-pointer"
            >
              {testingAll ? "กำลังตรวจ..." : "เช็คสถานะ"}
            </button>
          </div>
        </header>

        {/* Full-Width Body Layout: Left Collapsible Sidebar + Right Main Content */}
        <div className="flex min-h-[calc(100vh-3.5rem)] w-full">
          {/* Left Collapsible Sidebar */}
          <aside
            className={`shrink-0 border-r border-[#d2d2d7]/80 bg-[#fbfbfd] transition-all duration-200 flex flex-col justify-between ${
              sidebarCollapsed ? "w-[72px]" : "w-72"
            }`}
          >
            <div className="p-3 space-y-6">
              {/* Collapse Toggle Header inside Sidebar */}
              <div className="flex items-center justify-between px-2 pt-1">
                {!sidebarCollapsed ? (
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    เมนูเทมเพลตต้นแบบ
                  </span>
                ) : (
                  <span className="mx-auto text-[10px] font-bold uppercase text-[#86868b]">
                    เมนู
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((v) => !v)}
                  className="hidden sm:inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#86868b] hover:bg-[#e8e8ed]/70 hover:text-[#1d1d1f] cursor-pointer"
                  title={sidebarCollapsed ? "ขยายเมนู" : "ย่อเมนู"}
                >
                  <svg
                    className={`h-4 w-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const active = activeMenu === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveMenu(item.id)}
                      title={sidebarCollapsed ? `${item.label} (${item.sub})` : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${
                        active
                          ? "bg-[#0071e3] text-white shadow-xs"
                          : "text-[#1d1d1f] hover:bg-[#e8e8ed]/60"
                      } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                    >
                      {item.icon}
                      {!sidebarCollapsed ? (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold sm:text-sm">
                              {item.label}
                            </span>
                            {item.badge ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  active
                                    ? "bg-white/20 text-white"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {item.badge}
                              </span>
                            ) : null}
                          </div>
                          <p
                            className={`truncate text-[11px] ${
                              active ? "text-white/80" : "text-[#86868b]"
                            }`}
                          >
                            {item.sub}
                          </p>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </nav>

              {/* Compact Database Status List in Sidebar */}
              <div className="border-t border-[#d2d2d7]/70 pt-4">
                {!sidebarCollapsed ? (
                  <div className="mb-2 flex items-center justify-between px-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                      ฐานข้อมูลที่เชื่อมต่อ
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-emerald-700">
                      {passedCount}/{totalCount}
                    </span>
                  </div>
                ) : null}

                <div className="space-y-1">
                  {INITIAL_TARGETS.map((item) => {
                    const res = results[item.id];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveMenu("connections")}
                        title={`${item.name}: ${res ? (res.ok ? `ออนไลน์ (${res.targetName})` : "ออฟไลน์") : "กำลังตรวจสอบ"}`}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-[#e8e8ed]/60 cursor-pointer ${
                          sidebarCollapsed ? "justify-center px-0" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              !res
                                ? "bg-gray-300"
                                : res.ok
                                  ? "bg-emerald-500"
                                  : "bg-rose-500"
                            }`}
                          />
                          {!sidebarCollapsed ? (
                            <span className="truncate font-medium text-[#1d1d1f]">
                              {item.shortName}
                            </span>
                          ) : null}
                        </div>
                        {!sidebarCollapsed && res ? (
                          <span className="shrink-0 font-mono text-[10px] text-[#86868b]">
                            {res.ok ? `${res.latencyMs}ms` : "Fail"}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Sidebar Info */}
            {!sidebarCollapsed ? (
              <div className="border-t border-[#d2d2d7]/70 p-4 text-[11px] text-[#86868b]">
                <p className="font-semibold text-[#1d1d1f]">{appName}</p>
                <p className="mt-0.5">Next.js 15.5 · Port 3020 · Standalone</p>
              </div>
            ) : null}
          </aside>

          {/* Right Main Content Area (Full Width) */}
          <main className="flex-1 min-w-0 bg-white px-5 py-6 sm:px-8 lg:px-10">
            {/* Apple-Style Clean Page Title Banner */}
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#d2d2d7]/70 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0071e3]">
                  Enterprise Starter Template
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1d1d1f] sm:text-3xl">
                  {activeMenu === "quickstart" && "วิธีดึงโปรเจกต์ต้นแบบจาก Git ลงเครื่อง Local"}
                  {activeMenu === "commands" && "รวมคำสั่งทั้งหมดสำหรับการพัฒนาและ Deploy"}
                  {activeMenu === "connections" && "สถานะการเชื่อมต่อฐานข้อมูลและระบบบริการ"}
                </h1>
                <p className="mt-1 text-sm text-[#515154]">
                  {activeMenu === "quickstart" &&
                    "ทำตาม 4 ขั้นตอนกระชับด้านล่าง พร้อมกดปุ่ม Copy คำสั่งไปรันใน PowerShell หรือ Terminal ได้ทันที"}
                  {activeMenu === "commands" &&
                    "คำสั่งมาตรฐานทั้งหมดของโปรเจกต์ ตั้งแต่รัน Local (Port 3020), ตรวจโค้ด, Build Standalone และรัน PM2 บน Server"}
                  {activeMenu === "connections" &&
                    "ตรวจสอบการเชื่อมต่อฐานข้อมูล Oracle HIS, MySQL 3 โปรไฟล์, Active Directory (LDAP) และทดสอบส่งอีเมล SMTP"}
                </p>
              </div>

              {/* One-Click Full Script Copy Box */}
              {activeMenu === "quickstart" ? (
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      "all-in-one",
                      `git clone https://github.com/itrpp/master-project.git\ncd master-project\nnpm install\nCopy-Item .env.example .env.local\nnpm run dev`,
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-[#0071e3] bg-[#0071e3]/5 px-4 py-2 text-xs font-semibold text-[#0071e3] transition hover:bg-[#0071e3] hover:text-white cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>
                    {copiedId === "all-in-one"
                      ? "คัดลอกชุดคำสั่งรวดเดียวแล้ว!"
                      : "Copy คำสั่งติดตั้งรวดเดียว (All-in-One)"}
                  </span>
                </button>
              ) : null}
            </div>

            {/* VIEW 1: QUICKSTART STEP-BY-STEP (2-Column Full-Width Grid) */}
            {activeMenu === "quickstart" ? (
              <div className="space-y-6">
                {/* All-in-one Quick Banner */}
                <div className="rounded-2xl border border-[#d2d2d7] bg-[#fbfbfd] p-4 sm:p-5">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#0071e3] px-2.5 py-0.5 text-[11px] font-bold text-white">
                        Quick Start
                      </span>
                      <span className="text-sm font-bold text-[#1d1d1f]">
                        ชุดคำสั่งดึงโปรเจกต์และรันบนเครื่อง Local รวดเดียวจบ (Port 3020)
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#0071e3]">
                      http://localhost:3020
                    </span>
                  </div>
                  <AppleCodeCard
                    id="banner-all-in-one"
                    label="PowerShell / Terminal (Clone -> Install -> .env.local -> Run Dev)"
                    code={`git clone https://github.com/itrpp/master-project.git\ncd master-project\nnpm install\nCopy-Item .env.example .env.local\nnpm run dev`}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                  />
                </div>

                {/* 4 Steps Grid - Full Width 2 Columns on Large Screens */}
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {LOCAL_SETUP_STEPS.map((item) => (
                    <div
                      key={item.step}
                      className="flex flex-col justify-between rounded-2xl border border-[#d2d2d7] bg-white p-5 shadow-2xs"
                    >
                      <div>
                        <div className="mb-4 flex items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-xs font-bold text-white">
                            {item.step}
                          </span>
                          <div>
                            <h2 className="text-base font-bold text-[#1d1d1f]">
                              {item.title}
                            </h2>
                            <p className="text-xs text-[#515154]">{item.subtitle}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {item.commands.map((cmd, idx) => (
                            <AppleCodeCard
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
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* VIEW 2: ALL COMMANDS REFERENCE (3-Column Full-Width Grid) */}
            {activeMenu === "commands" ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                  {COMMAND_GROUPS.map((group, gIdx) => (
                    <div
                      key={group.title}
                      className="rounded-2xl border border-[#d2d2d7] bg-white p-5 shadow-2xs"
                    >
                      <div className="mb-4 border-b border-[#e8e8ed] pb-3">
                        <h2 className="text-base font-bold text-[#1d1d1f]">
                          {group.title}
                        </h2>
                        <p className="mt-0.5 text-xs text-[#515154]">{group.desc}</p>
                      </div>

                      <div className="space-y-3">
                        {group.items.map((item, iIdx) => (
                          <AppleCodeCard
                            key={`${gIdx}-${iIdx}`}
                            id={`cmd-${gIdx}-${iIdx}`}
                            label={item.label}
                            code={item.code}
                            copiedId={copiedId}
                            onCopy={handleCopy}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Compact File Structure Summary */}
                <div className="rounded-2xl border border-[#d2d2d7] bg-[#fbfbfd] p-5">
                  <h3 className="text-sm font-bold text-[#1d1d1f]">
                    โครงสร้างโฟลเดอร์สำคัญของเทมเพลตต้นแบบ
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    <div className="rounded-xl border border-[#d2d2d7] bg-white p-3">
                      <p className="font-mono font-bold text-[#0071e3]">lib/connectors/</p>
                      <p className="mt-1 text-[#515154]">
                        ตัวเชื่อมต่อ Oracle, MySQL 3 ระบบ, LDAP และ SMTP
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#d2d2d7] bg-white p-3">
                      <p className="font-mono font-bold text-[#0071e3]">pages/api/system/</p>
                      <p className="mt-1 text-[#515154]">
                        API ตรวจสอบสถานะฐานข้อมูลและทดสอบส่งอีเมล
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#d2d2d7] bg-white p-3">
                      <p className="font-mono font-bold text-[#0071e3]">deploy.config.json</p>
                      <p className="mt-1 text-[#515154]">
                        ตั้งค่า Target OS, ชื่อ PM2 (`master-project`) และพอร์ต (`3020`)
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#d2d2d7] bg-white p-3">
                      <p className="font-mono font-bold text-[#0071e3]">scripts/deploy.mjs</p>
                      <p className="mt-1 text-[#515154]">
                        สคริปต์ Build Standalone และ Push ขึ้น branch `deploy`
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* VIEW 3: DATABASE & INFRASTRUCTURE CONNECTIVITY */}
            {activeMenu === "connections" ? (
              <div className="space-y-6">
                {/* Summary Strip */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-2xl border border-[#d2d2d7] bg-[#fbfbfd] p-4">
                    <p className="text-xs text-[#515154]">บริการทั้งหมด (.env.local)</p>
                    <p className="mt-1 text-2xl font-bold text-[#1d1d1f]">
                      {totalCount} <span className="text-xs font-normal text-[#86868b]">ระบบ</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <p className="text-xs text-emerald-800">เชื่อมต่อสำเร็จ (Online)</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">
                      {passedCount} <span className="text-xs font-normal">ระบบ</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                    <p className="text-xs text-rose-800">เชื่อมต่อไม่สำเร็จ (Offline)</p>
                    <p className="mt-1 text-2xl font-bold text-rose-700">
                      {failedCount} <span className="text-xs font-normal">ระบบ</span>
                    </p>
                  </div>
                  <div className="flex flex-col justify-between rounded-2xl border border-[#d2d2d7] bg-[#fbfbfd] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#515154]">ตรวจล่าสุด</span>
                      {testingAll ? <Spinner size="sm" /> : null}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono text-xs text-[#1d1d1f]">
                        {lastCheckedAllAt
                          ? new Date(lastCheckedAllAt).toLocaleTimeString("th-TH")
                          : "..."}
                      </span>
                      <Button
                        size="sm"
                        color="primary"
                        isLoading={testingAll}
                        className="h-7 rounded-full bg-[#0071e3] text-xs font-semibold text-white"
                        onPress={() => void runAllTests()}
                      >
                        ทดสอบทั้งหมด
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 3-Column Full-Width Cards for 6 Services */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {INITIAL_TARGETS.map((item) => {
                    const res = results[item.id];
                    const isLoading = Boolean(testingSingle[item.id]) || (testingAll && !res);

                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                          !res
                            ? "border-[#d2d2d7] bg-white"
                            : res.ok
                              ? "border-emerald-300 bg-white"
                              : "border-rose-300 bg-rose-50/20"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    !res
                                      ? "bg-gray-300"
                                      : res.ok
                                        ? "bg-emerald-500"
                                        : "bg-rose-500"
                                  }`}
                                />
                                <h3 className="text-sm font-bold text-[#1d1d1f]">
                                  {item.name}
                                </h3>
                              </div>
                              <p className="mt-0.5 text-xs text-[#515154]">
                                {item.role} ({res?.engine || item.engine})
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => void runSingleTest(item.id)}
                              disabled={isLoading}
                              className="rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-[#1d1d1f] transition hover:border-[#0071e3] hover:text-[#0071e3] disabled:opacity-50 cursor-pointer"
                            >
                              {isLoading ? "..." : "ทดสอบ"}
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-[#e8e8ed] bg-[#fbfbfd] p-2.5 text-xs">
                            <div className="min-w-0">
                              <span className="block text-[10px] text-[#86868b]">Host:Port</span>
                              <span className="block truncate font-mono font-semibold text-[#1d1d1f]">
                                {res ? `${res.host}:${res.port}` : "..."}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <span className="block text-[10px] text-[#86868b]">Database</span>
                              <span className="block truncate font-mono font-semibold text-[#0071e3]">
                                {res?.targetName || "..."}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <span className="block text-[10px] text-[#86868b]">Latency</span>
                              <span className="block truncate font-mono font-semibold text-emerald-700">
                                {res ? (res.ok ? `${res.latencyMs} ms` : "Failed") : "..."}
                              </span>
                            </div>
                          </div>

                          {res?.ok && res.details ? (
                            <p className="mt-2.5 truncate text-xs text-emerald-800" title={res.details}>
                              ✓ {res.serverVersion ? `[${res.serverVersion}] ` : ""}
                              {res.details}
                            </p>
                          ) : null}

                          {res && !res.ok && res.error ? (
                            <p className="mt-2.5 text-xs text-rose-700 break-all">
                              ✕ {res.error}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Compact Apple-Style SMTP Test Form */}
                <div className="rounded-2xl border border-[#d2d2d7] bg-[#fbfbfd] p-5">
                  <h3 className="text-sm font-bold text-[#1d1d1f]">
                    ทดสอบส่งอีเมลผ่าน SMTP Server ({results.smtp?.targetName || "noreply@rpphosp.go.th"})
                  </h3>
                  <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12" onSubmit={handleSendTestMail}>
                    <div className="md:col-span-4">
                      <Input
                        isRequired
                        size="sm"
                        label="อีเมลผู้รับ (To)"
                        placeholder="yourname@rpphosp.go.th"
                        type="email"
                        value={mailTo}
                        variant="bordered"
                        onValueChange={setMailTo}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Input
                        size="sm"
                        label="หัวข้อ (Subject)"
                        value={mailSubject}
                        variant="bordered"
                        onValueChange={setMailSubject}
                      />
                    </div>
                    <div className="md:col-span-4 flex items-center gap-2">
                      <Textarea
                        size="sm"
                        label="ข้อความ"
                        minRows={1}
                        maxRows={2}
                        value={mailMessage}
                        variant="bordered"
                        onValueChange={setMailMessage}
                      />
                      <Button
                        color="primary"
                        isDisabled={!mailTo.trim()}
                        isLoading={sendingMail}
                        type="submit"
                        className="shrink-0 rounded-full bg-[#0071e3] px-5 font-semibold text-white"
                      >
                        ส่งทดสอบ
                      </Button>
                    </div>
                  </form>

                  {mailResult ? (
                    <p
                      className={`mt-2 text-xs font-semibold ${
                        mailResult.ok ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {mailResult.ok
                        ? `✓ ส่งอีเมลสำเร็จ (${mailResult.latencyMs} ms)`
                        : `✕ ส่งไม่สำเร็จ: ${mailResult.error}`}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </>
  );
}
