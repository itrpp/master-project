import { rmSync, existsSync } from "fs";
import { resolve } from "path";

const roots = [".next", "node_modules/.cache"];

for (const rel of roots) {
  const abs = resolve(process.cwd(), rel);
  if (!existsSync(abs)) {
    console.log(`[clean-next-cache] skip (ไม่มี): ${rel}`);
    continue;
  }
  try {
    rmSync(abs, { recursive: true, force: true });
    console.log(`[clean-next-cache] removed ${rel}`);
  } catch (err) {
    console.warn(
      `[clean-next-cache] ลบ ${rel} ไม่สำเร็จ:`,
      err instanceof Error ? err.message : err,
    );
  }
}
