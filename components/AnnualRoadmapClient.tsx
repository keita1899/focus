"use client";

import { FormEvent, Fragment, useEffect, useRef, useState } from "react";

type RoadmapTask = { id: string; title: string; children: RoadmapTask[]; scheduledDate?: string; scheduledTime?: string; done?: boolean };
type MonthPlan = { theme: string; mustDo: RoadmapTask[]; chores: RoadmapTask[]; other: RoadmapTask[] };
type YearPlan = { title: string; themes: string[]; months: Record<string, MonthPlan> };
type RoadmapState = { years: Record<string, YearPlan> };
type TaskKind = "mustDo" | "chores" | "other";

const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const taskLabels: Record<TaskKind, string> = { mustDo: "やるべきこと", chores: "雑務タスク", other: "その他" };

function createTask(title = ""): RoadmapTask { return { id: `roadmap-task-${Date.now()}-${Math.random().toString(16).slice(2)}`, title, children: [] }; }
function createMonthPlan(): MonthPlan { return { theme: "", mustDo: [createTask()], chores: [createTask()], other: [createTask()] }; }
function createYearPlan(): YearPlan { return { title: "", themes: ["", "", ""], months: Object.fromEntries(monthLabels.map((_, index) => [String(index + 1), createMonthPlan()])) }; }
function normalizeState(value: unknown, currentYear: number): RoadmapState {
  const source = value && typeof value === "object" ? value as Partial<RoadmapState> : {};
  const years: Record<string, YearPlan> = {};
  Object.entries(source.years || {}).forEach(([year, raw]) => {
    const plan = raw && typeof raw === "object" ? raw as Partial<YearPlan> : {};
    const rawMonths = plan.months && typeof plan.months === "object" ? plan.months : {};
    years[year] = {
      title: typeof plan.title === "string" ? plan.title : "",
      themes: Array.from({ length: 3 }, (_, index) => Array.isArray(plan.themes) && typeof plan.themes[index] === "string" ? plan.themes[index] : ""),
      months: Object.fromEntries(monthLabels.map((_, index) => {
        const rawMonth = rawMonths[String(index + 1)] as Partial<MonthPlan> | undefined;
        const tasks = (kind: TaskKind) => Array.isArray(rawMonth?.[kind]) ? rawMonth![kind]!.map((task, taskIndex) => {
          if (typeof task === "string") return { id: `legacy-${year}-${index}-${taskIndex}`, title: task, children: [] };
          const item = task as Partial<RoadmapTask>;
          return { id: typeof item.id === "string" ? item.id : `task-${year}-${index}-${taskIndex}`, title: typeof item.title === "string" ? item.title : "", scheduledDate: typeof item.scheduledDate === "string" ? item.scheduledDate : undefined, scheduledTime: typeof item.scheduledTime === "string" ? item.scheduledTime : undefined, children: Array.isArray(item.children) ? item.children.map((child, childIndex) => { const childItem = child as Partial<RoadmapTask>; return { id: typeof childItem.id === "string" ? childItem.id : `child-${year}-${index}-${taskIndex}-${childIndex}`, title: typeof childItem.title === "string" ? childItem.title : "", scheduledDate: typeof childItem.scheduledDate === "string" ? childItem.scheduledDate : undefined, scheduledTime: typeof childItem.scheduledTime === "string" ? childItem.scheduledTime : undefined, children: [] }; }) : [] };
        }) : [createTask()];
        const mustDo = tasks("mustDo"); const chores = tasks("chores"); const other = tasks("other");
        return [String(index + 1), { theme: typeof rawMonth?.theme === "string" ? rawMonth.theme : "", mustDo: mustDo.length ? mustDo : [createTask()], chores: chores.length ? chores : [createTask()], other: other.length ? other : [createTask()] }];
      })),
    };
  });
  if (!years[String(currentYear)]) years[String(currentYear)] = createYearPlan();
  return { years };
}

function saveRoadmap(value: string) { return fetch("/api/annual-roadmap", { method: "PUT", headers: { "Content-Type": "application/json" }, body: value, keepalive: true }).catch(() => undefined); }

function sortTasksBySchedule(tasks: RoadmapTask[]) {
  return [...tasks].sort((left, right) => {
    const leftSchedule = left.scheduledDate ? `${left.scheduledDate}T${left.scheduledTime || "23:59"}` : "9999-12-31T23:59";
    const rightSchedule = right.scheduledDate ? `${right.scheduledDate}T${right.scheduledTime || "23:59"}` : "9999-12-31T23:59";
    return leftSchedule.localeCompare(rightSchedule);
  });
}

function TaskAddControl({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (title: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    onAdd(value);
    setTitle("");
    setIsEditing(false);
  };

  if (!isEditing) return <button className="annualRoadmapAddTask" type="button" onClick={() => setIsEditing(true)}>＋ {label}</button>;
  return <form className="annualRoadmapAddForm" onSubmit={submit}>
    <input autoFocus value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder={placeholder} aria-label={placeholder} />
    <button type="submit">追加</button>
  </form>;
}

function localDateValue(offset = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatScheduleLabel(date?: string, time?: string) {
  if (!date) return "";
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}${time ? ` ${time}` : ""}`;
}

function isPastSchedule(date?: string) {
  return Boolean(date && date < localDateValue());
}

function isTodaySchedule(date?: string) {
  return date === localDateValue();
}

function TaskSchedulePicker({ task, isOpen, onOpenChange, onChange }: { task: RoadmapTask; isOpen: boolean; onOpenChange: (open: boolean) => void; onChange: (value: Partial<RoadmapTask>) => void }) {
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onOpenChange]);

  const chooseDate = (scheduledDate?: string) => {
    onChange(scheduledDate ? { scheduledDate } : { scheduledDate, scheduledTime: undefined });
    onOpenChange(false);
  };

  return <div className="roadmapSchedulePicker" ref={pickerRef}>
    <button className={`roadmapScheduleTrigger${isPastSchedule(task.scheduledDate) ? " isOverdue" : isTodaySchedule(task.scheduledDate) ? " isToday" : ""}`} type="button" aria-label={`${task.title || "タスク"}の予定を設定`} aria-expanded={isOpen} onClick={() => onOpenChange(!isOpen)}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></svg>
      {task.scheduledDate && <span>{formatScheduleLabel(task.scheduledDate, task.scheduledTime)}</span>}
    </button>
    {isOpen && <div className="roadmapScheduleMenu">
      <button type="button" onClick={() => chooseDate(localDateValue())}>今日</button>
      <button type="button" onClick={() => chooseDate(localDateValue(1))}>明日</button>
      <button type="button" onClick={() => chooseDate(undefined)}>未定</button>
      <label>日付を選択<input type="date" value={task.scheduledDate || ""} onChange={(event) => { onChange({ scheduledDate: event.currentTarget.value || undefined }); onOpenChange(false); }} /></label>
      <label className="roadmapScheduleTime">時間<input type="time" value={task.scheduledTime || ""} disabled={!task.scheduledDate} onChange={(event) => { onChange({ scheduledTime: event.currentTarget.value || undefined }); onOpenChange(false); }} /></label>
      {task.scheduledDate && <button type="button" className="roadmapScheduleClear" onClick={() => chooseDate(undefined)}>日付と時間を削除</button>}
    </div>}
  </div>;
}

export default function AnnualRoadmapClient({ initialValue, birthday = "", onStateChange }: { initialValue: unknown; birthday?: string; onStateChange?: (value: unknown) => void }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [roadmap, setRoadmap] = useState(() => normalizeState(initialValue, currentYear));
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>(() => ({ [String(new Date().getMonth() + 1)]: true }));
  const [editingThemeMonth, setEditingThemeMonth] = useState<string | null>(null);
  const [showPastMonths, setShowPastMonths] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const [openScheduleTaskId, setOpenScheduleTaskId] = useState<string | null>(null);
  const roadmapRef = useRef(roadmap); roadmapRef.current = roadmap;
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef<string | null>(null);
  const yearPlan = roadmap.years[String(selectedYear)] || createYearPlan();
  const birthYear = Number(birthday.slice(0, 4));
  const age = birthYear ? selectedYear - birthYear : null;
  const currentMonth = new Date().getMonth() + 1;
  const orderedMonths = selectedYear === currentYear
    ? Array.from({ length: 12 }, (_, index) => ((currentMonth - 1 + index) % 12) + 1)
    : Array.from({ length: 12 }, (_, index) => index + 1);
  const visibleMonths = selectedYear === currentYear && !showPastMonths
    ? orderedMonths.slice(0, 13 - currentMonth)
    : orderedMonths;

  function enqueue(value: string) {
    if (pendingRef.current === value) return;
    pendingRef.current = value;
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => { await saveRoadmap(value); if (pendingRef.current === value) pendingRef.current = null; });
  }
  function update(updater: (current: RoadmapState) => RoadmapState) {
    const next = updater(roadmapRef.current); roadmapRef.current = next; setRoadmap(next); onStateChange?.(next); enqueue(JSON.stringify(next));
  }
  useEffect(() => () => enqueue(JSON.stringify(roadmapRef.current)), []);
  function changeYear(direction: -1 | 1) {
    const nextYear = selectedYear + direction; setSelectedYear(nextYear);
    setOpenMonths(nextYear === currentYear ? { [String(currentMonth)]: true } : {});
    setEditingThemeMonth(null);
    setShowPastMonths(false);
    update((current) => current.years[String(nextYear)] ? current : { ...current, years: { ...current.years, [String(nextYear)]: createYearPlan() } });
  }
  function updateYear(value: Partial<YearPlan>) { update((current) => ({ ...current, years: { ...current.years, [String(selectedYear)]: { ...yearPlan, ...value } } })); }
  function updateMonth(month: string, value: Partial<MonthPlan>) { update((current) => ({ ...current, years: { ...current.years, [String(selectedYear)]: { ...yearPlan, months: { ...yearPlan.months, [month]: { ...yearPlan.months[month], ...value } } } } })); }
  function updateTask(month: string, kind: Exclude<TaskKind, "mustDo">, id: string, value: Partial<RoadmapTask>) { updateMonth(month, { [kind]: yearPlan.months[month][kind].map((task) => task.id === id ? { ...task, ...value } : task) }); }
  function addTask(month: string, kind: Exclude<TaskKind, "mustDo">, title: string) { updateMonth(month, { [kind]: [...yearPlan.months[month][kind], createTask(title)] }); }
  function removeTask(month: string, kind: Exclude<TaskKind, "mustDo">, id: string) { const tasks = yearPlan.months[month][kind].filter((task) => task.id !== id); updateMonth(month, { [kind]: tasks.length ? tasks : [createTask()] }); }
  function updateMustDo(month: string, id: string, value: Partial<RoadmapTask>, parentId?: string) { const tasks = yearPlan.months[month].mustDo.map((task) => parentId ? task.id === parentId ? { ...task, children: task.children.map((child) => child.id === id ? { ...child, ...value } : child) } : task : task.id === id ? { ...task, ...value } : task); updateMonth(month, { mustDo: tasks }); }
  function addMustDo(month: string, title: string, parentId?: string) { const nextTask = createTask(title); const tasks = parentId ? yearPlan.months[month].mustDo.map((task) => task.id === parentId ? { ...task, children: [...task.children, nextTask] } : task) : [...yearPlan.months[month].mustDo, nextTask]; updateMonth(month, { mustDo: tasks }); }
  function removeMustDo(month: string, id: string, parentId?: string) { const tasks = parentId ? yearPlan.months[month].mustDo.map((task) => task.id === parentId ? { ...task, children: task.children.filter((child) => child.id !== id) } : task) : yearPlan.months[month].mustDo.filter((task) => task.id !== id); updateMonth(month, { mustDo: tasks.length ? tasks : [createTask()] }); }
  function taskGroup(month: string, kind: TaskKind) {
    if (kind === "mustDo") {
      const tasks = sortTasksBySchedule(yearPlan.months[month].mustDo);
      return <section className="annualRoadmapTaskGroup annualRoadmapMustDoGroup" key={kind}><h3>{taskLabels[kind]}</h3>{tasks.map((task) => { const collapsed = collapsedParents[task.id]; const scheduleKey = `${selectedYear}-${month}-${kind}-root-${task.id}`; return <div className="annualRoadmapParentTask" key={task.id}><div className="annualRoadmapTask annualRoadmapScheduledTask">{task.children.length > 0 ? <button className="annualRoadmapParentToggle" type="button" onClick={() => setCollapsedParents((current) => ({ ...current, [task.id]: !collapsed }))} aria-label="子タスクを開閉">{collapsed ? "›" : "⌄"}</button> : <span aria-hidden="true" />}<input data-roadmap-task-id={task.id} value={task.title} placeholder="やるべきこと" onChange={(event) => updateMustDo(month, task.id, { title: event.target.value })} /><TaskSchedulePicker task={task} isOpen={openScheduleTaskId === scheduleKey} onOpenChange={(open) => setOpenScheduleTaskId(open ? scheduleKey : null)} onChange={(value) => updateMustDo(month, task.id, value)} /><button type="button" onClick={() => removeMustDo(month, task.id)} aria-label="やるべきことを削除">×</button></div>{!collapsed && <div className="annualRoadmapChildTasks">{sortTasksBySchedule(task.children).map((child) => { const childScheduleKey = `${scheduleKey}-child-${child.id}`; return <div className="annualRoadmapTask annualRoadmapScheduledTask" key={child.id}><span aria-hidden="true" /><input data-roadmap-task-id={child.id} value={child.title} placeholder="子タスク" onChange={(event) => updateMustDo(month, child.id, { title: event.target.value }, task.id)} /><TaskSchedulePicker task={child} isOpen={openScheduleTaskId === childScheduleKey} onOpenChange={(open) => setOpenScheduleTaskId(open ? childScheduleKey : null)} onChange={(value) => updateMustDo(month, child.id, value, task.id)} /><button type="button" onClick={() => removeMustDo(month, child.id, task.id)} aria-label="子タスクを削除">×</button></div>; })}<TaskAddControl label="子タスクを追加" placeholder="子タスク" onAdd={(title) => addMustDo(month, title, task.id)} /></div>}</div>; })}<TaskAddControl label="タスクを追加" placeholder="やるべきこと" onAdd={(title) => addMustDo(month, title)} /></section>;
    }
    const tasks = sortTasksBySchedule(yearPlan.months[month][kind]);
    return <section className="annualRoadmapTaskGroup" key={kind}><h3>{taskLabels[kind]}</h3>{tasks.map((task) => { const scheduleKey = `${selectedYear}-${month}-${kind}-root-${task.id}`; return <div className="annualRoadmapTask annualRoadmapScheduledTask" key={task.id}><span aria-hidden="true" /><input data-roadmap-task-id={task.id} value={task.title} placeholder={taskLabels[kind]} onChange={(event) => updateTask(month, kind, task.id, { title: event.target.value })} /><TaskSchedulePicker task={task} isOpen={openScheduleTaskId === scheduleKey} onOpenChange={(open) => setOpenScheduleTaskId(open ? scheduleKey : null)} onChange={(value) => updateTask(month, kind, task.id, value)} /><button type="button" onClick={() => removeTask(month, kind, task.id)} aria-label={`${taskLabels[kind]}を削除`}>×</button></div>; })}<TaskAddControl label="タスクを追加" placeholder={taskLabels[kind]} onAdd={(title) => addTask(month, kind, title)} /></section>;
  }

  return <main className="shell roadmapPage annualRoadmapPage">
    <section className="annualRoadmapForm"><div className="annualRoadmapTitleRow"><label className="annualRoadmapTitleField"><input aria-label="年間ロードマップのタイトル" value={yearPlan.title} placeholder="この年のロードマップ" onChange={(event) => updateYear({ title: event.target.value })} /></label><div className="annualRoadmapToolbar"><div className="annualRoadmapYearSwitcher"><button type="button" onClick={() => changeYear(-1)} aria-label="前年へ">&lt;</button><strong>{selectedYear}年</strong>{age !== null && <span>{age}歳</span>}<button type="button" onClick={() => changeYear(1)} aria-label="翌年へ">&gt;</button></div></div></div><fieldset><legend>年間テーマ</legend>{yearPlan.themes.map((theme, index) => <input key={index} value={theme} placeholder={`テーマ ${index + 1}`} onChange={(event) => { const themes = [...yearPlan.themes]; themes[index] = event.target.value; updateYear({ themes }); }} />)}</fieldset></section>
    <div className="annualRoadmapMonths">{visibleMonths.map((monthNumber) => { const month = String(monthNumber); const label = `${month}月`; const plan = yearPlan.months[month]; const isOpen = Boolean(openMonths[month]); const isCurrentMonth = selectedYear === currentYear && monthNumber === currentMonth; const isCompletedMonthsStart = selectedYear === currentYear && monthNumber === 1 && currentMonth !== 1; const isEditingTheme = editingThemeMonth === month; return <Fragment key={month}><section className={`annualRoadmapMonth${isCompletedMonthsStart ? " isCompletedMonthsStart" : ""}`}><div className={`annualRoadmapMonthHeader${isCurrentMonth ? " isCurrentMonth" : ""}`} aria-current={isCurrentMonth ? "date" : undefined}><button className="annualRoadmapMonthToggle" type="button" onClick={() => setOpenMonths((current) => ({ ...current, [month]: !isOpen }))} aria-label={`${label}を${isOpen ? "閉じる" : "開く"}`} aria-expanded={isOpen}>{isOpen ? "⌃" : "⌄"}</button><div className="annualRoadmapMonthTheme" onDoubleClick={() => setEditingThemeMonth(month)}><strong>{label}</strong>{isEditingTheme ? <input autoFocus value={plan.theme} onChange={(event) => updateMonth(month, { theme: event.target.value })} onBlur={() => setEditingThemeMonth(null)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={`${label}の月間テーマ`} /> : plan.theme && <span>{plan.theme}</span>}</div></div>{isOpen && <div className="annualRoadmapMonthBody">{taskGroup(month, "mustDo")}<div className="annualRoadmapTaskColumns">{taskGroup(month, "chores")}{taskGroup(month, "other")}</div></div>}</section>{selectedYear === currentYear && monthNumber === 12 && currentMonth !== 1 && <button className="annualRoadmapPastMonthsToggle" type="button" onClick={() => setShowPastMonths((current) => !current)} aria-expanded={showPastMonths}>{showPastMonths ? "過去の月を隠す" : "過去の月を見る"}</button>}</Fragment>; })}</div>
  </main>;
}
