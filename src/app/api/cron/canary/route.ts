import { NextResponse } from "next/server";
import { fetchEsvChapter } from "@/lib/bible/providers/esv";
import { fetchApiBibleChapter } from "@/lib/bible/providers/apibible";
import { fetchNetChapter } from "@/lib/bible/providers/net";
import { sendAlert } from "@/lib/alerts/notify";
import { FormatOptions } from "@/lib/bible/books";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Validate secret if configured
  if (
    cronSecret &&
    authHeader !== `Bearer ${cronSecret}` &&
    searchParams.get("key") !== cronSecret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const testOptions: FormatOptions = {
    chapterHeaders: true,
    chapterPageBreaks: true,
    sectionHeadings: false,
    verseNumbers: true,
    titlePage: false,
    fontName: "Arial",
    fontSize: 11,
    lineSpacing: 2,
  };

  const checks = [
    {
      name: "Crossway ESV API",
      version: "ESV",
      run: () => fetchEsvChapter("JHN", 1, testOptions),
    },
    {
      name: "API.Bible (CSB)",
      version: "CSB",
      run: () => fetchApiBibleChapter("JHN", 1, "CSB", testOptions),
    },
    {
      name: "NET Bible (labs.bible.org)",
      version: "NET",
      run: () => fetchNetChapter("JHN", 1, testOptions),
    },
  ];

  const providers = await Promise.all(
    checks.map(async (check) => {
      const t0 = Date.now();
      try {
        const chapter = await check.run();
        if (!chapter || chapter.paragraphs.length === 0) {
          throw new Error(`Returned 0 paragraphs for John 1 (${check.version})`);
        }
        return {
          name: check.name,
          version: check.version,
          ok: true,
          paragraphCount: chapter.paragraphs.length,
          durationMs: Date.now() - t0,
        };
      } catch (err: unknown) {
        return {
          name: check.name,
          version: check.version,
          ok: false,
          durationMs: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  const durationMs = Date.now() - startTime;
  const failed = providers.filter((p) => !p.ok);

  if (failed.length > 0) {
    const details = failed.map((f) => `${f.name}: ${f.error}`).join("; ");
    console.error("[Canary] Health check failure:", details);

    await sendAlert({
      type: "canary_failure",
      title: "Bible Format Health Check Failed",
      details,
    });

    return NextResponse.json(
      {
        success: false,
        status: "degraded",
        chapter: "John 1",
        durationMs,
        providers,
        error: details,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }

  const totalParagraphs = providers.reduce(
    (sum, p) => sum + (p.paragraphCount || 0),
    0
  );

  return NextResponse.json({
    success: true,
    status: "healthy",
    chapter: "John 1 (ESV, CSB, NET)",
    paragraphCount: totalParagraphs,
    durationMs,
    providers,
    timestamp: new Date().toISOString(),
  });
}
