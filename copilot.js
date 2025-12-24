#!/usr/bin/env node
/*
  Simple AI Copilot CLI (heuristic-based)
  - Loads `hotels.json`
  - Explains current prices
  - Analyzes a user prompt and proposes changes
  - Requests explicit approval before persisting changes
*/

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const DATA_PATH = path.resolve(__dirname, 'hotels.json');

function mean(arr){
  if(!arr || arr.length===0) return 0;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

function formatPrice(p){
  return `$${p.toFixed(2)}`;
}

// Simple prompt analyzer: looks for keywords to set intent
function analyzePrompt(prompt){
  const p = (prompt||'').toLowerCase();
  if(p.includes('low') || p.includes('increase') || p.includes('raise') || p.includes('higher')) return 'increase';
  if(p.includes('high') || p.includes('decrease') || p.includes('drop') || p.includes('lower')) return 'decrease';
  return 'review';
}

// Suggest price for a room using heuristics
// Simple linear regression trainer (gradient descent) to replace heuristic
function trainModel(data){
  // features: [1, currentPrice, occupancy, compAvg]
  const X = [];
  const y = [];
  data.forEach(r => {
    const compAvg = mean(r.competitorPrices);
    // synthetic target: blend competitor avg and occupancy-driven uplift
    const target = r.currentPrice + (compAvg - r.currentPrice) * 0.5 + (r.occupancy - 0.6) * r.currentPrice * 0.2;
    X.push([1, r.currentPrice, r.occupancy, compAvg]);
    y.push(target);
  });

  // initialize weights
  let w = [0, 0.5, 0.5, 0.2];
  const lr = 0.0000005; // learning rate tuned for magnitudes
  const epochs = 5000;
  for(let it=0; it<epochs; it++){
    const grads = [0,0,0,0];
    let loss=0;
    for(let i=0;i<X.length;i++){
      const xi = X[i];
      let pred = 0;
      for(let j=0;j<w.length;j++) pred += w[j]*xi[j];
      const err = pred - y[i];
      loss += err*err;
      for(let j=0;j<w.length;j++) grads[j] += (2*err*xi[j]);
    }
    for(let j=0;j<w.length;j++) w[j] -= lr * grads[j]/X.length;
    if(loss < 1e-6) break;
  }
  return w; // weights
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
  names.forEach((n,i)=>{ const c = coeffs[i]*features[n]; contrib[n] = { value: features[n], contribution: c }; totalAbs += Math.abs(c); });
  const weights = {};
  names.forEach(n => { weights[n] = { value: contrib[n].value, contribution: contrib[n].contribution, weight: totalAbs===0?0:contrib[n].contribution/totalAbs }; });
  const modelPred = predictWithModel(w, room);
  const rec = suggestPrice(room, intent, w);
  const signalEntries = Object.entries(weights).map(([k,v])=>({ key:k, weight: Math.abs(v.weight), contrib: v.contribution }));
  signalEntries.sort((a,b)=>Math.abs(b.contrib)-Math.abs(a.contrib));
  const top = signalEntries.slice(0,2).map(s => `${s.key}:${(weights[s.key].weight*100).toFixed(0)}%`).join(', ');
  const reason = `Model $${modelPred.toFixed(2)} — top signals: ${top}`;
  const reasonSummary = top;
  return { signals: features, signalWeights: weights, modelPrediction: modelPred, recommendation: rec, reason, reasonSummary };
}

function suggestPrice(room, intent, modelWeights){
  const compAvg = mean(room.competitorPrices);
  let base = modelWeights ? predictWithModel(modelWeights, room) : room.currentPrice;
  // tiny intent nudge
  if(intent === 'increase') base = base * 1.05;
  if(intent === 'decrease') base = base * 0.95;
  const suggested = Math.max(20, Math.round(base*100)/100);
  const deltaPct = ((suggested - room.currentPrice)/room.currentPrice)*100;
  return { suggested, deltaPct };
}

async function loadData(){
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

async function persistData(data){
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function ask(question){
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function main(){
  console.log('AI Copilot — Hotel Pricing (CLI)\n');

  const data = await loadData();

  console.log('Current rooms:');
  data.forEach(r => {
    console.log(`- ${r.id} ${r.name}: ${formatPrice(r.currentPrice)} (occupancy ${(r.occupancy*100).toFixed(0)}%)  competitor avg ${formatPrice(mean(r.competitorPrices))}`);
  });

  const promptArg = process.argv.slice(2).join(' ');
  const prompt = promptArg || await ask('\nEnter a short instruction (e.g. "prices look low next weekend"): ');

  const intent = analyzePrompt(prompt);
  console.log(`\nInterpreted intent: ${intent}\n`);
  // Train model on current data and Build suggestions
  const model = trainModel(data);

  const suggestions = data.map(room => {
    const expl = explainRoom(model, room, intent);
    const compAvg = mean(room.competitorPrices);
    const minAllowed = Math.max(20, Math.round(room.currentPrice * 0.8 * 100)/100);
    const maxAllowed = Math.round(room.currentPrice * 1.25 * 100)/100;
    return {
      id: room.id,
      name: room.name,
      currentPrice: room.currentPrice,
      suggested: expl.recommendation.suggested,
      deltaPct: expl.recommendation.deltaPct,
      explanation: expl.reason,
      competitorAvg: compAvg,
      occupancy: room.occupancy,
      minAllowed,
      maxAllowed,
      signalWeights: expl.signalWeights,
    };
  });

  console.log('Proposed changes:');
  suggestions.forEach(s => {
    console.log(`\n${s.id} ${s.name}`);
    console.log(`  Current: ${formatPrice(s.currentPrice)}  Suggested: ${formatPrice(s.suggested)}  (${s.deltaPct>=0?'+':''}${s.deltaPct.toFixed(1)}%)`);
    console.log(`  Reason: ${s.explanation}`);
  });

  // Per-room approval flow
  console.log('\nPlease approve/reject each suggested change:');
  const approvals = {};
  for(const s of suggestions){
    const ans = (await ask(`Apply change for ${s.id} ${s.name}? Current ${formatPrice(s.currentPrice)} -> Suggested ${formatPrice(s.suggested)} (${s.deltaPct>=0?'+':''}${s.deltaPct.toFixed(1)}%) [y/N]: `)).trim().toLowerCase();
    approvals[s.id] = (ans === 'y' || ans === 'yes');
  }

  const anyApproved = Object.values(approvals).some(v => v);
  if(anyApproved){
    const newData = data.map(room => {
      const s = suggestions.find(x => x.id === room.id);
      if(approvals[room.id]){
        return { ...room, currentPrice: s.suggested };
      }
      return room;
    });
    await persistData(newData);
    // audit log
    // Include decision trace per room in audit
    const auditApplied = [];
    const auditApprovals = suggestions.map(s => ({ id: s.id, approved: approvals[s.id]||false, suggested: s.suggested }));
    suggestions.forEach(s => {
      if(approvals[s.id]){
        auditApplied.push({ id: s.id, name: s.name, proposed: s.suggested, approved: true, final: s.suggested, explanation: s.explanation, signalWeights: s.signalWeights, reasonSummary: s.reasonSummary });
      }
    });
    const auditEntry = {
      time: new Date().toISOString(),
      operator: process.env.USER || 'cli-operator',
      prompt,
      intent,
      approvals: auditApprovals,
      applied: auditApplied,
    };
    try{
      await fs.appendFile(path.resolve(__dirname, 'audit.log'), JSON.stringify(auditEntry)+"\n");
    }catch(e){ /* ignore */ }
    console.log('\nApproved changes applied and saved to hotels.json');
  } else {
    console.log('\nNo changes were approved.');
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
