"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canaryRunning, setCanaryRunning] = useState(false);
  const [canaryResult, setCanaryResult] = useState<any>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to load admin stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const runCanaryCheck = async () => {
    setCanaryRunning(true);
    setCanaryResult(null);
    try {
      const res = await fetch("/api/cron/canary");
      const data = await res.json();
      setCanaryResult(data);
    } catch (err: any) {
      setCanaryResult({ success: false, error: err.message });
    } finally {
      setCanaryRunning(false);
    }
  };

  const multiChapterStats = stats?.chapterAnalysis || [];
  const singleCount = multiChapterStats.find((s: any) => !s.isMulti)?.count || 0;
  const multiCount = multiChapterStats.find((s: any) => s.isMulti)?.count || 0;
  const totalAnalyzed = singleCount + multiCount || 1;
  const multiPercentage = Math.round((multiCount / totalAnalyzed) * 100);

  // Maximum count for normalizing monthly chart bars
  const maxMonthlyCount = stats?.monthlyData?.length
    ? Math.max(...stats.monthlyData.map((m: any) => Number(m.count)))
    : 1;

  // Maximum count for top books bars
  const maxBookCount = stats?.topBooks?.length
    ? Math.max(...stats.topBooks.map((b: any) => Number(b.count)))
    : 1;

  return (
    <div className="container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1>Admin & Usage Intelligence</h1>
            <p>Reporting, real-time analytics, and Bible formatting health monitoring</p>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchStats} title="Refresh stats">
            <RefreshCw size={14} /> Refresh
          </button>
          <a href="/" className="btn btn-primary btn-sm">
            <ArrowLeft size={14} /> Back to Formatter
          </a>
        </div>
      </header>

      {/* Top Metric Cards */}
      <div className="admin-metrics-grid">
        <div className="metric-card">
          <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <FileText size={15} color="var(--primary)" /> Total Docs Generated
          </div>
          <div className="metric-value">{stats?.totalExecutions?.toLocaleString() || "..."}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Users size={15} color="var(--accent-cyan)" /> Unique Active Users
          </div>
          <div className="metric-value">{stats?.uniqueUsers?.toLocaleString() || "..."}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Layers size={15} color="var(--accent-amber)" /> Multi-Chapter Rate
          </div>
          <div className="metric-value">{multiPercentage}%</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>
            {multiCount} multi vs {singleCount} single chapter
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Activity size={15} color="var(--accent-emerald)" /> System Health
          </div>
          <div className="metric-value" style={{ fontSize: "1.4rem", color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <CheckCircle2 size={24} /> Operational
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>
            {stats?.isLiveDb ? "Connected to Neon DB" : "Preview Mode"}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="app-grid" style={{ marginBottom: "2rem" }}>
        {/* Monthly Trend Chart */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <h2 className="section-title">
            <Calendar size={18} color="var(--primary)" /> Monthly Generations Trend
          </h2>
          <p style={{ fontSize: "0.825rem", color: "var(--text-subtle)", marginBottom: "1rem" }}>
            Execution history by month (replicating Execution Summary sheet)
          </p>

          <div className="chart-bar-container">
            {stats?.monthlyData?.map((item: any) => {
              const heightPercent = Math.max(8, Math.round((Number(item.count) / maxMonthlyCount) * 100));
              return (
                <div key={item.month} className="chart-bar-column">
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {item.count}
                  </div>
                  <div className="chart-bar" style={{ height: `${heightPercent}%` }} />
                  <div className="chart-bar-label">{item.month}</div>
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
            Most popular Bible books formatted across all users
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {stats?.topBooks?.slice(0, 6).map((book: any, idx: number) => {
              const widthPercent = Math.max(6, Math.round((Number(book.count) / maxBookCount) * 100));
              return (
                <div key={book.bookName} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 600 }}>
                      #{idx + 1} {book.bookName}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{book.count} docs</span>
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

      {/* Canary Health Check Trigger */}
      <div className="glass-panel" style={{ padding: "1.75rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 className="section-title">
              <Activity size={18} color="var(--accent-emerald)" /> Daily Canary Health Check
            </h2>
            <p style={{ fontSize: "0.825rem", color: "var(--text-subtle)", marginTop: "0.2rem" }}>
              Runs an end-to-end test against the Crossway ESV API to verify semantic classes, latency, and parser integrity.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={runCanaryCheck} disabled={canaryRunning}>
            <RefreshCw size={14} className={canaryRunning ? "animate-spin" : ""} />
            {canaryRunning ? "Running Test..." : "Run Canary Test Now"}
          </button>
        </div>

        {canaryResult && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              borderRadius: "var(--radius-md)",
              background: canaryResult.success ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
              border: `1px solid ${canaryResult.success ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
              fontSize: "0.85rem",
            }}
          >
            {canaryResult.success ? (
              <div style={{ color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle2 size={16} />
                <span>
                  <strong>Canary Passed:</strong> Parsed {canaryResult.chapter} ({canaryResult.paragraphCount} paragraphs) in {canaryResult.durationMs}ms.
                </span>
              </div>
            ) : (
              <div style={{ color: "var(--accent-rose)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertTriangle size={16} />
                <span><strong>Canary Failed:</strong> {canaryResult.error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Executions Log */}
      <div className="glass-panel" style={{ padding: "1.75rem" }}>
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>
          <FileText size={18} color="var(--primary)" /> Recent Generations Log
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
              {stats?.recent?.map((item: any) => (
                <tr key={item.id}>
                  <td style={{ color: "var(--text-subtle)", whiteSpace: "nowrap" }}>
                    {new Date(item.createdAt).toLocaleString(undefined, {
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
                  <td style={{ color: "var(--text-muted)" }}>{item.userEmail || "anonymous"}</td>
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
