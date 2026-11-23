# Master Project Template (`master-project`)

โปรเจกต์ต้นแบบ (Master Starter Template) บน **Next.js 15 (Pages Router) + TypeScript + HeroUI + Tailwind CSS v4** สำหรับใช้เริ่มต้นพัฒนาระบบใหม่ของโรงพยาบาลราชพิพัฒน์ โดยตัดฟีเจอร์เฉพาะของระบบเดิมออกทั้งหมด เหลือเฉพาะโครงสร้างแกนหลักที่สะอาด พร้อมเชื่อมโยงฐานข้อมูลและระบบพื้นฐานครบชุด

## ความสามารถในโปรเจกต์ต้นแบบ

1. **เชื่อมโยงและทดสอบฐานข้อมูลทุกตัวจาก `.env.local`:**
   - **Oracle Database (`oracledb`)** — รองรับทั้ง Thick Mode (Instant Client) และ Thin Mode พร้อมตั้งค่า `CURRENT_SCHEMA`
   - **MySQL — Main Database (`DB_*`)**
   - **MySQL — e-GP Database (`EGP_DB_*`)**
   - **MySQL — Purchase / BudgetPlan Database (`PURCHASE_DB_*`)**
   - **MySQL — Inventory Database (`INVENTORY_DB_*`)**
   - **MySQL — GOTOWIN HR / Backoffice (`GOTOWIN_DB_*`)**
2. **ทดสอบการเชื่อมต่อ Active Directory / LDAP (`ldapts`)**
3. **ทดสอบการเชื่อมต่อและส่งอีเมลจริงผ่าน SMTP (`nodemailer`)**
4. **ระบบ Standalone Deployment (`npm run deploy`):**
   - ใช้ `scripts/deploy.mjs` และ `deploy.config.json` สำหรับ Build Next.js แบบ Standalone ปรับ native binary (`oracledb`, `sharp`) ให้ตรงกับ Linux Server (`linux-x64`), ตรวจป้องกัน Secret รั่วไหล, รัน Smoke Test อัตโนมัติ และ Push ขึ้น branch `deploy` เพื่อให้ Server `git pull` + `pm2 restart` ได้ทันที

## การเริ่มต้นใช้งานสำหรับโปรเจกต์ใหม่

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. คัดลอกไฟล์ .env.example เป็น .env.local (หากยังไม่มี)
cp .env.example .env.local

# 3. รันเซิร์ฟเวอร์พัฒนา (http://localhost:3005)
npm run dev
```

## การ Deploy ขึ้น Server

ปรับค่าพอร์ตและชื่อโปรเจกต์ใน `deploy.config.json` แล้วรัน:

```bash
# ทดสอบ build + smoke test โดยยังไม่ push
node scripts/deploy.mjs --no-push

# build + smoke test + push ขึ้น branch deploy
npm run deploy
```
