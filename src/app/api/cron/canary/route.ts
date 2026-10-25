import { NextResponse } from "next/server";
import { fetchEsvChapter } from "@/lib/bible/providers/esv";
import { sendAlert } from "@/lib/alerts/notify";

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

  try {
    // Test parsing John 1 with standard options
    const chapter = await fetchEsvChapter("JHN", 1, {
      chapterHeaders: true,
      chapterPageBreaks: true,
      verseNumbers: true,
      titlePage: false,
      fontName: "Arial",
      fontSize: 11,
      lineSpacing: 2,
    });

    if (!chapter || chapter.paragraphs.length === 0) {
      throw new Error("Canary test returned 0 paragraphs for John 1.");
    }

    const durationMs = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      status: "healthy",
      chapter: `${chapter.bookName} ${chapter.chapterNum}`,
      paragraphCount: chapter.paragraphs.length,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("[Canary] Daily health check failure:", error);
    const details = error instanceof Error ? error.message : String(error);

    await sendAlert({
      type: "canary_failure",
      title: "Daily Bible Format Health Check Failed",
      details,
    });

    return NextResponse.json(
      {
        success: false,
        error: details || "Canary check failed",
      },
      { status: 500 }
    );
  }
}
