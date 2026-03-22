/**
 * CSS Generator — Produces agency-quality, mobile-first CSS for deep-scroll layout.
 * Inspired by Articulate Rise 360, Elucidat, and premium web experiences.
 * Clean, modern aesthetic with scroll-triggered animations and rich interactions.
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
          ';\n  color: white; border: none;\n}\n.btn-primary:hover { opacity: 0.92; transform: translateY(-2px); box-shadow: 0 8px 25px ' + b.primary + '33; }';
      case 'outline':
        return '.btn-primary {\n  background: transparent; color: var(--primary);\n  border: 2px solid var(--primary);\n}\n.btn-primary:hover { background: var(--primary); color: white; }';
      default:
        return '.btn-primary {\n  background: var(--primary); color: white; border: none;\n}\n.btn-primary:hover { opacity: 0.92; transform: translateY(-2px); box-shadow: 0 8px 25px ' + b.primary + '33; }';
    }
  }

  function cardShadow(brand) {
    var dark = isDarkTheme(brand);
    switch (brand.style.cardStyle) {
      case 'elevated':
        return dark ? 'box-shadow: 0 4px 20px rgba(0,0,0,0.3);' : 'box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06);';
      case 'glass':
        return dark
          ? 'backdrop-filter: blur(12px); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 20px rgba(0,0,0,0.25);'
          : 'backdrop-filter: blur(12px); background: rgba(255,255,255,0.85); box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);';
      case 'outlined':
        return dark ? 'border: 1px solid rgba(255,255,255,0.12);' : 'border: 1px solid rgba(0,0,0,0.08);';
      default:
        return dark ? 'box-shadow: 0 4px 20px rgba(0,0,0,0.3);' : 'box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06);';
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
    var surfaceAlt = dark ? 'rgba(255,255,255,0.03)' : '#f7f8fa';

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
      '  line-height: 1.75;\n' +
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
      '  line-height: 1.15;\n' +
      '  letter-spacing: -0.02em;\n' +
      '  color: var(--text);\n' +
      '}\n' +
      'h1 { font-size: 2.25rem; margin-bottom: 1.5rem; }\n' +
      'h2 { font-size: 1.5rem; margin-bottom: 1.25rem; }\n' +
      'h3 { font-size: 1.25rem; margin-bottom: 1rem; font-weight: 600; }\n' +
      'p { margin-bottom: 1.125rem; line-height: 1.75; color: var(--text); font-size: 1.125rem; max-width: 680px; }\n' +
      'p:last-child { margin-bottom: 0; }\n\n' +

      // ============ DEEP SCROLL LAYOUT ============
      '.course-scroll { width: 100%; }\n\n' +

      // ============ PROGRESS BAR ============
      '.progress-bar {\n' +
      '  position: fixed; top: 0; left: 0; right: 0;\n' +
      '  height: 3px; background: transparent;\n' +
      '  z-index: 1000;\n' +
      '}\n' +
      '.progress-fill {\n' +
      '  height: 100%;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(90deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  transition: width 0.15s ease;\n' +
      '  border-radius: 0 2px 2px 0;\n' +
      '}\n\n' +

      // ============ SECTIONS ============
      '.section {\n' +
      '  position: relative;\n' +
      '  padding: 4rem 1.5rem;\n' +
      '}\n' +
      '.section-inner {\n' +
      '  max-width: var(--content-width);\n' +
      '  margin: 0 auto;\n' +
      '}\n\n' +

      // Section title with brand underline
      '.section-title {\n' +
      '  font-size: 1.75rem;\n' +
      '  font-weight: ' + t.headingWeight + ';\n' +
      '  margin-bottom: 3rem;\n' +
      '  position: relative;\n' +
      '  display: inline-block;\n' +
      '  padding-bottom: 0.75rem;\n' +
      '}\n' +
      '.section-title::after {\n' +
      '  content: ""; position: absolute;\n' +
      '  bottom: 0; left: 0; width: 60px; height: 3px;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(90deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  border-radius: 3px;\n' +
      '}\n\n' +

      // Alternating backgrounds
      '.section:nth-child(even):not(.section-hero):not(.section-results) {\n' +
      '  background: var(--surface-alt);\n' +
      '}\n\n' +

      // ============ HERO SECTION ============
      '.section-hero {\n' +
      '  min-height: 100vh;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  background-size: 200% 200%;\n' +
      '  animation: heroGradient 12s ease infinite;\n' +
      '  color: white; text-align: center;\n' +
      '  padding: 0; position: relative; overflow: hidden;\n' +
      '}\n' +
      '@keyframes heroGradient {\n' +
      '  0% { background-position: 0% 50%; }\n' +
      '  50% { background-position: 100% 50%; }\n' +
      '  100% { background-position: 0% 50%; }\n' +
      '}\n' +
      '.section-hero::before {\n' +
      '  content: ""; position: absolute; inset: 0;\n' +
      '  background: radial-gradient(ellipse at 30% 70%, rgba(255,255,255,0.1) 0%, transparent 60%),\n' +
      '    radial-gradient(ellipse at 70% 20%, rgba(255,255,255,0.06) 0%, transparent 50%);\n' +
      '}\n' +
      '.section-hero .section-inner {\n' +
      '  position: relative; z-index: 2;\n' +
      '  max-width: 760px; padding: 2rem;\n' +
      '}\n' +
      '.section-hero h1 {\n' +
      '  font-size: 2.75rem; color: white;\n' +
      '  letter-spacing: -0.03em;\n' +
      '  margin-bottom: 1.5rem;\n' +
      '}\n' +
      '.section-hero .subtitle {\n' +
      '  font-size: 1.125rem; color: rgba(255,255,255,0.9);\n' +
      '  max-width: 560px; margin: 0 auto 2.5rem;\n' +
      '  background: rgba(255,255,255,0.12);\n' +
      '  backdrop-filter: blur(8px);\n' +
      '  -webkit-backdrop-filter: blur(8px);\n' +
      '  padding: 1rem 1.5rem;\n' +
      '  border-radius: var(--radius);\n' +
      '  border: 1px solid rgba(255,255,255,0.15);\n' +
      '}\n' +
      '.section-hero .btn {\n' +
      '  background: white; color: var(--primary); font-weight: 700;\n' +
      '}\n' +
      '.section-hero .btn:hover {\n' +
      '  transform: translateY(-2px);\n' +
      '  box-shadow: 0 12px 32px rgba(0,0,0,0.25);\n' +
      '}\n\n' +

      // Hero with background image
      '.hero-bg {\n  background-size: cover; background-position: center;\n}\n' +
      '.hero-bg::after {\n' +
      '  content: ""; position: absolute; inset: 0;\n' +
      '  background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.75) 100%);\n' +
      '}\n\n' +

      // ============ SCROLL INDICATOR ============
      '.scroll-indicator {\n' +
      '  margin-top: 3rem;\n' +
      '  color: rgba(255,255,255,0.7); font-size: 13px;\n' +
      '  display: flex; flex-direction: column; align-items: center; gap: 8px;\n' +
      '  letter-spacing: 0.1em; text-transform: uppercase;\n' +
      '  font-weight: 500;\n' +
      '}\n' +
      '.scroll-indicator .scroll-arrow {\n' +
      '  font-size: 20px;\n' +
      '  animation: scrollBounce 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;\n' +
      '}\n' +
      '@keyframes scrollBounce {\n' +
      '  0%, 100% { transform: translateY(0); opacity: 0.5; }\n' +
      '  50% { transform: translateY(10px); opacity: 1; }\n' +
      '}\n\n' +

      // ============ CONTENT BLOCKS ============
      '.content-block {\n' +
      '  margin-bottom: 3rem;\n' +
      '  padding-bottom: 3rem;\n' +
      '  border-bottom: 1px solid ' + borderLight + ';\n' +
      '}\n' +
      '.content-block:last-child {\n' +
      '  margin-bottom: 0; padding-bottom: 0; border-bottom: none;\n' +
      '}\n\n' +

      // Slide divider
      '.slide-divider {\n' +
      '  width: 40px; height: 2px;\n' +
      '  background: ' + border + ';\n' +
      '  margin: 0 0 2rem 0;\n' +
      '}\n\n' +

      // ============ SPLIT LAYOUT (text + image side by side) ============
      '.split-layout {\n' +
      '  display: flex; flex-direction: column; gap: 2rem;\n' +
      '  align-items: center;\n' +
      '}\n' +
      '.split-layout .split-text { flex: 1; min-width: 0; }\n' +
      '.split-layout .split-media { flex: 1; min-width: 0; }\n' +
      '.split-layout .split-media img {\n' +
      '  width: 100%; border-radius: var(--radius);\n' +
      '  ' + shadow + '\n' +
      '}\n\n' +

      // ============ ACCENT CARD (text-only slides) ============
      '.accent-card {\n' +
      '  border-left: 4px solid var(--primary);\n' +
      '  padding: 1.5rem 2rem;\n' +
      '  background: ' + b.primary + '06;\n' +
      '  border-radius: 0 var(--radius) var(--radius) 0;\n' +
      '}\n' +
      '.accent-card h2, .accent-card h3 {\n' +
      '  margin-bottom: 0.75rem;\n' +
      '}\n\n' +

      // ============ NUMBERED STEPS ============
      '.numbered-steps {\n' +
      '  position: relative;\n' +
      '  padding-left: 3rem;\n' +
      '}\n' +
      '.numbered-steps::before {\n' +
      '  content: ""; position: absolute;\n' +
      '  left: 15px; top: 8px; bottom: 8px; width: 2px;\n' +
      '  background: ' + b.primary + '20;\n' +
      '  border-radius: 2px;\n' +
      '}\n' +
      '.step-item {\n' +
      '  position: relative;\n' +
      '  margin-bottom: 2rem;\n' +
      '  padding-left: 1rem;\n' +
      '}\n' +
      '.step-item:last-child { margin-bottom: 0; }\n' +
      '.step-number {\n' +
      '  position: absolute; left: -3rem; top: 2px;\n' +
      '  width: 32px; height: 32px;\n' +
      '  border-radius: 50%;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  color: white; font-weight: 700; font-size: 0.85rem;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  z-index: 1;\n' +
      '}\n\n' +

      // ============ FLIP CARDS ============
      '.flip-cards-grid {\n' +
      '  display: grid; grid-template-columns: 1fr;\n' +
      '  gap: 1.25rem; width: 100%; max-width: var(--content-width);\n' +
      '  perspective: 1200px;\n' +
      '}\n' +
      '.flip-card {\n' +
      '  height: 200px; cursor: pointer;\n' +
      '  -webkit-perspective: 1200px; perspective: 1200px;\n' +
      '}\n' +
      '.flip-card-inner {\n' +
      '  position: relative; width: 100%; height: 100%;\n' +
      '  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '  -webkit-transform-style: preserve-3d; transform-style: preserve-3d;\n' +
      '}\n' +
      '.flip-card.flipped .flip-card-inner {\n' +
      '  -webkit-transform: rotateY(180deg); transform: rotateY(180deg);\n' +
      '}\n' +
      '.flip-card-front, .flip-card-back {\n' +
      '  position: absolute; inset: 0; border-radius: var(--radius);\n' +
      '  -webkit-backface-visibility: hidden; backface-visibility: hidden;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  padding: 1.5rem; text-align: center;\n' +
      '  ' + shadow + '\n' +
      '}\n' +
      '.flip-card-front {\n' +
      '  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  color: white;\n' +
      '}\n' +
      '.flip-card-front h3 { color: white; font-size: 1.1rem; margin: 0; }\n' +
      '.flip-card-front .flip-hint {\n' +
      '  position: absolute; bottom: 12px; right: 16px;\n' +
      '  font-size: 0.75rem; opacity: 0.7;\n' +
      '}\n' +
      '.flip-card-back {\n' +
      '  background: var(--surface); border: 1px solid ' + border + ';\n' +
      '  -webkit-transform: rotateY(180deg); transform: rotateY(180deg);\n' +
      '  flex-direction: column;\n' +
      '}\n' +
      '.flip-card-back p { font-size: 0.95rem; margin: 0; max-width: none; }\n\n' +

      // Narrative text
      '.narrative-text {\n  max-width: 680px;\n}\n' +
      '.narrative-text p {\n' +
      '  font-size: 1.125rem;\n' +
      '  line-height: 1.75;\n' +
      '  color: var(--text);\n' +
      '}\n\n' +

      // Callout
      '.callout {\n' +
      '  padding: 1.25rem 1.5rem;\n' +
      '  border-left: 4px solid var(--primary);\n' +
      '  background: ' + b.primary + '08;\n' +
      '  border-radius: 0 var(--radius) var(--radius) 0;\n' +
      '  margin: 1.5rem 0;\n' +
      '  font-size: 1.05rem;\n' +
      '  color: var(--text);\n' +
      '  line-height: 1.7;\n' +
      '  position: relative;\n' +
      '}\n' +
      '.callout::before {\n' +
      '  content: "\\201C"; position: absolute;\n' +
      '  top: -8px; left: 12px;\n' +
      '  font-size: 3rem; color: var(--primary); opacity: 0.15;\n' +
      '  font-family: Georgia, serif; line-height: 1;\n' +
      '}\n\n' +

      // ============ BACKGROUND IMAGE SLIDES ============
      '.has-bg-image {\n' +
      '  position: relative; border-radius: var(--radius);\n' +
      '  min-height: 360px; padding: 3rem;\n' +
      '  color: white; overflow: hidden;\n' +
      '  display: flex; flex-direction: column; justify-content: flex-end;\n' +
      '}\n' +
      '.has-bg-image h2, .has-bg-image h3, .has-bg-image p { color: white; position: relative; z-index: 2; }\n' +
      '.has-bg-image .narrative-text { position: relative; z-index: 2; }\n' +
      '.bg-overlay {\n' +
      '  position: absolute; inset: 0; border-radius: inherit;\n' +
      '  background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.7) 100%);\n' +
      '  z-index: 1;\n' +
      '}\n\n' +

      // ============ BUTTONS ============
      '.btn {\n' +
      '  display: inline-flex; align-items: center; justify-content: center; gap: 8px;\n' +
      '  padding: 0.85rem 2.25rem;\n' +
      '  border: none; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: 0.95rem; font-weight: 600;\n' +
      '  cursor: pointer; transition: all var(--transition);\n' +
      '  text-decoration: none; min-width: 140px;\n' +
      '  -webkit-tap-highlight-color: transparent;\n' +
      '  letter-spacing: 0.01em;\n' +
      '}\n' +
      '.btn:active { transform: scale(0.97); }\n' +
      btnCss + '\n\n' +
      '.btn-secondary {\n  background: transparent; color: var(--primary);\n  border: 2px solid var(--primary);\n}\n' +
      '.btn-secondary:hover { background: var(--primary); color: white; }\n\n' +
      '.actions { margin-top: 2rem; text-align: center; }\n\n' +

      // ============ CARD ============
      '.card {\n' +
      '  background: var(--surface);\n' +
      '  border-radius: var(--radius);\n' +
      '  padding: 2.5rem;\n' +
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
      '.form-group { margin-bottom: 2rem; width: 100%; position: relative; }\n' +
      '.form-group label {\n' +
      '  display: block; font-weight: 600; margin-bottom: 0.5rem;\n' +
      '  color: var(--text); font-size: 0.9rem;\n' +
      '  transition: all var(--transition);\n' +
      '}\n' +
      '.form-group input, .form-group textarea {\n' +
      '  width: 100%; padding: 0.85rem 1rem;\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: 1rem;\n' +
      '  transition: border-color var(--transition), box-shadow var(--transition);\n' +
      '  background: var(--bg); color: var(--text);\n' +
      '}\n' +
      '.form-group input:focus, .form-group textarea:focus {\n' +
      '  outline: none; border-color: var(--primary);\n' +
      '  box-shadow: 0 0 0 4px ' + b.primary + '15;\n' +
      '}\n' +
      '.form-group input:focus + label,\n' +
      '.form-group input:not(:placeholder-shown) + label {\n' +
      '  color: var(--primary); font-size: 0.8rem;\n' +
      '}\n\n' +

      // ============ ACCORDION ============
      '.accordion { width: 100%; max-width: var(--content-width); }\n' +
      '.accordion-item {\n' +
      '  border: none;\n' +
      '  border-left: 3px solid ' + border + ';\n' +
      '  margin-bottom: 0.5rem;\n' +
      '  border-radius: 0;\n' +
      '  overflow: hidden;\n' +
      '  transition: border-color var(--transition), background var(--transition);\n' +
      '}\n' +
      '.accordion-item.open {\n' +
      '  border-left-color: var(--primary);\n' +
      '  background: ' + b.primary + '04;\n' +
      '}\n' +
      '.accordion-trigger {\n' +
      '  width: 100%; display: flex; justify-content: space-between; align-items: center;\n' +
      '  padding: 1.125rem 1.5rem;\n' +
      '  background: transparent; border: none; cursor: pointer;\n' +
      '  font-family: var(--font-heading); font-size: 1rem;\n' +
      '  font-weight: 600; color: var(--text); text-align: left;\n' +
      '  transition: color var(--transition), background var(--transition);\n' +
      '  -webkit-tap-highlight-color: transparent;\n' +
      '}\n' +
      '.accordion-trigger:hover { background: ' + b.primary + '06; color: var(--primary); }\n' +
      '.accordion-item.open .accordion-trigger { color: var(--primary); }\n' +
      '.accordion-icon {\n' +
      '  width: 20px; height: 20px;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '  flex-shrink: 0; margin-left: 1rem;\n' +
      '  font-size: 14px; color: var(--text-muted);\n' +
      '}\n' +
      '.accordion-item.open .accordion-icon { transform: rotate(90deg); color: var(--primary); }\n' +
      '.accordion-panel {\n' +
      '  max-height: 0;\n' +
      '  overflow: hidden;\n' +
      '  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '}\n' +
      '.accordion-item.open .accordion-panel {\n' +
      '  max-height: 2000px;\n' +
      '  transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '}\n' +
      '.accordion-panel-inner {\n' +
      '  padding: 0.75rem 1.5rem 1.5rem;\n' +
      '}\n' +
      '.accordion-panel-inner p {\n' +
      '  font-size: 1rem; line-height: 1.7;\n' +
      '}\n\n' +

      // ============ MODAL ============
      '.modal-triggers {\n' +
      '  display: grid; grid-template-columns: 1fr;\n' +
      '  gap: 1rem; width: 100%; max-width: var(--content-width);\n' +
      '}\n' +
      '.modal-trigger-tile {\n' +
      '  display: flex; align-items: center;\n' +
      '  border: 1px solid ' + border + '; border-radius: var(--radius);\n' +
      '  overflow: hidden; cursor: pointer;\n' +
      '  background: var(--surface); transition: all var(--transition);\n' +
      '  -webkit-tap-highlight-color: transparent;\n' +
      '}\n' +
      '.modal-trigger-tile:hover {\n' +
      '  border-color: var(--primary); transform: translateY(-3px);\n' +
      '  ' + shadow + '\n' +
      '}\n' +
      '.tile-thumb { width: 80px; height: 80px; flex-shrink: 0; overflow: hidden; }\n' +
      '.tile-thumb img { width: 100%; height: 100%; object-fit: cover; }\n' +
      '.tile-label {\n' +
      '  flex: 1; display: flex; justify-content: space-between; align-items: center;\n' +
      '  padding: 1rem 1.25rem;\n' +
      '  font-weight: 600; font-size: 0.95rem;\n' +
      '}\n' +
      '.tile-arrow { color: var(--primary); font-size: 18px; transition: transform var(--transition); }\n' +
      '.modal-trigger-tile:hover .tile-arrow { transform: translateX(3px); }\n\n' +

      '.modal-overlay {\n' +
      '  position: fixed; inset: 0; z-index: 1000;\n' +
      '  background: rgba(0,0,0,0.5);\n' +
      '  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  padding: 1.5rem;\n' +
      '  animation: fadeIn 0.2s ease-out;\n' +
      '}\n' +
      '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }\n' +
      '.modal-content {\n' +
      '  background: var(--surface); border-radius: var(--radius);\n' +
      '  width: 100%; max-width: 600px; max-height: 85vh;\n' +
      '  overflow-y: auto; padding: 2.5rem;\n' +
      '  position: relative;\n' +
      '  animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);\n' +
      '  ' + shadow + '\n' +
      '}\n' +
      '@keyframes modalIn {\n  from { opacity: 0; transform: scale(0.95) translateY(10px); }\n  to { opacity: 1; transform: scale(1) translateY(0); }\n}\n' +
      '.modal-close {\n' +
      '  position: sticky; top: 0; float: right;\n' +
      '  width: 36px; height: 36px; border-radius: 50%;\n' +
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
      '  gap: 1.25rem; width: 100%; max-width: var(--content-width);\n' +
      '}\n' +
      '.bento-tile {\n' +
      '  background: var(--surface); border-radius: var(--radius);\n' +
      '  padding: 1.75rem;\n' +
      '  border: 1px solid ' + border + ';\n' +
      '  transition: all var(--transition);\n' +
      '  position: relative; overflow: hidden;\n' +
      '}\n' +
      '.bento-tile::before {\n' +
      '  content: ""; position: absolute; top: 0; left: 0; right: 0;\n' +
      '  height: 3px;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(90deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  opacity: 0; transition: opacity var(--transition);\n' +
      '}\n' +
      '.bento-tile:hover::before { opacity: 1; }\n' +
      '.bento-tile:hover { transform: translateY(-3px); ' + shadow + ' }\n' +
      '.bento-tile h3 { color: var(--primary); font-size: 1rem; margin-bottom: 0.75rem; }\n' +
      '.bento-tile p { font-size: 0.95rem; }\n' +
      '.bento-image {\n' +
      '  width: 100%; border-radius: calc(var(--radius) * 0.6);\n' +
      '  overflow: hidden; margin-bottom: 1rem;\n' +
      '}\n' +
      '.bento-image img { width: 100%; height: auto; display: block; }\n\n' +

      // ============ GLOSSARY ============
      '.glossary-grid {\n' +
      '  display: grid; grid-template-columns: 1fr; gap: 1rem;\n' +
      '  max-width: var(--content-width); margin: 0 auto;\n' +
      '}\n' +
      '@media (min-width: 768px) { .glossary-grid { grid-template-columns: 1fr 1fr; } }\n' +
      '.glossary-card {\n' +
      '  background: var(--surface); border-radius: var(--radius);\n' +
      '  padding: 1.5rem; border-left: 3px solid var(--primary);\n' +
      '  transition: transform 0.2s, box-shadow 0.2s;\n' +
      '}\n' +
      '.glossary-card:hover {\n' +
      '  transform: translateY(-2px);\n' +
      '  box-shadow: 0 4px 12px rgba(0,0,0,0.08);\n' +
      '}\n' +
      '.glossary-card dt {\n' +
      '  font-weight: 700; color: var(--primary); font-size: 1rem;\n' +
      '  margin-bottom: 0.5rem;\n' +
      '}\n' +
      '.glossary-card dd {\n' +
      '  margin: 0; font-size: 0.95rem; line-height: 1.6;\n' +
      '  color: var(--text-muted);\n' +
      '}\n\n' +

      // ============ BRANCHING ============
      '.branch-container { text-align: center; width: 100%; max-width: var(--content-width); margin: 0 auto; }\n' +
      '.greeting { font-size: 1.15rem; margin-bottom: 1.5rem; color: var(--text); }\n' +
      '.branch-grid {\n' +
      '  display: grid; grid-template-columns: 1fr;\n' +
      '  gap: 1.25rem; margin-top: 2rem;\n' +
      '}\n' +
      '.branch-option {\n' +
      '  padding: 2rem;\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '  text-align: center; background: var(--surface);\n' +
      '  -webkit-tap-highlight-color: transparent;\n' +
      '  position: relative; overflow: hidden;\n' +
      '}\n' +
      '.branch-option::before {\n' +
      '  content: ""; position: absolute; inset: 0;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  opacity: 0; transition: opacity 0.3s ease;\n' +
      '}\n' +
      '.branch-option:hover::before { opacity: 0.04; }\n' +
      '.branch-option:hover {\n' +
      '  border-color: var(--primary); transform: translateY(-4px);\n' +
      '  box-shadow: 0 8px 30px ' + b.primary + '20;\n' +
      '}\n' +
      '.branch-option.selected {\n' +
      '  border-color: var(--primary);\n' +
      '  box-shadow: 0 0 0 3px ' + b.primary + '20;\n' +
      '}\n' +
      '.branch-option h3 { color: var(--primary); margin-bottom: 0.25rem; font-size: 1.1rem; position: relative; }\n' +
      '.branch-option p { position: relative; }\n\n' +

      // ============ QUIZ ============
      '.quiz-section {\n' +
      '  min-height: 100vh;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  padding: 3rem 1.5rem;\n' +
      '}\n' +
      '.quiz-container { text-align: center; width: 100%; max-width: 640px; margin: 0 auto; }\n' +
      // Quiz progress bar
      '.quiz-progress-bar {\n' +
      '  width: 100%; height: 6px;\n' +
      '  background: ' + border + ';\n' +
      '  border-radius: 3px; margin-bottom: 2.5rem;\n' +
      '  overflow: hidden;\n' +
      '}\n' +
      '.quiz-progress-fill {\n' +
      '  height: 100%;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(90deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  border-radius: 3px;\n' +
      '  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '}\n' +
      '.quiz-counter {\n' +
      '  color: var(--text-muted); margin-bottom: 0.5rem;\n' +
      '  font-size: 0.85rem; letter-spacing: 0.08em;\n' +
      '  text-transform: uppercase; font-weight: 500;\n' +
      '}\n' +
      '.quiz-question {\n' +
      '  font-family: var(--font-heading); font-size: 1.35rem;\n' +
      '  font-weight: ' + t.headingWeight + ';\n' +
      '  margin-bottom: 2rem; text-align: center;\n' +
      '  max-width: 600px; margin-left: auto; margin-right: auto;\n' +
      '  line-height: 1.4;\n' +
      '}\n' +
      '.quiz-choices {\n' +
      '  width: 100%; max-width: 560px;\n' +
      '  display: flex; flex-direction: column; gap: 0.75rem;\n' +
      '  margin: 0 auto;\n' +
      '}\n' +
      '.quiz-choice {\n' +
      '  display: flex; align-items: center; gap: 1rem;\n' +
      '  padding: 1.125rem 1.5rem;\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  cursor: pointer; transition: all 0.25s ease;\n' +
      '  background: var(--surface); font-size: 1rem;\n' +
      '  text-align: left; -webkit-tap-highlight-color: transparent;\n' +
      '}\n' +
      '.quiz-choice:hover { border-color: var(--primary); background: ' + b.primary + '05; }\n' +
      '.quiz-choice.selected {\n' +
      '  border-color: var(--primary);\n' +
      '  background: ' + b.primary + '0a;\n' +
      '  box-shadow: 0 0 0 3px ' + b.primary + '12;\n' +
      '}\n' +
      '.quiz-choice.correct {\n' +
      '  border-color: var(--success);\n' +
      '  background: ' + b.success + '0a;\n' +
      '  box-shadow: 0 0 16px ' + b.success + '18;\n' +
      '}\n' +
      '.quiz-choice.incorrect {\n' +
      '  border-color: var(--error);\n' +
      '  background: ' + b.error + '0a;\n' +
      '  box-shadow: 0 0 16px ' + b.error + '18;\n' +
      '}\n' +
      '.quiz-choice .indicator {\n' +
      '  width: 24px; height: 24px; border-radius: 50%;\n' +
      '  border: 2px solid ' + border + '; flex-shrink: 0;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  font-size: 12px; color: white;\n' +
      '  transition: all 0.25s ease;\n' +
      '}\n' +
      '.quiz-choice.selected .indicator { border-color: var(--primary); background: var(--primary); }\n' +
      '.quiz-choice.correct .indicator { border-color: var(--success); background: var(--success); }\n' +
      '.quiz-choice.incorrect .indicator { border-color: var(--error); background: var(--error); }\n' +
      '.quiz-choice .indicator.checkbox { border-radius: 6px; }\n' +
      '.quiz-choice.selected .indicator.checkbox { border-color: var(--primary); background: var(--primary); }\n' +
      '.quiz-feedback {\n' +
      '  margin-top: 1.5rem; padding: 1rem 1.5rem;\n' +
      '  border-radius: var(--radius); text-align: center; font-weight: 600;\n' +
      '  font-size: 0.95rem;\n' +
      '}\n' +
      '.quiz-feedback.correct { background: ' + b.success + '12; color: var(--success); }\n' +
      '.quiz-feedback.incorrect { background: ' + b.error + '12; color: var(--error); }\n\n' +
      '.quiz-text-entry { width: 100%; max-width: 560px; margin: 0.75rem auto; }\n' +
      '.quiz-text-entry input, .quiz-text-entry textarea {\n' +
      '  width: 100%; padding: 0.85rem 1rem;\n' +
      '  border: 2px solid ' + border + '; border-radius: var(--radius);\n' +
      '  font-family: var(--font-body); font-size: 1rem;\n' +
      '  background: var(--bg); color: var(--text);\n' +
      '  transition: border-color var(--transition);\n' +
      '}\n' +
      '.quiz-text-entry input:focus, .quiz-text-entry textarea:focus {\n' +
      '  outline: none; border-color: var(--primary);\n' +
      '  box-shadow: 0 0 0 4px ' + b.primary + '15;\n' +
      '}\n' +
      // Quiz slide transition
      '.quiz-slide-enter {\n' +
      '  animation: quizSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '}\n' +
      '@keyframes quizSlideIn {\n' +
      '  from { opacity: 0; transform: translateX(30px); }\n' +
      '  to { opacity: 1; transform: translateX(0); }\n' +
      '}\n\n' +

      // ============ ASSESSMENT SECTION ============
      '.assessment-card {\n' +
      '  text-align: center; max-width: 520px; margin: 0 auto;\n' +
      '  padding: 3.5rem 2.5rem; border-radius: var(--radius);\n' +
      '  background: var(--surface); ' + shadow + '\n' +
      '  position: relative; overflow: hidden;\n' +
      '}\n' +
      '.assessment-card::before {\n' +
      '  content: ""; position: absolute; top: 0; left: 0; right: 0;\n' +
      '  height: 4px;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(90deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '}\n' +
      '.assessment-icon {\n' +
      '  font-size: 3rem; margin-bottom: 1rem;\n' +
      '  display: block;\n' +
      '}\n' +
      '.assessment-card h2 { margin-bottom: 0.75rem; }\n' +
      '.assessment-card p { margin: 0 auto 2rem; color: var(--text-muted); font-size: 1.05rem; }\n' +
      '.assessment-card .btn-primary {\n' +
      '  padding: 1rem 3rem; font-size: 1rem;\n' +
      '}\n\n' +

      // ============ RESULTS ============
      '.section-results {\n' +
      '  min-height: 80vh;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  background: ' + (b.gradient || 'linear-gradient(135deg, ' + b.primary + ', ' + b.secondary + ')') + ';\n' +
      '  color: white; text-align: center;\n' +
      '  position: relative; overflow: hidden;\n' +
      '}\n' +
      '.section-results::before {\n' +
      '  content: ""; position: absolute; inset: 0;\n' +
      '  background: radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 70%);\n' +
      '}\n' +
      '.section-results .section-inner { max-width: 500px; position: relative; z-index: 2; }\n' +
      '.section-results h1, .section-results h2, .section-results h3, .section-results p { color: white; }\n' +
      '.score-circle {\n' +
      '  width: 140px; height: 140px; border-radius: 50%;\n' +
      '  display: flex; align-items: center; justify-content: center; flex-direction: column;\n' +
      '  margin: 2rem auto;\n' +
      '  position: relative;\n' +
      '  animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);\n' +
      '}\n' +
      '.score-ring {\n' +
      '  position: absolute; inset: 0;\n' +
      '  border-radius: 50%;\n' +
      '}\n' +
      '.score-circle .score-value {\n' +
      '  font-size: 2.5rem; font-weight: ' + t.headingWeight + ';\n' +
      '  font-family: var(--font-heading);\n' +
      '  position: relative; z-index: 1;\n' +
      '}\n' +
      '.score-circle .score-label {\n' +
      '  font-size: 0.85rem; opacity: 0.85;\n' +
      '  position: relative; z-index: 1;\n' +
      '  text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;\n' +
      '}\n' +
      '.results-msg {\n' +
      '  color: rgba(255,255,255,0.9); margin-top: 1.5rem;\n' +
      '  max-width: 400px; margin-left: auto; margin-right: auto;\n' +
      '  font-size: 1.05rem; line-height: 1.6;\n' +
      '}\n' +
      '.btn-restart {\n' +
      '  margin-top: 2rem; background: white; color: var(--primary);\n' +
      '  border: none; font-weight: 700;\n' +
      '}\n' +
      '.btn-restart:hover {\n' +
      '  transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.2);\n' +
      '}\n' +
      // Pass celebration dots
      '.celebration-dots {\n' +
      '  position: absolute; inset: 0; pointer-events: none; overflow: hidden;\n' +
      '}\n' +
      '.celebration-dot {\n' +
      '  position: absolute; width: 8px; height: 8px; border-radius: 50%;\n' +
      '  animation: celebrateDot 2s ease-out forwards;\n' +
      '}\n' +
      '@keyframes celebrateDot {\n' +
      '  0% { transform: translateY(0) scale(0); opacity: 1; }\n' +
      '  100% { transform: translateY(-120px) scale(1.2); opacity: 0; }\n' +
      '}\n\n' +
      '@keyframes scaleIn {\n  from { transform: scale(0); opacity: 0; }\n  to { transform: scale(1); opacity: 1; }\n}\n\n' +

      // ============ SCROLL ANIMATIONS ============
      '.scroll-reveal {\n' +
      '  opacity: 0; transform: translateY(30px);\n' +
      '}\n' +
      '.scroll-reveal.visible {\n' +
      '  opacity: 1; transform: translateY(0);\n' +
      '  transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '}\n\n' +

      // ============ DESKTOP (>=768px) ============
      '@media (min-width: 768px) {\n' +
      '  .section { padding: 5rem 3rem; }\n' +
      '  h1 { font-size: 3.5rem; letter-spacing: -0.02em; }\n' +
      '  h2 { font-size: 2rem; }\n' +
      '  h3 { font-size: 1.25rem; }\n' +
      '  .section-title { font-size: 2rem; }\n' +
      '  .section-hero h1 { font-size: 3.5rem; }\n' +
      '  .section-hero .subtitle { font-size: 1.2rem; }\n' +
      '  .split-layout { flex-direction: row; gap: 3rem; }\n' +
      '  .split-layout--reverse { flex-direction: row-reverse; }\n' +
      '  .card { padding: 3rem; }\n' +
      '  .btn { padding: 0.9rem 2.5rem; }\n' +
      '  .score-circle { width: 160px; height: 160px; }\n' +
      '  .score-circle .score-value { font-size: 3rem; }\n' +
      '  .quiz-question { font-size: 1.5rem; }\n' +
      '  .bento-grid { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }\n' +
      '  .branch-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }\n' +
      '  .modal-triggers { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }\n' +
      '  .tile-thumb { width: 88px; height: 88px; }\n' +
      '  .modal-content { padding: 2.5rem; }\n' +
      '  .assessment-card { padding: 4rem 3rem; }\n' +
      '  .flip-cards-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }\n' +
      '  .flip-card { height: 220px; }\n' +
      '}\n\n' +

      // ============ LARGE DESKTOP (>=1200px) ============
      '@media (min-width: 1200px) {\n' +
      '  .section { padding: 6rem 3rem; }\n' +
      '  .section-inner { max-width: var(--content-width); }\n' +
      '  .narrative-text { max-width: 680px; }\n' +
      '}\n'
    );
  }

  return { generateCss: generateCss };
})();
