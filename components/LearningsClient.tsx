"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChecklistItem, MarkdownPreview } from "./MarkdownMemoClient";

type LearningTask = {
  id: string;
  title: string;
  completed: boolean;
  markdown: string;
};

type LearningSection = {
  id: string;
  title: string;
  tasks: LearningTask[];
};

type LearningsState = { sections: LearningSection[] };
type LearningsClientProps = { initialValue: unknown };

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTask(): LearningTask {
  return { id: createId("learning-task"), title: "新しいタスク", completed: false, markdown: "# 学習メモ\n\n" };
}

function createSection(): LearningSection {
  return { id: createId("learning-section"), title: "新しいセクション", tasks: [createTask()] };
}

function normalizeState(value: unknown): LearningsState {
  if (!value || typeof value !== "object" || !Array.isArray((value as LearningsState).sections)) {
    return { sections: [createSection()] };
  }
  const sections = (value as LearningsState).sections.flatMap((section, sectionIndex) => {
    if (!section || typeof section !== "object") return [];
    const source = section as Partial<LearningSection>;
    const tasks = Array.isArray(source.tasks) ? source.tasks.flatMap((task, taskIndex) => {
      if (!task || typeof task !== "object") return [];
      const item = task as Partial<LearningTask>;
      return [{
        id: typeof item.id === "string" ? item.id : `learning-task-${sectionIndex}-${taskIndex}`,
        title: typeof item.title === "string" ? item.title : "新しいタスク",
        completed: item.completed === true,
        markdown: typeof item.markdown === "string" ? item.markdown : "",
      }];
    }) : [];
    return [{
      id: typeof source.id === "string" ? source.id : `learning-section-${sectionIndex}`,
      title: typeof source.title === "string" ? source.title : "新しいセクション",
      tasks,
    }];
  });
  return { sections: sections.length ? sections : [createSection()] };
}

export default function LearningsClient({ initialValue }: LearningsClientProps) {
  const [learning, setLearning] = useState<LearningsState>(() => normalizeState(initialValue));
  const [activeTaskId, setActiveTaskId] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const hasMounted = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const activeTask = useMemo(
    () => learning.sections.flatMap((section) => section.tasks).find((task) => task.id === activeTaskId) || null,
    [activeTaskId, learning.sections],
  );

  useEffect(() => {
    if (!activeTask && learning.sections[0]?.tasks[0]) setActiveTaskId(learning.sections[0].tasks[0].id);
  }, [activeTask, learning.sections]);

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    const timeoutId = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        const response = await fetch("/api/learnings", {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(learning),
        });
        if (!response.ok) throw new Error("学習内容の保存に失敗しました。");
      });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [learning]);

  function updateSection(sectionId: string, updater: (section: LearningSection) => LearningSection) {
    setLearning((current) => ({ sections: current.sections.map((section) => section.id === sectionId ? updater(section) : section) }));
  }

  function updateTask(taskId: string, updater: (task: LearningTask) => LearningTask) {
    setLearning((current) => ({ sections: current.sections.map((section) => ({
      ...section, tasks: section.tasks.map((task) => task.id === taskId ? updater(task) : task),
    })) }));
  }

  function addTask(sectionId: string) {
    const task = createTask();
    updateSection(sectionId, (section) => ({ ...section, tasks: [...section.tasks, task] }));
    setActiveTaskId(task.id);
  }

  function addSection() {
    const section = createSection();
    setLearning((current) => ({ sections: [...current.sections, section] }));
    setCollapsed((current) => ({ ...current, [section.id]: false }));
    setActiveTaskId(section.tasks[0].id);
  }

  function removeTask(taskId: string) {
    const remainingTasks = learning.sections
      .flatMap((section) => section.tasks)
      .filter((task) => task.id !== taskId);
    setLearning((current) => ({
      sections: current.sections.map((section) => ({
        ...section,
        tasks: section.tasks.filter((task) => task.id !== taskId),
      })),
    }));
    if (activeTaskId === taskId) setActiveTaskId(remainingTasks[0]?.id || "");
  }

  function removeSection(sectionId: string) {
    const remainingSections = learning.sections.filter((section) => section.id !== sectionId);
    const remainingTasks = remainingSections.flatMap((section) => section.tasks);
    setLearning({ sections: remainingSections.length ? remainingSections : [createSection()] });
    setActiveTaskId(remainingTasks[0]?.id || "");
  }

  function toggleChecklist(item: ChecklistItem) {
    if (!activeTask || item.lineNumber < 1) return;
    const lines = activeTask.markdown.split("\n");
    const index = item.lineNumber - 1;
    const line = lines[index];
    if (!line) return;
    lines[index] = line.replace(
      /^(\s*[-*+]\s+\[)( |x|X)(\]\s+)/,
      (_match, start: string, checked: string, end: string) =>
        `${start}${checked.toLowerCase() === "x" ? " " : "x"}${end}`,
    );
    updateTask(activeTask.id, (current) => ({ ...current, markdown: lines.join("\n") }));
  }

  return (
    <main className="shell learningsPage">
      <section className="roadmapHeader learningsHeader"><div><h1>学習</h1></div></section>
      <section className="learningsWorkspace" aria-label="学習タスクとメモ">
        <aside className="learningsSidebar" aria-label="学習タスク">
          <div className="learningsSidebarHeader"><h2>学習対象</h2><button type="button" onClick={addSection} aria-label="学習対象を追加">＋</button></div>
          {learning.sections.map((section) => {
            const isCollapsed = collapsed[section.id] === true;
            return <section className="learningSection" key={section.id}>
              <header>
                <button className="learningSectionToggle" type="button" onClick={() => setCollapsed((current) => ({ ...current, [section.id]: !current[section.id] }))} aria-expanded={!isCollapsed}>
                  <span>{isCollapsed ? "›" : "⌄"}</span><strong>{section.title || "無題のセクション"}</strong><em>{section.tasks.length}</em>
                </button>
                <button className="learningSectionDelete" type="button" onClick={() => removeSection(section.id)} aria-label={`${section.title || "学習対象"}を削除`}>×</button>
              </header>
              {!isCollapsed && <>
                <input className="learningSectionName" aria-label="セクション名" value={section.title} onChange={(event) => { const title = event.currentTarget.value; updateSection(section.id, (current) => ({ ...current, title })); }} />
                <div className="learningTaskList">
                  {section.tasks.map((task) => <button key={task.id} type="button" className={activeTaskId === task.id ? "learningTask active" : "learningTask"} onClick={() => setActiveTaskId(task.id)}>
                    <input type="checkbox" checked={task.completed} aria-label={`${task.title}を完了`} onClick={(event) => event.stopPropagation()} onChange={(event) => { const completed = event.currentTarget.checked; updateTask(task.id, (current) => ({ ...current, completed })); }} />
                    <span className={task.completed ? "completed" : undefined}>{task.title || "無題のタスク"}</span>
                  </button>)}
                </div>
                <button className="learningAddTask" type="button" onClick={() => addTask(section.id)}>＋ タスクを追加</button>
              </>}
            </section>;
          })}
        </aside>
        <section className="learningsContent" aria-label="学習メモ">
          {activeTask ? <>
            <div className="learningTaskHeader">
              <input className="learningTaskTitle" aria-label="タスク名" value={activeTask.title} onChange={(event) => { const title = event.currentTarget.value; updateTask(activeTask.id, (current) => ({ ...current, title })); }} />
              <button className="learningTaskDelete" type="button" onClick={() => removeTask(activeTask.id)}>削除</button>
            </div>
            <div className="learningMemoWorkspace">
              <textarea aria-label="マークダウンメモ" value={activeTask.markdown} onChange={(event) => { const markdown = event.currentTarget.value; updateTask(activeTask.id, (current) => ({ ...current, markdown })); }} />
              <article className="learningMemoPreview"><MarkdownPreview markdown={activeTask.markdown} onToggleChecklist={toggleChecklist} /></article>
            </div>
          </> : <p className="emptyText">左のタスクを選択してください。</p>}
        </section>
      </section>
    </main>
  );
}
