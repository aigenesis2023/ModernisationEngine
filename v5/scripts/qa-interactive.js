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
 * Usage: node v5/scripts/qa-interactive.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const COURSE_PATH = path.resolve(ROOT, 'v5/output/course.html');

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
    console.log('❌ FATAL: v5/output/course.html not found. Run build-course.js first.\n');
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
