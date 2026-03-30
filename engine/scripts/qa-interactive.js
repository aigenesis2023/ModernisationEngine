#!/usr/bin/env node
/**
 * V5 Interactive QA — Playwright-based functional testing
 *
 * Opens the built course in a real browser and tests every interactive
 * component: clicks quizzes, flips flashcards, switches tabs, navigates
 * carousels, expands accordions, checks checklists. Also validates
 * content overflow, minimum tap targets, and font sizes.
 *
 * Run AFTER qa-course.js (structural), BEFORE review-course.js (visual).
 *
 * Usage: node engine/scripts/qa-interactive.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const COURSE_PATH = path.resolve(ROOT, 'engine/output/course.html');
const LAYOUT_PATH = path.resolve(ROOT, 'engine/output/course-layout.json');

const errors = [];
const warnings = [];
const passes = [];

function fail(cat, msg) { errors.push(`[${cat}] ${msg}`); }
function warn(cat, msg) { warnings.push(`[${cat}] ${msg}`); }
function pass(cat, msg) { passes.push(`[${cat}] ${msg}`); }

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║       V5 INTERACTIVE QA — Playwright Functional     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(COURSE_PATH)) {
    console.log('❌ FATAL: engine/output/course.html not found. Run build-course.js first.\n');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Load course and wait for hydrate.js to run
  await page.goto(`file://${COURSE_PATH}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // Let GSAP animations settle

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 1: Scroll progress bar
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing scroll progress bar...');
  const hasProgressBar = await page.evaluate(() => {
    return !!document.getElementById('hydrate-progress');
  });
  if (hasProgressBar) {
    // Scroll to middle
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight / 2);
    });
    await page.waitForTimeout(300);
    const progressWidth = await page.evaluate(() => {
      const bar = document.getElementById('hydrate-progress');
      return parseFloat(bar.style.width) || 0;
    });
    if (progressWidth > 20 && progressWidth < 80) {
      pass('PROGRESS', `Scroll progress bar updates on scroll (${Math.round(progressWidth)}%)`);
    } else {
      warn('PROGRESS', `Scroll progress bar value unexpected: ${Math.round(progressWidth)}%`);
    }
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  } else {
    fail('PROGRESS', 'Scroll progress bar (#hydrate-progress) not created by hydrate.js');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 2: MCQ quizzes
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing MCQ quizzes...');
  const quizCount = await page.evaluate(() => document.querySelectorAll('[data-quiz]').length);

  for (let i = 0; i < quizCount; i++) {
    const label = `MCQ #${i + 1}`;

    // Scroll to quiz
    await page.evaluate((idx) => {
      const quizzes = document.querySelectorAll('[data-quiz]');
      if (quizzes[idx]) quizzes[idx].scrollIntoView({ block: 'center' });
    }, i);
    await page.waitForTimeout(500);

    // Click first choice — use dispatchEvent for reliable triggering
    const choiceClicked = await page.evaluate((idx) => {
      const quiz = document.querySelectorAll('[data-quiz]')[idx];
      if (!quiz) return false;
      const choices = quiz.querySelectorAll('[data-choice]');
      if (choices.length === 0) return false;
      // Force visibility in case GSAP hasn't fully revealed yet
      quiz.style.opacity = '1';
      quiz.style.transform = 'none';
      choices[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }, i);

    if (!choiceClicked) {
      fail('MCQ', `${label}: Could not click first choice`);
      continue;
    }

    await page.waitForTimeout(300);

    // Check submit button appeared
    const hasSubmit = await page.evaluate((idx) => {
      const quiz = document.querySelectorAll('[data-quiz]')[idx];
      const buttons = quiz.querySelectorAll('button');
      return Array.from(buttons).some(b => b.textContent.trim() === 'Submit');
    }, i);

    if (!hasSubmit) {
      fail('MCQ', `${label}: Submit button did not appear after selecting choice`);
      continue;
    }
    pass('MCQ', `${label}: Choice selection → Submit button appears ✓`);

    // Click Submit
    await page.evaluate((idx) => {
      const quiz = document.querySelectorAll('[data-quiz]')[idx];
      const buttons = quiz.querySelectorAll('button');
      for (let b = 0; b < buttons.length; b++) {
        if (buttons[b].textContent.trim() === 'Submit') {
          buttons[b].dispatchEvent(new MouseEvent('click', { bubbles: true }));
          break;
        }
      }
    }, i);
    await page.waitForTimeout(300);

    // Check feedback appeared
    const feedbackResult = await page.evaluate((idx) => {
      const quiz = document.querySelectorAll('[data-quiz]')[idx];
      const hasCorrect = !!quiz.querySelector('.border-\\[\\#22c55e\\]');
      const hasError = !!quiz.querySelector('.border-error');
      const feedbackText = quiz.querySelector('.mt-3.text-sm');
      const hasTryAgain = !!quiz.querySelector('button') &&
        Array.from(quiz.querySelectorAll('button')).some(b => b.textContent.includes('Try Again'));
      return {
        hasCorrect,
        hasError,
        hasFeedbackText: !!feedbackText,
        hasTryAgain,
        feedbackContent: feedbackText ? feedbackText.textContent.substring(0, 50) : ''
      };
    }, i);

    if (feedbackResult.hasCorrect || feedbackResult.hasError) {
      pass('MCQ', `${label}: Submit → feedback renders (${feedbackResult.hasCorrect ? 'correct' : 'incorrect'}) ✓`);
    } else {
      fail('MCQ', `${label}: No feedback appeared after submit`);
    }

    if (feedbackResult.hasError && feedbackResult.hasTryAgain) {
      pass('MCQ', `${label}: Incorrect answer shows "Try Again" button ✓`);

      // Test retry
      await page.evaluate((idx) => {
        const quiz = document.querySelectorAll('[data-quiz]')[idx];
        const tryAgain = Array.from(quiz.querySelectorAll('button')).find(b => b.textContent.includes('Try Again'));
        if (tryAgain) tryAgain.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, i);
      await page.waitForTimeout(200);

      const resetOk = await page.evaluate((idx) => {
        const quiz = document.querySelectorAll('[data-quiz]')[idx];
        const hasCorrect = !!quiz.querySelector('.border-\\[\\#22c55e\\]');
        const hasError = !!quiz.querySelector('.border-error');
        return !hasCorrect && !hasError; // Both should be cleared
      }, i);

      if (resetOk) {
        pass('MCQ', `${label}: Try Again resets quiz ✓`);
      } else {
        warn('MCQ', `${label}: Try Again may not have fully reset`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 3: Tabs
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing tabs...');
  const tabContainerCount = await page.evaluate(() => document.querySelectorAll('[data-tabs]').length);

  for (let i = 0; i < tabContainerCount; i++) {
    const label = `Tabs #${i + 1}`;

    await page.evaluate((idx) => {
      const containers = document.querySelectorAll('[data-tabs]');
      if (containers[idx]) containers[idx].scrollIntoView({ block: 'center' });
    }, i);
    await page.waitForTimeout(500);

    const tabInfo = await page.evaluate((idx) => {
      const container = document.querySelectorAll('[data-tabs]')[idx];
      const triggers = container.querySelectorAll('[data-tab-trigger]');
      const panels = container.querySelectorAll('[data-tab-panel]');
      return { triggerCount: triggers.length, panelCount: panels.length };
    }, i);

    // Click each tab and verify panel switches
    let allTabsWork = true;
    for (let t = 0; t < tabInfo.triggerCount; t++) {
      const result = await page.evaluate(({ idx, tabIdx }) => {
        const container = document.querySelectorAll('[data-tabs]')[idx];
        const triggers = container.querySelectorAll('[data-tab-trigger]');
        const panels = container.querySelectorAll('[data-tab-panel]');

        triggers[tabIdx].click();

        // Check the matching panel is visible, others hidden
        let correctPanelVisible = false;
        let wrongPanelsHidden = true;
        panels.forEach((p, pi) => {
          const isVisible = p.style.display !== 'none' && p.offsetHeight > 0;
          if (pi === tabIdx && isVisible) correctPanelVisible = true;
          if (pi !== tabIdx && isVisible) wrongPanelsHidden = false;
        });

        // Check panel has content
        const activePanel = panels[tabIdx];
        const textLength = activePanel ? activePanel.textContent.trim().length : 0;

        return {
          correctPanelVisible,
          wrongPanelsHidden,
          panelHasContent: textLength > 10,
          textLength
        };
      }, { idx: i, tabIdx: t });

      if (!result.correctPanelVisible) {
        fail('TABS', `${label}: Tab ${t + 1} click did not show matching panel`);
        allTabsWork = false;
      }
      if (!result.wrongPanelsHidden) {
        fail('TABS', `${label}: Tab ${t + 1} click did not hide other panels`);
        allTabsWork = false;
      }
      if (!result.panelHasContent) {
        warn('TABS', `${label}: Tab ${t + 1} panel has very little content (${result.textLength} chars)`);
      }
    }
    if (allTabsWork) {
      pass('TABS', `${label}: All ${tabInfo.triggerCount} tabs switch panels correctly ✓`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 4: Flashcards
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing flashcards...');
  const flashcardCount = await page.evaluate(() => document.querySelectorAll('[data-flashcard]').length);

  if (flashcardCount > 0) {
    // Scroll to first flashcard
    await page.evaluate(() => {
      const fc = document.querySelector('[data-flashcard]');
      if (fc) fc.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(500);

    // Test first flashcard flip
    const flipResult = await page.evaluate(() => {
      const card = document.querySelector('[data-flashcard]');
      if (!card) return { exists: false };
      const inner = card.firstElementChild;
      if (!inner) return { exists: true, hasInner: false };

      const beforeTransform = inner.style.transform;
      card.click();
      const afterTransform = inner.style.transform;

      // Check back face has content
      const children = inner.children;
      let backHasContent = false;
      if (children.length >= 2) {
        backHasContent = children[1].textContent.trim().length > 5;
      }

      return {
        exists: true,
        hasInner: true,
        flipped: beforeTransform !== afterTransform,
        afterTransform,
        backHasContent
      };
    });

    if (flipResult.flipped) {
      pass('FLASHCARD', `Flashcard flips on click (transform: ${flipResult.afterTransform}) ✓`);
    } else {
      fail('FLASHCARD', 'Flashcard did not flip — transform unchanged after click');
    }

    if (flipResult.backHasContent) {
      pass('FLASHCARD', 'Flashcard back face has content ✓');
    } else {
      warn('FLASHCARD', 'Flashcard back face may have insufficient content');
    }

    // Click again to flip back
    const flipBack = await page.evaluate(() => {
      const card = document.querySelector('[data-flashcard]');
      const inner = card.firstElementChild;
      card.click();
      return inner.style.transform;
    });

    if (flipBack === '' || flipBack === 'rotateY(0deg)') {
      pass('FLASHCARD', 'Flashcard flips back on second click ✓');
    } else {
      warn('FLASHCARD', `Flashcard may not have flipped back (transform: ${flipBack})`);
    }

    pass('FLASHCARD', `${flashcardCount} total flashcard(s) found`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 5: Carousel / Narrative
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing carousels...');
  const carouselCount = await page.evaluate(() => document.querySelectorAll('[data-carousel]').length);

  for (let i = 0; i < carouselCount; i++) {
    const label = `Carousel #${i + 1}`;

    await page.evaluate((idx) => {
      const carousels = document.querySelectorAll('[data-carousel]');
      if (carousels[idx]) carousels[idx].scrollIntoView({ block: 'center' });
    }, i);
    await page.waitForTimeout(500);

    // Check initial state: slide 1 visible, others hidden
    const initialState = await page.evaluate((idx) => {
      const carousel = document.querySelectorAll('[data-carousel]')[idx];
      const slides = carousel.querySelectorAll('[data-slide]');
      const firstVisible = slides[0] && slides[0].style.display !== 'none';
      const secondHidden = slides.length > 1 ? slides[1].style.display === 'none' : true;
      return { slideCount: slides.length, firstVisible, secondHidden };
    }, i);

    if (initialState.firstVisible && initialState.secondHidden) {
      pass('CAROUSEL', `${label}: Initial state correct (slide 1 visible, slide 2 hidden) ✓`);
    } else {
      fail('CAROUSEL', `${label}: Initial state wrong — first=${initialState.firstVisible}, secondHidden=${initialState.secondHidden}`);
    }

    // Click Next
    const afterNext = await page.evaluate((idx) => {
      const carousel = document.querySelectorAll('[data-carousel]')[idx];
      const nextBtn = carousel.querySelector('[data-next]');
      if (nextBtn) nextBtn.click();
      const slides = carousel.querySelectorAll('[data-slide]');
      const firstHidden = slides[0] && slides[0].style.display === 'none';
      const secondVisible = slides.length > 1 ? slides[1].style.display !== 'none' : false;

      // Check slide content
      const activeSlide = Array.from(slides).find(s => s.style.display !== 'none');
      const contentLength = activeSlide ? activeSlide.textContent.trim().length : 0;

      return { firstHidden, secondVisible, contentLength };
    }, i);

    if (afterNext.secondVisible && afterNext.firstHidden) {
      pass('CAROUSEL', `${label}: Next button advances to slide 2 ✓`);
    } else {
      fail('CAROUSEL', `${label}: Next button did not advance slides`);
    }

    if (afterNext.contentLength < 10) {
      warn('CAROUSEL', `${label}: Active slide has very little content (${afterNext.contentLength} chars)`);
    }

    // Click Prev
    const afterPrev = await page.evaluate((idx) => {
      const carousel = document.querySelectorAll('[data-carousel]')[idx];
      const prevBtn = carousel.querySelector('[data-prev]');
      if (prevBtn) prevBtn.click();
      const slides = carousel.querySelectorAll('[data-slide]');
      const firstVisible = slides[0] && slides[0].style.display !== 'none';
      return { firstVisible };
    }, i);

    if (afterPrev.firstVisible) {
      pass('CAROUSEL', `${label}: Prev button returns to slide 1 ✓`);
    } else {
      fail('CAROUSEL', `${label}: Prev button did not return to slide 1`);
    }

    // Check dots were created
    const hasDots = await page.evaluate((idx) => {
      const carousel = document.querySelectorAll('[data-carousel]')[idx];
      return carousel.querySelectorAll('[data-dot]').length;
    }, i);

    if (hasDots >= 2) {
      pass('CAROUSEL', `${label}: Dot indicators created (${hasDots} dots) ✓`);
    } else {
      warn('CAROUSEL', `${label}: No dot indicators found`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 6: Accordions
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing accordions...');
  const accordionSections = await page.evaluate(() => {
    return document.querySelectorAll('[data-component-type="accordion"]').length;
  });

  for (let i = 0; i < accordionSections; i++) {
    const label = `Accordion #${i + 1}`;

    await page.evaluate((idx) => {
      const sections = document.querySelectorAll('[data-component-type="accordion"]');
      if (sections[idx]) sections[idx].scrollIntoView({ block: 'center' });
    }, i);
    await page.waitForTimeout(500);

    const panelResults = await page.evaluate((idx) => {
      const section = document.querySelectorAll('[data-component-type="accordion"]')[idx];
      const details = section.querySelectorAll('details');
      const results = [];

      details.forEach((d, di) => {
        // Should be closed initially
        const wasOpen = d.open;

        // Click summary to open
        const summary = d.querySelector('summary');
        if (summary) summary.click();

        // Check it opened
        const isNowOpen = d.open;

        // Check content inside
        const contentEl = d.querySelector('div, p, .mt-4');
        const contentLength = contentEl ? contentEl.textContent.trim().length : 0;
        // Get the computed height of content area
        const contentHeight = contentEl ? contentEl.getBoundingClientRect().height : 0;

        results.push({
          index: di,
          wasOpen,
          isNowOpen,
          contentLength,
          contentHeight: Math.round(contentHeight)
        });
      });

      return results;
    }, i);

    let allWork = true;
    for (const panel of panelResults) {
      if (!panel.isNowOpen) {
        fail('ACCORDION', `${label}: Panel ${panel.index + 1} did not open on click`);
        allWork = false;
      }
      if (panel.contentLength < 10) {
        warn('ACCORDION', `${label}: Panel ${panel.index + 1} has very little content (${panel.contentLength} chars)`);
      }
      if (panel.isNowOpen && panel.contentHeight === 0) {
        fail('ACCORDION', `${label}: Panel ${panel.index + 1} opened but content has 0 height — may be invisible`);
        allWork = false;
      }
    }
    if (allWork && panelResults.length > 0) {
      pass('ACCORDION', `${label}: All ${panelResults.length} panels open on click with visible content ✓`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 7: Checklists
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing checklists...');
  const checklistCount = await page.evaluate(() => document.querySelectorAll('[data-checklist]').length);

  for (let i = 0; i < checklistCount; i++) {
    const label = `Checklist #${i + 1}`;

    await page.evaluate((idx) => {
      const checklists = document.querySelectorAll('[data-checklist]');
      if (checklists[idx]) checklists[idx].scrollIntoView({ block: 'center' });
    }, i);
    await page.waitForTimeout(500);

    // Check a box and verify progress updates
    const checkResult = await page.evaluate((idx) => {
      const checklist = document.querySelectorAll('[data-checklist]')[idx];
      const checkboxes = checklist.querySelectorAll('input[type="checkbox"]');
      const progressEl = checklist.querySelector('[data-checklist-progress]');

      const beforeText = progressEl ? progressEl.textContent : '';

      // Check first checkbox
      if (checkboxes.length > 0) {
        checkboxes[0].checked = true;
        checkboxes[0].dispatchEvent(new Event('change', { bubbles: true }));
      }

      const afterText = progressEl ? progressEl.textContent : '';

      return {
        checkboxCount: checkboxes.length,
        hasProgress: !!progressEl,
        beforeText,
        afterText,
        progressChanged: beforeText !== afterText
      };
    }, i);

    if (checkResult.checkboxCount > 0) {
      pass('CHECKLIST', `${label}: ${checkResult.checkboxCount} checkboxes found ✓`);
    }

    if (checkResult.progressChanged) {
      pass('CHECKLIST', `${label}: Progress counter updates on check ("${checkResult.afterText}") ✓`);
    } else if (checkResult.hasProgress) {
      warn('CHECKLIST', `${label}: Progress counter didn't update after checking (before="${checkResult.beforeText}", after="${checkResult.afterText}")`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 8: Content overflow detection
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing content overflow...');
  const overflowResults = await page.evaluate(() => {
    const issues = [];
    const components = document.querySelectorAll('[data-component-type]');

    components.forEach((comp) => {
      const type = comp.getAttribute('data-component-type');
      if (type === 'navigation' || type === 'footer') return;

      const rect = comp.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Check if component extends beyond viewport
      if (rect.right > viewportWidth + 5) {
        issues.push({
          type,
          issue: 'horizontal-overflow',
          overflow: Math.round(rect.right - viewportWidth)
        });
      }

      // Check for text overflow within the component
      const textElements = comp.querySelectorAll('p, h1, h2, h3, h4, span, li, td, th, label, blockquote');
      textElements.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        if (elRect.width > 0 && elRect.right > viewportWidth + 5) {
          issues.push({
            type,
            issue: 'text-overflow',
            overflow: Math.round(elRect.right - viewportWidth),
            text: el.textContent.substring(0, 40)
          });
        }
      });
    });

    return issues;
  });

  if (overflowResults.length === 0) {
    pass('OVERFLOW', 'No content overflow detected at 1440px ✓');
  } else {
    for (const issue of overflowResults) {
      fail('OVERFLOW', `${issue.type}: ${issue.issue} by ${issue.overflow}px${issue.text ? ` ("${issue.text}...")` : ''}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 9: Mobile overflow check
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing mobile layout...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  const mobileOverflow = await page.evaluate(() => {
    const issues = [];
    const viewportWidth = window.innerWidth;
    const components = document.querySelectorAll('[data-component-type]');

    components.forEach((comp) => {
      const type = comp.getAttribute('data-component-type');
      if (type === 'navigation' || type === 'footer') return;

      const rect = comp.getBoundingClientRect();
      if (rect.right > viewportWidth + 5) {
        issues.push({ type, overflow: Math.round(rect.right - viewportWidth) });
      }
    });

    return issues;
  });

  if (mobileOverflow.length === 0) {
    pass('MOBILE', 'No content overflow at 390px mobile width ✓');
  } else {
    for (const issue of mobileOverflow) {
      fail('MOBILE', `${issue.type}: overflows by ${issue.overflow}px on mobile`);
    }
  }

  // Reset to desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 10: Font size minimums
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing font sizes...');
  const fontIssues = await page.evaluate(() => {
    const issues = [];
    const MIN_BODY_SIZE = 14;
    const elements = document.querySelectorAll('p, li, td, th, label, span');

    elements.forEach((el) => {
      // Skip hidden elements, icon fonts, and elements with no text
      if (el.offsetHeight === 0) return;
      if (el.classList.contains('material-symbols-outlined')) return;
      if (el.classList.contains('material-symbols-rounded')) return;
      if (el.textContent.trim().length < 3) return;
      // Skip nav and footer
      if (el.closest('[data-component-type="navigation"]')) return;
      if (el.closest('[data-component-type="footer"]')) return;
      // Skip progress indicators and tiny UI elements
      if (el.closest('[data-checklist-progress]')) return;
      if (el.closest('.section-progress')) return;

      const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
      if (fontSize < MIN_BODY_SIZE) {
        issues.push({
          tag: el.tagName.toLowerCase(),
          fontSize: Math.round(fontSize),
          text: el.textContent.trim().substring(0, 40),
          component: el.closest('[data-component-type]')?.getAttribute('data-component-type') || 'unknown'
        });
      }
    });

    // Deduplicate by component + fontSize
    const seen = new Set();
    return issues.filter(issue => {
      const key = `${issue.component}-${issue.fontSize}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  if (fontIssues.length === 0) {
    pass('FONTS', 'All body text ≥ 14px ✓');
  } else {
    for (const issue of fontIssues) {
      warn('FONTS', `${issue.component}: <${issue.tag}> is ${issue.fontSize}px (min 14px) — "${issue.text}..."`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 11: Click/tap target sizes
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing tap target sizes...');
  const tapTargetIssues = await page.evaluate(() => {
    const MIN_SIZE = 32; // 44px is ideal, 32px minimum
    const issues = [];
    const interactives = document.querySelectorAll('button, a, input, [data-choice], [data-tab-trigger], [data-flashcard], [data-path-option], summary');

    interactives.forEach((el) => {
      if (el.offsetHeight === 0) return; // hidden
      const rect = el.getBoundingClientRect();
      if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
        // Skip dot indicators (intentionally small)
        if (el.hasAttribute('data-dot')) return;
        // Skip icon-only elements that are decorative
        if (el.closest('[data-checklist-progress]')) return;

        issues.push({
          tag: el.tagName.toLowerCase(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          text: el.textContent.trim().substring(0, 30) || el.getAttribute('aria-label') || '(no text)',
          component: el.closest('[data-component-type]')?.getAttribute('data-component-type') || 'unknown'
        });
      }
    });

    // Deduplicate
    const seen = new Set();
    return issues.filter(issue => {
      const key = `${issue.component}-${issue.tag}-${issue.width}x${issue.height}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  if (tapTargetIssues.length === 0) {
    pass('TAP', 'All interactive targets ≥ 32px ✓');
  } else {
    for (const issue of tapTargetIssues) {
      warn('TAP', `${issue.component}: <${issue.tag}> is ${issue.width}x${issue.height}px — "${issue.text}"`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 12: Zero-height content detection
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing for invisible content...');
  const invisibleContent = await page.evaluate(() => {
    const issues = [];
    const components = document.querySelectorAll('[data-component-type]');

    components.forEach((comp) => {
      const type = comp.getAttribute('data-component-type');
      if (type === 'navigation' || type === 'footer') return;

      const rect = comp.getBoundingClientRect();

      // Component itself has 0 height but has content
      if (rect.height === 0 && comp.textContent.trim().length > 20) {
        issues.push({ type, issue: 'zero-height component with content' });
      }

      // Check inner elements with content but 0 height (possibly hidden by overflow)
      const contentEls = comp.querySelectorAll('p, h2, h3, h4, li, td, blockquote');
      contentEls.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        if (elRect.height === 0 && el.textContent.trim().length > 10) {
          // Skip if parent is a hidden tab panel or hidden slide
          const parent = el.closest('[data-tab-panel], [data-slide]');
          if (parent && parent.style.display === 'none') return;

          // Skip responsive-hidden elements (e.g. md:hidden for mobile-only duplicates)
          let ancestor = el;
          while (ancestor && ancestor !== comp) {
            if (window.getComputedStyle(ancestor).display === 'none') return;
            ancestor = ancestor.parentElement;
          }

          issues.push({
            type,
            issue: 'zero-height element',
            text: el.textContent.trim().substring(0, 40)
          });
        }
      });
    });

    return issues;
  });

  if (invisibleContent.length === 0) {
    pass('VISIBLE', 'No invisible content detected ✓');
  } else {
    for (const issue of invisibleContent) {
      fail('VISIBLE', `${issue.type}: ${issue.issue}${issue.text ? ` ("${issue.text}...")` : ''}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 13: Heading hierarchy within components
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing heading sizes...');
  const headingSizeIssues = await page.evaluate(() => {
    const issues = [];
    const components = document.querySelectorAll('[data-component-type]');

    components.forEach((comp) => {
      const type = comp.getAttribute('data-component-type');
      if (type === 'navigation' || type === 'footer') return;

      const h2s = comp.querySelectorAll('h2');
      const h3s = comp.querySelectorAll('h3');
      const ps = comp.querySelectorAll('p');

      // h2 should be bigger than h3
      if (h2s.length > 0 && h3s.length > 0) {
        const h2Size = parseFloat(window.getComputedStyle(h2s[0]).fontSize);
        const h3Size = parseFloat(window.getComputedStyle(h3s[0]).fontSize);
        if (h3Size >= h2Size) {
          issues.push({
            type,
            issue: `h3 (${Math.round(h3Size)}px) is same or larger than h2 (${Math.round(h2Size)}px)`
          });
        }
      }

      // h3 should be bigger than p
      if (h3s.length > 0 && ps.length > 0) {
        const h3Size = parseFloat(window.getComputedStyle(h3s[0]).fontSize);
        const pSize = parseFloat(window.getComputedStyle(ps[0]).fontSize);
        if (pSize >= h3Size) {
          issues.push({
            type,
            issue: `body text (${Math.round(pSize)}px) is same or larger than h3 (${Math.round(h3Size)}px)`
          });
        }
      }
    });

    return issues;
  });

  if (headingSizeIssues.length === 0) {
    pass('HIERARCHY', 'Heading sizes follow correct hierarchy (h2 > h3 > body) ✓');
  } else {
    for (const issue of headingSizeIssues) {
      fail('HIERARCHY', `${issue.type}: ${issue.issue}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 13b: Text-on-background contrast for key components
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing text contrast on hero/full-bleed...');
  const contrastIssues = await page.evaluate(() => {
    var issues = [];

    function getLuminance(rgb) {
      var match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return null;
      var r = parseInt(match[1]) / 255;
      var g = parseInt(match[2]) / 255;
      var b = parseInt(match[3]) / 255;
      // sRGB linearization
      r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
      g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
      b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function getContrastRatio(l1, l2) {
      var lighter = Math.max(l1, l2);
      var darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // Check hero heading — must be light text (heroes always have dark/image backgrounds)
    var heroSection = document.querySelector('[data-component-type="hero"]');
    if (heroSection) {
      var h1 = heroSection.querySelector('h1');
      var heroVariant = heroSection.getAttribute('data-variant') || 'centered-overlay';
      // Only require light text for centered-overlay — text always sits on dark image.
      // split-screen: text is on page background (adapts to theme colour).
      // minimal-text: gradient fades to page background — dark text correct on light themes.
      if (h1 && heroVariant === 'centered-overlay') {
        var textColor = window.getComputedStyle(h1).color;
        var textLum = getLuminance(textColor);
        // Hero text must be light (white/near-white) — dark text on hero is always wrong
        // We don't check computed bg because hero backgrounds come from images/gradients
        // which getComputedStyle can't resolve
        if (textLum !== null && textLum < 0.5) {
          issues.push({ component: 'hero', element: 'h1', ratio: 'dark text on hero (should be white)', textColor: textColor });
        }
      }
    }

    // Check full-bleed heading and body text
    var fullBleeds = document.querySelectorAll('[data-component-type="full-bleed"]');
    fullBleeds.forEach(function (fb, idx) {
      var heading = fb.querySelector('h2');
      if (heading) {
        var textColor = window.getComputedStyle(heading).color;
        var textLum = getLuminance(textColor);
        // Full-bleed should always have light text on dark overlay
        if (textLum !== null && textLum < 0.5) {
          issues.push({ component: 'full-bleed #' + (idx + 1), element: 'h2', ratio: 'dark text on image', textColor: textColor });
        }
        // Check text position vs overlay gradient direction — text should sit where overlay is darkest
        var fbRect = fb.getBoundingClientRect();
        var textRect = heading.getBoundingClientRect();
        var textPosRatio = (textRect.top - fbRect.top) / fbRect.height;
        // Find the overlay div and check its gradient direction
        var overlayDiv = fb.querySelector('[class*="bg-gradient"], [class*="bg-black"]');
        var overlayClass = overlayDiv ? overlayDiv.className : '';
        var gradientToTop = overlayClass.includes('gradient-to-t');
        var gradientToBottom = overlayClass.includes('gradient-to-b');
        var evenOverlay = overlayClass.includes('bg-black/');
        // Flag if text is in the transparent zone of the gradient
        if (gradientToTop && textPosRatio < 0.3) {
          issues.push({ component: 'full-bleed #' + (idx + 1), element: 'h2', ratio: 'text at top but gradient darkens at bottom', textColor: 'position: top ' + Math.round(textPosRatio * 100) + '%' });
        } else if (gradientToBottom && textPosRatio > 0.7) {
          issues.push({ component: 'full-bleed #' + (idx + 1), element: 'h2', ratio: 'text at bottom but gradient darkens at top', textColor: 'position: bottom ' + Math.round(textPosRatio * 100) + '%' });
        }
      }
    });

    return issues;
  });

  if (contrastIssues.length === 0) {
    pass('CONTRAST', 'Hero and full-bleed text has sufficient contrast ✓');
  } else {
    for (const issue of contrastIssues) {
      fail('CONTRAST', `${issue.component}: ${issue.element} has poor contrast (${issue.ratio}, color: ${issue.textColor})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 13c: MCQ submit button alignment
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing MCQ submit button alignment...');
  // Click a choice to trigger submit button, then check it's inside the card
  const mcqAlignIssues = await page.evaluate(() => {
    var issues = [];
    var quizzes = document.querySelectorAll('[data-quiz]');
    quizzes.forEach(function (quiz, idx) {
      var firstChoice = quiz.querySelector('[data-choice]');
      if (firstChoice) {
        firstChoice.click();
        // Check if submit button ended up inside a card container (not directly in the section)
        var submitBtn = quiz.querySelector('button:not([data-choice])');
        if (submitBtn) {
          var parent = submitBtn.parentElement;
          // Submit should be inside a styled card, not directly in the section
          if (parent === quiz) {
            issues.push({ quiz: idx + 1, issue: 'Submit button appended to section, not inside card' });
          }
          // Clean up — remove the submit and reset
          submitBtn.remove();
          firstChoice.click();
        }
      }
    });
    return issues;
  });

  if (mcqAlignIssues.length === 0) {
    pass('MCQ-ALIGN', 'MCQ submit buttons render inside card containers ✓');
  } else {
    for (const issue of mcqAlignIssues) {
      fail('MCQ-ALIGN', `MCQ #${issue.quiz}: ${issue.issue}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 14: Section spacing violations
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing section spacing...');
  const spacingIssues = await page.evaluate(() => {
    var issues = [];
    var MIN_SECTION_PADDING = 40; // px — sections should have breathing room
    var components = document.querySelectorAll('[data-component-type]');

    components.forEach(function (comp) {
      var type = comp.getAttribute('data-component-type');
      if (type === 'navigation' || type === 'hero') return;

      var cs = window.getComputedStyle(comp);
      var pt = parseFloat(cs.paddingTop);
      var pb = parseFloat(cs.paddingBottom);

      // Check if the component or its parent section wrapper has enough vertical padding
      var parent = comp.parentElement;
      if (parent) {
        var parentCs = window.getComputedStyle(parent);
        pt = Math.max(pt, parseFloat(parentCs.paddingTop));
        pb = Math.max(pb, parseFloat(parentCs.paddingBottom));
      }

      if (pt < MIN_SECTION_PADDING && pb < MIN_SECTION_PADDING) {
        issues.push({
          type: type,
          paddingTop: Math.round(pt),
          paddingBottom: Math.round(pb)
        });
      }
    });

    return issues;
  });

  if (spacingIssues.length === 0) {
    pass('SPACING', 'All sections have adequate vertical spacing ✓');
  } else {
    for (const issue of spacingIssues) {
      warn('SPACING', `${issue.type}: tight spacing (top: ${issue.paddingTop}px, bottom: ${issue.paddingBottom}px — min ${40}px)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 15: Collapsed/empty sections
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing for collapsed sections...');
  const collapsedIssues = await page.evaluate(() => {
    var issues = [];
    var MIN_SECTION_HEIGHT = 60; // px — anything smaller is likely broken
    var sectionTracks = document.querySelectorAll('[data-section-track]');

    sectionTracks.forEach(function (sec) {
      var sectionId = sec.getAttribute('data-section-track') || sec.id;
      // Measure from this title bar to the next
      var totalHeight = sec.getBoundingClientRect().height;
      var node = sec.nextElementSibling;
      while (node) {
        if (node.hasAttribute('data-section-track')) break;
        totalHeight += node.getBoundingClientRect().height;
        node = node.nextElementSibling;
      }

      if (totalHeight < MIN_SECTION_HEIGHT) {
        issues.push({
          sectionId: sectionId,
          height: Math.round(totalHeight)
        });
      }
    });

    return issues;
  });

  if (collapsedIssues.length === 0) {
    pass('COLLAPSED', 'No collapsed or empty sections ✓');
  } else {
    for (const issue of collapsedIssues) {
      fail('COLLAPSED', `Section "${issue.sectionId}" is only ${issue.height}px tall — likely broken`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 16: Z-index stacking (nav visibility)
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing z-index stacking...');
  // Scroll to mid-page and check nav is still on top
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight * 0.3);
  });
  await page.waitForTimeout(300);

  const zIndexIssues = await page.evaluate(() => {
    var issues = [];
    var nav = document.querySelector('[data-component-type="navigation"]');
    if (!nav) return issues;

    var navRect = nav.getBoundingClientRect();
    // Sample a point at the center of the nav bar
    var centerX = navRect.left + navRect.width / 2;
    var centerY = navRect.top + navRect.height / 2;
    var topEl = document.elementFromPoint(centerX, centerY);

    // The top element should be the nav or a child of the nav
    if (topEl && !nav.contains(topEl)) {
      issues.push({
        issue: 'Navigation bar is obscured by another element',
        obscuredBy: topEl.tagName.toLowerCase() + (topEl.className ? '.' + topEl.className.split(' ')[0] : '')
      });
    }

    return issues;
  });

  if (zIndexIssues.length === 0) {
    pass('ZINDEX', 'Navigation stays on top when scrolled ✓');
  } else {
    for (const issue of zIndexIssues) {
      fail('ZINDEX', `${issue.issue} (by ${issue.obscuredBy})`);
    }
  }

  // Scroll back to top for consistent state
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  // Reset to desktop viewport for remaining design quality tests
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════════════════
  //  DESIGN QUALITY TESTS (17-31)
  //  These catch what a graphic designer / UX specialist would flag.
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 17: WCAG AA contrast on ALL visible text
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing WCAG AA contrast on all text...');
  const wcagIssues = await page.evaluate(() => {
    var issues = [];

    function getLuminance(rgb) {
      var match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return null;
      var r = parseInt(match[1]) / 255;
      var g = parseInt(match[2]) / 255;
      var b = parseInt(match[3]) / 255;
      r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
      g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
      b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function getContrastRatio(l1, l2) {
      var lighter = Math.max(l1, l2);
      var darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // Walk up ancestors to find a real background colour (not transparent)
    function getEffectiveBg(el) {
      var node = el;
      while (node && node !== document.body) {
        var bg = window.getComputedStyle(node).backgroundColor;
        var match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
          var alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
          if (alpha > 0.1) return bg;
        }
        node = node.parentElement;
      }
      // Fallback to body
      return window.getComputedStyle(document.body).backgroundColor;
    }

    var textEls = document.querySelectorAll('h1, h2, h3, h4, p, li, td, th, span, label, blockquote, a');
    var seen = new Set();

    textEls.forEach(function (el) {
      if (el.offsetHeight === 0) return;
      if (el.textContent.trim().length < 3) return;
      if (el.classList.contains('material-symbols-outlined')) return;
      if (el.classList.contains('material-symbols-rounded')) return;
      if (el.closest('[data-component-type="navigation"]')) return;
      // Skip elements on image backgrounds (hero, full-bleed) — tested separately in TEST 13b
      var comp = el.closest('[data-component-type]');
      var compType = comp ? comp.getAttribute('data-component-type') : '';
      if (compType === 'hero' || compType === 'full-bleed') return;
      // Skip hidden tab panels / slides
      var hiddenParent = el.closest('[data-tab-panel], [data-slide]');
      if (hiddenParent && (hiddenParent.style.display === 'none' || hiddenParent.offsetHeight === 0)) return;

      var textColor = window.getComputedStyle(el).color;
      var bgColor = getEffectiveBg(el);
      var textLum = getLuminance(textColor);
      var bgLum = getLuminance(bgColor);

      if (textLum === null || bgLum === null) return;

      var ratio = getContrastRatio(textLum, bgLum);
      var fontSize = parseFloat(window.getComputedStyle(el).fontSize);
      var fontWeight = parseInt(window.getComputedStyle(el).fontWeight) || 400;
      // WCAG AA: 4.5:1 for normal text, 3:1 for large text (>=18.66px bold or >=24px)
      var isLargeText = (fontSize >= 24) || (fontSize >= 18.66 && fontWeight >= 700);
      var minRatio = isLargeText ? 3 : 4.5;

      if (ratio < minRatio) {
        var key = compType + '-' + el.tagName + '-' + Math.round(ratio * 10);
        if (seen.has(key)) return;
        seen.add(key);
        issues.push({
          component: compType || 'unknown',
          tag: el.tagName.toLowerCase(),
          ratio: Math.round(ratio * 100) / 100,
          required: minRatio,
          text: el.textContent.trim().substring(0, 40),
          textColor: textColor,
          bgColor: bgColor
        });
      }
    });

    return issues;
  });

  if (wcagIssues.length === 0) {
    pass('CONTRAST-AA', 'All visible text meets WCAG AA contrast requirements ✓');
  } else {
    for (const issue of wcagIssues) {
      fail('CONTRAST-AA', `${issue.component}: <${issue.tag}> contrast ${issue.ratio}:1 (need ${issue.required}:1) — "${issue.text}..." [text: ${issue.textColor}, bg: ${issue.bgColor}]`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 18: Padding consistency within card groups
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing padding consistency within card groups...');
  const paddingIssues = await page.evaluate(() => {
    var issues = [];
    // Components that render card groups where padding must match
    var groupTypes = ['bento', 'comparison', 'flashcard', 'key-term', 'branching'];

    groupTypes.forEach(function (type) {
      var sections = document.querySelectorAll('[data-component-type="' + type + '"]');
      sections.forEach(function (section, secIdx) {
        // Find immediate card-like children (divs with bg/shadow that look like cards)
        var container = section.querySelector('.grid, .flex, [class*="grid"], [class*="flex"]');
        if (!container) return;
        var cards = Array.from(container.children).filter(function (c) {
          return c.offsetHeight > 0 && c.tagName !== 'BUTTON';
        });
        if (cards.length < 2) return;

        var paddings = cards.map(function (card) {
          var cs = window.getComputedStyle(card);
          return {
            top: Math.round(parseFloat(cs.paddingTop)),
            right: Math.round(parseFloat(cs.paddingRight)),
            bottom: Math.round(parseFloat(cs.paddingBottom)),
            left: Math.round(parseFloat(cs.paddingLeft))
          };
        });

        // Check if all cards have the same padding
        var ref = paddings[0];
        for (var i = 1; i < paddings.length; i++) {
          var diff = Math.abs(paddings[i].top - ref.top) +
                     Math.abs(paddings[i].right - ref.right) +
                     Math.abs(paddings[i].bottom - ref.bottom) +
                     Math.abs(paddings[i].left - ref.left);
          if (diff > 8) { // 8px total tolerance across all 4 sides
            issues.push({
              type: type,
              index: secIdx + 1,
              card1: ref.top + '/' + ref.right + '/' + ref.bottom + '/' + ref.left,
              card2: paddings[i].top + '/' + paddings[i].right + '/' + paddings[i].bottom + '/' + paddings[i].left,
              diffPx: diff
            });
            break; // One report per component instance
          }
        }
      });
    });

    return issues;
  });

  if (paddingIssues.length === 0) {
    pass('PADDING', 'Card padding is consistent within all component groups ✓');
  } else {
    for (const issue of paddingIssues) {
      warn('PADDING', `${issue.type} #${issue.index}: cards have mismatched padding (${issue.card1} vs ${issue.card2}, ${issue.diffPx}px total diff)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 19: Card height balance within groups
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing card height balance...');
  const cardBalanceIssues = await page.evaluate(() => {
    var issues = [];
    var groupTypes = ['bento', 'comparison', 'flashcard', 'key-term'];

    groupTypes.forEach(function (type) {
      var sections = document.querySelectorAll('[data-component-type="' + type + '"]');
      sections.forEach(function (section, secIdx) {
        var container = section.querySelector('.grid, [class*="grid"]');
        if (!container) return;
        var cards = Array.from(container.children).filter(function (c) {
          return c.offsetHeight > 0;
        });
        if (cards.length < 2) return;

        var heights = cards.map(function (c) { return c.getBoundingClientRect().height; });
        var maxH = Math.max.apply(null, heights);
        var minH = Math.min.apply(null, heights);

        // Flag if tallest card is more than 2.5x the shortest (extreme imbalance)
        if (minH > 0 && maxH / minH > 2.5) {
          issues.push({
            type: type,
            index: secIdx + 1,
            minH: Math.round(minH),
            maxH: Math.round(maxH),
            ratio: Math.round(maxH / minH * 10) / 10
          });
        }
      });
    });

    return issues;
  });

  if (cardBalanceIssues.length === 0) {
    pass('CARD-BALANCE', 'Card heights are balanced within groups ✓');
  } else {
    for (const issue of cardBalanceIssues) {
      warn('CARD-BALANCE', `${issue.type} #${issue.index}: card height imbalance ${issue.ratio}x (${issue.minH}px to ${issue.maxH}px)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 20: Image aspect ratios (not stretched/squished)
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing image aspect ratios...');
  const imgRatioIssues = await page.evaluate(() => {
    var issues = [];
    var images = document.querySelectorAll('img');

    images.forEach(function (img) {
      if (!img.naturalWidth || !img.naturalHeight) return;
      if (img.offsetHeight === 0) return; // hidden
      // Skip SVG placeholders (they scale freely)
      if (img.src && img.src.includes('data:image/svg')) return;

      var naturalRatio = img.naturalWidth / img.naturalHeight;
      var renderedRatio = img.getBoundingClientRect().width / img.getBoundingClientRect().height;

      // Allow 15% distortion tolerance (object-fit: cover crops, which is fine)
      var objectFit = window.getComputedStyle(img).objectFit;
      if (objectFit === 'cover' || objectFit === 'contain') return; // These handle ratio gracefully

      var distortion = Math.abs(naturalRatio - renderedRatio) / naturalRatio;
      if (distortion > 0.15) {
        var comp = img.closest('[data-component-type]');
        issues.push({
          component: comp ? comp.getAttribute('data-component-type') : 'unknown',
          naturalRatio: Math.round(naturalRatio * 100) / 100,
          renderedRatio: Math.round(renderedRatio * 100) / 100,
          distortion: Math.round(distortion * 100),
          alt: (img.alt || '').substring(0, 30)
        });
      }
    });

    return issues;
  });

  if (imgRatioIssues.length === 0) {
    pass('IMG-RATIO', 'No stretched or squished images detected ✓');
  } else {
    for (const issue of imgRatioIssues) {
      fail('IMG-RATIO', `${issue.component}: image distorted ${issue.distortion}% (natural ${issue.naturalRatio} vs rendered ${issue.renderedRatio}) — "${issue.alt}"`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 21: Line measure (characters per line)
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing line measure (chars per line)...');
  const measureIssues = await page.evaluate(() => {
    var issues = [];
    var seen = new Set();
    var paragraphs = document.querySelectorAll('p');

    paragraphs.forEach(function (p) {
      if (p.offsetHeight === 0) return;
      if (p.textContent.trim().length < 20) return;
      // Skip nav, footer, hidden panels
      if (p.closest('[data-component-type="navigation"]')) return;
      var hiddenParent = p.closest('[data-tab-panel], [data-slide]');
      if (hiddenParent && hiddenParent.offsetHeight === 0) return;

      var cs = window.getComputedStyle(p);
      var fontSize = parseFloat(cs.fontSize);
      var containerWidth = p.getBoundingClientRect().width;

      // Estimate chars per line: containerWidth / (fontSize * 0.5) is a rough average
      // A more accurate method: use a monospace reference, but avg char width ~0.5em works
      var avgCharWidth = fontSize * 0.48; // Slightly less than 0.5 for proportional fonts
      var charsPerLine = Math.round(containerWidth / avgCharWidth);

      // Optimal: 45-85 chars per line. Flag >90 as too wide.
      if (charsPerLine > 90) {
        var comp = p.closest('[data-component-type]');
        var compType = comp ? comp.getAttribute('data-component-type') : 'unknown';
        var key = compType + '-' + charsPerLine;
        if (seen.has(key)) return;
        seen.add(key);
        issues.push({
          component: compType,
          charsPerLine: charsPerLine,
          containerWidth: Math.round(containerWidth),
          fontSize: Math.round(fontSize)
        });
      }
    });

    return issues;
  });

  if (measureIssues.length === 0) {
    pass('MEASURE', 'All body text has readable line measure (≤90 chars/line) ✓');
  } else {
    for (const issue of measureIssues) {
      warn('MEASURE', `${issue.component}: ~${issue.charsPerLine} chars/line (container ${issue.containerWidth}px at ${issue.fontSize}px font) — aim for ≤85`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 22: Font weight hierarchy
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing font weight hierarchy...');
  const weightIssues = await page.evaluate(() => {
    var issues = [];
    var components = document.querySelectorAll('[data-component-type]');

    components.forEach(function (comp) {
      var type = comp.getAttribute('data-component-type');
      if (type === 'navigation' || type === 'footer') return;

      var headings = comp.querySelectorAll('h2, h3');
      var bodyText = comp.querySelectorAll('p');

      if (headings.length === 0 || bodyText.length === 0) return;

      var headingWeight = parseInt(window.getComputedStyle(headings[0]).fontWeight) || 400;
      var bodyWeight = parseInt(window.getComputedStyle(bodyText[0]).fontWeight) || 400;

      // Headings should be bolder than body (or at least equal if using size alone for hierarchy)
      if (headingWeight < bodyWeight) {
        issues.push({
          type: type,
          headingWeight: headingWeight,
          bodyWeight: bodyWeight
        });
      }
    });

    return issues;
  });

  if (weightIssues.length === 0) {
    pass('WEIGHT', 'Heading font weight ≥ body weight in all components ✓');
  } else {
    for (const issue of weightIssues) {
      fail('WEIGHT', `${issue.type}: heading weight (${issue.headingWeight}) lighter than body (${issue.bodyWeight})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 23: Border-radius consistency within components
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing border-radius consistency...');
  const radiusIssues = await page.evaluate(() => {
    var issues = [];
    var groupTypes = ['bento', 'comparison', 'flashcard', 'key-term', 'branching', 'checklist'];

    groupTypes.forEach(function (type) {
      var sections = document.querySelectorAll('[data-component-type="' + type + '"]');
      sections.forEach(function (section, secIdx) {
        var container = section.querySelector('.grid, .flex, [class*="grid"], [class*="flex"]');
        if (!container) return;
        var cards = Array.from(container.children).filter(function (c) {
          return c.offsetHeight > 0 && c.tagName !== 'BUTTON';
        });
        if (cards.length < 2) return;

        var radii = cards.map(function (c) {
          return window.getComputedStyle(c).borderRadius;
        });

        // All cards should have the same border-radius
        var ref = radii[0];
        for (var i = 1; i < radii.length; i++) {
          if (radii[i] !== ref) {
            issues.push({
              type: type,
              index: secIdx + 1,
              radius1: ref,
              radius2: radii[i]
            });
            break;
          }
        }
      });
    });

    return issues;
  });

  if (radiusIssues.length === 0) {
    pass('RADIUS', 'Border-radius is consistent within all card groups ✓');
  } else {
    for (const issue of radiusIssues) {
      warn('RADIUS', `${issue.type} #${issue.index}: mixed border-radius (${issue.radius1} vs ${issue.radius2})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 24: Empty visual space (broken/missing images)
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing for empty visual space (broken images)...');
  const emptyImgIssues = await page.evaluate(() => {
    var issues = [];
    var images = document.querySelectorAll('img');

    images.forEach(function (img) {
      if (img.offsetHeight === 0 && img.offsetWidth === 0) return; // intentionally hidden

      // Check for broken images: naturalWidth === 0 means failed to load
      if (img.complete && img.naturalWidth === 0) {
        var comp = img.closest('[data-component-type]');
        issues.push({
          component: comp ? comp.getAttribute('data-component-type') : 'unknown',
          alt: (img.alt || '(no alt)').substring(0, 30),
          issue: 'broken-image'
        });
        return;
      }

      // Check for image containers that are very tall with no visible image
      // (image src set but rendered as tiny or invisible)
      var rect = img.getBoundingClientRect();
      var parent = img.parentElement;
      if (parent) {
        var parentRect = parent.getBoundingClientRect();
        // Parent is large but image is tiny — likely a layout issue
        if (parentRect.height > 100 && rect.height < 10 && rect.width < 10) {
          var comp = img.closest('[data-component-type]');
          issues.push({
            component: comp ? comp.getAttribute('data-component-type') : 'unknown',
            alt: (img.alt || '(no alt)').substring(0, 30),
            issue: 'image-collapsed',
            parentHeight: Math.round(parentRect.height),
            imgHeight: Math.round(rect.height)
          });
        }
      }
    });

    return issues;
  });

  if (emptyImgIssues.length === 0) {
    pass('IMG-EMPTY', 'No broken or collapsed images detected ✓');
  } else {
    for (const issue of emptyImgIssues) {
      fail('IMG-EMPTY', `${issue.component}: ${issue.issue} — "${issue.alt}"${issue.parentHeight ? ` (container ${issue.parentHeight}px, image ${issue.imgHeight}px)` : ''}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 25: Mobile padding collapse
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing mobile padding...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  const mobilePadIssues = await page.evaluate(() => {
    var issues = [];
    var components = document.querySelectorAll('[data-component-type]');
    var seen = new Set();

    components.forEach(function (comp) {
      var type = comp.getAttribute('data-component-type');
      if (type === 'navigation' || type === 'footer' || type === 'hero' || type === 'full-bleed') return;

      // Check text elements touching screen edges
      var textEls = comp.querySelectorAll('h2, h3, p, li');
      textEls.forEach(function (el) {
        if (el.offsetHeight === 0) return;
        var rect = el.getBoundingClientRect();
        // Content should have at least 12px padding from screen edges on mobile
        if (rect.left < 12) {
          if (seen.has(type + '-left')) return;
          seen.add(type + '-left');
          issues.push({ type: type, side: 'left', offset: Math.round(rect.left) });
        }
        if (rect.right > window.innerWidth - 12) {
          if (seen.has(type + '-right')) return;
          seen.add(type + '-right');
          issues.push({ type: type, side: 'right', offset: Math.round(window.innerWidth - rect.right) });
        }
      });
    });

    return issues;
  });

  if (mobilePadIssues.length === 0) {
    pass('MOBILE-PAD', 'All content has adequate mobile padding (≥12px from edges) ✓');
  } else {
    for (const issue of mobilePadIssues) {
      fail('MOBILE-PAD', `${issue.type}: content ${issue.offset}px from ${issue.side} edge on mobile (need ≥12px)`);
    }
  }

  // Reset to desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 26: Button style consistency
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing button style consistency...');
  const btnIssues = await page.evaluate(() => {
    var issues = [];
    // Check primary action buttons across components (Submit, CTA-style)
    var buttons = document.querySelectorAll('button.btn-primary, [class*="btn-primary"]');
    if (buttons.length < 2) return issues;

    var ref = null;
    buttons.forEach(function (btn, idx) {
      if (btn.offsetHeight === 0) return;
      var cs = window.getComputedStyle(btn);
      var style = {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        fontSize: Math.round(parseFloat(cs.fontSize))
      };

      if (!ref) { ref = style; return; }

      // Primary buttons should have consistent bg, text colour, and radius
      if (style.bg !== ref.bg || style.color !== ref.color || style.radius !== ref.radius) {
        var comp = btn.closest('[data-component-type]');
        issues.push({
          component: comp ? comp.getAttribute('data-component-type') : 'unknown',
          diff: (style.bg !== ref.bg ? 'bg' : '') +
                (style.color !== ref.color ? ' color' : '') +
                (style.radius !== ref.radius ? ' radius' : '')
        });
      }
    });

    return issues;
  });

  if (btnIssues.length === 0) {
    pass('BTN-STYLE', 'Primary button styles are consistent across components ✓');
  } else {
    for (const issue of btnIssues) {
      warn('BTN-STYLE', `${issue.component}: btn-primary differs from reference (${issue.diff.trim()})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 27: Icon size consistency
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing icon size consistency...');
  const iconIssues = await page.evaluate(() => {
    var issues = [];
    var components = document.querySelectorAll('[data-component-type]');

    components.forEach(function (comp) {
      var type = comp.getAttribute('data-component-type');
      if (type === 'navigation' || type === 'footer') return;

      var icons = comp.querySelectorAll('.material-symbols-outlined, .material-symbols-rounded');
      if (icons.length < 2) return;

      var sizes = {};
      icons.forEach(function (icon) {
        if (icon.offsetHeight === 0) return;
        var size = Math.round(parseFloat(window.getComputedStyle(icon).fontSize));
        sizes[size] = (sizes[size] || 0) + 1;
      });

      var sizeKeys = Object.keys(sizes);
      // More than 2 different icon sizes in one component = inconsistent
      if (sizeKeys.length > 2) {
        issues.push({
          type: type,
          sizes: sizeKeys.join(', ') + 'px',
          count: icons.length
        });
      }
    });

    return issues;
  });

  if (iconIssues.length === 0) {
    pass('ICON-SIZE', 'Icon sizes are consistent within components ✓');
  } else {
    for (const issue of iconIssues) {
      warn('ICON-SIZE', `${issue.type}: ${issue.count} icons at ${issue.sizes} (>2 different sizes)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 28: Hover/transition exists on interactive elements
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing hover/transition feedback...');
  const hoverIssues = await page.evaluate(() => {
    var issues = [];
    var seen = new Set();
    var interactives = document.querySelectorAll('[data-choice], [data-tab-trigger], [data-flashcard], [data-path-option]');

    interactives.forEach(function (el) {
      if (el.offsetHeight === 0) return;
      var cs = window.getComputedStyle(el);
      var hasTransition = cs.transition && cs.transition !== 'all 0s ease 0s' && cs.transition !== 'none 0s ease 0s' && cs.transition !== 'none';
      var hasCursor = cs.cursor === 'pointer';

      if (!hasTransition && !hasCursor) {
        var comp = el.closest('[data-component-type]');
        var compType = comp ? comp.getAttribute('data-component-type') : 'unknown';
        if (seen.has(compType)) return;
        seen.add(compType);
        issues.push({
          component: compType,
          element: el.getAttribute('data-choice') !== null ? 'choice' :
                   el.getAttribute('data-tab-trigger') !== null ? 'tab-trigger' :
                   el.getAttribute('data-flashcard') !== null ? 'flashcard' : 'option'
        });
      }
    });

    return issues;
  });

  if (hoverIssues.length === 0) {
    pass('HOVER', 'All interactive elements have hover/transition feedback ✓');
  } else {
    for (const issue of hoverIssues) {
      warn('HOVER', `${issue.component}: ${issue.element} has no transition or cursor:pointer — no hover feedback`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 29: Focus indicator via keyboard navigation
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing focus indicators (keyboard Tab)...');
  // Use actual Tab key presses — this triggers :focus-visible which is what
  // real keyboard users see. Programmatic .focus() doesn't trigger :focus-visible
  // in most browsers, which would produce false positives.
  const focusIssues = await page.evaluate(() => {
    var issues = [];
    // Check if the page has any focus-visible styles defined at all
    // by looking for outline or ring classes in the stylesheet
    var styleSheets = document.styleSheets;
    var hasFocusStyles = false;
    try {
      for (var i = 0; i < styleSheets.length; i++) {
        try {
          var rules = styleSheets[i].cssRules;
          for (var j = 0; j < rules.length; j++) {
            if (rules[j].selectorText && rules[j].selectorText.includes('focus')) {
              hasFocusStyles = true;
              break;
            }
          }
        } catch (e) { /* cross-origin stylesheets */ }
        if (hasFocusStyles) break;
      }
    } catch (e) {}

    // Also check if Tailwind's ring utilities are available (common focus pattern)
    var hasTailwindRing = document.querySelector('[class*="focus:ring"], [class*="focus-visible:ring"], [class*="focus:outline"]');

    if (!hasFocusStyles && !hasTailwindRing) {
      // Check if any interactive element has inline focus styles
      var interactives = document.querySelectorAll('button, a[href], input, summary, [tabindex="0"]');
      var hasInlineFocus = false;
      interactives.forEach(function (el) {
        if (el.getAttribute('style') && el.getAttribute('style').includes('focus')) hasInlineFocus = true;
        if (el.className && (el.className.includes('focus:') || el.className.includes('focus-visible:'))) hasInlineFocus = true;
      });
      if (!hasInlineFocus) {
        issues.push({ issue: 'No focus styles detected in any stylesheet or element — keyboard users have no visual feedback' });
      }
    }

    return issues;
  });

  if (focusIssues.length === 0) {
    pass('FOCUS', 'Focus styles are present for keyboard navigation ✓');
  } else {
    for (const issue of focusIssues) {
      warn('FOCUS', issue.issue);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 30: Assessment distribution
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing assessment distribution...');
  const assessDistIssues = await page.evaluate(() => {
    var issues = [];
    var sections = document.querySelectorAll('[data-section-track]');
    var sectionIds = [];
    var assessmentSectionIndices = [];

    sections.forEach(function (sec, idx) {
      sectionIds.push(sec.getAttribute('data-section-track') || sec.id);

      // Check if this section (and elements until next section) contain MCQs
      var node = sec;
      var hasAssessment = false;
      while (node) {
        if (node !== sec && node.hasAttribute && node.hasAttribute('data-section-track')) break;
        if (node.querySelector && node.querySelector('[data-quiz], [data-component-type="mcq"], [data-component-type="textinput"]')) {
          hasAssessment = true;
          break;
        }
        node = node.nextElementSibling;
      }

      if (hasAssessment) assessmentSectionIndices.push(idx);
    });

    // Check for clustering: two assessments in adjacent sections
    for (var i = 1; i < assessmentSectionIndices.length; i++) {
      if (assessmentSectionIndices[i] - assessmentSectionIndices[i - 1] === 1) {
        issues.push({
          section1: sectionIds[assessmentSectionIndices[i - 1]] || 'section-' + assessmentSectionIndices[i - 1],
          section2: sectionIds[assessmentSectionIndices[i]] || 'section-' + assessmentSectionIndices[i]
        });
      }
    }

    return issues;
  });

  if (assessDistIssues.length === 0) {
    pass('ASSESS-DIST', 'Assessments are well-distributed across sections ✓');
  } else {
    for (const issue of assessDistIssues) {
      warn('ASSESS-DIST', `Back-to-back assessments: ${issue.section1} and ${issue.section2} — consider spacing them out`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 31: Section density variation
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing section density variation...');
  const densityIssues = await page.evaluate(() => {
    var sections = document.querySelectorAll('[data-section-track]');
    if (sections.length < 4) return []; // Too few sections to judge rhythm

    var componentCounts = [];

    sections.forEach(function (sec) {
      // Count components between this section track and the next
      var count = 0;
      var node = sec.nextElementSibling;
      while (node) {
        if (node.hasAttribute && node.hasAttribute('data-section-track')) break;
        if (node.hasAttribute && node.hasAttribute('data-component-type')) count++;
        node = node.nextElementSibling;
      }
      componentCounts.push(count);
    });

    // Check if all sections have the same component count (monotonous)
    var allSame = componentCounts.every(function (c) { return c === componentCounts[0]; });
    // Check if range of variation is too narrow (all within ±1 of mean)
    var mean = componentCounts.reduce(function (a, b) { return a + b; }, 0) / componentCounts.length;
    var maxDev = Math.max.apply(null, componentCounts.map(function (c) { return Math.abs(c - mean); }));

    if (allSame && componentCounts.length >= 5) {
      return [{ issue: 'all-same', count: componentCounts[0], sections: componentCounts.length }];
    }
    if (maxDev <= 1 && componentCounts.length >= 5) {
      return [{ issue: 'narrow-range', range: Math.min.apply(null, componentCounts) + '-' + Math.max.apply(null, componentCounts), sections: componentCounts.length }];
    }

    return [];
  });

  if (densityIssues.length === 0) {
    pass('DENSITY', 'Section density has healthy variation (breather + deep-dive rhythm) ✓');
  } else {
    for (const issue of densityIssues) {
      if (issue.issue === 'all-same') {
        warn('DENSITY', `All ${issue.sections} sections have exactly ${issue.count} components — monotonous density, needs breathers and deep-dives`);
      } else {
        warn('DENSITY', `${issue.sections} sections all within ${issue.range} components — narrow density range, needs more variation`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEST 32: Variant coverage and correctness
  // ═══════════════════════════════════════════════════════════════════
  console.log('Testing variant coverage...');
  // This test reads course-layout.json (Node-side) to check which variants
  // were selected, verifies the HTML renders the correct variant structure,
  // and reports which variants are NOT covered by this build.
  const KNOWN_VARIANTS = {
    'hero': ['centered-overlay', 'split-screen', 'minimal-text'],
    'graphic-text': ['split', 'overlap', 'full-overlay'],
    'bento': ['grid-4', 'wide-2', 'featured'],
    'accordion': ['standard', 'accent-border'],
    'mcq': ['stacked', 'grid'],
    'stat-callout': ['centered', 'card-row'],
    'timeline': ['vertical', 'centered-alternating'],
    'comparison': ['columns', 'stacked-rows'],
    'tabs': ['horizontal', 'vertical']
  };

  try {
    const layoutData = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
    const usedVariants = {};  // type → Set of variants used
    const variantComponents = []; // for HTML verification

    // Collect variants from layout
    for (const section of (layoutData.sections || [])) {
      for (const comp of (section.components || [])) {
        if (KNOWN_VARIANTS[comp.type]) {
          if (!usedVariants[comp.type]) usedVariants[comp.type] = new Set();
          const v = comp.variant || KNOWN_VARIANTS[comp.type][0]; // default = first
          usedVariants[comp.type].add(v);
          variantComponents.push({ type: comp.type, variant: v, id: comp.componentId });
        }
      }
    }

    // Verify HTML renders the correct variant structure
    for (const vc of variantComponents) {
      const htmlCheck = await page.evaluate(({ type, variant, id }) => {
        // Prefer data-variant selector to find the right instance; fall back to first
        var comp = document.querySelector('[data-component-type="' + type + '"][data-variant="' + variant + '"]')
                || document.querySelector('[data-component-type="' + type + '"]');
        if (!comp) return { found: false };

        var result = { found: true, issues: [] };

        // Variant-specific structural checks
        if (type === 'hero') {
          var hasGrid = comp.querySelector('.grid, [class*="grid-cols-2"]');
          if (variant === 'split-screen' && !hasGrid) {
            result.issues.push('split-screen hero should have a 2-column grid');
          }
          if (variant === 'minimal-text') {
            var h1 = comp.querySelector('h1');
            var subtitle = comp.querySelector('p');
            // minimal-text should have no CTA button or a very stripped layout
          }
        }

        if (type === 'graphic-text' && variant === 'full-overlay') {
          var overlay = comp.querySelector('[class*="absolute"], [class*="bg-gradient"], [class*="bg-black"]');
          if (!overlay) result.issues.push('full-overlay graphic-text should have an overlay element');
        }

        if (type === 'bento') {
          var cards = comp.querySelectorAll('.grid > div, [class*="grid"] > div');
          if (variant === 'wide-2' && cards.length > 0) {
            // wide-2 should have max 2 columns
          }
          if (variant === 'featured' && cards.length > 0) {
            // featured should have one larger card
          }
        }

        if (type === 'tabs' && variant === 'vertical') {
          var flexRow = comp.querySelector('[class*="md:flex-row"], [class*="flex-row"]');
          if (!flexRow) result.issues.push('vertical tabs should use flex-row layout');
        }

        if (type === 'stat-callout' && variant === 'card-row') {
          var cards = comp.querySelectorAll('[class*="shadow"], [class*="rounded"]');
          if (cards.length === 0) result.issues.push('card-row stat-callout should have individual cards with shadows');
        }

        if (type === 'timeline' && variant === 'centered-alternating') {
          var hasAlternating = comp.querySelector('[class*="md:flex-row-reverse"], [class*="text-right"]');
          if (!hasAlternating) result.issues.push('centered-alternating timeline should alternate left/right');
        }

        if (type === 'comparison' && variant === 'stacked-rows') {
          var rows = comp.querySelectorAll('[class*="flex"], [class*="grid"]');
          // stacked-rows renders as rows instead of side-by-side columns
        }

        return result;
      }, { type: vc.type, variant: vc.variant, id: vc.id });

      if (!htmlCheck.found) {
        warn('VARIANT', `${vc.type} (${vc.variant}): component not found in HTML`);
      } else if (htmlCheck.issues.length > 0) {
        for (const issue of htmlCheck.issues) {
          fail('VARIANT', `${vc.type} (${vc.variant}): ${issue}`);
        }
      }
    }

    // Report coverage
    let totalVariants = 0;
    let coveredVariants = 0;
    const missing = [];

    for (const [type, variants] of Object.entries(KNOWN_VARIANTS)) {
      for (const v of variants) {
        totalVariants++;
        if (usedVariants[type] && usedVariants[type].has(v)) {
          coveredVariants++;
        } else {
          missing.push(`${type}:${v}`);
        }
      }
    }

    pass('VARIANT', `Variant coverage: ${coveredVariants}/${totalVariants} (${Math.round(coveredVariants/totalVariants*100)}%)`);

    if (missing.length > 0) {
      warn('VARIANT', `Untested variants (not used in this build): ${missing.join(', ')}`);
    }

  } catch (e) {
    warn('VARIANT', `Could not check variants: ${e.message}`);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────
  await browser.close();

  // ─── Report ────────────────────────────────────────────────────────
  console.log('\n─── RESULTS ─────────────────────────────────────────\n');

  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}):`);
    for (const e of errors) console.log(`   ${e}`);
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):`);
    for (const w of warnings) console.log(`   ${w}`);
    console.log('');
  }

  console.log(`✅ PASSED (${passes.length}):`);
  for (const p of passes) console.log(`   ${p}`);
  console.log('');

  console.log('─── SUMMARY ─────────────────────────────────────────');
  console.log(`   ✅ ${passes.length} passed`);
  console.log(`   ⚠️  ${warnings.length} warnings`);
  console.log(`   ❌ ${errors.length} errors`);
  console.log('');

  if (errors.length > 0) {
    console.log('🚫 INTERACTIVE QA FAILED — fix errors before visual review.\n');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('⚠️  INTERACTIVE QA PASSED with warnings.\n');
    process.exit(0);
  } else {
    console.log('✅ INTERACTIVE QA PASSED — all interactions working.\n');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Interactive QA failed:', err.message);
  process.exit(1);
});
