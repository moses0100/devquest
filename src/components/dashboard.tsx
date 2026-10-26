"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleCheck, Code2, Flame, LayoutDashboard, ListTodo, LoaderCircle, MoreHorizontal, Plus, Search, Settings2, Sparkles, Target, Trash2, X, Zap } from "lucide-react";
import { Action, Entry, Goal, QuestState, Status, actionSchema, applyAction, localDate, seedState, stateSchema, streak } from "@/lib/domain";
import { parseSavedState } from "@/lib/storage";
import { downloadJson } from "@/lib/download";

type View = "dashboard" | "goals" | "tasks" | "journal";
type Modal = "goal" | "task" | "entry" | "settings" | null;
const navigation = [{ id: "dashboard", label: "ภาพรวม", icon: LayoutDashboard }, { id: "goals", label: "เป้าหมายของฉัน", icon: Target }, { id: "tasks", label: "บอร์ดงาน", icon: ListTodo }, { id: "journal", label: "บันทึกการเรียน", icon: BookOpen }] as const;
const statusLabels: Record<Status, string> = { todo: "ยังไม่เริ่ม", doing: "กำลังทำ", done: "เสร็จแล้ว" };
const STORAGE_KEY = "devquest.v1";
const databaseMode = process.env.NEXT_PUBLIC_DATA_MODE === "database";
const emptyState: QuestState = { goals: [], tasks: [], entries: [] };
const prettyDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

export default function Dashboard() {
  const [state, setState] = useState<QuestState>(emptyState);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  const fetchState = useCallback(async (key?: string) => {
    const token = key ?? sessionStorage.getItem("devquest.access") ?? "";
    const response = await fetch("/api/quests", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "โหลดข้อมูลไม่สำเร็จ");
    return stateSchema.parse(result);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let loaded: QuestState;
        if (databaseMode) loaded = await fetchState();
        else {
          const saved = localStorage.getItem(STORAGE_KEY);
          loaded = saved === null ? seedState() : parseSavedState(saved);
          if (saved === null) localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
        }
        if (active) { setState(loaded); setReady(true); }
      } catch {
        if (active) { setError(databaseMode ? "โหลดข้อมูลไม่ได้ ตรวจฐานข้อมูลหรือกรอก Access key ในการตั้งค่า" : "อ่านข้อมูลในเบราว์เซอร์ไม่ได้ กรุณาอนุญาตการจัดเก็บข้อมูล โดยข้อมูลเดิมจะไม่ถูกเขียนทับ"); setReady(false); }
      }
    }
    void load();
    function sync(event: StorageEvent) {
      if (!databaseMode && event.storageArea === localStorage && (event.key === STORAGE_KEY || event.key === null)) {
        try {
          setState(parseSavedState(event.newValue));
          setReady(true);
          setError("");
        } catch {
          setReady(false);
          setError("ข้อมูลจากอีกแท็บถูกลบหรือไม่ถูกต้อง กรุณาโหลดหน้าใหม่ก่อนบันทึก");
        }
      }
    }
    window.addEventListener("storage", sync);
    return () => { active = false; window.removeEventListener("storage", sync); };
  }, [fetchState]);

  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => { if (!notice) return; const timeout = setTimeout(() => setNotice(""), 4000); return () => clearTimeout(timeout); }, [notice]);

  async function mutate(raw: Action) {
    if (busy || !ready) return false;
    setBusy(true); setError("");
    try {
      const action = actionSchema.parse(raw);
      if (databaseMode) {
        const response = await fetch("/api/quests", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("devquest.access") ?? ""}` }, body: JSON.stringify(action) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "บันทึกไม่สำเร็จ");
        setState(await fetchState());
      } else {
        // Read the latest persisted snapshot to preserve updates made in another tab.
        const saved = localStorage.getItem(STORAGE_KEY);
        const current = parseSavedState(saved);
        const next = applyAction(current, action);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setState(next);
      }
      setNotice("บันทึกเรียบร้อยแล้ว");
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ"); return false; }
    finally { setBusy(false); }
  }

  function openModal(next: Modal) { setError(""); setModal(next); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    let action: Action;
    if (modal === "goal") action = { type: "goal.create", title: text("title"), category: text("category") };
    else if (modal === "task") action = { type: "task.create", title: text("title"), goalId: text("goalId") };
    else if (modal === "entry") action = { type: "entry.create", title: text("title"), content: text("content"), minutes: Number(text("minutes")), date: text("date"), goalId: text("goalId") || null };
    else return;
    if (await mutate(action)) setModal(null);
  }

  function exportData() {
    downloadJson(state, `devquest-${localDate()}.json`);
    setNotice("ส่งออกข้อมูลแล้ว");
  }
  async function connect() {
    setBusy(true); setError("");
    try { const loaded = await fetchState(accessKey); sessionStorage.setItem("devquest.access", accessKey); setState(loaded); setReady(true); setModal(null); setNotice("เชื่อมต่อฐานข้อมูลแล้ว"); }
    catch (err) { setError(err instanceof Error ? err.message : "เชื่อมต่อไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  const done = state.tasks.filter(t => t.status === "done").length;
  const progress = state.tasks.length ? Math.round(done / state.tasks.length * 100) : 0;
  const minutes = state.entries.reduce((total, e) => total + e.minutes, 0);
  const completedGoals = state.goals.filter(g => { const tasks = state.tasks.filter(t => t.goalId === g.id); return tasks.length > 0 && tasks.every(t => t.status === "done"); }).length;
  const activeGoals = state.goals.length - completedGoals;
  const search = query.trim().toLocaleLowerCase();
  const goals = state.goals.filter(g => `${g.title} ${g.category}`.toLocaleLowerCase().includes(search));
  const tasks = state.tasks.filter(t => (!goalFilter || t.goalId === goalFilter) && `${t.title} ${state.goals.find(g => g.id === t.goalId)?.title ?? ""}`.toLocaleLowerCase().includes(search));
  const entries = state.entries.filter(e => `${e.title} ${e.content}`.toLocaleLowerCase().includes(search)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const days = Array.from({ length: 7 }, (_, i) => { const day = new Date(); day.setDate(day.getDate() - 6 + i); const date = localDate(day); return { date, label: day.toLocaleDateString("th-TH", { weekday: "short" }), minutes: state.entries.filter(e => e.date === date).reduce((sum, e) => sum + e.minutes, 0) }; });
  const weekTotal = days.reduce((sum, day) => sum + day.minutes, 0);
  const maxMinutes = Math.max(60, ...days.map(d => d.minutes));
  const heading = { dashboard: "ทุกก้าวเล็ก ๆ คือความก้าวหน้า", goals: "เป้าหมายของฉัน", tasks: "เปลี่ยนไอเดียให้เป็นงานที่เสร็จ", journal: "เก็บสิ่งที่เรียนรู้ในทุกวัน" }[view];

  function GoalCard({ goal }: { goal: Goal }) {
    const goalTasks = state.tasks.filter(t => t.goalId === goal.id);
    const complete = goalTasks.filter(t => t.status === "done").length;
    const percent = goalTasks.length ? Math.round(complete / goalTasks.length * 100) : 0;
    return <article className="goal-card">
      <div className="card-top"><span className={`category ${goal.category.toLowerCase()}`}>{goal.category}</span><button className="icon-button subtle" aria-label={`ลบเป้าหมาย ${goal.title}`} disabled={busy} onClick={() => { if (confirm(`ลบเป้าหมาย “${goal.title}” และงานย่อยทั้งหมด? บันทึกการเรียนจะยังอยู่`)) void mutate({ type: "goal.delete", id: goal.id }); }}><Trash2 size={15} /></button></div>
      <h3>{goal.title}</h3><p className="muted">{goalTasks.length ? `${complete} จาก ${goalTasks.length} งานเสร็จแล้ว` : "เริ่มต้นด้วยการเพิ่มงานแรกของคุณ"}</p>
      <div className="progress-label"><span>ความคืบหน้า</span><strong>{percent}%</strong></div>
      <div className="progress-track" role="progressbar" aria-label={`ความคืบหน้า ${goal.title}`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }} /></div>
      <button className="text-button goal-link" onClick={() => { setGoalFilter(goal.id); setQuery(""); setView("tasks"); }}>ดูงานในเป้าหมายนี้ <ArrowRight size={14} /></button>
    </article>;
  }
  function JournalCard({ entry }: { entry: Entry }) {
    return <article className="journal-card"><div className="journal-icon"><BookOpen size={19} /></div><div className="journal-content"><div className="card-top"><h3>{entry.title}</h3><button className="icon-button subtle" disabled={busy} aria-label={`ลบบันทึก ${entry.title}`} onClick={() => { if (confirm(`ลบบันทึก “${entry.title}”?`)) void mutate({ type: "entry.delete", id: entry.id }); }}><Trash2 size={14} /></button></div><p>{entry.content}</p><div className="journal-meta"><span>{prettyDate(entry.date)}</span><span>·</span><span>{entry.minutes} นาที</span>{entry.goalId && <><span>·</span><span>{state.goals.find(g => g.id === entry.goalId)?.title}</span></>}</div></div></article>;
  }
  const empty = (label: string, button: string, next: Modal) => <div className="empty-state"><Sparkles size={26} /><h3>{label}</h3><p>เริ่มทีละนิด แล้วค่อย ๆ ไปให้ไกลขึ้น</p><button className="secondary-button" disabled={!ready} onClick={() => openModal(next)}><Plus size={16} />{button}</button></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="DevQuest หน้าหลัก"><span className="brand-icon"><Code2 size={24} /></span><span>Dev<span className="brand-light">Quest</span><small>YOUR LEARNING JOURNEY</small></span></Link>
      <div className="workspace"><span className="workspace-avatar">D</span><div><strong>พื้นที่เรียนรู้ของฉัน</strong><small>Personal workspace</small></div><MoreHorizontal size={17} /></div>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="เมนูหลัก">{navigation.map(item => <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setQuery(""); setGoalFilter(""); }}><item.icon size={19} /><span>{item.label}</span>{item.id === "goals" && <span className="nav-count">{state.goals.length}</span>}</button>)}</nav>
      <div className="sidebar-tip"><span className="tip-icon"><Sparkles size={19} /></span><h3>เก่งขึ้นวันละนิด</h3><p>ไม่ต้องรู้ทุกอย่างในวันนี้<br />แค่เรียนรู้อีกนิดจากเมื่อวาน</p><span className="tip-footer">Keep building. Keep growing. <ArrowRight size={13} /></span></div>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => openModal("settings")}><Settings2 size={18} /><span>การตั้งค่า</span></button><div className="profile"><span className="profile-avatar">ME</span><div><strong>นักพัฒนาฝึกหัด</strong><small>เส้นทางของคุณเริ่มที่นี่</small></div><span className="online-dot" /></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={13} /><strong>{navigation.find(n => n.id === view)?.label}</strong></div><div className="topbar-right"><label className="search"><Search size={17} /><input aria-label="ค้นหาเป้าหมาย งาน หรือบันทึก" placeholder="ค้นหาในหน้านี้..." value={query} onChange={e => setQuery(e.target.value)} /></label><button className="icon-button" aria-label="การตั้งค่า" onClick={() => openModal("settings")}><Settings2 size={18} /></button><span className="top-avatar">ME</span></div></header>
      <main>
        <div className="page-heading"><div><p className="eyebrow">LET’S MAKE PROGRESS</p><h1>{heading}<span className="heading-dot">.</span></h1><p className="page-description">{view === "dashboard" ? "ติดตามเป้าหมาย ลงมือทำ และเติบโตไปด้วยกันในทุกวัน" : view === "goals" ? "แบ่งเป้าหมายใหญ่ให้เป็นก้าวเล็ก ๆ ที่ทำได้จริง" : view === "tasks" ? "เลือกหนึ่งงาน แล้วเริ่มลงมือทำวันนี้" : "ทบทวนสิ่งที่เข้าใจ และจดสิ่งที่อยากลองต่อ"}</p></div><button className="primary-button" disabled={!ready || busy} onClick={() => openModal(view === "goals" ? "goal" : view === "tasks" ? "task" : "entry")}><Plus size={18} />{view === "goals" ? "เพิ่มเป้าหมาย" : view === "tasks" ? "เพิ่มงาน" : "บันทึกวันนี้"}</button></div>
        <div className="mode-banner"><span className="mode-dot" /><span>{databaseMode ? "โหมดฐานข้อมูล · PostgreSQL" : "โหมดทดลอง · ข้อมูลตัวอย่างแก้ไขได้ และบันทึกเฉพาะเบราว์เซอร์นี้"}</span><button onClick={() => openModal("settings")}>รายละเอียด <ArrowRight size={12} /></button></div>
        {error && !modal && <div className="error-banner" role="alert">{error}<button className="text-button" onClick={() => openModal("settings")}>เปิดการตั้งค่า</button></div>}
        {!ready && !error && <div className="loading-state" role="status"><LoaderCircle className="spin" size={22} />กำลังเตรียมพื้นที่เรียนรู้...</div>}
        {view === "dashboard" && <>
          <section className="stat-grid" aria-label="สรุปความคืบหน้า"><Stat icon={<Target size={21} />} label="เป้าหมายที่กำลังเดินหน้า" value={activeGoals.toString()} suffix="เป้าหมาย" detail={`สำเร็จแล้ว ${completedGoals} เป้าหมาย`} color="mint" /><Stat icon={<CircleCheck size={21} />} label="งานที่ทำสำเร็จ" value={done.toString()} suffix={`/ ${state.tasks.length}`} detail={`ความคืบหน้ารวม ${progress}%`} color="blue" /><Stat icon={<BookOpen size={21} />} label="เวลาที่ใช้เรียนรู้" value={(minutes / 60).toLocaleString("th-TH", { maximumFractionDigits: 1 })} suffix="ชั่วโมง" detail={`${state.entries.length} บันทึกการเรียนรู้`} color="violet" /><Stat icon={<Flame size={21} />} label="เรียนรู้ต่อเนื่อง" value={streak(state.entries).toString()} suffix="วัน" detail="นับจากวันที่มีบันทึกการเรียน" color="orange" /></section>
          <div className="overview-grid"><section className="panel activity-panel"><div className="section-heading"><div><h2>จังหวะการเรียนรู้</h2><p>เวลาที่คุณลงทุนกับตัวเองใน 7 วันล่าสุด</p></div><span className="quiet-pill">7 วันล่าสุด</span></div><div className="activity-summary"><strong>{weekTotal}</strong><span>นาที</span><span className="activity-note"><span className="legend-dot" />เวลาที่บันทึก</span></div><div className="chart" role="img" aria-label={`เวลาเรียน 7 วันล่าสุด รวม ${weekTotal} นาที: ${days.map(d => `${d.label} ${d.minutes} นาที`).join(", ")}`}><div className="chart-lines"><span>{maxMinutes} นาที</span><span>{Math.round(maxMinutes / 2)}</span><span>0</span></div><div className="chart-bars">{days.map((day, index) => <div className="chart-day" key={day.date}><div className="bar-slot"><div className={`bar ${index === 6 ? "today" : ""}`} style={{ height: `${Math.max(day.minutes ? 4 : 0, day.minutes / maxMinutes * 100)}%` }} title={`${prettyDate(day.date)}: ${day.minutes} นาที`} /></div><span className={index === 6 ? "today-label" : ""}>{day.label}</span></div>)}</div></div></section><section className="focus-card"><div className="focus-top"><span><Zap size={16} /> ONE STEP AT A TIME</span><Sparkles size={20} /></div><h2>วันนี้จะก้าวไป<br />อีกหนึ่งก้าวไหม?</h2><p>{state.tasks.some(t => t.status !== "done") ? state.tasks.find(t => t.status === "doing")?.title ?? state.tasks.find(t => t.status === "todo")?.title : "เลือกเป้าหมายใหม่ แล้วเริ่มต้นสิ่งที่อยากเรียนรู้"}</p><button onClick={() => { setGoalFilter(""); setView("tasks"); }}>ไปที่บอร์ดงาน <ArrowRight size={17} /></button><span className="focus-decoration" aria-hidden="true">↗</span></section></div>
        </>}
        {(view === "dashboard" || view === "goals") && <section className="goals-section"><div className="section-heading"><div><h2>เป้าหมายของฉัน <span className="count-badge">{goals.length}</span></h2>{view === "goals" && <p>ทุกเป้าหมายเริ่มจากงานแรกเพียงงานเดียว</p>}</div><button className="text-button" disabled={!ready} onClick={() => openModal("goal")}><Plus size={15} />เพิ่มเป้าหมาย</button></div>{goals.length ? <div className="goal-grid">{(view === "dashboard" ? goals.slice(0, 2) : goals).map(goal => <GoalCard key={goal.id} goal={goal} />)}</div> : empty(query ? "ไม่พบเป้าหมายที่ค้นหา" : "เป้าหมายแรกของคุณคืออะไร?", "เพิ่มเป้าหมาย", "goal")}{view === "dashboard" && goals.length > 2 && <button className="text-button view-all" onClick={() => setView("goals")}>ดูทั้งหมด {goals.length} เป้าหมาย <ArrowRight size={14} /></button>}</section>}
        {(view === "dashboard" || view === "tasks") && <section className="tasks-section"><div className="section-heading"><div><h2>{view === "dashboard" ? "งานที่รอให้คุณลงมือ" : "บอร์ดงาน"}</h2><p>ทีละงาน ทีละก้าว สู่เป้าหมายของคุณ</p></div><div className="task-controls"><select aria-label="กรองงานตามเป้าหมาย" value={goalFilter} onChange={e => setGoalFilter(e.target.value)}><option value="">ทุกเป้าหมาย</option>{state.goals.map(g => <option value={g.id} key={g.id}>{g.title}</option>)}</select><button className="text-button" disabled={!ready} onClick={() => openModal("task")}><Plus size={15} />เพิ่มงาน</button></div></div><div className="kanban">{(["todo", "doing", "done"] as const).map(status => <section className={`kanban-column ${status}`} key={status}><div className="column-heading"><span className="status-dot" /><h3>{statusLabels[status]}</h3><span>{tasks.filter(t => t.status === status).length}</span></div><div className="task-list">{tasks.filter(t => t.status === status).map(task => <article className="task-card" key={task.id}><span className="task-goal">{state.goals.find(g => g.id === task.goalId)?.title}</span><h4>{task.title}</h4><div className="task-footer"><label className="sr-only" htmlFor={`status-${task.id}`}>สถานะของ {task.title}</label><select id={`status-${task.id}`} value={task.status} disabled={busy} onChange={e => void mutate({ type: "task.status", id: task.id, status: e.target.value as Status })}>{(["todo", "doing", "done"] as const).map(s => <option value={s} key={s}>{statusLabels[s]}</option>)}</select><button className="icon-button subtle" disabled={busy} aria-label={`ลบงาน ${task.title}`} onClick={() => { if (confirm(`ลบงาน “${task.title}”?`)) void mutate({ type: "task.delete", id: task.id }); }}><Trash2 size={14} /></button></div></article>)}{!tasks.some(t => t.status === status) && <div className="column-empty">{query ? "ไม่พบงานที่ค้นหา" : status === "done" ? "งานที่สำเร็จจะอยู่ตรงนี้" : "ยังไม่มีงานในขั้นตอนนี้"}</div>}</div><button className="add-task" disabled={!ready || busy} onClick={() => openModal("task")}><Plus size={14} />เพิ่มงานใหม่</button></section>)}</div></section>}
        {(view === "dashboard" || view === "journal") && <section className="journal-section"><div className="section-heading"><div><h2>บันทึกการเรียนรู้{view === "dashboard" ? "ล่าสุด" : ""}</h2><p>สิ่งที่เรียนวันนี้ คือพื้นฐานของวันพรุ่งนี้</p></div><button className="text-button" disabled={!ready} onClick={() => view === "dashboard" ? setView("journal") : openModal("entry")}>{view === "dashboard" ? "ดูทั้งหมด" : "เพิ่มบันทึก"}<ArrowRight size={14} /></button></div>{entries.length ? <div className="journal-list">{(view === "dashboard" ? entries.slice(0, 2) : entries).map(entry => <JournalCard key={entry.id} entry={entry} />)}</div> : empty(query ? "ไม่พบบันทึกที่ค้นหา" : "วันนี้คุณได้เรียนรู้อะไรบ้าง?", "เขียนบันทึกแรก", "entry")}</section>}
        <footer className="page-footer"><span><Code2 size={14} /> Built one step at a time.</span><span>DevQuest · Your personal learning space</span></footer>
      </main>
    </div>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
    <dialog ref={dialog} onCancel={() => setModal(null)} onClose={() => setModal(null)} className="form-dialog"><div className="dialog-heading"><div><p className="eyebrow">YOUR NEXT STEP</p><h2>{modal === "goal" ? "เพิ่มเป้าหมายใหม่" : modal === "task" ? "เพิ่มงานที่อยากทำ" : modal === "entry" ? "วันนี้ได้เรียนรู้อะไร?" : "พื้นที่เรียนรู้ของคุณ"}</h2></div><button className="icon-button" aria-label="ปิดหน้าต่าง" onClick={() => setModal(null)} disabled={busy}><X size={20} /></button></div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {modal === "settings" ? <div className="settings-body"><div className="settings-note"><strong>{databaseMode ? "PostgreSQL · พื้นที่ส่วนตัว" : "โหมดทดลองในเบราว์เซอร์"}</strong><p>{databaseMode ? "ข้อมูลอยู่บนเซิร์ฟเวอร์ นี่คือระบบสำหรับเจ้าของคนเดียว กรอก Access key ที่ตรงกับ DEVQUEST_ACCESS_KEY ของเซิร์ฟเวอร์" : "ข้อมูลเก็บใน localStorage ของเบราว์เซอร์นี้ ไม่ซิงก์ข้ามเครื่อง และอาจหายเมื่อคุณล้างข้อมูลเว็บไซต์ ส่งออกข้อมูลเพื่อเก็บสำรองได้"}</p></div>{databaseMode && <form onSubmit={e => { e.preventDefault(); void connect(); }}><label>Access key<input type="password" autoComplete="off" value={accessKey} onChange={e => setAccessKey(e.target.value)} /></label><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}เชื่อมต่อ / โหลดใหม่</button></form>}<button className="secondary-button" disabled={!ready} onClick={exportData}><ArrowDownToLine size={17} />ส่งออกข้อมูล JSON</button><p className="settings-footnote">วิธีเปิดโหมดฐานข้อมูลและรัน migration อยู่ใน README ของโปรเจกต์</p></div> : <form key={modal} onSubmit={submit} className="quest-form"><label>{modal === "goal" ? "ชื่อเป้าหมาย" : modal === "task" ? "ชื่องาน" : "หัวข้อบันทึก"}<input name="title" required maxLength={modal === "task" ? 160 : 120} placeholder={modal === "goal" ? "เช่น สร้าง REST API แรกของฉัน" : modal === "task" ? "เช่น สร้าง endpoint สำหรับเพิ่มเป้าหมาย" : "เช่น เข้าใจ useState มากขึ้นแล้ว"} autoFocus /></label>{modal === "goal" && <label>หมวดหมู่<select name="category" defaultValue="Frontend">{["Frontend", "Backend", "Database", "DevOps", "อื่น ๆ"].map(c => <option key={c}>{c}</option>)}</select></label>}{(modal === "task" || modal === "entry") && <label>เป้าหมายที่เกี่ยวข้อง<select name="goalId" required={modal === "task"} defaultValue={goalFilter || (modal === "task" ? state.goals[0]?.id ?? "" : "")}>{modal === "entry" && <option value="">ไม่ผูกกับเป้าหมาย</option>}{state.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}{modal === "task" && !state.goals.length && <p className="form-hint">เพิ่มเป้าหมายก่อน แล้วค่อยสร้างงานย่อยครับ <button type="button" className="text-button" onClick={() => setModal("goal")}>เพิ่มเป้าหมาย</button></p>}{modal === "entry" && <><div className="form-row"><label>วันที่เรียน<input type="date" name="date" required defaultValue={localDate()} /></label><label>เวลาที่เรียน (นาที)<input type="number" name="minutes" min={1} max={1440} required defaultValue={30} /></label></div><label>สิ่งที่เรียนรู้<textarea name="content" required maxLength={4000} rows={5} placeholder="วันนี้เข้าใจอะไร? เจอปัญหาอะไร? ครั้งหน้าอยากลองอะไรต่อ?" /></label></>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setModal(null)}><ChevronLeft size={15} />ยกเลิก</button><button className="primary-button" disabled={busy || !ready || (modal === "task" && !state.goals.length)}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}บันทึก</button></div></form>}
    </dialog>
  </div>;
}

function Stat({ icon, label, value, suffix, detail, color }: { icon: React.ReactNode; label: string; value: string; suffix: string; detail: string; color: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}>{icon}</span></div><div className="stat-value"><strong>{value}</strong><span>{suffix}</span></div><p>{detail}</p></article>;
}
