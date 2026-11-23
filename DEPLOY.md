# master-project — build สำเร็จรูปสำหรับ win32-x64

build จาก main@63dc603 ด้วย scripts/deploy.mjs — ห้ามแก้ไฟล์ใน branch นี้บน server

- ครั้งแรก: วาง .env ไว้ในโฟลเดอร์นี้ แล้ว `pm2 start ecosystem.config.cjs` → `pm2 save`
- อัปเดต: `git pull` → `npx prisma migrate deploy` (ถ้ามี migration ใหม่) → `pm2 restart master-project` (ถ้าแก้ .env ใส่ `--update-env`)
- เปลี่ยนพอร์ต: แก้ `port` ใน `deploy.config.json` บน main แล้ว deploy ใหม่ (อย่าแก้ ecosystem บน server)
