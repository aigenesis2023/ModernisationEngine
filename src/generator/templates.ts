import type {
  CourseIR, BrandProfile, ImageManifest, SlideIR, SlideElement,
  TextElement, ImageElement, ButtonElement, QuizElement, FormElement,
  QuestionBankIR, QuestionIR,
} from '../ir/types';
import { generateScormAdapterJs } from './scorm-adapter';

// ============================================================
// Template Generator — Produces a complete, brand-dynamic
// single-page React application from CourseIR + BrandProfile.
// Zero build step: React UMD + inline CSS.
// ============================================================

export function generateHtml(
  course: CourseIR,
  brand: BrandProfile,
  images: ImageManifest,
): string {
  const css = generateCss(brand);
  const appJs = generateAppJs(course, brand, images);
  const scormJs = generateScormAdapterJs();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(course.meta.title)}</title>
  ${brand.typography.fontImportUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${escHtml(brand.typography.fontImportUrl)}" rel="stylesheet">` : ''}
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>

  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>

  <script>${scormJs}</script>
  <script>${appJs}</script>
</body>
</html>`;
}

// ---- CSS Generation ----

function generateCss(brand: BrandProfile): string {
  const b = brand.colors;
  const t = brand.typography;
  const s = brand.style;
  const dark = isDarkTheme(brand);
  const border = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const borderLight = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return `
:root {
  --primary: ${b.primary};
  --secondary: ${b.secondary};
  --accent: ${b.accent};
  --bg: ${b.background};
  --surface: ${b.surface};
  --text: ${b.text};
  --text-muted: ${b.textMuted};
  --success: ${b.success};
  --error: ${b.error};
  --warning: ${b.warning};
  --radius: ${s.borderRadius};
  --font-heading: '${t.headingFont}', system-ui, sans-serif;
  --font-body: '${t.bodyFont}', system-ui, sans-serif;
  --spacing: ${s.spacing.unit}px;
  --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  font-size: ${t.baseSize}px;
  line-height: ${t.lineHeight};
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

#root { width: 100vw; height: 100vh; overflow: hidden; }

/* ---- Layout ---- */
.app { width: 100%; height: 100%; display: flex; flex-direction: column; }
.slide-container {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  position: relative; scroll-behavior: smooth;
}
.slide {
  min-height: 100%; padding: calc(var(--spacing) * 6) calc(var(--spacing) * 4);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  animation: slideIn 0.5s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---- Typography ---- */
h1, h2, h3 {
  font-family: var(--font-heading);
  font-weight: ${t.headingWeight};
  line-height: 1.2;
  letter-spacing: -0.02em;
}
h1 { font-size: ${t.headingSizes.h1}px; margin-bottom: calc(var(--spacing) * 3); }
h2 { font-size: ${t.headingSizes.h2}px; margin-bottom: calc(var(--spacing) * 2); }
h3 { font-size: ${t.headingSizes.h3}px; margin-bottom: var(--spacing); }
p { margin-bottom: var(--spacing); max-width: 680px; }

/* ---- Buttons ---- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 4);
  border: none; border-radius: var(--radius);
  font-family: var(--font-body); font-size: ${t.baseSize}px; font-weight: 600;
  cursor: pointer; transition: all var(--transition);
  text-decoration: none; min-width: 140px;
}
.btn:active { transform: scale(0.97); }
${generateButtonCss(brand)}

.btn-secondary {
  background: transparent; color: var(--primary);
  border: 2px solid var(--primary);
}
.btn-secondary:hover { background: var(--primary); color: white; }

.btn-ghost {
  background: transparent; color: var(--text-muted);
  border: 1px solid ${border};
}
.btn-ghost:hover { border-color: var(--primary); color: var(--primary); }

/* ---- Cards ---- */
.card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: calc(var(--spacing) * 3);
  width: 100%; max-width: 760px;
  ${generateCardShadow(brand)}
  transition: all var(--transition);
}

/* ---- Title Slide ---- */
.slide-title {
  background: ${b.gradient || `linear-gradient(135deg, ${b.primary}, ${b.secondary})`};
  color: white; text-align: center;
  padding: 0; justify-content: center; align-items: center;
  position: relative; overflow: hidden;
  background-size: cover; background-position: center;
}
.slide-title::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 30% 70%, rgba(255,255,255,0.1) 0%, transparent 60%);
}
.slide-title .content { position: relative; z-index: 2; max-width: 720px; }
.slide-title h1 { font-size: ${Math.round(t.headingSizes.h1 * 1.3)}px; margin-bottom: calc(var(--spacing) * 2); color: white; }
.slide-title .subtitle { font-size: ${Math.round(t.baseSize * 1.2)}px; opacity: 0.85; margin-bottom: calc(var(--spacing) * 4); }
.slide-title .logo { max-width: 200px; max-height: 60px; margin-bottom: calc(var(--spacing) * 3); }
.slide-title .btn { background: white; color: var(--primary); font-weight: 700; }
.slide-title .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }

/* ---- Content Slide ---- */
.slide-content { background: var(--bg); }
.slide-content .card { margin-bottom: calc(var(--spacing) * 2); }

/* ---- Form Slide ---- */
.form-group { margin-bottom: calc(var(--spacing) * 2); width: 100%; }
.form-group label {
  display: block; font-weight: 600; margin-bottom: calc(var(--spacing) * 0.5);
  color: var(--text);
}
.form-group input, .form-group textarea {
  width: 100%; padding: calc(var(--spacing) * 1.5);
  border: 2px solid ${border}; border-radius: var(--radius);
  font-family: var(--font-body); font-size: ${t.baseSize}px;
  transition: border-color var(--transition);
  background: var(--bg); color: var(--text);
}
.form-group input:focus, .form-group textarea:focus {
  outline: none; border-color: var(--primary);
  box-shadow: 0 0 0 3px ${b.primary}22;
}

/* ---- Quiz Slide ---- */
.quiz-question {
  font-family: var(--font-heading); font-size: ${t.headingSizes.h3}px;
  font-weight: ${t.headingWeight}; margin-bottom: calc(var(--spacing) * 3);
  text-align: center; max-width: 680px;
}
.quiz-choices { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: var(--spacing); }
.quiz-choice {
  display: flex; align-items: center; gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 2.5);
  border: 2px solid ${border}; border-radius: var(--radius);
  cursor: pointer; transition: all var(--transition);
  background: var(--surface); font-size: ${t.baseSize}px;
}
.quiz-choice:hover { border-color: var(--primary); transform: translateX(4px); }
.quiz-choice.selected { border-color: var(--primary); background: ${b.primary}11; }
.quiz-choice.correct { border-color: var(--success); background: ${b.success}11; }
.quiz-choice.incorrect { border-color: var(--error); background: ${b.error}11; }
.quiz-choice .indicator {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid ${border}; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition);
}
.quiz-choice.selected .indicator { border-color: var(--primary); background: var(--primary); }
.quiz-choice.correct .indicator { border-color: var(--success); background: var(--success); }
.quiz-choice.incorrect .indicator { border-color: var(--error); background: var(--error); }
.quiz-feedback {
  margin-top: calc(var(--spacing) * 2); padding: calc(var(--spacing) * 2);
  border-radius: var(--radius); text-align: center; font-weight: 600;
  animation: slideIn 0.3s ease-out;
}
.quiz-feedback.correct { background: ${b.success}15; color: var(--success); }
.quiz-feedback.incorrect { background: ${b.error}15; color: var(--error); }

/* ---- Branching Slide ---- */
.branch-options { display: flex; gap: calc(var(--spacing) * 2); flex-wrap: wrap; justify-content: center; margin-top: calc(var(--spacing) * 3); }
.branch-option {
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 4);
  border: 2px solid ${border}; border-radius: var(--radius);
  cursor: pointer; transition: all var(--transition);
  text-align: center; min-width: 180px;
  background: var(--surface);
  ${generateCardShadow(brand)}
}
.branch-option:hover {
  border-color: var(--primary); transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(0,0,0,0.12);
}
.branch-option h3 { color: var(--primary); }

/* ---- Results Slide ---- */
.slide-results {
  background: ${b.gradient || `linear-gradient(135deg, ${b.primary}, ${b.secondary})`};
  color: white; text-align: center;
}
.score-circle {
  width: 160px; height: 160px; border-radius: 50%;
  border: 6px solid rgba(255,255,255,0.3);
  display: flex; align-items: center; justify-content: center; flex-direction: column;
  margin: calc(var(--spacing) * 3) auto;
  animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.score-circle .score-value { font-size: 48px; font-weight: ${t.headingWeight}; font-family: var(--font-heading); }
.score-circle .score-label { font-size: 14px; opacity: 0.8; }

@keyframes scaleIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* ---- Progress Bar ---- */
.progress-bar {
  height: 4px; background: ${b.primary}22;
  position: sticky; top: 0; z-index: 100;
}
.progress-fill {
  height: 100%; background: var(--primary);
  transition: width 0.4s ease;
}

/* ---- Navigation ---- */
.nav-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 3);
  background: var(--surface); border-top: 1px solid ${borderLight};
  flex-shrink: 0;
}
.nav-bar .slide-counter { color: var(--text-muted); font-size: 14px; }

/* ---- Hero Image ---- */
.hero-image {
  width: 100%; max-width: 760px; border-radius: var(--radius);
  overflow: hidden; margin-bottom: calc(var(--spacing) * 3);
  ${generateCardShadow(brand)}
}
.hero-image img { width: 100%; height: auto; display: block; }

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .slide { padding: calc(var(--spacing) * 3) calc(var(--spacing) * 2); }
  h1 { font-size: ${Math.round(t.headingSizes.h1 * 0.7)}px; }
  h2 { font-size: ${Math.round(t.headingSizes.h2 * 0.75)}px; }
  .slide-title h1 { font-size: ${Math.round(t.headingSizes.h1 * 0.85)}px; }
  .score-circle { width: 120px; height: 120px; }
  .score-circle .score-value { font-size: 36px; }
  .branch-options { flex-direction: column; align-items: center; }
  .branch-option { width: 100%; max-width: 320px; }
}
`;
}

function generateButtonCss(brand: BrandProfile): string {
  const b = brand.colors;
  switch (brand.style.buttonStyle) {
    case 'gradient':
      return `.btn-primary {
  background: ${b.gradient || `linear-gradient(135deg, ${b.primary}, ${b.secondary})`};
  color: white; border: none;
}
.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 15px ${b.primary}44; }`;
    case 'outline':
      return `.btn-primary {
  background: transparent; color: var(--primary);
  border: 2px solid var(--primary);
}
.btn-primary:hover { background: var(--primary); color: white; }`;
    default:
      return `.btn-primary {
  background: var(--primary); color: white; border: none;
}
.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 15px ${b.primary}44; }`;
  }
}

function generateCardShadow(brand: BrandProfile): string {
  const isDark = isDarkTheme(brand);
  switch (brand.style.cardStyle) {
    case 'elevated':
      return isDark
        ? 'box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
        : 'box-shadow: 0 4px 20px rgba(0,0,0,0.08);';
    case 'glass':
      return isDark
        ? 'backdrop-filter: blur(10px); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 20px rgba(0,0,0,0.2);'
        : 'backdrop-filter: blur(10px); background: rgba(255,255,255,0.7); box-shadow: 0 4px 20px rgba(0,0,0,0.06);';
    case 'outlined':
      return isDark
        ? 'border: 1px solid rgba(255,255,255,0.12);'
        : 'border: 1px solid ${border};';
    default:
      return '';
  }
}

function isDarkTheme(brand: BrandProfile): boolean {
  const bg = brand.colors.background;
  if (!bg.startsWith('#') || bg.length < 7) return false;
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  return (r + g + b) / 3 < 80;
}

// ---- React App JS Generation ----

function generateAppJs(
  course: CourseIR,
  brand: BrandProfile,
  images: ImageManifest,
): string {
  const slidesData = JSON.stringify(buildSlidesData(course, images));
  const quizData = JSON.stringify(buildQuizData(course));
  // Use the title slide's extracted text if the meta title looks like a project name
  const titleSlide = course.slides.find(s => s.type === 'title');
  const titleTexts = titleSlide?.elements
    .filter((el): el is TextElement => el.type === 'text' && el.role !== 'unknown')
    .map(el => el.content.trim())
    .filter(t => t.length > 5) || [];
  const bestTitle = titleTexts.find(t =>
    !t.toLowerCase().includes('test') && !t.toLowerCase().includes('scene')
  ) || course.meta.title;
  const courseTitle = escJs(bestTitle);
  const masteryScore = course.meta.masteryScore;
  const logoUrl = brand.logo?.url ? escJs(brand.logo.url) : '';
  const logoAlt = brand.logo?.alt ? escJs(brand.logo.alt) : '';

  return `
'use strict';
var e = React.createElement;

var SLIDES = ${slidesData};
var QUIZ_BANKS = ${quizData};
var MASTERY = ${masteryScore};
var COURSE_TITLE = ${JSON.stringify(courseTitle)};
var LOGO_URL = ${JSON.stringify(logoUrl)};
var LOGO_ALT = ${JSON.stringify(logoAlt)};

// ---- Utility ----
function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// ---- App Component ----
function App() {
  var _s = React.useState(0), currentSlide = _s[0], setCurrentSlide = _s[1];
  var _f = React.useState({}), formData = _f[0], setFormData = _f[1];
  var _q = React.useState(null), quizState = _q[0], setQuizState = _q[1];
  var _sc = React.useState(null), score = _sc[0], setScore = _sc[1];
  var _sel = React.useState(null), selectedChoice = _sel[0], setSelectedChoice = _sel[1];
  var _ans = React.useState(false), answered = _ans[0], setAnswered = _ans[1];
  var _qi = React.useState(0), quizIndex = _qi[0], setQuizIndex = _qi[1];
  var _corr = React.useState(0), correctCount = _corr[0], setCorrectCount = _corr[1];
  var _tot = React.useState(0), totalQ = _tot[0], setTotalQ = _tot[1];
  var _branch = React.useState(null), branch = _branch[0], setBranch = _branch[1];
  var _quizQs = React.useState([]), quizQuestions = _quizQs[0], setQuizQuestions = _quizQs[1];

  var slide = SLIDES[currentSlide];
  var totalSlides = SLIDES.length;

  function goNext() {
    setSelectedChoice(null);
    setAnswered(false);
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  }

  function goPrev() {
    if (currentSlide > 0) {
      setSelectedChoice(null);
      setAnswered(false);
      setCurrentSlide(currentSlide - 1);
    }
  }

  function startQuiz(bankId) {
    var bank = QUIZ_BANKS.find(function(b) { return b.id === bankId; });
    if (!bank) { goNext(); return; }
    var qs = shuffleArray(bank.questions).slice(0, bank.drawCount);
    setQuizQuestions(qs);
    setQuizIndex(0);
    setCorrectCount(0);
    setTotalQ(qs.length);
    setQuizState('active');
    setSelectedChoice(null);
    setAnswered(false);
  }

  function handleQuizAnswer(choiceIdx) {
    if (answered) return;
    setSelectedChoice(choiceIdx);
    setAnswered(true);
    var q = quizQuestions[quizIndex];
    if (q && q.choices[choiceIdx] && q.choices[choiceIdx].isCorrect) {
      setCorrectCount(correctCount + 1);
    }
  }

  function nextQuestion() {
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex(quizIndex + 1);
      setSelectedChoice(null);
      setAnswered(false);
    } else {
      // Quiz complete — jump to results
      var finalScore = Math.round((correctCount + (answered && quizQuestions[quizIndex] && quizQuestions[quizIndex].choices[selectedChoice] && quizQuestions[quizIndex].choices[selectedChoice].isCorrect ? 1 : 0)) / totalQ * 100);
      setScore(finalScore);
      setQuizState('complete');
      SCORM.complete(finalScore, MASTERY);
      setCurrentSlide(totalSlides - 1);
    }
  }

  function handleFormChange(field, value) {
    var updated = Object.assign({}, formData);
    updated[field] = value;
    setFormData(updated);
  }

  // ---- Progress ----
  var progress = ((currentSlide + 1) / totalSlides) * 100;

  // ---- Render Slide ----
  function renderSlide() {
    if (!slide) return e('div', null, 'No slide data');

    // If we're in active quiz mode, always render the quiz
    if (quizState === 'active' && quizQuestions.length > 0) {
      return renderQuizSlide();
    }

    switch (slide.type) {
      case 'title': return renderTitleSlide();
      case 'objectives': return renderObjectivesSlide();
      case 'form': return renderFormSlide();
      case 'branching': return renderBranchingSlide();
      case 'quiz': return renderQuizSlide();
      case 'results': return renderResultsSlide();
      default: return renderContentSlide();
    }
  }

  function renderTitleSlide() {
    return e('div', { className: 'slide slide-title', style: slide.image ? {
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.7)), url(' + slide.image + ')',
      backgroundSize: 'cover', backgroundPosition: 'center'
    } : {} },
      e('div', { className: 'content' },
        LOGO_URL ? e('img', { src: LOGO_URL, alt: LOGO_ALT, className: 'logo' }) : null,
        e('h1', null, slide.title || COURSE_TITLE),
        slide.subtitle ? e('p', { className: 'subtitle' }, slide.subtitle) : null,
        e('button', { className: 'btn', onClick: goNext }, 'Start Course')
      )
    );
  }

  function renderObjectivesSlide() {
    return e('div', { className: 'slide slide-content' },
      e('div', { className: 'card' },
        e('h2', null, slide.title),
        slide.texts && slide.texts.map(function(t, i) {
          return e('p', { key: i }, t);
        }),
        slide.image ? e('div', { className: 'hero-image' },
          e('img', { src: slide.image, alt: slide.title })
        ) : null,
        e('div', { style: { marginTop: 'calc(var(--spacing) * 3)', textAlign: 'center' } },
          e('button', { className: 'btn btn-primary', onClick: goNext }, 'Continue')
        )
      )
    );
  }

  function renderFormSlide() {
    return e('div', { className: 'slide slide-content' },
      e('div', { className: 'card' },
        e('h2', null, slide.title),
        slide.instruction ? e('p', null, slide.instruction) : null,
        slide.fields && slide.fields.map(function(f, i) {
          return e('div', { className: 'form-group', key: i },
            e('label', null, f.label || f.placeholder),
            e('input', {
              type: f.fieldType || 'text',
              placeholder: f.placeholder,
              value: formData[f.variableName] || '',
              onChange: function(ev) { handleFormChange(f.variableName, ev.target.value); }
            })
          );
        }),
        e('div', { style: { marginTop: 'calc(var(--spacing) * 3)', textAlign: 'center' } },
          e('button', { className: 'btn btn-primary', onClick: goNext }, 'Continue')
        )
      )
    );
  }

  function renderBranchingSlide() {
    var userName = formData['TextEntry9'] || '';
    return e('div', { className: 'slide slide-content' },
      e('div', { style: { textAlign: 'center', maxWidth: '760px' } },
        e('h2', null, slide.title),
        slide.instruction ? e('p', { style: { marginBottom: 'calc(var(--spacing) * 2)' } }, slide.instruction) : null,
        slide.greeting ? e('p', { style: { fontSize: '18px', marginBottom: 'calc(var(--spacing) * 2)' } },
          slide.greeting.replace('%name%', userName)
        ) : null,
        e('div', { className: 'branch-options' },
          slide.options && slide.options.map(function(opt, i) {
            return e('div', {
              className: 'branch-option',
              key: i,
              onClick: function() {
                setBranch(opt.value || opt.label);
                if (opt.quizBank) {
                  startQuiz(opt.quizBank);
                } else {
                  // Skip option — go to results with full marks
                  setScore(100);
                  setQuizState('complete');
                  SCORM.complete(100, MASTERY);
                  // Jump to last slide (results)
                  setCurrentSlide(totalSlides - 1);
                }
              }
            },
              e('h3', null, opt.label)
            );
          })
        )
      )
    );
  }

  function renderQuizSlide() {
    var q = quizQuestions[quizIndex];
    if (!q) return e('div', { className: 'slide slide-content' }, e('p', null, 'Loading quiz...'));

    return e('div', { className: 'slide slide-content' },
      e('div', { style: { textAlign: 'center', width: '100%', maxWidth: '760px' } },
        e('p', { style: { color: 'var(--text-muted)', marginBottom: 'var(--spacing)' } },
          'Question ' + (quizIndex + 1) + ' of ' + totalQ
        ),
        e('div', { className: 'quiz-question' }, q.questionText),
        e('div', { className: 'quiz-choices' },
          q.choices.map(function(c, i) {
            var cls = 'quiz-choice';
            if (selectedChoice === i) cls += ' selected';
            if (answered && c.isCorrect) cls += ' correct';
            if (answered && selectedChoice === i && !c.isCorrect) cls += ' incorrect';
            return e('div', {
              className: cls, key: i,
              onClick: function() { handleQuizAnswer(i); }
            },
              e('div', { className: 'indicator' },
                answered ? (c.isCorrect ? '\\u2713' : (selectedChoice === i ? '\\u2717' : '')) : ''
              ),
              e('span', null, c.text)
            );
          })
        ),
        answered ? e('div', {
          className: 'quiz-feedback ' + (q.choices[selectedChoice] && q.choices[selectedChoice].isCorrect ? 'correct' : 'incorrect')
        }, q.choices[selectedChoice] && q.choices[selectedChoice].isCorrect ? (q.correctFeedback || 'Correct!') : (q.incorrectFeedback || 'Incorrect.')) : null,
        answered ? e('div', { style: { marginTop: 'calc(var(--spacing) * 2)' } },
          e('button', { className: 'btn btn-primary', onClick: nextQuestion },
            quizIndex < quizQuestions.length - 1 ? 'Next Question' : 'See Results'
          )
        ) : null
      )
    );
  }

  function renderResultsSlide() {
    var displayScore = score !== null ? score : 0;
    var passed = displayScore >= MASTERY;
    return e('div', { className: 'slide slide-results' },
      e('div', { className: 'content', style: { maxWidth: '500px' } },
        e('h2', { style: { color: 'white' } }, slide.title || 'Your Results'),
        e('div', { className: 'score-circle' },
          e('div', { className: 'score-value' }, displayScore + '%'),
          e('div', { className: 'score-label' }, passed ? 'Passed' : 'Not passed')
        ),
        e('p', { style: { color: 'rgba(255,255,255,0.85)', marginTop: 'calc(var(--spacing) * 2)' } },
          passed
            ? 'Congratulations! You have successfully completed this course.'
            : 'You need ' + MASTERY + '% to pass. Please try again.'
        ),
        !passed ? e('button', {
          className: 'btn', style: { marginTop: 'calc(var(--spacing) * 3)', background: 'white', color: 'var(--primary)' },
          onClick: function() { setCurrentSlide(0); setQuizState(null); setScore(null); }
        }, 'Restart Course') : null
      )
    );
  }

  function renderContentSlide() {
    return e('div', { className: 'slide slide-content' },
      e('div', { className: 'card' },
        e('h2', null, slide.title),
        slide.texts && slide.texts.map(function(t, i) {
          return e('p', { key: i }, t);
        }),
        slide.image ? e('div', { className: 'hero-image' },
          e('img', { src: slide.image, alt: slide.title })
        ) : null,
        e('div', { style: { marginTop: 'calc(var(--spacing) * 3)', textAlign: 'center' } },
          e('button', { className: 'btn btn-primary', onClick: goNext }, 'Continue')
        )
      )
    );
  }

  // ---- Main Render ----
  var showNav = slide && slide.type !== 'title' && slide.type !== 'results';
  var isQuizActive = quizState === 'active';

  return e('div', { className: 'app' },
    e('div', { className: 'progress-bar' },
      e('div', { className: 'progress-fill', style: { width: progress + '%' } })
    ),
    e('div', { className: 'slide-container' }, renderSlide()),
    showNav && !isQuizActive ? e('div', { className: 'nav-bar' },
      e('button', {
        className: 'btn btn-ghost',
        onClick: goPrev,
        disabled: currentSlide === 0,
        style: currentSlide === 0 ? { opacity: 0.3 } : {}
      }, '\\u2190 Back'),
      e('span', { className: 'slide-counter' }, (currentSlide + 1) + ' / ' + totalSlides),
      e('button', { className: 'btn btn-primary', onClick: goNext }, 'Next \\u2192')
    ) : null
  );
}

// Mount
ReactDOM.createRoot(document.getElementById('root')).render(e(App));
`;
}

// ---- Data Builders ----

interface SlideData {
  type: string;
  title: string;
  subtitle?: string;
  texts?: string[];
  image?: string;
  instruction?: string;
  greeting?: string;
  fields?: any[];
  options?: any[];
}

function buildSlidesData(course: CourseIR, images: ImageManifest): SlideData[] {
  return course.slides.map(slide => {
    const data: SlideData = {
      type: slide.type,
      title: slide.title,
    };

    // Extract text content — filter out Storyline artifacts
    const texts = slide.elements
      .filter((e): e is TextElement => e.type === 'text' && e.role !== 'unknown')
      .map(e => cleanText(e.content))
      .filter(t => t.length > 3 && !isJunkText(t));

    if (texts.length > 0) data.texts = texts;

    // Find hero/content image — remap path to output assets folder
    const imgEl = slide.elements.find(
      (e): e is ImageElement => e.type === 'image' && ['hero', 'content', 'background'].includes(e.instructionalRole)
    );
    if (imgEl) {
      const generated = images.entries.find(e => e.originalAssetId === imgEl.assetId && e.status === 'generated');
      if (generated?.generatedPath) {
        data.image = generated.generatedPath;
      } else {
        // Remap to output assets path
        const filename = imgEl.originalPath.split('/').pop() || '';
        data.image = 'assets/images/' + filename;
      }
    }

    // Slide-type specific data
    switch (slide.type) {
      case 'title': {
        // Use the most descriptive text as the title — the course meta title
        // is often just the Storyline project name (e.g. "Test intro scene")
        const descriptiveTitle = texts.find(t =>
          t.length > 5 && !t.toLowerCase().includes('test') && !t.toLowerCase().includes('scene')
        );
        if (descriptiveTitle) {
          data.title = descriptiveTitle;
          data.subtitle = texts.find(t => t !== descriptiveTitle) || undefined;
        } else {
          data.title = course.meta.title;
          if (texts.length > 0) data.subtitle = texts[0];
        }
        break;
      }

      case 'form': {
        const formEl = slide.elements.find((e): e is FormElement => e.type === 'form');
        if (formEl) {
          data.fields = formEl.fields.map(f => ({
            label: f.label.trim(),
            placeholder: f.label.trim(),
            fieldType: f.fieldType,
            variableName: f.variableName,
          }));
        }
        data.title = 'Your Details';
        const instruction = texts.find(t => t.toLowerCase().includes('enter') || t.toLowerCase().includes('please'));
        data.instruction = instruction || 'Please fill in your details';
        data.texts = undefined; // Form uses fields, not text paragraphs
        break;
      }

      case 'branching': {
        const buttons = slide.elements.filter((e): e is ButtonElement => e.type === 'button');
        const instruction = texts.find(t => t.toLowerCase().includes('click') || t.toLowerCase().includes('select'));
        data.instruction = instruction;

        // Greeting with name variable
        const greeting = texts.find(t => t.includes('%'));
        if (greeting) data.greeting = greeting.replace(/%_player\.TextEntry\d+%/g, '%name%');

        if (slide.title === 'Role Selector') {
          data.title = 'Choose Your Path';
          data.options = [
            { label: 'Non-Technical', value: 'non-technical', quizBank: 'QuestionDraw51' },
            { label: 'Semi-Technical', value: 'semi-technical', quizBank: 'QuestionDraw51' },
            { label: 'Technical', value: 'technical', quizBank: 'QuestionDraw71' },
          ];
        } else if (slide.title === 'Pre-knowledge check') {
          data.title = 'EV Knowledge Assessment';
          data.instruction = 'Choose your preferred assessment level';
          data.options = buttons
            .filter(b => b.label && !b.label.includes('Hotspot') && b.label !== '<')
            .map(b => {
              const label = cleanText(b.label);
              // Link pre-knowledge options to quiz banks too
              const isShort = label.toLowerCase().includes('short');
              const isSkip = label.toLowerCase().includes('skip');
              return {
                label,
                value: label,
                quizBank: isSkip ? undefined : (isShort ? 'QuestionDraw51' : 'QuestionDraw71'),
              };
            });
        }
        data.texts = undefined; // Branching uses options, not text paragraphs
        break;
      }

      case 'quiz':
        break;

      case 'results':
        data.title = 'Your Results';
        data.texts = undefined;
        break;
    }

    return data;
  });
}

function buildQuizData(course: CourseIR): any[] {
  return course.questionBanks.map(bank => ({
    id: bank.id,
    title: bank.title,
    group: bank.group,
    drawCount: bank.drawCount,
    questions: bank.questions.map(q => ({
      questionText: q.questionText,
      choices: q.choices.map(c => ({
        text: c.text,
        isCorrect: c.isCorrect,
      })),
      correctFeedback: q.correctFeedback,
      incorrectFeedback: q.incorrectFeedback,
    })),
  }));
}

// ---- Text Cleanup ----

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isJunkText(text: string): boolean {
  const lower = text.toLowerCase();
  // Storyline shape names and artifacts
  if (/^(round diagonal corner|rectangle|oval|shape)\s*\d*$/i.test(text)) return true;
  // Storyline variable references
  if (text.includes('%_player.') && text.includes('$PercentScore')) return true;
  // Generic labels
  if (lower === 'question' || lower === 'correct' || lower === 'incorrect') return true;
  return false;
}

// ---- Helpers ----

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
