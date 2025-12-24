const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const bodyParser = require('body-parser');

const DATA_PATH = path.resolve(__dirname, 'hotels.json');
const PORT = process.env.PORT || 4001;

function mean(arr){ if(!arr || arr.length===0) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }

async function loadData(){
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

async function persistData(data){
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// reuse suggestion logic similar to copilot
// Train a small linear regression model (gradient descent)
function trainModel(data){
  const X = [];
  const y = [];
  data.forEach(r => {
    const compAvg = mean(r.competitorPrices);
    const target = r.currentPrice + (compAvg - r.currentPrice) * 0.5 + (r.occupancy - 0.6) * r.currentPrice * 0.2;
    X.push([1, r.currentPrice, r.occupancy, compAvg]);
    y.push(target);
  });
  let w = [0,0.5,0.5,0.2];
  const lr = 0.0000005;
  const epochs = 5000;
  for(let it=0; it<epochs; it++){
    const grads = [0,0,0,0];
    let loss = 0;
    for(let i=0;i<X.length;i++){
      const xi = X[i];
      let pred = 0;
      for(let j=0;j<w.length;j++) pred += w[j]*xi[j];
      const err = pred - y[i];
      loss += err*err;
      for(let j=0;j<w.length;j++) grads[j] += 2*err*xi[j];
    }
    for(let j=0;j<w.length;j++) w[j] -= lr * grads[j]/X.length;
    if(loss < 1e-6) break;
  }
  return w;
}

function predictWithModel(w, room){
  const compAvg = mean(room.competitorPrices);
  const features = [1, room.currentPrice, room.occupancy, compAvg];
  let pred = 0;
  for(let j=0;j<w.length;j++) pred += w[j]*features[j];
  return pred;
}

function explainRoom(w, room, intent){
  const compAvg = mean(room.competitorPrices);
  const features = { intercept: 1, currentPrice: room.currentPrice, occupancy: room.occupancy, competitorAvg: compAvg };
  const names = Object.keys(features);
  const coeffs = w || [0,0,0,0];
  const contrib = {};
  let totalAbs = 0;
  // map coeffs: coeffs[0]=intercept, [1]=currentPrice, [2]=occupancy, [3]=competitorAvg
  names.forEach((n, i)=>{ const c = coeffs[i] * features[n]; contrib[n] = { value: features[n], contribution: coeffs[i]*features[n] }; totalAbs += Math.abs(contrib[n].contribution); });
  const weights = {};
  names.forEach(n => { weights[n] = { value: contrib[n].value, contribution: contrib[n].contribution, weight: totalAbs===0?0:contrib[n].contribution/totalAbs }; });
  const modelPred = predictWithModel(w, room);
  // suggested price (reuse logic)
  const rec = suggestForRoom(room, intent, w);
  // create a concise reason summary: top-2 signals by absolute contribution
  const signalEntries = Object.entries(weights).map(([k,v])=>({ key:k, weight: Math.abs(v.weight), contrib: v.contribution }));
  signalEntries.sort((a,b)=>Math.abs(b.contrib)-Math.abs(a.contrib));
  const top = signalEntries.slice(0,2).map(s => `${s.key}:${(weights[s.key].weight*100).toFixed(0)}%`).join(', ');
  const reason = `Model $${modelPred.toFixed(2)} — top signals: ${top}`;
  const reasonSummary = top;
  return { signals: features, signalWeights: weights, modelPrediction: modelPred, recommendation: rec, reason, reasonSummary };
}

function suggestForRoom(room, intent, model){
  let base = model ? predictWithModel(model, room) : room.currentPrice;
  if(intent === 'increase') base = base * 1.05;
  if(intent === 'decrease') base = base * 0.95;
  const suggested = Math.max(20, Math.round(base*100)/100);
  const deltaPct = ((suggested - room.currentPrice)/room.currentPrice)*100;
  return { suggested, deltaPct };
}

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/hotels', async (req,res)=>{
  try{
    const data = await loadData();
    res.json(data);
  }catch(err){ res.status(500).json({error: 'failed to load data'}); }
});

app.post('/api/suggest', async (req,res)=>{
  const prompt = (req.body && req.body.prompt) || '';
  const p = (prompt||'').toLowerCase();
  let intent = 'review';
  if(p.includes('low') || p.includes('increase') || p.includes('raise') || p.includes('higher')) intent = 'increase';
  if(p.includes('high') || p.includes('decrease') || p.includes('drop') || p.includes('lower')) intent = 'decrease';
  try{
    const data = await loadData();
    const model = trainModel(data);
    // build richer analysis + recommendations per room
    const analysis = data.map(room => {
      const compAvg = mean(room.competitorPrices);
      const occupancy = room.occupancy;
      const minAllowed = Math.max(20, Math.round(room.currentPrice * 0.8 * 100)/100);
      const maxAllowed = Math.round(room.currentPrice * 1.25 * 100)/100;
      const expl = explainRoom(model, room, intent);
      const recommendation = Object.assign({ id: room.id, name: room.name, currentPrice: room.currentPrice, competitorAvg: compAvg, occupancy, minAllowed, maxAllowed }, expl.recommendation, { reason: expl.reason, reasonSummary: expl.reasonSummary, signalWeights: expl.signalWeights });
      return { analysis: { id: room.id, competitorAvg: compAvg, occupancy, modelPrediction: expl.modelPrediction, constraints: { minAllowed, maxAllowed }, signalWeights: expl.signalWeights }, recommendation };
    });
    // separate lists for UI convenience
    const suggestions = analysis.map(a => a.recommendation);
    const analyses = analysis.map(a => a.analysis);
    res.json({ intent, suggestions, analyses });
  }catch(err){ res.status(500).json({error:'failed to compute suggestions'}); }
});

app.post('/api/apply', async (req,res)=>{
  const approvals = req.body && req.body.approvals; // [{id, approved, suggested}]
  if(!Array.isArray(approvals)) return res.status(400).json({error:'invalid payload'});
  try{
    const data = await loadData();
    // recompute model and explanations so audit contains the decision trace
    const model = trainModel(data);
    const applied = [];
    const newData = data.map(room => {
      const a = approvals.find(x => x.id === room.id);
      if(a && a.approved){
        const expl = explainRoom(model, room, req.body.intent || 'review');
        const finalPrice = a.suggested;
        applied.push({ id: room.id, name: room.name, proposed: a.suggested, approved: true, final: finalPrice, explanation: expl, reasonSummary: expl.reasonSummary });
        return { ...room, currentPrice: finalPrice };
      }
      return room;
    });
    await persistData(newData);
    // audit log with trace
    const auditEntry = {
      time: new Date().toISOString(),
      operator: req.body.operator || 'local-operator',
      prompt: req.body.prompt || null,
      intent: req.body.intent || 'review',
      approvals: approvals,
      applied,
    };
    try{
      await fs.appendFile(path.resolve(__dirname, 'audit.log'), JSON.stringify(auditEntry)+"\n");
    }catch(e){ /* ignore */ }
    res.json({ success: true, audit: auditEntry });
  }catch(err){ res.status(500).json({ error: 'failed to apply changes' }); }
});

app.listen(PORT, ()=>{
  console.log(`Ai-copilot server listening on http://localhost:${PORT}`);
});
