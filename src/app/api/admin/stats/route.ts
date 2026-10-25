import { NextResponse, connection } from "next/server";
import { db } from "@/lib/db";
import { executions, missingElements } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  await connection();

  // If DB is connected, run real SQL aggregations
  if (db) {
    try {
      // 1. Total executions
      const totalRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(executions);
      const totalExecutions = Number(totalRes[0]?.count || 0);

      // 2. Unique users
      const usersRes = await db
        .select({ count: sql<number>`count(distinct ${executions.userEmail})` })
        .from(executions);
      const uniqueUsers = Number(usersRes[0]?.count || 0);

      // 3. Top Books
      const topBooks = await db
        .select({
          bookName: executions.bookName,
          count: sql<number>`count(*)`,
        })
        .from(executions)
        .groupBy(executions.bookName)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      // 4. Monthly History
      const monthlyData = await db
        .select({
          month: sql<string>`to_char(${executions.createdAt}, 'YYYY-MM')`,
          count: sql<number>`count(*)`,
        })
        .from(executions)
        .groupBy(sql`to_char(${executions.createdAt}, 'YYYY-MM')`)
        .orderBy(desc(sql`to_char(${executions.createdAt}, 'YYYY-MM')`))
        .limit(12);

      // 5. Multi-chapter vs Single-chapter analysis
      const chapterAnalysis = await db
        .select({
          isMulti: sql<boolean>`${executions.chapterStart} != ${executions.chapterEnd}`,
          count: sql<number>`count(*)`,
        })
        .from(executions)
        .groupBy(sql`${executions.chapterStart} != ${executions.chapterEnd}`);

      // 6. Recent executions
      const recent = await db
        .select()
        .from(executions)
        .orderBy(desc(executions.createdAt))
        .limit(50);

      // 7. Missing elements
      const elements = await db
        .select()
        .from(missingElements)
        .orderBy(desc(missingElements.lastSeenAt))
        .limit(50);

      return NextResponse.json({
        totalExecutions,
        uniqueUsers,
        topBooks,
        monthlyData: monthlyData.reverse(),
        chapterAnalysis,
        recent,
        missingElements: elements,
        isLiveDb: true,
      });
    } catch (dbError) {
      console.warn("[Admin Stats] Database query error, returning fallback demo data:", dbError);
    }
  }

  // Fallback demo data (e.g. before Neon DB is provisioned or during local preview)
  return NextResponse.json({
    totalExecutions: 1420,
    uniqueUsers: 384,
    topBooks: [
      { bookName: "John", count: 312 },
      { bookName: "Romans", count: 245 },
      { bookName: "Genesis", count: 189 },
      { bookName: "Psalms", count: 154 },
      { bookName: "Ephesians", count: 120 },
      { bookName: "Matthew", count: 98 },
      { bookName: "James", count: 76 },
    ],
    monthlyData: [
      { month: "2026-05", count: 180 },
      { month: "2026-06", count: 210 },
      { month: "2026-07", count: 245 },
      { month: "2026-08", count: 260 },
      { month: "2026-09", count: 285 },
      { month: "2026-10", count: 240 },
    ],
    chapterAnalysis: [
      { isMulti: false, count: 1210 }, // Single chapter (85%)
      { isMulti: true, count: 210 },   // Multi chapter (15%)
    ],
    recent: [
      {
        id: 1,
        bookName: "John",
        versionAbbr: "ESV",
        chapterStart: 1,
        chapterEnd: 1,
        userEmail: "demo@user.com",
        durationMs: 420,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        bookName: "Romans",
        versionAbbr: "ESV",
        chapterStart: 8,
        chapterEnd: 8,
        userEmail: "pastor@church.org",
        durationMs: 380,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    missingElements: [],
    isLiveDb: false,
  });
}
