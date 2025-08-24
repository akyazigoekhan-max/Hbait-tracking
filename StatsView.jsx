
import React from 'react'
export default function StatsView({tasks}){
  const byList = tasks.reduce((acc,t)=>{ acc[t.listId]=(acc[t.listId]||0)+(t.done?1:0); return acc; },{})
  const totals = tasks.reduce((acc,t)=>{ acc[t.listId]=(acc[t.listId]||0)+1; return acc; },{})
  const rows = Object.keys(totals).map(listId=>({listId, pct: Math.round( (byList[listId]||0) / totals[listId] * 100 ) }))
  return (<div className="card">
    <div style={{fontWeight:700, marginBottom:8}}>Fortschritt (%)</div>
    <div className="list">
      {rows.map(r=> (<div key={r.listId}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>{r.listId}</div><div style={{fontWeight:700}}>{r.pct}%</div>
        </div>
        <div style={{height:8, background:'#0f172a', border:'1px solid var(--border)', borderRadius:999}}>
          <div style={{height:'100%', width:r.pct+'%', background:'var(--accent)', borderRadius:999}}></div>
        </div>
      </div>))}
      {rows.length===0 && <div className="muted">Noch keine Daten.</div>}
    </div>
  </div>)
}
