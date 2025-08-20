// ---------- Utils ----------
const startOfDayMs = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); };
const todayKey = () => String(startOfDayMs(new Date()));
const pad = (n) => String(n).padStart(2, "0");
const timeToMinutes = (hhmm) => { const [h,m] = hhmm.split(":").map(Number); return h*60+m; };
const minutesToHHMM = (m) => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

const load = (k, v) => { try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch { return v; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ---------- Types ----------
// Habit { id, title, color, completed: { [dateKey]: true } }
// Schedules { [dateKey]: Array<{ id, habitId, title, timeMin }> }
// Routine { id, title, steps: Array<{ title, time: string HH:MM }> }

export default function App() {
  // State
  const [tab, setTab] = useState("habits");
  const [habits, setHabits] = useState(() => load("habits", [
    { id: uid(), title: "Meditieren", color: "#22c55e", completed: {} },
    { id: uid(), title: "Lesen", color: "#3b82f6", completed: {} },
  ]));
  const [schedules, setSchedules] = useState(() => load("schedules", {}));
  const [points, setPoints] = useState(() => load("points", 0));
  const [routines, setRoutines] = useState(() => load("routines", [
    { id: uid(), title: "Morgenroutine", steps: [
      { title: "Wasser trinken", time: "07:00" },
      { title: "10 Min Dehnen", time: "07:10" },
      { title: "Lesen", time: "07:30" },
    ]}
  ]));

  // Timer
  const [timerDesc, setTimerDesc] = useState(() => load("timerDesc", "Fokus Session"));
  const [focusMin, setFocusMin] = useState(() => load("focusMin", 25)); // 1–90
  const [breakMin, setBreakMin] = useState(() => load("breakMin", 5));  // 5–20
  const [phase, setPhase] = useState("focus"); // focus | break
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(() => load("seconds", 25*60));

  // Persist
  useEffect(() => save("habits", habits), [habits]);
  useEffect(() => save("schedules", schedules), [schedules]);
  useEffect(() => save("points", points), [points]);
  useEffect(() => save("routines", routines), [routines]);
  useEffect(() => save("timerDesc", timerDesc), [timerDesc]);
  useEffect(() => save("focusMin", focusMin), [focusMin]);
  useEffect(() => save("breakMin", breakMin), [breakMin]);
  useEffect(() => save("seconds", seconds), [seconds]);

  // Tick
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (seconds > 0) return;
    setRunning(false);
    if (phase === "focus") {
      setPoints((p) => p + 20);
      setPhase("break");
      setSeconds(breakMin * 60);
    } else {
      setPhase("focus");
      setSeconds(focusMin * 60);
    }
  }, [seconds, phase, breakMin, focusMin]);

  // Actions
  const addHabit = (title) => {
    const t = title.trim();
    if (!t) return;
    setHabits((prev) => [{ id: uid(), title: t, color: "#0ea5e9", completed: {} }, ...prev]);
  };
  const toggleDoneToday = (habitId) => {
    const d = todayKey();
    setHabits((prev) => prev.map((h) => {
      if (h.id !== habitId) return h;
      const completed = { ...h.completed };
      if (completed[d]) { delete completed[d]; setPoints((p)=>Math.max(0, p-10)); }
      else { completed[d] = true; setPoints((p)=>p+10); }
      return { ...h, completed };
    }));
  };

  const scheduleHabit = (dateKey, habitId, hhmm, titleOverride) => {
    const timeMin = timeToMinutes(hhmm);
    setSchedules((prev) => {
      const list = [...(prev[dateKey] || [])];
      list.push({ id: uid(), habitId, title: titleOverride || habits.find(h=>h.id===habitId)?.title || "Habit", timeMin });
      list.sort((a,b)=>a.timeMin-b.timeMin);
      return { ...prev, [dateKey]: list };
    });
  };
  const removeSchedule = (dateKey, schedId) => {
    setSchedules((prev) => ({ ...prev, [dateKey]: (prev[dateKey]||[]).filter(s=>s.id!==schedId) }));
  };

  const addRoutine = (title) => setRoutines((r)=>[{ id: uid(), title: title.trim() || "Neue Routine", steps: [] }, ...r]);
  const addStepToRoutine = (rid, step) => setRoutines((rs)=>rs.map(r=> r.id===rid ? { ...r, steps:[...r.steps, step] } : r));
  const applyRoutineToDate = (rid, dateKey) => {
    const r = routines.find(x=>x.id===rid);
    if (!r) return;
    r.steps.forEach(st => scheduleHabit(dateKey, null, st.time, st.title));
  };

  // Stats: letzte 7 Tage – Prozent erledigt (erledigt / geplant)
  const last7 = useMemo(() => {
    const out = [];
    for (let i=6;i>=0;i--) {
      const key = String(startOfDayMs(new Date(Date.now() - i*86400000)));
      const planned = (schedules[key]?.length || 0) || habits.length; // Fallback: wenn nichts geplant, alle Habits als Ziel
      const done = habits.reduce((acc, h)=> acc + (h.completed[key] ? 1 : 0), 0);
      const pct = planned ? Math.round(100*done/planned) : 0;
      out.push({ key, planned, done, pct });
    }
    return out;
  }, [habits, schedules]);

  // UI
  return (
    <div style={styles.app}>
      <AppBar points={points} onTab={setTab} tab={tab} />

      {tab === "habits" && (
        <HabitsView
          habits={habits}
          onAdd={addHabit}
          onToggleDone={toggleDoneToday}
        />
      )}

      {tab === "calendar" && (
        <CalendarView
          habits={habits}
          schedules={schedules}
          onSchedule={scheduleHabit}
          onRemoveSchedule={removeSchedule}
        />
      )}

      {tab === "stats" && (
        <StatsView habits={habits} last7={last7} />
      )}

      {tab === "timer" && (
        <TimerView
          desc={timerDesc}
          setDesc={setTimerDesc}
          focusMin={focusMin}
          setFocusMin={setFocusMin}
          breakMin={breakMin}
          setBreakMin={setBreakMin}
          phase={phase}
          running={running}
          seconds={seconds}
          setRunning={setRunning}
          reset={() => { setPhase("focus"); setSeconds(focusMin*60); setRunning(false); }}
        />
      )}

      {tab === "routines" && (
        <RoutinesView
          routines={routines}
          onAddRoutine={addRoutine}
          onAddStep={addStepToRoutine}
          onApply={applyRoutineToDate}
        />
      )}

      <BottomTabs tab={tab} setTab={setTab} />
    </div>
  );
}

// ---------- Views ----------
function AppBar({ points, onTab, tab }){
  return (
    <div style={styles.appbar}>
      <div style={styles.appbarInner}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={styles.logo}>H</div>
          <div>
            <div style={{ fontWeight:700 }}>Habit Tracker</div>
            <div style={{ fontSize:12, color:colors.muted }}>Blau · Grau · Grün · Weiß</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={styles.pill}>Punkte: {points} · Level {Math.floor(points/100)+1}</span>
        </div>
      </div>
    </div>
  );
}

function BottomTabs({ tab, setTab }){
  const tabs = [
    { id:"habits", label:"Habits" },
    { id:"calendar", label:"Kalender" },
    { id:"stats", label:"Statistik" },
    { id:"timer", label:"Timer" },
    { id:"routines", label:"Routinen" },
  ];
  return (
    <div style={styles.bottomTabs}>
      {tabs.map(t => (
        <button key={t.id} onClick={()=>setTab(t.id)} style={{ ...styles.tabBtn, ...(tab===t.id?styles.tabBtnActive:{} )}}>{t.label}</button>
      ))}
    </div>
  );
}

function HabitsView({ habits, onAdd, onToggleDone }){
  const [title, setTitle] = useState("");
  return (
    <div style={styles.page}>
      <section style={styles.card}>
        <div style={styles.sectionTitle}>Neues Habit</div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="z. B. 15 Min. Lesen" style={styles.input} onKeyDown={e=>{ if(e.key==='Enter'){ onAdd(title); setTitle(""); } }} />
          <button onClick={()=>{ onAdd(title); setTitle(""); }} style={styles.btn}>Hinzufügen</button>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Heute</div>
        <ul style={{ display:'grid', gap:8, listStyle:'none', padding:0 }}>
          {habits.map(h => (
            <li key={h.id} style={styles.habitItem}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ ...styles.check, background:h.completed[todayKey()]?colors.ok: '#fff', borderColor: h.completed[todayKey()]?colors.ok: colors.border }} onClick={()=>onToggleDone(h.id)}>{h.completed[todayKey()]?'✓':''}</div>
                <div>
                  <div style={{ fontWeight:600 }}>{h.title}</div>
                </div>
              </div>
              <button onClick={()=>onToggleDone(h.id)} style={styles.btnGhost}>{h.completed[todayKey()]? 'Erledigt' : 'Abhaken'}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CalendarView({ habits, schedules, onSchedule, onRemoveSchedule }){
  const [ref, setRef] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(() => startOfDayMs(new Date()));
  const cal = useMemo(()=> buildMonth(ref), [ref]);
  const dayList = schedules[String(selectedDay)] || [];

  const addSchedule = () => {
    const habitId = prompt("Welches Habit? (Titel eingeben oder leer für freies Ereignis)");
    const time = prompt("Uhrzeit (HH:MM)", "08:00");
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return;
    // Falls Habit nicht exakt existiert, speichern wir als freies Ereignis (habitId null)
    const found = habits.find(h=>h.title.toLowerCase()===habitId?.trim().toLowerCase());
    onSchedule(String(selectedDay), found?.id || null, time, habitId);
  };

  return (
    <div style={styles.page}>
      <section style={styles.card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <button style={styles.btnGhost} onClick={()=>setRef(d=>new Date(d.getFullYear(), d.getMonth()-1, 1))}>«</button>
          <div style={{ fontWeight:700 }}>{ref.toLocaleString('de-DE', { month:'long', year:'numeric' })}</div>
          <button style={styles.btnGhost} onClick={()=>setRef(d=>new Date(d.getFullYear(), d.getMonth()+1, 1))}>»</button>
        </div>
        <div style={styles.weekHeader}>{['Mo','Di','Mi','Do','Fr','Sa','So'].map((d,i)=>(<div key={i} style={styles.weekCell}>{d}</div>))}</div>
        <div style={styles.monthGrid}>
          {cal.map((d,i)=>{
            const key = String(startOfDayMs(d.date));
            const planned = schedules[key]?.length || 0;
            const anyDone = habits.some(h=>h.completed[key]);
            return (
              <div key={i} style={{ ...styles.dayCell, opacity: d.inMonth?1:.5, background:anyDone? '#dcfce7':'#fff', borderColor: planned? colors.accent:'#e5e7eb' }} onClick={()=>{ setSelectedDay(startOfDayMs(d.date)); }}>
                <div style={{ fontWeight:600 }}>{d.date.getDate()}</div>
                <div style={{ fontSize:11, color:colors.muted }}>{planned} geplant</div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Tagesübersicht – {new Date(selectedDay).toLocaleDateString()}</div>
        <button onClick={addSchedule} style={{ ...styles.btn, marginBottom:8 }}>Eintrag hinzufügen</button>
        <div style={{ display:'grid', gridTemplateColumns:'80px 1fr', gap:8 }}>
          <div>
            {[...Array(24)].map((_,h)=>(<div key={h} style={styles.hourCell}>{pad(h)}:00</div>))}
          </div>
          <div style={{ borderLeft:`1px solid ${colors.border}`, paddingLeft:8 }}>
            {dayList.length===0 && <div className="pill" style={styles.pill}>Noch nichts geplant</div>}
            {dayList.map(item => (
              <div key={item.id} style={styles.timelineItem}>
                <div>
                  <div style={{ fontWeight:600 }}>{item.title}</div>
                  <div style={{ fontSize:12, color:colors.muted }}>{minutesToHHMM(item.timeMin)}</div>
                </div>
                <button onClick={()=>onRemoveSchedule(String(selectedDay), item.id)} style={styles.btnGhost}>Löschen</button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatsView({ habits, last7 }){
  const totalHabits = habits.length;
  return (
    <div style={styles.page}>
      <section style={styles.card}>
        <div style={styles.sectionTitle}>Letzte 7 Tage – % Erfüllung</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120 }}>
          {last7.map((d,i)=> (
            <div key={i} style={{ textAlign:'center' }}>
              <div style={{ background: colors.accent, width:20, height: Math.max(4, d.pct) }} />
              <div style={{ fontSize:12, color:colors.muted, marginTop:4 }}>{d.pct}%</div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Erledigte Habits heute</div>
        <div style={{ display:'flex', gap:6 }}>
          {habits.map(h => (
            <span key={h.id} style={styles.pill}>{h.title}: {h.completed[todayKey()]? '✓':'—'}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function TimerView({ desc, setDesc, focusMin, setFocusMin, breakMin, setBreakMin, phase, running, seconds, setRunning, reset }){
  // Eingaben begrenzen
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const onChangeFocus = (v) => setFocusMin(clamp(Number(v||0), 1, 90));
  const onChangeBreak = (v) => setBreakMin(clamp(Number(v||0), 5, 20));

  useEffect(() => {
    if (!running) return;
    // keep page title updated
    document.title = `${phase==='focus'?'Fokus':'Pause'} ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} – ${desc}`;
    return () => { document.title = 'Habit Tracker'; };
  }, [running, seconds, desc, phase]);

  return (
    <div style={styles.page}>
      <section style={styles.card}>
        <div style={styles.sectionTitle}>Fokus‑Timer</div>
        <div style={{ display:'grid', gap:8, maxWidth:520 }}>
          <label style={styles.label}>Beschreibung
            <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="z. B. 15 Min. Lesen" style={styles.input} />
          </label>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <label style={styles.label}>Fokus (1–90 Min)
              <input type="number" value={focusMin} min={1} max={90} onChange={e=>onChangeFocus(e.target.value)} style={styles.input} />
            </label>
            <label style={styles.label}>Pause (5–20 Min)
              <input type="number" value={breakMin} min={5} max={20} onChange={e=>onChangeBreak(e.target.value)} style={styles.input} />
            </label>
          </div>

          <div style={{ fontSize:48, fontVariantNumeric:'tabular-nums', textAlign:'center' }}>
            {Math.floor(seconds/60)}:{pad(seconds%60)}
          </div>

          <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
            <button onClick={()=>setRunning(!running)} style={styles.btn}>{running? 'Pause' : (phase==='focus'? 'Start Fokus' : 'Start Pause')}</button>
            <button onClick={reset} style={styles.btnGhost}>Reset</button>
          </div>

          <div style={{ textAlign:'center', color:colors.muted, fontSize:12 }}>
            Phase: {phase==='focus'? 'Fokus' : 'Pause'} · Punkte: +20 pro Fokus‑Session
          </div>
        </div>
      </section>
    </div>
  );
}

function RoutinesView({ routines, onAddRoutine, onAddStep, onApply }){
  const [title, setTitle] = useState("");
  const [selRoutine, setSelRoutine] = useState(routines[0]?.id || null);
  const [stepTitle, setStepTitle] = useState("");
  const [stepTime, setStepTime] = useState("07:00");
  const [applyDate, setApplyDate] = useState(() => new Date().toISOString().slice(0,10));

  useEffect(()=>{ if(!routines.find(r=>r.id===selRoutine)) setSelRoutine(routines[0]?.id || null); }, [routines]);

  return (
    <div style={styles.page}>
      <section style={styles.card}>
        <div style={styles.sectionTitle}>Routine anlegen</div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Name der Routine" style={styles.input} />
          <button style={styles.btn} onClick={()=>{ onAddRoutine(title); setTitle(""); }}>Neu</button>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Schritte</div>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
          <select value={selRoutine||''} onChange={e=>setSelRoutine(e.target.value)} style={styles.input}>
            {routines.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <input value={stepTitle} onChange={e=>setStepTitle(e.target.value)} placeholder="z. B. Lesen" style={styles.input} />
          <input type="time" value={stepTime} onChange={e=>setStepTime(e.target.value)} style={styles.input} />
          <button style={styles.btn} onClick={()=>{ if(selRoutine) { onAddStep(selRoutine, { title: stepTitle.trim()||'Schritt', time: stepTime }); setStepTitle(''); } }}>Hinzufügen</button>
        </div>
        {selRoutine && (
          <ul style={{ listStyle:'none', padding:0, display:'grid', gap:6 }}>
            {routines.find(r=>r.id===selRoutine)?.steps.map((s, i)=>(
              <li key={i} style={styles.timelineItem}>
                <div><div style={{ fontWeight:600 }}>{s.title}</div><div style={{ fontSize:12, color:colors.muted }}>{s.time}</div></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Routine in Kalender einfügen</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="date" value={applyDate} onChange={e=>setApplyDate(e.target.value)} style={styles.input} />
          <button style={styles.btn} onClick={()=>{
            const d = new Date(applyDate);
            const key = String(startOfDayMs(d));
            if (selRoutine) onApply(selRoutine, key);
          }}>Planen</button>
        </div>
      </section>
    </div>
  );
}

// ---------- Helpers ----------
function buildMonth(refDate){
  const y = refDate.getFullYear(), m = refDate.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(first);
  // Montag als Wochenstart
  let wd = (start.getDay()+6)%7; // 0..6 (Mo..So)
  start.setDate(start.getDate() - wd);
  const days = [];
  for(let i=0;i<42;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    days.push({ date:d, inMonth: d.getMonth()===m });
  }
  return days;
}

// ---------- Styles ----------
const colors = {
  bg: "#f1f5f9",
  panel: "#ffffff",
  border: "#e5e7eb",
  text: "#0f172a",
  muted: "#64748b",
  accent: "#3b82f6", // blau
  ok: "#22c55e",     // grün
};

const styles = {
  app: { minHeight:'100vh', background: colors.bg, color: colors.text, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial', paddingBottom: 72 },
  appbar: { position:'sticky', top:0, backdropFilter:'blur(8px)', background:'rgba(255,255,255,.85)', borderBottom:`1px solid ${colors.border}`, zIndex:10 },
  appbarInner: { maxWidth: 1100, margin:'0 auto', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  logo: { width:36, height:36, borderRadius:12, background:'#0f172a', color:'#fff', display:'grid', placeItems:'center', fontWeight:700 },
  page: { maxWidth:1100, margin:'0 auto', padding:'16px' },
  card: { background: colors.panel, border:`1px solid ${colors.border}`, borderRadius:16, padding:14, boxShadow:'0 1px 2px rgba(0,0,0,.05)', marginBottom:12 },
  sectionTitle: { fontWeight:600, marginBottom:8 },
  input: { border:`1px solid ${colors.border}`, borderRadius:12, padding:'10px 12px', width:'100%' },
  btn: { background:'#0f172a', color:'#fff', border:'1px solid rgba(15,23,42,.15)', borderRadius:12, padding:'10px 14px', cursor:'pointer' },
  btnGhost: { background:'#fff', color:'#0f172a', border:`1px solid ${colors.border}`, borderRadius:12, padding:'10px 14px', cursor:'pointer' },
  pill: { border:`1px solid ${colors.border}`, borderRadius:999, padding:'4px 10px', fontSize:12, color: colors.muted },
  weekHeader: { display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginBottom:6 },
  weekCell: { textAlign:'center', fontSize:12, color: colors.muted },
  monthGrid: { display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 },
  dayCell: { border:`1px solid ${colors.border}`, borderRadius:12, padding:8, display:'grid', gap:4, cursor:'pointer' },
  hourCell: { height:24, fontSize:12, color: colors.muted },
  timelineItem: { display:'flex', alignItems:'center', justifyContent:'space-between', border:`1px solid ${colors.border}`, borderRadius:12, padding:'8px 10px', marginBottom:6, background:'#fff' },
  habitItem: { display:'flex', alignItems:'center', justifyContent:'space-between', border:`1px solid ${colors.border}`, borderRadius:12, padding:'10px 12px', background:'#fff' },
  check: { width:28, height:28, borderRadius:999, border:`2px solid ${colors.border}`, display:'grid', placeItems:'center', cursor:'pointer' },
  bottomTabs: { position:'fixed', left:0, right:0, bottom:0, display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, padding:8, background:'#fff', borderTop:`1px solid ${colors.border}` },
  tabBtn: { padding:'10px 8px', border:`1px solid ${colors.border}`, borderRadius:12, background:'#fff', cursor:'pointer' },
  tabBtnActive: { background: colors.accent, color:'#fff' },
};
