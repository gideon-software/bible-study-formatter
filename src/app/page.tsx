"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  OT_BOOKS,
  NT_BOOKS,
  SUPPORTED_VERSIONS,
  SUPPORTED_FONT_FAMILIES,
  FONT_FAMILY_CSS_MAP,
  DEFAULT_FORMAT_OPTIONS,
  DEFAULT_VERSION,
  FormatOptions,
  getBookChapters,
  getChapterVerseCount,
  getChapterVerses,
  getDocTitle,
  getPassageVerseCount,
  isPartialVerseSelection,
  validateEsvPassageRange,
  ESV_COPYRIGHT_NOTICE,
  getVersionCredit,
  getVersionName,
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
  Link2,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GoogleLogo } from "@/components/GoogleLogo";
import { UserDropdown } from "@/components/UserDropdown";
import { parseUrlSettings, buildShareableUrl } from "@/lib/bible/urlParams";

interface DocHistoryItem {
  id?: number;
  docId: string | null;
  docUrl: string | null;
  docName: string;
  versionAbbr: string;
  bookId: string;
  bookName?: string;
  chapterStart: number;
  chapterEnd: number;
  verseStart?: number;
  verseEnd?: number;
  options?: Partial<FormatOptions> | null;
  createdAt: string;
}

function getPassageGroupKey(item: {
  bookId: string;
  chapterStart: number;
  chapterEnd: number;
  verseStart?: number;
  verseEnd?: number;
  versionAbbr: string;
  options?: (Partial<FormatOptions> & { verseStart?: number; verseEnd?: number }) | null;
}): string {
  const vStart = item.verseStart ?? item.options?.verseStart;
  const vEnd = item.verseEnd ?? item.options?.verseEnd;
  const versePart =
    vStart !== undefined || vEnd !== undefined
      ? `:${vStart ?? 1}-${vEnd ?? ""}`
      : "";
  return `${item.bookId.toUpperCase()}:${item.chapterStart}-${item.chapterEnd}${versePart}:${item.versionAbbr.toUpperCase()}`;
}

function formatRelativeDocDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function formatDocTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return "";
  const monthDay = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const timeStr = date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s+/g, "")
    .toLowerCase();
  return `${monthDay} @ ${timeStr}`;
}

function describeOptionsDiff(
  itemOpts?: Partial<FormatOptions> | null,
  refOpts?: Partial<FormatOptions> | null
): string | null {
  if (!itemOpts || !refOpts) return null;
  const diffs: string[] = [];

  if (Boolean(itemOpts.chapterHeaders ?? true) !== Boolean(refOpts.chapterHeaders ?? true)) {
    diffs.push(itemOpts.chapterHeaders ? "Chapter headers on" : "No chapter headers");
  }
  if (Boolean(itemOpts.chapterPageBreaks ?? true) !== Boolean(refOpts.chapterPageBreaks ?? true)) {
    diffs.push(itemOpts.chapterPageBreaks ? "Page breaks on" : "No page breaks");
  }
  if (Boolean(itemOpts.verseNumbers ?? true) !== Boolean(refOpts.verseNumbers ?? true)) {
    diffs.push(itemOpts.verseNumbers ? "Verse numbers on" : "No verse numbers");
  }
  if (Boolean(itemOpts.sectionHeadings ?? false) !== Boolean(refOpts.sectionHeadings ?? false)) {
    diffs.push(itemOpts.sectionHeadings ? "Section headings on" : "No section headings");
  }
  if (Boolean(itemOpts.titlePage ?? false) !== Boolean(refOpts.titlePage ?? false)) {
    diffs.push(itemOpts.titlePage ? "Title page on" : "No title page");
  }
  if (
    itemOpts.fontName &&
    refOpts.fontName &&
    itemOpts.fontName !== refOpts.fontName
  ) {
    diffs.push(itemOpts.fontName);
  }
  if (
    itemOpts.fontSize !== undefined &&
    refOpts.fontSize !== undefined &&
    itemOpts.fontSize !== refOpts.fontSize
  ) {
    diffs.push(`${itemOpts.fontSize}pt`);
  }
  if (
    itemOpts.lineSpacing !== undefined &&
    refOpts.lineSpacing !== undefined &&
    itemOpts.lineSpacing !== refOpts.lineSpacing
  ) {
    diffs.push(`${itemOpts.lineSpacing}x spacing`);
  }
  if (
    (itemOpts.pageMargins ?? 1) !== (refOpts.pageMargins ?? 1) &&
    itemOpts.pageMargins !== undefined
  ) {
    diffs.push(`${itemOpts.pageMargins}" margins`);
  }

  return diffs.length > 0 ? diffs.join(" • ") : null;
}

const STORAGE_KEYS = {
  USER_DEFAULTS: "bsf_user_defaults",
  CURRENT_OPTIONS: "bsf_current_options",
  LAST_PASSAGE: "bsf_last_passage",
  CURRENT_VERSION: "bsf_current_version",
  SHOW_VERSES: "bsf_show_verses",
} as const;

function readStorageJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.error(`Failed to read ${key}:`, e);
    return null;
  }
}

function writeStorageJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write ${key}:`, e);
  }
}

function readStorageString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error(`Failed to read ${key}:`, e);
    return null;
  }
}

function writeStorageString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error(`Failed to write ${key}:`, e);
  }
}

interface DocHistoryRowActionsProps {
  rowKey: string;
  item: DocHistoryItem;
  copiedKey: string | null;
  isTrashing: boolean;
  onCopyLink: (
    key: string,
    versionAbbr: string,
    bookId: string,
    chapterStart: number,
    chapterEnd: number,
    verseStart?: number,
    verseEnd?: number,
    options?: Partial<FormatOptions> | null
  ) => void;
  onTrash: (key: string, docIds: string[]) => void;
}

function DocHistoryRowActions({
  rowKey,
  item,
  copiedKey,
  isTrashing,
  onCopyLink,
  onTrash,
}: DocHistoryRowActionsProps) {
  const isCopied = copiedKey === rowKey;
  const rawOpts = (item.options || {}) as Partial<FormatOptions> & {
    verseStart?: number;
    verseEnd?: number;
  };
  return (
    <div className="doc-history-actions">
      <button
        type="button"
        className={`btn-copy-link ${isCopied ? "copied" : ""}`}
        onClick={() =>
          onCopyLink(
            rowKey,
            item.versionAbbr,
            item.bookId,
            item.chapterStart,
            item.chapterEnd,
            item.verseStart ?? rawOpts.verseStart,
            item.verseEnd ?? rawOpts.verseEnd,
            item.options
          )
        }
        title="Copy a BSF link pre-filled with this passage and formatting"
      >
        {isCopied ? (
          <>
            <Check size={13} /> Copied URL
          </>
        ) : (
          <>
            <Link2 size={13} /> Copy BSF link
          </>
        )}
      </button>

      {item.docId && (
        <button
          type="button"
          className="btn-trash-doc"
          disabled={isTrashing}
          onClick={() => onTrash(rowKey, [item.docId!])}
          title="Move to Google Drive trash"
          aria-label="Move to Google Drive trash"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

const FONT_FAMILY_MAP = FONT_FAMILY_CSS_MAP;
const SYSTEM_DEFAULT_OPTIONS = DEFAULT_FORMAT_OPTIONS;
const SYSTEM_DEFAULT_VERSION = DEFAULT_VERSION;

export default function Home() {
  // Auth state
  const [user, setUser] = useState<{ name?: string; email?: string; picture?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form selections
  const [versionId, setVersionId] = useState(SYSTEM_DEFAULT_VERSION);
  const [bookId, setBookId] = useState("JHN");
  const [chapterStart, setChapterStart] = useState(1);
  const [chapterEnd, setChapterEnd] = useState(1);
  const [verseStart, setVerseStart] = useState(1);
  const [verseEnd, setVerseEnd] = useState(() =>
    getChapterVerseCount("JHN", 1, SYSTEM_DEFAULT_VERSION)
  );
  const [showVerseSelector, setShowVerseSelector] = useState(false);

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

  // Generation status & document history
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInFlightRow, setShowInFlightRow] = useState(false);
  const inFlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [createdDoc, setCreatedDoc] = useState<{
    id: string;
    url: string;
    name: string;
    versionAbbr: string;
    bookId: string;
    chapterStart: number;
    chapterEnd: number;
    verseStart?: number;
    verseEnd?: number;
    options: FormatOptions;
  } | null>(null);
  const [userHistory, setUserHistory] = useState<DocHistoryItem[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [trashingKeys, setTrashingKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [authNotice, setAuthNotice] = useState<{
    title: string;
    message: string;
    showGrantButton?: boolean;
  } | null>(null);

  // Available chapters and verses for selected book/chapters
  const chapters = useMemo(() => getBookChapters(bookId), [bookId]);
  const startChapterVerses = useMemo(
    () => getChapterVerses(bookId, chapterStart, versionId),
    [bookId, chapterStart, versionId]
  );
  const endChapterVerses = useMemo(
    () => getChapterVerses(bookId, chapterEnd, versionId),
    [bookId, chapterEnd, versionId]
  );
  const totalSelectedVerses = useMemo(
    () =>
      getPassageVerseCount(
        bookId,
        chapterStart,
        chapterEnd,
        verseStart,
        verseEnd,
        versionId
      ),
    [bookId, chapterStart, chapterEnd, verseStart, verseEnd, versionId]
  );
  const inFlightTitle = useMemo(
    () =>
      getDocTitle(
        bookId,
        chapterStart,
        chapterEnd,
        versionId,
        verseStart,
        verseEnd
      ),
    [bookId, chapterStart, chapterEnd, versionId, verseStart, verseEnd]
  );

  // Check if formatting options differ from saved defaults
  const isFormattingDirty = useMemo(() => {
    return (
      options.chapterHeaders !== savedDefaults.options.chapterHeaders ||
      options.chapterPageBreaks !== savedDefaults.options.chapterPageBreaks ||
      options.verseNumbers !== savedDefaults.options.verseNumbers ||
      Boolean(options.sectionHeadings) !== Boolean(savedDefaults.options.sectionHeadings) ||
      options.titlePage !== savedDefaults.options.titlePage ||
      options.fontName !== savedDefaults.options.fontName ||
      options.fontSize !== savedDefaults.options.fontSize ||
      options.lineSpacing !== savedDefaults.options.lineSpacing ||
      (options.pageMargins ?? 1) !== (savedDefaults.options.pageMargins ?? 1)
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
        ? validateEsvPassageRange(
            bookId,
            chapterStart,
            chapterEnd,
            verseStart,
            verseEnd
          )
        : { allowed: true },
    [versionId, bookId, chapterStart, chapterEnd, verseStart, verseEnd]
  );

  // Initial client hydration: URL Params > Local Session > User Saved Defaults > System Defaults
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      // 1. Parse URL query params (including any OAuth callback error)
      const searchParams = new URLSearchParams(window.location.search);
      const authError = searchParams.get("auth_error");
      if (authError) {
        if (authError === "missing_drive_scope") {
          setAuthNotice({
            title: "Google Drive Permission Required",
            message:
              "To create and format Google Docs, please sign in again and make sure the Google Drive permission box is checked on Google's consent screen.",
            showGrantButton: true,
          });
        } else if (authError === "access_denied") {
          setAuthNotice({
            title: "Google Sign-In Cancelled",
            message:
              "Sign-in was cancelled. Sign in with Google and grant Google Drive access whenever you're ready to create a document.",
            showGrantButton: true,
          });
        } else {
          setAuthNotice({
            title: "Sign-In Issue",
            message: `Google sign-in did not complete (${authError}). Please try signing in again.`,
            showGrantButton: true,
          });
        }

        // Remove auth_error from the address bar so refreshing doesn't re-display it
        searchParams.delete("auth_error");
        const remainingQuery = searchParams.toString();
        const cleanUrl = `${window.location.pathname}${
          remainingQuery ? `?${remainingQuery}` : ""
        }${window.location.hash}`;
        window.history.replaceState({}, "", cleanUrl);
      }

      const urlSettings = parseUrlSettings(window.location.search);

      // 2. Read saved defaults from localStorage
      const parsedSaved = readStorageJson<{
        version?: string;
        options?: Partial<FormatOptions>;
      }>(STORAGE_KEYS.USER_DEFAULTS);
      const localDefaults: { version: string; options: FormatOptions } =
        parsedSaved?.options
          ? {
              version: parsedSaved.version || SYSTEM_DEFAULT_VERSION,
              options: { ...SYSTEM_DEFAULT_OPTIONS, ...parsedSaved.options },
            }
          : {
              version: SYSTEM_DEFAULT_VERSION,
              options: { ...SYSTEM_DEFAULT_OPTIONS },
            };

      // 3. Read current session preferences from localStorage
      const parsedCurOpts = readStorageJson<Partial<FormatOptions>>(
        STORAGE_KEYS.CURRENT_OPTIONS
      );
      const localCurrentOptions: FormatOptions | null = parsedCurOpts
        ? { ...SYSTEM_DEFAULT_OPTIONS, ...parsedCurOpts }
        : null;

      const localPassage = readStorageJson<{
        bookId: string;
        chapterStart: number;
        chapterEnd: number;
        verseStart?: number;
        verseEnd?: number;
      }>(STORAGE_KEYS.LAST_PASSAGE);

      const localCurrentVersion = readStorageString(
        STORAGE_KEYS.CURRENT_VERSION
      );
      const localShowVerses =
        readStorageString(STORAGE_KEYS.SHOW_VERSES) === "1";

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

      const maxInitialStartV =
        getChapterVerseCount(initialBookId, initialStart, initialVersion) || 1;
      const maxInitialEndV =
        getChapterVerseCount(initialBookId, initialEnd, initialVersion) || 1;

      const hasUrlVerseParams =
        urlSettings.verseStart !== undefined ||
        urlSettings.verseEnd !== undefined;
      const initialShowVerses = hasUrlVerseParams ? true : localShowVerses;

      let initialVerseStart = 1;
      let initialVerseEnd = maxInitialEndV;

      if (urlSettings.hasUrlSettings) {
        initialVerseStart = urlSettings.verseStart
          ? Math.min(urlSettings.verseStart, maxInitialStartV)
          : 1;
        initialVerseEnd = urlSettings.verseEnd
          ? Math.min(urlSettings.verseEnd, maxInitialEndV)
          : maxInitialEndV;
      } else if (initialShowVerses && localPassage) {
        initialVerseStart = localPassage.verseStart
          ? Math.min(Math.max(1, localPassage.verseStart), maxInitialStartV)
          : 1;
        initialVerseEnd = localPassage.verseEnd
          ? Math.min(Math.max(1, localPassage.verseEnd), maxInitialEndV)
          : maxInitialEndV;
      }

      if (initialStart === initialEnd && initialVerseStart > initialVerseEnd) {
        initialVerseEnd = initialVerseStart;
      }

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
      setVerseStart(initialVerseStart);
      setVerseEnd(initialVerseEnd);
      setShowVerseSelector(initialShowVerses);
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

          // Fetch DB preferences & recent history for authenticated user
          const [prefRes, histRes] = await Promise.all([
            fetch("/api/user/preferences"),
            fetch("/api/user/history"),
          ]);
          const [prefData, histData] = await Promise.all([
            prefRes.json(),
            histRes.json(),
          ]);
          if (!isMounted) return;

          if (Array.isArray(histData.history)) {
            setUserHistory(histData.history);
          }

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
            writeStorageJson(STORAGE_KEYS.USER_DEFAULTS, mergedDefaults);

            // If no URL settings were present and no active session storage, restore passage from DB
            if (!urlSettings.hasUrlSettings && !localPassage && dbPref.lastBookId) {
              const restoredBook = dbPref.lastBookId;
              const restoredStart = dbPref.lastChapterStart || 1;
              const restoredEnd = dbPref.lastChapterEnd || restoredStart;
              setBookId(restoredBook);
              setChapterStart(restoredStart);
              setChapterEnd(restoredEnd);
              setVerseStart(1);
              setVerseEnd(
                getChapterVerseCount(
                  restoredBook,
                  restoredEnd,
                  mergedDefaults.version
                )
              );
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
    writeStorageJson(STORAGE_KEYS.CURRENT_OPTIONS, options);
  }, [options, isHydrated]);

  // Sync active Bible version to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    writeStorageString(STORAGE_KEYS.CURRENT_VERSION, versionId);
  }, [versionId, isHydrated]);

  // Sync active Scripture passage to localStorage & database
  useEffect(() => {
    if (!isHydrated) return;
    writeStorageJson(STORAGE_KEYS.LAST_PASSAGE, {
      bookId,
      chapterStart,
      chapterEnd,
      verseStart,
      verseEnd,
    });

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
  }, [bookId, chapterStart, chapterEnd, verseStart, verseEnd, isHydrated, user]);

  // Handle saving current formatting options as personal defaults
  const handleSaveDefaults = async () => {
    const newDefaults = {
      ...savedDefaults,
      options: { ...options },
    };
    setSavedDefaults(newDefaults);
    writeStorageJson(STORAGE_KEYS.USER_DEFAULTS, newDefaults);

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
    writeStorageJson(STORAGE_KEYS.CURRENT_OPTIONS, savedDefaults.options);
  };

  // Handle saving current Bible version as default
  const handleSaveDefaultVersion = async () => {
    const newDefaults = {
      ...savedDefaults,
      version: versionId,
    };
    setSavedDefaults(newDefaults);
    writeStorageJson(STORAGE_KEYS.USER_DEFAULTS, newDefaults);

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
    handleVersionChange(savedDefaults.version);
    writeStorageString(STORAGE_KEYS.CURRENT_VERSION, savedDefaults.version);
  };

  // Handle Bible version change (adjusting max verse if on a chapter with versification differences)
  const handleVersionChange = (newVersion: string) => {
    const oldMaxEnd = getChapterVerseCount(bookId, chapterEnd, versionId);
    const newMaxStart = getChapterVerseCount(bookId, chapterStart, newVersion);
    const newMaxEnd = getChapterVerseCount(bookId, chapterEnd, newVersion);
    setVersionId(newVersion);
    if (verseStart > newMaxStart) {
      setVerseStart(newMaxStart);
    }
    if (verseEnd === oldMaxEnd || verseEnd > newMaxEnd) {
      setVerseEnd(newMaxEnd);
    }
  };

  // Handle book selection change
  const handleBookChange = (newBookId: string) => {
    setBookId(newBookId);
    setChapterStart(1);
    setChapterEnd(1);
    setVerseStart(1);
    setVerseEnd(getChapterVerseCount(newBookId, 1, versionId));
  };

  // Handle whole book selection
  const handleSelectWholeBook = () => {
    const lastCh = chapters.length;
    setChapterStart(1);
    setChapterEnd(lastCh);
    setVerseStart(1);
    setVerseEnd(getChapterVerseCount(bookId, lastCh, versionId));
  };

  // Handle First Chapter change (resets First Verse to 1)
  const handleChapterStartChange = (val: number) => {
    setChapterStart(val);
    setVerseStart(1);
    if (val > chapterEnd) {
      setChapterEnd(val);
      setVerseEnd(getChapterVerseCount(bookId, val, versionId));
    }
  };

  // Handle Last Chapter change (resets Last Verse to last verse of that chapter)
  const handleChapterEndChange = (val: number) => {
    setChapterEnd(val);
    setVerseEnd(getChapterVerseCount(bookId, val, versionId));
    if (val < chapterStart) {
      setChapterStart(val);
      setVerseStart(1);
    }
  };

  // Handle First Verse change
  const handleVerseStartChange = (val: number) => {
    setVerseStart(val);
    if (chapterStart === chapterEnd && val > verseEnd) {
      setVerseEnd(val);
    }
  };

  // Handle Last Verse change
  const handleVerseEndChange = (val: number) => {
    setVerseEnd(val);
    if (chapterStart === chapterEnd && val < verseStart) {
      setVerseStart(val);
    }
  };

  // Handle selecting all verses in the selected chapter(s)
  const handleSelectWholeChapters = () => {
    setVerseStart(1);
    setVerseEnd(getChapterVerseCount(bookId, chapterEnd, versionId));
  };

  // Expand verse selection and remember setting
  const handleExpandVerses = () => {
    setShowVerseSelector(true);
    writeStorageString(STORAGE_KEYS.SHOW_VERSES, "1");
  };

  // Hide verse selection, remember setting, and reset verses to complete chapter(s)
  const handleHideVerses = () => {
    setShowVerseSelector(false);
    writeStorageString(STORAGE_KEYS.SHOW_VERSES, "0");
    setVerseStart(1);
    setVerseEnd(getChapterVerseCount(bookId, chapterEnd, versionId));
  };

  // Trigger Doc Creation
  const handleCreateDoc = async () => {
    if (!user) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/api/auth/google/login";
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setStatusMessage("Loading Scripture...");
    setErrorMsg(null);
    setErrorDetails(null);
    setShowErrorDetails(false);
    setAuthNotice(null);
    setCreatedDoc(null);

    const handleGenerationError = (payload: {
      needsAuth?: boolean;
      needsDriveScope?: boolean;
      error?: string;
      message?: string;
      details?: string;
    }) => {
      if (payload.needsDriveScope) {
        setAuthNotice({
          title: payload.error || "Google Drive Permission Required",
          message:
            payload.message ||
            "Your Google account hasn't granted permission to create documents in Google Drive. Please sign in again and check the Google Drive permission box on Google's consent screen.",
          showGrantButton: true,
        });
        setStatusMessage("");
        return;
      }
      if (payload.needsAuth) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/api/auth/google/login";
        return;
      }
      setErrorMsg(payload.message || payload.error || "Generation failed");
      if (payload.details) {
        setErrorDetails(payload.details);
      }
      setStatusMessage("");
    };

    // Hybrid loading feel: 3+ chapters shows immediately; 1-2 chapters waits 750ms to prevent visual flash
    const totalChapters = chapterEnd - chapterStart + 1;
    if (totalChapters >= 3) {
      setShowInFlightRow(true);
    } else {
      setShowInFlightRow(false);
      inFlightTimerRef.current = setTimeout(() => {
        setShowInFlightRow(true);
      }, 750);
    }

    try {
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isPartial = isPartialVerseSelection(
        bookId,
        chapterStart,
        chapterEnd,
        verseStart,
        verseEnd,
        versionId
      );
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          chapterStart,
          chapterEnd,
          verseStart,
          verseEnd,
          version: versionId,
          options,
          timeZone: userTimeZone,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        handleGenerationError(result);
        return;
      }

      // Read NDJSON streaming progress response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to read streaming response from server.");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let completedResult: {
        docId: string;
        docUrl: string;
        docName: string;
      } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (data.type === "progress") {
              if (typeof data.progress === "number") {
                setProgress(data.progress);
              }
              if (data.message) {
                setStatusMessage(data.message);
              }
            } else if (data.type === "complete") {
              completedResult = data;
            } else if (data.type === "error") {
              handleGenerationError(data);
              return;
            }
          } catch (parseErr) {
            console.warn("Failed to parse stream chunk:", trimmed, parseErr);
          }
        }
      }

      // Process any trailing line in buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          if (data.type === "complete") completedResult = data;
        } catch {}
      }

      if (!completedResult || !completedResult.docId) {
        throw new Error("Failed to receive completed document from server.");
      }

      const result = completedResult;
      setProgress(100);
      setStatusMessage("");
      const newDocSnapshot = {
        id: result.docId,
        url: result.docUrl,
        name: result.docName,
        versionAbbr: versionId,
        bookId,
        chapterStart,
        chapterEnd,
        ...(isPartial ? { verseStart, verseEnd } : {}),
        options: { ...options },
      };
      setCreatedDoc(newDocSnapshot);
      setUserHistory((prev) => [
        {
          docId: result.docId,
          docUrl: result.docUrl,
          docName: result.docName,
          versionAbbr: versionId,
          bookId,
          chapterStart,
          chapterEnd,
          ...(isPartial ? { verseStart, verseEnd } : {}),
          options: { ...options },
          createdAt: new Date().toISOString(),
        },
        ...prev.filter((item) => item.docId !== result.docId),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create document.";
      setErrorMsg(msg);
      setStatusMessage("");
    } finally {
      if (inFlightTimerRef.current) {
        clearTimeout(inFlightTimerRef.current);
        inFlightTimerRef.current = null;
      }
      setShowInFlightRow(false);
      setIsGenerating(false);
    }
  };

  // Copy shareable BSF URL for a generated or historical doc
  const handleCopyBsfLink = async (
    key: string,
    itemVersion: string,
    itemBookId: string,
    itemStart: number,
    itemEnd: number,
    itemVerseStart?: number,
    itemVerseEnd?: number,
    itemOptions?: Partial<FormatOptions> | null
  ) => {
    try {
      const url = buildShareableUrl({
        baseUrl: window.location.origin,
        versionId: itemVersion,
        bookId: itemBookId,
        chapterStart: itemStart,
        chapterEnd: itemEnd,
        verseStart: itemVerseStart,
        verseEnd: itemVerseEnd,
        options: itemOptions,
      });
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1600);
    } catch (e) {
      console.error("Failed to copy BSF link:", e);
    }
  };

  // Close history modal on Escape key
  useEffect(() => {
    if (!isHistoryModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsHistoryModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHistoryModalOpen]);

  // Toggle expanded state for a passage group's earlier runs
  const toggleGroupExpanded = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  // Move one or more documents to Google Drive Trash and remove from history
  const handleTrashDocs = async (actionKey: string, docIds: string[]) => {
    const validIds = docIds.filter(Boolean);
    if (validIds.length === 0) return;

    setTrashingKeys((prev) => ({ ...prev, [actionKey]: true }));
    try {
      const res = await fetch("/api/user/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docIds: validIds }),
      });
      if (res.ok) {
        const trashedSet = new Set(validIds);
        setUserHistory((prev) =>
          prev.filter((item) => !item.docId || !trashedSet.has(item.docId))
        );
        if (createdDoc && trashedSet.has(createdDoc.id)) {
          setCreatedDoc(null);
        }
      }
    } catch (e) {
      console.error("Failed to move doc(s) to Google Drive trash:", e);
    } finally {
      setTrashingKeys((prev) => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
    }
  };

  // Group history by passage + version so trial runs collapse under the latest doc
  const groupedRecentDocs = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        groupKey: string;
        latest: DocHistoryItem;
        earlier: DocHistoryItem[];
      }
    >();

    for (const item of userHistory) {
      const key = getPassageGroupKey(item);
      const existing = groupsMap.get(key);
      if (!existing) {
        groupsMap.set(key, {
          groupKey: key,
          latest: item,
          earlier: [],
        });
      } else {
        existing.earlier.push(item);
      }
    }

    return Array.from(groupsMap.values()).slice(0, 5);
  }, [userHistory]);

  // Set of docIds that represent the latest run of each passage (older runs have bracketed timestamps in Drive)
  const latestDocIdByPassage = useMemo(() => {
    const seenPassages = new Set<string>();
    const latestDocIds = new Set<string>();
    const latestOptionsByPassage = new Map<string, Partial<FormatOptions> | null | undefined>();

    for (const item of userHistory) {
      const key = getPassageGroupKey(item);
      if (!seenPassages.has(key)) {
        seenPassages.add(key);
        if (item.docId) latestDocIds.add(item.docId);
        latestOptionsByPassage.set(key, item.options);
      }
    }

    return { latestDocIds, latestOptionsByPassage };
  }, [userHistory]);

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
              historyCount={userHistory.length}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
              onLogout={async () => {
                await fetch("/api/auth/google/logout", { method: "POST" });
                setUser(null);
                setIsAdmin(false);
                setUserHistory([]);
                setCreatedDoc(null);
              }}
            />
          ) : (
            <a href="/api/auth/google/login" className="btn-google">
              <GoogleLogo size={16} /> Sign in with Google
            </a>
          )}
        </div>
      </header>

      {/* OAuth / Drive Scope Notice Banner */}
      {authNotice && (
        <div className="glass-panel auth-notice-banner" role="alert">
          <div className="auth-notice-content">
            <AlertCircle size={20} className="auth-notice-icon" />
            <div>
              <div className="auth-notice-title">{authNotice.title}</div>
              <p className="auth-notice-message">{authNotice.message}</p>
            </div>
          </div>
          <div className="auth-notice-actions">
            {authNotice.showGrantButton && (
              <a href="/api/auth/google/login" className="btn-google">
                <GoogleLogo size={16} /> Grant Google Drive Access
              </a>
            )}
            <button
              type="button"
              className="auth-notice-dismiss"
              onClick={() => setAuthNotice(null)}
              aria-label="Dismiss notice"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

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
                onChange={(e) => handleVersionChange(e.target.value)}
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
                  {OT_BOOKS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.numChapters} chapters)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="New Testament">
                  {NT_BOOKS.map((b) => (
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

            {/* Verse Selection (Collapsed Summary or Expanded First/Last Verse Dropdowns) */}
            {!showVerseSelector ? (
              <div className="verse-summary-row full-width">
                <span className="verse-summary-text">
                  {chapterStart === chapterEnd
                    ? `Entire chapter (${totalSelectedVerses} ${
                        totalSelectedVerses === 1 ? "verse" : "verses"
                      })`
                    : `Entire chapters (${totalSelectedVerses} verses)`}
                </span>
                <span className="verse-summary-dot" aria-hidden="true">
                  •
                </span>
                <button
                  type="button"
                  onClick={handleExpandVerses}
                  className="btn-link"
                >
                  Select verses
                </button>
              </div>
            ) : (
              <>
                {/* Verse Start */}
                <div className="field-group">
                  <div className="field-header-row">
                    <label className="field-label">First Verse</label>
                    <button
                      type="button"
                      onClick={handleHideVerses}
                      className="btn-link"
                    >
                      Hide verses
                    </button>
                  </div>
                  <select
                    className="field-select"
                    value={verseStart}
                    onChange={(e) =>
                      handleVerseStartChange(Number(e.target.value))
                    }
                  >
                    {startChapterVerses.map((v) => (
                      <option key={v} value={v}>
                        Verse {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Verse End */}
                <div className="field-group">
                  <div className="field-header-row">
                    <label className="field-label">Last Verse</label>
                    <button
                      type="button"
                      onClick={handleSelectWholeChapters}
                      className="btn-link"
                    >
                      {chapterStart === chapterEnd
                        ? "Select entire chapter"
                        : "Select entire chapters"}
                    </button>
                  </div>
                  <select
                    className="field-select"
                    value={verseEnd}
                    onChange={(e) =>
                      handleVerseEndChange(Number(e.target.value))
                    }
                  >
                    {endChapterVerses.map((v) => (
                      <option key={v} value={v}>
                        Verse {v}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

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
              <Settings2 size={18} color="var(--primary)" /> 2. Formatting options
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
              <span>Chapter headers</span>
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
              <span>Chapter page breaks</span>
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
              <span>Verse numbers</span>
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
              <span>Section headings</span>
              <input
                type="checkbox"
                className="switch-input"
                checked={Boolean(options.sectionHeadings)}
                onChange={(e) =>
                  setOptions({ ...options, sectionHeadings: e.target.checked })
                }
              />
            </label>

            <label className="switch-label">
              <span>Title page</span>
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
                {SUPPORTED_FONT_FAMILIES.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
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

            <div className="field-group">
              <label className="field-label">Line Spacing</label>
              <select
                className="field-select"
                value={options.lineSpacing}
                onChange={(e) =>
                  setOptions({ ...options, lineSpacing: Number(e.target.value) })
                }
              >
                <option value={1.0}>1.0 (Single)</option>
                <option value={1.15}>1.15 (Standard)</option>
                <option value={1.5}>1.5 (Expanded)</option>
                <option value={2.0}>2.0 (Double)</option>
              </select>
            </div>

            <div className="field-group">
              <label className="field-label">Page Margins</label>
              <select
                className="field-select"
                value={options.pageMargins ?? 1.0}
                onChange={(e) =>
                  setOptions({ ...options, pageMargins: Number(e.target.value) })
                }
              >
                <option value={0.5}>0.5&quot; (Narrow)</option>
                <option value={0.75}>0.75&quot; (Moderate)</option>
                <option value={1.0}>1.0&quot; (Standard)</option>
                <option value={1.25}>1.25&quot; (Wide)</option>
                <option value={1.5}>1.5&quot; (Extra wide)</option>
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
              ? "Exceeds ESV guidelines (adjust range)"
              : user
              ? "Create formatted Google Doc"
              : "Sign in with Google & create doc"}
          </button>
        </div>

        {/* Right Column: Preview & Recent Docs */}
        <div className="preview-column">
          {/* Card 1: Live Document Preview */}
          <div className="glass-panel preview-panel">
            <div>
              <h2 className="section-title">
                <FileText size={18} color="var(--primary)" /> Live document preview
              </h2>
              <p className="preview-subtitle">
                Simulating formatting for <strong>John 1-3</strong>
              </p>
            </div>

          {/* Simulated Google Doc Paper */}
          <div
            className="doc-sheet"
            style={{
              fontFamily: FONT_FAMILY_MAP[options.fontName] || options.fontName,
              fontSize: `${options.fontSize}pt`,
              lineHeight: options.lineSpacing,
              padding: `${(options.pageMargins ?? 1) * 2.25}rem`,
            }}
          >
            {/* Title Page Simulation */}
            {options.titlePage && (
              <div className="doc-title-page-preview">
                <h2>John 1-3</h2>
                <p>
                  {versionId} • {getVersionName(versionId)}
                </p>
              </div>
            )}

            {/* Chapter Header Simulation */}
            {options.chapterHeaders && (
              <div className="doc-heading-preview">John 1</div>
            )}

            {/* Section Heading Simulation */}
            {options.sectionHeadings && (
              <div className="doc-heading-preview">The Word Became Flesh</div>
            )}

            {/* Sample Scripture Prose */}
            <p>
              {options.verseNumbers && (
                <>
                  <span className="doc-verse-num">1</span>
                  {"\u00A0"}
                </>
              )}
              In the beginning was the Word, and the Word was with God, and the
              Word was God.{" "}
              {options.verseNumbers && (
                <>
                  <span className="doc-verse-num">2</span>
                  {"\u00A0"}
                </>
              )}
              He was in the beginning with God.{" "}
              {options.verseNumbers && (
                <>
                  <span className="doc-verse-num">3</span>
                  {"\u00A0"}
                </>
              )}
              All things were made through him, and without him was not any
              thing made that was made.
            </p>

            {/* Sample Poetry Indent */}
            <p className="doc-poetry-indent">
              {options.verseNumbers && (
                <>
                  <span className="doc-verse-num">5</span>
                  {"\u00A0"}
                </>
              )}
              The light shines in the darkness,
              <br />
              <span className="poetry-line-2">
                and the darkness has not overcome it.
              </span>
            </p>
          </div>

          </div>

          {/* Card 2: Recent Google Docs */}
          {(groupedRecentDocs.length > 0 || showInFlightRow || errorMsg) && (
            <div className="glass-panel recent-docs-panel">
              <div className="recent-docs-header">
                <h2 className="section-title recent-docs-title">
                  <History size={18} color="var(--primary)" />
                  <span>Recent Google Docs</span>
                  {groupedRecentDocs.length > 0 && (
                    <span className="recent-docs-subtitle">(last 5)</span>
                  )}
                </h2>
                {userHistory.length > 0 && (
                  <button
                    type="button"
                    className="recent-docs-view-all"
                    onClick={() => setIsHistoryModalOpen(true)}
                  >
                    View all ({userHistory.length}) →
                  </button>
                )}
              </div>

              {errorMsg && (
                <div className="status-error" style={{ margin: "0.25rem 0 0.5rem 0" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", width: "100%" }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ flex: 1 }}>
                      <div>{errorMsg}</div>
                      {errorDetails && (
                        <div style={{ marginTop: "0.35rem" }}>
                          <button
                            type="button"
                            onClick={() => setShowErrorDetails((prev) => !prev)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "inherit",
                              textDecoration: "underline",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: "0.82rem",
                              opacity: 0.9,
                            }}
                          >
                            {showErrorDetails ? "Hide details" : "More details"}
                          </button>
                          {showErrorDetails && (
                            <p
                              style={{
                                marginTop: "0.35rem",
                                fontSize: "0.82rem",
                                opacity: 0.85,
                                lineHeight: 1.45,
                              }}
                            >
                              {errorDetails}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(showInFlightRow || groupedRecentDocs.length > 0) && (
                <div className="recent-docs-list">
                  {/* In-Flight Active Generation Placeholder */}
                  {showInFlightRow && (
                    <div className="doc-history-group in-flight-group">
                      <div className="doc-history-row in-flight-row">
                        <div className="doc-history-info" style={{ width: "100%" }}>
                          <div className="doc-history-title-row">
                            <span className="doc-in-flight-title">
                              {inFlightTitle}
                            </span>
                            <span className="doc-generating-badge">
                              <RefreshCw size={12} className="spin" /> Generating...
                            </span>
                          </div>
                          {statusMessage && (
                            <div className="doc-in-flight-status">
                              {statusMessage}
                            </div>
                          )}
                          <div className="progress-track" style={{ margin: "0.45rem 0 0.15rem 0" }}>
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${Math.max(progress, 5)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                {groupedRecentDocs.map((group, idx) => {
                  const item = group.latest;
                  const isJustCreated =
                    createdDoc !== null && item.docId === createdDoc.id;
                  const rowKey = `recent-${item.docId || item.id || idx}`;
                  const isExpanded = Boolean(expandedGroups[group.groupKey]);
                  const earlierDocIds = group.earlier
                    .map((e) => e.docId)
                    .filter((id): id is string => Boolean(id));

                  return (
                    <div key={group.groupKey} className="doc-history-group">
                      <div
                        className={`doc-history-row ${
                          isJustCreated ? "just-created" : ""
                        }`}
                      >
                        <div className="doc-history-info">
                          <div className="doc-history-title-row">
                            {item.docUrl ? (
                              <a
                                href={item.docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="doc-history-link"
                              >
                                {item.docName} <ExternalLink size={13} />
                              </a>
                            ) : (
                              <span className="doc-history-link">{item.docName}</span>
                            )}
                            {isJustCreated && (
                              <span className="doc-just-created-badge">
                                Just created
                              </span>
                            )}
                          </div>
                          <div className="doc-history-meta-row">
                            <span className="doc-history-meta">
                              {isJustCreated
                                ? "Saved in Google Drive"
                                : formatRelativeDocDate(item.createdAt)}
                            </span>
                            {group.earlier.length > 0 && (
                              <button
                                type="button"
                                className="btn-earlier-toggle"
                                onClick={() => toggleGroupExpanded(group.groupKey)}
                              >
                                • {group.earlier.length} earlier{" "}
                                {isExpanded ? (
                                  <ChevronUp size={12} />
                                ) : (
                                  <ChevronDown size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <DocHistoryRowActions
                          rowKey={rowKey}
                          item={item}
                          copiedKey={copiedKey}
                          isTrashing={Boolean(trashingKeys[rowKey])}
                          onCopyLink={handleCopyBsfLink}
                          onTrash={handleTrashDocs}
                        />
                      </div>

                      {isExpanded && group.earlier.length > 0 && (
                        <div className="earlier-runs-container">
                          {earlierDocIds.length > 1 && (
                            <div className="earlier-runs-toolbar">
                              <span className="doc-history-meta">
                                Earlier versions in Google Drive
                              </span>
                              <button
                                type="button"
                                className="btn-trash-all-earlier"
                                disabled={Boolean(
                                  trashingKeys[`all-${group.groupKey}`]
                                )}
                                onClick={() =>
                                  handleTrashDocs(
                                    `all-${group.groupKey}`,
                                    earlierDocIds
                                  )
                                }
                                title="Move all earlier versions of this passage to Google Drive trash"
                              >
                                <Trash2 size={12} />
                                {trashingKeys[`all-${group.groupKey}`]
                                  ? "Moving to trash..."
                                  : `Trash all ${earlierDocIds.length} earlier`}
                              </button>
                            </div>
                          )}

                          {group.earlier.map((earlierItem, eIdx) => {
                            const earlierKey = `earlier-${
                              earlierItem.docId || earlierItem.id || eIdx
                            }`;
                            const timestampLabel = formatDocTimestamp(
                              earlierItem.createdAt
                            );
                            const diffText = describeOptionsDiff(
                              earlierItem.options,
                              item.options
                            );

                            return (
                              <div
                                key={earlierKey}
                                className="doc-history-row earlier-run-row"
                              >
                                <div className="doc-history-info">
                                  <div className="doc-history-title-row">
                                    {earlierItem.docUrl ? (
                                      <a
                                        href={earlierItem.docUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="doc-history-link earlier-link"
                                      >
                                        {timestampLabel} <ExternalLink size={12} />
                                      </a>
                                    ) : (
                                      <span className="doc-history-link earlier-link">
                                        {timestampLabel}
                                      </span>
                                    )}
                                  </div>
                                  {diffText && (
                                    <div className="doc-history-diff">
                                      {diffText}
                                    </div>
                                  )}
                                </div>

                                <DocHistoryRowActions
                                  rowKey={earlierKey}
                                  item={earlierItem}
                                  copiedKey={copiedKey}
                                  isTrashing={Boolean(trashingKeys[earlierKey])}
                                  onCopyLink={handleCopyBsfLink}
                                  onTrash={handleTrashDocs}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Document History Modal */}
      {isHistoryModalOpen && (
        <div
          className="history-modal-backdrop"
          onClick={() => setIsHistoryModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
        >
          <div
            className="history-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="history-modal-header">
              <h3 id="history-modal-title" className="history-modal-title">
                Your Document History ({userHistory.length})
              </h3>
              <button
                type="button"
                className="history-modal-close"
                onClick={() => setIsHistoryModalOpen(false)}
              >
                <X size={14} /> Close
              </button>
            </div>
            <div className="history-modal-body">
              {userHistory.length === 0 ? (
                <div className="doc-history-meta" style={{ padding: "1rem 0", textAlign: "center" }}>
                  No documents generated yet.
                </div>
              ) : (
                userHistory.map((item, idx) => {
                  const modalKey = `modal-${item.docId || item.id || idx}`;
                  const passageKey = getPassageGroupKey(item);
                  const isLatestForPassage =
                    item.docId !== null &&
                    latestDocIdByPassage.latestDocIds.has(item.docId);
                  const diffText = !isLatestForPassage
                    ? describeOptionsDiff(
                        item.options,
                        latestDocIdByPassage.latestOptionsByPassage.get(passageKey)
                      )
                    : null;
                  const metaLine = isLatestForPassage
                    ? formatRelativeDocDate(item.createdAt)
                    : `${formatDocTimestamp(item.createdAt)}${
                        diffText ? ` • ${diffText}` : ""
                      }`;

                  return (
                    <div key={modalKey} className="doc-history-row">
                      <div className="doc-history-info">
                        <div className="doc-history-title-row">
                          {item.docUrl ? (
                            <a
                              href={item.docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="doc-history-link"
                            >
                              {item.docName} <ExternalLink size={13} />
                            </a>
                          ) : (
                            <span className="doc-history-link">{item.docName}</span>
                          )}
                        </div>
                        <div className="doc-history-meta">{metaLine}</div>
                      </div>
                      <DocHistoryRowActions
                        rowKey={modalKey}
                        item={item}
                        copiedKey={copiedKey}
                        isTrashing={Boolean(trashingKeys[modalKey])}
                        onCopyLink={handleCopyBsfLink}
                        onTrash={handleTrashDocs}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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
          Developed by{" "}
          <a
            href="https://www.gideonsoftware.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Gideon Software Solutions
          </a>
          {" • "}
          <a href="/privacy">Privacy Policy</a>
          {" • "}
          <a href="/terms">Terms of Service</a>
          {" • "}
          <a href="mailto:gideonsoftwaresolutions@gmail.com?subject=Bible%20Study%20Formatter%20Issue%20Report">
            Report an issue
          </a>
        </p>
      </footer>
    </div>
  );
}
