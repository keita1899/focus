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
  folderId: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

type NoteFolder = {
  id: string;
  name: string;
  createdAt: string;
};

type NotesState = {
  folders: NoteFolder[];
  notes: Note[];
};

type NotesClientProps = {
  initialValue: unknown;
};

type NotesViewMode = "editor" | "preview" | "split";

const storageKey = "simple-notes-v1";
const notesViewModeStorageKey = "simple-notes-view-mode-v1";
const allFoldersId = "all";
const defaultFolderId = "folder-default";
const defaultMarkdown = `# 新しいメモ

- 
`;

function createNoteId() {
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createFolderId() {
  return `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createFolder(name: string): NoteFolder {
  return {
    id: createFolderId(),
    name,
    createdAt: new Date().toISOString(),
  };
}

function createNote(title = "新しいメモ", folderId = defaultFolderId): Note {
  return {
    id: createNoteId(),
    folderId,
    title,
    markdown: defaultMarkdown,
    updatedAt: new Date().toISOString(),
  };
}

function getDefaultFolder(): NoteFolder {
  return {
    id: defaultFolderId,
    name: "未分類",
    createdAt: new Date(0).toISOString(),
  };
}

function normalizeNotesState(value: unknown): NotesState {
  if (typeof value === "string") {
    try {
      return normalizeNotesState(JSON.parse(value) as unknown);
    } catch {
      return { folders: [getDefaultFolder()], notes: [createNote()] };
    }
  }

  const source = Array.isArray(value)
    ? { folders: [getDefaultFolder()], notes: value }
    : value && typeof value === "object"
      ? (value as Partial<NotesState>)
      : { folders: [getDefaultFolder()], notes: [createNote()] };

  const rawFolders = Array.isArray(source.folders)
    ? source.folders
    : [getDefaultFolder()];
  const folders = rawFolders
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const folder = item as Partial<NoteFolder>;
      return {
        id:
          typeof folder.id === "string" && folder.id
            ? folder.id
            : `folder-${index + 1}`,
        name:
          typeof folder.name === "string" && folder.name.trim()
            ? folder.name
            : "無題のフォルダ",
        createdAt:
          typeof folder.createdAt === "string"
            ? folder.createdAt
            : new Date().toISOString(),
      };
    })
    .filter((folder): folder is NoteFolder => Boolean(folder));
  const normalizedFolders = folders.some((folder) => folder.id === defaultFolderId)
    ? folders
    : [getDefaultFolder(), ...folders];
  const folderIds = new Set(normalizedFolders.map((folder) => folder.id));

  const rawNotes = Array.isArray(source.notes) ? source.notes : [createNote()];
  const notes = rawNotes
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const note = item as Partial<Note>;
      const folderId =
        typeof note.folderId === "string" && folderIds.has(note.folderId)
          ? note.folderId
          : defaultFolderId;
      return {
        id: typeof note.id === "string" ? note.id : `note-${index + 1}`,
        folderId,
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

  return {
    folders: normalizedFolders,
    notes: notes.length > 0 ? notes : [createNote()],
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

export default function NotesClient({ initialValue }: NotesClientProps) {
  const initialNotesState = useMemo(
    () => normalizeNotesState(initialValue),
    [initialValue],
  );
  const [folders, setFolders] = useState<NoteFolder[]>(
    () => initialNotesState.folders,
  );
  const [notes, setNotes] = useState<Note[]>(() => initialNotesState.notes);
  const [activeFolderId, setActiveFolderId] = useState(allFoldersId);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState(() => notes[0]?.id || "");
  const [isReady, setIsReady] = useState(initialValue !== null);
  const [viewMode, setViewMode] = useState<NotesViewMode>("split");

  const visibleNotes = useMemo(
    () =>
      activeFolderId === allFoldersId
        ? notes
        : notes.filter((note) => note.folderId === activeFolderId),
    [activeFolderId, notes],
  );

  const activeNote = useMemo(
    () =>
      visibleNotes.find((note) => note.id === activeNoteId) ||
      visibleNotes[0] ||
      null,
    [activeNoteId, visibleNotes],
  );

  useEffect(() => {
    try {
      const storedMode = window.localStorage.getItem(notesViewModeStorageKey);
      if (
        storedMode === "editor" ||
        storedMode === "preview" ||
        storedMode === "split"
      ) {
        setViewMode(storedMode);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(notesViewModeStorageKey, viewMode);
    } catch {
      return;
    }
  }, [viewMode]);

  useEffect(() => {
    if (initialValue !== null) return;

    async function loadNotes() {
      try {
        const response = await fetch("/api/notes", { cache: "no-store" });
        const data = (await response.json()) as { value: unknown };
        if (data.value) {
          const loadedState = normalizeNotesState(data.value);
          setFolders(loadedState.folders);
          setNotes(loadedState.notes);
          setActiveFolderId(allFoldersId);
          setActiveNoteId(loadedState.notes[0]?.id || "");
          return;
        }

        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;

        const loadedState = normalizeNotesState(JSON.parse(stored));
        setFolders(loadedState.folders);
        setNotes(loadedState.notes);
        setActiveFolderId(allFoldersId);
        setActiveNoteId(loadedState.notes[0]?.id || "");
        await fetch("/api/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loadedState),
        });
        window.localStorage.removeItem(storageKey);
      } catch {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        try {
          const loadedState = normalizeNotesState(JSON.parse(stored));
          setFolders(loadedState.folders);
          setNotes(loadedState.notes);
          setActiveFolderId(allFoldersId);
          setActiveNoteId(loadedState.notes[0]?.id || "");
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
      body: JSON.stringify({ folders, notes }),
      }).catch(() => undefined);
  }, [folders, isReady, notes]);

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

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.metaKey && !event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        addNote();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFolderId, notes, addNote]);

  function updateActiveNote(
    value: Partial<Pick<Note, "folderId" | "title" | "markdown">>,
  ) {
    if (!activeNote) return;

    setNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id
          ? { ...note, ...value, updatedAt: new Date().toISOString() }
          : note,
      ),
    );
  }

  function selectFolder(folderId: string) {
    setActiveFolderId(folderId);
    const nextNote =
      folderId === allFoldersId
        ? notes[0]
        : notes.find((note) => note.folderId === folderId);
    setActiveNoteId(nextNote?.id || "");
  }

  function addFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = createFolder(name);
    setFolders((current) => [...current, folder]);
    setActiveFolderId(folder.id);
    setActiveNoteId("");
    setNewFolderName("");
  }

  function updateFolderName(folderId: string, name: string) {
    setFolders((current) =>
      current.map((folder) =>
        folder.id === folderId ? { ...folder, name } : folder,
      ),
    );
  }

  function finishFolderEdit() {
    setEditingFolderId(null);
  }

  function moveActiveNote(folderId: string) {
    updateActiveNote({ folderId });
    setActiveFolderId(folderId);
  }

  function deleteFolder(folderId: string) {
    if (folderId === defaultFolderId) return;

    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    setNotes((current) =>
      current.map((note) =>
        note.folderId === folderId ? { ...note, folderId: defaultFolderId } : note,
      ),
    );
    if (activeFolderId === folderId) {
      setActiveFolderId(defaultFolderId);
      const nextNote = notes.find(
        (note) => note.folderId === folderId || note.folderId === defaultFolderId,
      );
      setActiveNoteId(nextNote?.id || "");
    }
    setEditingFolderId((current) => (current === folderId ? null : current));
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
    const folderId =
      activeFolderId === allFoldersId ? defaultFolderId : activeFolderId;
    const note = createNote("新しいメモ", folderId);
    setNotes((current) => [note, ...current]);
    setActiveNoteId(note.id);
  }

  function deleteActiveNote() {
    if (!activeNote) return;

    setNotes((current) => {
      const nextNotes = current.filter((note) => note.id !== activeNote.id);
      const normalizedNotes = nextNotes.length > 0 ? nextNotes : [createNote()];
      setActiveNoteId(normalizedNotes[0].id);
      setActiveFolderId(allFoldersId);
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
          <section className="notesFolderPanel" aria-label="フォルダ">
            <button
              className={
                activeFolderId === allFoldersId
                  ? "notesFolderButton active"
                  : "notesFolderButton"
              }
              type="button"
              onClick={() => selectFolder(allFoldersId)}
            >
              <strong>すべて</strong>
              <span>{notes.length}</span>
            </button>
            {folders.map((folder) => {
              const noteCount = notes.filter(
                (note) => note.folderId === folder.id,
              ).length;
              const isEditing = editingFolderId === folder.id;
              return (
                <div
                  className={
                    activeFolderId === folder.id
                      ? "notesFolderItem active"
                      : "notesFolderItem"
                  }
                  key={folder.id}
                >
                  {isEditing ? (
                    <input
                      aria-label={`${folder.name}のフォルダ名`}
                      autoFocus
                      value={folder.name}
                      onBlur={finishFolderEdit}
                      onChange={(event) =>
                        updateFolderName(folder.id, event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === "Escape") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="notesFolderButton"
                      type="button"
                      onClick={() => selectFolder(folder.id)}
                      onDoubleClick={() => {
                        selectFolder(folder.id);
                        setEditingFolderId(folder.id);
                      }}
                    >
                      <strong>{folder.name}</strong>
                      <span>{noteCount}</span>
                    </button>
                  )}
                  {folder.id !== defaultFolderId && (
                    <button
                      className="notesFolderDelete"
                      type="button"
                      onClick={() => deleteFolder(folder.id)}
                      aria-label={`${folder.name || "フォルダ"}を削除`}
                      title="削除"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            <form
              className="notesFolderForm"
              onSubmit={(event) => {
                event.preventDefault();
                addFolder();
              }}
            >
              <input
                aria-label="新しいフォルダ名"
                placeholder="新しいフォルダ"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
              />
              <button type="submit" aria-label="フォルダを追加">
                +
              </button>
            </form>
          </section>

          <section className="notesListPanel" aria-label="メモ">
            {visibleNotes.length === 0 ? (
              <p className="emptyText compact">メモがありません。</p>
            ) : (
              visibleNotes.map((note) => (
                <button
                  className={note.id === activeNote?.id ? "active" : ""}
                  key={note.id}
                  type="button"
                  onClick={() => setActiveNoteId(note.id)}
                >
                  <strong>{note.title || "無題のメモ"}</strong>
                  <span>{formatUpdatedAt(note.updatedAt)}</span>
                </button>
              ))
            )}
          </section>
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
                <div className="notesViewTabs" role="tablist" aria-label="表示モード">
                  <button
                    className={viewMode === "editor" ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "editor"}
                    onClick={() => setViewMode("editor")}
                  >
                    フォーム
                  </button>
                  <button
                    className={viewMode === "preview" ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "preview"}
                    onClick={() => setViewMode("preview")}
                  >
                    プレビュー
                  </button>
                  <button
                    className={viewMode === "split" ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "split"}
                    onClick={() => setViewMode("split")}
                  >
                    両方
                  </button>
                </div>
                <select
                  aria-label="メモのフォルダ"
                  value={activeNote.folderId}
                  onChange={(event) => moveActiveNote(event.target.value)}
                >
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
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

              <div className={`notesEditorGrid notesEditorGrid-${viewMode}`}>
                {viewMode !== "preview" && (
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
                )}
                {viewMode !== "editor" && (
                  <article className="notesPreview" aria-label="プレビュー">
                    <MarkdownPreview
                      markdown={activeNote.markdown}
                      onToggleChecklist={toggleChecklist}
                    />
                  </article>
                )}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
