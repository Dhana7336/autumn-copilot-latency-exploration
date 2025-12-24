/**
 * Pricing Engine
 * Handles model training, predictions, and price suggestions with explainability
 */

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function trainModel(rooms) {
  const X = [];
  const y = [];
  rooms.forEach(room => {
    const compAvg = mean(room.competitorPrices);
    
    // Correct training target: optimal price considering market and occupancy
    // High occupancy -> increase toward competitor avg
    // Low occupancy -> decrease slightly below competitor avg
    const occupancyFactor = room.occupancy > 0.7 ? 1.05 : room.occupancy < 0.5 ? 0.95 : 1.0;
    const optimalPrice = compAvg * occupancyFactor;
    
    X.push([1, room.currentPrice, room.occupancy, compAvg]);
    y.push(optimalPrice);
  });

  let w = [0, 0.5, 0.5, 0.2];
  const lr = 0.0000005;
  const epochs = 5000;
  for (let it = 0; it < epochs; it++) {
    const grads = [0, 0, 0, 0];
    let loss = 0;
    for (let i = 0; i < X.length; i++) {
      const xi = X[i];
      let pred = 0;
      for (let j = 0; j < w.length; j++) pred += w[j] * xi[j];
      const err = pred - y[i];
      loss += err * err;
      for (let j = 0; j < w.length; j++) grads[j] += 2 * err * xi[j];
    }
    for (let j = 0; j < w.length; j++) w[j] -= (lr * grads[j]) / X.length;
    if (loss < 1e-6) break;
  }
  return w;
}

/**
 * Predict price using trained model
 */
function predictWithModel(w, room) {
  const compAvg = mean(room.competitorPrices);
  const features = [1, room.currentPrice, room.occupancy, compAvg];
  let pred = 0;
  for (let j = 0; j < w.length; j++) pred += w[j] * features[j];
  return pred;
}

/**
 * Generate explanation with signal weights for a room
 */
function explainRoom(w, room, intent) {
  const compAvg = mean(room.competitorPrices);
  const features = { intercept: 1, currentPrice: room.currentPrice, occupancy: room.occupancy, competitorAvg: compAvg };
  const names = Object.keys(features);
  const coeffs = w || [0, 0, 0, 0];
  const contrib = {};
  let totalAbs = 0;
  names.forEach((n, i) => {
    const c = coeffs[i] * features[n];
    contrib[n] = { value: features[n], contribution: c };
    totalAbs += Math.abs(c);
  });
  const weights = {};
  names.forEach(n => {
    weights[n] = { value: contrib[n].value, contribution: contrib[n].contribution, weight: totalAbs === 0 ? 0 : contrib[n].contribution / totalAbs };
  });
  const modelPred = predictWithModel(w, room);
  const signalEntries = Object.entries(weights).map(([k, v]) => ({ key: k, weight: Math.abs(v.weight), contrib: v.contribution }));
  signalEntries.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
  const top = signalEntries.slice(0, 2).map(s => `${s.key}:${(weights[s.key].weight * 100).toFixed(0)}%`).join(', ');
  const reason = `Model $${modelPred.toFixed(2)} — top signals: ${top}`;
  const reasonSummary = top;
  
  let suggested = modelPred;
  if (intent === 'increase') suggested = suggested * 1.05;
  if (intent === 'decrease') suggested = suggested * 0.95;
  suggested = Math.max(room.minPrice || 20, Math.min(room.maxPrice || 500, Math.round(suggested * 100) / 100));
  
  const deltaPct = ((suggested - room.currentPrice) / room.currentPrice) * 100;
  
  return {
    signals: features,
    signalWeights: weights,
    modelPrediction: modelPred,
    recommendation: { suggested, deltaPct },
    reason,
    reasonSummary
  };
}

/**
 * Generate suggestions for all rooms based on intent
 */
function generateSuggestions(rooms, intent) {
  const model = trainModel(rooms);
  const suggestions = rooms.map(room => {
    const expl = explainRoom(model, room, intent);
    const compAvg = mean(room.competitorPrices);
    const minAllowed = room.minPrice || Math.max(20, Math.round(room.currentPrice * 0.8 * 100) / 100);
    const maxAllowed = room.maxPrice || Math.round(room.currentPrice * 1.25 * 100) / 100;
    return {
      id: room.id,
      name: room.name,
      currentPrice: room.currentPrice,
      competitorAvg: compAvg,
      occupancy: room.occupancy,
      minAllowed,
      maxAllowed,
      suggested: expl.recommendation.suggested,
      deltaPct: expl.recommendation.deltaPct,
      reason: expl.reason,
      reasonSummary: expl.reasonSummary,
      signalWeights: expl.signalWeights
    };
  });
  return { intent, suggestions, model };
}

module.exports = {
  trainModel,
  predictWithModel,
  explainRoom,
  generateSuggestions,
  mean
};
