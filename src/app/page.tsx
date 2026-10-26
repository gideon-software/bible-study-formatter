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
  getVersionCredit,
} from "@/lib/bible/books";
import {
  BookOpen,
  FileText,
  Settings2,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  BookmarkCheck,
  RotateCcw,
  Check,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GoogleLogo } from "@/components/GoogleLogo";
import { UserDropdown } from "@/components/UserDropdown";
import { parseUrlSettings } from "@/lib/bible/urlParams";

const FONT_FAMILY_MAP: Record<string, string> = {
  Arial: "Arial, Helvetica, sans-serif",
  Georgia: "Georgia, Cambria, serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  Roboto: "'Roboto', sans-serif",
  "Trebuchet MS": "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif",
  Verdana: "Verdana, Geneva, sans-serif",
  "Courier New": "'Courier New', Courier, monospace",
};

const SYSTEM_DEFAULT_OPTIONS: FormatOptions = {
  chapterHeaders: true,
  chapterPageBreaks: true,
  verseNumbers: true,
  titlePage: false,
  fontName: "Arial",
  fontSize: 11,
  lineSpacing: 2,
};

const SYSTEM_DEFAULT_VERSION = "ESV";

export default function Home() {
  // Auth state
  const [user, setUser] = useState<{ name?: string; email?: string; picture?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form selections
  const [versionId, setVersionId] = useState(SYSTEM_DEFAULT_VERSION);
  const [bookId, setBookId] = useState("JHN");
  const [chapterStart, setChapterStart] = useState(1);
  const [chapterEnd, setChapterEnd] = useState(1);

  // Formatting Options
  const [options, setOptions] = useState<FormatOptions>(SYSTEM_DEFAULT_OPTIONS);

  // User Defaults state (persisted across sessions)
  const [savedDefaults, setSavedDefaults] = useState<{
    version: string;
    options: FormatOptions;
  }>({
    version: SYSTEM_DEFAULT_VERSION,
    options: SYSTEM_DEFAULT_OPTIONS,
  });
  const [defaultsSavedNotice, setDefaultsSavedNotice] = useState(false);
  const [versionSavedNotice, setVersionSavedNotice] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [createdDoc, setCreatedDoc] = useState<{ id: string; url: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available chapters for selected book
  const chapters = useMemo(() => getBookChapters(bookId), [bookId]);

  // Check if formatting options differ from saved defaults
  const isFormattingDirty = useMemo(() => {
    return (
      options.chapterHeaders !== savedDefaults.options.chapterHeaders ||
      options.chapterPageBreaks !== savedDefaults.options.chapterPageBreaks ||
      options.verseNumbers !== savedDefaults.options.verseNumbers ||
      options.titlePage !== savedDefaults.options.titlePage ||
      options.fontName !== savedDefaults.options.fontName ||
      options.fontSize !== savedDefaults.options.fontSize ||
      options.lineSpacing !== savedDefaults.options.lineSpacing
    );
  }, [options, savedDefaults.options]);

  // Check if active Bible version differs from saved default version
  const isVersionDirty = useMemo(() => {
    return versionId !== savedDefaults.version;
  }, [versionId, savedDefaults.version]);

  // Validate Crossway ESV guidelines (max 500 verses / half a book)
  const policyCheck = useMemo(
    () =>
      versionId === "ESV"
        ? validateEsvPassageRange(bookId, chapterStart, chapterEnd)
        : { allowed: true },
    [versionId, bookId, chapterStart, chapterEnd]
  );

  // Initial client hydration: URL Params > Local Session > User Saved Defaults > System Defaults
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      // 1. Parse URL query params
      const urlSettings = parseUrlSettings(window.location.search);

      // 2. Read saved defaults from localStorage
      let localDefaults: { version: string; options: FormatOptions } = {
        version: SYSTEM_DEFAULT_VERSION,
        options: { ...SYSTEM_DEFAULT_OPTIONS },
      };
      try {
        const rawSaved = localStorage.getItem("bsf_user_defaults");
        if (rawSaved) {
          const parsed = JSON.parse(rawSaved);
          if (parsed?.options) {
            localDefaults = {
              version: parsed.version || SYSTEM_DEFAULT_VERSION,
              options: { ...SYSTEM_DEFAULT_OPTIONS, ...parsed.options },
            };
          }
        }
      } catch (e) {
        console.error("Failed to read bsf_user_defaults:", e);
      }

      // 3. Read current session preferences from localStorage
      let localCurrentOptions: FormatOptions | null = null;
      try {
        const rawCur = localStorage.getItem("bsf_current_options");
        if (rawCur) {
          localCurrentOptions = { ...SYSTEM_DEFAULT_OPTIONS, ...JSON.parse(rawCur) };
        }
      } catch (e) {
        console.error("Failed to read bsf_current_options:", e);
      }

      let localPassage: { bookId: string; chapterStart: number; chapterEnd: number } | null = null;
      try {
        const rawPassage = localStorage.getItem("bsf_last_passage");
        if (rawPassage) {
          localPassage = JSON.parse(rawPassage);
        }
      } catch (e) {
        console.error("Failed to read bsf_last_passage:", e);
      }

      let localCurrentVersion: string | null = null;
      try {
        localCurrentVersion = localStorage.getItem("bsf_current_version");
      } catch (e) {
        console.error("Failed to read bsf_current_version:", e);
      }

      // 4. Resolve initial values
      const initialVersion =
        urlSettings.versionId ||
        localCurrentVersion ||
        localDefaults.version ||
        SYSTEM_DEFAULT_VERSION;

      const initialBookId =
        urlSettings.bookId ||
        localPassage?.bookId ||
        "JHN";

      const initialStart =
        urlSettings.chapterStart ??
        localPassage?.chapterStart ??
        1;

      const initialEnd =
        urlSettings.chapterEnd ??
        localPassage?.chapterEnd ??
        1;

      // Formatting options: URL params override active session & defaults for this load without wiping defaults
      const baseOptions = localCurrentOptions || localDefaults.options;
      const initialOptions: FormatOptions = {
        ...baseOptions,
        ...(urlSettings.options || {}),
      };

      if (!isMounted) return;

      setSavedDefaults(localDefaults);
      setVersionId(initialVersion);
      setBookId(initialBookId);
      setChapterStart(initialStart);
      setChapterEnd(initialEnd);
      setOptions(initialOptions);
      setIsHydrated(true);

      // 5. Check Auth & Load DB Preferences if logged in
      try {
        const authRes = await fetch("/api/auth/google/status");
        const authData = await authRes.json();
        if (!isMounted) return;

        if (authData.authenticated && authData.user) {
          setUser(authData.user);
          setIsAdmin(!!authData.isAdmin);

          // Fetch DB preferences for authenticated user
          const prefRes = await fetch("/api/user/preferences");
          const prefData = await prefRes.json();
          if (!isMounted) return;

          if (prefData.preferences) {
            const dbPref = prefData.preferences;
            const mergedDefaults = {
              version: dbPref.defaultVersion || SYSTEM_DEFAULT_VERSION,
              options: {
                ...SYSTEM_DEFAULT_OPTIONS,
                ...(dbPref.defaultOptionsJson || {}),
              },
            };
            setSavedDefaults(mergedDefaults);
            try {
              localStorage.setItem("bsf_user_defaults", JSON.stringify(mergedDefaults));
            } catch {}

            // If no URL settings were present and no active session storage, restore passage from DB
            if (!urlSettings.hasUrlSettings && !localPassage && dbPref.lastBookId) {
              setBookId(dbPref.lastBookId);
              if (dbPref.lastChapterStart) setChapterStart(dbPref.lastChapterStart);
              if (dbPref.lastChapterEnd) setChapterEnd(dbPref.lastChapterEnd);
            }
          }
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Init auth and preferences error:", err);
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync active session formatting options to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem("bsf_current_options", JSON.stringify(options));
    } catch (e) {
      console.error("Failed to save current options to localStorage:", e);
    }
  }, [options, isHydrated]);

  // Sync active Bible version to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem("bsf_current_version", versionId);
    } catch (e) {
      console.error("Failed to save current version to localStorage:", e);
    }
  }, [versionId, isHydrated]);

  // Sync active Scripture passage to localStorage & database
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        "bsf_last_passage",
        JSON.stringify({ bookId, chapterStart, chapterEnd })
      );
    } catch (e) {
      console.error("Failed to save last passage to localStorage:", e);
    }

    // Debounced sync to database if logged in
    if (user) {
      const timer = setTimeout(() => {
        fetch("/api/user/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lastBookId: bookId,
            lastChapterStart: chapterStart,
            lastChapterEnd: chapterEnd,
          }),
        }).catch((err) => console.error("Failed to update last passage in DB:", err));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [bookId, chapterStart, chapterEnd, isHydrated, user]);

  // Handle saving current formatting options as personal defaults
  const handleSaveDefaults = async () => {
    const newDefaults = {
      ...savedDefaults,
      options: { ...options },
    };
    setSavedDefaults(newDefaults);
    try {
      localStorage.setItem("bsf_user_defaults", JSON.stringify(newDefaults));
    } catch (e) {
      console.error("Failed to save defaults to localStorage:", e);
    }

    if (user) {
      try {
        await fetch("/api/user/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultOptionsJson: options,
          }),
        });
      } catch (e) {
        console.error("Failed to sync defaults to database:", e);
      }
    }

    setDefaultsSavedNotice(true);
    setTimeout(() => {
      setDefaultsSavedNotice(false);
    }, 2500);
  };

  // Handle resetting active formatting options to saved personal defaults
  const handleResetDefaults = () => {
    setOptions({ ...savedDefaults.options });
    try {
      localStorage.setItem("bsf_current_options", JSON.stringify(savedDefaults.options));
    } catch (e) {
      console.error("Failed to update localStorage:", e);
    }
  };

  // Handle saving current Bible version as default
  const handleSaveDefaultVersion = async () => {
    const newDefaults = {
      ...savedDefaults,
      version: versionId,
    };
    setSavedDefaults(newDefaults);
    try {
      localStorage.setItem("bsf_user_defaults", JSON.stringify(newDefaults));
    } catch (e) {
      console.error("Failed to save default version to localStorage:", e);
    }

    if (user) {
      try {
        await fetch("/api/user/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultVersion: versionId,
          }),
        });
      } catch (e) {
        console.error("Failed to sync default version to database:", e);
      }
    }

    setVersionSavedNotice(true);
    setTimeout(() => {
      setVersionSavedNotice(false);
    }, 2500);
  };

  // Handle resetting active Bible version to saved default version
  const handleResetDefaultVersion = () => {
    setVersionId(savedDefaults.version);
    try {
      localStorage.setItem("bsf_current_version", savedDefaults.version);
    } catch (e) {
      console.error("Failed to update localStorage:", e);
    }
  };

  // Handle book selection change
  const handleBookChange = (newBookId: string) => {
    setBookId(newBookId);
    setChapterStart(1);
    setChapterEnd(1);
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
          {/* Theme Mode Toggle (System / Light / Dark) */}
          <ThemeToggle />

          {/* User Profile Dropdown or Sign In */}
          {user ? (
            <UserDropdown
              user={user}
              isAdmin={isAdmin}
              onLogout={async () => {
                await fetch("/api/auth/google/logout", { method: "POST" });
                setUser(null);
                setIsAdmin(false);
              }}
            />
          ) : (
            <a href="/api/auth/google/login" className="btn-google">
              <GoogleLogo size={16} /> Sign in with Google
            </a>
          )}
        </div>
      </header>

      {/* Main Two-Column Grid */}
      <div className="app-grid">
        {/* Left Column: Form Controls */}
        <div className="glass-panel form-section">
          {/* Section: Bible Passage */}
          <div className="section-header-container">
            <h2 className="section-title">
              <BookOpen size={18} color="var(--primary)" /> 1. Select Scripture
            </h2>
            <div className="section-header-actions">
              {versionSavedNotice ? (
                <span className="save-feedback-badge">
                  <Check size={13} /> Default version saved
                </span>
              ) : isVersionDirty ? (
                <>
                  <button
                    type="button"
                    className="btn-header-action btn-save-default"
                    onClick={handleSaveDefaultVersion}
                    title={`Save ${versionId} as your default Bible version`}
                  >
                    <BookmarkCheck size={14} /> Set as default version
                  </button>
                  <button
                    type="button"
                    className="btn-header-action"
                    onClick={handleResetDefaultVersion}
                    title={`Reset version to default (${savedDefaults.version})`}
                  >
                    <RotateCcw size={13} /> Reset to default
                  </button>
                </>
              ) : null}
            </div>
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
                    {v.abbr}: {v.name}{!v.enabled ? " (Coming Soon)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Book */}
            <div className="field-group full-width">
              <label className="field-label">Book</label>
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
              <div className="field-header-row">
                <label className="field-label">Last Chapter</label>
                {chapters.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSelectWholeBook}
                    className="btn-link"
                  >
                    Select entire book
                  </button>
                )}
              </div>
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
                <span>
                  {policyCheck.reasonPrefix ? (
                    <>
                      {policyCheck.reasonPrefix} To stay within guidelines,{" "}
                      {policyCheck.suggestedEndChapter ? (
                        <button
                          type="button"
                          className="policy-suggestion-link"
                          onClick={() =>
                            handleChapterEndChange(policyCheck.suggestedEndChapter!)
                          }
                        >
                          select up to {policyCheck.suggestedRangeLabel}
                        </button>
                      ) : (
                        `select up to ${policyCheck.suggestedRangeLabel}`
                      )}{" "}
                      {policyCheck.reasonSuffix}
                    </>
                  ) : (
                    policyCheck.reason
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Section: Formatting Switches */}
          <div className="section-header-container">
            <h2 className="section-title">
              <Settings2 size={18} color="var(--primary)" /> 2. Formatting Options
            </h2>
            <div className="section-header-actions">
              {defaultsSavedNotice ? (
                <span className="save-feedback-badge">
                  <Check size={13} /> Defaults saved
                </span>
              ) : isFormattingDirty ? (
                <>
                  <button
                    type="button"
                    className="btn-header-action btn-save-default"
                    onClick={handleSaveDefaults}
                    title="Save current formatting options as your personal defaults"
                  >
                    <BookmarkCheck size={14} /> Set as my default
                  </button>
                  <button
                    type="button"
                    className="btn-header-action"
                    onClick={handleResetDefaults}
                    title="Reset formatting options to your saved defaults"
                  >
                    <RotateCcw size={13} /> Reset to defaults
                  </button>
                </>
              ) : null}
            </div>
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
                <option value={1.0}>1.0 (Single spaced)</option>
                <option value={1.15}>1.15 (Standard)</option>
                <option value={1.5}>1.5 (Expanded)</option>
                <option value={2.0}>2.0 (Double spaced - ideal for notes)</option>
              </select>
            </div>
          </div>

          {/* Create Button */}
          <button
            className={`btn ${user ? "btn-primary" : "btn-google-cta"} btn-create-doc`}
            onClick={handleCreateDoc}
            disabled={isGenerating || !policyCheck.allowed}
          >
            {isGenerating ? (
              <RefreshCw size={18} className="spin" />
            ) : user ? (
              <FileText size={18} />
            ) : (
              <GoogleLogo size={18} />
            )}
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
              <FileText size={18} color="var(--primary)" /> Live Document Preview
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
                <p>{versionId} • {SUPPORTED_VERSIONS.find((v) => v.id === versionId)?.name || versionId}</p>
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
                  <RefreshCw
                    size={16}
                    className={isGenerating ? "spin" : ""}
                    color="var(--primary)"
                  />
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
          {versionId === "ESV" ? (
            <>
              {ESV_COPYRIGHT_NOTICE}{" "}
              <a
                href="https://www.esv.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.esv.org
              </a>
            </>
          ) : (
            getVersionCredit(versionId)
          )}
        </p>
        <p className="app-footer-credit">
          Developed by Gideon Software Solutions. Made available free of charge for personal and church ministry use.
        </p>
      </footer>
    </div>
  );
}
