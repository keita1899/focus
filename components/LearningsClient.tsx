"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChecklistItem, MarkdownPreview } from "./MarkdownMemoClient";

type LearningTask = { id: string; title: string; completed: boolean; markdown: string };
type LearningSection = { id: string; title: string; tasks: LearningTask[] };
type LearningSubject = { id: string; title: string; sections: LearningSection[] };
type LearningsState = { subjects: LearningSubject[] };
type LearningsClientProps = { initialValue: unknown };

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTask(): LearningTask {
  return { id: createId("learning-task"), title: "新しいタスク", completed: false, markdown: "# 学習メモ\n\n" };
}

function createSubject(title = "新しい教材"): LearningSubject {
  return { id: createId("learning-subject"), title, sections: [] };
}

function normalizeTask(value: unknown, index: number): LearningTask | null {
  if (!value || typeof value !== "object") return null;
  const task = value as Partial<LearningTask>;
  return {
    id: typeof task.id === "string" && task.id ? task.id : `learning-task-${index}`,
    title: typeof task.title === "string" ? task.title : "新しいタスク",
    completed: task.completed === true,
    markdown: typeof task.markdown === "string" ? task.markdown : "",
  };
}

function normalizeSection(value: unknown, index: number): LearningSection | null {
  if (!value || typeof value !== "object") return null;
  const section = value as Partial<LearningSection>;
  return {
    id: typeof section.id === "string" && section.id ? section.id : `learning-section-${index}`,
    title: typeof section.title === "string" ? section.title : "新しいセクション",
    tasks: Array.isArray(section.tasks)
      ? section.tasks.flatMap((task, taskIndex) => {
          const normalized = normalizeTask(task, taskIndex);
          return normalized ? [normalized] : [];
        })
      : [],
  };
}

function normalizeState(value: unknown): LearningsState {
  if (!value || typeof value !== "object") return { subjects: [createSubject()] };
  const source = value as { subjects?: unknown; sections?: unknown };
  const rawSubjects = Array.isArray(source.subjects)
    ? source.subjects
    : Array.isArray(source.sections)
      ? [{ id: "learning-subject-migrated", title: "教材 1", sections: source.sections }]
      : [];
  const subjects = rawSubjects.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const subject = value as Partial<LearningSubject>;
    return [{
      id: typeof subject.id === "string" && subject.id ? subject.id : `learning-subject-${index}`,
      title: typeof subject.title === "string" ? subject.title : "新しい教材",
      sections: Array.isArray(subject.sections)
        ? subject.sections.flatMap((section, sectionIndex) => {
            const normalized = normalizeSection(section, sectionIndex);
            return normalized ? [normalized] : [];
          })
        : [],
    }];
  });
  return { subjects: subjects.length ? subjects : [createSubject()] };
}

export default function LearningsClient({ initialValue }: LearningsClientProps) {
  const [learning, setLearning] = useState<LearningsState>(() => normalizeState(initialValue));
  const [activeSubjectId, setActiveSubjectId] = useState("");
  const [activeTaskId, setActiveTaskId] = useState("");
  const [newSubjectTitle, setNewSubjectTitle] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const hasMounted = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    try {
      const storedSubjectId = window.localStorage.getItem("learnings-active-subject-v1");
      if (storedSubjectId && learning.subjects.some((subject) => subject.id === storedSubjectId)) setActiveSubjectId(storedSubjectId);
    } catch {}
  }, [learning.subjects]);

  useEffect(() => {
    if (!activeSubjectId) return;
    try { window.localStorage.setItem("learnings-active-subject-v1", activeSubjectId); } catch {}
  }, [activeSubjectId]);

  const activeSubject = useMemo(
    () => learning.subjects.find((subject) => subject.id === activeSubjectId) || learning.subjects[0] || null,
    [activeSubjectId, learning.subjects],
  );
  const activeTask = useMemo(
    () => activeSubject?.sections.flatMap((section) => section.tasks).find((task) => task.id === activeTaskId) || null,
    [activeSubject, activeTaskId],
  );

  useEffect(() => {
    if (activeSubject && activeSubject.id !== activeSubjectId) setActiveSubjectId(activeSubject.id);
    if (!activeTask && activeSubject?.sections[0]?.tasks[0]) setActiveTaskId(activeSubject.sections[0].tasks[0].id);
  }, [activeSubject, activeSubjectId, activeTask]);

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    const timeoutId = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        const response = await fetch("/api/learnings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(learning) });
        if (!response.ok) throw new Error("学習内容の保存に失敗しました。");
      });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [learning]);

  function updateSubject(subjectId: string, updater: (subject: LearningSubject) => LearningSubject) {
    setLearning((current) => ({ subjects: current.subjects.map((subject) => subject.id === subjectId ? updater(subject) : subject) }));
  }

  function updateSection(sectionId: string, updater: (section: LearningSection) => LearningSection) {
    if (!activeSubject) return;
    updateSubject(activeSubject.id, (subject) => ({ ...subject, sections: subject.sections.map((section) => section.id === sectionId ? updater(section) : section) }));
  }

  function updateTask(taskId: string, updater: (task: LearningTask) => LearningTask) {
    if (!activeSubject) return;
    updateSubject(activeSubject.id, (subject) => ({ ...subject, sections: subject.sections.map((section) => ({ ...section, tasks: section.tasks.map((task) => task.id === taskId ? updater(task) : task) })) }));
  }

  function addSubject() {
    const title = newSubjectTitle.trim();
    if (!title) return;
    const subject = createSubject(title);
    setLearning((current) => ({ subjects: [...current.subjects, subject] }));
    setNewSubjectTitle("");
    setActiveSubjectId(subject.id);
    setActiveTaskId("");
  }

  function addSection() {
    if (!activeSubject) return;
    const title = newSectionTitle.trim();
    if (!title) return;
    const section: LearningSection = { id: createId("learning-section"), title, tasks: [] };
    updateSubject(activeSubject.id, (subject) => ({ ...subject, sections: [...subject.sections, section] }));
    setNewSectionTitle("");
    setCollapsed((current) => ({ ...current, [section.id]: false }));
  }

  function addTask(sectionId: string) {
    const task = createTask();
    updateSection(sectionId, (section) => ({ ...section, tasks: [...section.tasks, task] }));
    setActiveTaskId(task.id);
  }

  function removeSubject(subjectId: string) {
    const remaining = learning.subjects.filter((subject) => subject.id !== subjectId);
    const nextSubjects = remaining.length ? remaining : [createSubject()];
    setLearning({ subjects: nextSubjects });
    setActiveSubjectId(nextSubjects[0].id);
    setActiveTaskId(nextSubjects[0].sections[0]?.tasks[0]?.id || "");
  }

  function removeSection(sectionId: string) {
    if (!activeSubject) return;
    const nextSections = activeSubject.sections.filter((section) => section.id !== sectionId);
    updateSubject(activeSubject.id, (subject) => ({ ...subject, sections: nextSections }));
    setActiveTaskId(nextSections[0]?.tasks[0]?.id || "");
  }

  function removeTask(taskId: string) {
    if (!activeSubject) return;
    const remaining = activeSubject.sections.flatMap((section) => section.tasks).filter((task) => task.id !== taskId);
    updateSubject(activeSubject.id, (subject) => ({ ...subject, sections: subject.sections.map((section) => ({ ...section, tasks: section.tasks.filter((task) => task.id !== taskId) })) }));
    if (activeTaskId === taskId) setActiveTaskId(remaining[0]?.id || "");
  }

  function toggleChecklist(item: ChecklistItem) {
    if (!activeTask || item.lineNumber < 1) return;
    const lines = activeTask.markdown.split("\n");
    const index = item.lineNumber - 1;
    if (!lines[index]) return;
    lines[index] = lines[index].replace(/^(\s*[-*+]\s+\[)( |x|X)(\]\s+)/, (_match, start: string, checked: string, end: string) => `${start}${checked.toLowerCase() === "x" ? " " : "x"}${end}`);
    updateTask(activeTask.id, (current) => ({ ...current, markdown: lines.join("\n") }));
  }

  return <main className="shell learningsPage">
    <section className="roadmapHeader learningsHeader"><div><h1>学習</h1></div></section>
    <section className="learningSubjectBar" aria-label="教材を切り替え">
      <div className="learningSubjectTabs">
        {learning.subjects.map((subject) => <button key={subject.id} type="button" className={activeSubject?.id === subject.id ? "active" : undefined} onClick={() => { setActiveSubjectId(subject.id); setActiveTaskId(subject.sections[0]?.tasks[0]?.id || ""); }}>{subject.title || "無題の教材"}</button>)}
      </div>
      <form className="learningAddSubject" onSubmit={(event) => { event.preventDefault(); addSubject(); }}><input aria-label="教材名" placeholder="教材名" value={newSubjectTitle} onChange={(event) => setNewSubjectTitle(event.currentTarget.value)} /><button type="submit">追加</button></form>
    </section>
    <section className="learningsWorkspace" aria-label="学習タスクとメモ">
      <aside className="learningsSidebar" aria-label="教材のセクションとタスク">
        <div className="learningsSidebarHeader">
          {activeSubject && <input className="learningSubjectTitle" aria-label="教材名を編集" value={activeSubject.title} onChange={(event) => { const title = event.currentTarget.value; updateSubject(activeSubject.id, (current) => ({ ...current, title })); }} />}
          {activeSubject && <button className="learningSubjectDelete" type="button" onClick={() => removeSubject(activeSubject.id)} aria-label={`${activeSubject.title || "教材"}を削除`}>×</button>}
        </div>
        <form className="learningAddSection" onSubmit={(event) => { event.preventDefault(); addSection(); }}><input aria-label="セクション名" placeholder="セクション名" value={newSectionTitle} onChange={(event) => setNewSectionTitle(event.currentTarget.value)} /><button type="submit">＋</button></form>
        {activeSubject?.sections.map((section) => {
          const isCollapsed = collapsed[section.id] === true;
          return <section className="learningSection" key={section.id}><header>
            <button className="learningSectionToggle" type="button" onClick={() => setCollapsed((current) => ({ ...current, [section.id]: !current[section.id] }))} aria-expanded={!isCollapsed}><span>{isCollapsed ? "›" : "⌄"}</span><strong>{section.title || "無題のセクション"}</strong><em>{section.tasks.length}</em></button>
            <button className="learningSectionDelete" type="button" onClick={() => removeSection(section.id)} aria-label={`${section.title || "セクション"}を削除`}>×</button>
          </header>{!isCollapsed && <><input className="learningSectionName" aria-label="セクション名を編集" value={section.title} onChange={(event) => { const title = event.currentTarget.value; updateSection(section.id, (current) => ({ ...current, title })); }} />
            <div className="learningTaskList">{section.tasks.map((task) => <button key={task.id} type="button" className={activeTaskId === task.id ? "learningTask active" : "learningTask"} onClick={() => setActiveTaskId(task.id)}><input type="checkbox" checked={task.completed} aria-label={`${task.title}を完了`} onClick={(event) => event.stopPropagation()} onChange={(event) => { const completed = event.currentTarget.checked; updateTask(task.id, (current) => ({ ...current, completed })); }} /><span className={task.completed ? "completed" : undefined}>{task.title || "無題のタスク"}</span></button>)}</div>
            <button className="learningAddTask" type="button" onClick={() => addTask(section.id)}>＋ タスクを追加</button></>}</section>;
        })}
      </aside>
      <section className="learningsContent" aria-label="学習メモ">{activeTask ? <><div className="learningTaskHeader"><input className="learningTaskTitle" aria-label="タスク名" value={activeTask.title} onChange={(event) => { const title = event.currentTarget.value; updateTask(activeTask.id, (current) => ({ ...current, title })); }} /><button className="learningTaskDelete" type="button" onClick={() => removeTask(activeTask.id)} aria-label={`${activeTask.title || "タスク"}を削除`}>×</button></div><div className="learningMemoWorkspace"><textarea aria-label="マークダウンメモ" value={activeTask.markdown} onChange={(event) => { const markdown = event.currentTarget.value; updateTask(activeTask.id, (current) => ({ ...current, markdown })); }} /><article className="learningMemoPreview"><MarkdownPreview markdown={activeTask.markdown} onToggleChecklist={toggleChecklist} /></article></div></> : <p className="emptyText">セクションを追加してからタスクを選択してください。</p>}</section>
    </section>
  </main>;
}
