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

    // ── 1b. DRAW RANDOMIZATION ──────────────────────────────────────────
    // When poolSize > drawCount, randomly select drawCount MCQs and hide the rest.
    // Groups MCQs by parent section (drawId grouping via proximity).
    var drawQuizzes = document.querySelectorAll('[data-quiz][data-draw-count]');
    if (drawQuizzes.length > 0) {
      // Group by closest section-track parent or by proximity
      var drawGroups = {};
      drawQuizzes.forEach(function (q) {
        var count = parseInt(q.getAttribute('data-draw-count'), 10);
        var pool = parseInt(q.getAttribute('data-draw-pool'), 10);
        var shuffle = q.hasAttribute('data-draw-shuffle');
        // Group key: find the nearest section wrapper
        var parent = q.closest('[data-show-if]') || q.closest('[data-section-track]') || q.parentElement;
        var key = parent ? (parent.id || parent.getAttribute('data-show-if') || 'default') : 'default';
        if (!drawGroups[key]) drawGroups[key] = { quizzes: [], drawCount: count, shuffle: shuffle };
        drawGroups[key].quizzes.push(q);
      });

      for (var gk in drawGroups) {
        var group = drawGroups[gk];
        if (group.quizzes.length <= group.drawCount) continue;
        // Shuffle the array and hide extras
        var indices = [];
        for (var gi = 0; gi < group.quizzes.length; gi++) indices.push(gi);
        if (group.shuffle) {
          for (var si = indices.length - 1; si > 0; si--) {
            var sj = Math.floor(Math.random() * (si + 1));
            var tmp = indices[si]; indices[si] = indices[sj]; indices[sj] = tmp;
          }
        }
        var visible = indices.slice(0, group.drawCount);
        var visibleSet = {};
        visible.forEach(function (vi) { visibleSet[vi] = true; });
        group.quizzes.forEach(function (q, qi) {
          if (!visibleSet[qi]) {
            q.style.display = 'none';
            q.setAttribute('data-draw-hidden', 'true');
          }
        });
        console.log('Draw randomization: showing ' + group.drawCount + ' of ' + group.quizzes.length + ' quizzes in group ' + gk);
      }
    }

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

    // ── 9. PATH SELECTOR & CONDITIONAL CONTENT ─────────────────────────
    var pathGroups = window.__PATH_GROUPS__ || [];
    var state = {};

    // Initialize state from path group defaults
    pathGroups.forEach(function (pg) {
      (pg.options || []).forEach(function (opt) {
        state[opt.variable] = false;
      });
    });

    // Restore from sessionStorage
    try {
      var saved = sessionStorage.getItem('__path_state__');
      if (saved) {
        var parsed = JSON.parse(saved);
        for (var k in parsed) {
          if (state.hasOwnProperty(k)) state[k] = parsed[k];
        }
      }
    } catch (e) {}

    function applyState() {
      var conditionals = document.querySelectorAll('[data-show-if]');
      conditionals.forEach(function (el) {
        var condition = el.getAttribute('data-show-if');
        // Parse "VarA=true|VarB=true" → OR logic
        var parts = condition.split('|');
        var visible = parts.some(function (part) {
          var kv = part.split('=');
          var varName = kv[0];
          var val = kv[1];
          if (val === 'true') return state[varName] === true;
          if (val === 'false') return state[varName] === false;
          return String(state[varName]) === val;
        });
        el.style.display = visible ? '' : 'none';
      });
      // Persist to sessionStorage
      try { sessionStorage.setItem('__path_state__', JSON.stringify(state)); } catch (e) {}
    }

    // Path selector click handler
    var pathSelectors = document.querySelectorAll('[data-path-selector]');
    pathSelectors.forEach(function (selector) {
      var options = selector.querySelectorAll('[data-path-option]');
      options.forEach(function (option) {
        option.style.cursor = 'pointer';
        option.addEventListener('click', function () {
          var variable = option.getAttribute('data-path-variable');
          if (!variable) return;

          // Find which path group this variable belongs to
          var group = null;
          pathGroups.forEach(function (pg) {
            (pg.options || []).forEach(function (opt) {
              if (opt.variable === variable) group = pg;
            });
          });

          // Set selected to true, all others in same group to false
          if (group) {
            (group.options || []).forEach(function (opt) {
              state[opt.variable] = (opt.variable === variable);
            });
          } else {
            state[variable] = true;
          }

          applyState();
          applyPathSelectorVisuals();
          applyCourseGate();
        });
      });
    });

    // Update visual state of all path-selector cards to match current state
    function applyPathSelectorVisuals() {
      pathSelectors.forEach(function (selector) {
        var options = selector.querySelectorAll('[data-path-option]');
        var anySelected = false;
        options.forEach(function (opt) {
          var v = opt.getAttribute('data-path-variable');
          if (state[v]) anySelected = true;
        });
        // Only dim cards if a selection has been made
        if (anySelected) {
          options.forEach(function (opt) {
            var v = opt.getAttribute('data-path-variable');
            if (state[v]) {
              opt.classList.add('border-primary', 'ring-2', 'ring-primary/50');
              opt.style.opacity = '1';
            } else {
              opt.classList.remove('border-primary', 'ring-2', 'ring-primary/50');
              opt.style.opacity = '0.5';
            }
          });
        }
      });
    }

    // ── 10. COURSE GATE — require path selection before continuing ─────
    // If a path-selector exists and no path is selected, blur/lock the rest
    // of the course. Gate is removed when any path variable becomes true.
    var courseGates = document.querySelectorAll('[data-course-gate]');

    function applyCourseGate() {
      if (courseGates.length === 0) return;
      var anySelected = false;
      for (var k in state) { if (state[k] === true) anySelected = true; }
      courseGates.forEach(function (gate) {
        if (anySelected) {
          var wasGated = gate.classList.contains('gated');
          gate.classList.remove('gated');
          // Smooth-scroll to the gated content on first unlock
          if (wasGated) {
            setTimeout(function () {
              gate.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        } else {
          gate.classList.add('gated');
        }
      });
    }

    // On load: apply state + gate
    var hasSelection = false;
    for (var key in state) { if (state[key] === true) hasSelection = true; }
    if (hasSelection) {
      applyState();
      applyPathSelectorVisuals();
    }
    applyCourseGate();

    // ── 11. SECTION PROGRESS TRACKING ────────────────────────────────────
    // Track interactive component completion within each section and update
    // nav links with progress indicators. Uses data-section-track attributes
    // emitted by build-course.js on sections with interactive components.
    var trackedSections = document.querySelectorAll('[data-section-track]');
    var sectionProgress = {}; // sectionId → { total, completed }

    function countSectionCompletion(sectionEl) {
      var sectionId = sectionEl.getAttribute('data-section-track');
      // Walk the DOM from this title bar to the next title bar (or end of main)
      // to find all interactive components belonging to this section
      var node = sectionEl;
      var completed = 0;
      var total = 0;

      // Collect all siblings until the next section-track or end
      while (node) {
        node = node.nextElementSibling;
        if (!node) break;
        if (node.hasAttribute('data-section-track')) break;
        // Count quizzes (completed = has feedback)
        var sQuizzes = node.querySelectorAll('[data-quiz]');
        total += sQuizzes.length;
        sQuizzes.forEach(function (q) {
          if (q.querySelector('.border-\\[\\#22c55e\\]') || q.getAttribute('data-answered') === 'true') completed++;
        });
        // Count accordions (completed = all opened at least once)
        var sAccordions = node.querySelectorAll('details');
        if (sAccordions.length > 0) {
          total++;
          var allOpened = true;
          sAccordions.forEach(function (d) {
            if (!d.hasAttribute('data-was-opened')) allOpened = false;
          });
          if (allOpened && sAccordions.length > 0) completed++;
        }
        // Count tab containers (completed = all tabs clicked)
        var sTabs = node.querySelectorAll('[data-tabs]');
        sTabs.forEach(function (tc) {
          total++;
          if (tc.getAttribute('data-all-visited') === 'true') completed++;
        });
        // Count checklists (completed = all checked)
        var sChecklists = node.querySelectorAll('[data-checklist]');
        sChecklists.forEach(function (cl) {
          total++;
          var cbs = cl.querySelectorAll('input[type="checkbox"]');
          var allChecked = cbs.length > 0;
          cbs.forEach(function (cb) { if (!cb.checked) allChecked = false; });
          if (allChecked && cbs.length > 0) completed++;
        });
      }
      sectionProgress[sectionId] = { total: total, completed: completed };
      return { total: total, completed: completed };
    }

    function updateNavProgress() {
      trackedSections.forEach(function (sec) {
        var sectionId = sec.getAttribute('data-section-track');
        var progress = countSectionCompletion(sec);
        // Find matching nav link
        var navLink = document.querySelector('a[href="#' + sectionId + '"]');
        if (!navLink) return;
        // Add or update progress indicator
        var indicator = navLink.querySelector('.section-progress');
        if (!indicator) {
          indicator = document.createElement('span');
          indicator.className = 'section-progress ml-1 text-xs';
          navLink.appendChild(indicator);
        }
        if (progress.total === 0) {
          indicator.textContent = '';
        } else if (progress.completed >= progress.total) {
          indicator.innerHTML = '<span class="material-symbols-outlined text-xs align-middle" style="font-size:14px;color:var(--color-primary,#0099ff)">check_circle</span>';
          sec.classList.add('section-complete');
        } else {
          indicator.textContent = '(' + progress.completed + '/' + progress.total + ')';
          indicator.style.opacity = '0.6';
        }
      });
    }

    // Track accordion opens
    document.addEventListener('toggle', function (e) {
      if (e.target.tagName === 'DETAILS' && e.target.open) {
        e.target.setAttribute('data-was-opened', 'true');
        updateNavProgress();
      }
    }, true);

    // Track tab visits
    tabContainers.forEach(function (container) {
      var triggers = container.querySelectorAll('[data-tab-trigger]');
      var visited = {};
      triggers.forEach(function (trigger, i) {
        trigger.addEventListener('click', function () {
          visited[i] = true;
          if (Object.keys(visited).length >= triggers.length) {
            container.setAttribute('data-all-visited', 'true');
          }
          updateNavProgress();
        });
      });
    });

    // Track quiz completion — mark quiz as answered when feedback appears
    quizzes.forEach(function (quiz) {
      var observer = new MutationObserver(function () {
        if (quiz.querySelector('.border-\\[\\#22c55e\\]') || quiz.querySelector('[style*="color: rgb(34, 197, 94)"]') || quiz.querySelector('[style*="#22c55e"]')) {
          quiz.setAttribute('data-answered', 'true');
          updateNavProgress();
        }
      });
      observer.observe(quiz, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });

    // ── 12. REQUIRED-ITEMS COMPLETION COUNTER ─────────────────────────
    // Components tagged with data-required-items="N" show a progress counter
    // and get a visual "complete" state when all sub-items are interacted with.
    var requiredComps = document.querySelectorAll('[data-required-items]');
    requiredComps.forEach(function (comp) {
      var required = parseInt(comp.getAttribute('data-required-items'), 10);
      if (isNaN(required) || required <= 0) return;

      // Create progress indicator
      var progressEl = document.createElement('div');
      progressEl.className = 'text-xs text-outline-variant mt-2 mb-4 text-center';
      progressEl.setAttribute('data-completion-progress', '');
      comp.appendChild(progressEl);

      function updateCompletionProgress() {
        var interacted = 0;
        // Count opened accordions
        var details = comp.querySelectorAll('details');
        details.forEach(function (d) { if (d.hasAttribute('data-was-opened')) interacted++; });
        // Count visited tabs
        var tabs = comp.querySelector('[data-tabs]');
        if (tabs) {
          var visited = tabs.querySelectorAll('[data-tab-trigger][data-visited]');
          interacted += visited.length;
        }
        // Count answered quizzes
        var answeredQuizzes = comp.querySelectorAll('[data-quiz][data-answered]');
        interacted += answeredQuizzes.length;
        // Count checked items
        var checked = comp.querySelectorAll('input[type="checkbox"]:checked');
        interacted += checked.length;

        var current = Math.min(interacted, required);
        progressEl.textContent = current + ' / ' + required + ' explored';
        if (current >= required) {
          progressEl.innerHTML = '<span class="material-symbols-outlined text-xs align-middle" style="font-size:14px;color:var(--color-primary,#0099ff)">check_circle</span> All items explored';
          progressEl.style.color = 'var(--color-primary, #0099ff)';
          comp.setAttribute('data-items-complete', 'true');
          updateNavProgress();
        }
      }

      // Observe changes within the component
      var compObserver = new MutationObserver(updateCompletionProgress);
      compObserver.observe(comp, { childList: true, subtree: true, attributes: true });
      updateCompletionProgress();
    });

    // Initial progress check (for restored sessions)
    if (trackedSections.length > 0) {
      updateNavProgress();
    }

    // ── Summary log ─────────────────────────────────────────────────────
    console.log(
      'Hydration complete: ' +
      quizzes.length + ' quizzes, ' +
      tabContainers.length + ' tabs, ' +
      flashcards.length + ' flashcards, ' +
      carousels.length + ' carousels, ' +
      pathSelectors.length + ' path-selectors, ' +
      courseGates.length + ' course-gates, ' +
      trackedSections.length + ' tracked-sections, ' +
      document.querySelectorAll('[data-show-if]').length + ' conditional sections'
    );

  });
})();
