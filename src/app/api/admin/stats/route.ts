import { NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { executions, missingElements, bibleCache } from "@/lib/db/schema";
import { desc, eq, like, sql } from "drizzle-orm";
import {
  getAdminEmails,
  isAdminEmail,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/google/auth";

const LEGACY_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1UaJORxJ3aHaRh_VerQ3rKBy5L2MaxcKR1ryIqu3g2LU/export?format=csv&gid=897246390";

async function verifyAdminSession(): Promise<{
  authorized: boolean;
  adminEmails: string[];
  status: number;
  error?: string;
}> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = parseSessionCookie(sessionCookie?.value);
  const adminEmails = getAdminEmails();

  if (!session || !session.user) {
    return { authorized: false, adminEmails, status: 401, error: "Unauthorized" };
  }

  if (!isAdminEmail(session.user.email)) {
    return {
      authorized: false,
      adminEmails,
      status: 403,
      error: "Forbidden: Admin access required",
    };
  }

  return { authorized: true, adminEmails, status: 200 };
}

export async function GET(request: Request) {
  await connection();

  const auth = await verifyAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const excludeAdmins = searchParams.get("excludeAdmins") !== "false";
  const adminEmails = auth.adminEmails;

  // Build SQL filter that preserves NULL user_email (legacy v1 runs) when excluding admin emails
  const filterClause =
    excludeAdmins && adminEmails.length > 0
      ? sql`(${executions.userEmail} IS NULL OR lower(${executions.userEmail}) NOT IN (${sql.join(
          adminEmails.map((email) => sql`${email}`),
          sql`, `
        )}))`
      : sql`TRUE`;

  if (db) {
    try {
      const v2OptionsClause = sql`${filterClause} AND ${executions.optionsJson} IS NOT NULL AND (${executions.optionsJson}->>'source' IS NULL OR ${executions.optionsJson}->>'source' != 'legacy_v1')`;

      // Run all 12 independent SQL read queries in parallel over Neon's HTTP driver
      const [
        totalsRes,
        usersRes,
        topBooks,
        versionBreakdown,
        monthlyData,
        yearlyData,
        chapterAnalysis,
        optionsRes,
        topFonts,
        topUsers,
        cacheStats,
        recentRows,
        elements,
      ] = await Promise.all([
        // 1. Total executions & v2 executions
        db
          .select({
            total: sql<number>`count(*)`,
            v2Count: sql<number>`count(*) filter (where ${executions.userEmail} is not null)`,
            legacyCount: sql<number>`count(*) filter (where ${executions.userEmail} is null)`,
          })
          .from(executions)
          .where(filterClause),

        // 2. Unique signed-in users (v2.0+)
        db
          .select({
            count: sql<number>`count(distinct lower(${executions.userEmail}))`,
          })
          .from(executions)
          .where(filterClause),

        // 3. Top Books
        db
          .select({
            bookName: executions.bookName,
            count: sql<number>`count(*)`,
          })
          .from(executions)
          .where(filterClause)
          .groupBy(executions.bookName)
          .orderBy(desc(sql`count(*)`))
          .limit(10),

        // 4. Version / Translation Breakdown
        db
          .select({
            versionAbbr: executions.versionAbbr,
            count: sql<number>`count(*)`,
          })
          .from(executions)
          .where(filterClause)
          .groupBy(executions.versionAbbr)
          .orderBy(desc(sql`count(*)`)),

        // 5. Monthly History (last 12 active months)
        db
          .select({
            month: sql<string>`to_char(${executions.createdAt}, 'YYYY-MM')`,
            count: sql<number>`count(*)`,
          })
          .from(executions)
          .where(filterClause)
          .groupBy(sql`to_char(${executions.createdAt}, 'YYYY-MM')`)
          .orderBy(desc(sql`to_char(${executions.createdAt}, 'YYYY-MM')`))
          .limit(12),

        // 6. Yearly History (all years, e.g. 2021-2026)
        db
          .select({
            year: sql<string>`to_char(${executions.createdAt}, 'YYYY')`,
            count: sql<number>`count(*)`,
          })
          .from(executions)
          .where(filterClause)
          .groupBy(sql`to_char(${executions.createdAt}, 'YYYY')`)
          .orderBy(sql`to_char(${executions.createdAt}, 'YYYY')`),

        // 7. Multi-chapter vs Single-chapter analysis
        db
          .select({
            isMulti: sql<boolean>`${executions.chapterStart} != ${executions.chapterEnd}`,
            count: sql<number>`count(*)`,
          })
          .from(executions)
          .where(filterClause)
          .groupBy(sql`${executions.chapterStart} != ${executions.chapterEnd}`),

        // 8. Formatting Options Popularity (v2.0 runs with options_json)
        db
          .select({
            totalWithOptions: sql<number>`count(*)`,
            sectionHeadingsCount: sql<number>`count(*) filter (where (${executions.optionsJson}->>'sectionHeadings')::boolean is true)`,
            titlePageCount: sql<number>`count(*) filter (where (${executions.optionsJson}->>'titlePage')::boolean is true)`,
            pageBreaksCount: sql<number>`count(*) filter (where (${executions.optionsJson}->>'chapterPageBreaks')::boolean is true)`,
            verseNumbersCount: sql<number>`count(*) filter (where (${executions.optionsJson}->>'verseNumbers')::boolean is true)`,
            chapterHeadersCount: sql<number>`count(*) filter (where (${executions.optionsJson}->>'chapterHeaders')::boolean is true)`,
          })
          .from(executions)
          .where(v2OptionsClause),

        // 8b. Top Fonts
        db
          .select({
            fontName: sql<string>`coalesce(${executions.optionsJson}->>'fontName', 'Arial')`,
            count: sql<number>`count(*)`,
          })
          .from(executions)
          .where(v2OptionsClause)
          .groupBy(sql`coalesce(${executions.optionsJson}->>'fontName', 'Arial')`)
          .orderBy(desc(sql`count(*)`))
          .limit(5),

        // 9. Top Active Users (v2.0+)
        db
          .select({
            userEmail: sql<string>`lower(${executions.userEmail})`,
            count: sql<number>`count(*)`,
            lastActiveAt: sql<string>`max(${executions.createdAt})`,
          })
          .from(executions)
          .where(sql`${filterClause} AND ${executions.userEmail} IS NOT NULL`)
          .groupBy(sql`lower(${executions.userEmail})`)
          .orderBy(desc(sql`count(*)`))
          .limit(8),

        // 10. Bible Cache Stats by Version
        db
          .select({
            versionAbbr: sql<string>`split_part(${bibleCache.passageKey}, '/', 1)`,
            count: sql<number>`count(*)`,
          })
          .from(bibleCache)
          .groupBy(sql`split_part(${bibleCache.passageKey}, '/', 1)`)
          .orderBy(desc(sql`count(*)`)),

        // 11. Recent executions
        db
          .select()
          .from(executions)
          .where(filterClause)
          .orderBy(desc(executions.createdAt))
          .limit(50),

        // 12. Missing elements (unresolved first)
        db
          .select()
          .from(missingElements)
          .where(eq(missingElements.resolved, false))
          .orderBy(desc(missingElements.lastSeenAt))
          .limit(50),
      ]);

      const totalExecutions = Number(totalsRes[0]?.total || 0);
      const v2Executions = Number(totalsRes[0]?.v2Count || 0);
      const legacyExecutions = Number(totalsRes[0]?.legacyCount || 0);
      const uniqueUsers = Number(usersRes[0]?.count || 0);

      const recent = recentRows.map((r) => ({
        ...r,
        isAdminUser: Boolean(
          r.userEmail && adminEmails.includes(r.userEmail.toLowerCase())
        ),
        isLegacy:
          !r.userEmail &&
          (r.optionsJson as { source?: string } | null)?.source === "legacy_v1",
      }));

      return NextResponse.json({
        totalExecutions,
        v2Executions,
        legacyExecutions,
        uniqueUsers,
        topBooks: topBooks.map((b) => ({ bookName: b.bookName, count: Number(b.count) })),
        versionBreakdown: versionBreakdown.map((v) => ({
          versionAbbr: v.versionAbbr,
          count: Number(v.count),
        })),
        monthlyData: monthlyData
          .map((m) => ({ month: m.month, count: Number(m.count) }))
          .reverse(),
        yearlyData: yearlyData.map((y) => ({ year: y.year, count: Number(y.count) })),
        chapterAnalysis: chapterAnalysis.map((c) => ({
          isMulti: Boolean(c.isMulti),
          count: Number(c.count),
        })),
        optionsBreakdown: {
          totalWithOptions: Number(optionsRes[0]?.totalWithOptions || 0),
          sectionHeadingsCount: Number(optionsRes[0]?.sectionHeadingsCount || 0),
          titlePageCount: Number(optionsRes[0]?.titlePageCount || 0),
          pageBreaksCount: Number(optionsRes[0]?.pageBreaksCount || 0),
          verseNumbersCount: Number(optionsRes[0]?.verseNumbersCount || 0),
          chapterHeadersCount: Number(optionsRes[0]?.chapterHeadersCount || 0),
          topFonts: topFonts.map((f) => ({
            fontName: f.fontName,
            count: Number(f.count),
          })),
        },
        topUsers: topUsers.map((u) => ({
          userEmail: u.userEmail,
          count: Number(u.count),
          lastActiveAt: u.lastActiveAt,
        })),
        cacheStats: cacheStats.map((c) => ({
          versionAbbr: c.versionAbbr,
          count: Number(c.count),
        })),
        recent,
        missingElements: elements,
        excludeAdmins,
        isLiveDb: true,
      });
    } catch (dbError) {
      console.warn(
        "[Admin Stats] Database query error, returning fallback demo data:",
        dbError
      );
    }
  }

  // Fallback demo data
  return NextResponse.json({
    totalExecutions: 1420,
    v2Executions: 143,
    legacyExecutions: 1277,
    uniqueUsers: 42,
    topBooks: [
      { bookName: "John", count: 312 },
      { bookName: "Romans", count: 245 },
      { bookName: "Genesis", count: 189 },
      { bookName: "Psalms", count: 154 },
      { bookName: "Ephesians", count: 120 },
    ],
    versionBreakdown: [
      { versionAbbr: "ESV", count: 1320 },
      { versionAbbr: "CSB", count: 55 },
      { versionAbbr: "NIV", count: 30 },
      { versionAbbr: "NET", count: 15 },
    ],
    monthlyData: [
      { month: "2026-08", count: 260 },
      { month: "2026-09", count: 285 },
      { month: "2026-10", count: 240 },
    ],
    yearlyData: [
      { year: "2021", count: 180 },
      { year: "2022", count: 240 },
      { year: "2023", count: 290 },
      { year: "2024", count: 310 },
      { year: "2025", count: 250 },
      { year: "2026", count: 150 },
    ],
    chapterAnalysis: [
      { isMulti: false, count: 1210 },
      { isMulti: true, count: 210 },
    ],
    optionsBreakdown: {
      totalWithOptions: 143,
      sectionHeadingsCount: 28,
      titlePageCount: 19,
      pageBreaksCount: 135,
      verseNumbersCount: 140,
      chapterHeadersCount: 141,
      topFonts: [{ fontName: "Arial", count: 120 }],
    },
    topUsers: [],
    cacheStats: [],
    recent: [],
    missingElements: [],
    excludeAdmins,
    isLiveDb: false,
  });
}

export async function POST(request: Request) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!db) {
    return NextResponse.json(
      { error: "Database connection unavailable" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { action, version, id } = body as {
      action: "clear_cache" | "resolve_missing_element" | "sync_legacy_sheet";
      version?: string;
      id?: number;
    };

    if (action === "clear_cache") {
      if (version && version !== "ALL") {
        const deleted = await db
          .delete(bibleCache)
          .where(like(bibleCache.passageKey, `${version.toUpperCase()}/%`))
          .returning({ key: bibleCache.passageKey });
        return NextResponse.json({
          success: true,
          deletedCount: deleted.length,
          message: `Cleared ${deleted.length} cached ${version.toUpperCase()} chapter(s).`,
        });
      } else {
        const deleted = await db
          .delete(bibleCache)
          .returning({ key: bibleCache.passageKey });
        return NextResponse.json({
          success: true,
          deletedCount: deleted.length,
          message: `Cleared all ${deleted.length} cached chapter(s).`,
        });
      }
    }

    if (action === "resolve_missing_element" && typeof id === "number") {
      await db
        .update(missingElements)
        .set({ resolved: true })
        .where(eq(missingElements.id, id));
      return NextResponse.json({
        success: true,
        message: "Marked element as resolved.",
      });
    }

    if (action === "sync_legacy_sheet") {
      const res = await fetch(LEGACY_SHEET_CSV_URL);
      if (!res.ok) {
        throw new Error(`Failed to fetch legacy Google Sheet (${res.status})`);
      }
      const text = await res.text();
      const lines = text.trim().split(/\r?\n/).slice(1);

      await db
        .delete(executions)
        .where(sql`${executions.optionsJson}->>'source' = 'legacy_v1'`);

      const rowsToInsert = [];
      for (const line of lines) {
        const [ts, ver, rawBook, start, end] = line.split(",");
        if (!ts || !start || !end) continue;
        const [bookId, chStartStr] = start.split(".");
        const [, chEndStr] = end.split(".");
        const chapterStart = parseInt(chStartStr, 10);
        const chapterEnd = parseInt(chEndStr, 10);
        if (isNaN(chapterStart) || isNaN(chapterEnd)) continue;

        const bookName = rawBook === "Psalm" ? "Psalms" : rawBook.trim();
        const [datePart, timePart] = ts.trim().split(" ");
        const [m, d, y] = datePart.split("/").map(Number);
        const [hh, mm, ss] = (timePart || "0:0:0").split(":").map(Number);
        const createdAt = new Date(
          Date.UTC(y, m - 1, d, hh + 4, mm, ss || 0)
        );

        rowsToInsert.push({
          versionAbbr: ver.trim(),
          bookId: bookId.trim(),
          bookName,
          chapterStart,
          chapterEnd,
          optionsJson: { source: "legacy_v1" },
          createdAt,
        });
      }

      for (let i = 0; i < rowsToInsert.length; i += 250) {
        const chunk = rowsToInsert.slice(i, i + 250);
        await db.insert(executions).values(chunk);
      }

      return NextResponse.json({
        success: true,
        importedCount: rowsToInsert.length,
        message: `Synced ${rowsToInsert.length.toLocaleString()} historical runs from Google Sheets.`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[Admin Action Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 }
    );
  }
}
