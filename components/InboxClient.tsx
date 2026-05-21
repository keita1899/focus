"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

type InboxTask = {
  id: string;
  title: string;
  date: string;
  createdAt: string;
};

type InboxClientProps = {
  initialValue: unknown;
};

const storageKey = "inbox-markdown-v1";

function createId() {
  return `inbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function getMonthKey(dateKey: string) {
  if (!dateKey) return "";
  return dateKey.slice(0, 7);
}

function getCurrentMonthKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string) {
  const month = monthKey.split("-")[1];
  return `${Number(month)}月`;
}

function normalizeTasks(value: unknown): InboxTask[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((task, index) => {
      const item = task as Partial<InboxTask>;
      if (!item.title) return null;

      return {
        id: item.id || `inbox-${index + 1}`,
        title: item.title,
        date: item.date || "",
        createdAt: item.createdAt || new Date().toISOString(),
      };
    })
    .filter((task): task is InboxTask => Boolean(task))
    .sort((first, second) =>
      first.date === second.date
        ? first.createdAt.localeCompare(second.createdAt)
        : first.date.localeCompare(second.date),
    );
}

function getYearMonthKeys(year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
}

export default function InboxClient({ initialValue }: InboxClientProps) {
  const initialTasks = useMemo(() => normalizeTasks(initialValue), [initialValue]);
  const [tasks, setTasks] = useState<InboxTask[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(getTodayKey());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingTaskId, setEditingTaskId] = useState("");
  const [isReady, setIsReady] = useState(initialValue !== null);
  const todayKey = getTodayKey();
  const currentMonthKey = getCurrentMonthKey();

  const monthKeys = useMemo(() => getYearMonthKeys(selectedYear), [selectedYear]);
  const undatedTasks = useMemo(
    () => tasks.filter((task) => !task.date),
    [tasks],
  );
  const visibleMonthKeys = useMemo(
    () =>
      monthKeys.filter((monthKey) => {
        if (monthKey >= currentMonthKey) return true;
        return tasks.some(
          (task) =>
            task.date && getMonthKey(task.date) === monthKey && task.date < todayKey,
        );
      }),
    [currentMonthKey, monthKeys, tasks, todayKey],
  );

  useEffect(() => {
    if (initialValue !== null) return;

    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      setTasks(normalizeTasks(JSON.parse(stored)));
      window.localStorage.removeItem(storageKey);
    }

    setIsReady(true);
  }, [initialValue]);

  useEffect(() => {
    if (!isReady) return;

    fetch("/api/inbox", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tasks),
    }).catch(() => undefined);
  }, [isReady, tasks]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const taskTitle = title.trim();
    if (!taskTitle) return;

    setTasks((current) =>
      [
        ...current,
        {
          id: createId(),
          title: taskTitle,
          date,
          createdAt: new Date().toISOString(),
        },
      ].sort((first, second) =>
        first.date === second.date
          ? first.createdAt.localeCompare(second.createdAt)
          : first.date.localeCompare(second.date),
      ),
    );
    setTitle("");
  }

  function completeTask(taskId: string) {
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  function updateTask(taskId: string, value: Partial<Pick<InboxTask, "date" | "title">>) {
    setTasks((current) =>
      current
        .map((task) => (task.id === taskId ? { ...task, ...value } : task))
        .sort((first, second) =>
          first.date === second.date
            ? first.createdAt.localeCompare(second.createdAt)
            : first.date.localeCompare(second.date),
        ),
    );
  }

  function finishEditing(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === "Escape") {
      event.currentTarget.blur();
      setEditingTaskId("");
    }
  }

  function scrollToMonth(monthKey: string) {
    if (monthKey === "undated") {
      document
        .getElementById("inbox-undated")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }

    document
      .getElementById(`inbox-month-${monthKey}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <main className="shell inboxPage">
      <section className="inboxHeader" aria-label="Inbox">
        <div>
          <a className="backLink" href="/">
            ← メイン
          </a>
          <h1>Inbox</h1>
        </div>
      </section>

      <div className="inboxTodoLayout">
        <aside className="inboxMonthSidebar" aria-label="月一覧">
          <div className="inboxYearSwitcher">
            <button
              type="button"
              onClick={() => setSelectedYear((current) => current - 1)}
              aria-label="前年"
            >
              &lt;
            </button>
            <strong>{selectedYear}年</strong>
            <button
              type="button"
              onClick={() => setSelectedYear((current) => current + 1)}
              aria-label="翌年"
            >
              &gt;
            </button>
          </div>
          {undatedTasks.length > 0 && (
            <button
              className="inboxMonthLink"
              type="button"
              onClick={() => scrollToMonth("undated")}
            >
              未定
            </button>
          )}
          {visibleMonthKeys.map((monthKey) => (
            <button
              className={
                monthKey === currentMonthKey
                  ? "inboxMonthLink active"
                  : "inboxMonthLink"
              }
              key={monthKey}
              type="button"
              onClick={() => scrollToMonth(monthKey)}
            >
              {formatMonthLabel(monthKey)}
            </button>
          ))}
        </aside>

        <section className="inboxTodoPanel" aria-label="Inboxタスク">
          <form className="inboxTaskForm" onSubmit={addTask}>
            <input
              aria-label="タスク名"
              placeholder="タスク名"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <input
              aria-label="日付"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <button
              className="secondary"
              type="button"
              onClick={() => setDate("")}
            >
              未定
            </button>
            <button type="submit">追加</button>
          </form>

          <div className="inboxMonthTasks">
            {undatedTasks.length > 0 && (
              <section
                className="inboxTodoMonth"
                id="inbox-undated"
                aria-label="未定タスク"
              >
                <h2>未定</h2>
                <div className="inboxTodoList">
                  {undatedTasks.map((task) => (
                    <div className="inboxTodoItem undated" key={task.id}>
                      <button
                        className="checkButton"
                        type="button"
                        onClick={() => completeTask(task.id)}
                        aria-label={`${task.title}を完了`}
                      />
                      <div className="inboxTodoContent">
                        {editingTaskId === task.id ? (
                          <input
                            aria-label="タスク名を編集"
                            className="inboxTodoTitleInput"
                            autoFocus
                            value={task.title}
                            onBlur={() => setEditingTaskId("")}
                            onChange={(event) =>
                              updateTask(task.id, {
                                title: event.target.value,
                              })
                            }
                            onKeyDown={finishEditing}
                          />
                        ) : (
                          <strong onDoubleClick={() => setEditingTaskId(task.id)}>
                            {task.title}
                          </strong>
                        )}
                        <div className="inboxTodoMeta">
                          <input
                            aria-label={`${task.title}の日付`}
                            type="date"
                            value={task.date}
                            onChange={(event) =>
                              updateTask(task.id, {
                                date: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {visibleMonthKeys.map((monthKey) => {
              const monthTasks = tasks.filter(
                (task) => getMonthKey(task.date) === monthKey,
              );

              return (
                <section
                  className="inboxTodoMonth"
                  id={`inbox-month-${monthKey}`}
                  key={monthKey}
                >
                  <h2>{formatMonthLabel(monthKey)}</h2>
                  {monthTasks.length === 0 ? (
                    <p className="emptyText compact">タスクなし</p>
                  ) : (
                    <div className="inboxTodoList">
                      {monthTasks.map((task) => {
                        const isExpired = task.date < todayKey;
                        const isToday = task.date === todayKey;
                        return (
                          <div
                            className={
                              [
                                "inboxTodoItem",
                                isExpired ? "expired" : "",
                                isToday ? "today" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")
                            }
                            key={task.id}
                          >
                            <button
                              className="checkButton"
                              type="button"
                              onClick={() => completeTask(task.id)}
                              aria-label={`${task.title}を完了`}
                            />
                            <div className="inboxTodoContent">
                              {editingTaskId === task.id ? (
                                <input
                                  aria-label="タスク名を編集"
                                  className="inboxTodoTitleInput"
                                  autoFocus
                                  value={task.title}
                                  onBlur={() => setEditingTaskId("")}
                                  onChange={(event) =>
                                    updateTask(task.id, {
                                      title: event.target.value,
                                    })
                                  }
                                  onKeyDown={finishEditing}
                                />
                              ) : (
                                <strong onDoubleClick={() => setEditingTaskId(task.id)}>
                                  {task.title}
                                </strong>
                              )}
                              <div className="inboxTodoMeta">
                                {isExpired && <span>期限切れ</span>}
                                <input
                                  aria-label={`${task.title}の日付`}
                                  type="date"
                                  value={task.date}
                                  onChange={(event) =>
                                    updateTask(task.id, {
                                      date: event.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
