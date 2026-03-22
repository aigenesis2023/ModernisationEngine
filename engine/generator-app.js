/**
 * React App Generator + SCORM Adapter
 * Produces a deep-scroll course experience with section-based layout.
 * All content flows as a continuous scroll with scroll-triggered animations,
 * interactive components (accordion, modal, bento), and inline quizzes.
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
      '      setValue("cmi.core.lesson_status", score >= (passingScore || 80) ? "passed" : "failed");\n' +
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
    var logoUrl = brand.logo && brand.logo.url ? escJs(brand.logo.url) : '';
    var logoAlt = brand.logo && brand.logo.alt ? escJs(brand.logo.alt) : '';

    return '"use strict";\n' +
      'var e = React.createElement;\n' +
      'var SECTIONS = ' + sectionsData + ';\n' +
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
      '    }, { threshold: 0.05 });\n' +
      '    observer.observe(el);\n' +
      '    return function() { observer.disconnect(); };\n' +
      '  }, []);\n' +
      '  return ref;\n' +
      '}\n\n';
  }

  function generateAppComponent() {
    return 'function App() {\n' +
      // --- State ---
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
      '  var _openPanels = React.useState({}), openPanels = _openPanels[0], setOpenPanels = _openPanels[1];\n' +
      '  var _modalLayer = React.useState(null), modalLayer = _modalLayer[0], setModalLayer = _modalLayer[1];\n' +
      '  var _progress = React.useState(0), scrollProgress = _progress[0], setScrollProgress = _progress[1];\n\n' +

      // --- Scroll progress tracking ---
      '  React.useEffect(function() {\n' +
      '    function handleScroll() {\n' +
      '      var scrollTop = window.scrollY || document.documentElement.scrollTop;\n' +
      '      var docHeight = document.documentElement.scrollHeight - window.innerHeight;\n' +
      '      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;\n' +
      '      setScrollProgress(Math.min(100, Math.round(progress)));\n' +
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
      '      // Scroll to results section\n' +
      '      var resultsEl = document.querySelector(".section-results");\n' +
      '      if (resultsEl) resultsEl.scrollIntoView({ behavior: "smooth" });\n' +
      '    }\n' +
      '  }\n' +
      '  function handleFormChange(field, value) {\n' +
      '    var updated = Object.assign({}, formData); updated[field] = value; setFormData(updated);\n' +
      '  }\n\n' +

      // --- Accordion toggle (per-slide keyed) ---
      '  function togglePanel(slideId, idx) {\n' +
      '    var key = slideId + "_" + idx;\n' +
      '    var updated = Object.assign({}, openPanels);\n' +
      '    updated[key] = !updated[key];\n' +
      '    setOpenPanels(updated);\n' +
      '  }\n' +
      '  function isPanelOpen(slideId, idx) {\n' +
      '    return !!openPanels[slideId + "_" + idx];\n' +
      '  }\n\n' +

      generateRenderFunctions() +

      // --- Main render ---
      '  return e("div", null,\n' +
      '    e("div", { className: "progress-bar" }, e("div", { className: "progress-fill", style: { width: scrollProgress + "%" } })),\n' +
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
      // --- ScrollReveal wrapper ---
      '  function RevealBlock(props) {\n' +
      '    var ref = useScrollReveal();\n' +
      '    return e("div", { ref: ref, className: "scroll-reveal " + (props.className || "") }, props.children);\n' +
      '  }\n\n' +

      // --- Section renderer ---
      '  function renderSection(section, sectionIndex) {\n' +
      '    // Hide results sections until quiz is complete\n' +
      '    if (section.type === "results") {\n' +
      '      if (quizState !== "complete") return null;\n' +
      '      // If multiple results sections exist, only show the one whose slide ID\n' +
      '      // matches the quiz bank group (exit target) the user took\n' +
      '      var resultsSections = SECTIONS.filter(function(s) { return s.type === "results"; });\n' +
      '      if (resultsSections.length > 1 && branch) {\n' +
      '        var matchesBank = QUIZ_BANKS.some(function(qb) {\n' +
      '          return qb.group === section.slides[0].id;\n' +
      '        });\n' +
      '        if (!matchesBank) {\n' +
      '          var takenBank = QUIZ_BANKS.find(function(qb) {\n' +
      '            return qb.group === section.slides[0].id;\n' +
      '          });\n' +
      '          if (!takenBank) return null;\n' +
      '        }\n' +
      '      }\n' +
      '    }\n' +
      '    var sectionClass = "section";\n' +
      '    if (section.type === "hero") sectionClass = "section section-hero";\n' +
      '    else if (section.type === "results") sectionClass = "section section-results";\n' +
      '    return e("div", { className: sectionClass, key: "s" + sectionIndex, id: "section-" + sectionIndex },\n' +
      '      e("div", { className: "section-inner" },\n' +
      '        section.slides.map(function(slide, slideIdx) {\n' +
      '          return renderSlide(slide, sectionIndex, slideIdx);\n' +
      '        })\n' +
      '      )\n' +
      '    );\n' +
      '  }\n\n' +

      // --- Slide renderer (dispatches by presentation type) ---
      '  function renderSlide(slide, si, idx) {\n' +
      '    var key = "sl_" + si + "_" + idx;\n' +
      '    switch (slide.presentation) {\n' +
      '      case "hero": return renderHeroSlide(slide, key);\n' +
      '      case "results": return renderResultsSlide(slide, key);\n' +
      '      case "branching": return renderBranchingSlide(slide, key);\n' +
      '      case "form": return renderFormSlide(slide, key);\n' +
      '      case "quiz": return renderInlineQuiz(slide, key);\n' +
      '      case "media-feature": return renderMediaSlide(slide, key);\n' +
      '      case "interactive": return renderInteractiveSlide(slide, key);\n' +
      '      case "narrative": return renderNarrativeSlide(slide, key);\n' +
      '      default: return renderNarrativeSlide(slide, key);\n' +
      '    }\n  }\n\n' +

      // --- Hero slide ---
      '  function renderHeroSlide(slide, key) {\n' +
      '    var style = slide.image ? {\n' +
      '      backgroundImage: "url(" + slide.image + ")",\n' +
      '      backgroundSize: "cover", backgroundPosition: "center"\n' +
      '    } : {};\n' +
      '    var cls = slide.image ? "hero-bg" : "";\n' +
      '    return e("div", { key: key, className: cls, style: style },\n' +
      '      LOGO_URL ? e("img", { src: LOGO_URL, alt: LOGO_ALT, className: "logo" }) : null,\n' +
      '      e("h1", null, slide.title || COURSE_TITLE),\n' +
      '      slide.subtitle ? e("p", { className: "subtitle" }, slide.subtitle) : null,\n' +
      '      slide.texts && slide.texts.length > 0 && slide.texts[0] !== slide.title ? e("p", { className: "subtitle" }, slide.texts[0]) : null,\n' +
      '      e("div", { className: "scroll-indicator" }, e("span", null, "Scroll to begin"), e("span", null, "\\u2193"))\n' +
      '    );\n  }\n\n' +

      // --- Narrative content slide ---
      '  function renderNarrativeSlide(slide, key) {\n' +
      '    return e(RevealBlock, { key: key, className: "content-block" },\n' +
      '      slide.title && slide.type !== "title" ? e("h2", null, slide.title) : null,\n' +
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
      '  function renderMediaSlide(slide, key) {\n' +
      '    return e(RevealBlock, { key: key, className: "content-block media-feature" },\n' +
      '      slide.title ? e("h2", null, slide.title) : null,\n' +
      '      slide.video ? e("div", { className: "video-container" }, e("video", { controls: true, preload: "metadata", poster: slide.video.poster, src: slide.video.src })) : null,\n' +
      '      !slide.video && slide.image ? e("div", { className: "hero-image" }, e("img", { src: slide.image, alt: slide.title || "" })) : null,\n' +
      '      slide.texts ? e("div", { className: "narrative-text" },\n' +
      '        slide.texts.map(function(t, i) { return e("p", { key: "t" + i }, t); })\n' +
      '      ) : null,\n' +
      '      slide.audio ? e("div", { className: "audio-container" }, e("audio", { controls: true, preload: "metadata", src: slide.audio.src })) : null\n' +
      '    );\n  }\n\n' +

      // --- Interactive slide (layers) ---
      '  function renderInteractiveSlide(slide, key) {\n' +
      '    return e(RevealBlock, { key: key, className: "content-block" },\n' +
      '      slide.title ? e("h2", null, slide.title) : null,\n' +
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
      '    if (type === "bento") return renderBentoGrid(slide);\n' +
      '    if (type === "modal") return renderModalTriggers(slide);\n' +
      '    return renderAccordion(slide);\n' +
      '  }\n\n' +

      // --- Accordion ---
      '  function renderAccordion(slide) {\n' +
      '    return e("div", { className: "accordion" },\n' +
      '      slide.layers.map(function(layer, i) {\n' +
      '        var isOpen = isPanelOpen(slide.id, i);\n' +
      '        return e("div", { className: "accordion-item" + (isOpen ? " open" : ""), key: i },\n' +
      '          e("button", { className: "accordion-trigger", onClick: function() { togglePanel(slide.id, i); } },\n' +
      '            e("span", null, layer.name),\n' +
      '            e("span", { className: "accordion-icon" }, isOpen ? "\\u2212" : "\\u002B")\n' +
      '          ),\n' +
      '          isOpen ? e("div", { className: "accordion-panel" },\n' +
      '            layer.image ? e("div", { className: "hero-image" }, e("img", { src: layer.image, alt: layer.name })) : null,\n' +
      '            layer.texts && layer.texts.map(function(t, j) { return e("p", { key: j }, t); }),\n' +
      '            layer.audio && layer.audio.length > 0 ? e("div", { className: "audio-container" },\n' +
      '              e("audio", { controls: true, preload: "metadata", src: layer.audio[0].src })) : null\n' +
      '          ) : null\n' +
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
      '  function renderFormSlide(slide, key) {\n' +
      '    return e(RevealBlock, { key: key, className: "content-block" },\n' +
      '      e("div", { className: "card" },\n' +
      '        e("h2", null, slide.title),\n' +
      '        slide.instruction ? e("p", null, slide.instruction) : null,\n' +
      '        slide.fields && slide.fields.map(function(f, i) {\n' +
      '          return e("div", { className: "form-group", key: i },\n' +
      '            e("label", null, f.label || f.placeholder),\n' +
      '            e("input", { type: f.fieldType || "text", placeholder: f.placeholder,\n' +
      '              value: formData[f.variableName] || "",\n' +
      '              onChange: function(ev) { handleFormChange(f.variableName, ev.target.value); }\n' +
      '            })\n          );\n        })\n' +
      '      )\n    );\n  }\n\n' +

      // --- Branching slide ---
      '  function renderBranchingSlide(slide, key) {\n' +
      '    // Find user name from any form field that looks like a name field\n' +
      '    var userName = "";\n' +
      '    Object.keys(formData).forEach(function(k) {\n' +
      '      if (!userName && formData[k] && /name/i.test(k)) userName = formData[k];\n' +
      '    });\n' +
      '    if (!userName) { var firstVal = Object.values(formData).find(function(v) { return v; }); userName = firstVal || ""; }\n' +
      '    return e(RevealBlock, { key: key, className: "content-block" },\n' +
      '      e("div", { className: "branch-container" },\n' +
      '        e("h2", null, slide.title),\n' +
      '        slide.greeting ? e("p", { className: "greeting" },\n' +
      '          slide.greeting.replace("%name%", userName)) : null,\n' +
      '        slide.headings ? slide.headings.map(function(h, i) { return e("p", { key: "bh" + i, style: { fontWeight: 600 } }, h); }) : null,\n' +
      '        slide.texts ? slide.texts.map(function(t, i) { return e("p", { key: "bt" + i, style: { maxWidth: "680px", margin: "0 auto", marginBottom: "var(--spacing)" } }, t); }) : null,\n' +
      '        e("div", { className: "branch-grid" },\n' +
      '          slide.options && slide.options.map(function(opt, i) {\n' +
      '            return e("div", { className: "branch-option", key: i,\n' +
      '              onClick: function() {\n' +
      '                setBranch(opt.value || opt.label);\n' +
      '                if (opt.quizBank) { startQuiz(opt.quizBank); }\n' +
      '                else { setScore(100); setQuizState("complete"); SCORM.complete(100, MASTERY); }\n' +
      '              }\n' +
      '            }, e("h3", null, opt.label));\n' +
      '          })\n        )\n      )\n    );\n  }\n\n' +

      // --- Inline quiz trigger (in scroll) ---
      '  function renderInlineQuiz(slide, key) {\n' +
      '    if (!slide.quiz) return renderNarrativeSlide(slide, key);\n' +
      '    return e(RevealBlock, { key: key, className: "content-block" },\n' +
      '      e("div", { className: "card", style: { textAlign: "center" } },\n' +
      '        e("h2", null, slide.title || "Knowledge Check"),\n' +
      '        e("p", null, "A quiz awaits — test your understanding."),\n' +
      '        e("div", { className: "actions" },\n' +
      '          e("button", { className: "btn btn-primary", onClick: function() {\n' +
      '            var qs = [slide.quiz]; setQuizQuestions(qs); setQuizIndex(0); setCorrectCount(0); setTotalQ(1);\n' +
      '            setQuizState("active"); setSelectedChoice(null); setAnswered(false);\n' +
      '          } }, "Start Quiz")\n' +
      '        )\n' +
      '      )\n    );\n  }\n\n' +

      // --- Full quiz slide (overlay) ---
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
      '    return e("div", { className: "quiz-container" },\n' +
      '      e("p", { className: "quiz-counter" }, "Question " + (quizIndex + 1) + " of " + totalQ),\n' +
      '      e("div", { className: "quiz-question" }, q.questionText),\n' +
      '      isTextEntry ? e("div", { className: "quiz-text-entry" },\n' +
      '        e("input", { type: "text", placeholder: "Type your answer...", value: textAnswer, disabled: answered,\n' +
      '          onChange: function(ev) { setTextAnswer(ev.target.value); },\n' +
      '          onKeyDown: function(ev) { if (ev.key === "Enter" && textAnswer.trim()) submitTextAnswer(); }\n' +
      '        }),\n' +
      '        !answered && textAnswer.trim() ? e("div", { className: "actions" },\n' +
      '          e("button", { className: "btn btn-primary", onClick: submitTextAnswer }, "Submit Answer")) : null\n' +
      '      ) :\n' +
      '      e("div", { className: "quiz-choices" },\n' +
      '        q.choices.map(function(c, i) {\n' +
      '          var cls = "quiz-choice";\n' +
      '          var isSel = isMulti ? selectedChoices.indexOf(i) >= 0 : selectedChoice === i;\n' +
      '          if (isSel) cls += " selected";\n' +
      '          if (answered && c.isCorrect) cls += " correct";\n' +
      '          if (answered && isSel && !c.isCorrect) cls += " incorrect";\n' +
      '          return e("div", { className: cls, key: i, onClick: function() { handleQuizAnswer(i); } },\n' +
      '            e("div", { className: "indicator" + (isMulti ? " checkbox" : "") },\n' +
      '              answered ? (c.isCorrect ? "\\u2713" : (isSel ? "\\u2717" : "")) : (isSel ? (isMulti ? "\\u2713" : "\\u25CF") : "")\n' +
      '            ),\n' +
      '            e("span", null, c.text)\n' +
      '          );\n        })\n      ),\n' +
      '      isMulti && !answered && selectedChoices.length > 0 ? e("div", { className: "actions" },\n' +
      '        e("button", { className: "btn btn-primary", onClick: submitMultiAnswer }, "Submit Answer")) : null,\n' +
      '      answered ? e("div", { className: "quiz-feedback " + (isTextEntry ? "correct" : (wasCorrect ? "correct" : "incorrect")) },\n' +
      '        isTextEntry ? "Answer submitted" : (wasCorrect ? (q.correctFeedback || "Correct!") : (q.incorrectFeedback || "Incorrect."))) : null,\n' +
      '      answered ? e("div", { className: "actions" },\n' +
      '        e("button", { className: "btn btn-primary", onClick: nextQuestion },\n' +
      '          quizIndex < quizQuestions.length - 1 ? "Next Question" : "See Results")) : null\n' +
      '    );\n  }\n\n' +

      // --- Results slide ---
      '  function renderResultsSlide(slide, key) {\n' +
      '    var displayScore = score !== null ? score : 0;\n' +
      '    var passed = displayScore >= MASTERY;\n' +
      '    return e("div", { key: key },\n' +
      '      e("h2", null, slide.title || "Your Results"),\n' +
      '      e("div", { className: "score-circle" },\n' +
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
   * Now takes CoursePlan instead of raw CourseIR.
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
