// ============================================================
// SCORM 1.2 Adapter — Lightweight runtime API for LMS comms.
// This gets embedded directly into the generated output HTML.
// ============================================================

export function generateScormAdapterJs(): string {
  return `
// SCORM 1.2 Communication Adapter
var SCORM = (function() {
  var api = null;
  var initialized = false;
  var completed = false;

  function findAPI(win) {
    var attempts = 0;
    while (win && !win.API && attempts < 10) {
      if (win.parent && win.parent !== win) { win = win.parent; }
      else if (win.opener) { win = win.opener; }
      else { break; }
      attempts++;
    }
    return win ? win.API : null;
  }

  function init() {
    api = findAPI(window);
    if (!api) {
      console.warn('[SCORM] No LMS API found — running in standalone mode');
      return false;
    }
    var result = api.LMSInitialize('');
    initialized = (result === 'true' || result === true);
    if (initialized) {
      api.LMSSetValue('cmi.core.lesson_status', 'incomplete');
      api.LMSCommit('');
    }
    return initialized;
  }

  function setValue(key, value) {
    if (!api || !initialized) return false;
    var result = api.LMSSetValue(key, String(value));
    api.LMSCommit('');
    return result === 'true' || result === true;
  }

  function getValue(key) {
    if (!api || !initialized) return '';
    return api.LMSGetValue(key);
  }

  function setScore(score, max, min) {
    setValue('cmi.core.score.raw', score);
    setValue('cmi.core.score.max', max || 100);
    setValue('cmi.core.score.min', min || 0);
  }

  function setStatus(status) {
    setValue('cmi.core.lesson_status', status);
  }

  function complete(score, passingScore) {
    if (completed) return;
    completed = true;
    if (typeof score === 'number') {
      setScore(score);
      setStatus(score >= (passingScore || 80) ? 'passed' : 'failed');
    } else {
      setStatus('completed');
    }
  }

  function suspend(data) {
    if (data) setValue('cmi.suspend_data', JSON.stringify(data));
    setValue('cmi.core.exit', 'suspend');
  }

  function getSuspendData() {
    var raw = getValue('cmi.suspend_data');
    try { return raw ? JSON.parse(raw) : null; }
    catch(e) { return null; }
  }

  function finish() {
    if (!api || !initialized) return;
    api.LMSFinish('');
  }

  return {
    init: init,
    setValue: setValue,
    getValue: getValue,
    setScore: setScore,
    setStatus: setStatus,
    complete: complete,
    suspend: suspend,
    getSuspendData: getSuspendData,
    finish: finish,
    isConnected: function() { return initialized; }
  };
})();

// Initialize on load, finish on unload
window.addEventListener('load', function() { SCORM.init(); });
window.addEventListener('beforeunload', function() { SCORM.finish(); });
`;
}
