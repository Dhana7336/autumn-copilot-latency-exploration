import React, { useState } from 'react'

export default function SuggestionList({ suggestions, onApply }){
  const [checked, setChecked] = useState({})
  const [values, setValues] = useState({})

  React.useEffect(()=>{
    const initChecked = {}
    const initValues = {}
    suggestions.forEach(s => { initChecked[s.id] = false; initValues[s.id] = s.suggested })
    setChecked(initChecked); setValues(initValues)
  }, [suggestions])

  function toggle(id){ setChecked(c => ({ ...c, [id]: !c[id] })); }
  function changeVal(id, v){ setValues(c => ({ ...c, [id]: parseFloat(v) })) }

  function apply(){
    const approvals = suggestions.map(s => ({ id: s.id, approved: !!checked[s.id], suggested: values[s.id] }))
    // ask for confirmation for bulk apply with summary
    const toApply = approvals.filter(a => a.approved);
    if(toApply.length === 0){ alert('No rooms approved to apply'); return }
    const summary = toApply.map(a => `#${a.id}: ${a.suggested}`).join('\n');
    if(!window.confirm(`Apply changes to the following rooms?\n${summary}`)) return;
    onApply(approvals)
  }

  return (
    <div className="suggestions">
      {suggestions.length === 0 && <p>No suggestions yet</p>}
      {suggestions.map(s => (
        <div className="card" key={s.id}>
          <h3>{s.id} {s.name}</h3>
          <p>
            Current: ${s.currentPrice.toFixed(2)} &nbsp; 
            Suggested: ${s.suggested.toFixed(2)} &nbsp;
            ({s.deltaPct>=0?'+':''}{s.deltaPct.toFixed(1)}%)
          </p>
          <p style={{fontSize:12, color:'#333'}}><strong>Reason:</strong> {s.reason}</p>
          <p style={{fontSize:12, color:'#666'}}>Competitor avg: ${s.competitorAvg.toFixed(2)} • Occupancy: {Math.round(s.occupancy*100)}% • Allowed: ${s.minAllowed.toFixed(2)} - ${s.maxAllowed.toFixed(2)}</p>
          <div className="row">
            <label>Adjust:</label>
            <input type="number" step="0.01" value={values[s.id] ?? s.suggested} onChange={e=>changeVal(s.id, e.target.value)} />
            <label><input type="checkbox" checked={!!checked[s.id]} onChange={()=>toggle(s.id)} /> Approve</label>
          </div>
        </div>
      ))}
      {suggestions.length > 0 && <button className="apply" onClick={apply}>Apply Approved Changes</button>}
    </div>
  )
}
