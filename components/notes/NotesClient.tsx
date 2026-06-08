"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";

import {
  ChecklistItem,
  MarkdownPreview,
  normalizeOrderedListAfterDeletion,
  normalizeOrderedListAt,
} from "../MarkdownMemoClient";

type Note = {
  id: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

type NotesClientProps = {
  initialValue: unknown;
};

const storageKey = "simple-notes-v1";
const defaultMarkdown = `# 新しいメモ

- 
`;

function createNoteId() {
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createNote(title = "新しいメモ"): Note {
  return {
    id: createNoteId(),
    title,
    markdown: defaultMarkdown,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeNotes(value: unknown): Note[] {
  if (typeof value === "string") {
    try {
      return normalizeNotes(JSON.parse(value) as unknown);
    } catch {
      return [createNote()];
    }
  }

  if (!Array.isArray(value)) {
    return [createNote()];
  }

  const notes = value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const note = item as Partial<Note>;
      return {
        id: typeof note.id === "string" ? note.id : `note-${index + 1}`,
        title:
          typeof note.title === "string" && note.title.trim()
            ? note.title
            : "無題のメモ",
        markdown:
          typeof note.markdown === "string" ? note.markdown : defaultMarkdown,
        updatedAt:
          typeof note.updatedAt === "string"
            ? note.updatedAt
            : new Date().toISOString(),
      };
    })
    .filter((note): note is Note => Boolean(note));

  return notes.length > 0 ? notes : [createNote()];
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

export default function NotesClient({ initialValue }: NotesClientProps) {
  const [notes, setNotes] = useState<Note[]>(() => normalizeNotes(initialValue));
  const [activeNoteId, setActiveNoteId] = useState(() => notes[0]?.id || "");
  const [isReady, setIsReady] = useState(initialValue !== null);

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) || notes[0],
    [activeNoteId, notes],
  );

  useEffect(() => {
    if (initialValue !== null) return;

    async function loadNotes() {
      try {
        const response = await fetch("/api/notes", { cache: "no-store" });
        const data = (await response.json()) as { value: unknown };
        if (data.value) {
          const loadedNotes = normalizeNotes(data.value);
          setNotes(loadedNotes);
          setActiveNoteId(loadedNotes[0]?.id || "");
          return;
        }

        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;

        const loadedNotes = normalizeNotes(JSON.parse(stored));
        setNotes(loadedNotes);
        setActiveNoteId(loadedNotes[0]?.id || "");
        await fetch("/api/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loadedNotes),
        });
        window.localStorage.removeItem(storageKey);
      } catch {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        try {
          const loadedNotes = normalizeNotes(JSON.parse(stored));
          setNotes(loadedNotes);
          setActiveNoteId(loadedNotes[0]?.id || "");
        } catch {
          setNotes([createNote()]);
        }
      }
    }

    loadNotes().finally(() => setIsReady(true));
  }, [initialValue]);

  useEffect(() => {
    if (!isReady) return;

    fetch("/api/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notes),
      }).catch(() => undefined);
  }, [isReady, notes]);

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
  }, [notes]);

  function updateActiveNote(value: Partial<Pick<Note, "title" | "markdown">>) {
    if (!activeNote) return;

    setNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id
          ? { ...note, ...value, updatedAt: new Date().toISOString() }
          : note,
      ),
    );
  }

  function handleMarkdownKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!activeNote || event.nativeEvent.isComposing) return;
    const markdown = activeNote.markdown;
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
        updateActiveNote({ markdown: nextMarkdown });
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
        updateActiveNote({ markdown: nextMarkdown });
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
      updateActiveNote({ markdown: nextMarkdown });
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
      updateActiveNote({ markdown: nextMarkdown });
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
    updateActiveNote({ markdown: nextMarkdown });
    requestAnimationFrame(() => {
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function toggleChecklist(item: ChecklistItem) {
    if (!activeNote || item.lineNumber < 1) return;

    const lineNumbers = new Set<number>();

    function collectLineNumbers(target: ChecklistItem) {
      lineNumbers.add(target.lineNumber);
      target.children.forEach(collectLineNumbers);
    }

    collectLineNumbers(item);
    const nextChecked = !item.checked;

    updateActiveNote({
      markdown: activeNote.markdown
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

  function addNote() {
    const note = createNote();
    setNotes((current) => [note, ...current]);
    setActiveNoteId(note.id);
  }

  function deleteActiveNote() {
    if (!activeNote) return;

    setNotes((current) => {
      const nextNotes = current.filter((note) => note.id !== activeNote.id);
      const normalizedNotes = nextNotes.length > 0 ? nextNotes : [createNote()];
      setActiveNoteId(normalizedNotes[0].id);
      return normalizedNotes;
    });
  }

  return (
    <main className="shell notesPage">
      <section className="notesHeader" aria-label="メモ">
        <div>
          <a className="backLink" href="/">
            ← メイン
          </a>
          <h1>Notes</h1>
        </div>
        <button className="notesAddButton" type="button" onClick={addNote}>
          追加
        </button>
      </section>

      <section className="notesWorkspace" aria-label="メモ一覧と編集">
        <aside className="notesSidebar" aria-label="メモ一覧">
          {notes.map((note) => (
            <button
              className={note.id === activeNote?.id ? "active" : ""}
              key={note.id}
              type="button"
              onClick={() => setActiveNoteId(note.id)}
            >
              <strong>{note.title || "無題のメモ"}</strong>
              <span>{formatUpdatedAt(note.updatedAt)}</span>
            </button>
          ))}
        </aside>

        <section className="notesEditorPanel" aria-label="メモ編集">
          {activeNote && (
            <>
              <div className="notesEditorHeader">
                <input
                  aria-label="メモタイトル"
                  value={activeNote.title}
                  onChange={(event) =>
                    updateActiveNote({ title: event.target.value })
                  }
                />
                <button
                  className="memoDeleteButton"
                  type="button"
                  onClick={deleteActiveNote}
                  aria-label={`${activeNote.title || "メモ"}を削除`}
                  title="削除"
                >
                  ×
                </button>
              </div>

              <div className="notesEditorGrid">
                <textarea
                  aria-label="メモ本文"
                  ref={resizeMemoTextarea}
                  value={activeNote.markdown}
                  onKeyDown={handleMarkdownKeyDown}
                  onChange={(event) => {
                    resizeMemoTextarea(event.currentTarget, true);
                    updateActiveNote({
                      markdown: normalizeOrderedListAfterDeletion(
                        activeNote.markdown,
                        event.target.value,
                        event.currentTarget.selectionStart,
                      ),
                    });
                  }}
                />
                <article className="notesPreview" aria-label="プレビュー">
                  <MarkdownPreview
                    markdown={activeNote.markdown}
                    onToggleChecklist={toggleChecklist}
                  />
                </article>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
