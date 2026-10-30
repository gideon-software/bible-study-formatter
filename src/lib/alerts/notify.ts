import { Resend } from "resend";
import { db } from "../db";
import { missingElements } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminEmails } from "../google/auth";

export interface AlertPayload {
  type: "missing_element" | "api_error" | "canary_failure";
  title: string;
  className?: string;
  versionAbbr?: string;
  bookName?: string;
  chapterNum?: number;
  details?: string;
  snippet?: string;
}

/**
 * Dispatches alerts to Discord/Slack webhook, Resend email, and persists to Neon DB in parallel.
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  const timestamp = new Date().toISOString();
  const tasks: Promise<unknown>[] = [];

  // 1. Persist to Neon DB if it's a missing element
  if (payload.type === "missing_element" && payload.className && db) {
    const database = db;
    const className = payload.className;
    tasks.push(
      (async () => {
        try {
          const existing = await database
            .select()
            .from(missingElements)
            .where(
              and(
                eq(missingElements.className, className),
                eq(missingElements.versionAbbr, payload.versionAbbr || "ESV")
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await database
              .update(missingElements)
              .set({
                occurrenceCount: existing[0].occurrenceCount + 1,
                lastSeenAt: new Date(),
                chapterNum: payload.chapterNum || existing[0].chapterNum,
              })
              .where(eq(missingElements.id, existing[0].id));
          } else {
            await database.insert(missingElements).values({
              className,
              versionAbbr: payload.versionAbbr || "ESV",
              bookName: payload.bookName || "Unknown",
              chapterNum: payload.chapterNum,
              snippet: payload.snippet,
              occurrenceCount: 1,
              resolved: false,
            });
          }
        } catch (dbErr) {
          console.error("[Alert] Failed to log missing element to Neon DB:", dbErr);
        }
      })()
    );
  }

  // 2. Dispatch to Discord / Slack Webhook if configured
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    const messageBody = {
      content: `🚨 **[BSF Alert] ${payload.title}**`,
      embeds: [
        {
          title: payload.title,
          color: payload.type === "missing_element" ? 0xffa500 : 0xff0000,
          fields: [
            ...(payload.className ? [{ name: "Class Name", value: `\`${payload.className}\``, inline: true }] : []),
            ...(payload.versionAbbr ? [{ name: "Version", value: payload.versionAbbr, inline: true }] : []),
            ...(payload.bookName ? [{ name: "Passage", value: `${payload.bookName} ${payload.chapterNum || ""}`, inline: true }] : []),
            ...(payload.details ? [{ name: "Details", value: payload.details }] : []),
          ],
          footer: { text: `Bible Study Formatter • ${timestamp}` },
        },
      ],
    };

    tasks.push(
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messageBody),
      }).catch((webhookErr) => {
        console.error("[Alert] Failed to send webhook alert:", webhookErr);
      })
    );
  }

  // 3. Dispatch to Email via Resend if configured
  const resendApiKey = process.env.RESEND_API_KEY;
  const alertEmailTo = process.env.ALERT_EMAIL_TO || getAdminEmails()[0];
  if (resendApiKey && alertEmailTo) {
    tasks.push(
      (async () => {
        try {
          const resend = new Resend(resendApiKey);
          await resend.emails.send({
            from: "BSF Alerts <alerts@gideonsoftware.com>",
            to: alertEmailTo,
            subject: `[BSF Alert] ${payload.title}`,
            html: `
              <h2>Bible Study Formatter Alert</h2>
              <p><strong>Type:</strong> ${payload.type}</p>
              ${payload.className ? `<p><strong>Missing Class:</strong> <code>${payload.className}</code></p>` : ""}
              ${payload.versionAbbr ? `<p><strong>Version:</strong> ${payload.versionAbbr}</p>` : ""}
              ${payload.bookName ? `<p><strong>Passage:</strong> ${payload.bookName} ${payload.chapterNum || ""}</p>` : ""}
              ${payload.details ? `<p><strong>Details:</strong> ${payload.details}</p>` : ""}
              <p><small>Timestamp: ${timestamp}</small></p>
            `,
          });
        } catch (emailErr) {
          console.error("[Alert] Failed to send email alert:", emailErr);
        }
      })()
    );
  }

  await Promise.allSettled(tasks);
}
