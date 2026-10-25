"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BIBLE_BOOKS,
  SUPPORTED_VERSIONS,
  FormatOptions,
  getBookChapters,
  getDocTitle,
  validateEsvPassageRange,
  ESV_COPYRIGHT_NOTICE,
} from "@/lib/bible/books";
import {
  BookOpen,
  FileText,
  Settings2,
  Sparkles,
  ExternalLink,
  LogIn,
  LogOut,
  Moon,
  Sun,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

const FONT_FAMILY_MAP: Record<string, string> = {
  Arial: "Arial, Helvetica, sans-serif",
  Georgia: "Georgia, Cambria, serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  Roboto: "'Roboto', sans-serif",
  "Trebuchet MS": "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif",
  Verdana: "Verdana, Geneva, sans-serif",
  "Courier New": "'Courier New', Courier, monospace",
};

export default function Home() {
  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Auth state
  const [user, setUser] = useState<{ name?: string; email?: string; picture?: string } | null>(null);

  // Form selections
  const [versionId, setVersionId] = useState("ESV");
  const [bookId, setBookId] = useState("JHN");
  const [chapterStart, setChapterStart] = useState(1);
  const [chapterEnd, setChapterEnd] = useState(1);

  // Formatting Options
  const [options, setOptions] = useState<FormatOptions>({
    chapterHeaders: true,
    chapterPageBreaks: true,
    verseNumbers: true,
    titlePage: false,
    fontName: "Arial",
    fontSize: 11,
    lineSpacing: 2,
  });

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [createdDoc, setCreatedDoc] = useState<{ id: string; url: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available chapters for selected book
  const chapters = useMemo(() => getBookChapters(bookId), [bookId]);

  // Validate Crossway ESV guidelines (max 500 verses / half a book)
  const policyCheck = useMemo(
    () =>
      versionId === "ESV"
        ? validateEsvPassageRange(bookId, chapterStart, chapterEnd)
        : { allowed: true },
    [versionId, bookId, chapterStart, chapterEnd]
  );

  // Toggle theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Check auth session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/google/status");
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Auth status error:", err);
      }
    }
    checkAuth();
  }, []);

  // Handle book selection change
  const handleBookChange = (newBookId: string) => {
    setBookId(newBookId);
    const newChapters = getBookChapters(newBookId);
    setChapterStart(1);
    setChapterEnd(newChapters.length || 1);
  };

  // Handle whole book selection
  const handleSelectWholeBook = () => {
    setChapterStart(1);
    setChapterEnd(chapters.length);
  };

  // Handle single chapter lock
  const handleChapterStartChange = (val: number) => {
    setChapterStart(val);
    if (val > chapterEnd) {
      setChapterEnd(val);
    }
  };

  const handleChapterEndChange = (val: number) => {
    setChapterEnd(val);
    if (val < chapterStart) {
      setChapterStart(val);
    }
  };

  // Trigger Doc Creation
  const handleCreateDoc = async () => {
    if (!user) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/api/auth/google/login";
      return;
    }

    setIsGenerating(true);
    setProgress(null); // indeterminate initially
    setStatusMessage("Connecting to Google Docs API...");
    setErrorMsg(null);
    setCreatedDoc(null);

    try {
      setStatusMessage("Fetching Scripture and applying typography rules...");
      setProgress(40);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          chapterStart,
          chapterEnd,
          version: versionId,
          options,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.needsAuth) {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/api/auth/google/login";
          return;
        }
        throw new Error(result.message || result.error || "Generation failed");
      }

      setProgress(100);
      setStatusMessage("Document created successfully in your Google Drive!");
      setCreatedDoc({
        id: result.docId,
        url: result.docUrl,
        name: result.docName,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create document.";
      setErrorMsg(msg);
      setStatusMessage("");
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedBook = BIBLE_BOOKS.find((b) => b.id === bookId);
  const currentTitle = getDocTitle(bookId, chapterStart, chapterEnd, versionId);

  return (
    <div className="container">
      {/* App Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Bible Study Formatter Logo" width={30} height={30} />
          </div>
          <div>
            <h1>Bible Study Formatter</h1>
            <p>Modern formatting for study, sermon prep, and personal journals</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Admin link */}
          <a href="/admin" className="btn btn-secondary btn-sm">
            <ShieldCheck size={16} /> Admin Portal
          </a>

          {/* Dark / Light Toggle */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* User Auth Pill */}
          {user ? (
            <div className="user-pill">
              {user.picture ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={user.picture} alt="Avatar" className="user-avatar" />
              ) : null}
              <span>{user.name || user.email}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  await fetch("/api/auth/google/logout", { method: "POST" });
                  setUser(null);
                }}
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <a href="/api/auth/google/login" className="btn btn-primary btn-sm">
              <LogIn size={15} /> Sign in with Google
            </a>
          )}
        </div>
      </header>

      {/* Main Two-Column Grid */}
      <div className="app-grid">
        {/* Left Column: Form Controls */}
        <div className="glass-panel form-section">
          {/* Section: Bible Passage */}
          <div>
            <h2 className="section-title">
              <BookOpen size={18} color="var(--primary)" /> 1. Select Scripture
            </h2>
          </div>

          <div className="field-grid">
            {/* Version */}
            <div className="field-group full-width">
              <label className="field-label">Bible Version</label>
              <select
                className="field-select"
                value={versionId}
                onChange={(e) => setVersionId(e.target.value)}
              >
                {SUPPORTED_VERSIONS.map((v) => (
                  <option key={v.id} value={v.abbr} disabled={!v.enabled}>
                    {v.name} {!v.enabled ? "(Coming Soon)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Book */}
            <div className="field-group full-width">
              <div className="field-header-row">
                <label className="field-label">Book</label>
                <button
                  type="button"
                  onClick={handleSelectWholeBook}
                  className="btn-link"
                >
                  Select entire book
                </button>
              </div>
              <select
                className="field-select"
                value={bookId}
                onChange={(e) => handleBookChange(e.target.value)}
              >
                <optgroup label="Old Testament">
                  {BIBLE_BOOKS.filter((b) => b.testament === "OT").map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.numChapters} chapters)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="New Testament">
                  {BIBLE_BOOKS.filter((b) => b.testament === "NT").map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.numChapters} chapters)
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Chapter Start */}
            <div className="field-group">
              <label className="field-label">First Chapter</label>
              <select
                className="field-select"
                value={chapterStart}
                onChange={(e) => handleChapterStartChange(Number(e.target.value))}
              >
                {chapters.map((ch) => (
                  <option key={ch} value={ch}>
                    Chapter {ch}
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter End */}
            <div className="field-group">
              <label className="field-label">Last Chapter</label>
              <select
                className="field-select"
                value={chapterEnd}
                onChange={(e) => handleChapterEndChange(Number(e.target.value))}
              >
                {chapters.map((ch) => (
                  <option key={ch} value={ch}>
                    Chapter {ch}
                  </option>
                ))}
              </select>
            </div>

            {/* Crossway ESV Policy Range Notice */}
            {!policyCheck.allowed && (
              <div className="policy-warning-banner">
                <AlertCircle size={16} />
                <span>{policyCheck.reason}</span>
              </div>
            )}
          </div>

          {/* Section: Formatting Switches */}
          <div>
            <h2 className="section-title">
              <Settings2 size={18} color="var(--primary)" /> 2. Formatting Options
            </h2>
          </div>

          <div className="toggle-grid">
            <label className="switch-label">
              <span>Chapter Headers</span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.chapterHeaders}
                onChange={(e) =>
                  setOptions({ ...options, chapterHeaders: e.target.checked })
                }
              />
            </label>

            <label className="switch-label">
              <span>Chapter Page Breaks</span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.chapterPageBreaks}
                onChange={(e) =>
                  setOptions({ ...options, chapterPageBreaks: e.target.checked })
                }
              />
            </label>

            <label className="switch-label">
              <span>Verse Numbers</span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.verseNumbers}
                onChange={(e) =>
                  setOptions({ ...options, verseNumbers: e.target.checked })
                }
              />
            </label>

            <label className="switch-label">
              <span>Title Page</span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.titlePage}
                onChange={(e) =>
                  setOptions({ ...options, titlePage: e.target.checked })
                }
              />
            </label>
          </div>

          {/* Section: Typography */}
          <div className="field-grid">
            <div className="field-group">
              <label className="field-label">Font Family</label>
              <select
                className="field-select"
                value={options.fontName}
                onChange={(e) =>
                  setOptions({ ...options, fontName: e.target.value })
                }
              >
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Roboto">Roboto</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
                <option value="Verdana">Verdana</option>
                <option value="Courier New">Courier New</option>
              </select>
            </div>

            <div className="field-group">
              <label className="field-label">Font Size (pt)</label>
              <input
                type="number"
                min="8"
                max="24"
                className="field-input"
                value={options.fontSize}
                onChange={(e) =>
                  setOptions({ ...options, fontSize: Number(e.target.value) })
                }
              />
            </div>

            <div className="field-group full-width">
              <label className="field-label">Line Spacing</label>
              <select
                className="field-select"
                value={options.lineSpacing}
                onChange={(e) =>
                  setOptions({ ...options, lineSpacing: Number(e.target.value) })
                }
              >
                <option value={1.0}>1.0 (Single Spaced)</option>
                <option value={1.15}>1.15 (Standard)</option>
                <option value={1.5}>1.5 (Expanded)</option>
                <option value={2.0}>2.0 (Double Spaced - Ideal for Notes)</option>
              </select>
            </div>
          </div>

          {/* Create Button */}
          <button
            className="btn btn-primary btn-create-doc"
            onClick={handleCreateDoc}
            disabled={isGenerating || !policyCheck.allowed}
          >
            <Sparkles size={18} />
            {isGenerating
              ? "Generating Google Doc..."
              : !policyCheck.allowed
              ? "Exceeds ESV Guidelines (Adjust Range)"
              : user
              ? "Create Formatted Google Doc"
              : "Sign in with Google & Create Doc"}
          </button>
        </div>

        {/* Right Column: Live Document Preview */}
        <div className="glass-panel preview-panel">
          <div>
            <h2 className="section-title">
              <FileText size={18} color="var(--accent-emerald)" /> Live Document Preview
            </h2>
            <p className="preview-subtitle">
              Simulating formatting for <strong>{currentTitle}</strong>
            </p>
          </div>

          {/* Simulated Google Doc Paper */}
          <div
            className="doc-sheet"
            style={{
              fontFamily: FONT_FAMILY_MAP[options.fontName] || options.fontName,
              fontSize: `${options.fontSize}pt`,
              lineHeight: options.lineSpacing,
            }}
          >
            {/* Title Page Simulation */}
            {options.titlePage && (
              <div className="doc-title-page-preview">
                <h2>{currentTitle}</h2>
                <p>{versionId} • English Standard Version</p>
              </div>
            )}

            {/* Chapter Header Simulation */}
            {options.chapterHeaders && (
              <div className="doc-heading-preview">
                {selectedBook?.name}{" "}
                {selectedBook && selectedBook.numChapters > 1 ? chapterStart : ""}
              </div>
            )}

            {/* Sample Scripture Prose */}
            <p>
              {options.verseNumbers && (
                <span className="doc-verse-num">
                  {options.chapterHeaders ? "1" : `${chapterStart}:1`}
                </span>
              )}
              In the beginning was the Word, and the Word was with God, and the
              Word was God.{" "}
              {options.verseNumbers && <span className="doc-verse-num">2</span>}
              He was in the beginning with God.{" "}
              {options.verseNumbers && <span className="doc-verse-num">3</span>}
              All things were made through him, and without him was not any
              thing made that was made.
            </p>

            {/* Sample Poetry Indent */}
            <p className="doc-poetry-indent">
              {options.verseNumbers && <span className="doc-verse-num">5</span>}
              The light shines in the darkness,
              <br />
              <span className="poetry-line-2">
                and the darkness has not overcome it.
              </span>
            </p>
          </div>

          {/* Generation Progress & Status */}
          {(isGenerating || progress !== null || errorMsg || createdDoc) && (
            <div className="generation-status">
              {statusMessage && (
                <div className="status-indicator">
                  <Sparkles size={16} color="var(--primary)" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {isGenerating && (
                <div className="progress-track">
                  <div
                    className={`progress-bar-fill ${progress === null ? "indeterminate" : ""}`}
                    style={{ width: progress !== null ? `${progress}%` : undefined }}
                  />
                </div>
              )}

              {errorMsg && (
                <div className="status-error">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {createdDoc && (
                <div className="doc-link-card">
                  <div>
                    <div className="doc-link-name">
                      {createdDoc.name}
                    </div>
                    <div className="doc-link-desc">
                      Saved directly in your Google Drive
                    </div>
                  </div>
                  <a href={createdDoc.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                    Open Doc <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Official Copyright & Legal Attribution Footer */}
      {/* Required by Crossway ESV API Guidelines: https://api.esv.org/#copyright */}
      <footer className="app-footer">
        <p>
          {ESV_COPYRIGHT_NOTICE}{" "}
          <a
            href="https://www.esv.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.esv.org
          </a>
        </p>
        <p className="app-footer-credit">
          Developed by Gideon Software Solutions. Made available free of charge for personal and church ministry use.
        </p>
      </footer>
    </div>
  );
}
