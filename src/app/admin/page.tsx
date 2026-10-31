"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Activity,
  Calendar,
  Layers,
  ExternalLink,
  ShieldAlert,
  Database,
  Trash2,
  Sliders,
  BookOpen,
  Filter,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GoogleLogo } from "@/components/GoogleLogo";
import { SUPPORTED_VERSIONS } from "@/lib/bible/books";

interface AdminStats {
  totalExecutions: number;
  v2Executions?: number;
  legacyExecutions?: number;
  uniqueUsers: number;
  topBooks: Array<{ bookName: string; count: number }>;
  versionBreakdown?: Array<{ versionAbbr: string; count: number }>;
  monthlyData: Array<{ month: string; count: number }>;
  yearlyData?: Array<{ year: string; count: number }>;
  chapterAnalysis: Array<{ isMulti: boolean; count: number }>;
  optionsBreakdown?: {
    totalWithOptions: number;
    sectionHeadingsCount: number;
    titlePageCount: number;
    pageBreaksCount: number;
    verseNumbersCount: number;
    chapterHeadersCount: number;
    topFonts: Array<{ fontName: string; count: number }>;
  };
  topUsers?: Array<{
    userEmail: string;
    count: number;
    lastActiveAt: string;
  }>;
  cacheStats?: Array<{ versionAbbr: string; count: number }>;
  recent: Array<{
    id: string;
    bookName: string;
    chapterStart: number;
    chapterEnd: number;
    versionAbbr: string;
    userEmail: string | null;
    docUrl: string;
    durationMs: number | null;
    createdAt: string;
    isAdminUser?: boolean;
    isLegacy?: boolean;
  }>;
  missingElements: Array<{
    id: number;
    className: string;
    versionAbbr: string;
    bookName: string;
    chapterNum: number | null;
    snippet: string | null;
    occurrenceCount: number;
    lastSeenAt: string;
  }>;
  excludeAdmins?: boolean;
  isLiveDb?: boolean;
}

interface CanaryProviderResult {
  name: string;
  version: string;
  ok: boolean;
  paragraphCount?: number;
  durationMs: number;
  error?: string;
}

interface CanaryResult {
  success?: boolean;
  status?: string;
  chapter?: string;
  paragraphCount?: number;
  durationMs?: number;
  providers?: CanaryProviderResult[];
  error?: string;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [excludeAdmins, setExcludeAdmins] = useState<boolean>(true);
  const [trendMode, setTrendMode] = useState<"monthly" | "yearly">("monthly");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [canaryRunning, setCanaryRunning] = useState(false);
  const [canaryResult, setCanaryResult] = useState<CanaryResult | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchStats = useCallback(
    async (excludeFlag = excludeAdmins) => {
      setIsRefreshing(true);
      try {
        const res = await fetch(
          `/api/admin/stats?excludeAdmins=${excludeFlag ? "true" : "false"}`
        );
        if (res.ok) {
          const data = (await res.json()) as AdminStats;
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setIsRefreshing(false);
      }
    },
    [excludeAdmins]
  );

  useEffect(() => {
    let ignore = false;
    async function checkAuthAndLoad() {
      try {
        const authRes = await fetch("/api/auth/google/status");
        const authData = await authRes.json();
        if (ignore) return;

        if (authData.authenticated && authData.isAdmin) {
          setIsAdmin(true);
          setAuthChecked(true);
          const statsRes = await fetch("/api/admin/stats?excludeAdmins=true");
          if (statsRes.ok) {
            const data = (await statsRes.json()) as AdminStats;
            if (!ignore) setStats(data);
          }
        } else {
          setIsAdmin(false);
          setAuthChecked(true);
        }
      } catch (err) {
        console.error("Auth verification failed:", err);
        if (!ignore) {
          setIsAdmin(false);
          setAuthChecked(true);
        }
      }
    }
    checkAuthAndLoad();
    return () => {
      ignore = true;
    };
  }, []);

  const handleToggleExcludeAdmins = () => {
    const nextVal = !excludeAdmins;
    setExcludeAdmins(nextVal);
    fetchStats(nextVal);
  };

  const runAdminAction = async (
    key: string,
    payload: Record<string, unknown>
  ) => {
    setBusyAction(key);
    setActionBanner(null);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setActionBanner(data.message);
        await fetchStats(excludeAdmins);
      } else if (data.error) {
        setActionBanner(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error("Admin action failed:", err);
      setActionBanner("Action failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const runCanaryCheck = async () => {
    setCanaryRunning(true);
    setCanaryResult(null);
    try {
      const res = await fetch("/api/cron/canary");
      const data = (await res.json()) as CanaryResult;
      setCanaryResult(data);
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : "Canary request failed";
      setCanaryResult({ success: false, error });
    } finally {
      setCanaryRunning(false);
    }
  };

  const multiChapterStats = stats?.chapterAnalysis || [];
  const singleCount = multiChapterStats.find((s) => !s.isMulti)?.count || 0;
  const multiCount = multiChapterStats.find((s) => s.isMulti)?.count || 0;
  const totalAnalyzed = singleCount + multiCount || 1;
  const multiPercentage = Math.round((multiCount / totalAnalyzed) * 100);

  // Maximum count for normalizing trend chart bars
  const activeTrendItems =
    trendMode === "yearly"
      ? (stats?.yearlyData || []).map((y) => ({ label: y.year, count: Number(y.count) }))
      : (stats?.monthlyData || []).map((m) => ({ label: m.month, count: Number(m.count) }));

  const maxTrendCount = activeTrendItems.length
    ? Math.max(...activeTrendItems.map((item) => item.count), 1)
    : 1;

  // Maximum count for top books bars
  const maxBookCount = stats?.topBooks?.length
    ? Math.max(...stats.topBooks.map((b) => Number(b.count)), 1)
    : 1;

  const totalCachedChapters = (stats?.cacheStats || []).reduce(
    (sum, c) => sum + Number(c.count),
    0
  );

  const totalVersionCount =
    (stats?.versionBreakdown || []).reduce((sum, v) => sum + Number(v.count), 0) || 1;

  const optTotals = stats?.optionsBreakdown?.totalWithOptions || 0;
  const pct = (n: number) => (optTotals > 0 ? Math.round((n / optTotals) * 100) : 0);

  if (!authChecked) {
    return (
      <div className="container" style={{ textAlign: "center", padding: "6rem 0" }}>
        <RefreshCw size={28} className="spin" color="var(--primary)" />
        <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Verifying administrator permissions...
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container" style={{ maxWidth: "560px", marginTop: "5rem" }}>
        <div
          className="glass-panel"
          style={{
            padding: "3rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.25rem",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(244, 63, 94, 0.12)",
              color: "var(--accent-rose)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldAlert size={30} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              Administrator Access Required
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", lineHeight: 1.6 }}>
              The Admin Portal is restricted to authorized accounts. Please sign in with an approved administrator Google account to continue.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
            <a href="/api/auth/google/login" className="btn-google">
              <GoogleLogo size={16} /> Sign in with Google
            </a>
            <Link href="/" className="btn btn-secondary btn-sm">
              <ArrowLeft size={14} /> Back to Formatter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={24} />
          </div>
          <div>
            <h1>Admin & Usage Intelligence</h1>
            <p>Reporting, real-time analytics, and Bible formatting health monitoring</p>
          </div>
        </div>

        <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleToggleExcludeAdmins}
            className="btn btn-secondary btn-sm"
            style={{
              borderColor: excludeAdmins ? "var(--primary)" : undefined,
              background: excludeAdmins ? "rgba(99, 102, 241, 0.14)" : undefined,
            }}
            title="Toggle whether administrator test runs are excluded from metrics and charts"
          >
            <Filter size={13} />
            {excludeAdmins ? "Excluding admin runs" : "Including admin runs"}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => runAdminAction("sync_sheet", { action: "sync_legacy_sheet" })}
            disabled={busyAction === "sync_sheet"}
            title="Re-sync historical v1 execution rows from Google Sheets"
          >
            <Database size={13} />
            {busyAction === "sync_sheet" ? "Syncing Sheet..." : "Sync Legacy Sheet"}
          </button>
          <ThemeToggle />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchStats(excludeAdmins)}
            disabled={isRefreshing}
            title="Refresh stats"
          >
            <RefreshCw size={14} className={isRefreshing ? "spin" : ""} /> Refresh
          </button>
          <Link href="/" className="btn btn-primary btn-sm">
            <ArrowLeft size={14} /> Back to Formatter
          </Link>
        </div>
      </header>

      {actionBanner && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-sm)",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "var(--accent-emerald)",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{actionBanner}</span>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="admin-metrics-grid">
        <div className="metric-card">
          <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <FileText size={15} color="var(--primary)" /> Total Docs Generated
          </div>
          <div className="metric-value">{stats?.totalExecutions?.toLocaleString() ?? "..."}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>
            {(stats?.legacyExecutions || 0).toLocaleString()} historical (v1) •{" "}
            {(stats?.v2Executions || 0).toLocaleString()} v2.0+
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Users size={15} color="var(--accent-cyan)" /> Signed-In Users (v2.0+)
          </div>
          <div className="metric-value">{stats?.uniqueUsers?.toLocaleString() ?? "..."}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>
            Tracked since v2.0 Google OAuth launch
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Layers size={15} color="var(--accent-amber)" /> Multi-Chapter Exports
          </div>
          <div className="metric-value">{multiPercentage}%</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>
            {multiCount.toLocaleString()} multi vs {singleCount.toLocaleString()} single chapter
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Activity size={15} color="var(--accent-emerald)" /> System & Cache Status
          </div>
          <div className="metric-value" style={{ fontSize: "1.4rem", color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <CheckCircle2 size={20} /> Operational
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>
            {totalCachedChapters} cached chapter{totalCachedChapters === 1 ? "" : "s"} •{" "}
            {stats?.isLiveDb ? "Neon Postgres Live" : "Fallback Mode"}
          </div>
        </div>
      </div>

      {/* Charts Row 1: Trend + Top Books */}
      <div className="app-grid" style={{ marginBottom: "2rem" }}>
        {/* Monthly / Yearly Trend Chart */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              <Calendar size={18} color="var(--primary)" /> Generations Trend
            </h2>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setTrendMode("monthly")}
                style={{
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.75rem",
                  borderColor: trendMode === "monthly" ? "var(--primary)" : undefined,
                  background: trendMode === "monthly" ? "rgba(99, 102, 241, 0.14)" : undefined,
                }}
              >
                Monthly (Last 12)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setTrendMode("yearly")}
                style={{
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.75rem",
                  borderColor: trendMode === "yearly" ? "var(--primary)" : undefined,
                  background: trendMode === "yearly" ? "rgba(99, 102, 241, 0.14)" : undefined,
                }}
              >
                Yearly (2021–2026)
              </button>
            </div>
          </div>
          <p style={{ fontSize: "0.825rem", color: "var(--text-subtle)", marginTop: "0.35rem", marginBottom: "1rem" }}>
            {trendMode === "yearly"
              ? "Multi-year document generation volume (including imported v1 history)"
              : "Last 12 active months of document generations"}
          </p>

          <div className="chart-bar-container">
            {activeTrendItems.map((item) => {
              const heightPercent = Math.max(8, Math.round((item.count / maxTrendCount) * 100));
              return (
                <div key={item.label} className="chart-bar-column">
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {item.count}
                  </div>
                  <div className="chart-bar" style={{ height: `${heightPercent}%` }} />
                  <div className="chart-bar-label">{item.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Books Ranking */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <h2 className="section-title">
            <BarChart3 size={18} color="var(--accent-cyan)" /> Top Requested Books
          </h2>
          <p style={{ fontSize: "0.825rem", color: "var(--text-subtle)", marginBottom: "1.25rem" }}>
            Most popular Bible books formatted ({excludeAdmins ? "excluding admin runs" : "all runs"})
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {stats?.topBooks?.slice(0, 7).map((book, idx) => {
              const widthPercent = Math.max(6, Math.round((Number(book.count) / maxBookCount) * 100));
              return (
                <div key={book.bookName} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 600 }}>
                      #{idx + 1} {book.bookName}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{book.count.toLocaleString()} docs</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                    <div
                      style={{
                        width: `${widthPercent}%`,
                        height: "100%",
                        background: "var(--primary-gradient)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Translation Breakdown + Formatting Options & Top Users */}
      <div className="app-grid" style={{ marginBottom: "2rem" }}>
        {/* Translation Breakdown */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <h2 className="section-title">
            <BookOpen size={18} color="var(--accent-amber)" /> Translation Breakdown
          </h2>
          <p style={{ fontSize: "0.825rem", color: "var(--text-subtle)", marginBottom: "1.25rem" }}>
            Share of formatted documents by Bible version (ESV, CSB, NIV, NASB, NET)
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {(stats?.versionBreakdown || []).map((ver) => {
              const sharePct = Math.round((Number(ver.count) / totalVersionCount) * 100);
              const barWidth = Math.max(4, sharePct);
              return (
                <div key={ver.versionAbbr} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 700 }}>{ver.versionAbbr}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {ver.count.toLocaleString()} docs ({sharePct}%)
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: "100%",
                        background: "var(--primary-gradient)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Signed-In Users (v2.0+) */}
          {stats?.topUsers && stats.topUsers.length > 0 && (
            <div style={{ marginTop: "1.75rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-subtle)" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Users size={15} color="var(--accent-cyan)" /> Top Signed-In Users (v2.0+)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {stats.topUsers.slice(0, 5).map((u) => (
                  <div
                    key={u.userEmail}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{u.userEmail}</span>
                    <span>{u.count} doc{u.count === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Formatting Options Popularity (v2.0+) */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <h2 className="section-title">
            <Sliders size={18} color="var(--primary)" /> Formatting Options Adoption (v2.0+)
          </h2>
          <p style={{ fontSize: "0.825rem", color: "var(--text-subtle)", marginBottom: "1.25rem" }}>
            How often signed-in v2.0 users enable each layout option ({optTotals} runs tracked)
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            {[
              {
                label: "Chapter headings",
                val: pct(stats?.optionsBreakdown?.chapterHeadersCount || 0),
              },
              {
                label: "Verse numbers",
                val: pct(stats?.optionsBreakdown?.verseNumbersCount || 0),
              },
              {
                label: "Page break after each chapter",
                val: pct(stats?.optionsBreakdown?.pageBreaksCount || 0),
              },
              {
                label: "Section headings",
                val: pct(stats?.optionsBreakdown?.sectionHeadingsCount || 0),
              },
              {
                label: "Title page",
                val: pct(stats?.optionsBreakdown?.titlePageCount || 0),
              },
            ].map((opt) => (
              <div key={opt.label} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ color: "var(--text-muted)" }}>{opt.val}%</span>
                </div>
                <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                  <div
                    style={{
                      width: `${Math.max(4, opt.val)}%`,
                      height: "100%",
                      background: "var(--primary-gradient)",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {stats?.optionsBreakdown?.topFonts && stats.optionsBreakdown.topFonts.length > 0 && (
            <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)", marginBottom: "0.5rem", fontWeight: 600 }}>
                Most Popular Fonts
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {stats.optionsBreakdown.topFonts.map((f) => (
                  <span
                    key={f.fontName}
                    style={{
                      padding: "0.25rem 0.6rem",
                      borderRadius: "999px",
                      background: "var(--bg-glass)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.75rem",
                    }}
                  >
                    <strong>{f.fontName}</strong> • {f.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Operations Row: Multi-Provider Canary + Bible Cache Manager */}
      <div className="app-grid" style={{ marginBottom: "2rem" }}>
        {/* Multi-Provider Canary Health Check */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h2 className="section-title">
                <Activity size={18} color="var(--accent-emerald)" /> Multi-Provider Canary Check
              </h2>
              <p style={{ fontSize: "0.825rem", color: "var(--text-subtle)", marginTop: "0.2rem" }}>
                Live-tests Crossway ESV, API.Bible (CSB), and NET Bible (`labs.bible.org`) in parallel.
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={runCanaryCheck}
              disabled={canaryRunning}
            >
              {canaryRunning ? "Testing 3 APIs..." : "Trigger Canary Test"}
            </button>
          </div>

          {canaryResult && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                borderRadius: "var(--radius-sm)",
                background: canaryResult.success ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
                border: `1px solid ${canaryResult.success ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
                fontSize: "0.85rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {canaryResult.providers ? (
                canaryResult.providers.map((p) => (
                  <div
                    key={p.version}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      color: p.ok ? "var(--accent-emerald)" : "var(--accent-rose)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600 }}>
                      {p.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                      {p.name}
                    </span>
                    <span style={{ fontSize: "0.78rem" }}>
                      {p.ok
                        ? `${p.paragraphCount} paragraphs • ${p.durationMs}ms`
                        : p.error}
                    </span>
                  </div>
                ))
              ) : canaryResult.success ? (
                <div style={{ color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <CheckCircle2 size={16} />
                  <span>
                    <strong>Healthy:</strong> Parsed {canaryResult.chapter} ({canaryResult.paragraphCount} paragraphs) in {canaryResult.durationMs}ms
                  </span>
                </div>
              ) : (
                <div style={{ color: "var(--accent-rose)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <AlertTriangle size={16} />
                  <span>
                    <strong>Check Failed:</strong> {canaryResult.error}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bible Cache Inspector & One-Click Purge */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
            <div>
              <h2 className="section-title">
                <Database size={18} color="var(--accent-cyan)" /> Bible AST Cache Manager
              </h2>
              <p style={{ fontSize: "0.825rem", color: "var(--text-subtle)", marginTop: "0.2rem" }}>
                Inspect or purge cached chapters in Postgres (useful after updating parser rules).
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => runAdminAction("clear_ALL", { action: "clear_cache", version: "ALL" })}
              disabled={busyAction === "clear_ALL" || totalCachedChapters === 0}
              style={{ color: "var(--accent-rose)" }}
            >
              <Trash2 size={13} /> Clear All ({totalCachedChapters})
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
            {SUPPORTED_VERSIONS.map((v) => v.abbr).map((ver) => {
              const count =
                stats?.cacheStats?.find((c) => c.versionAbbr === ver)?.count || 0;
              return (
                <button
                  key={ver}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={count === 0 || busyAction === `clear_${ver}`}
                  onClick={() =>
                    runAdminAction(`clear_${ver}`, {
                      action: "clear_cache",
                      version: ver,
                    })
                  }
                  title={`Clear cached ${ver} chapters`}
                >
                  <Trash2 size={12} /> {ver}: {count} cached
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Missing / Unresolved Parser Elements Card (if any exist) */}
      {stats?.missingElements && stats.missingElements.length > 0 && (
        <div className="glass-panel" style={{ padding: "1.75rem", marginBottom: "2rem" }}>
          <h2 className="section-title" style={{ marginBottom: "0.5rem" }}>
            <AlertTriangle size={18} color="var(--accent-amber)" /> Unresolved Parser Elements ({stats.missingElements.length})
          </h2>
          <p style={{ fontSize: "0.825rem", color: "var(--text-subtle)", marginBottom: "1rem" }}>
            Unknown HTML/USFM classes encountered during Bible parsing.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class / Element</th>
                  <th>Version</th>
                  <th>Passage</th>
                  <th>Occurrences</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.missingElements.map((el) => (
                  <tr key={el.id}>
                    <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{el.className}</td>
                    <td>{el.versionAbbr}</td>
                    <td>
                      {el.bookName} {el.chapterNum || ""}
                    </td>
                    <td>{el.occurrenceCount}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          runAdminAction(`resolve_${el.id}`, {
                            action: "resolve_missing_element",
                            id: el.id,
                          })
                        }
                      >
                        Mark resolved
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity Table */}
      <div className="glass-panel" style={{ padding: "1.75rem" }}>
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>
          <Layers size={18} color="var(--primary)" /> Recent Generations Log
        </h2>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Passage</th>
                <th>Version</th>
                <th>User</th>
                <th>Latency</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recent?.map((item) => (
                <tr key={item.id}>
                  <td style={{ color: "var(--text-subtle)", whiteSpace: "nowrap" }}>
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {item.bookName} {item.chapterStart}
                    {item.chapterStart !== item.chapterEnd ? `-${item.chapterEnd}` : ""}
                  </td>
                  <td>
                    <span style={{ padding: "0.2rem 0.5rem", borderRadius: "4px", background: "var(--bg-glass)", fontSize: "0.75rem" }}>
                      {item.versionAbbr}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>{item.userEmail || (item.isLegacy ? "v1.0 user" : "anonymous")}</span>
                    {item.isAdminUser && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                          background: "rgba(99, 102, 241, 0.16)",
                          color: "var(--primary)",
                          fontWeight: 600,
                        }}
                      >
                        Admin
                      </span>
                    )}
                  </td>
                  <td style={{ color: "var(--text-subtle)" }}>{item.durationMs ? `${item.durationMs}ms` : "-"}</td>
                  <td>
                    {item.docUrl ? (
                      <a href={item.docUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.25rem", textDecoration: "none" }}>
                        Doc <ExternalLink size={12} />
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
