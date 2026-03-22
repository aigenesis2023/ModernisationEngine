/**
 * React App Generator + SCORM Adapter
 * Produces a premium deep-scroll course experience with section-based layout.
 * All content flows as a continuous scroll with scroll-triggered animations,
 * interactive components (accordion, modal, bento, flip cards), and inline quizzes.
 *
 * Generated code is ES5-compatible (no arrow functions, template literals, etc.)
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
      '  function setScore(score, max, min) {\n' +
      '    setValue("cmi.core.score.raw", score);\n' +
      '    setValue("cmi.core.score.max", max || 100);\n' +
      '    setValue("cmi.core.score.min", min || 0);\n' +
      '  }\n' +
      '  function complete(score, passingScore) {\n' +
      '    if (completed) return; completed = true;\n' +
      '    if (typeof score === "number") {\n' +
      '      setScore(score);\n' +
      '      setValue("cmi.core.lesson_status", score >= (passingScore || 80) ? PASS_STATUS : FAIL_STATUS);\n' +
      '    } else { setValue("cmi.core.lesson_status", "completed"); }\n' +
      '  }\n' +
      '  function finish() { if (api && initialized) api.LMSFinish(""); }\n' +
      '  return { init: init, setValue: setValue, setScore: setScore, complete: complete, finish: finish };\n' +
      '})();\n' +
      'window.addEventListener("load", function() { SCORM.init(); });\n' +
      'window.addEventListener("beforeunload", function() { SCORM.finish(); });\n';
  }

  function generateAppJs(coursePlan, brand, images) {
    var sectionsData = JSON.stringify(GeneratorData.buildSectionsData(coursePlan, images));
    var quizData = JSON.stringify(GeneratorData.buildQuizData(coursePlan));

    var courseTitle = escJs(coursePlan.meta.title);
    var masteryScore = coursePlan.meta.masteryScore;

    return '"use strict";\n' +
      'var e = React.createElement;\n' +
      'var SECTIONS = ' + sectionsData + ';\n' +
      'var QUIZ_BANKS = ' + quizData + ';\n' +
      'var MASTERY = ' + masteryScore + ';\n' +
      'var PASS_STATUS = ' + JSON.stringify(coursePlan.meta.passStatus || 'passed') + ';\n' +
      'var FAIL_STATUS = ' + JSON.stringify(coursePlan.meta.failStatus || 'failed') + ';\n' +
      'var COURSE_TITLE = ' + JSON.stringify(courseTitle) + ';\n\n' +
      'function shuffleArray(arr) {\n' +
      '  var a = arr.slice();\n' +
      '  for (var i = a.length - 1; i > 0; i--) {\n' +
      '    var j = Math.floor(Math.random() * (i + 1));\n' +
      '    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;\n' +
      '  }\n  return a;\n}\n\n' +
      generateScrollRevealHook() +
      generateAppComponent() +
      'ReactDOM.createRoot(document.getElementById("root")).render(e(App));\n';
  }

  /**
   * IntersectionObserver hook for scroll-triggered reveal animations.
   */
  function generateScrollRevealHook() {
    return 'function useScrollReveal() {\n' +
      '  var ref = React.useRef(null);\n' +
      '  React.useEffect(function() {\n' +
      '    var el = ref.current;\n' +
      '    if (!el) return;\n' +
      '    var observer = new IntersectionObserver(function(entries) {\n' +
      '      entries.forEach(function(entry) {\n' +
      '        if (entry.isIntersecting) {\n' +
      '          entry.target.classList.add("visible");\n' +
      '          observer.unobserve(entry.target);\n' +
      '        }\n' +
      '      });\n' +
      '    }, { threshold: 0.08 });\n' +
      '    observer.observe(el);\n' +
      '    return function() { observer.disconnect(); };\n' +
      '  }, []);\n' +
      '  return ref;\n' +
      '}\n\n';
  }

  function generateAppComponent() {
    return 'function App() {\n' +
      // --- State ---
      '  var formDataRef = React.useRef({});\n' +
      '  var _f = React.useState(0), formVersion = _f[0], setFormVersion = _f[1];\n' +
      '  var formData = formDataRef.current;\n' +
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
      '  var _openPanels = React.useState({}), openPanels = _openPanels[0], setOpenPanels = _openPanels[1];\n' +
      '  var _bankId = React.useState(null), activeBankId = _bankId[0], setActiveBankId = _bankId[1];\n' +
      '  var _modalLayer = React.useState(null), modalLayer = _modalLayer[0], setModalLayer = _modalLayer[1];\n' +
      '  var _flipped = React.useState({}), flippedCards = _flipped[0], setFlippedCards = _flipped[1];\n' +
      '  var _quizKey = React.useState(0), quizAnimKey = _quizKey[0], setQuizAnimKey = _quizKey[1];\n' +

      // --- Scroll progress tracking ---
      '  React.useEffect(function() {\n' +
      '    var fill = document.querySelector(".progress-fill");\n' +
      '    if (!fill) return;\n' +
      '    function handleScroll() {\n' +
      '      var scrollTop = window.scrollY || document.documentElement.scrollTop;\n' +
      '      var docHeight = document.documentElement.scrollHeight - window.innerHeight;\n' +
      '      var progress = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;\n' +
      '      fill.style.width = progress + "%";\n' +
      '    }\n' +
      '    window.addEventListener("scroll", handleScroll, { passive: true });\n' +
      '    return function() { window.removeEventListener("scroll", handleScroll); };\n' +
      '  }, []);\n\n' +

      // --- Quiz logic ---
      '  function startQuiz(bankId) {\n' +
      '    var bank = QUIZ_BANKS.find(function(b) { return b.id === bankId; });\n' +
      '    if (!bank) return;\n' +
      '    var qs = shuffleArray(bank.questions).slice(0, bank.drawCount);\n' +
      '    setQuizQuestions(qs); setQuizIndex(0); setCorrectCount(0); setTotalQ(qs.length);\n' +
      '    setQuizState("active"); setSelectedChoice(null); setAnswered(false);\n' +
      '    setActiveBankId(bankId); setQuizAnimKey(0);\n' +
      '  }\n' +

      // Start quiz from inline section questions
      '  function startSectionQuiz(questions) {\n' +
      '    var qs = shuffleArray(questions);\n' +
      '    setQuizQuestions(qs); setQuizIndex(0); setCorrectCount(0); setTotalQ(qs.length);\n' +
      '    setQuizState("active"); setSelectedChoice(null); setSelectedChoices([]); setAnswered(false);\n' +
      '    setActiveBankId(null); setQuizAnimKey(0);\n' +
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
      '      setTextAnswer(""); setAnswered(false); setQuizAnimKey(quizAnimKey + 1);\n' +
      '    } else {\n' +
      '      var lastCorrect = 0;\n' +
      '      var q = quizQuestions[quizIndex];\n' +
      '      if (answered && q) {\n' +
      '        if (q.questionType === "pick-many") {\n' +
      '          var allOk = q.choices.every(function(c, i) { var isSel = selectedChoices.indexOf(i) >= 0; return c.isCorrect ? isSel : !isSel; });\n' +
      '          if (allOk) lastCorrect = 1;\n' +
      '        } else if (q.choices[selectedChoice] && q.choices[selectedChoice].isCorrect) { lastCorrect = 1; }\n' +
      '      }\n' +
      '      var finalScore = Math.round((correctCount + lastCorrect) / totalQ * 100);\n' +
      '      setScore(finalScore); setQuizState("complete");\n' +
      '      SCORM.complete(finalScore, MASTERY);\n' +
      '      var resultsEl = document.querySelector(".section-results");\n' +
      '      if (resultsEl) setTimeout(function() { resultsEl.scrollIntoView({ behavior: "smooth" }); }, 100);\n' +
      '    }\n' +
      '  }\n\n' +

      '  function handleFormChange(field, value) {\n' +
      '    formDataRef.current[field] = value;\n' +
      '  }\n\n' +

      // --- Accordion toggle ---
      '  function togglePanel(slideId, idx) {\n' +
      '    var key = slideId + "_" + idx;\n' +
      '    var updated = Object.assign({}, openPanels);\n' +
      '    updated[key] = !updated[key];\n' +
      '    setOpenPanels(updated);\n' +
      '  }\n' +
      '  function isPanelOpen(slideId, idx) {\n' +
      '    return !!openPanels[slideId + "_" + idx];\n' +
      '  }\n\n' +

      // --- Flip card toggle ---
      '  function toggleFlip(slideId, idx) {\n' +
      '    var key = slideId + "_" + idx;\n' +
      '    var updated = Object.assign({}, flippedCards);\n' +
      '    updated[key] = !updated[key];\n' +
      '    setFlippedCards(updated);\n' +
      '  }\n' +
      '  function isFlipped(slideId, idx) {\n' +
      '    return !!flippedCards[slideId + "_" + idx];\n' +
      '  }\n\n' +

      // --- Check if title is auto-generated ---
      '  function isAutoTitle(text) {\n' +
      '    if (!text) return true;\n' +
      '    var t = text.trim();\n' +
      '    var tl = t.toLowerCase();\n' +
      '    if (/^\\d+$/.test(tl)) return true;\n' +
      '    if (/^section\\s*\\d+\\s*(q\\d+|quiz|intro)?\\s*$/i.test(tl)) return true;\n' +
      '    if (/^(drag\\s*and\\s*drop|match\\s*the)\\s*\\d*$/i.test(tl)) return true;\n' +
      '    if (/^table\\s*\\d/i.test(tl)) return true;\n' +
      '    if (/^[A-Z\\s\\/\\-]{4,}$/.test(t) && t === t.toUpperCase() && t.length < 30) return true;\n' +
      '    if (/^(end\\s*course|mid.?section)\\s*(quiz|test)?\\s*$/i.test(tl)) return true;\n' +
      '    if (/^(charging|chargin)\\s*terms?\\s*(tech)?$/i.test(tl)) return true;\n' +
      '    var labels = ["pick one","pick many","pick all","true/false","true false",\n' +
      '      "text entry","matching","sequence","fill in","freeform","graded question",\n' +
      '      "survey question","multiple choice","untitled slide","glossary info"];\n' +
      '    return labels.some(function(l) { return tl === l || tl.match(new RegExp("^" + l + "\\\\s*\\\\d*$")); });\n' +
      '  }\n' +
      // Helper: check if slide title is redundant with section title
      '  function isTitleRedundant(slideTitle, sectionTitle) {\n' +
      '    if (!slideTitle || !sectionTitle) return false;\n' +
      '    var sl = slideTitle.trim().toLowerCase();\n' +
      '    var se = sectionTitle.trim().toLowerCase().replace(/\\s*\\(part\\s*\\d+\\)\\s*$/, "");\n' +
      '    return sl === se || se.indexOf(sl) === 0 || sl.indexOf(se) === 0;\n' +
      '  }\n\n' +

      // --- Check if layers qualify for flip cards ---
      '  function shouldUseFlipCards(slide) {\n' +
      '    if (!slide.layers || slide.layers.length < 3) return false;\n' +
      '    var allShort = slide.layers.every(function(l) {\n' +
      '      var totalText = (l.texts || []).join(" ");\n' +
      '      return totalText.length < 150;\n' +
      '    });\n' +
      '    return allShort;\n' +
      '  }\n\n' +

      // --- Get accordion trigger label ---
      '  function getAccordionLabel(layer) {\n' +
      '    var name = layer.name || "";\n' +
      '    if (/^layer\\s+\\d+$/i.test(name.trim()) && layer.texts && layer.texts.length > 0) {\n' +
      '      var firstText = layer.texts[0];\n' +
      '      if (firstText.length <= 80) return firstText;\n' +
      '      return firstText.substring(0, 77).replace(/\\s+\\S*$/, "") + "...";\n' +
      '    }\n' +
      '    return name;\n' +
      '  }\n\n' +

      generateRenderFunctions() +

      // --- Main render ---
      '  return e("div", null,\n' +
      '    e("div", { className: "progress-bar" }, e("div", { className: "progress-fill", style: { width: "0%" } })),\n' +
      '    e("div", { className: "course-scroll" },\n' +
      '      SECTIONS.map(function(section, si) {\n' +
      '        return renderSection(section, si);\n' +
      '      })\n' +
      '    ),\n' +
      // Quiz overlay when active
      '    quizState === "active" && quizQuestions.length > 0 ? e("div", { className: "quiz-section", style: {\n' +
      '      position: "fixed", inset: 0, zIndex: 900, background: "var(--bg)", overflowY: "auto"\n' +
      '    } }, renderQuizSlide()) : null,\n' +
      // Modal overlay
      '    modalLayer !== null ? renderModalOverlay() : null\n' +
      '  );\n' +
      '}\n\n';
  }

  function generateRenderFunctions() {
    return '' +
      // --- ScrollReveal wrapper with stagger delay ---
      '  function RevealBlock(props) {\n' +
      '    var ref = useScrollReveal();\n' +
      '    var delay = props.delay || 0;\n' +
      '    var style = props.style ? Object.assign({}, props.style) : {};\n' +
      '    if (delay > 0) { style.transitionDelay = delay + "ms"; }\n' +
      '    return e("div", { ref: ref, className: "scroll-reveal " + (props.className || ""), style: style }, props.children);\n' +
      '  }\n\n' +

      // --- Section renderer ---
      '  function renderSection(section, sectionIndex) {\n' +
      // Results sections: only show after quiz complete
      '    if (section.type === "results") {\n' +
      '      if (quizState !== "complete") return null;\n' +
      '      var resultsSections = SECTIONS.filter(function(s) { return s.type === "results"; });\n' +
      '      if (resultsSections.length > 1 && activeBankId) {\n' +
      '        var thisSlideId = section.slides[0] ? section.slides[0].id : "";\n' +
      '        var bankExitsHere = QUIZ_BANKS.some(function(qb) {\n' +
      '          return qb.group === thisSlideId && qb.id === activeBankId;\n' +
      '        });\n' +
      '        if (!bankExitsHere) return null;\n' +
      '      }\n' +
      '    }\n' +
      '    var sectionClass = "section";\n' +
      '    if (section.type === "hero") sectionClass = "section section-hero";\n' +
      '    else if (section.type === "results") sectionClass = "section section-results";\n' +
      // Section title for non-hero, non-results sections
      '    var showSectionTitle = section.type !== "hero" && section.type !== "results"\n' +
      '      && section.title && !isAutoTitle(section.title);\n' +
      '    return e("div", { className: sectionClass, key: "s" + sectionIndex, id: "section-" + sectionIndex },\n' +
      '      e("div", { className: "section-inner" },\n' +
      '        showSectionTitle ? e(RevealBlock, { className: "" },\n' +
      '          e("h2", { className: "section-title" }, section.title)) : null,\n' +
      // Assessment sections: render one unified "Start Assessment" card
      '        section.type === "assessment" ? renderAssessmentSection(section, sectionIndex) :\n' +
      '        section.type === "glossary" && section.glossaryEntries ? renderGlossarySection(section) :\n' +
      '        section.slides.map(function(slide, slideIdx) {\n' +
      '          return renderSlide(slide, sectionIndex, slideIdx, section);\n' +
      '        })\n' +
      '      )\n' +
      '    );\n' +
      '  }\n\n' +

      // --- Glossary section renderer ---
      '  function renderGlossarySection(section) {\n' +
      '    return e(RevealBlock, { className: "" },\n' +
      '      e("div", { className: "glossary-grid" },\n' +
      '        section.glossaryEntries.map(function(entry, i) {\n' +
      '          return e(RevealBlock, { key: i, delay: i * 50, className: "" },\n' +
      '            e("div", { className: "glossary-card" },\n' +
      '              e("dt", null, entry.term),\n' +
      '              e("dd", null, entry.definition)\n' +
      '            )\n' +
      '          );\n' +
      '        })\n' +
      '      )\n' +
      '    );\n' +
      '  }\n\n' +

      // --- Assessment section renderer ---
      '  function renderAssessmentSection(section, sectionIndex) {\n' +
      // Collect all questions
      '    var questions = section.sectionQuizQuestions || [];\n' +
      '    if (questions.length === 0) {\n' +
      '      section.slides.forEach(function(slide) {\n' +
      '        if (slide.quiz) questions.push(slide.quiz);\n' +
      '      });\n' +
      '    }\n' +
      // Check for matching quiz bank
      '    var matchingBank = null;\n' +
      '    if (QUIZ_BANKS.length > 0) {\n' +
      '      QUIZ_BANKS.forEach(function(bank) {\n' +
      '        section.slides.forEach(function(slide) {\n' +
      '          if (slide.type === "quiz" && !matchingBank) matchingBank = bank;\n' +
      '        });\n' +
      '      });\n' +
      '    }\n' +
      '    var assessmentTitle = section.title || "Assessment";\n' +
      '    var questionCount = matchingBank ? matchingBank.drawCount : questions.length;\n' +
      '    return e(RevealBlock, { className: "content-block", key: "assess-" + sectionIndex },\n' +
      '      e("div", { className: "assessment-card" },\n' +
      '        e("span", { className: "assessment-icon" }, "\\uD83D\\uDCDD"),\n' +
      '        e("h2", null, assessmentTitle),\n' +
      '        e("p", null, questionCount > 0 ? questionCount + " question" + (questionCount !== 1 ? "s" : "") + " to test your knowledge" : "Test your knowledge"),\n' +
      '        e("div", { className: "actions" },\n' +
      '          e("button", { className: "btn btn-primary", onClick: function() {\n' +
      '            if (matchingBank) { startQuiz(matchingBank.id); }\n' +
      '            else if (questions.length > 0) { startSectionQuiz(questions); }\n' +
      '          } }, "Begin Assessment")\n' +
      '        )\n' +
      '      )\n' +
      '    );\n' +
      '  }\n\n' +

      // --- Slide renderer ---
      '  function renderSlide(slide, si, idx, section) {\n' +
      '    var key = "sl_" + si + "_" + idx;\n' +
      '    var delay = idx * 100;\n' +
      '    switch (slide.presentation) {\n' +
      '      case "hero": return renderHeroSlide(slide, key);\n' +
      '      case "results": return renderResultsSlide(slide, key);\n' +
      '      case "branching": return renderBranchingSlide(slide, key, si, section);\n' +
      '      case "form": return renderFormSlide(slide, key, si, section);\n' +
      '      case "quiz": return null;\n' +
      '      case "media-feature": return renderMediaSlide(slide, key, section, delay);\n' +
      '      case "interactive": return renderInteractiveSlide(slide, key, si, section, delay);\n' +
      '      case "narrative": return renderNarrativeSlide(slide, key, section, delay);\n' +
      '      default: return renderNarrativeSlide(slide, key, section, delay);\n' +
      '    }\n  }\n\n' +

      // --- Hero slide ---
      '  function renderHeroSlide(slide, key) {\n' +
      '    return e("div", { key: key },\n' +
      '      e("h1", null, slide.title || COURSE_TITLE),\n' +
      '      slide.subtitle ? e("p", { className: "subtitle" }, slide.subtitle) : null,\n' +
      '      slide.texts && slide.texts.length > 0 && slide.texts[0] !== slide.title ? e("p", { className: "subtitle" }, slide.texts[0]) : null,\n' +
      '      e("div", { className: "scroll-indicator" },\n' +
      '        e("span", null, "Scroll to begin"),\n' +
      '        e("span", { className: "scroll-arrow" }, "\\u2193")\n' +
      '      )\n' +
      '    );\n  }\n\n' +

      // --- Narrative content slide ---
      '  function renderNarrativeSlide(slide, key, section, delay) {\n' +
      '    var blockProps = { key: key, className: "content-block", delay: delay || 0 };\n' +
      '    if (slide.backgroundImage) {\n' +
      '      blockProps.className = "content-block has-bg-image";\n' +
      '      blockProps.style = { backgroundImage: "url(" + slide.backgroundImage + ")", backgroundSize: "cover", backgroundPosition: "center" };\n' +
      '    }\n' +
      '    var showTitle = slide.title && slide.type !== "title"\n' +
      '      && !isAutoTitle(slide.title)\n' +
      '      && (!section || !isTitleRedundant(slide.title, section.title));\n' +
      // Check for split layout
      '    var isSplit = slide.layout === "split" && slide.image && !slide.backgroundImage;\n' +
      '    var isSteps = slide.layout === "steps" && slide.texts && slide.texts.length >= 2;\n' +
      '    var isReverse = delay ? (Math.floor(delay / 100) % 2 === 1) : false;\n' +
      '    if (isSplit) {\n' +
      '      return e(RevealBlock, blockProps,\n' +
      '        slide.backgroundImage ? e("div", { className: "bg-overlay" }) : null,\n' +
      '        showTitle ? e("h2", null, slide.title) : null,\n' +
      '        slide.headings ? slide.headings.map(function(h, i) { return e("h3", { key: "h" + i }, h); }) : null,\n' +
      '        slide.callouts ? slide.callouts.map(function(c, i) { return e("div", { key: "c" + i, className: "callout" }, c); }) : null,\n' +
      '        e("div", { className: "split-layout" + (isReverse ? " split-layout--reverse" : "") },\n' +
      '          e("div", { className: "split-text" },\n' +
      '            slide.texts ? slide.texts.map(function(t, i) { return e("p", { key: "t" + i }, t); }) : null\n' +
      '          ),\n' +
      '          e("div", { className: "split-media" },\n' +
      '            e("img", { src: slide.image, alt: slide.title || "" })\n' +
      '          )\n' +
      '        ),\n' +
      '        slide.audio ? e("div", { className: "audio-container" }, e("audio", { controls: true, preload: "metadata", src: slide.audio.src })) : null,\n' +
      '        renderLayers(slide)\n' +
      '      );\n' +
      '    }\n' +
      // Numbered steps layout
      '    if (isSteps) {\n' +
      '      return e(RevealBlock, blockProps,\n' +
      '        showTitle ? e("h2", null, slide.title) : null,\n' +
      '        slide.headings ? slide.headings.map(function(h, i) { return e("h3", { key: "h" + i }, h); }) : null,\n' +
      '        slide.callouts ? slide.callouts.map(function(c, i) { return e("div", { key: "c" + i, className: "callout" }, c); }) : null,\n' +
      '        e("div", { className: "numbered-steps" },\n' +
      '          slide.texts.map(function(t, i) {\n' +
      '            return e("div", { className: "step-item", key: "step" + i },\n' +
      '              e("div", { className: "step-number" }, String(i + 1)),\n' +
      '              e("p", null, t)\n' +
      '            );\n' +
      '          })\n' +
      '        ),\n' +
      '        slide.image ? e("div", { className: "hero-image" }, e("img", { src: slide.image, alt: slide.title || "" })) : null,\n' +
      '        slide.audio ? e("div", { className: "audio-container" }, e("audio", { controls: true, preload: "metadata", src: slide.audio.src })) : null,\n' +
      '        renderLayers(slide)\n' +
      '      );\n' +
      '    }\n' +
      // Default narrative
      '    return e(RevealBlock, blockProps,\n' +
      '      slide.backgroundImage ? e("div", { className: "bg-overlay" }) : null,\n' +
      '      showTitle ? e("h2", null, slide.title) : null,\n' +
      '      slide.headings ? slide.headings.map(function(h, i) { return e("h3", { key: "h" + i }, h); }) : null,\n' +
      '      slide.callouts ? slide.callouts.map(function(c, i) { return e("div", { key: "c" + i, className: "callout" }, c); }) : null,\n' +
      '      slide.texts ? e("div", { className: "narrative-text" },\n' +
      '        slide.texts.map(function(t, i) { return e("p", { key: "t" + i }, t); })\n' +
      '      ) : null,\n' +
      '      slide.image ? e("div", { className: "hero-image" }, e("img", { src: slide.image, alt: slide.title || "" })) : null,\n' +
      '      slide.video ? e("div", { className: "video-container" }, e("video", { controls: true, preload: "metadata", poster: slide.video.poster, src: slide.video.src })) : null,\n' +
      '      slide.audio ? e("div", { className: "audio-container" }, e("audio", { controls: true, preload: "metadata", src: slide.audio.src })) : null,\n' +
      '      renderLayers(slide)\n' +
      '    );\n  }\n\n' +

      // --- Media feature slide ---
      '  function renderMediaSlide(slide, key, section, delay) {\n' +
      '    var showTitle = slide.title && !isAutoTitle(slide.title)\n' +
      '      && (!section || !isTitleRedundant(slide.title, section.title));\n' +
      '    return e(RevealBlock, { key: key, className: "content-block media-feature", delay: delay || 0 },\n' +
      '      showTitle ? e("h2", null, slide.title) : null,\n' +
      '      slide.video ? e("div", { className: "video-container" }, e("video", { controls: true, preload: "metadata", poster: slide.video.poster, src: slide.video.src })) : null,\n' +
      '      !slide.video && slide.image ? e("div", { className: "hero-image" }, e("img", { src: slide.image, alt: slide.title || "" })) : null,\n' +
      '      slide.texts ? e("div", { className: "narrative-text" },\n' +
      '        slide.texts.map(function(t, i) { return e("p", { key: "t" + i }, t); })\n' +
      '      ) : null,\n' +
      '      slide.audio ? e("div", { className: "audio-container" }, e("audio", { controls: true, preload: "metadata", src: slide.audio.src })) : null\n' +
      '    );\n  }\n\n' +

      // --- Interactive slide (layers) ---
      '  function renderInteractiveSlide(slide, key, sectionIdx, section, delay) {\n' +
      '    var showTitle = slide.title && !isAutoTitle(slide.title)\n' +
      '      && (!section || !isTitleRedundant(slide.title, section.title));\n' +
      '    return e(RevealBlock, { key: key, className: "content-block", delay: delay || 0 },\n' +
      '      showTitle ? e("h2", null, slide.title) : null,\n' +
      '      slide.texts ? e("div", { className: "narrative-text" },\n' +
      '        slide.texts.map(function(t, i) { return e("p", { key: "t" + i }, t); })\n' +
      '      ) : null,\n' +
      '      slide.image ? e("div", { className: "hero-image" }, e("img", { src: slide.image, alt: slide.title || "" })) : null,\n' +
      '      slide.audio ? e("div", { className: "audio-container" }, e("audio", { controls: true, preload: "metadata", src: slide.audio.src })) : null,\n' +
      '      renderLayers(slide)\n' +
      '    );\n  }\n\n' +

      // --- Layer rendering ---
      '  function renderLayers(slide) {\n' +
      '    if (!slide.layers || slide.layers.length === 0) return null;\n' +
      '    var type = slide.interactionType || "accordion";\n' +
      '    if (shouldUseFlipCards(slide)) return renderFlipCards(slide);\n' +
      '    if (type === "bento") return renderBentoGrid(slide);\n' +
      '    if (type === "modal") return renderModalTriggers(slide);\n' +
      '    return renderAccordion(slide);\n' +
      '  }\n\n' +

      // --- Flip cards (for short layer content) ---
      '  function renderFlipCards(slide) {\n' +
      '    return e("div", { className: "flip-cards-grid" },\n' +
      '      slide.layers.map(function(layer, i) {\n' +
      '        var cardFlipped = isFlipped(slide.id, i);\n' +
      '        return e("div", {\n' +
      '          className: "flip-card" + (cardFlipped ? " flipped" : ""),\n' +
      '          key: i,\n' +
      '          onClick: function() { toggleFlip(slide.id, i); }\n' +
      '        },\n' +
      '          e("div", { className: "flip-card-inner" },\n' +
      '            e("div", { className: "flip-card-front" },\n' +
      '              e("h3", null, layer.name || "Card " + (i + 1)),\n' +
      '              e("span", { className: "flip-hint" }, "Tap to flip")\n' +
      '            ),\n' +
      '            e("div", { className: "flip-card-back" },\n' +
      '              layer.texts && layer.texts.map(function(t, j) { return e("p", { key: j }, t); })\n' +
      '            )\n' +
      '          )\n' +
      '        );\n' +
      '      })\n' +
      '    );\n' +
      '  }\n\n' +

      // --- Accordion with chevron icon ---
      '  function renderAccordion(slide) {\n' +
      '    return e("div", { className: "accordion" },\n' +
      '      slide.layers.map(function(layer, i) {\n' +
      '        var isOpen = isPanelOpen(slide.id, i);\n' +
      '        var triggerLabel = getAccordionLabel(layer);\n' +
      '        return e("div", { className: "accordion-item" + (isOpen ? " open" : ""), key: i },\n' +
      '          e("button", { className: "accordion-trigger", onClick: function() { togglePanel(slide.id, i); } },\n' +
      '            e("span", null, triggerLabel),\n' +
      '            e("span", { className: "accordion-icon" }, "\\u203A")\n' +
      '          ),\n' +
      // Panel always in DOM
      '          e("div", { className: "accordion-panel" },\n' +
      '            e("div", { className: "accordion-panel-inner" },\n' +
      '              layer.image ? e("div", { className: "hero-image" }, e("img", { src: layer.image, alt: layer.name })) : null,\n' +
      '              layer.texts && layer.texts.filter(function(t, j) {\n' +
      '                if (j !== 0) return true;\n' +
      '                var compareLen = Math.min(t.length, triggerLabel.length, 60);\n' +
      '                if (compareLen < 10) return true;\n' +
      '                return t.substring(0, compareLen).toLowerCase() !== triggerLabel.substring(0, compareLen).toLowerCase().replace(/\\.\\.\\.$/,"");\n' +
      '              }).map(function(t, j) { return e("p", { key: j }, t); }),\n' +
      '              layer.audio && layer.audio.length > 0 ? e("div", { className: "audio-container" },\n' +
      '                e("audio", { controls: true, preload: "metadata", src: layer.audio[0].src })) : null\n' +
      '            )\n' +
      '          )\n' +
      '        );\n' +
      '      })\n    );\n  }\n\n' +

      // --- Modal trigger tiles ---
      '  function renderModalTriggers(slide) {\n' +
      '    return e("div", { className: "modal-triggers" },\n' +
      '      slide.layers.map(function(layer, i) {\n' +
      '        return e("div", { className: "modal-trigger-tile", key: i,\n' +
      '          onClick: function() { setModalLayer({ slide: slide, index: i }); }\n' +
      '        },\n' +
      '          layer.image ? e("div", { className: "tile-thumb" },\n' +
      '            e("img", { src: layer.image, alt: layer.name })) : null,\n' +
      '          e("div", { className: "tile-label" },\n' +
      '            e("span", null, layer.name),\n' +
      '            e("span", { className: "tile-arrow" }, "\\u2192")\n' +
      '          )\n' +
      '        );\n' +
      '      })\n    );\n  }\n\n' +

      // --- Modal overlay ---
      '  function renderModalOverlay() {\n' +
      '    var layer = modalLayer && modalLayer.slide && modalLayer.slide.layers ? modalLayer.slide.layers[modalLayer.index] : null;\n' +
      '    if (!layer) return null;\n' +
      '    return e("div", { className: "modal-overlay", onClick: function() { setModalLayer(null); } },\n' +
      '      e("div", { className: "modal-content", onClick: function(ev) { ev.stopPropagation(); } },\n' +
      '        e("button", { className: "modal-close", onClick: function() { setModalLayer(null); } }, "\\u2715"),\n' +
      '        e("h3", null, layer.name),\n' +
      '        layer.image ? e("div", { className: "modal-image" },\n' +
      '          e("img", { src: layer.image, alt: layer.name })) : null,\n' +
      '        layer.texts && layer.texts.map(function(t, i) { return e("p", { key: i }, t); }),\n' +
      '        layer.audio && layer.audio.length > 0 ? e("div", { className: "audio-container" },\n' +
      '          e("audio", { controls: true, preload: "metadata", src: layer.audio[0].src })) : null\n' +
      '      )\n' +
      '    );\n  }\n\n' +

      // --- Bento grid ---
      '  function renderBentoGrid(slide) {\n' +
      '    return e("div", { className: "bento-grid" },\n' +
      '      slide.layers.map(function(layer, i) {\n' +
      '        var showName = layer.name && layer.texts && layer.texts.length > 0\n' +
      '          ? !layer.texts.some(function(t) { return layer.name.indexOf(t.substring(0, 30)) === 0 || t.indexOf(layer.name.replace("...", "")) === 0; })\n' +
      '          : !!layer.name;\n' +
      '        return e("div", { className: "bento-tile", key: i },\n' +
      '          layer.image ? e("div", { className: "bento-image" },\n' +
      '            e("img", { src: layer.image, alt: layer.name })) : null,\n' +
      '          showName ? e("h3", null, layer.name) : null,\n' +
      '          layer.texts && layer.texts.map(function(t, j) { return e("p", { key: j }, t); })\n' +
      '        );\n' +
      '      })\n    );\n  }\n\n' +

      // --- Form slide ---
      '  function renderFormSlide(slide, key, sectionIdx, section) {\n' +
      '    var showTitle = slide.title && (!section || !isTitleRedundant(slide.title, section.title));\n' +
      '    return e(RevealBlock, { key: key, className: "content-block" },\n' +
      '      e("div", { className: "card" },\n' +
      '        showTitle ? e("h2", null, slide.title) : null,\n' +
      '        slide.instruction ? e("p", { style: { color: "var(--text-muted)" } }, slide.instruction) : null,\n' +
      '        slide.fields && slide.fields.map(function(f, i) {\n' +
      '          return e("div", { className: "form-group", key: i },\n' +
      '            e("label", null, f.label || f.placeholder),\n' +
      '            e("input", { type: f.fieldType || "text", placeholder: f.placeholder,\n' +
      '              defaultValue: "",\n' +
      '              onChange: function(ev) { handleFormChange(f.variableName, ev.target.value); }\n' +
      '            })\n          );\n        }),\n' +
      '        e("div", { className: "actions" },\n' +
      '          e("button", { className: "btn btn-primary", onClick: function() {} }, "Continue")\n' +
      '        )\n' +
      '      )\n    );\n  }\n\n' +

      // --- Branching slide ---
      '  function renderBranchingSlide(slide, key, sectionIdx, section) {\n' +
      '    var userName = "";\n' +
      '    Object.keys(formData).forEach(function(k) {\n' +
      '      if (!userName && formData[k] && /name/i.test(k)) userName = formData[k];\n' +
      '    });\n' +
      '    if (!userName) { var firstVal = Object.values(formData).find(function(v) { return v; }); userName = firstVal || ""; }\n' +
      '    var showTitle = slide.title && (!section || !isTitleRedundant(slide.title, section.title)) && !isAutoTitle(slide.title);\n' +
      '    return e(RevealBlock, { key: key, className: "content-block" },\n' +
      '      e("div", { className: "branch-container" },\n' +
      '        showTitle ? e("h2", null, slide.title) : null,\n' +
      '        slide.greeting ? e("p", { className: "greeting" },\n' +
      '          slide.greeting.replace("%name%", userName)) : null,\n' +
      '        slide.headings ? slide.headings.map(function(h, i) { return e("p", { key: "bh" + i, style: { fontWeight: 600 } }, h); }) : null,\n' +
      '        slide.texts ? slide.texts.map(function(t, i) { return e("p", { key: "bt" + i, style: { maxWidth: "680px", margin: "0 auto 1rem" } }, t); }) : null,\n' +
      '        e("div", { className: "branch-grid" },\n' +
      '          slide.options && slide.options.map(function(opt, i) {\n' +
      '            var isSelected = branch === (opt.value || opt.label);\n' +
      '            return e("div", {\n' +
      '              className: "branch-option" + (isSelected ? " selected" : ""),\n' +
      '              key: i,\n' +
      '              onClick: function() {\n' +
      '                setBranch(opt.value || opt.label);\n' +
      '                if (opt.quizBank) { startQuiz(opt.quizBank); }\n' +
      '                else { setScore(100); setQuizState("complete"); SCORM.complete(100, MASTERY); }\n' +
      '              }\n' +
      '            },\n' +
      '            e("h3", null, opt.label),\n' +
      '            opt.description ? e("p", { style: { fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "0.5rem", marginBottom: 0 } }, opt.description) : null\n' +
      '          );\n' +
      '          })\n        )\n      )\n    );\n  }\n\n' +

      // --- Full quiz slide (overlay) with progress bar ---
      '  function renderQuizSlide() {\n' +
      '    var q = quizQuestions[quizIndex];\n' +
      '    if (!q) return e("div", null, "Loading quiz...");\n' +
      '    var qType = q.questionType || "pick-one";\n' +
      '    var isMulti = qType === "pick-many";\n' +
      '    var isTextEntry = qType === "text-entry";\n' +
      '    var wasCorrect = false;\n' +
      '    if (answered && !isTextEntry) {\n' +
      '      if (isMulti) {\n' +
      '        wasCorrect = q.choices.every(function(c, i) { var isSel = selectedChoices.indexOf(i) >= 0; return c.isCorrect ? isSel : !isSel; });\n' +
      '      } else { wasCorrect = q.choices[selectedChoice] && q.choices[selectedChoice].isCorrect; }\n' +
      '    }\n' +
      '    var progressPct = totalQ > 0 ? Math.round(((quizIndex + (answered ? 1 : 0)) / totalQ) * 100) : 0;\n' +
      '    return e("div", { className: "quiz-container" },\n' +
      // Quiz progress bar
      '      e("div", { className: "quiz-progress-bar" },\n' +
      '        e("div", { className: "quiz-progress-fill", style: { width: progressPct + "%" } })\n' +
      '      ),\n' +
      '      e("p", { className: "quiz-counter" }, "Question " + (quizIndex + 1) + " of " + totalQ),\n' +
      '      e("div", { key: "qk" + quizAnimKey, className: "quiz-slide-enter" },\n' +
      '        e("div", { className: "quiz-question" }, q.questionText),\n' +
      '        isTextEntry ? e("div", { className: "quiz-text-entry" },\n' +
      '          e("input", { type: "text", placeholder: "Type your answer...", value: textAnswer, disabled: answered,\n' +
      '            onChange: function(ev) { setTextAnswer(ev.target.value); },\n' +
      '            onKeyDown: function(ev) { if (ev.key === "Enter" && textAnswer.trim()) submitTextAnswer(); }\n' +
      '          }),\n' +
      '          !answered && textAnswer.trim() ? e("div", { className: "actions" },\n' +
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
      '            );\n          })\n        )\n' +
      '      ),\n' +
      '      isMulti && !answered && selectedChoices.length > 0 ? e("div", { className: "actions" },\n' +
      '        e("button", { className: "btn btn-primary", onClick: submitMultiAnswer }, "Submit Answer")) : null,\n' +
      '      answered ? e("div", { className: "quiz-feedback " + (isTextEntry ? "correct" : (wasCorrect ? "correct" : "incorrect")) },\n' +
      '        isTextEntry ? "Answer submitted" : (wasCorrect ? (q.correctFeedback || "Correct!") : (q.incorrectFeedback || "Incorrect."))) : null,\n' +
      '      answered ? e("div", { className: "actions" },\n' +
      '        e("button", { className: "btn btn-primary", onClick: nextQuestion },\n' +
      '          quizIndex < quizQuestions.length - 1 ? "Next Question" : "See Results")) : null\n' +
      '    );\n  }\n\n' +

      // --- Results slide with animated score ring and celebration ---
      '  function renderResultsSlide(slide, key) {\n' +
      '    var displayScore = score !== null ? score : 0;\n' +
      '    var passed = displayScore >= MASTERY;\n' +
      '    var ringStyle = {\n' +
      '      background: "conic-gradient(rgba(255,255,255,0.9) " + (displayScore * 3.6) + "deg, rgba(255,255,255,0.15) " + (displayScore * 3.6) + "deg)"\n' +
      '    };\n' +
      '    var celebrationDots = [];\n' +
      '    if (passed) {\n' +
      '      for (var i = 0; i < 12; i++) {\n' +
      '        var colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];\n' +
      '        celebrationDots.push(\n' +
      '          e("div", {\n' +
      '            key: "dot" + i,\n' +
      '            className: "celebration-dot",\n' +
      '            style: {\n' +
      '              left: (10 + Math.random() * 80) + "%",\n' +
      '              top: (40 + Math.random() * 40) + "%",\n' +
      '              background: colors[i % colors.length],\n' +
      '              animationDelay: (i * 0.15) + "s",\n' +
      '              width: (6 + Math.random() * 6) + "px",\n' +
      '              height: (6 + Math.random() * 6) + "px"\n' +
      '            }\n' +
      '          })\n' +
      '        );\n' +
      '      }\n' +
      '    }\n' +
      '    return e("div", { key: key },\n' +
      '      passed ? e("div", { className: "celebration-dots" }, celebrationDots) : null,\n' +
      '      e("h2", null, slide.title || "Your Results"),\n' +
      '      e("div", { className: "score-circle" },\n' +
      '        e("div", { className: "score-ring", style: ringStyle }),\n' +
      '        e("div", { className: "score-value" }, displayScore + "%"),\n' +
      '        e("div", { className: "score-label" }, passed ? "Passed" : "Not passed")\n' +
      '      ),\n' +
      '      e("p", { className: "results-msg" },\n' +
      '        passed ? "Congratulations! You have successfully completed this course."\n' +
      '          : "You need " + MASTERY + "% to pass. Please try again."),\n' +
      '      !passed ? e("button", {\n' +
      '        className: "btn btn-restart",\n' +
      '        onClick: function() { window.scrollTo({ top: 0, behavior: "smooth" }); setQuizState(null); setScore(null); }\n' +
      '      }, "Restart Course") : null\n' +
      '    );\n  }\n\n';
  }

  /**
   * Main entry: generate the complete output HTML document.
   */
  function generateHtml(coursePlan, brand, images) {
    var css = GeneratorCSS.generateCss(brand);
    var appJs = generateAppJs(coursePlan, brand, images);
    var scormJs = generateScormAdapterJs();
    var fontLink = brand.typography.fontImportUrl
      ? '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
        '  <link href="' + escHtml(brand.typography.fontImportUrl) + '" rel="stylesheet">'
      : '';

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '  <title>' + escHtml(coursePlan.meta.title) + '</title>\n' +
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
