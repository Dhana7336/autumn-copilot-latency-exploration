async function getHotels(){
  const res = await fetch('/api/hotels');
  return res.json();
}

function el(tag, props = {}, ...children){
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k,v])=>{ if(k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v); else e.setAttribute(k,v); });
  children.forEach(c=>{ if(typeof c === 'string') e.appendChild(document.createTextNode(c)); else if(c) e.appendChild(c); });
  return e;
}

document.getElementById('suggestBtn').addEventListener('click', async ()=>{
  const prompt = document.getElementById('prompt').value;
  const res = await fetch('/api/suggest', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
  const data = await res.json();
  const container = document.getElementById('suggestions');
  container.innerHTML = '';
  data.suggestions.forEach(s => {
    const row = el('div', { class: 'card' },
      el('h3', {}, `${s.id} ${s.name}`),
      el('p', {}, `Current: $${s.currentPrice.toFixed(2)} Suggested: $${s.suggested.toFixed(2)} (${s.deltaPct>=0?'+':''}${s.deltaPct.toFixed(1)}%)`),
      el('div', {},
        el('label', {}, 'Adjust suggested price: '),
        el('input', { type: 'number', id: `input-${s.id}`, value: s.suggested.toFixed(2), step: '0.01', style: 'width:120px; margin-left:8px;' })
      ),
      el('label', {},
        el('input', { type: 'checkbox', id: `chk-${s.id}`, 'data-id': s.id }), ' Approve'
      )
    );
    container.appendChild(row);
  });
  document.getElementById('applyBtn').disabled = false;
});

document.getElementById('applyBtn').addEventListener('click', async ()=>{
  const checks = Array.from(document.querySelectorAll('[id^="chk-"]'));
  const approvals = checks.map(chk => {
    const id = chk.getAttribute('data-id');
    const input = document.getElementById(`input-${id}`);
    const suggested = input ? parseFloat(input.value) : parseFloat(chk.getAttribute('data-suggested'));
    return { id, approved: chk.checked, suggested };
  });
  const res = await fetch('/api/apply', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ approvals }) });
  const result = await res.json();
  const status = document.getElementById('status');
  if(result && result.success){ status.textContent = 'Applied approved changes.'; } else { status.textContent = 'Failed to apply changes.'; }
});
