/**
 * CSS Generator — Produces brand-dynamic, mobile-first CSS for deep-scroll layout.
 * Designed for a continuous scrolling experience with distinct section styles.
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

  // Parse a size string like "3rem", "16px", or a plain number into a numeric px value
  function parseSizePx(val, fallback) {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return fallback || 16;
    var num = parseFloat(val);
    if (isNaN(num)) return fallback || 16;
    if (val.indexOf('rem') !== -1) return Math.round(num * 16);
    if (val.indexOf('em') !== -1) return Math.round(num * 16);
    return Math.round(num);
  }

  // Parse spacing value — could be "1.5rem", "24px", or a number
  function parseSpacingPx(val) {
    if (typeof val === 'object' && val !== null) return val.unit || 24;
    return parseSizePx(val, 24);
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

    // Normalize sizes to numeric px values
    var baseSizePx = parseSizePx(t.baseSize, 16);
    var h1Px = parseSizePx(t.headingSizes.h1, 48);
    var h2Px = parseSizePx(t.headingSizes.h2, 36);
    var h3Px = parseSizePx(t.headingSizes.h3, 24);
    var spacingPx = parseSpacingPx(s.spacing);

    var h1Mobile = Math.round(h1Px * 0.65);
    var h2Mobile = Math.round(h2Px * 0.7);
    var h3Mobile = Math.round(h3Px * 0.8);

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
      '  --spacing: ' + spacingPx + 'px;\n' +
      '  --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '  --content-width: 760px;\n' +
      '  --wide-width: 1080px;\n' +
      '}\n\n' +

      // ============ RESET & BASE ============
      '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n\n' +
      'html { scroll-behavior: smooth; }\n' +
      'body {\n  font-family: var(--font-body);\n  font-size: ' + baseSizePx + 'px;\n' +
      '  line-height: ' + t.lineHeight + ';\n  color: var(--text);\n  background: var(--bg);\n' +
      '  -webkit-font-smoothing: antialiased;\n}\n\n' +
      '#root { width: 100%; min-height: 100vh; }\n' +
      'img[alt]::after { content: attr(alt); display: block; padding: var(--spacing); text-align: center; color: var(--text-muted); font-size: 13px; }\n' +
      'img { max-width: 100%; }\n\n' +

      // ============ TYPOGRAPHY ============
      'h1, h2, h3 {\n  font-family: var(--font-heading);\n  font-weight: ' + t.headingWeight + ';\n  line-height: 1.2;\n  letter-spacing: -0.02em;\n}\n' +
      'h1 { font-size: ' + h1Mobile + 'px; margin-bottom: calc(var(--spacing) * 2); }\n' +
      'h2 { font-size: ' + h2Mobile + 'px; margin-bottom: calc(var(--spacing) * 1.5); }\n' +
      'h3 { font-size: ' + h3Mobile + 'px; margin-bottom: var(--spacing); }\n' +
      'p { margin-bottom: var(--spacing); max-width: 680px; }\n\n' +

      // ============ DEEP SCROLL LAYOUT ============
      '.course-scroll {\n  width: 100%;\n}\n\n' +

      // ============ SECTIONS ============
      '.section {\n  position: relative;\n  padding: calc(var(--spacing) * 4) calc(var(--spacing) * 2);\n}\n' +
      '.section-inner {\n  max-width: var(--content-width);\n  margin: 0 auto;\n}\n\n' +

      // Alternating section backgrounds (exclude hero and results which have their own backgrounds)
      '.section:nth-child(even):not(.section-hero):not(.section-results) {\n  background: var(--surface);\n}\n\n' +

      // Section divider
      '.section-divider {\n  width: 60px; height: 3px;\n  background: var(--primary);\n  margin: 0 auto calc(var(--spacing) * 3);\n  border-radius: 2px;\n}\n\n' +

      // ============ PROGRESS BAR (sticky top) ============
      '.progress-bar {\n  position: fixed; top: 0; left: 0; right: 0;\n  height: 4px; background: ' + b.primary + '22;\n  z-index: 1000;\n}\n' +
      '.progress-fill {\n  height: 100%; background: var(--primary);\n  transition: width 0.15s ease;\n}\n\n' +

      // ============ HERO SECTION (full viewport) ============
      '.section-hero {\n  min-height: 100vh;\n  display: flex; align-items: center; justify-content: center;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  color: white; text-align: center;\n  padding: 0; position: relative; overflow: hidden;\n}\n' +
      '.section-hero::before {\n  content: \'\'; position: absolute; inset: 0;\n' +
      '  background: radial-gradient(circle at 30% 70%, rgba(255,255,255,0.1) 0%, transparent 60%);\n}\n' +
      '.section-hero .section-inner { position: relative; z-index: 2; max-width: 720px; padding: calc(var(--spacing) * 2); }\n' +
      '.section-hero h1 { font-size: ' + Math.round(h1Px * 0.85) + 'px; color: white; }\n' +
      '.section-hero .subtitle { font-size: ' + Math.round(baseSizePx * 1.1) + 'px; opacity: 0.85; margin-bottom: calc(var(--spacing) * 3); }\n' +
      '.section-hero .btn { background: white; color: var(--primary); font-weight: 700; }\n' +
      '.section-hero .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }\n\n' +

      // Hero with background image
      '.hero-bg {\n  background-size: cover; background-position: center;\n}\n' +
      '.hero-bg::after {\n  content: \'\'; position: absolute; inset: 0;\n' +
      '  background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.7));\n}\n\n' +

      // ============ SCROLL INDICATOR ============
      '.scroll-indicator {\n  margin-top: calc(var(--spacing) * 4);\n' +
      '  color: rgba(255,255,255,0.6); font-size: 13px;\n  display: flex; flex-direction: column; align-items: center; gap: 8px;\n' +
      '  animation: bounce 2s infinite;\n}\n' +
      '@keyframes bounce {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(8px); }\n}\n\n' +

      // ============ CONTENT BLOCKS ============
      '.content-block {\n  margin-bottom: calc(var(--spacing) * 3);\n}\n' +
      '.content-block:last-child { margin-bottom: 0; }\n\n' +

      // Narrative text flow
      '.narrative-text {\n  max-width: 680px;\n}\n' +
      '.narrative-text p {\n  font-size: ' + Math.round(baseSizePx * 1.05) + 'px;\n  line-height: 1.8;\n  color: var(--text);\n}\n\n' +

      // Callout box
      '.callout {\n  padding: calc(var(--spacing) * 2);\n  border-left: 4px solid var(--primary);\n' +
      '  background: ' + b.primary + '08;\n  border-radius: 0 var(--radius) var(--radius) 0;\n' +
      '  margin: calc(var(--spacing) * 2) 0;\n  font-style: italic;\n  color: var(--text-muted);\n}\n\n' +

      // ============ BUTTONS ============
      '.btn {\n  display: inline-flex; align-items: center; justify-content: center; gap: 8px;\n' +
      '  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 3);\n' +
      '  border: none; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: ' + baseSizePx + 'px; font-weight: 600;\n' +
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
      '  width: 100%; max-width: var(--content-width);\n  ' + shadow + '\n  transition: all var(--transition);\n}\n\n' +

      // ============ MEDIA ============
      '.hero-image {\n  width: 100%; border-radius: var(--radius);\n' +
      '  overflow: hidden; margin-bottom: calc(var(--spacing) * 2);\n  ' + shadow + '\n}\n' +
      '.hero-image img { width: 100%; height: auto; display: block; }\n' +
      '.hero-image img[src=""], .hero-image img:not([src]) { display: none; }\n\n' +

      '/* Background image slides: original SCORM background with overlay */\n' +
      '.has-bg-image {\n  position: relative; border-radius: var(--radius);\n' +
      '  min-height: 300px; padding: calc(var(--spacing) * 3);\n' +
      '  color: white;\n}\n' +
      '.has-bg-image h2, .has-bg-image h3, .has-bg-image p { color: white; position: relative; z-index: 2; }\n' +
      '.has-bg-image .narrative-text { position: relative; z-index: 2; }\n' +
      '.bg-overlay {\n  position: absolute; inset: 0; border-radius: inherit;\n' +
      '  background: linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%);\n' +
      '  z-index: 1;\n}\n\n' +

      '.media-feature {\n  width: 100%; max-width: var(--wide-width);\n  margin: 0 auto;\n}\n\n' +

      '.video-container {\n  width: 100%; border-radius: var(--radius);\n' +
      '  overflow: hidden; margin-bottom: calc(var(--spacing) * 2);\n  ' + shadow + '\n}\n' +
      '.video-container video { width: 100%; height: auto; display: block; background: #000; }\n\n' +

      '.audio-container {\n  width: 100%;\n  margin-bottom: calc(var(--spacing) * 2);\n}\n' +
      '.audio-container audio { width: 100%; border-radius: var(--radius); }\n\n' +

      // ============ FORMS ============
      '.form-group { margin-bottom: calc(var(--spacing) * 2); width: 100%; }\n' +
      '.form-group label {\n  display: block; font-weight: 600; margin-bottom: calc(var(--spacing) * 0.5);\n  color: var(--text);\n}\n' +
      '.form-group input, .form-group textarea {\n  width: 100%; padding: calc(var(--spacing) * 1.5);\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: ' + baseSizePx + 'px;\n' +
      '  transition: border-color var(--transition);\n  background: var(--bg); color: var(--text);\n}\n' +
      '.form-group input:focus, .form-group textarea:focus {\n  outline: none; border-color: var(--primary);\n' +
      '  box-shadow: 0 0 0 3px ' + b.primary + '22;\n}\n\n' +

      // ============ ACCORDION ============
      '.accordion {\n  width: 100%; max-width: var(--content-width);\n}\n' +
      '.accordion-item {\n  border: 1px solid ' + border + ';\n  border-radius: var(--radius);\n' +
      '  margin-bottom: var(--spacing);\n  overflow: hidden;\n  transition: all var(--transition);\n}\n' +
      '.accordion-item.open {\n  border-color: var(--primary);\n  ' + shadow + '\n}\n' +
      '.accordion-trigger {\n  width: 100%; display: flex; justify-content: space-between; align-items: center;\n' +
      '  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2);\n' +
      '  background: var(--surface); border: none; cursor: pointer;\n' +
      '  font-family: var(--font-heading); font-size: ' + Math.round(baseSizePx * 1.05) + 'px;\n' +
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
      '.modal-triggers {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: var(--spacing);\n  width: 100%; max-width: var(--content-width);\n}\n' +
      '.modal-trigger-tile {\n  display: flex; align-items: center;\n' +
      '  border: 1px solid ' + border + '; border-radius: var(--radius);\n' +
      '  overflow: hidden; cursor: pointer;\n  background: var(--surface); transition: all var(--transition);\n' +
      '  -webkit-tap-highlight-color: transparent;\n}\n' +
      '.modal-trigger-tile:hover {\n  border-color: var(--primary);\n  transform: translateY(-2px);\n  ' + shadow + '\n}\n' +
      '.tile-thumb {\n  width: 80px; height: 80px; flex-shrink: 0; overflow: hidden;\n}\n' +
      '.tile-thumb img { width: 100%; height: 100%; object-fit: cover; }\n' +
      '.tile-label {\n  flex: 1; display: flex; justify-content: space-between; align-items: center;\n' +
      '  padding: var(--spacing) calc(var(--spacing) * 1.5);\n' +
      '  font-weight: 600; font-size: ' + Math.round(baseSizePx * 0.95) + 'px;\n}\n' +
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
      '.bento-grid {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: var(--spacing);\n  width: 100%; max-width: var(--content-width);\n}\n' +
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
      '.branch-container { text-align: center; width: 100%; max-width: var(--content-width); margin: 0 auto; }\n' +
      '.greeting { font-size: ' + Math.round(baseSizePx * 1.1) + 'px; margin-bottom: calc(var(--spacing) * 2); }\n' +
      '.branch-grid {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: calc(var(--spacing) * 1.5);\n  margin-top: calc(var(--spacing) * 2);\n}\n' +
      '.branch-option {\n  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  cursor: pointer; transition: all var(--transition);\n  text-align: center;\n' +
      '  background: var(--surface);\n  ' + shadow + '\n' +
      '  -webkit-tap-highlight-color: transparent;\n}\n' +
      '.branch-option:hover {\n  border-color: var(--primary); transform: translateY(-3px);\n  box-shadow: 0 12px 30px rgba(0,0,0,0.12);\n}\n' +
      '.branch-option h3 { color: var(--primary); margin-bottom: 0; }\n\n' +

      // ============ QUIZ ============
      '.quiz-section {\n  min-height: 80vh;\n  display: flex; align-items: center; justify-content: center;\n' +
      '  padding: calc(var(--spacing) * 4) calc(var(--spacing) * 2);\n}\n' +
      '.quiz-container { text-align: center; width: 100%; max-width: var(--content-width); }\n' +
      '.quiz-counter { color: var(--text-muted); margin-bottom: var(--spacing); }\n' +
      '.quiz-question {\n  font-family: var(--font-heading); font-size: ' + h3Mobile + 'px;\n' +
      '  font-weight: ' + t.headingWeight + '; margin-bottom: calc(var(--spacing) * 2);\n  text-align: center; max-width: 680px; margin-left: auto; margin-right: auto;\n}\n' +
      '.quiz-choices { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: var(--spacing); margin: 0 auto; }\n' +
      '.quiz-choice {\n  display: flex; align-items: center; gap: calc(var(--spacing) * 1.5);\n' +
      '  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2);\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  cursor: pointer; transition: all var(--transition);\n  background: var(--surface); font-size: ' + baseSizePx + 'px;\n' +
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
      '  border-radius: var(--radius); text-align: center; font-weight: 600;\n}\n' +
      '.quiz-feedback.correct { background: ' + b.success + '15; color: var(--success); }\n' +
      '.quiz-feedback.incorrect { background: ' + b.error + '15; color: var(--error); }\n\n' +
      '.quiz-text-entry { width: 100%; max-width: 560px; margin: var(--spacing) auto; }\n' +
      '.quiz-text-entry input, .quiz-text-entry textarea {\n  width: 100%; padding: calc(var(--spacing) * 1.5);\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: ' + baseSizePx + 'px;\n' +
      '  background: var(--bg); color: var(--text);\n  transition: border-color var(--transition);\n}\n' +
      '.quiz-text-entry input:focus, .quiz-text-entry textarea:focus {\n  outline: none; border-color: var(--primary);\n' +
      '  box-shadow: 0 0 0 3px ' + b.primary + '22;\n}\n\n' +

      // ============ RESULTS ============
      '.section-results {\n  min-height: 80vh;\n  display: flex; align-items: center; justify-content: center;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n  color: white; text-align: center;\n}\n' +
      '.section-results .section-inner { max-width: 500px; }\n' +
      '.section-results h1, .section-results h2, .section-results h3, .section-results p { color: white; }\n' +
      '.score-circle {\n  width: 120px; height: 120px; border-radius: 50%;\n  border: 6px solid rgba(255,255,255,0.3);\n' +
      '  display: flex; align-items: center; justify-content: center; flex-direction: column;\n' +
      '  margin: calc(var(--spacing) * 2) auto;\n  animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);\n}\n' +
      '.score-circle .score-value { font-size: 36px; font-weight: ' + t.headingWeight + '; font-family: var(--font-heading); }\n' +
      '.score-circle .score-label { font-size: 13px; opacity: 0.8; }\n' +
      '.results-msg { color: rgba(255,255,255,0.85); margin-top: calc(var(--spacing) * 2); }\n' +
      '.btn-restart { margin-top: calc(var(--spacing) * 2); background: white; color: var(--primary); border: none; font-weight: 700; }\n\n' +
      '@keyframes scaleIn {\n  from { transform: scale(0); opacity: 0; }\n  to { transform: scale(1); opacity: 1; }\n}\n\n' +

      // ============ SCROLL ANIMATIONS ============
      '.scroll-reveal {\n  opacity: 0; transform: translateY(20px);\n}\n' +
      '.scroll-reveal.visible {\n  opacity: 1; transform: translateY(0);\n  transition: opacity 0.6s ease, transform 0.6s ease;\n}\n\n' +

      // ============ SECTION TABLE OF CONTENTS ============
      '.toc {\n  position: fixed; right: calc(var(--spacing) * 2); top: 50%;\n  transform: translateY(-50%); z-index: 500;\n  display: none;\n}\n' +
      '.toc-dot {\n  width: 10px; height: 10px; border-radius: 50%;\n  background: ' + border + '; margin-bottom: 8px;\n' +
      '  cursor: pointer; transition: all var(--transition);\n}\n' +
      '.toc-dot.active { background: var(--primary); transform: scale(1.4); }\n' +
      '.toc-dot:hover { background: var(--primary); }\n\n' +

      // ============ SECTION LOCKING ============
      '.section-locked {\n  position: relative;\n  pointer-events: none;\n  user-select: none;\n}\n' +
      '.section-locked .section-inner {\n  filter: blur(4px); opacity: 0.4;\n  transition: filter 0.4s ease, opacity 0.4s ease;\n}\n' +
      '.lock-overlay {\n  position: absolute; inset: 0; z-index: 10;\n' +
      '  display: flex; flex-direction: column; align-items: center; justify-content: center;\n' +
      '  pointer-events: auto;\n}\n' +
      '.lock-icon {\n  font-size: 48px; margin-bottom: var(--spacing);\n}\n' +
      '.lock-overlay p {\n  color: var(--text-muted); font-size: 14px;\n  max-width: 300px; text-align: center;\n}\n\n' +

      // ============ DESKTOP (>=768px) ============
      '@media (min-width: 768px) {\n' +
      '  .section { padding: calc(var(--spacing) * 8) calc(var(--spacing) * 4); }\n' +
      '  h1 { font-size: ' + h1Px + 'px; }\n' +
      '  h2 { font-size: ' + h2Px + 'px; }\n' +
      '  h3 { font-size: ' + h3Px + 'px; }\n' +
      '  .section-hero h1 { font-size: ' + Math.round(h1Px * 1.3) + 'px; }\n' +
      '  .card { padding: calc(var(--spacing) * 3); }\n' +
      '  .btn { padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 4); min-width: 140px; }\n' +
      '  .score-circle { width: 160px; height: 160px; }\n' +
      '  .score-circle .score-value { font-size: 48px; }\n' +
      '  .quiz-question { font-size: ' + h3Px + 'px; }\n' +
      '  .bento-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }\n' +
      '  .branch-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }\n' +
      '  .modal-triggers { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }\n' +
      '  .tile-thumb { width: 100px; height: 100px; }\n' +
      '  .modal-content { padding: calc(var(--spacing) * 3); }\n' +
      '  .toc { display: flex; flex-direction: column; align-items: center; }\n' +
      '}\n\n' +

      // ============ LARGE DESKTOP (>=1200px) ============
      '@media (min-width: 1200px) {\n' +
      '  .section-inner { max-width: var(--wide-width); }\n' +
      '  .narrative-text { max-width: 760px; }\n' +
      '}\n'
    );
  }

  return { generateCss: generateCss };
})();
