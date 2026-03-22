/**
 * React App Generator + SCORM Adapter
 * Produces the runtime JS that gets embedded in the output course HTML.
 * Part 3 of the generator.
 */
window.GeneratorApp = (function () {
  'use strict';

  function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escJs(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  function generateScormAdapterJs() {
    return 'var SCORM = (function() {\n' +
      '  var api = null, initialized = false, completed = false;\n' +
      '  function findAPI(win) {\n' +
      '    var attempts = 0;\n' +
      '    while (win && !win.API && attempts < 10) {\n' +
      '      if (win.parent && win.parent !== win) { win = win.parent; }\n' +
      '      else if (win.opener) { win = win.opener; }\n' +
      '      else { break; }\n' +
      '      attempts++;\n' +
      '    }\n' +
      '    return win ? win.API : null;\n' +
      '  }\n' +
      '  function init() {\n' +
      '    api = findAPI(window);\n' +
      '    if (!api) { console.warn("[SCORM] No LMS API found — standalone mode"); return false; }\n' +
      '    var result = api.LMSInitialize("");\n' +
      '    initialized = (result === "true" || result === true);\n' +
      '    if (initialized) { api.LMSSetValue("cmi.core.lesson_status", "incomplete"); api.LMSCommit(""); }\n' +
      '    return initialized;\n' +
      '  }\n' +
      '  function setValue(key, value) {\n' +
      '    if (!api || !initialized) return false;\n' +
      '    api.LMSSetValue(key, String(value)); api.LMSCommit(""); return true;\n' +
      '  }\n' +
      '  function getValue(key) { return (api && initialized) ? api.LMSGetValue(key) : ""; }\n' +
      '  function setScore(score, max, min) {\n' +
      '    setValue("cmi.core.score.raw", score);\n' +
      '    setValue("cmi.core.score.max", max || 100);\n' +
      '    setValue("cmi.core.score.min", min || 0);\n' +
      '  }\n' +
      '  function complete(score, passingScore) {\n' +
      '    if (completed) return; completed = true;\n' +
      '    if (typeof score === "number") {\n' +
      '      setScore(score);\n' +
      '      setValue("cmi.core.lesson_status", score >= (passingScore || 80) ? "passed" : "failed");\n' +
      '    } else { setValue("cmi.core.lesson_status", "completed"); }\n' +
      '  }\n' +
      '  function finish() { if (api && initialized) api.LMSFinish(""); }\n' +
      '  return { init: init, setValue: setValue, getValue: getValue, setScore: setScore, complete: complete, finish: finish };\n' +
      '})();\n' +
      'window.addEventListener("load", function() { SCORM.init(); });\n' +
      'window.addEventListener("beforeunload", function() { SCORM.finish(); });\n';
  }

  function generateAppJs(course, brand, images) {
    var slidesData = JSON.stringify(GeneratorData.buildSlidesData(course, images));
    var quizData = JSON.stringify(GeneratorData.buildQuizData(course));

    // Find best title from title slide text
    var titleSlide = course.slides.find(function (s) { return s.type === 'title'; });
    var titleTexts = titleSlide ? titleSlide.elements
      .filter(function (el) { return el.type === 'text' && el.role !== 'unknown'; })
      .map(function (el) { return el.content.trim(); })
      .filter(function (t) { return t.length > 5; }) : [];
    var bestTitle = titleTexts.find(function (t) {
      return !t.toLowerCase().includes('test') && !t.toLowerCase().includes('scene');
    }) || course.meta.title;

    var courseTitle = escJs(bestTitle);
    var masteryScore = course.meta.masteryScore;
    var logoUrl = brand.logo && brand.logo.url ? escJs(brand.logo.url) : '';
    var logoAlt = brand.logo && brand.logo.alt ? escJs(brand.logo.alt) : '';

    return '"use strict";\n' +
      'var e = React.createElement;\n' +
      'var SLIDES = ' + slidesData + ';\n' +
      'var QUIZ_BANKS = ' + quizData + ';\n' +
      'var MASTERY = ' + masteryScore + ';\n' +
      'var COURSE_TITLE = ' + JSON.stringify(courseTitle) + ';\n' +
      'var LOGO_URL = ' + JSON.stringify(logoUrl) + ';\n' +
      'var LOGO_ALT = ' + JSON.stringify(logoAlt) + ';\n\n' +
      'function shuffleArray(arr) {\n' +
      '  var a = arr.slice();\n' +
      '  for (var i = a.length - 1; i > 0; i--) {\n' +
      '    var j = Math.floor(Math.random() * (i + 1));\n' +
      '    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;\n' +
      '  }\n  return a;\n}\n\n' +
      generateAppComponent() +
      'ReactDOM.createRoot(document.getElementById("root")).render(e(App));\n';
  }

  function generateAppComponent() {
    return 'function App() {\n' +
      '  var _s = React.useState(0), currentSlide = _s[0], setCurrentSlide = _s[1];\n' +
      '  var _f = React.useState({}), formData = _f[0], setFormData = _f[1];\n' +
      '  var _q = React.useState(null), quizState = _q[0], setQuizState = _q[1];\n' +
      '  var _sc = React.useState(null), score = _sc[0], setScore = _sc[1];\n' +
      '  var _sel = React.useState(null), selectedChoice = _sel[0], setSelectedChoice = _sel[1];\n' +
      '  var _selM = React.useState([]), selectedChoices = _selM[0], setSelectedChoices = _selM[1];\n' +
      '  var _ans = React.useState(false), answered = _ans[0], setAnswered = _ans[1];\n' +
      '  var _qi = React.useState(0), quizIndex = _qi[0], setQuizIndex = _qi[1];\n' +
      '  var _corr = React.useState(0), correctCount = _corr[0], setCorrectCount = _corr[1];\n' +
      '  var _tot = React.useState(0), totalQ = _tot[0], setTotalQ = _tot[1];\n' +
      '  var _br = React.useState(null), branch = _br[0], setBranch = _br[1];\n' +
      '  var _qqs = React.useState([]), quizQuestions = _qqs[0], setQuizQuestions = _qqs[1];\n' +
      '  var _ta = React.useState(""), textAnswer = _ta[0], setTextAnswer = _ta[1];\n' +
      '  var _al = React.useState(0), activeLayer = _al[0], setActiveLayer = _al[1];\n\n' +
      '  var slide = SLIDES[currentSlide];\n' +
      '  var totalSlides = SLIDES.length;\n\n' +
      '  function goNext() {\n' +
      '    setSelectedChoice(null); setSelectedChoices([]); setTextAnswer(""); setAnswered(false); setActiveLayer(0);\n' +
      '    if (currentSlide < totalSlides - 1) setCurrentSlide(currentSlide + 1);\n' +
      '  }\n' +
      '  function goPrev() {\n' +
      '    if (currentSlide > 0) {\n' +
      '      setSelectedChoice(null); setSelectedChoices([]); setTextAnswer(""); setAnswered(false); setActiveLayer(0);\n' +
      '      setCurrentSlide(currentSlide - 1);\n' +
      '    }\n' +
      '  }\n' +
      '  function startQuiz(bankId) {\n' +
      '    var bank = QUIZ_BANKS.find(function(b) { return b.id === bankId; });\n' +
      '    if (!bank) { goNext(); return; }\n' +
      '    var qs = shuffleArray(bank.questions).slice(0, bank.drawCount);\n' +
      '    setQuizQuestions(qs); setQuizIndex(0); setCorrectCount(0); setTotalQ(qs.length);\n' +
      '    setQuizState("active"); setSelectedChoice(null); setAnswered(false);\n' +
      '  }\n' +
      '  function handleQuizAnswer(choiceIdx) {\n' +
      '    if (answered) return;\n' +
      '    var q = quizQuestions[quizIndex]; if (!q) return;\n' +
      '    if (q.questionType === "pick-many") {\n' +
      '      var updated = selectedChoices.slice();\n' +
      '      var pos = updated.indexOf(choiceIdx);\n' +
      '      if (pos >= 0) updated.splice(pos, 1); else updated.push(choiceIdx);\n' +
      '      setSelectedChoices(updated); return;\n' +
      '    }\n' +
      '    setSelectedChoice(choiceIdx); setAnswered(true);\n' +
      '    if (q.choices[choiceIdx] && q.choices[choiceIdx].isCorrect) setCorrectCount(correctCount + 1);\n' +
      '  }\n' +
      '  function submitMultiAnswer() {\n' +
      '    if (answered) return; setAnswered(true);\n' +
      '    var q = quizQuestions[quizIndex]; if (!q) return;\n' +
      '    var allCorrect = q.choices.every(function(c, i) {\n' +
      '      var isSel = selectedChoices.indexOf(i) >= 0;\n' +
      '      return c.isCorrect ? isSel : !isSel;\n' +
      '    });\n' +
      '    if (allCorrect) setCorrectCount(correctCount + 1);\n' +
      '  }\n' +
      '  function submitTextAnswer() { if (!answered) setAnswered(true); }\n' +
      '  function nextQuestion() {\n' +
      '    if (quizIndex < quizQuestions.length - 1) {\n' +
      '      setQuizIndex(quizIndex + 1); setSelectedChoice(null); setSelectedChoices([]);\n' +
      '      setTextAnswer(""); setAnswered(false);\n' +
      '    } else {\n' +
      '      var q = quizQuestions[quizIndex];\n' +
      '      var lastCorrect = answered && q && q.choices[selectedChoice] && q.choices[selectedChoice].isCorrect ? 1 : 0;\n' +
      '      var finalScore = Math.round((correctCount + lastCorrect) / totalQ * 100);\n' +
      '      setScore(finalScore); setQuizState("complete");\n' +
      '      SCORM.complete(finalScore, MASTERY); setCurrentSlide(totalSlides - 1);\n' +
      '    }\n' +
      '  }\n' +
      '  function handleFormChange(field, value) {\n' +
      '    var updated = Object.assign({}, formData); updated[field] = value; setFormData(updated);\n' +
      '  }\n\n' +
      '  var progress = ((currentSlide + 1) / totalSlides) * 100;\n\n' +
      generateRenderFunctions() +
      '  var showNav = slide && slide.type !== "title" && slide.type !== "results";\n' +
      '  var isQuizActive = quizState === "active";\n' +
      '  return e("div", { className: "app" },\n' +
      '    e("div", { className: "progress-bar" }, e("div", { className: "progress-fill", style: { width: progress + "%" } })),\n' +
      '    e("div", { className: "slide-container" }, renderSlide()),\n' +
      '    showNav && !isQuizActive ? e("div", { className: "nav-bar" },\n' +
      '      e("button", { className: "btn btn-ghost", onClick: goPrev, disabled: currentSlide === 0, style: currentSlide === 0 ? { opacity: 0.3 } : {} }, "\\u2190 Back"),\n' +
      '      e("span", { className: "slide-counter" }, (currentSlide + 1) + " / " + totalSlides),\n' +
      '      e("button", { className: "btn btn-primary", onClick: goNext }, "Next \\u2192")\n' +
      '    ) : null\n' +
      '  );\n' +
      '}\n\n';
  }

  function generateRenderFunctions() {
    return '  function renderSlide() {\n' +
      '    if (!slide) return e("div", null, "No slide data");\n' +
      '    if (quizState === "active" && quizQuestions.length > 0) return renderQuizSlide();\n' +
      '    switch (slide.type) {\n' +
      '      case "title": return renderTitleSlide();\n' +
      '      case "objectives": return renderObjectivesSlide();\n' +
      '      case "form": return renderFormSlide();\n' +
      '      case "branching": return renderBranchingSlide();\n' +
      '      case "quiz": return renderQuizSlide();\n' +
      '      case "results": return renderResultsSlide();\n' +
      '      default: return renderContentSlide();\n' +
      '    }\n  }\n\n' +
      '  function renderTitleSlide() {\n' +
      '    return e("div", { className: "slide slide-title", style: slide.image ? {\n' +
      '      backgroundImage: "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.7)), url(" + slide.image + ")",\n' +
      '      backgroundSize: "cover", backgroundPosition: "center"\n' +
      '    } : {} },\n' +
      '      e("div", { className: "content" },\n' +
      '        LOGO_URL ? e("img", { src: LOGO_URL, alt: LOGO_ALT, className: "logo" }) : null,\n' +
      '        e("h1", null, slide.title || COURSE_TITLE),\n' +
      '        slide.subtitle ? e("p", { className: "subtitle" }, slide.subtitle) : null,\n' +
      '        e("button", { className: "btn", onClick: goNext }, "Start Course")\n' +
      '      )\n    );\n  }\n\n' +
      '  function renderObjectivesSlide() {\n' +
      '    return e("div", { className: "slide slide-content" },\n' +
      '      e("div", { className: "card" },\n' +
      '        e("h2", null, slide.title),\n' +
      '        slide.texts && slide.texts.map(function(t, i) { return e("p", { key: i }, t); }),\n' +
      '        slide.image ? e("div", { className: "hero-image" }, e("img", { src: slide.image, alt: slide.title })) : null,\n' +
      '        slide.video ? e("div", { className: "video-container" }, e("video", { controls: true, preload: "metadata", poster: slide.video.poster, src: slide.video.src })) : null,\n' +
      '        slide.audio ? e("div", { className: "audio-container" }, e("audio", { controls: true, preload: "metadata", src: slide.audio.src })) : null,\n' +
      '        e("div", { style: { marginTop: "calc(var(--spacing) * 3)", textAlign: "center" } },\n' +
      '          e("button", { className: "btn btn-primary", onClick: goNext }, "Continue")\n' +
      '        )\n      )\n    );\n  }\n\n' +
      '  function renderFormSlide() {\n' +
      '    return e("div", { className: "slide slide-content" },\n' +
      '      e("div", { className: "card" },\n' +
      '        e("h2", null, slide.title),\n' +
      '        slide.instruction ? e("p", null, slide.instruction) : null,\n' +
      '        slide.fields && slide.fields.map(function(f, i) {\n' +
      '          return e("div", { className: "form-group", key: i },\n' +
      '            e("label", null, f.label || f.placeholder),\n' +
      '            e("input", { type: f.fieldType || "text", placeholder: f.placeholder,\n' +
      '              value: formData[f.variableName] || "",\n' +
      '              onChange: function(ev) { handleFormChange(f.variableName, ev.target.value); }\n' +
      '            })\n          );\n        }),\n' +
      '        e("div", { style: { marginTop: "calc(var(--spacing) * 3)", textAlign: "center" } },\n' +
      '          e("button", { className: "btn btn-primary", onClick: goNext }, "Continue"))\n' +
      '      )\n    );\n  }\n\n' +
      '  function renderBranchingSlide() {\n' +
      '    var userName = formData["TextEntry9"] || "";\n' +
      '    return e("div", { className: "slide slide-content" },\n' +
      '      e("div", { style: { textAlign: "center", maxWidth: "760px" } },\n' +
      '        e("h2", null, slide.title),\n' +
      '        slide.instruction ? e("p", { style: { marginBottom: "calc(var(--spacing) * 2)" } }, slide.instruction) : null,\n' +
      '        slide.greeting ? e("p", { style: { fontSize: "18px", marginBottom: "calc(var(--spacing) * 2)" } },\n' +
      '          slide.greeting.replace("%name%", userName)) : null,\n' +
      '        e("div", { className: "branch-options" },\n' +
      '          slide.options && slide.options.map(function(opt, i) {\n' +
      '            return e("div", { className: "branch-option", key: i,\n' +
      '              onClick: function() {\n' +
      '                setBranch(opt.value || opt.label);\n' +
      '                if (opt.quizBank) { startQuiz(opt.quizBank); }\n' +
      '                else { setScore(100); setQuizState("complete"); SCORM.complete(100, MASTERY); setCurrentSlide(totalSlides - 1); }\n' +
      '              }\n' +
      '            }, e("h3", null, opt.label));\n' +
      '          })\n        )\n      )\n    );\n  }\n\n' +
      '  function renderQuizSlide() {\n' +
      '    var q = quizQuestions[quizIndex];\n' +
      '    if (!q) return e("div", { className: "slide slide-content" }, e("p", null, "Loading quiz..."));\n' +
      '    var qType = q.questionType || "pick-one";\n' +
      '    var isMulti = qType === "pick-many";\n' +
      '    var isTextEntry = qType === "text-entry";\n' +
      '    var wasCorrect = false;\n' +
      '    if (answered && !isTextEntry) {\n' +
      '      if (isMulti) {\n' +
      '        wasCorrect = q.choices.every(function(c, i) { var isSel = selectedChoices.indexOf(i) >= 0; return c.isCorrect ? isSel : !isSel; });\n' +
      '      } else { wasCorrect = q.choices[selectedChoice] && q.choices[selectedChoice].isCorrect; }\n' +
      '    }\n' +
      '    return e("div", { className: "slide slide-content" },\n' +
      '      e("div", { style: { textAlign: "center", width: "100%", maxWidth: "760px" } },\n' +
      '        e("p", { style: { color: "var(--text-muted)", marginBottom: "var(--spacing)" } }, "Question " + (quizIndex + 1) + " of " + totalQ),\n' +
      '        e("div", { className: "quiz-question" }, q.questionText),\n' +
      '        isTextEntry ? e("div", { className: "quiz-text-entry" },\n' +
      '          e("input", { type: "text", placeholder: "Type your answer...", value: textAnswer, disabled: answered,\n' +
      '            onChange: function(ev) { setTextAnswer(ev.target.value); },\n' +
      '            onKeyDown: function(ev) { if (ev.key === "Enter" && textAnswer.trim()) submitTextAnswer(); }\n' +
      '          }),\n' +
      '          !answered && textAnswer.trim() ? e("div", { style: { marginTop: "calc(var(--spacing) * 2)" } },\n' +
      '            e("button", { className: "btn btn-primary", onClick: submitTextAnswer }, "Submit Answer")) : null\n' +
      '        ) :\n' +
      '        e("div", { className: "quiz-choices" },\n' +
      '          q.choices.map(function(c, i) {\n' +
      '            var cls = "quiz-choice";\n' +
      '            var isSel = isMulti ? selectedChoices.indexOf(i) >= 0 : selectedChoice === i;\n' +
      '            if (isSel) cls += " selected";\n' +
      '            if (answered && c.isCorrect) cls += " correct";\n' +
      '            if (answered && isSel && !c.isCorrect) cls += " incorrect";\n' +
      '            return e("div", { className: cls, key: i, onClick: function() { handleQuizAnswer(i); } },\n' +
      '              e("div", { className: "indicator" + (isMulti ? " checkbox" : "") },\n' +
      '                answered ? (c.isCorrect ? "\\u2713" : (isSel ? "\\u2717" : "")) : (isSel ? (isMulti ? "\\u2713" : "\\u25CF") : "")\n' +
      '              ),\n' +
      '              e("span", null, c.text)\n' +
      '            );\n          })\n        ),\n' +
      '        isMulti && !answered && selectedChoices.length > 0 ? e("div", { style: { marginTop: "calc(var(--spacing) * 2)" } },\n' +
      '          e("button", { className: "btn btn-primary", onClick: submitMultiAnswer }, "Submit Answer")) : null,\n' +
      '        answered ? e("div", { className: "quiz-feedback " + (isTextEntry ? "correct" : (wasCorrect ? "correct" : "incorrect")) },\n' +
      '          isTextEntry ? "Answer submitted" : (wasCorrect ? (q.correctFeedback || "Correct!") : (q.incorrectFeedback || "Incorrect."))) : null,\n' +
      '        answered ? e("div", { style: { marginTop: "calc(var(--spacing) * 2)" } },\n' +
      '          e("button", { className: "btn btn-primary", onClick: nextQuestion },\n' +
      '            quizIndex < quizQuestions.length - 1 ? "Next Question" : "See Results")) : null\n' +
      '      )\n    );\n  }\n\n' +
      '  function renderResultsSlide() {\n' +
      '    var displayScore = score !== null ? score : 0;\n' +
      '    var passed = displayScore >= MASTERY;\n' +
      '    return e("div", { className: "slide slide-results" },\n' +
      '      e("div", { className: "content", style: { maxWidth: "500px" } },\n' +
      '        e("h2", { style: { color: "white" } }, slide.title || "Your Results"),\n' +
      '        e("div", { className: "score-circle" },\n' +
      '          e("div", { className: "score-value" }, displayScore + "%"),\n' +
      '          e("div", { className: "score-label" }, passed ? "Passed" : "Not passed")\n' +
      '        ),\n' +
      '        e("p", { style: { color: "rgba(255,255,255,0.85)", marginTop: "calc(var(--spacing) * 2)" } },\n' +
      '          passed ? "Congratulations! You have successfully completed this course."\n' +
      '            : "You need " + MASTERY + "% to pass. Please try again."),\n' +
      '        !passed ? e("button", {\n' +
      '          className: "btn", style: { marginTop: "calc(var(--spacing) * 3)", background: "white", color: "var(--primary)" },\n' +
      '          onClick: function() { setCurrentSlide(0); setQuizState(null); setScore(null); }\n' +
      '        }, "Restart Course") : null\n' +
      '      )\n    );\n  }\n\n' +
      '  function renderContentSlide() {\n' +
      '    return e("div", { className: "slide slide-content" },\n' +
      '      e("div", { className: "card" },\n' +
      '        e("h2", null, slide.title),\n' +
      '        slide.texts && slide.texts.map(function(t, i) { return e("p", { key: i }, t); }),\n' +
      '        slide.image ? e("div", { className: "hero-image" }, e("img", { src: slide.image, alt: slide.title })) : null,\n' +
      '        slide.video ? e("div", { className: "video-container" }, e("video", { controls: true, preload: "metadata", poster: slide.video.poster, src: slide.video.src })) : null,\n' +
      '        slide.audio ? e("div", { className: "audio-container" }, e("audio", { controls: true, preload: "metadata", src: slide.audio.src })) : null\n' +
      '      ),\n' +
      '      slide.layers && slide.layers.length > 0 ? e("div", { style: { width: "100%", maxWidth: "760px", marginTop: "calc(var(--spacing) * 2)" } },\n' +
      '        e("div", { className: "layer-tabs" },\n' +
      '          slide.layers.map(function(layer, i) {\n' +
      '            return e("button", { className: "layer-tab" + (activeLayer === i ? " active" : ""), key: i,\n' +
      '              onClick: function() { setActiveLayer(i); } }, layer.name);\n' +
      '          })\n        ),\n' +
      '        e("div", { className: "layer-content card" },\n' +
      '          slide.layers[activeLayer] && slide.layers[activeLayer].texts.map(function(t, i) { return e("p", { key: i }, t); }),\n' +
      '          slide.layers[activeLayer] && slide.layers[activeLayer].image ?\n' +
      '            e("div", { className: "hero-image" }, e("img", { src: slide.layers[activeLayer].image, alt: slide.layers[activeLayer].name })) : null\n' +
      '        )\n      ) : null,\n' +
      '      e("div", { style: { marginTop: "calc(var(--spacing) * 3)", textAlign: "center" } },\n' +
      '        e("button", { className: "btn btn-primary", onClick: goNext }, "Continue"))\n' +
      '    );\n  }\n\n';
  }

  /**
   * Main entry: generate the complete output HTML document
   */
  function generateHtml(course, brand, images) {
    var css = GeneratorCSS.generateCss(brand);
    var appJs = generateAppJs(course, brand, images);
    var scormJs = generateScormAdapterJs();
    var fontLink = brand.typography.fontImportUrl
      ? '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
        '  <link href="' + escHtml(brand.typography.fontImportUrl) + '" rel="stylesheet">'
      : '';

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '  <title>' + escHtml(course.meta.title) + '</title>\n' +
      '  ' + fontLink + '\n' +
      '  <style>' + css + '</style>\n' +
      '</head>\n<body>\n' +
      '  <div id="root"></div>\n\n' +
      '  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>\n' +
      '  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>\n\n' +
      '  <script>' + scormJs + '</script>\n' +
      '  <script>' + appJs + '</script>\n' +
      '</body>\n</html>';
  }

  return { generateHtml: generateHtml };
})();
