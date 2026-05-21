"use client";

import {
  Children,
  KeyboardEvent,
  ReactNode,
  ReactElement,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type RoadmapViewMode = "split" | "preview" | "memo";
type RoadmapBlock = {
  id: string;
  title: string;
  markdown: string;
  viewMode: RoadmapViewMode;
};
type MarkdownSection = {
  id: string;
  level: number;
  title: string;
  lineNumber: number;
  contentLines: string[];
  children: MarkdownSection[];
};
type ChecklistItem = {
  checked: boolean;
  children: ChecklistItem[];
  indent: number;
  lineNumber: number;
  text: string;
};

const memoStorageKey = "roadmap-markdown-v1";
const defaultMemoMarkdown = `# ロードマップ

- 
`;

const viewModes: { key: RoadmapViewMode; icon: string; label: string }[] = [
  { key: "split", icon: "▥", label: "編集とプレビュー" },
  { key: "preview", icon: "◧", label: "プレビュー" },
  { key: "memo", icon: "✎", label: "編集" },
];

function createRoadmapId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRoadmapBlock(
  markdown: string,
  title: string,
  idPrefix: string,
): RoadmapBlock {
  return {
    id: createRoadmapId(idPrefix),
    title,
    markdown,
    viewMode: "preview",
  };
}

function normalizeRoadmapBlocks(
  value: unknown,
  defaultMarkdown: string,
  defaultTitle: string,
  idPrefix: string,
): RoadmapBlock[] {
  if (value === null || value === undefined) {
    return [createRoadmapBlock(defaultMarkdown, defaultTitle, idPrefix)];
  }

  if (typeof value === "string") {
    try {
      return normalizeRoadmapBlocks(
        JSON.parse(value) as unknown,
        defaultMarkdown,
        defaultTitle,
        idPrefix,
      );
    } catch {
      return [createRoadmapBlock(value, defaultTitle, idPrefix)];
    }
  }

  if (!Array.isArray(value)) {
    return [createRoadmapBlock(defaultMarkdown, defaultTitle, idPrefix)];
  }

  const blocks = value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const block = item as Partial<RoadmapBlock>;
      return {
        id: typeof block.id === "string" ? block.id : `${idPrefix}-${index + 1}`,
        title: typeof block.title === "string" ? block.title : defaultTitle,
        markdown:
          typeof block.markdown === "string"
            ? block.markdown
            : defaultMarkdown,
        viewMode:
          block.viewMode === "split" ||
          block.viewMode === "preview" ||
          block.viewMode === "memo"
            ? block.viewMode
            : "preview",
      };
    })
    .filter((block): block is RoadmapBlock => Boolean(block));

  return blocks.length > 0
    ? blocks
    : [createRoadmapBlock(defaultMarkdown, defaultTitle, idPrefix)];
}

function parseMarkdownSections(markdown: string) {
  const root: MarkdownSection = {
    id: "root",
    level: 0,
    title: "",
    lineNumber: 0,
    contentLines: [],
    children: [],
  };
  const stack = [root];

  markdown.split("\n").forEach((line, index) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!headingMatch) {
      stack.at(-1)?.contentLines.push(line);
      return;
    }

    const level = headingMatch[1].length;
    const title = headingMatch[2].trim();
    const section: MarkdownSection = {
      id: `${index + 1}-${level}-${title}`,
      level,
      title,
      lineNumber: index + 1,
      contentLines: [],
      children: [],
    };

    while (stack.at(-1) && stack.at(-1)!.level >= level) {
      stack.pop();
    }
    stack.at(-1)?.children.push(section);
    stack.push(section);
  });

  return root;
}

function CollapsibleListItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const childArray = Children.toArray(children);
  const nestedListIndexes = new Set(
    childArray.flatMap((child, index) => {
      if (
        isValidElement(child) &&
        (child.type === "ul" || child.type === "ol")
      ) {
        return [index];
      }
      return [];
    }),
  );
  const nestedLists = childArray.filter((_, index) =>
    nestedListIndexes.has(index),
  );
  const content = childArray.filter((_, index) => !nestedListIndexes.has(index));

  if (nestedLists.length === 0) {
    return <li className={className}>{children}</li>;
  }

  return (
    <li className={className}>
      <span className="roadmapListHeading">
        <span className="roadmapListContent">{content}</span>
        <button
          className="roadmapListToggle"
          type="button"
          onClick={() => setIsCollapsed((current) => !current)}
          aria-expanded={!isCollapsed}
        >
          <span aria-hidden="true">{isCollapsed ? "›" : "⌄"}</span>
        </button>
      </span>
      {!isCollapsed && nestedLists}
    </li>
  );
}

function parseChecklistItems(
  lines: { line: string; lineNumber: number }[],
): ChecklistItem[] {
  const root: ChecklistItem[] = [];
  const stack: { children: ChecklistItem[]; indent: number }[] = [
    { children: root, indent: -1 },
  ];

  lines.forEach(({ line, lineNumber }) => {
    const match = line.match(/^(\s*)[-*+]\s+\[( |x|X)\]\s+(.*)$/);
    if (!match) return;

    const indent = match[1].replace(/\t/g, "    ").length;
    const item: ChecklistItem = {
      checked: match[2].toLowerCase() === "x",
      children: [],
      indent,
      lineNumber,
      text: match[3],
    };

    while (stack.at(-1) && stack.at(-1)!.indent >= indent) {
      stack.pop();
    }

    stack.at(-1)?.children.push(item);
    stack.push({ children: item.children, indent });
  });

  return root;
}

function ChecklistTree({
  items,
  onToggleChecklist,
}: {
  items: ChecklistItem[];
  onToggleChecklist: (item: ChecklistItem) => void;
}) {
  return (
    <ul className="roadmapChecklistTree">
      {items.map((item) => (
        <ChecklistTreeItem
          item={item}
          key={item.lineNumber}
          onToggleChecklist={onToggleChecklist}
        />
      ))}
    </ul>
  );
}

function ChecklistTreeItem({
  item,
  onToggleChecklist,
}: {
  item: ChecklistItem;
  onToggleChecklist: (item: ChecklistItem) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <li>
      <span
        className={
          item.children.length > 0
            ? "roadmapTaskHeading"
            : "roadmapTaskHeading noToggle"
        }
      >
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => onToggleChecklist(item)}
        />
        <span className="roadmapTaskContent">{item.text}</span>
        {item.children.length > 0 && (
          <button
            className="roadmapListToggle"
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            aria-expanded={!isCollapsed}
          >
            <span aria-hidden="true">{isCollapsed ? "›" : "⌄"}</span>
          </button>
        )}
      </span>
      {!isCollapsed && item.children.length > 0 && (
        <ChecklistTree
          items={item.children}
          onToggleChecklist={onToggleChecklist}
        />
      )}
    </li>
  );
}

function MarkdownBlock({
  markdown,
  onToggleChecklist,
  startLine,
}: {
  markdown: string;
  onToggleChecklist: (item: ChecklistItem) => void;
  startLine: number;
}) {
  if (!markdown.trim()) return null;
  const blocks: ReactNode[] = [];
  let markdownLines: string[] = [];
  let checklistLines: { line: string; lineNumber: number }[] = [];

  function flushMarkdown(key: string) {
    if (markdownLines.length === 0) return;
    blocks.push(
      <ReactMarkdown
        components={{
          li: ({ children, className }) => (
            <CollapsibleListItem className={className}>
              {children}
            </CollapsibleListItem>
          ),
        }}
        key={key}
        remarkPlugins={[remarkGfm]}
      >
        {markdownLines.join("\n")}
      </ReactMarkdown>,
    );
    markdownLines = [];
  }

  function flushChecklist(key: string) {
    if (checklistLines.length === 0) return;
    blocks.push(
      <ChecklistTree
        items={parseChecklistItems(checklistLines)}
        key={key}
        onToggleChecklist={onToggleChecklist}
      />,
    );
    checklistLines = [];
  }

  markdown.split("\n").forEach((line, index) => {
    const isChecklistLine = /^\s*[-*+]\s+\[( |x|X)\]\s+/.test(line);
    if (isChecklistLine) {
      flushMarkdown(`markdown-${index}`);
      checklistLines.push({ line, lineNumber: startLine + index });
      return;
    }

    flushChecklist(`checklist-${index}`);
    markdownLines.push(line);
  });

  flushMarkdown("markdown-end");
  flushChecklist("checklist-end");

  return (
    <>{blocks}</>
  );
}

function MarkdownPreview({
  markdown,
  onToggleChecklist,
}: {
  markdown: string;
  onToggleChecklist: (item: ChecklistItem) => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const rootSection = parseMarkdownSections(markdown);

  function toggleSection(id: string) {
    setCollapsedSections((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function renderSection(section: MarkdownSection) {
    const isCollapsed = collapsedSections.includes(section.id);
    const headingButton = (
      <button
        type="button"
        onClick={() => toggleSection(section.id)}
        aria-expanded={!isCollapsed}
      >
        <span>{section.title}</span>
        <span
          className={
            isCollapsed
              ? "roadmapHeadingArrow visible"
              : "roadmapHeadingArrow"
          }
          aria-hidden="true"
        >
          {isCollapsed ? "›" : "⌄"}
        </span>
      </button>
    );

    return (
      <section className="roadmapMarkdownSection" key={section.id}>
        {section.level === 1 && (
          <h1 className="roadmapCollapsibleHeading">{headingButton}</h1>
        )}
        {section.level === 2 && (
          <h2 className="roadmapCollapsibleHeading">{headingButton}</h2>
        )}
        {section.level === 3 && (
          <h3 className="roadmapCollapsibleHeading">{headingButton}</h3>
        )}
        {section.level === 4 && (
          <h4 className="roadmapCollapsibleHeading">{headingButton}</h4>
        )}
        {section.level === 5 && (
          <h5 className="roadmapCollapsibleHeading">{headingButton}</h5>
        )}
        {section.level >= 6 && (
          <h6 className="roadmapCollapsibleHeading">{headingButton}</h6>
        )}
        {!isCollapsed && (
          <div className="roadmapSectionBody">
            <MarkdownBlock
              markdown={section.contentLines.join("\n")}
              onToggleChecklist={onToggleChecklist}
              startLine={section.lineNumber + 1}
            />
            {section.children.map((child) => renderSection(child))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="roadmapMarkdown">
      <MarkdownBlock
        markdown={rootSection.contentLines.join("\n")}
        onToggleChecklist={onToggleChecklist}
        startLine={1}
      />
      {rootSection.children.map((section) => renderSection(section))}
    </div>
  );
}

type MarkdownMemoPageProps = {
  apiPath: string;
  ariaLabel: string;
  defaultMarkdown: string;
  defaultTitle: string;
  idPrefix: string;
  initialValue: unknown;
  pageTitle: string;
  storageKey: string;
};

export function MarkdownMemoPage({
  apiPath,
  ariaLabel,
  defaultMarkdown,
  defaultTitle,
  idPrefix,
  initialValue,
  pageTitle,
  storageKey,
}: MarkdownMemoPageProps) {
  const [roadmapBlocks, setRoadmapBlocks] = useState<RoadmapBlock[]>(() =>
    normalizeRoadmapBlocks(initialValue, defaultMarkdown, defaultTitle, idPrefix),
  );
  const [isReady, setIsReady] = useState(initialValue !== null);

  useEffect(() => {
    if (initialValue !== null) return;

    async function loadMemos() {
      try {
        const response = await fetch(apiPath, { cache: "no-store" });
        const data = (await response.json()) as { value: unknown };
        const dbBlocks = normalizeRoadmapBlocks(
          data.value,
          defaultMarkdown,
          defaultTitle,
          idPrefix,
        );
        const hasDbBlocks = Array.isArray(data.value) && data.value.length > 0;

        if (hasDbBlocks) {
          setRoadmapBlocks(dbBlocks);
          return;
        }

        const stored = window.localStorage.getItem(storageKey);
        if (!stored) {
          setRoadmapBlocks(dbBlocks);
          return;
        }
        const migratedBlocks = normalizeRoadmapBlocks(
          stored,
          defaultMarkdown,
          defaultTitle,
          idPrefix,
        );
        setRoadmapBlocks(migratedBlocks);
        await fetch(apiPath, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(migratedBlocks),
        });
        window.localStorage.removeItem(storageKey);
      } catch {
        const stored = window.localStorage.getItem(storageKey);
        setRoadmapBlocks(
          normalizeRoadmapBlocks(stored, defaultMarkdown, defaultTitle, idPrefix),
        );
      }
    }

    loadMemos().finally(() => setIsReady(true));
  }, [apiPath, defaultMarkdown, defaultTitle, idPrefix, initialValue, storageKey]);

  useEffect(() => {
    if (isReady) {
      fetch(apiPath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roadmapBlocks),
      }).catch(() => undefined);
    }
  }, [apiPath, isReady, roadmapBlocks]);

  function updateRoadmapMarkdown(
    blockId: string,
    updater: string | ((current: string) => string),
  ) {
    setRoadmapBlocks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              markdown:
                typeof updater === "function"
                  ? updater(block.markdown)
                  : updater,
            }
          : block,
      ),
    );
  }

  function updateRoadmapTitle(blockId: string, title: string) {
    setRoadmapBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, title } : block,
      ),
    );
  }

  function updateRoadmapViewMode(blockId: string, viewMode: RoadmapViewMode) {
    setRoadmapBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, viewMode } : block,
      ),
    );
  }

  function addRoadmapBlock() {
    setRoadmapBlocks((current) => [
      ...current,
      createRoadmapBlock(defaultMarkdown, defaultTitle, idPrefix),
    ]);
  }

  function removeRoadmapBlock(blockId: string) {
    setRoadmapBlocks((current) => {
      const nextBlocks = current.filter((block) => block.id !== blockId);
      return nextBlocks.length > 0
        ? nextBlocks
        : [createRoadmapBlock(defaultMarkdown, defaultTitle, idPrefix)];
    });
  }

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
      .querySelectorAll<HTMLTextAreaElement>(".roadmapEditorPane textarea")
      .forEach((textarea) => resizeMemoTextarea(textarea));
  }, [roadmapBlocks]);

  function toggleChecklist(blockId: string, item: ChecklistItem) {
    if (item.lineNumber < 1) return;
    const lineNumbers = new Set<number>();
    function collectLineNumbers(target: ChecklistItem) {
      lineNumbers.add(target.lineNumber);
      target.children.forEach(collectLineNumbers);
    }
    collectLineNumbers(item);
    const nextChecked = !item.checked;

    updateRoadmapMarkdown(blockId, (current) =>
      current
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
    );
  }

  function handleMarkdownKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
    blockId: string,
    markdown: string,
  ) {
    if (event.nativeEvent.isComposing) return;

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
        const nextMarkdown =
          markdown.slice(0, selectionStartLine) +
          nextBlock +
          markdown.slice(selectionEndLineEnd);
        const cursorDelta = nextBlock.length - selectedBlock.length;
        updateRoadmapMarkdown(blockId, nextMarkdown);
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
        const nextMarkdown =
          markdown.slice(0, lineStart) + nextLine + markdown.slice(lineEnd);
        const nextCursor = Math.max(lineStart, cursorStart - removed);
        updateRoadmapMarkdown(blockId, nextMarkdown);
        requestAnimationFrame(() => {
          textarea.setSelectionRange(nextCursor, nextCursor);
        });
        return;
      }

      const insertion = "    ";
      const nextMarkdown =
        markdown.slice(0, lineStart) +
        insertion +
        markdown.slice(lineStart);
      const nextCursor = cursorStart + insertion.length;
      updateRoadmapMarkdown(blockId, nextMarkdown);
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
      const nextMarkdown =
        markdown.slice(0, lineStart) + markdown.slice(cursorEnd);
      updateRoadmapMarkdown(blockId, nextMarkdown);
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
    const nextMarkdown =
      markdown.slice(0, cursorStart) + insertion + markdown.slice(cursorEnd);
    const nextCursor = cursorStart + insertion.length;
    updateRoadmapMarkdown(blockId, nextMarkdown);
    requestAnimationFrame(() => {
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <main className="shell roadmapPage">
      <section className="roadmapHeader" aria-label={ariaLabel}>
        <div>
          <a className="backLink" href="/">
            ← メイン
          </a>
          <h1>{pageTitle}</h1>
        </div>
        <button className="roadmapAddButton" type="button" onClick={addRoadmapBlock}>
          追加
        </button>
      </section>

      <div className="roadmapBlockList">
        {roadmapBlocks.map((block) => (
          <section
            className={
              block.viewMode === "split"
                ? "roadmapBlock"
                : "roadmapBlock single"
            }
            key={block.id}
          >
            <div className="memoBlockHeader">
              <input
                className="memoTitleInput"
                aria-label={`${ariaLabel}タイトル`}
                placeholder={`${ariaLabel}タイトル`}
                value={block.title}
                onChange={(event) =>
                  updateRoadmapTitle(block.id, event.target.value)
                }
              />
              <div className="memoBlockActions">
                <div
                  className="roadmapModeTabs"
                  role="tablist"
                  aria-label="表示モード"
                >
                  {viewModes.map((mode) => (
                    <button
                      className={
                        block.viewMode === mode.key ? "miniTab active" : "miniTab"
                      }
                      key={mode.key}
                      type="button"
                      role="tab"
                      aria-selected={block.viewMode === mode.key}
                      aria-label={mode.label}
                      title={mode.label}
                      onClick={() => updateRoadmapViewMode(block.id, mode.key)}
                    >
                      <span aria-hidden="true">{mode.icon}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="memoDeleteButton"
                  type="button"
                  onClick={() => removeRoadmapBlock(block.id)}
                  aria-label={`${block.title || ariaLabel}を削除`}
                  title="削除"
                >
                  ×
                </button>
              </div>
            </div>

            <div
              className={
                block.viewMode === "split"
                  ? "roadmapWorkspace"
                  : "roadmapWorkspace single"
              }
            >
              {block.viewMode !== "preview" && (
                <div className="roadmapEditorPane">
                  <textarea
                    aria-label={`${ariaLabel}本文`}
                    ref={resizeMemoTextarea}
                    value={block.markdown}
                    onKeyDown={(event) =>
                      handleMarkdownKeyDown(event, block.id, block.markdown)
                    }
                    onChange={(event) => {
                      resizeMemoTextarea(event.currentTarget, true);
                      updateRoadmapMarkdown(block.id, event.target.value);
                    }}
                  />
                </div>
              )}
              {block.viewMode !== "memo" && (
                <article className="roadmapPreviewPane" aria-label="プレビュー">
                  <MarkdownPreview
                    markdown={block.markdown}
                    onToggleChecklist={(item) =>
                      toggleChecklist(block.id, item)
                    }
                  />
                </article>
              )}
            </div>
          </section>
        ))}
        <button
          className="roadmapAppendButton"
          type="button"
          onClick={addRoadmapBlock}
        >
          追加
        </button>
      </div>
    </main>
  );
}

export { defaultMemoMarkdown, memoStorageKey };
