#!/usr/bin/env node
// build Next.js แบบ standalone สำหรับ server ปลายทาง แล้ว push ขึ้น branch deploy
// server แค่ `git pull` + `pm2 restart` ไม่ต้อง npm install / next build เอง
// เครื่องที่ build เป็น macOS / Windows / Linux ก็ได้ (ต้องมี Node 18+ และ git)
//
// ใช้:  node scripts/deploy.mjs             build + ตรวจ + push
//       node scripts/deploy.mjs --no-push   build + ตรวจ อย่างเดียว
//
// ค่าเฉพาะโปรเจกต์อยู่ใน deploy.config.json ที่ root ของ repo (ไม่มีก็ได้):
//   target      "linux-x64" | "win32-x64"  platform ของ server (ค่าเริ่มต้น linux-x64)
//   buildFlags  argument เพิ่มของ next build เช่น ["--webpack"]
//   smokePath   หน้าที่ไม่ต้องใช้ DB สำหรับทดลองรันหลัง build (ค่าเริ่มต้น /)
//   buildEnv    env ที่ต้องมีตอน build — ใส่แค่ค่า dummy ห้ามใส่ secret จริง
//   branch      branch ปลายทาง (ค่าเริ่มต้น deploy)
//   pm2Name     ชื่อ process ใน pm2 / ecosystem.config.cjs (ค่าเริ่มต้น = ชื่อโฟลเดอร์ repo)
//   port        PORT ที่ใส่ใน ecosystem (ค่าเริ่มต้น 3000) — server.js อ่าน PORT ก่อน .env
// เงื่อนไข: next.config ต้องตั้ง output: "standalone"

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const IS_WIN = process.platform === "win32";
const PUSH = !process.argv.includes("--no-push");
const TARGETS = ["linux-x64", "win32-x64"];

const step = (msg) => console.log(`\n==> ${msg}`);
function die(msg) {
  console.error(`\nหยุด: ${msg}`);
  process.exit(1);
}

function run(cmd, args, { shell = false, quiet = false, ...opts } = {}) {
  const r = spawnSync(cmd, args, {
    stdio: quiet ? ["ignore", "ignore", "pipe"] : "inherit",
    encoding: "utf8",
    shell,
    ...opts,
  });
  if (r.status !== 0) {
    const err = String(r.stderr || r.stdout || "").trim();
    die(`คำสั่งล้มเหลว: ${cmd} ${args.join(" ")}${err ? `\n${err}` : ""}`);
  }
}
function capture(cmd, args, { shell = false, ...opts } = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell, ...opts });
  return { ok: r.status === 0, text: (r.stdout || "").trim() };
}

/** git ใน worktree deploy — ปิด autocrlf เพื่อไม่ให้ Windows แปลง LF ทั้ง node_modules */
function gitDeploy(args, cwd) {
  run(
    "git",
    ["-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", "core.longpaths=true", ...args],
    { cwd, quiet: true },
  );
}

function walk(dir, { skip = () => false } = {}) {
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (skip(p, e)) continue;
    if (e.isDirectory()) files.push(...walk(p, { skip }));
    else if (e.isFile()) files.push(p);
  }
  return files;
}

function binaryTarget(file) {
  const b = Buffer.alloc(4096);
  const fd = fs.openSync(file, "r");
  const n = fs.readSync(fd, b, 0, b.length, 0);
  fs.closeSync(fd);
  if (n >= 20 && b.readUInt32BE(0) === 0x7f454c46) {
    return b.readUInt16LE(18) === 0x3e ? "linux-x64" : "linux (ไม่ใช่ x64)";
  }
  if (n >= 64 && b.toString("latin1", 0, 2) === "MZ") {
    const pe = b.readUInt32LE(0x3c);
    return pe + 6 <= n && b.readUInt16LE(pe + 4) === 0x8664 ? "win32-x64" : "windows (ไม่ใช่ x64)";
  }
  return "macOS หรืออื่น ๆ";
}

// ---------------------------------------------------------------- config
const major = Number(process.versions.node.split(".")[0]);
if (major < 18) die(`ต้องใช้ Node 18 ขึ้นไป (ตอนนี้ ${process.version})`);

const repoOut = capture("git", ["rev-parse", "--show-toplevel"]);
if (!repoOut.ok) die("ต้องรันในโฟลเดอร์ที่เป็น git repo");
const REPO = path.resolve(repoOut.text);

const cfgFile = path.join(REPO, "deploy.config.json");
const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, "utf8")) : {};
const TARGET = cfg.target ?? "linux-x64";
if (!TARGETS.includes(TARGET)) die(`target ต้องเป็น ${TARGETS.join(" หรือ ")} (ได้ "${TARGET}")`);
const BRANCH = cfg.branch ?? "deploy";
const FLAGS = cfg.buildFlags ?? [];
const SMOKE = cfg.smokePath ?? "/";
const BUILD_ENV = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...(cfg.buildEnv ?? {}) };
const PORT = Number(cfg.port) > 0 ? Number(cfg.port) : 3000;

const NAME = path.basename(REPO);
const PM2_NAME = String(cfg.pm2Name || NAME).trim() || NAME;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), `${NAME}-deploy-`));
const B = path.join(WORK, "build");
const D = path.join(WORK, "deploy");
const SA = path.join(B, ".next", "standalone");
const NM = path.join(SA, "node_modules");
const NM_SRC = path.join(B, "node_modules");
let server = null;

process.on("exit", () => {
  if (server) server.kill();
  for (const w of [B, D]) {
    spawnSync("git", ["worktree", "remove", "--force", w], { cwd: REPO, stdio: "ignore" });
  }
  try {
    fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    console.error(`ลบโฟลเดอร์ชั่วคราวไม่ได้ ลบเองได้: ${WORK}`);
  }
  spawnSync("git", ["worktree", "prune"], { cwd: REPO, stdio: "ignore" });
});
process.on("SIGINT", () => process.exit(130));

const git = (args, cwd = REPO) => run("git", args, { cwd });
const npm = (args, cwd = B) => run("npm", args, { cwd, env: BUILD_ENV, shell: IS_WIN });
const npx = (args, cwd = B) => run("npx", args, { cwd, env: BUILD_ENV, shell: IS_WIN });

const SRC_BRANCH = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO }).text;
const SRC = capture("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO }).text;
BUILD_ENV.NEXT_PUBLIC_APP_BUILD_ID = SRC;
if (capture("git", ["status", "--porcelain"], { cwd: REPO }).text) {
  console.log(`คำเตือน: มีไฟล์ที่ยังไม่ commit — จะไม่ถูก build (build จาก commit ${SRC})`);
}
console.log(`โปรเจกต์ ${NAME} | ${SRC_BRANCH}@${SRC} | server: ${TARGET} | branch ปลายทาง: ${BRANCH}`);
console.log(`APP_BUILD_ID=${SRC}`);

// ---------------------------------------------------------------- build
step("เตรียมโฟลเดอร์ build (git worktree แยก + ติดตั้ง dependency ใหม่)");
git(["worktree", "add", "-q", "--detach", B, "HEAD"]);
const hasLock =
  fs.existsSync(path.join(B, "package-lock.json")) ||
  fs.existsSync(path.join(B, "npm-shrinkwrap.json"));
if (hasLock) {
  npm(["ci", "--no-audit", "--no-fund", "--loglevel=error"]);
} else {
  console.log("  ไม่มี package-lock.json — ใช้ npm install");
  npm(["install", "--no-audit", "--no-fund", "--loglevel=error"]);
}

const hasPrisma = fs.existsSync(path.join(B, "prisma", "schema.prisma"));
if (hasPrisma) {
  step("prisma generate");
  npx(["prisma", "generate"]);
}

step(`next build ${FLAGS.join(" ")}`);
npx(["next", "build", ...FLAGS]);
if (!fs.existsSync(path.join(SA, "server.js"))) {
  die('ไม่พบ .next/standalone/server.js — ตั้ง output: "standalone" ใน next.config ก่อน');
}

fs.cpSync(path.join(B, ".next", "static"), path.join(SA, ".next", "static"), { recursive: true });
if (fs.existsSync(path.join(B, "public"))) {
  fs.cpSync(path.join(B, "public"), path.join(SA, "public"), { recursive: true });
}
for (const uploadRel of [
  path.join("data", "uploads"),
  path.join("public", "uploads"),
]) {
  const targetDir = path.join(SA, uploadRel);
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
}
if (hasPrisma) {
  fs.mkdirSync(path.join(SA, "prisma"), { recursive: true });
  fs.cpSync(path.join(B, "prisma", "schema.prisma"), path.join(SA, "prisma", "schema.prisma"));
  if (fs.existsSync(path.join(B, "prisma", "migrations"))) {
    fs.cpSync(path.join(B, "prisma", "migrations"), path.join(SA, "prisma", "migrations"), { recursive: true });
  }
  for (const f of ["prisma.config.ts", "prisma.config.js"]) {
    if (fs.existsSync(path.join(B, f))) fs.cpSync(path.join(B, f), path.join(SA, f));
  }
}

// ---------------------------------------------------------------- native module
step(`ปรับ native module ให้ตรงกับ ${TARGET}`);

const imgDir = path.join(NM, "@img");
const sharpPkg = path.join(NM_SRC, "sharp", "package.json");
if (fs.existsSync(imgDir) && fs.existsSync(sharpPkg)) {
  const optional = JSON.parse(fs.readFileSync(sharpPkg, "utf8")).optionalDependencies ?? {};
  const wanted = Object.entries(optional).filter(([name]) => name.endsWith(`-${TARGET}`));
  if (!wanted.length) die(`sharp รุ่นนี้ไม่มี binary สำหรับ ${TARGET}`);
  for (const [name, version] of wanted) {
    const dest = path.join(NM, name);
    if (fs.existsSync(dest)) continue;
    const packed = capture("npm", ["pack", `${name}@${version}`], { cwd: WORK, shell: IS_WIN });
    if (!packed.ok) die(`ดาวน์โหลด ${name}@${version} ไม่ได้ (ต่อ npm registry ไม่ได้?)`);
    const tgz = packed.text.split(/\r?\n/).pop();
    const x = `x-${path.basename(name)}`;
    fs.mkdirSync(path.join(WORK, x));
    run("tar", ["-xzf", tgz, "-C", x], { cwd: WORK });
    fs.cpSync(path.join(WORK, x, "package"), dest, { recursive: true });
  }
  for (const d of fs.readdirSync(imgDir)) {
    if (d.startsWith("sharp-") && !d.endsWith(`-${TARGET}`)) {
      fs.rmSync(path.join(imgDir, d), { recursive: true, force: true });
    }
  }
  console.log(`  sharp -> ${wanted.map(([n]) => n).join(", ")}`);
}

const isTargetBinary = (f) => f.endsWith(".node") && path.basename(f).includes(TARGET);
const packages = fs.readdirSync(NM).flatMap((d) =>
  d.startsWith(".") ? [] : d.startsWith("@") ? fs.readdirSync(path.join(NM, d)).map((s) => `${d}/${s}`) : [d],
);
for (const pkg of packages) {
  const src = path.join(NM_SRC, pkg);
  const dest = path.join(NM, pkg);
  if (!fs.existsSync(src) || !walk(src).some(isTargetBinary)) continue;
  if (walk(dest).some(isTargetBinary)) continue;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  for (const f of walk(dest)) if (f.endsWith(".node") && !isTargetBinary(f)) fs.rmSync(f);
  console.log(`  ${pkg} -> copy ทั้ง package (มี binary ${TARGET} ในตัว)`);
}

const wrong = walk(NM)
  .filter((f) => f.endsWith(".node"))
  .map((f) => [path.relative(NM, f), binaryTarget(f)])
  .filter(([, t]) => t !== TARGET);
if (wrong.length) {
  die(
    `ยังมี binary ที่ไม่ใช่ ${TARGET}:\n` +
      wrong.map(([f, t]) => `  ${f}  (${t})`).join("\n") +
      "\npackage นี้ compile ตอนติดตั้ง — เปลี่ยนไปใช้ตัวที่เป็น JS ล้วน หรือ build บนเครื่องที่ OS เดียวกับ server",
  );
}
console.log("  binary ตรงกับ server ทั้งหมด");

// ---------------------------------------------------------------- secret
step("ตรวจไฟล์ต้องห้ามและ secret");
const skipNodeModules = (p, e) => e.isDirectory() && e.name === "node_modules";
const forbidden = walk(SA, { skip: skipNodeModules }).filter((f) =>
  /^\.env|\.pem$|\.key$/.test(path.basename(f)),
);
if (forbidden.length) die(`พบไฟล์ที่ห้ามขึ้น git:\n${forbidden.map((f) => "  " + path.relative(SA, f)).join("\n")}`);

const secrets = [];
for (const envFile of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const p = path.join(REPO, envFile);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!/SECRET|TOKEN|PASSWORD|_PASS$|KEY|CREDENTIAL|^DATABASE_URL$/.test(key) || value.length < 8) continue;
    secrets.push({ key, envFile, value: Buffer.from(value) });
  }
}
if (secrets.length) {
  for (const f of walk(SA)) {
    const buf = fs.readFileSync(f);
    const hit = secrets.find((s) => buf.includes(s.value));
    if (hit) die(`พบค่าของ ${hit.key} (จาก ${hit.envFile}) ใน ${path.relative(SA, f)}`);
  }
}
console.log(`  ไม่พบ (เทียบ ${secrets.length} ค่าจากไฟล์ .env ของเครื่องนี้)`);

// ---------------------------------------------------------------- smoke test
step(`ทดลองรัน server.js แล้วเรียก ${SMOKE}`);
const port = 20000 + Math.floor(Math.random() * 10000);
const logFile = path.join(WORK, "smoke.log");
const log = fs.openSync(logFile, "w");
server = spawn(process.execPath, [path.join(SA, "server.js")], {
  cwd: SA,
  env: { ...BUILD_ENV, AUTH_SECRET: "smoke", AUTH_TRUST_HOST: "true", PORT: String(port), HOSTNAME: "127.0.0.1" },
  stdio: ["ignore", log, log],
});
let status = 0;
for (let i = 0; i < 30 && !status; i++) {
  try {
    status = (await fetch(`http://127.0.0.1:${port}${SMOKE}`, { redirect: "manual" })).status;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
server.kill();
server = null;
fs.closeSync(log);
if (!(status >= 200 && status < 400)) {
  const tail = fs.readFileSync(logFile, "utf8").split(/\r?\n/).slice(-20).join("\n");
  die(`server ตอบ HTTP ${status || "ไม่ได้"}\n${tail}`);
}
console.log(`  HTTP ${status}`);

const ecosystem = `module.exports = {
  apps: [
    {
      name: ${JSON.stringify(PM2_NAME)},
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: ${PORT},
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
`;
fs.writeFileSync(path.join(SA, "ecosystem.config.cjs"), ecosystem);
console.log(`  เขียน ecosystem.config.cjs (name=${PM2_NAME}, PORT=${PORT})`);

// ป้องกัน Windows autocrlf แปลงไฟล์ทั้ง node_modules ตอน git add (สาเหตุที่ deploy พัง)
fs.writeFileSync(
  path.join(SA, ".gitattributes"),
  "* -text\n",
);

fs.writeFileSync(
  path.join(SA, "DEPLOY.md"),
  `# ${NAME} — build สำเร็จรูปสำหรับ ${TARGET}

build จาก ${SRC_BRANCH}@${SRC} ด้วย scripts/deploy.mjs — ห้ามแก้ไฟล์ใน branch นี้บน server

- ครั้งแรก: วาง .env ไว้ในโฟลเดอร์นี้ แล้ว \`pm2 start ecosystem.config.cjs\` → \`pm2 save\`
- อัปเดต: \`git pull\` → \`npx prisma migrate deploy\` (ถ้ามี migration ใหม่) → \`pm2 restart ${PM2_NAME}\` (ถ้าแก้ .env ใส่ \`--update-env\`)
- เปลี่ยนพอร์ต: แก้ \`port\` ใน \`deploy.config.json\` บน main แล้ว deploy ใหม่ (อย่าแก้ ecosystem บน server)
`,
);

if (!PUSH) {
  step("ผ่านทุกขั้น (--no-push จึงไม่ได้ push)");
  process.exit(0);
}

// ---------------------------------------------------------------- push
step(`commit ขึ้น branch ${BRANCH}`);
const remote = capture("git", ["ls-remote", "--heads", "origin", BRANCH], { cwd: REPO });
if (!remote.ok) die("ต่อ origin ไม่ได้");
if (remote.text) {
  git(["fetch", "-q", "origin", BRANCH]);
  git(["worktree", "add", "-q", "-B", BRANCH, D, `origin/${BRANCH}`]);
  git(["rm", "-rq", "--ignore-unmatch", "."], D);
} else {
  git(["worktree", "add", "-q", "--detach", D, "HEAD"]);
  git(["checkout", "-q", "--orphan", BRANCH], D);
  git(["rm", "-rqf", "."], D);
}
fs.cpSync(SA, D, { recursive: true });
for (const f of walk(D, { skip: (p, e) => e.name === ".git" })) {
  if (path.basename(f) === ".DS_Store") fs.rmSync(f);
}
console.log("  กำลัง git add (ปิด autocrlf / longpaths — ไม่แสดง warning CRLF)");
gitDeploy(["add", "-f", "-A"], D);
const msgFile = path.join(WORK, "commit-msg.txt");
fs.writeFileSync(msgFile, `build: standalone จาก ${SRC_BRANCH}@${SRC} (${TARGET})\n`);
gitDeploy(["commit", "-q", "-F", msgFile], D);
gitDeploy(["push", "-q", "-u", "origin", BRANCH], D);

const head = capture("git", ["rev-parse", "--short", "HEAD"], { cwd: D }).text;
step(`push แล้ว: ${BRANCH} @ ${head}`);
console.log(`บน server: git pull แล้ว pm2 restart ${PM2_NAME}  (หรือครั้งแรก: pm2 start ecosystem.config.cjs)`);
