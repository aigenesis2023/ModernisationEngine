/**
 * Hydration Script — Vanilla JS interactivity for Stitch-designed HTML pages
 * Injected into static HTML to bring interactive patterns to life.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {

    // ── Inject CSS ──────────────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent =
      '@keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }' +
      'details[open] summary ~ * { animation: slideDown 0.3s ease forwards; }' +
      'details summary { list-style: none; cursor: pointer; }' +
      'details summary::-webkit-details-marker { display: none; }' +
      'html { scroll-behavior: smooth; }' +
      '#hydrate-progress { position: fixed; top: 0; left: 0; height: 3px; background: var(--color-primary, #0099ff); z-index: 9999; transition: width 0.15s linear; pointer-events: none; }';
    document.head.appendChild(style);

    // ── 1. QUIZ ─────────────────────────────────────────────────────────
    var quizzes = document.querySelectorAll('[data-quiz]');
    quizzes.forEach(function (quiz) {
      var choices = quiz.querySelectorAll('[data-choice]');
      // Resolve correct answer by index from quiz container attribute
      var correctIdx = parseInt(quiz.getAttribute('data-correct'), 10);
      var correctBtn = isNaN(correctIdx) ? null : choices[correctIdx] || null;
      var selected = null;
      var submitBtn = null;
      var feedbackEl = null;
      // Find the best container for injecting submit/feedback (inside the card, not the section)
      var choiceContainer = quiz.querySelector('.space-y-4') || quiz.querySelector('.space-y-3');
      var injectTarget = choiceContainer ? choiceContainer.parentElement : quiz;

      function resetQuiz() {
        selected = null;
        choices.forEach(function (c) {
          c.classList.remove('border-primary-container', 'border-[#22c55e]', 'border-error');
          c.style.opacity = '';
        });
        if (submitBtn) submitBtn.remove();
        submitBtn = null;
        if (feedbackEl) feedbackEl.remove();
        feedbackEl = null;
      }

      choices.forEach(function (choice) {
        choice.style.cursor = 'pointer';
        choice.addEventListener('click', function () {
          if (feedbackEl) return; // already submitted
          choices.forEach(function (c) {
            c.classList.remove('border-primary-container');
            c.style.opacity = '0.5';
          });
          choice.classList.add('border-primary-container');
          choice.style.opacity = '1';
          selected = choice;

          if (!submitBtn) {
            submitBtn = document.createElement('button');
            submitBtn.textContent = 'Submit';
            submitBtn.className = 'mt-4 px-6 py-2 rounded-lg bg-primary text-on-primary font-semibold cursor-pointer hover:opacity-90 transition-opacity';
            injectTarget.appendChild(submitBtn);

            submitBtn.addEventListener('click', function () {
              if (!selected) return;
              feedbackEl = document.createElement('div');
              feedbackEl.className = 'mt-3 text-sm font-semibold';

              if (selected === correctBtn) {
                selected.classList.remove('border-primary-container');
                selected.classList.add('border-[#22c55e]');
                feedbackEl.textContent = 'Correct!';
                feedbackEl.style.color = '#22c55e';
              } else {
                selected.classList.remove('border-primary-container');
                selected.classList.add('border-error');
                if (correctBtn) {
                  correctBtn.classList.add('border-[#22c55e]');
                  correctBtn.style.opacity = '1';
                }
                feedbackEl.textContent = 'Incorrect — see the correct answer highlighted in green.';
                feedbackEl.style.color = '#ef4444';

                var tryAgain = document.createElement('button');
                tryAgain.textContent = 'Try Again';
                tryAgain.className = 'ml-3 px-4 py-1 rounded-lg border border-outline-variant/30 text-on-surface-variant text-sm cursor-pointer hover:text-on-surface transition-colors';
                tryAgain.addEventListener('click', resetQuiz);
                feedbackEl.appendChild(tryAgain);
              }
              injectTarget.appendChild(feedbackEl);
              submitBtn.remove();
              submitBtn = null;
            });
          }
        });
      });
    });

    // ── 2. TABS ─────────────────────────────────────────────────────────
    var tabContainers = document.querySelectorAll('[data-tabs]');
    tabContainers.forEach(function (container) {
      var triggers = container.querySelectorAll('[data-tab-trigger]');
      var panels = container.querySelectorAll('[data-tab-panel]');

      // Capture the initial active/inactive class strings from Stitch's design
      var activeClasses = triggers.length > 0 ? triggers[0].className : '';
      var inactiveClasses = triggers.length > 1 ? triggers[1].className : activeClasses;

      function activateTab(index) {
        triggers.forEach(function (t, i) {
          t.className = i === index ? activeClasses : inactiveClasses;
        });
        panels.forEach(function (p, i) {
          p.style.display = i === index ? '' : 'none';
        });
      }

      triggers.forEach(function (trigger, i) {
        trigger.style.cursor = 'pointer';
        trigger.addEventListener('click', function () { activateTab(i); });
      });

      if (triggers.length > 0) activateTab(0);
    });

    // ── 3. FLASHCARDS ───────────────────────────────────────────────────
    var flashcards = document.querySelectorAll('[data-flashcard]');
    flashcards.forEach(function (card) {
      card.style.cursor = 'pointer';
      var inner = card.firstElementChild;
      if (!inner) return;
      var flipped = false;

      function toggle(e) {
        e.preventDefault();
        flipped = !flipped;
        inner.style.transform = flipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
      }
      card.addEventListener('click', toggle);
      card.addEventListener('touchend', function (e) {
        // Prevent double-fire on touch devices
        e.preventDefault();
        flipped = !flipped;
        inner.style.transform = flipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
      });
    });

    // ── 4. CAROUSEL / NARRATIVE ─────────────────────────────────────────
    var carousels = document.querySelectorAll('[data-carousel]');
    carousels.forEach(function (container) {
      var slides = container.querySelectorAll('[data-slide]');
      var prevBtn = container.querySelector('[data-prev]');
      var nextBtn = container.querySelector('[data-next]');
      if (slides.length === 0) return;
      var current = 0;

      // Create dot indicators
      var dotsWrap = null;
      if (slides.length > 1) {
        dotsWrap = document.createElement('div');
        dotsWrap.className = 'flex justify-center gap-2 mt-4';
        for (var d = 0; d < slides.length; d++) {
          var dot = document.createElement('button');
          dot.className = 'w-2 h-2 rounded-full bg-outline-variant/30 transition-colors';
          dot.setAttribute('data-dot', d);
          dot.style.cursor = 'pointer';
          dotsWrap.appendChild(dot);
        }
        // Insert dots after the slides area or at end of container
        var navArea = prevBtn ? prevBtn.parentElement : null;
        if (navArea && navArea.parentElement === container) {
          container.insertBefore(dotsWrap, navArea.nextSibling);
        } else {
          container.appendChild(dotsWrap);
        }

        dotsWrap.addEventListener('click', function (e) {
          var dotIndex = e.target.getAttribute('data-dot');
          if (dotIndex !== null) {
            current = parseInt(dotIndex, 10);
            showSlide();
          }
        });
      }

      function showSlide() {
        slides.forEach(function (s, i) {
          s.style.display = i === current ? '' : 'none';
        });
        if (prevBtn) prevBtn.disabled = current === 0;
        if (nextBtn) nextBtn.disabled = current === slides.length - 1;
        if (prevBtn) prevBtn.style.opacity = current === 0 ? '0.3' : '1';
        if (nextBtn) nextBtn.style.opacity = current === slides.length - 1 ? '0.3' : '1';
        if (dotsWrap) {
          var dots = dotsWrap.querySelectorAll('[data-dot]');
          dots.forEach(function (dot, i) {
            dot.className = 'w-2 h-2 rounded-full transition-colors cursor-pointer ' +
              (i === current ? 'bg-primary' : 'bg-outline-variant/30');
          });
        }
      }

      if (prevBtn) {
        prevBtn.style.cursor = 'pointer';
        prevBtn.addEventListener('click', function () {
          if (current > 0) { current--; showSlide(); }
        });
      }
      if (nextBtn) {
        nextBtn.style.cursor = 'pointer';
        nextBtn.addEventListener('click', function () {
          if (current < slides.length - 1) { current++; showSlide(); }
        });
      }
      showSlide();
    });

    // ── 5. CHECKLIST ────────────────────────────────────────────────────
    var checklists = document.querySelectorAll('[data-checklist]');
    checklists.forEach(function (container) {
      // Handle native checkboxes
      var checkboxes = container.querySelectorAll('input[type="checkbox"]');

      // Handle icon-based checklist items (Material Symbols / icon spans)
      var iconItems = container.querySelectorAll('li, [data-check-item]');
      var totalItems = checkboxes.length;
      var checked = 0;

      // Find or create progress counter
      var counter = container.querySelector('[data-checklist-progress]');
      if (!counter && (totalItems > 1 || iconItems.length > 1)) {
        counter = document.createElement('div');
        counter.className = 'text-xs text-outline mt-3';
        container.appendChild(counter);
      }

      function updateProgress() {
        checked = 0;
        checkboxes.forEach(function (cb) { if (cb.checked) checked++; });
        // Count icon-toggled items
        iconItems.forEach(function (item) {
          if (item.getAttribute('data-checked') === 'true') checked++;
        });
        var total = checkboxes.length + iconItems.length;
        if (counter && total > 0) {
          counter.textContent = checked + ' / ' + total + ' complete';
        }
      }

      checkboxes.forEach(function (cb) {
        cb.addEventListener('change', updateProgress);
      });

      iconItems.forEach(function (item) {
        // Look for check_circle icon span inside
        var icon = item.querySelector('.material-symbols-rounded, .material-icons, [class*="icon"]');
        if (!icon) return;
        totalItems++;
        item.setAttribute('data-checked', 'false');
        item.style.cursor = 'pointer';

        item.addEventListener('click', function (e) {
          if (e.target.tagName === 'INPUT') return; // let native checkboxes handle themselves
          var isChecked = item.getAttribute('data-checked') === 'true';
          if (isChecked) {
            item.setAttribute('data-checked', 'false');
            icon.textContent = 'check_circle_outline';
            icon.classList.remove('text-primary');
            icon.classList.add('text-outline-variant');
          } else {
            item.setAttribute('data-checked', 'true');
            icon.textContent = 'check_circle';
            icon.classList.remove('text-outline-variant');
            icon.classList.add('text-primary');
          }
          updateProgress();
        });
      });

      updateProgress();
    });

    // ── 6. ACCORDION (details/summary) — CSS handles animation ────────
    // Already handled via injected CSS above. Nothing extra needed.

    // ── 7. SCROLL PROGRESS BAR ──────────────────────────────────────────
    var progressBar = document.createElement('div');
    progressBar.id = 'hydrate-progress';
    progressBar.style.width = '0%';
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', function () {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = pct + '%';
    }, { passive: true });

    // ── 8. SMOOTH SCROLL for anchor links ───────────────────────────────
    document.addEventListener('click', function (e) {
      var anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;
      var id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // ── Summary log ─────────────────────────────────────────────────────
    console.log(
      'Hydration complete: ' +
      quizzes.length + ' quizzes, ' +
      tabContainers.length + ' tabs, ' +
      flashcards.length + ' flashcards, ' +
      carousels.length + ' carousels'
    );

  });
})();
