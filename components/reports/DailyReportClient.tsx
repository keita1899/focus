"use client";

import {
  KeyboardEvent,
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ChecklistItem,
  MarkdownPreview,
  normalizeOrderedListAfterDeletion,
  normalizeOrderedListAt,
} from "../MarkdownMemoClient";

type DailyReport = {
  id: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

type DailyReportsState = {
  reports: DailyReport[];
  deletedReports: DailyReport[];
};

type DailyReportClientProps = {
  initialValue: unknown;
};

type ReportViewMode = "editor" | "preview" | "split";

type ViewModeOption = {
  mode: ReportViewMode;
  label: string;
  icon: ReactElement;
};

const storageKey = "daily-report-v1";
const viewModeStorageKey = "daily-report-view-mode-v1";
const activeReportStorageKey = "daily-report-active-id-v1";

function getTodayReportTitle() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultMarkdown(title = getTodayReportTitle()) {
  return `# ${title} 日報

## やったこと
- 

## 学び・課題
- 
`;
}

const viewModeOptions: ViewModeOption[] = [
  {
    mode: "editor",
    label: "フォーム",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path
          d="M5 6.75A1.75 1.75 0 0 1 6.75 5h10.5A1.75 1.75 0 0 1 19 6.75v10.5A1.75 1.75 0 0 1 17.25 19H6.75A1.75 1.75 0 0 1 5 17.25z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8 9.25h8M8 12h8M8 14.75h5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
  {
    mode: "preview",
    label: "プレビュー",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path
          d="M3.75 12s3.25-5.25 8.25-5.25S20.25 12 20.25 12s-3.25 5.25-8.25 5.25S3.75 12 3.75 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle
          cx="12"
          cy="12"
          r="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
  {
    mode: "split",
    label: "両方",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <rect
          x="4.5"
          y="5"
          width="15"
          height="14"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M12 5v14M7.75 9.25h1.75M7.75 12h1.75M7.75 14.75h1.75"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
];

function createReportId() {
  return `daily-report-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createReport(title = getTodayReportTitle()): DailyReport {
  return {
    id: createReportId(),
    title,
    markdown: getDefaultMarkdown(title),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeDailyReportsState(value: unknown): DailyReportsState {
  if (typeof value === "string") {
    try {
      return normalizeDailyReportsState(JSON.parse(value) as unknown);
    } catch {
      return { reports: [createReport()], deletedReports: [] };
    }
  }

  const source =
    value && typeof value === "object"
      ? (value as Partial<DailyReportsState>)
      : { reports: [createReport()] };

  const rawReports = Array.isArray(source.reports) ? source.reports : [createReport()];
  const reports = rawReports
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const report = item as Partial<DailyReport>;
      const title =
        typeof report.title === "string" && report.title.trim()
          ? report.title
          : getTodayReportTitle();
      return {
        id: typeof report.id === "string" && report.id ? report.id : `daily-report-${index + 1}`,
        title,
        markdown:
          typeof report.markdown === "string" ? report.markdown : getDefaultMarkdown(title),
        updatedAt:
          typeof report.updatedAt === "string"
            ? report.updatedAt
            : new Date().toISOString(),
      };
    })
    .filter((report): report is DailyReport => Boolean(report));

  const rawDeletedReports = Array.isArray(source.deletedReports) ? source.deletedReports : [];
  const deletedReports = rawDeletedReports
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const report = item as Partial<DailyReport>;
      const title = typeof report.title === "string" && report.title.trim() ? report.title : getTodayReportTitle();
      return {
        id: typeof report.id === "string" && report.id ? report.id : `deleted-daily-report-${index + 1}`,
        title,
        markdown: typeof report.markdown === "string" ? report.markdown : getDefaultMarkdown(title),
        updatedAt: typeof report.updatedAt === "string" ? report.updatedAt : new Date().toISOString(),
      };
    })
    .filter((report): report is DailyReport => Boolean(report));

  return {
    reports: Array.isArray(source.reports) ? reports : reports.length > 0 ? reports : [createReport()],
    deletedReports,
  };
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sortReportsByUpdatedAtDesc(items: DailyReport[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.updatedAt).getTime();
    const rightTime = new Date(right.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

export default function DailyReportClient({
  initialValue,
}: DailyReportClientProps) {
  const initialReportsState = useMemo(
    () => normalizeDailyReportsState(initialValue),
    [initialValue],
  );
  const [reports, setReports] = useState<DailyReport[]>(
    () => initialReportsState.reports,
  );
  const [deletedReports, setDeletedReports] = useState<DailyReport[]>(
    () => initialReportsState.deletedReports,
  );
  const [isTrashView, setIsTrashView] = useState(false);
  const [activeReportId, setActiveReportId] = useState(() => reports[0]?.id || "");
  const [isReady, setIsReady] = useState(initialValue !== null);
  const [viewMode, setViewMode] = useState<ReportViewMode>("split");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const visibleReports = useMemo(
    () => sortReportsByUpdatedAtDesc(isTrashView ? deletedReports : reports),
    [deletedReports, isTrashView, reports],
  );

  const activeReport = useMemo(
    () => visibleReports.find((report) => report.id === activeReportId) || visibleReports[0] || null,
    [activeReportId, visibleReports],
  );

  useEffect(() => {
    try {
      const storedMode = window.localStorage.getItem(viewModeStorageKey);
      if (
        storedMode === "editor" ||
        storedMode === "preview" ||
        storedMode === "split"
      ) {
        setViewMode(storedMode);
      }

      const storedActiveId = window.localStorage.getItem(activeReportStorageKey);
      if (storedActiveId) {
        setActiveReportId(storedActiveId);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(viewModeStorageKey, viewMode);
      window.localStorage.setItem(activeReportStorageKey, activeReportId);
    } catch {
      return;
    }
  }, [activeReportId, viewMode]);

  useEffect(() => {
    if (initialValue !== null) return;

    async function loadReports() {
      try {
        const response = await fetch("/api/daily-report", { cache: "no-store" });
        const data = (await response.json()) as { value: unknown };
        if (data.value) {
          const loadedState = normalizeDailyReportsState(data.value);
          setReports(loadedState.reports);
          setDeletedReports(loadedState.deletedReports);
          setActiveReportId(loadedState.reports[0]?.id || "");
          return;
        }

        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;

        const loadedState = normalizeDailyReportsState(JSON.parse(stored));
        setReports(loadedState.reports);
        setDeletedReports(loadedState.deletedReports);
        setActiveReportId(loadedState.reports[0]?.id || "");
        await fetch("/api/daily-report", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loadedState),
        });
        window.localStorage.removeItem(storageKey);
      } catch {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        try {
          const loadedState = normalizeDailyReportsState(JSON.parse(stored));
          setReports(loadedState.reports);
          setDeletedReports(loadedState.deletedReports);
          setActiveReportId(loadedState.reports[0]?.id || "");
        } catch {
          setReports([createReport()]);
        }
      }
    }

    loadReports().finally(() => setIsReady(true));
  }, [initialValue]);

  useEffect(() => {
    if (!isReady) return;

    fetch("/api/daily-report", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports, deletedReports }),
    }).catch(() => undefined);
  }, [deletedReports, isReady, reports]);

  function resizeMemoTextarea(
    textarea: HTMLTextAreaElement | null,
    preserveScroll = false,
  ) {
    if (!textarea) return;
    const scrollY = window.scrollY;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (preserveScroll) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY });
      });
    }
  }

  useEffect(() => {
    document
      .querySelectorAll<HTMLTextAreaElement>(".notesEditorGrid textarea")
      .forEach((textarea) => resizeMemoTextarea(textarea));
  }, [reports]);

  useEffect(() => {
    if (!activeReportId || activeReport) return;
    const fallbackReport = visibleReports[0] || reports[0] || null;
    if (!fallbackReport) return;
    setActiveReportId(fallbackReport.id);
  }, [activeReport, activeReportId, reports, visibleReports]);

  function updateActiveReport(
    value: Partial<Pick<DailyReport, "title" | "markdown">>,
  ) {
    if (!activeReport) return;

    const nextUpdatedAt = new Date().toISOString();

    setReports((current) =>
      sortReportsByUpdatedAtDesc(
        current.map((report) =>
          report.id === activeReport.id
            ? { ...report, ...value, updatedAt: nextUpdatedAt }
            : report,
        ),
      ),
    );
  }

  function handleMarkdownKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!activeReport || event.nativeEvent.isComposing) return;
    const markdown = activeReport.markdown;
    const textarea = event.currentTarget;
    const cursorStart = textarea.selectionStart;
    const cursorEnd = textarea.selectionEnd;
    const lineStart = markdown.lastIndexOf("\n", cursorStart - 1) + 1;
    const lineEndIndex = markdown.indexOf("\n", cursorStart);
    const lineEnd = lineEndIndex === -1 ? markdown.length : lineEndIndex;
    const currentLine = markdown.slice(lineStart, cursorStart);

    if (event.key === "Tab") {
      event.preventDefault();
      const selectionStartLine = markdown.lastIndexOf("\n", cursorStart - 1) + 1;
      const selectionEndLineEndIndex = markdown.indexOf("\n", cursorEnd);
      const selectionEndLineEnd =
        selectionEndLineEndIndex === -1 ? markdown.length : selectionEndLineEndIndex;
      const selectedBlock = markdown.slice(selectionStartLine, selectionEndLineEnd);
      const lines = selectedBlock.split("\n");
      const shouldHandleBlock = cursorStart !== cursorEnd || lines.length > 1;

      if (shouldHandleBlock) {
        const updatedLines = lines.map((line) =>
          event.shiftKey ? line.replace(/^ {1,4}/, "") : `    ${line}`,
        );
        const nextBlock = updatedLines.join("\n");
        let nextMarkdown =
          markdown.slice(0, selectionStartLine) +
          nextBlock +
          markdown.slice(selectionEndLineEnd);
        nextMarkdown = normalizeOrderedListAt(nextMarkdown, selectionStartLine);
        const cursorDelta = nextBlock.length - selectedBlock.length;
        updateActiveReport({ markdown: nextMarkdown });
        requestAnimationFrame(() => {
          textarea.setSelectionRange(
            Math.max(selectionStartLine, cursorStart + (event.shiftKey ? 0 : 4)),
            Math.max(selectionStartLine, cursorEnd + cursorDelta),
          );
        });
        return;
      }

      if (event.shiftKey) {
        const line = markdown.slice(lineStart, lineEnd);
        const nextLine = line.replace(/^ {1,4}/, "");
        const removed = line.length - nextLine.length;
        if (removed === 0) return;
        let nextMarkdown =
          markdown.slice(0, lineStart) + nextLine + markdown.slice(lineEnd);
        nextMarkdown = normalizeOrderedListAt(nextMarkdown, lineStart);
        const nextCursor = Math.max(lineStart, cursorStart - removed);
        updateActiveReport({ markdown: nextMarkdown });
        requestAnimationFrame(() => {
          textarea.setSelectionRange(nextCursor, nextCursor);
        });
        return;
      }

      const insertion = "    ";
      let nextMarkdown =
        markdown.slice(0, lineStart) +
        insertion +
        markdown.slice(lineStart);
      const nextCursor = cursorStart + insertion.length;
      nextMarkdown = normalizeOrderedListAt(nextMarkdown, nextCursor);
      updateActiveReport({ markdown: nextMarkdown });
      requestAnimationFrame(() => {
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }

    if (event.key !== "Enter") return;

    const emptyListMatch = currentLine.match(
      /^(\s*)([-*+]|\d+\.|[-*+]\s+\[(?: |x|X)\])\s*$/,
    );

    if (emptyListMatch) {
      event.preventDefault();
      const isEmptyOrderedListItem = /^\s*\d+\.\s*$/.test(currentLine);
      const removalEnd =
        isEmptyOrderedListItem && markdown[cursorEnd] === "\n"
          ? cursorEnd + 1
          : cursorEnd;
      let nextMarkdown =
        markdown.slice(0, lineStart) + markdown.slice(removalEnd);
      if (isEmptyOrderedListItem) {
        nextMarkdown = normalizeOrderedListAt(nextMarkdown, lineStart);
      }
      updateActiveReport({ markdown: nextMarkdown });
      requestAnimationFrame(() => {
        textarea.setSelectionRange(lineStart, lineStart);
      });
      return;
    }

    const checklistMatch = currentLine.match(/^(\s*)[-*+]\s+\[( |x|X)\]\s+.+$/);
    const unorderedMatch = currentLine.match(/^(\s*)([-*+])\s+.+$/);
    const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+.+$/);
    let nextPrefix = "";

    if (checklistMatch) {
      nextPrefix = `${checklistMatch[1]}- [ ] `;
    } else if (orderedMatch) {
      nextPrefix = `${orderedMatch[1]}${Number(orderedMatch[2]) + 1}. `;
    } else if (unorderedMatch) {
      nextPrefix = `${unorderedMatch[1]}${unorderedMatch[2]} `;
    } else {
      return;
    }

    event.preventDefault();
    const insertion = `\n${nextPrefix}`;
    let nextMarkdown =
      markdown.slice(0, cursorStart) + insertion + markdown.slice(cursorEnd);
    const nextCursor = cursorStart + insertion.length;
    if (orderedMatch) {
      nextMarkdown = normalizeOrderedListAt(nextMarkdown, nextCursor);
    }
    updateActiveReport({ markdown: nextMarkdown });
    requestAnimationFrame(() => {
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function toggleChecklist(item: ChecklistItem) {
    if (!activeReport || item.lineNumber < 1) return;

    const lineNumbers = new Set<number>();

    function collectLineNumbers(target: ChecklistItem) {
      lineNumbers.add(target.lineNumber);
      target.children.forEach(collectLineNumbers);
    }

    collectLineNumbers(item);
    const nextChecked = !item.checked;

    updateActiveReport({
      markdown: activeReport.markdown
        .split("\n")
        .map((line, index) => {
          if (!lineNumbers.has(index + 1)) return line;
          if (!/^\s*[-*+]\s+\[( |x|X)\]\s+/.test(line)) return line;
          return line.replace(
            /^(\s*[-*+]\s+\[)( |x|X)(\]\s+)/,
            (_match, start: string, _marker: string, end: string) =>
              `${start}${nextChecked ? "x" : " "}${end}`,
          );
        })
        .join("\n"),
    });
  }

  function addReport() {
    const todayTitle = getTodayReportTitle();
    const existing = reports.find((report) => report.title === todayTitle) || null;
    if (existing) {
      setActiveReportId(existing.id);
      return;
    }

    const report = createReport(todayTitle);
    setReports((current) => [report, ...current]);
    setActiveReportId(report.id);
  }

  function deleteReport(reportId: string) {
    setReports((current) => {
      const deletedReport = current.find((report) => report.id === reportId);
      const nextReports = current.filter((report) => report.id !== reportId);
      if (deletedReport) setDeletedReports((deleted) => [deletedReport, ...deleted]);

      if (activeReportId === reportId) {
        setActiveReportId(nextReports[0]?.id || "");
      }

      return nextReports;
    });
  }

  function restoreReport(reportId: string) {
    const report = deletedReports.find((item) => item.id === reportId);
    if (!report) return;
    setDeletedReports((current) => current.filter((item) => item.id !== reportId));
    setReports((current) => [report, ...current]);
    setIsTrashView(false);
    setActiveReportId(report.id);
  }

  function permanentlyDeleteReport(reportId: string) {
    setDeletedReports((current) => current.filter((report) => report.id !== reportId));
    if (activeReportId === reportId) setActiveReportId("");
  }

  function emptyTrash() {
    setDeletedReports([]);
    setActiveReportId("");
  }

  return (
    <main className="shell notesPage dailyReportPage">
      <section className="notesHeader" aria-label="日報">
        <div>
          <h1>日報</h1>
        </div>
      </section>

      <section className="notesWorkspace dailyReportWorkspace" aria-label="日報一覧と編集">
        <aside className="notesListColumn dailyReportListColumn" aria-label="日報一覧">
          <div className="notesColumnHeader">
            <h2>日報</h2>
          </div>
          <div className="notesListHeader">
            {isTrashView ? (
              <button className="notesAddButton" type="button" onClick={emptyTrash} disabled={deletedReports.length === 0}>すべて削除</button>
            ) : (
              <button className="notesAddButton" type="button" onClick={addReport}>新規作成</button>
            )}
            <button className="notesTrashButton" type="button" onClick={() => setIsTrashView((current) => !current)} aria-pressed={isTrashView}>
              {isTrashView ? "日報一覧" : `ゴミ箱${deletedReports.length ? ` (${deletedReports.length})` : ""}`}
            </button>
          </div>
          <section className="notesListPanel" aria-label={isTrashView ? "日報のゴミ箱" : "日報"}>
            {visibleReports.length === 0 ? (
              <p className="emptyText compact">{isTrashView ? "ゴミ箱は空です。" : "日報がありません。"}</p>
            ) : (
              visibleReports.map((report) => (
                <div
                  className={
                    report.id === activeReport?.id
                      ? "notesListItem active"
                      : "notesListItem"
                  }
                  key={report.id}
                >
                  <button type="button" onClick={() => !isTrashView && setActiveReportId(report.id)}>
                    <strong>{report.title || "無題の日報"}</strong>
                    <span>{formatUpdatedAt(report.updatedAt)}</span>
                  </button>
                  {isTrashView ? (
                    <span className="dailyReportTrashActions">
                      <button type="button" onClick={() => restoreReport(report.id)}>復元</button>
                      <button className="notesListDelete" type="button" onClick={() => permanentlyDeleteReport(report.id)} aria-label={`${report.title || "日報"}を完全に削除`} title="完全に削除">×</button>
                    </span>
                  ) : (
                    <button className="notesListDelete" type="button" onClick={() => deleteReport(report.id)} aria-label={`${report.title || "日報"}を削除`} title="削除">×</button>
                  )}
                </div>
              ))
            )}
          </section>
        </aside>

        <section className="notesEditorPanel" aria-label="日報編集">
          {activeReport && !isTrashView && (
            <>
              <div className="notesEditorHeader">
                <input
                  aria-label="日報タイトル"
                  value={activeReport.title}
                  onChange={(event) =>
                    updateActiveReport({ title: event.target.value })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    textareaRef.current?.focus();
                  }}
                />
                <div className="notesViewTabs" role="tablist" aria-label="表示モード">
                  {viewModeOptions.map((option) => (
                    <button
                      className={viewMode === option.mode ? "active" : ""}
                      type="button"
                      role="tab"
                      aria-label={option.label}
                      aria-selected={viewMode === option.mode}
                      key={option.mode}
                      onClick={() => setViewMode(option.mode)}
                      title={option.label}
                    >
                      {option.icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`notesEditorGrid notesEditorGrid-${viewMode}`}>
                {viewMode !== "preview" && (
                  <textarea
                    aria-label="日報本文"
                    ref={(node) => {
                      textareaRef.current = node;
                      resizeMemoTextarea(node);
                    }}
                    value={activeReport.markdown}
                    onKeyDown={handleMarkdownKeyDown}
                    onChange={(event) => {
                      resizeMemoTextarea(event.currentTarget, true);
                      const normalized = normalizeOrderedListAfterDeletion(
                        activeReport.markdown,
                        event.target.value,
                        event.currentTarget.selectionStart,
                      );
                      updateActiveReport({
                        markdown: normalized.markdown,
                      });
                      requestAnimationFrame(() => {
                        event.currentTarget.setSelectionRange(
                          normalized.cursorPosition,
                          normalized.cursorPosition,
                        );
                      });
                    }}
                  />
                )}
                {viewMode !== "editor" && (
                  <article className="notesPreview" aria-label="プレビュー">
                    <MarkdownPreview
                      markdown={activeReport.markdown}
                      onToggleChecklist={toggleChecklist}
                    />
                  </article>
                )}
              </div>
            </>
          )}
          {isTrashView && <p className="emptyText">ゴミ箱から日報を復元するか、完全に削除できます。</p>}
        </section>
      </section>
    </main>
  );
}
