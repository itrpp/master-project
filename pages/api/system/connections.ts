import type { NextApiRequest, NextApiResponse } from "next";
import {
  ALL_SERVICE_TARGETS,
  testAllServiceConnections,
  testSingleServiceConnection,
} from "@/lib/connectors";
import type { ServiceTargetId } from "@/types/connections";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  try {
    const rawTarget =
      typeof req.query.target === "string"
        ? req.query.target
        : typeof req.body?.target === "string"
          ? req.body.target
          : "";

    if (rawTarget && ALL_SERVICE_TARGETS.includes(rawTarget as ServiceTargetId)) {
      const result = await testSingleServiceConnection(rawTarget as ServiceTargetId);
      return res.status(200).json({
        success: true,
        data: [result],
        summary: {
          total: 1,
          passed: result.ok ? 1 : 0,
          failed: result.ok ? 0 : 1,
          checkedAt: new Date().toISOString(),
        },
      });
    }

    const results = await testAllServiceConnections();
    const passed = results.filter((r) => r.ok).length;

    return res.status(200).json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        passed,
        failed: results.length - passed,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
