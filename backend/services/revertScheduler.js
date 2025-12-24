// revertScheduler.js - Background job to process scheduled price reverts
const actions = require('../copilot/actions');
async function runScheduledReverts() {
  console.log('[RevertScheduler] Checking for scheduled reverts...');

  try {
    const result = await actions.processScheduledReverts();

    if (result.processed > 0) {
      console.log(`[RevertScheduler] ✓ Processed ${result.processed} reverts`);
    } else {
      console.log('[RevertScheduler] No reverts to process');
    }

    return result;
  } catch (error) {
    console.error('[RevertScheduler] Error processing reverts:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start the scheduled revert processor
 * Runs every hour by default
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 */
function startRevertScheduler(intervalMs = 60 * 60 * 1000) {
  console.log(`[RevertScheduler] Starting scheduler (interval: ${intervalMs / 1000}s)`);

  // Run immediately on startup
  runScheduledReverts();

  // Then run periodically
  const interval = setInterval(runScheduledReverts, intervalMs);

  // Return function to stop the scheduler
  return () => {
    clearInterval(interval);
    console.log('[RevertScheduler] Scheduler stopped');
  };
}

module.exports = {
  runScheduledReverts,
  startRevertScheduler
};
