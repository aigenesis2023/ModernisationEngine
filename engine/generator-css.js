/**
 * CSS Generator — Produces brand-dynamic, mobile-first CSS from a BrandProfile.
 * Part 1 of the generator (split to avoid timeout).
 *
 * Layout: Mobile-first with fluid CSS Grid.
 * Components: Accordion, Modal, Bento Grid.
 */
window.GeneratorCSS = (function () {
  'use strict';

  function isDarkTheme(brand) {
    var bg = brand.colors.background;
    if (!bg.startsWith('#') || bg.length < 7) return false;
    var r = parseInt(bg.slice(1, 3), 16);
    var g = parseInt(bg.slice(3, 5), 16);
    var b = parseInt(bg.slice(5, 7), 16);
    return (r + g + b) / 3 < 80;
  }

  function buttonCss(brand) {
    var b = brand.colors;
    switch (brand.style.buttonStyle) {
      case 'gradient':
        return '.btn-primary {\n  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') +
          ';\n  color: white; border: none;\n}\n.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 15px ' + b.primary + '44; }';
      case 'outline':
        return '.btn-primary {\n  background: transparent; color: var(--primary);\n  border: 2px solid var(--primary);\n}\n.btn-primary:hover { background: var(--primary); color: white; }';
      default:
        return '.btn-primary {\n  background: var(--primary); color: white; border: none;\n}\n.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 15px ' + b.primary + '44; }';
    }
  }

  function cardShadow(brand) {
    var dark = isDarkTheme(brand);
    switch (brand.style.cardStyle) {
      case 'elevated':
        return dark ? 'box-shadow: 0 4px 20px rgba(0,0,0,0.3);' : 'box-shadow: 0 4px 20px rgba(0,0,0,0.08);';
      case 'glass':
        return dark
          ? 'backdrop-filter: blur(10px); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 20px rgba(0,0,0,0.2);'
          : 'backdrop-filter: blur(10px); background: rgba(255,255,255,0.7); box-shadow: 0 4px 20px rgba(0,0,0,0.06);';
      case 'outlined':
        return dark ? 'border: 1px solid rgba(255,255,255,0.12);' : 'border: 1px solid rgba(0,0,0,0.08);';
      default: return '';
    }
  }

  function generateCss(brand) {
    var b = brand.colors;
    var t = brand.typography;
    var s = brand.style;
    var dark = isDarkTheme(brand);
    var border = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
    var borderLight = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    var shadow = cardShadow(brand);
    var btnCss = buttonCss(brand);

    // Fluid font sizes (mobile base, scale up on desktop)
    var h1Mobile = Math.round(t.headingSizes.h1 * 0.65);
    var h2Mobile = Math.round(t.headingSizes.h2 * 0.7);
    var h3Mobile = Math.round(t.headingSizes.h3 * 0.8);

    return (
      // ============ CSS VARIABLES ============
      ':root {\n' +
      '  --primary: ' + b.primary + ';\n' +
      '  --secondary: ' + b.secondary + ';\n' +
      '  --accent: ' + b.accent + ';\n' +
      '  --bg: ' + b.background + ';\n' +
      '  --surface: ' + b.surface + ';\n' +
      '  --text: ' + b.text + ';\n' +
      '  --text-muted: ' + b.textMuted + ';\n' +
      '  --success: ' + b.success + ';\n' +
      '  --error: ' + b.error + ';\n' +
      '  --warning: ' + b.warning + ';\n' +
      '  --radius: ' + s.borderRadius + ';\n' +
      '  --font-heading: \'' + t.headingFont + '\', system-ui, sans-serif;\n' +
      '  --font-body: \'' + t.bodyFont + '\', system-ui, sans-serif;\n' +
      '  --spacing: ' + s.spacing.unit + 'px;\n' +
      '  --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '}\n\n' +

      // ============ RESET & BASE (mobile-first) ============
      '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n\n' +
      'body {\n  font-family: var(--font-body);\n  font-size: ' + t.baseSize + 'px;\n' +
      '  line-height: ' + t.lineHeight + ';\n  color: var(--text);\n  background: var(--bg);\n' +
      '  -webkit-font-smoothing: antialiased;\n  overflow: hidden;\n}\n\n' +
      '#root { width: 100vw; height: 100vh; overflow: hidden; }\n\n' +
      '.app { width: 100%; height: 100%; display: flex; flex-direction: column; }\n' +
      '.slide-container {\n  flex: 1; overflow-y: auto; overflow-x: hidden;\n  position: relative; scroll-behavior: smooth;\n}\n\n' +

      // ============ TYPOGRAPHY (mobile-first) ============
      'h1, h2, h3 {\n  font-family: var(--font-heading);\n  font-weight: ' + t.headingWeight + ';\n  line-height: 1.2;\n  letter-spacing: -0.02em;\n}\n' +
      'h1 { font-size: ' + h1Mobile + 'px; margin-bottom: calc(var(--spacing) * 2); }\n' +
      'h2 { font-size: ' + h2Mobile + 'px; margin-bottom: calc(var(--spacing) * 1.5); }\n' +
      'h3 { font-size: ' + h3Mobile + 'px; margin-bottom: var(--spacing); }\n' +
      'p { margin-bottom: var(--spacing); max-width: 680px; }\n\n' +

      // ============ SLIDE (mobile-first) ============
      '.slide {\n  min-height: 100%; padding: calc(var(--spacing) * 3) calc(var(--spacing) * 2);\n' +
      '  display: flex; flex-direction: column; align-items: center; justify-content: center;\n' +
      '  gap: calc(var(--spacing) * 2);\n' +
      '  animation: slideIn 0.5s ease-out;\n}\n\n' +
      '@keyframes slideIn {\n  from { opacity: 0; transform: translateY(20px); }\n  to { opacity: 1; transform: translateY(0); }\n}\n\n' +

      // ============ BUTTONS ============
      '.btn {\n  display: inline-flex; align-items: center; justify-content: center; gap: 8px;\n' +
      '  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 3);\n' +
      '  border: none; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: ' + t.baseSize + 'px; font-weight: 600;\n' +
      '  cursor: pointer; transition: all var(--transition);\n  text-decoration: none; min-width: 120px;\n' +
      '  -webkit-tap-highlight-color: transparent;\n}\n' +
      '.btn:active { transform: scale(0.97); }\n' +
      btnCss + '\n\n' +
      '.btn-secondary {\n  background: transparent; color: var(--primary);\n  border: 2px solid var(--primary);\n}\n' +
      '.btn-secondary:hover { background: var(--primary); color: white; }\n\n' +
      '.btn-ghost {\n  background: transparent; color: var(--text-muted);\n  border: 1px solid ' + border + ';\n}\n' +
      '.btn-ghost:hover { border-color: var(--primary); color: var(--primary); }\n\n' +
      '.actions { margin-top: calc(var(--spacing) * 2); text-align: center; }\n\n' +

      // ============ CARD ============
      '.card {\n  background: var(--surface);\n  border-radius: var(--radius);\n  padding: calc(var(--spacing) * 2);\n' +
      '  width: 100%; max-width: 760px;\n  ' + shadow + '\n  transition: all var(--transition);\n}\n\n' +

      // ============ TITLE SLIDE ============
      '.slide-title {\n  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  color: white; text-align: center;\n  padding: 0; justify-content: center; align-items: center;\n' +
      '  position: relative; overflow: hidden;\n  background-size: cover; background-position: center;\n}\n' +
      '.slide-title::before {\n  content: \'\'; position: absolute; inset: 0;\n' +
      '  background: radial-gradient(circle at 30% 70%, rgba(255,255,255,0.1) 0%, transparent 60%);\n}\n' +
      '.slide-title .content { position: relative; z-index: 2; max-width: 720px; padding: calc(var(--spacing) * 2); }\n' +
      '.slide-title h1 { font-size: ' + Math.round(t.headingSizes.h1 * 0.85) + 'px; margin-bottom: calc(var(--spacing) * 2); color: white; }\n' +
      '.slide-title .subtitle { font-size: ' + Math.round(t.baseSize * 1.1) + 'px; opacity: 0.85; margin-bottom: calc(var(--spacing) * 3); }\n' +
      '.slide-title .logo { max-width: 160px; max-height: 50px; margin-bottom: calc(var(--spacing) * 2); }\n' +
      '.slide-title .btn { background: white; color: var(--primary); font-weight: 700; }\n' +
      '.slide-title .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }\n\n' +

      // ============ CONTENT SLIDE ============
      '.slide-content { background: var(--bg); }\n\n' +

      // ============ FORMS ============
      '.form-group { margin-bottom: calc(var(--spacing) * 2); width: 100%; }\n' +
      '.form-group label {\n  display: block; font-weight: 600; margin-bottom: calc(var(--spacing) * 0.5);\n  color: var(--text);\n}\n' +
      '.form-group input, .form-group textarea {\n  width: 100%; padding: calc(var(--spacing) * 1.5);\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: ' + t.baseSize + 'px;\n' +
      '  transition: border-color var(--transition);\n  background: var(--bg); color: var(--text);\n}\n' +
      '.form-group input:focus, .form-group textarea:focus {\n  outline: none; border-color: var(--primary);\n' +
      '  box-shadow: 0 0 0 3px ' + b.primary + '22;\n}\n\n' +

      // ============ HERO IMAGE / VIDEO / AUDIO ============
      '.hero-image {\n  width: 100%; border-radius: var(--radius);\n' +
      '  overflow: hidden; margin-bottom: calc(var(--spacing) * 2);\n  ' + shadow + '\n}\n' +
      '.hero-image img { width: 100%; height: auto; display: block; }\n\n' +
      '.video-container {\n  width: 100%; border-radius: var(--radius);\n' +
      '  overflow: hidden; margin-bottom: calc(var(--spacing) * 2);\n  ' + shadow + '\n}\n' +
      '.video-container video { width: 100%; height: auto; display: block; background: #000; }\n\n' +
      '.audio-container {\n  width: 100%;\n  margin-bottom: calc(var(--spacing) * 2);\n}\n' +
      '.audio-container audio { width: 100%; border-radius: var(--radius); }\n\n' +

      // ============ ACCORDION ============
      '.accordion {\n  width: 100%; max-width: 760px;\n}\n' +
      '.accordion-item {\n  border: 1px solid ' + border + ';\n  border-radius: var(--radius);\n' +
      '  margin-bottom: var(--spacing);\n  overflow: hidden;\n  transition: all var(--transition);\n}\n' +
      '.accordion-item.open {\n  border-color: var(--primary);\n  ' + shadow + '\n}\n' +
      '.accordion-trigger {\n  width: 100%; display: flex; justify-content: space-between; align-items: center;\n' +
      '  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2);\n' +
      '  background: var(--surface); border: none; cursor: pointer;\n' +
      '  font-family: var(--font-heading); font-size: ' + Math.round(t.baseSize * 1.05) + 'px;\n' +
      '  font-weight: 600; color: var(--text); text-align: left;\n' +
      '  transition: all var(--transition);\n  -webkit-tap-highlight-color: transparent;\n}\n' +
      '.accordion-trigger:hover { color: var(--primary); }\n' +
      '.accordion-item.open .accordion-trigger { color: var(--primary); }\n' +
      '.accordion-icon {\n  font-size: 20px; font-weight: 300;\n  transition: transform var(--transition);\n  flex-shrink: 0; margin-left: var(--spacing);\n}\n' +
      '.accordion-panel {\n  padding: calc(var(--spacing) * 2);\n' +
      '  background: var(--bg);\n  border-top: 1px solid ' + borderLight + ';\n' +
      '  animation: accordionOpen 0.3s ease-out;\n}\n' +
      '@keyframes accordionOpen {\n  from { opacity: 0; transform: translateY(-8px); }\n  to { opacity: 1; transform: translateY(0); }\n}\n\n' +

      // ============ MODAL ============
      '.modal-triggers {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: var(--spacing);\n  width: 100%; max-width: 760px;\n}\n' +
      '.modal-trigger-tile {\n  display: flex; align-items: center;\n' +
      '  border: 1px solid ' + border + '; border-radius: var(--radius);\n' +
      '  overflow: hidden; cursor: pointer;\n  background: var(--surface); transition: all var(--transition);\n' +
      '  -webkit-tap-highlight-color: transparent;\n}\n' +
      '.modal-trigger-tile:hover {\n  border-color: var(--primary);\n  transform: translateY(-2px);\n  ' + shadow + '\n}\n' +
      '.tile-thumb {\n  width: 80px; height: 80px; flex-shrink: 0; overflow: hidden;\n}\n' +
      '.tile-thumb img { width: 100%; height: 100%; object-fit: cover; }\n' +
      '.tile-label {\n  flex: 1; display: flex; justify-content: space-between; align-items: center;\n' +
      '  padding: var(--spacing) calc(var(--spacing) * 1.5);\n' +
      '  font-weight: 600; font-size: ' + Math.round(t.baseSize * 0.95) + 'px;\n}\n' +
      '.tile-arrow { color: var(--primary); font-size: 18px; }\n\n' +

      '.modal-overlay {\n  position: fixed; inset: 0; z-index: 1000;\n' +
      '  background: rgba(0,0,0,0.6);\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  padding: calc(var(--spacing) * 2);\n' +
      '  animation: fadeIn 0.2s ease-out;\n}\n' +
      '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }\n' +
      '.modal-content {\n  background: var(--surface); border-radius: var(--radius);\n' +
      '  width: 100%; max-width: 600px; max-height: 85vh;\n' +
      '  overflow-y: auto; padding: calc(var(--spacing) * 2);\n' +
      '  position: relative;\n  animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);\n' +
      '  ' + shadow + '\n}\n' +
      '@keyframes modalIn {\n  from { opacity: 0; transform: scale(0.9) translateY(20px); }\n  to { opacity: 1; transform: scale(1) translateY(0); }\n}\n' +
      '.modal-close {\n  position: sticky; top: 0; float: right;\n' +
      '  width: 36px; height: 36px; border-radius: 50%;\n' +
      '  border: none; background: ' + (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') + ';\n' +
      '  cursor: pointer; font-size: 18px; color: var(--text-muted);\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  transition: all var(--transition); z-index: 1;\n}\n' +
      '.modal-close:hover { background: var(--primary); color: white; }\n' +
      '.modal-image {\n  width: 100%; border-radius: var(--radius);\n' +
      '  overflow: hidden; margin-bottom: calc(var(--spacing) * 2);\n}\n' +
      '.modal-image img { width: 100%; height: auto; display: block; }\n\n' +

      // ============ BENTO GRID ============
      '.bento-grid {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: var(--spacing);\n  width: 100%; max-width: 760px;\n}\n' +
      '.bento-tile {\n  background: var(--surface);\n  border-radius: var(--radius);\n' +
      '  padding: calc(var(--spacing) * 2);\n' +
      '  border: 1px solid ' + border + ';\n' +
      '  transition: all var(--transition);\n  ' + shadow + '\n}\n' +
      '.bento-tile:hover { border-color: var(--primary); transform: translateY(-2px); }\n' +
      '.bento-tile h3 { color: var(--primary); }\n' +
      '.bento-image {\n  width: 100%; border-radius: calc(var(--radius) * 0.6);\n' +
      '  overflow: hidden; margin-bottom: var(--spacing);\n}\n' +
      '.bento-image img { width: 100%; height: auto; display: block; }\n\n' +

      // ============ BRANCHING ============
      '.branch-container { text-align: center; width: 100%; max-width: 760px; }\n' +
      '.greeting { font-size: ' + Math.round(t.baseSize * 1.1) + 'px; margin-bottom: calc(var(--spacing) * 2); }\n' +
      '.branch-grid {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: calc(var(--spacing) * 1.5);\n  margin-top: calc(var(--spacing) * 2);\n}\n' +
      '.branch-option {\n  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  cursor: pointer; transition: all var(--transition);\n  text-align: center;\n' +
      '  background: var(--surface);\n  ' + shadow + '\n' +
      '  -webkit-tap-highlight-color: transparent;\n}\n' +
      '.branch-option:hover {\n  border-color: var(--primary); transform: translateY(-3px);\n  box-shadow: 0 12px 30px rgba(0,0,0,0.12);\n}\n' +
      '.branch-option h3 { color: var(--primary); margin-bottom: 0; }\n\n' +

      // ============ QUIZ ============
      '.quiz-container { text-align: center; width: 100%; max-width: 760px; }\n' +
      '.quiz-counter { color: var(--text-muted); margin-bottom: var(--spacing); }\n' +
      '.quiz-question {\n  font-family: var(--font-heading); font-size: ' + h3Mobile + 'px;\n' +
      '  font-weight: ' + t.headingWeight + '; margin-bottom: calc(var(--spacing) * 2);\n  text-align: center; max-width: 680px; margin-left: auto; margin-right: auto;\n}\n' +
      '.quiz-choices { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: var(--spacing); margin: 0 auto; }\n' +
      '.quiz-choice {\n  display: flex; align-items: center; gap: calc(var(--spacing) * 1.5);\n' +
      '  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2);\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  cursor: pointer; transition: all var(--transition);\n  background: var(--surface); font-size: ' + t.baseSize + 'px;\n' +
      '  text-align: left; -webkit-tap-highlight-color: transparent;\n}\n' +
      '.quiz-choice:hover { border-color: var(--primary); }\n' +
      '.quiz-choice.selected { border-color: var(--primary); background: ' + b.primary + '11; }\n' +
      '.quiz-choice.correct { border-color: var(--success); background: ' + b.success + '11; }\n' +
      '.quiz-choice.incorrect { border-color: var(--error); background: ' + b.error + '11; }\n' +
      '.quiz-choice .indicator {\n  width: 24px; height: 24px; border-radius: 50%;\n' +
      '  border: 2px solid ' + border + '; flex-shrink: 0;\n' +
      '  display: flex; align-items: center; justify-content: center;\n  font-size: 14px; color: white;\n  transition: all var(--transition);\n}\n' +
      '.quiz-choice.selected .indicator { border-color: var(--primary); background: var(--primary); }\n' +
      '.quiz-choice.correct .indicator { border-color: var(--success); background: var(--success); }\n' +
      '.quiz-choice.incorrect .indicator { border-color: var(--error); background: var(--error); }\n' +
      '.quiz-choice .indicator.checkbox { border-radius: 4px; }\n' +
      '.quiz-choice.selected .indicator.checkbox { border-color: var(--primary); background: var(--primary); }\n' +
      '.quiz-feedback {\n  margin-top: calc(var(--spacing) * 2); padding: calc(var(--spacing) * 1.5);\n' +
      '  border-radius: var(--radius); text-align: center; font-weight: 600;\n  animation: slideIn 0.3s ease-out;\n}\n' +
      '.quiz-feedback.correct { background: ' + b.success + '15; color: var(--success); }\n' +
      '.quiz-feedback.incorrect { background: ' + b.error + '15; color: var(--error); }\n\n' +
      '.quiz-text-entry { width: 100%; max-width: 560px; margin: var(--spacing) auto; }\n' +
      '.quiz-text-entry input, .quiz-text-entry textarea {\n  width: 100%; padding: calc(var(--spacing) * 1.5);\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: ' + t.baseSize + 'px;\n' +
      '  background: var(--bg); color: var(--text);\n  transition: border-color var(--transition);\n}\n' +
      '.quiz-text-entry input:focus, .quiz-text-entry textarea:focus {\n  outline: none; border-color: var(--primary);\n' +
      '  box-shadow: 0 0 0 3px ' + b.primary + '22;\n}\n\n' +

      // ============ RESULTS ============
      '.slide-results {\n  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n  color: white; text-align: center;\n}\n' +
      '.slide-results .content { max-width: 500px; }\n' +
      '.score-circle {\n  width: 120px; height: 120px; border-radius: 50%;\n  border: 6px solid rgba(255,255,255,0.3);\n' +
      '  display: flex; align-items: center; justify-content: center; flex-direction: column;\n' +
      '  margin: calc(var(--spacing) * 2) auto;\n  animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);\n}\n' +
      '.score-circle .score-value { font-size: 36px; font-weight: ' + t.headingWeight + '; font-family: var(--font-heading); }\n' +
      '.score-circle .score-label { font-size: 13px; opacity: 0.8; }\n' +
      '.results-msg { color: rgba(255,255,255,0.85); margin-top: calc(var(--spacing) * 2); }\n' +
      '.btn-restart { margin-top: calc(var(--spacing) * 2); background: white; color: var(--primary); border: none; font-weight: 700; }\n\n' +
      '@keyframes scaleIn {\n  from { transform: scale(0); opacity: 0; }\n  to { transform: scale(1); opacity: 1; }\n}\n\n' +

      // ============ PROGRESS & NAV ============
      '.progress-bar {\n  height: 4px; background: ' + b.primary + '22;\n  position: sticky; top: 0; z-index: 100;\n}\n' +
      '.progress-fill {\n  height: 100%; background: var(--primary);\n  transition: width 0.4s ease;\n}\n\n' +
      '.nav-bar {\n  display: flex; justify-content: space-between; align-items: center;\n' +
      '  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2);\n' +
      '  background: var(--surface); border-top: 1px solid ' + borderLight + ';\n  flex-shrink: 0;\n}\n' +
      '.nav-bar .slide-counter { color: var(--text-muted); font-size: 13px; }\n\n' +

      // ============ DESKTOP BREAKPOINT (≥768px) ============
      '@media (min-width: 768px) {\n' +
      '  .slide { padding: calc(var(--spacing) * 6) calc(var(--spacing) * 4); gap: calc(var(--spacing) * 3); }\n' +
      '  h1 { font-size: ' + t.headingSizes.h1 + 'px; margin-bottom: calc(var(--spacing) * 3); }\n' +
      '  h2 { font-size: ' + t.headingSizes.h2 + 'px; margin-bottom: calc(var(--spacing) * 2); }\n' +
      '  h3 { font-size: ' + t.headingSizes.h3 + 'px; }\n' +
      '  .card { padding: calc(var(--spacing) * 3); }\n' +
      '  .slide-title h1 { font-size: ' + Math.round(t.headingSizes.h1 * 1.3) + 'px; }\n' +
      '  .slide-title .logo { max-width: 200px; max-height: 60px; }\n' +
      '  .btn { padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 4); min-width: 140px; }\n' +
      '  .nav-bar { padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 3); }\n' +
      '  .score-circle { width: 160px; height: 160px; }\n' +
      '  .score-circle .score-value { font-size: 48px; }\n' +
      '  .quiz-question { font-size: ' + t.headingSizes.h3 + 'px; }\n' +
      // Grid layouts scale up on desktop
      '  .bento-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }\n' +
      '  .branch-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }\n' +
      '  .modal-triggers { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }\n' +
      '  .tile-thumb { width: 100px; height: 100px; }\n' +
      '  .modal-content { padding: calc(var(--spacing) * 3); }\n' +
      '}\n'
    );
  }

  return { generateCss: generateCss, isDarkTheme: isDarkTheme };
})();
