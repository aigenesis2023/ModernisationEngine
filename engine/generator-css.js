/**
 * CSS Generator — Produces brand-dynamic, mobile-first CSS for deep-scroll layout.
 * Designed for a continuous scrolling experience with distinct section styles.
 * Clean, modern aesthetic inspired by Notion/Linear documentation pages.
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
          ';\n  color: white; border: none;\n}\n.btn-primary:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 4px 15px ' + b.primary + '44; }';
      case 'outline':
        return '.btn-primary {\n  background: transparent; color: var(--primary);\n  border: 2px solid var(--primary);\n}\n.btn-primary:hover { background: var(--primary); color: white; }';
      default:
        return '.btn-primary {\n  background: var(--primary); color: white; border: none;\n}\n.btn-primary:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 4px 15px ' + b.primary + '44; }';
    }
  }

  function cardShadow(brand) {
    var dark = isDarkTheme(brand);
    switch (brand.style.cardStyle) {
      case 'elevated':
        return dark ? 'box-shadow: 0 2px 12px rgba(0,0,0,0.25);' : 'box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04);';
      case 'glass':
        return dark
          ? 'backdrop-filter: blur(10px); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 2px 12px rgba(0,0,0,0.2);'
          : 'backdrop-filter: blur(10px); background: rgba(255,255,255,0.8); box-shadow: 0 1px 3px rgba(0,0,0,0.06);';
      case 'outlined':
        return dark ? 'border: 1px solid rgba(255,255,255,0.12);' : 'border: 1px solid rgba(0,0,0,0.08);';
      default:
        return dark ? 'box-shadow: 0 2px 12px rgba(0,0,0,0.25);' : 'box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04);';
    }
  }

  function generateCss(brand) {
    var b = brand.colors;
    var t = brand.typography;
    var s = brand.style;
    var dark = isDarkTheme(brand);
    var border = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
    var borderLight = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    var shadow = cardShadow(brand);
    var btnCss = buttonCss(brand);
    var surfaceAlt = dark ? 'rgba(255,255,255,0.03)' : '#f8f9fa';

    return (
      // ============ CSS VARIABLES ============
      ':root {\n' +
      '  --primary: ' + b.primary + ';\n' +
      '  --secondary: ' + b.secondary + ';\n' +
      '  --accent: ' + b.accent + ';\n' +
      '  --bg: ' + b.background + ';\n' +
      '  --surface: ' + b.surface + ';\n' +
      '  --surface-alt: ' + surfaceAlt + ';\n' +
      '  --text: ' + b.text + ';\n' +
      '  --text-muted: ' + b.textMuted + ';\n' +
      '  --success: ' + b.success + ';\n' +
      '  --error: ' + b.error + ';\n' +
      '  --warning: ' + b.warning + ';\n' +
      '  --radius: ' + s.borderRadius + ';\n' +
      '  --font-heading: \'' + t.headingFont + '\', system-ui, sans-serif;\n' +
      '  --font-body: \'' + t.bodyFont + '\', system-ui, sans-serif;\n' +
      '  --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '  --content-width: 800px;\n' +
      '  --wide-width: 1080px;\n' +
      '}\n\n' +

      // ============ RESET & BASE ============
      '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n\n' +
      'html { scroll-behavior: smooth; }\n' +
      'body {\n' +
      '  font-family: var(--font-body);\n' +
      '  font-size: 16px;\n' +
      '  line-height: 1.7;\n' +
      '  color: var(--text);\n' +
      '  background: var(--bg);\n' +
      '  -webkit-font-smoothing: antialiased;\n' +
      '  -moz-osx-font-smoothing: grayscale;\n' +
      '}\n\n' +
      '#root { width: 100%; min-height: 100vh; }\n' +
      'img { max-width: 100%; height: auto; display: block; }\n' +
      'img[src=""], img:not([src]) { display: none; }\n\n' +

      // ============ TYPOGRAPHY ============
      'h1, h2, h3 {\n' +
      '  font-family: var(--font-heading);\n' +
      '  font-weight: ' + t.headingWeight + ';\n' +
      '  line-height: 1.2;\n' +
      '  letter-spacing: -0.025em;\n' +
      '  color: var(--text);\n' +
      '}\n' +
      'h1 { font-size: 2rem; margin-bottom: 1.5rem; }\n' +
      'h2 { font-size: 1.5rem; margin-bottom: 1.25rem; }\n' +
      'h3 { font-size: 1.125rem; margin-bottom: 1rem; }\n' +
      'p { margin-bottom: 1rem; line-height: 1.7; color: var(--text); max-width: 680px; }\n' +
      'p:last-child { margin-bottom: 0; }\n\n' +

      // ============ DEEP SCROLL LAYOUT ============
      '.course-scroll { width: 100%; }\n\n' +

      // ============ PROGRESS BAR ============
      '.progress-bar {\n' +
      '  position: fixed; top: 0; left: 0; right: 0;\n' +
      '  height: 4px; background: ' + b.primary + '15;\n' +
      '  z-index: 1000;\n' +
      '}\n' +
      '.progress-fill {\n' +
      '  height: 100%; background: var(--primary);\n' +
      '  transition: width 0.15s ease;\n' +
      '  border-radius: 0 2px 2px 0;\n' +
      '}\n\n' +

      // ============ SECTIONS ============
      '.section {\n' +
      '  position: relative;\n' +
      '  padding: 3rem 1.5rem;\n' +
      '}\n' +
      '.section-inner {\n' +
      '  max-width: var(--content-width);\n' +
      '  margin: 0 auto;\n' +
      '}\n\n' +

      // Section title
      '.section-title {\n' +
      '  font-size: 1.75rem;\n' +
      '  font-weight: ' + t.headingWeight + ';\n' +
      '  margin-bottom: 2.5rem;\n' +
      '  padding-bottom: 1rem;\n' +
      '  border-bottom: 2px solid var(--primary);\n' +
      '  display: inline-block;\n' +
      '}\n\n' +

      // Alternating backgrounds — skip hero and results
      '.section:nth-child(even):not(.section-hero):not(.section-results) {\n' +
      '  background: var(--surface-alt);\n' +
      '}\n\n' +

      // ============ HERO SECTION ============
      '.section-hero {\n' +
      '  min-height: 100vh;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  color: white; text-align: center;\n' +
      '  padding: 0; position: relative; overflow: hidden;\n' +
      '}\n' +
      '.section-hero::before {\n' +
      '  content: ""; position: absolute; inset: 0;\n' +
      '  background: radial-gradient(circle at 30% 70%, rgba(255,255,255,0.08) 0%, transparent 60%);\n' +
      '}\n' +
      '.section-hero .section-inner {\n' +
      '  position: relative; z-index: 2;\n' +
      '  max-width: 720px; padding: 2rem;\n' +
      '}\n' +
      '.section-hero h1 {\n' +
      '  font-size: 2.5rem; color: white;\n' +
      '  letter-spacing: -0.03em;\n' +
      '}\n' +
      '.section-hero .subtitle {\n' +
      '  font-size: 1.125rem; opacity: 0.85;\n' +
      '  margin-bottom: 2.5rem; color: white;\n' +
      '  max-width: 560px; margin-left: auto; margin-right: auto;\n' +
      '}\n' +
      '.section-hero .btn {\n' +
      '  background: white; color: var(--primary); font-weight: 700;\n' +
      '}\n' +
      '.section-hero .btn:hover {\n' +
      '  transform: translateY(-2px);\n' +
      '  box-shadow: 0 8px 25px rgba(0,0,0,0.2);\n' +
      '}\n\n' +

      // Hero with background image
      '.hero-bg {\n  background-size: cover; background-position: center;\n}\n' +
      '.hero-bg::after {\n' +
      '  content: ""; position: absolute; inset: 0;\n' +
      '  background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.65));\n' +
      '}\n\n' +

      // ============ SCROLL INDICATOR ============
      '.scroll-indicator {\n' +
      '  margin-top: 3rem;\n' +
      '  color: rgba(255,255,255,0.6); font-size: 13px;\n' +
      '  display: flex; flex-direction: column; align-items: center; gap: 8px;\n' +
      '  animation: bounce 2s infinite;\n' +
      '}\n' +
      '@keyframes bounce {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(8px); }\n}\n\n' +

      // ============ CONTENT BLOCKS ============
      '.content-block {\n' +
      '  margin-bottom: 2rem;\n' +
      '  padding-bottom: 2rem;\n' +
      '  border-bottom: 1px solid ' + borderLight + ';\n' +
      '}\n' +
      '.content-block:last-child {\n' +
      '  margin-bottom: 0; padding-bottom: 0; border-bottom: none;\n' +
      '}\n\n' +

      // Slide divider between content blocks within sections
      '.slide-divider {\n' +
      '  width: 40px; height: 2px;\n' +
      '  background: ' + border + ';\n' +
      '  margin: 0 0 2rem 0;\n' +
      '}\n\n' +

      // Narrative text
      '.narrative-text {\n  max-width: 680px;\n}\n' +
      '.narrative-text p {\n' +
      '  font-size: 1rem;\n' +
      '  line-height: 1.8;\n' +
      '  color: var(--text);\n' +
      '}\n\n' +

      // Callout
      '.callout {\n' +
      '  padding: 1.25rem 1.5rem;\n' +
      '  border-left: 3px solid var(--primary);\n' +
      '  background: ' + b.primary + '08;\n' +
      '  border-radius: 0 var(--radius) var(--radius) 0;\n' +
      '  margin: 1.5rem 0;\n' +
      '  font-style: italic;\n' +
      '  color: var(--text-muted);\n' +
      '  line-height: 1.7;\n' +
      '}\n\n' +

      // ============ BACKGROUND IMAGE SLIDES ============
      '.has-bg-image {\n' +
      '  position: relative; border-radius: var(--radius);\n' +
      '  min-height: 300px; padding: 2.5rem;\n' +
      '  color: white; overflow: hidden;\n' +
      '}\n' +
      '.has-bg-image h2, .has-bg-image h3, .has-bg-image p { color: white; position: relative; z-index: 2; }\n' +
      '.has-bg-image .narrative-text { position: relative; z-index: 2; }\n' +
      '.bg-overlay {\n' +
      '  position: absolute; inset: 0; border-radius: inherit;\n' +
      '  background: linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 100%);\n' +
      '  z-index: 1;\n' +
      '}\n\n' +

      // ============ BUTTONS ============
      '.btn {\n' +
      '  display: inline-flex; align-items: center; justify-content: center; gap: 8px;\n' +
      '  padding: 0.75rem 2rem;\n' +
      '  border: none; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: 0.95rem; font-weight: 600;\n' +
      '  cursor: pointer; transition: all var(--transition);\n' +
      '  text-decoration: none; min-width: 120px;\n' +
      '  -webkit-tap-highlight-color: transparent;\n' +
      '}\n' +
      '.btn:active { transform: scale(0.97); }\n' +
      btnCss + '\n\n' +
      '.btn-secondary {\n  background: transparent; color: var(--primary);\n  border: 2px solid var(--primary);\n}\n' +
      '.btn-secondary:hover { background: var(--primary); color: white; }\n\n' +
      '.actions { margin-top: 1.5rem; text-align: center; }\n\n' +

      // ============ CARD ============
      '.card {\n' +
      '  background: var(--surface);\n' +
      '  border-radius: var(--radius);\n' +
      '  padding: 2rem;\n' +
      '  width: 100%; max-width: var(--content-width);\n' +
      '  ' + shadow + '\n' +
      '  transition: all var(--transition);\n' +
      '}\n\n' +

      // ============ MEDIA ============
      '.hero-image {\n' +
      '  width: 100%; border-radius: var(--radius);\n' +
      '  overflow: hidden; margin: 1.5rem 0;\n' +
      '  ' + shadow + '\n' +
      '}\n' +
      '.hero-image img { width: 100%; height: auto; display: block; }\n\n' +

      '.media-feature { width: 100%; max-width: var(--wide-width); margin: 0 auto; }\n\n' +

      '.video-container {\n' +
      '  width: 100%; border-radius: var(--radius);\n' +
      '  overflow: hidden; margin: 1.5rem 0;\n' +
      '  ' + shadow + '\n' +
      '}\n' +
      '.video-container video { width: 100%; height: auto; display: block; background: #000; }\n\n' +

      '.audio-container { width: 100%; margin: 1rem 0; }\n' +
      '.audio-container audio { width: 100%; border-radius: var(--radius); }\n\n' +

      // ============ FORMS ============
      '.form-group { margin-bottom: 1.5rem; width: 100%; }\n' +
      '.form-group label {\n' +
      '  display: block; font-weight: 600; margin-bottom: 0.5rem;\n' +
      '  color: var(--text); font-size: 0.9rem;\n' +
      '}\n' +
      '.form-group input, .form-group textarea {\n' +
      '  width: 100%; padding: 0.75rem 1rem;\n' +
      '  border: 1.5px solid ' + border + '; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: 1rem;\n' +
      '  transition: border-color var(--transition), box-shadow var(--transition);\n' +
      '  background: var(--bg); color: var(--text);\n' +
      '}\n' +
      '.form-group input:focus, .form-group textarea:focus {\n' +
      '  outline: none; border-color: var(--primary);\n' +
      '  box-shadow: 0 0 0 3px ' + b.primary + '18;\n' +
      '}\n\n' +

      // ============ ACCORDION ============
      '.accordion { width: 100%; max-width: var(--content-width); }\n' +
      '.accordion-item {\n' +
      '  border: 1px solid ' + border + ';\n' +
      '  border-radius: var(--radius);\n' +
      '  margin-bottom: 0.75rem;\n' +
      '  overflow: hidden;\n' +
      '  transition: border-color var(--transition), box-shadow var(--transition);\n' +
      '}\n' +
      '.accordion-item.open {\n' +
      '  border-color: var(--primary);\n' +
      '  ' + shadow + '\n' +
      '}\n' +
      '.accordion-trigger {\n' +
      '  width: 100%; display: flex; justify-content: space-between; align-items: center;\n' +
      '  padding: 1rem 1.25rem;\n' +
      '  background: var(--surface); border: none; cursor: pointer;\n' +
      '  font-family: var(--font-heading); font-size: 0.95rem;\n' +
      '  font-weight: 600; color: var(--text); text-align: left;\n' +
      '  transition: color var(--transition);\n' +
      '  -webkit-tap-highlight-color: transparent;\n' +
      '}\n' +
      '.accordion-trigger:hover { color: var(--primary); }\n' +
      '.accordion-item.open .accordion-trigger { color: var(--primary); }\n' +
      '.accordion-icon {\n' +
      '  font-size: 18px; font-weight: 300;\n' +
      '  transition: transform var(--transition);\n' +
      '  flex-shrink: 0; margin-left: 1rem;\n' +
      '}\n' +
      '.accordion-item.open .accordion-icon { transform: rotate(45deg); }\n' +
      // Accordion panel with CSS max-height transition
      '.accordion-panel {\n' +
      '  max-height: 0;\n' +
      '  overflow: hidden;\n' +
      '  transition: max-height 0.3s ease-out;\n' +
      '  background: var(--bg);\n' +
      '}\n' +
      '.accordion-item.open .accordion-panel {\n' +
      '  max-height: 2000px;\n' +
      '  transition: max-height 0.5s ease-in;\n' +
      '}\n' +
      '.accordion-panel-inner {\n' +
      '  padding: 1.25rem;\n' +
      '  border-top: 1px solid ' + borderLight + ';\n' +
      '}\n\n' +

      // ============ MODAL ============
      '.modal-triggers {\n' +
      '  display: grid; grid-template-columns: 1fr;\n' +
      '  gap: 0.75rem; width: 100%; max-width: var(--content-width);\n' +
      '}\n' +
      '.modal-trigger-tile {\n' +
      '  display: flex; align-items: center;\n' +
      '  border: 1px solid ' + border + '; border-radius: var(--radius);\n' +
      '  overflow: hidden; cursor: pointer;\n' +
      '  background: var(--surface); transition: all var(--transition);\n' +
      '  -webkit-tap-highlight-color: transparent;\n' +
      '}\n' +
      '.modal-trigger-tile:hover {\n' +
      '  border-color: var(--primary); transform: translateY(-2px);\n' +
      '  ' + shadow + '\n' +
      '}\n' +
      '.tile-thumb { width: 72px; height: 72px; flex-shrink: 0; overflow: hidden; }\n' +
      '.tile-thumb img { width: 100%; height: 100%; object-fit: cover; }\n' +
      '.tile-label {\n' +
      '  flex: 1; display: flex; justify-content: space-between; align-items: center;\n' +
      '  padding: 0.75rem 1rem;\n' +
      '  font-weight: 600; font-size: 0.9rem;\n' +
      '}\n' +
      '.tile-arrow { color: var(--primary); font-size: 16px; }\n\n' +

      '.modal-overlay {\n' +
      '  position: fixed; inset: 0; z-index: 1000;\n' +
      '  background: rgba(0,0,0,0.5);\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  padding: 1.5rem;\n' +
      '  animation: fadeIn 0.2s ease-out;\n' +
      '}\n' +
      '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }\n' +
      '.modal-content {\n' +
      '  background: var(--surface); border-radius: var(--radius);\n' +
      '  width: 100%; max-width: 600px; max-height: 85vh;\n' +
      '  overflow-y: auto; padding: 2rem;\n' +
      '  position: relative;\n' +
      '  animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);\n' +
      '  ' + shadow + '\n' +
      '}\n' +
      '@keyframes modalIn {\n  from { opacity: 0; transform: scale(0.95) translateY(10px); }\n  to { opacity: 1; transform: scale(1) translateY(0); }\n}\n' +
      '.modal-close {\n' +
      '  position: sticky; top: 0; float: right;\n' +
      '  width: 32px; height: 32px; border-radius: 50%;\n' +
      '  border: none; background: ' + (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') + ';\n' +
      '  cursor: pointer; font-size: 16px; color: var(--text-muted);\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  transition: all var(--transition); z-index: 1;\n' +
      '}\n' +
      '.modal-close:hover { background: var(--primary); color: white; }\n' +
      '.modal-image {\n' +
      '  width: 100%; border-radius: var(--radius);\n' +
      '  overflow: hidden; margin-bottom: 1.5rem;\n' +
      '}\n' +
      '.modal-image img { width: 100%; height: auto; display: block; }\n\n' +

      // ============ BENTO GRID ============
      '.bento-grid {\n' +
      '  display: grid; grid-template-columns: 1fr;\n' +
      '  gap: 1rem; width: 100%; max-width: var(--content-width);\n' +
      '}\n' +
      '.bento-tile {\n' +
      '  background: var(--surface); border-radius: var(--radius);\n' +
      '  padding: 1.5rem;\n' +
      '  border: 1px solid ' + border + ';\n' +
      '  transition: all var(--transition);\n' +
      '}\n' +
      '.bento-tile:hover { border-color: var(--primary); transform: translateY(-2px); ' + shadow + ' }\n' +
      '.bento-tile h3 { color: var(--primary); font-size: 1rem; }\n' +
      '.bento-image {\n' +
      '  width: 100%; border-radius: calc(var(--radius) * 0.6);\n' +
      '  overflow: hidden; margin-bottom: 0.75rem;\n' +
      '}\n' +
      '.bento-image img { width: 100%; height: auto; display: block; }\n\n' +

      // ============ BRANCHING ============
      '.branch-container { text-align: center; width: 100%; max-width: var(--content-width); margin: 0 auto; }\n' +
      '.greeting { font-size: 1.1rem; margin-bottom: 1.5rem; }\n' +
      '.branch-grid {\n' +
      '  display: grid; grid-template-columns: 1fr;\n' +
      '  gap: 1rem; margin-top: 1.5rem;\n' +
      '}\n' +
      '.branch-option {\n' +
      '  padding: 1.5rem 2rem;\n' +
      '  border: 1.5px solid ' + border + '; border-radius: var(--radius);\n' +
      '  cursor: pointer; transition: all var(--transition);\n' +
      '  text-align: center; background: var(--surface);\n' +
      '  -webkit-tap-highlight-color: transparent;\n' +
      '}\n' +
      '.branch-option:hover {\n' +
      '  border-color: var(--primary); transform: translateY(-2px);\n' +
      '  ' + shadow + '\n' +
      '}\n' +
      '.branch-option h3 { color: var(--primary); margin-bottom: 0; font-size: 1rem; }\n\n' +

      // ============ QUIZ ============
      '.quiz-section {\n' +
      '  min-height: 100vh;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  padding: 3rem 1.5rem;\n' +
      '}\n' +
      '.quiz-container { text-align: center; width: 100%; max-width: var(--content-width); }\n' +
      '.quiz-counter { color: var(--text-muted); margin-bottom: 0.75rem; font-size: 0.85rem; letter-spacing: 0.05em; text-transform: uppercase; }\n' +
      '.quiz-question {\n' +
      '  font-family: var(--font-heading); font-size: 1.25rem;\n' +
      '  font-weight: ' + t.headingWeight + ';\n' +
      '  margin-bottom: 2rem; text-align: center;\n' +
      '  max-width: 640px; margin-left: auto; margin-right: auto;\n' +
      '  line-height: 1.4;\n' +
      '}\n' +
      '.quiz-choices { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 0.75rem; margin: 0 auto; }\n' +
      '.quiz-choice {\n' +
      '  display: flex; align-items: center; gap: 1rem;\n' +
      '  padding: 1rem 1.25rem;\n' +
      '  border: 1.5px solid ' + border + '; border-radius: var(--radius);\n' +
      '  cursor: pointer; transition: all var(--transition);\n' +
      '  background: var(--surface); font-size: 0.95rem;\n' +
      '  text-align: left; -webkit-tap-highlight-color: transparent;\n' +
      '}\n' +
      '.quiz-choice:hover { border-color: var(--primary); }\n' +
      '.quiz-choice.selected { border-color: var(--primary); background: ' + b.primary + '0a; }\n' +
      '.quiz-choice.correct { border-color: var(--success); background: ' + b.success + '0a; }\n' +
      '.quiz-choice.incorrect { border-color: var(--error); background: ' + b.error + '0a; }\n' +
      '.quiz-choice .indicator {\n' +
      '  width: 22px; height: 22px; border-radius: 50%;\n' +
      '  border: 2px solid ' + border + '; flex-shrink: 0;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  font-size: 12px; color: white;\n' +
      '  transition: all var(--transition);\n' +
      '}\n' +
      '.quiz-choice.selected .indicator { border-color: var(--primary); background: var(--primary); }\n' +
      '.quiz-choice.correct .indicator { border-color: var(--success); background: var(--success); }\n' +
      '.quiz-choice.incorrect .indicator { border-color: var(--error); background: var(--error); }\n' +
      '.quiz-choice .indicator.checkbox { border-radius: 4px; }\n' +
      '.quiz-choice.selected .indicator.checkbox { border-color: var(--primary); background: var(--primary); }\n' +
      '.quiz-feedback {\n' +
      '  margin-top: 1.5rem; padding: 1rem;\n' +
      '  border-radius: var(--radius); text-align: center; font-weight: 600;\n' +
      '  font-size: 0.9rem;\n' +
      '}\n' +
      '.quiz-feedback.correct { background: ' + b.success + '10; color: var(--success); }\n' +
      '.quiz-feedback.incorrect { background: ' + b.error + '10; color: var(--error); }\n\n' +
      '.quiz-text-entry { width: 100%; max-width: 560px; margin: 0.75rem auto; }\n' +
      '.quiz-text-entry input, .quiz-text-entry textarea {\n' +
      '  width: 100%; padding: 0.75rem 1rem;\n' +
      '  border: 1.5px solid ' + border + '; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: 1rem;\n' +
      '  background: var(--bg); color: var(--text);\n' +
      '  transition: border-color var(--transition);\n' +
      '}\n' +
      '.quiz-text-entry input:focus, .quiz-text-entry textarea:focus {\n' +
      '  outline: none; border-color: var(--primary);\n' +
      '  box-shadow: 0 0 0 3px ' + b.primary + '18;\n' +
      '}\n\n' +

      // ============ ASSESSMENT SECTION ============
      '.assessment-card {\n' +
      '  text-align: center; max-width: 480px; margin: 0 auto;\n' +
      '  padding: 3rem 2rem; border-radius: var(--radius);\n' +
      '  background: var(--surface); ' + shadow + '\n' +
      '}\n' +
      '.assessment-card h2 { margin-bottom: 1rem; }\n' +
      '.assessment-card p { margin: 0 auto 1.5rem; color: var(--text-muted); }\n\n' +

      // ============ RESULTS ============
      '.section-results {\n' +
      '  min-height: 80vh;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  color: white; text-align: center;\n' +
      '}\n' +
      '.section-results .section-inner { max-width: 480px; }\n' +
      '.section-results h1, .section-results h2, .section-results h3, .section-results p { color: white; }\n' +
      '.score-circle {\n' +
      '  width: 120px; height: 120px; border-radius: 50%;\n' +
      '  border: 4px solid rgba(255,255,255,0.3);\n' +
      '  display: flex; align-items: center; justify-content: center; flex-direction: column;\n' +
      '  margin: 1.5rem auto;\n' +
      '  animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);\n' +
      '}\n' +
      '.score-circle .score-value { font-size: 2.25rem; font-weight: ' + t.headingWeight + '; font-family: var(--font-heading); }\n' +
      '.score-circle .score-label { font-size: 0.8rem; opacity: 0.8; }\n' +
      '.results-msg { color: rgba(255,255,255,0.85); margin-top: 1.5rem; max-width: 400px; margin-left: auto; margin-right: auto; }\n' +
      '.btn-restart { margin-top: 1.5rem; background: white; color: var(--primary); border: none; font-weight: 700; }\n\n' +
      '@keyframes scaleIn {\n  from { transform: scale(0); opacity: 0; }\n  to { transform: scale(1); opacity: 1; }\n}\n\n' +

      // ============ SCROLL ANIMATIONS ============
      '.scroll-reveal {\n  opacity: 0; transform: translateY(16px);\n}\n' +
      '.scroll-reveal.visible {\n  opacity: 1; transform: translateY(0);\n  transition: opacity 0.5s ease, transform 0.5s ease;\n}\n\n' +

      // ============ DESKTOP (>=768px) ============
      '@media (min-width: 768px) {\n' +
      '  .section { padding: 5rem 3rem; }\n' +
      '  h1 { font-size: 3rem; }\n' +
      '  h2 { font-size: 2rem; }\n' +
      '  h3 { font-size: 1.5rem; }\n' +
      '  .section-title { font-size: 2rem; }\n' +
      '  .section-hero h1 { font-size: 3.5rem; }\n' +
      '  .section-hero .subtitle { font-size: 1.25rem; }\n' +
      '  .card { padding: 2.5rem; }\n' +
      '  .btn { padding: 0.85rem 2.5rem; }\n' +
      '  .score-circle { width: 150px; height: 150px; }\n' +
      '  .score-circle .score-value { font-size: 2.75rem; }\n' +
      '  .quiz-question { font-size: 1.5rem; }\n' +
      '  .bento-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }\n' +
      '  .branch-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }\n' +
      '  .modal-triggers { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }\n' +
      '  .tile-thumb { width: 80px; height: 80px; }\n' +
      '  .modal-content { padding: 2.5rem; }\n' +
      '  .assessment-card { padding: 4rem 3rem; }\n' +
      '}\n\n' +

      // ============ LARGE DESKTOP (>=1200px) ============
      '@media (min-width: 1200px) {\n' +
      '  .section-inner { max-width: var(--content-width); }\n' +
      '  .narrative-text { max-width: 680px; }\n' +
      '}\n'
    );
  }

  return { generateCss: generateCss };
})();
