import type { NextApiRequest, NextApiResponse } from "next";
import { sendTestEmail } from "@/lib/connectors/smtp-connector";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { to, subject, message } = (req.body ?? {}) as {
      to?: string;
      subject?: string;
      message?: string;
    };

    const result = await sendTestEmail({
      to: String(to ?? ""),
      subject,
      message,
    });

    return res.status(result.ok ? 200 : 400).json({
      success: result.ok,
      data: result,
      error: result.error,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
