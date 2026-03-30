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
      '#hydrate-progress { position: fixed; top: 0; left: 0; height: 3px; background: var(--color-primary, #0099ff); z-index: 9999; transition: width 0.15s linear; pointer-events: none; }' +
      '.drawer-link-active .drawer-index { color: var(--color-primary, #0099ff); }' +
      '@media(max-width:640px){[data-authoring-category] button{min-height:44px !important;}}';
    document.head.appendChild(style);

    // ── Editing guard: check if the section is in edit mode ───────────
    function isSectionEditing(el) {
      var section = el.closest('section[data-component-type]');
      return section && section.hasAttribute('data-editing');
    }

    // ── Per-component hydration functions (reusable for variant swaps) ──
    function hydrateQuiz(quiz) {
      var choices = quiz.querySelectorAll('[data-choice]');
      // Resolve correct answer by index from quiz container attribute
      var correctIdx = parseInt(quiz.getAttribute('data-correct'), 10);
      var correctBtn = isNaN(correctIdx) ? null : choices[correctIdx] || null;
      var selected = null;
      var submitBtn = null;
      var feedbackEl = null;
      // Find the best container for injecting submit/feedback (inside the card, not the section)
      // Supports both stacked (.space-y-4) and grid (.grid) MCQ variants
      var choiceContainer = quiz.querySelector('.space-y-4') || quiz.querySelector('.space-y-3') || quiz.querySelector('.grid');
      var injectTarget = choiceContainer ? choiceContainer.parentElement : quiz.querySelector('[data-quiz-feedback]')?.parentElement || quiz;

      function resetQuiz() {
        selected = null;
        choices.forEach(function (c) {
          c.classList.remove('border-primary-container', 'border-[#22c55e]', 'border-error');
          c.style.opacity = '';
          c.style.borderColor = '';
        });
        if (submitBtn) submitBtn.remove();
        submitBtn = null;
        if (feedbackEl) feedbackEl.remove();
        feedbackEl = null;
      }

      choices.forEach(function (choice) {
        choice.style.cursor = 'pointer';
        choice.addEventListener('click', function () {
          if (isSectionEditing(quiz)) return; // editing mode — suppress selection
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
                feedbackEl.textContent = 'Incorrect.';
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
    }

    // ── 1. QUIZ — init all ────────────────────────────────────────────
    var quizzes = document.querySelectorAll('[data-quiz]');
    quizzes.forEach(hydrateQuiz);

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
    function hydrateTabs(container) {
      var triggers = container.querySelectorAll('[data-tab-trigger]');
      var panels = container.querySelectorAll('[data-tab-panel]');

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
        trigger.addEventListener('click', function () {
          if (isSectionEditing(container)) return; // editing mode — suppress tab switch
          activateTab(i);
        });
      });

      if (triggers.length > 0) activateTab(0);
    }
    var tabContainers = document.querySelectorAll('[data-tabs]');
    tabContainers.forEach(hydrateTabs);

    // ── 3. FLASHCARDS ───────────────────────────────────────────────────
    function hydrateFlashcard(card) {
      card.style.cursor = 'pointer';
      var inner = card.firstElementChild;
      if (!inner) return;
      var flipped = false;

      function toggle(e) {
        if (isSectionEditing(card)) return; // editing mode — suppress flip
        e.preventDefault();
        flipped = !flipped;
        inner.style.transform = flipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
      }
      card.addEventListener('click', toggle);
      card.addEventListener('touchend', function (e) {
        if (isSectionEditing(card)) return; // editing mode — suppress flip
        e.preventDefault();
        flipped = !flipped;
        inner.style.transform = flipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
      });
    }
    var flashcards = document.querySelectorAll('[data-flashcard]');
    flashcards.forEach(hydrateFlashcard);

    // ── 4. CAROUSEL / NARRATIVE ─────────────────────────────────────────
    function hydrateCarousel(container) {
      var slides = container.querySelectorAll('[data-slide]');
      var prevBtn = container.querySelector('[data-prev]');
      var nextBtn = container.querySelector('[data-next]');
      if (slides.length === 0) return;
      var current = 0;

      // Create dot indicators (idempotent — skip if already present from a previous hydration)
      var dotsWrap = container.querySelector('[data-carousel-dots]');
      if (!dotsWrap && slides.length > 1) {
        dotsWrap = document.createElement('div');
        dotsWrap.className = 'flex justify-center gap-0 mt-4';
        dotsWrap.setAttribute('data-carousel-dots', '');
        for (var d = 0; d < slides.length; d++) {
          var dot = document.createElement('button');
          dot.className = 'flex items-center justify-center p-1';
          dot.setAttribute('data-dot', d);
          dot.style.cursor = 'pointer';
          var dotInner = document.createElement('span');
          dotInner.className = 'w-2 h-2 rounded-full bg-outline-variant/30 transition-colors pointer-events-none';
          dot.appendChild(dotInner);
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
          var dotEl = e.target.closest('[data-dot]');
          var dotIndex = dotEl ? dotEl.getAttribute('data-dot') : null;
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
            var inner = dot.querySelector('span');
            if (inner) inner.className = 'w-2 h-2 rounded-full transition-colors pointer-events-none ' +
              (i === current ? 'bg-primary' : 'bg-outline-variant/30');
          });
        }
        var slideCounter = container.querySelector('[data-slide-counter]');
        if (slideCounter) {
          slideCounter.textContent = (current + 1) + ' / ' + slides.length;
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
    }
    var carousels = document.querySelectorAll('[data-carousel]');
    carousels.forEach(hydrateCarousel);

    // ── 5. CHECKLIST ────────────────────────────────────────────────────
    function hydrateChecklist(container) {
      // Handle native checkboxes
      var checkboxes = container.querySelectorAll('input[type="checkbox"]');

      // Handle icon-based checklist items (Material Symbols / icon spans)
      var iconItems = container.querySelectorAll('li, [data-check-item]');
      var totalItems = checkboxes.length;
      var checked = 0;

      // Find or create progress counter (idempotent — skip if already present)
      var counter = container.querySelector('[data-checklist-progress]');
      if (!counter && (totalItems > 1 || iconItems.length > 1)) {
        counter = document.createElement('div');
        counter.className = 'text-xs text-outline mt-3';
        counter.setAttribute('data-checklist-progress', '');
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
        cb.addEventListener('click', function(e) {
          if (isSectionEditing(container)) { e.preventDefault(); return; }
        });
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
          if (isSectionEditing(container)) return; // editing mode — suppress toggle
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
    }
    var checklists = document.querySelectorAll('[data-checklist]');
    checklists.forEach(hydrateChecklist);

    // ── 5b. BRANCHING — selection feedback ────────────────────────────
    var branchingSections = document.querySelectorAll('[data-component-type="branching"]');
    branchingSections.forEach(function (section) {
      var buttons = section.querySelectorAll('button');
      var selected = null;
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (isSectionEditing(section)) return;
          buttons.forEach(function (b) {
            b.style.borderColor = '';
            b.style.opacity = '';
          });
          btn.style.borderColor = 'var(--md-sys-color-secondary, #8b5cf6)';
          buttons.forEach(function (b) {
            if (b !== btn) b.style.opacity = '0.5';
          });
          selected = btn;
        });
      });
    });

    // ── 6. ACCORDION (details/summary) — CSS handles animation ────────
    // Already handled via injected CSS above. Nothing extra needed.

    // ── 7. SCROLL PROGRESS + NAV DRAWER ──────────────────────────────────
    // Progress bar lives inside the sticky header (built by build-course.js)
    var progressBar = document.createElement('div');
    progressBar.id = 'hydrate-progress';
    progressBar.style.width = '0%';
    document.body.appendChild(progressBar);

    var progressText = document.querySelector('[data-progress-text]');
    var drawerProgressText = document.querySelector('[data-drawer-progress-text]');
    var drawerProgressBar = document.querySelector('[data-drawer-progress-bar]');

    window.addEventListener('scroll', function () {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      var pct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
      progressBar.style.width = pct + '%';
      if (progressText) progressText.textContent = pct + '%';
      if (drawerProgressText) drawerProgressText.textContent = pct + '%';
      if (drawerProgressBar) drawerProgressBar.style.width = pct + '%';
      // Update active section in drawer
      updateActiveDrawerLink();
    }, { passive: true });

    // ── 7b. NAV DRAWER TOGGLE ──────────────────────────────────────────
    var drawer = document.querySelector('[data-drawer]');
    var drawerOverlay = document.querySelector('[data-drawer-overlay]');
    var drawerToggle = document.querySelector('[data-nav-toggle]');
    var drawerClose = document.querySelector('[data-drawer-close]');

    function openDrawer() {
      if (!drawer) return;
      drawer.style.translate = '0';
      if (drawerOverlay) {
        drawerOverlay.style.opacity = '1';
        drawerOverlay.style.pointerEvents = 'auto';
      }
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      if (!drawer) return;
      drawer.style.translate = '-100%';
      if (drawerOverlay) {
        drawerOverlay.style.opacity = '0';
        drawerOverlay.style.pointerEvents = 'none';
      }
      document.body.style.overflow = '';
    }

    if (drawerToggle) drawerToggle.addEventListener('click', openDrawer);
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

    // Close drawer on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    // Drawer links: scroll to section and close
    var drawerLinks = document.querySelectorAll('[data-drawer-link]');
    drawerLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var targetId = link.getAttribute('data-drawer-link');
        var target = document.getElementById(targetId);
        if (target) {
          closeDrawer();
          setTimeout(function () {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
      });
    });

    // ── 7c. ACTIVE SECTION TRACKING IN DRAWER ──────────────────────────
    // Highlights the current section in the drawer based on scroll position
    var sectionAnchors = [];
    drawerLinks.forEach(function (link) {
      var id = link.getAttribute('data-drawer-link');
      var el = document.getElementById(id);
      if (el) sectionAnchors.push({ id: id, el: el, link: link });
    });

    function updateActiveDrawerLink() {
      if (sectionAnchors.length === 0) return;
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var activeId = sectionAnchors[0].id;
      for (var i = 0; i < sectionAnchors.length; i++) {
        if (sectionAnchors[i].el.offsetTop - 100 <= scrollTop) {
          activeId = sectionAnchors[i].id;
        }
      }
      drawerLinks.forEach(function (link) {
        var linkId = link.getAttribute('data-drawer-link');
        if (linkId === activeId) {
          link.classList.add('drawer-link-active');
          link.classList.remove('text-on-surface-variant');
          link.classList.add('text-on-surface', 'bg-primary/10');
        } else {
          link.classList.remove('drawer-link-active', 'text-on-surface', 'bg-primary/10');
          link.classList.add('text-on-surface-variant');
        }
      });
    }

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

    // ── 8b. HERO CTA BUTTONS ─────────────────────────────────────────
    // "Begin Course" and "Explore Modules" scroll to the first section
    var heroCTAs = document.querySelectorAll('[data-hero-cta]');
    heroCTAs.forEach(function (btn) {
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', function () {
        // Find the first content section after the hero
        var hero = document.querySelector('[data-component-type="hero"]');
        var target = hero ? hero.nextElementSibling : null;
        // Walk past non-element nodes to find the first real section/div
        while (target && target.nodeType !== 1) target = target.nextElementSibling;
        // If hero is wrapped (authoring), walk up to wrapper and find next sibling's section
        if (!target && hero) {
          var wrapper = hero.parentElement;
          var nextWrapper = wrapper ? wrapper.nextElementSibling : null;
          while (nextWrapper && !nextWrapper.querySelector('[data-component-type]')) {
            nextWrapper = nextWrapper.nextElementSibling;
          }
          if (nextWrapper) target = nextWrapper.querySelector('[data-component-type]') || nextWrapper;
        }
        if (!target) {
          // Fallback: scroll to the first section after section-00 (the hero)
          var allSections = document.querySelectorAll('[id^="section-"]');
          for (var i = 0; i < allSections.length; i++) {
            if (allSections[i].dataset.componentType !== 'hero') { target = allSections[i]; break; }
          }
        }
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
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
          if (isSectionEditing(selector)) return; // editing mode — suppress selection
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
        // Find matching drawer link
        var drawerLink = document.querySelector('[data-drawer-link="' + sectionId + '"]');
        if (!drawerLink) return;
        // Update the status icon in the drawer
        var statusIcon = drawerLink.querySelector('.drawer-status');
        if (!statusIcon) return;
        if (progress.total === 0) {
          statusIcon.textContent = '';
        } else if (progress.completed >= progress.total) {
          statusIcon.textContent = 'check_circle';
          statusIcon.style.color = 'var(--color-primary, #0099ff)';
          statusIcon.style.fontVariationSettings = "'FILL' 1";
          sec.classList.add('section-complete');
        } else {
          statusIcon.textContent = '';
          // Show fraction as text next to the link
          var fracEl = drawerLink.querySelector('.drawer-frac');
          if (!fracEl) {
            fracEl = document.createElement('span');
            fracEl.className = 'drawer-frac text-xs text-on-surface-variant tabular-nums';
            drawerLink.insertBefore(fracEl, statusIcon);
          }
          fracEl.textContent = progress.completed + '/' + progress.total;
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

    // ══════════════════════════════════════════════════════════════════════
    // SCROLL ANIMATIONS — GSAP ScrollTrigger + Lenis + SplitType
    // Deterministic per-component animations. No AI/LLM in the loop.
    // ══════════════════════════════════════════════════════════════════════
    (function initScrollAnimations() {
      // Bail if reduced motion preferred or libraries not loaded
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // Show all elements that were hidden for animation
        document.querySelectorAll('[data-animate]').forEach(function(el) {
          el.style.opacity = '1';
          el.style.transform = 'none';
          el.style.clipPath = 'none';
        });
        console.log('Scroll animations: skipped (prefers-reduced-motion)');
        return;
      }

      if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
        // Fallback: show all elements if GSAP failed to load
        document.querySelectorAll('[data-animate]').forEach(function(el) {
          el.style.opacity = '1';
          el.style.transform = 'none';
          el.style.clipPath = 'none';
        });
        console.log('Scroll animations: skipped (GSAP not loaded)');
        return;
      }

      gsap.registerPlugin(ScrollTrigger);

      // Native scroll — no Lenis override

      // ── Helper: default ScrollTrigger config ─────────────────────────
      var triggerDefaults = { start: 'top 85%', once: true };

      // ── 1. FADE-UP animations ────────────────────────────────────────
      gsap.utils.toArray('[data-animate="fade-up"]').forEach(function(el) {
        // Skip hero inner elements — they get special timing below
        if (el.closest('[data-component-type="hero"]')) return;
        gsap.fromTo(el,
          { y: 80, opacity: 0 },
          {
            y: 0, opacity: 1,
            duration: 1.1,
            ease: 'power4.out',
            scrollTrigger: Object.assign({ trigger: el }, triggerDefaults)
          }
        );
      });

      // ── 2. SLIDE-IN animations (graphic-text) ────────────────────────
      gsap.utils.toArray('[data-animate="slide-in-left"]').forEach(function(el) {
        gsap.fromTo(el,
          { x: -120, opacity: 0 },
          {
            x: 0, opacity: 1,
            duration: 1.2,
            ease: 'power4.out',
            scrollTrigger: Object.assign({ trigger: el }, triggerDefaults)
          }
        );
      });
      gsap.utils.toArray('[data-animate="slide-in-right"]').forEach(function(el) {
        gsap.fromTo(el,
          { x: 120, opacity: 0 },
          {
            x: 0, opacity: 1,
            duration: 1.2,
            ease: 'power4.out',
            scrollTrigger: Object.assign({ trigger: el }, triggerDefaults)
          }
        );
      });

      // ── 3. SCALE-IN animations ───────────────────────────────────────
      gsap.utils.toArray('[data-animate="scale-in"]').forEach(function(el) {
        gsap.fromTo(el,
          { scale: 0.8, opacity: 0 },
          {
            scale: 1, opacity: 1,
            duration: 1,
            ease: 'back.out(1.4)',
            scrollTrigger: Object.assign({ trigger: el }, triggerDefaults)
          }
        );
      });

      // ── 4. CLIP-PATH reveals (images, media) ────────────────────────
      gsap.utils.toArray('[data-animate="clip-up"]').forEach(function(el) {
        gsap.fromTo(el,
          { clipPath: 'inset(100% 0% 0% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 1.4,
            ease: 'power4.inOut',
            scrollTrigger: Object.assign({ trigger: el }, triggerDefaults)
          }
        );
      });

      // ── 5. STAGGER animations (card grids, lists, timelines) ─────────
      gsap.utils.toArray('[data-animate-stagger]').forEach(function(container) {
        var type = container.getAttribute('data-animate-stagger');
        var children = container.children;
        if (children.length === 0) return;

        var fromVars, toVars, easing;
        if (type === 'scale-in') {
          fromVars = { scale: 0.75, opacity: 0, y: 30 };
          toVars = { scale: 1, opacity: 1, y: 0 };
          easing = 'back.out(1.4)';
        } else {
          // Default: fade-up
          fromVars = { y: 80, opacity: 0 };
          toVars = { y: 0, opacity: 1 };
          easing = 'power4.out';
        }

        gsap.fromTo(children, fromVars,
          Object.assign({}, toVars, {
            stagger: 0.12,
            duration: 0.9,
            ease: easing,
            scrollTrigger: Object.assign({ trigger: container }, triggerDefaults)
          })
        );
      });

      // ── 6. PARALLAX (hero bg, full-bleed bg) ────────────────────────
      gsap.utils.toArray('[data-parallax]').forEach(function(el) {
        gsap.to(el, {
          y: -120,
          scale: 1.08,
          ease: 'none',
          scrollTrigger: {
            trigger: el.parentElement || el,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6
          }
        });
      });

      // ── 7. TEXT REVEALS (hero title, pullquotes, headings) ───────────
      if (typeof SplitType !== 'undefined') {
        gsap.utils.toArray('[data-text-reveal]').forEach(function(el) {
          try {
            var split = new SplitType(el, { types: 'lines' });
            if (!split.lines || split.lines.length === 0) return;

            // Wrap each line in overflow-hidden container
            split.lines.forEach(function(line) {
              var wrapper = document.createElement('div');
              wrapper.style.overflow = 'hidden';
              wrapper.style.display = 'block';
              line.parentNode.insertBefore(wrapper, line);
              wrapper.appendChild(line);
            });

            gsap.from(split.lines, {
              y: '120%',
              rotateX: 8,
              stagger: 0.1,
              duration: 1,
              ease: 'power4.out',
              scrollTrigger: Object.assign({ trigger: el }, triggerDefaults)
            });
          } catch(e) {
            // SplitType failed on this element — make it visible
            el.style.opacity = '1';
          }
        });
        console.log('SplitType text reveals: active');
      }

      // ── 8. STAT COUNTER animations ───────────────────────────────────
      gsap.utils.toArray('[data-counter]').forEach(function(el) {
        var text = el.textContent.trim();
        // Extract number and any prefix/suffix (e.g., "95%", "$2.5M", "10,000+")
        var match = text.match(/^([^0-9]*?)([0-9][0-9,.]*)(.*)$/);
        if (!match) return; // Not a countable number

        var prefix = match[1];
        var numStr = match[2];
        var suffix = match[3];
        var targetNum = parseFloat(numStr.replace(/,/g, ''));
        if (isNaN(targetNum)) return;

        var hasDecimal = numStr.indexOf('.') !== -1;
        var decimalPlaces = hasDecimal ? (numStr.split('.')[1] || '').length : 0;
        var hasComma = numStr.indexOf(',') !== -1;

        // Store original text so we can restore if editing starts before animation
        el.setAttribute('data-counter-final', text);
        el.textContent = prefix + '0' + suffix;

        var obj = { val: 0 };
        var tween = gsap.to(obj, {
          val: targetNum,
          duration: 2,
          ease: 'power2.out',
          scrollTrigger: Object.assign({ trigger: el }, triggerDefaults),
          onUpdate: function() {
            var n = obj.val;
            var formatted;
            if (hasDecimal) {
              formatted = n.toFixed(decimalPlaces);
            } else {
              formatted = Math.round(n).toString();
            }
            if (hasComma) {
              formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            }
            el.textContent = prefix + formatted + suffix;
          }
        });
        // Store tween ref so editing mode can kill it (killTweensOf(el) won't
        // find it because the tween target is obj, not el)
        el._counterTween = tween;
      });

      // ── 9. ACCENT BAR grow (pullquote border-l) ─────────────────────
      gsap.utils.toArray('[data-accent-bar]').forEach(function(el) {
        gsap.fromTo(el,
          { borderLeftWidth: '0px' },
          {
            borderLeftWidth: '4px',
            duration: 0.6,
            ease: 'power2.out',
            scrollTrigger: Object.assign({ trigger: el }, triggerDefaults)
          }
        );
      });

      // ── 10. HERO-SPECIFIC timing ────────────────────────────────────
      // Hero elements animate immediately (above the fold), not on scroll
      var heroEl = document.querySelector('[data-component-type="hero"]');
      if (heroEl) {
        var heroAnimates = heroEl.querySelectorAll('[data-animate]');
        heroAnimates.forEach(function(el, i) {
          gsap.fromTo(el,
            { y: 60, opacity: 0 },
            {
              y: 0, opacity: 1,
              duration: 1.3,
              delay: 0.4 + (i * 0.2),
              ease: 'power4.out'
            }
          );
        });
      }

      // ── 11. SECTION TITLE BAR animation ──────────────────────────────
      // The gradient divider lines that separate sections
      gsap.utils.toArray('[data-section-track]').forEach(function(el) {
        gsap.fromTo(el,
          { opacity: 0, y: 20 },
          {
            opacity: 1, y: 0,
            duration: 0.6,
            ease: 'power2.out',
            scrollTrigger: Object.assign({ trigger: el }, triggerDefaults)
          }
        );
      });

      var animCount = document.querySelectorAll('[data-animate], [data-animate-stagger], [data-parallax], [data-text-reveal], [data-counter]').length;
      console.log('Scroll animations: ' + animCount + ' elements animated');
    })();

    // ── HYDRATE COMPONENT — re-initialize a single component after variant swap ─
    // querySelectorAll only searches descendants, not the root itself.
    // Many interactive attrs (data-quiz, data-carousel) live on the section element,
    // which IS the rootEl after a variant swap. This helper matches both.
    function qsaIncludingSelf(root, sel) {
      var list = Array.prototype.slice.call(root.querySelectorAll(sel));
      if (root.matches && root.matches(sel)) list.unshift(root);
      return list;
    }

    function hydrateComponent(rootEl) {
      // Quiz
      qsaIncludingSelf(rootEl, '[data-quiz]').forEach(hydrateQuiz);
      // Tabs
      qsaIncludingSelf(rootEl, '[data-tabs]').forEach(hydrateTabs);
      // Flashcards
      qsaIncludingSelf(rootEl, '[data-flashcard]').forEach(hydrateFlashcard);
      // Carousel / Narrative
      qsaIncludingSelf(rootEl, '[data-carousel]').forEach(hydrateCarousel);
      // Checklist
      qsaIncludingSelf(rootEl, '[data-checklist]').forEach(hydrateChecklist);
      // Accordion: CSS-only, no JS init needed
      // GSAP animations for the new content
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        rootEl.querySelectorAll('[data-animate]').forEach(function(el) {
          el.style.opacity = '1';
          el.style.transform = 'none';
        });
        rootEl.querySelectorAll('[data-counter]').forEach(function(el) {
          // Reset counter to show final value immediately (no animation on swap)
          // The value is already in the HTML from build-course.js
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // AUTHORING LAYER — Variant Toggle System
    // Stores cloned DOM nodes (not HTML strings) for reliable swapping.
    // ══════════════════════════════════════════════════════════════════════
    (function initAuthoringMode() {
      var hasTemplates = document.querySelector('template[data-variant-alt]');
      if (!hasTemplates) return;

      // Read category metadata from embedded JSON
      var categoryMeta = { map: {}, colors: {}, labels: {} };
      var catMetaEl = document.getElementById('category-meta');
      if (catMetaEl) {
        try { categoryMeta = JSON.parse(catMetaEl.textContent); } catch(e) {}
      }
      var catMap = categoryMeta.map || {};
      var catColors = categoryMeta.colors || {};
      var catLabels = categoryMeta.labels || {};

      var authoringActive = false;
      var entries = [];

      // User-friendly component type labels (display only — internal names unchanged)
      var typeLabels = {
        'hero': 'Hero Banner',
        'text': 'Text Block',
        'graphic': 'Image',
        'graphic-text': 'Image & Text',
        'full-bleed': 'Full-Width Image',
        'pullquote': 'Quote',
        'stat-callout': 'Key Statistics',
        'key-term': 'Glossary',
        'callout': 'Callout',
        'accordion': 'Accordion',
        'tabs': 'Tabs',
        'narrative': 'Slideshow',
        'flashcard': 'Flashcards',
        'labeled-image': 'Labelled Image',
        'mcq': 'Quiz',
        'branching': 'Scenario',
        'textinput': 'Open Response',
        'checklist': 'Checklist',
        'bento': 'Cards',
        'comparison': 'Comparison',
        'data-table': 'Table',
        'timeline': 'Timeline',
        'process-flow': 'Process',
        'image-gallery': 'Gallery',
        'media': 'Video',
        'video-transcript': 'Video + Transcript',
        'divider': 'Divider',
        'path-selector': 'Course Paths'
      };

      // Per-component variant labels — each component gets its own descriptions
      // that accurately describe what changes between its variants
      var variantLabels = {
        'hero': {
          'centered-overlay': 'Centred overlay',
          'split-screen': 'Split screen',
          'minimal-text': 'Text only'
        },
        'text': {
          'standard': 'Single column',
          'two-column': 'Two columns',
          'highlight-box': 'Highlight box'
        },
        'graphic': {
          'standard': 'Simple',
          'captioned-card': 'Card with caption'
        },
        'graphic-text': {
          'split': 'Side by side',
          'overlap': 'Overlapping',
          'full-overlay': 'Full background'
        },
        'pullquote': {
          'accent-bar': 'Side accent',
          'centered': 'Centred',
          'minimal': 'Minimal'
        },
        'stat-callout': {
          'centered': 'Grid',
          'card-row': 'Cards with bars'
        },
        'callout': {
          'info': 'Info',
          'warning': 'Warning',
          'tip': 'Tip',
          'success': 'Success'
        },
        'accordion': {
          'standard': 'Simple',
          'accent-border': 'Icons and border'
        },
        'tabs': {
          'horizontal': 'Tabs on top',
          'vertical': 'Tabs on side'
        },
        'narrative': {
          'image-focused': 'Image emphasis',
          'text-focused': 'Text emphasis'
        },
        'flashcard': {
          'grid': 'Show all',
          'single-large': 'One at a time'
        },
        'labeled-image': {
          'numbered-dots': 'Numbered on image',
          'side-panel': 'Side panel'
        },
        'mcq': {
          'stacked': 'Stacked',
          'grid': 'Grid'
        },
        'branching': {
          'cards': 'Cards',
          'list': 'List'
        },
        'checklist': {
          'standard': 'Simple list',
          'card-style': 'Cards',
          'numbered': 'Numbered'
        },
        'bento': {
          'grid-4': 'Grid',
          'wide-2': 'Two columns',
          'featured': 'Featured card'
        },
        'comparison': {
          'columns': 'Side by side',
          'stacked-rows': 'Stacked rows'
        },
        'data-table': {
          'standard': 'Simple',
          'striped-card': 'Card with stripes'
        },
        'timeline': {
          'vertical': 'Stacked',
          'centered-alternating': 'Alternating sides'
        },
        'process-flow': {
          'vertical': 'Top to bottom',
          'horizontal': 'Left to right'
        },
        'key-term': {
          'list': 'List',
          'card-grid': 'Cards'
        },
        'divider': {
          'line': 'Line',
          'spacing': 'Space only',
          'icon': 'Icon'
        },
        'full-bleed': {
          'center': 'Text centred',
          'left': 'Text left',
          'right': 'Text right'
        }
      };

      // ── Authoring button ─────────────────────────────────────────────
      var authoringBtn = document.createElement('button');
      authoringBtn.textContent = '✎ Edit';
      authoringBtn.setAttribute('style',
        'position:fixed;top:12px;right:12px;z-index:10000;' +
        'background:#f59e0b;color:#000;border:none;' +
        'padding:5px 14px;border-radius:4px;font:bold 11px/1.4 monospace;' +
        'cursor:pointer;opacity:0.7;'
      );
      authoringBtn.addEventListener('mouseenter', function() { authoringBtn.style.opacity = '1'; });
      authoringBtn.addEventListener('mouseleave', function() { if (!authoringActive) authoringBtn.style.opacity = '0.7'; });
      document.body.appendChild(authoringBtn);

      // ── Export button (download modified JSON) ──────────────────────────
      var exportBtn = document.createElement('button');
      exportBtn.textContent = '↓ Export JSON';
      exportBtn.setAttribute('style',
        'position:fixed;top:12px;right:120px;z-index:10000;' +
        'background:#3b82f6;color:#fff;border:none;' +
        'padding:5px 14px;border-radius:4px;font:bold 11px/1.4 monospace;' +
        'cursor:pointer;display:none;'
      );
      exportBtn.addEventListener('mouseenter', function() { exportBtn.style.background = '#2563eb'; });
      exportBtn.addEventListener('mouseleave', function() { exportBtn.style.background = '#3b82f6'; });
      exportBtn.addEventListener('click', function() {
        if (!courseData) return;
        var json = JSON.stringify(courseData, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'course-layout.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('Authoring: Exported course-layout.json (' + json.length + ' chars)');
      });
      document.body.appendChild(exportBtn);

      // ── Init: extract DOM nodes from templates ────────────────────────
      var initialized = false;
      function initEntries() {
        if (initialized) return;
        initialized = true;

        document.querySelectorAll('section[data-component-type]').forEach(function(section) {
          var templates = section.querySelectorAll('template[data-variant-alt]');
          if (templates.length === 0) return;

          var compType = section.getAttribute('data-component-type');
          var activeVariant = section.getAttribute('data-variant') || 'default';

          // Store cloned DOM nodes — NOT HTML strings
          var variantNodes = {};

          // Extract alternate variants from templates as DOM nodes
          templates.forEach(function(t) {
            var varName = t.getAttribute('data-variant-alt');
            var frag = t.content;
            // Find the section element inside the fragment
            var node = frag.querySelector('section') || frag.firstElementChild;
            if (node) {
              variantNodes[varName] = node.cloneNode(true);
            }
          });

          // Remove templates from live DOM
          templates.forEach(function(t) { t.remove(); });

          // Store current active section as a cloned node
          variantNodes[activeVariant] = section.cloneNode(true);

          // Wrap section in a stable container
          var wrapper = document.createElement('div');
          wrapper.setAttribute('data-authoring-wrapper', compType);
          wrapper.style.position = 'relative';
          section.parentElement.insertBefore(wrapper, section);
          wrapper.appendChild(section);

          // Build toolbar with category colour
          var category = catMap[compType] || 'Structure';
          var catColor = catColors[category] || '#f59e0b';
          var catLabel = catLabels[category] || category;

          var toolbar = document.createElement('div');
          toolbar.setAttribute('data-authoring-category', category);
          toolbar.setAttribute('style',
            'display:none;background:' + catColor + ';color:#fff;padding:6px 14px;' +
            'font:bold 11px/1.4 monospace;align-items:center;gap:6px;' +
            'border-radius:6px 6px 0 0;margin:0 8px;flex-wrap:wrap;'
          );

          // Component type label (user-friendly display name)
          var typeLabel = document.createElement('span');
          typeLabel.textContent = typeLabels[compType] || compType;
          typeLabel.style.cssText = 'font:bold 11px/1.4 monospace;margin-right:6px;opacity:0.9;';
          toolbar.appendChild(typeLabel);

          // Spacer to push delete button to the right
          var spacer = document.createElement('span');
          spacer.style.cssText = 'flex:1;';
          toolbar.appendChild(spacer);

          // Edit text toggle (only for interactive components)
          var editToggleBtn = null;
          if (section.hasAttribute('data-interactive')) {
            editToggleBtn = document.createElement('button');
            editToggleBtn.textContent = '✏️ Edit text';
            editToggleBtn.title = 'Pause interactivity to edit text';
            editToggleBtn.setAttribute('data-authoring-edit-toggle', 'preview');
            editToggleBtn.style.cssText = 'background:rgba(59,130,246,0.8);color:#fff;border:1px solid rgba(59,130,246,0.9);padding:2px 10px;border-radius:3px;font:bold 10px/1.4 monospace;cursor:pointer;';
            editToggleBtn.addEventListener('mouseenter', function() { editToggleBtn.style.background = 'rgba(59,130,246,1)'; });
            editToggleBtn.addEventListener('mouseleave', function() {
              var isEdit = editToggleBtn.getAttribute('data-authoring-edit-toggle') === 'editing';
              editToggleBtn.style.background = isEdit ? 'rgba(34,197,94,0.8)' : 'rgba(59,130,246,0.8)';
            });
            toolbar.appendChild(editToggleBtn);
          }

          // Delete button (right-aligned)
          var deleteBtn = document.createElement('button');
          deleteBtn.textContent = '✕ Delete';
          deleteBtn.title = 'Delete this section';
          deleteBtn.style.cssText = 'background:rgba(0,0,0,0.3);color:#fff;border:1px solid rgba(255,255,255,0.3);padding:2px 10px;border-radius:3px;font:bold 10px/1.4 monospace;cursor:pointer;margin-left:auto;';
          deleteBtn.addEventListener('mouseenter', function() { deleteBtn.style.background = '#ef4444'; deleteBtn.style.borderColor = '#ef4444'; });
          deleteBtn.addEventListener('mouseleave', function() { deleteBtn.style.background = 'rgba(0,0,0,0.3)'; deleteBtn.style.borderColor = 'rgba(255,255,255,0.3)'; });
          toolbar.appendChild(deleteBtn);

          // Variant buttons row (after spacer+delete, on a new flex line)
          var variantRow = document.createElement('div');
          variantRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;width:100%;margin-top:4px;';
          toolbar.appendChild(variantRow);

          var variantNames = Object.keys(variantNodes);
          variantNames.forEach(function(v) {
            var btn = document.createElement('button');
            btn.textContent = (variantLabels[compType] && variantLabels[compType][v]) || v;
            btn.setAttribute('data-authoring-variant', v);
            btn.title = v;
            var isActive = v === activeVariant;
            btn.style.cssText =
              'background:' + (isActive ? 'rgba(0,0,0,0.4)' : 'transparent') +
              ';color:#fff' +
              ';border:1px solid ' + (isActive ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)') +
              ';padding:2px 10px;border-radius:3px;font:bold 11px/1.4 monospace;cursor:pointer;';
            variantRow.appendChild(btn);
          });

          wrapper.insertBefore(toolbar, section);

          var entry = {
            wrapper: wrapper,
            toolbar: toolbar,
            activeVariant: activeVariant,
            compType: compType,
            variantNodes: variantNodes,
            catColor: catColor
          };
          entries.push(entry);

          toolbar.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-authoring-variant]');
            if (!btn) return;
            var target = btn.getAttribute('data-authoring-variant');
            if (target === entry.activeVariant) return;
            swapVariant(entry, target);
          });

          // Delete section handler
          deleteBtn.addEventListener('click', function() {
            var friendlyName = typeLabels[entry.compType] || entry.compType;
            if (!confirm('Delete this ' + friendlyName + ' section? This cannot be undone.')) return;

            // Remove from JSON model
            var sec = entry.wrapper.querySelector('section[data-component-type]');
            if (sec && courseData) {
              var si = parseInt(sec.getAttribute('data-section-index'), 10);
              var ci = parseInt(sec.getAttribute('data-component-index'), 10);
              if (!isNaN(si) && !isNaN(ci) && courseData.sections[si]) {
                courseData.sections[si].components.splice(ci, 1);
                var sectionRemoved = courseData.sections[si].components.length === 0;
                if (sectionRemoved) {
                  courseData.sections.splice(si, 1);
                }
                saveCourseData();
                // Re-index remaining DOM sections to keep data attributes in sync
                document.querySelectorAll('section[data-component-type][data-section-index]').forEach(function(s) {
                  var sIdx = parseInt(s.getAttribute('data-section-index'), 10);
                  var cIdx = parseInt(s.getAttribute('data-component-index'), 10);
                  if (!sectionRemoved && sIdx === si && cIdx > ci) {
                    s.setAttribute('data-component-index', cIdx - 1);
                  } else if (sectionRemoved && sIdx > si) {
                    s.setAttribute('data-section-index', sIdx - 1);
                  }
                });
              }
            }

            // Remove from DOM
            var idx = entries.indexOf(entry);
            if (idx > -1) entries.splice(idx, 1);
            entry.wrapper.remove();
            console.log('Authoring: deleted ' + entry.compType + ' section');
          });

          // Edit text toggle handler (interactive components only)
          if (editToggleBtn) {
            editToggleBtn.addEventListener('click', function() {
              var sec = entry.wrapper.querySelector('section[data-component-type]');
              if (!sec) return;
              var isEditing = sec.hasAttribute('data-editing');

              if (isEditing) {
                // Switch to preview mode
                sec.removeAttribute('data-editing');
                disableInlineEditingForSection(sec);
                editToggleBtn.textContent = '✏️ Edit text';
                editToggleBtn.title = 'Pause interactivity to edit text';
                editToggleBtn.setAttribute('data-authoring-edit-toggle', 'preview');
                editToggleBtn.style.background = 'rgba(59,130,246,0.8)';
                editToggleBtn.style.borderColor = 'rgba(59,130,246,0.9)';
                // Kill any GSAP counters for stat-callout so values stay as edited
                sec.querySelectorAll('[data-counter]').forEach(function(el) {
                  if (el._counterTween) { el._counterTween.kill(); el._counterTween = null; }
                });
                console.log('Authoring: ' + entry.compType + ' → preview mode (interactivity resumed)');
              } else {
                // Switch to edit mode
                sec.setAttribute('data-editing', '');
                enableInlineEditingForSection(sec);
                editToggleBtn.textContent = '▶ Done';
                editToggleBtn.title = 'Resume interactivity';
                editToggleBtn.setAttribute('data-authoring-edit-toggle', 'editing');
                editToggleBtn.style.background = 'rgba(34,197,94,0.8)';
                editToggleBtn.style.borderColor = 'rgba(34,197,94,0.9)';
                console.log('Authoring: ' + entry.compType + ' → editing mode (interactivity paused)');
              }
            });
          }

        });
      }

      // ── Swap using cloned DOM nodes ───────────────────────────────────
      function swapVariant(entry, targetVariant) {
        var targetNode = entry.variantNodes[targetVariant];
        if (!targetNode) { console.warn('Authoring: No node for', targetVariant); return; }

        // Find current live section
        var currentSection = entry.wrapper.querySelector('section[data-component-type]');
        if (!currentSection) { console.warn('Authoring: No current section found'); return; }

        // Always clone from original pristine templates — never save dirty DOM back.
        // User edits are persisted in the JSON data model (courseData) and re-applied
        // to the fresh template below. Saving mutated DOM causes: duplicated content
        // from double-hydration, GSAP inline style accumulation, carousel dot duplication,
        // contenteditable artifact carry-over, and image dimension corruption.

        // Clone the target and insert
        var newSection = targetNode.cloneNode(true);
        currentSection.parentNode.replaceChild(newSection, currentSection);

        // Re-hydrate interactivity
        hydrateComponent(newSection);

        // Apply edited text from JSON model to the new variant's DOM
        if (courseData) {
          var cd = getCompData(newSection);
          if (cd) {
            // Apply displayTitle to first heading
            if (cd.displayTitle !== undefined) {
              var heading = newSection.querySelector('h1,h2,h3,h4,h5,h6');
              if (heading) heading.textContent = cd.displayTitle;
            }
            // Apply body to paragraphs ONLY if the user has edited the text.
            // Original AI body contains HTML <p> tags — the template already has this content.
            // The edit handler converts body to \n\n-separated plain text (no <p> tags).
            // If body still contains <p> tags, it's unedited — skip to avoid content duplication
            // (setting <p>-containing HTML as innerHTML of a <p> creates nested <p> → browser
            // auto-closes → duplicated paragraphs).
            if (cd.body !== undefined && !cd.body.includes('<p>') && !cd.body.includes('<p ')) {
              var bodyParts = cd.body.split('\n\n');
              var paras = [];
              newSection.querySelectorAll('p').forEach(function(p) {
                if (p.closest('[data-carousel] nav')) return;
                if (p.hasAttribute('data-edit-path')) return;
                paras.push(p);
              });
              paras.forEach(function(p, i) {
                if (i < bodyParts.length) p.innerHTML = bodyParts[i];
              });
            }
            // Apply structured data edits to data-edit-path elements in new variant
            newSection.querySelectorAll('[data-edit-path]').forEach(function(el) {
              var path = el.getAttribute('data-edit-path');
              var useHtml = el.hasAttribute('data-edit-html');
              var parts = path.split('.');
              var val = cd;
              for (var k = 0; k < parts.length; k++) {
                var key = isNaN(parts[k]) ? parts[k] : parseInt(parts[k], 10);
                if (val === undefined || val === null) break;
                val = val[key];
              }
              if (val !== undefined && val !== null) {
                if (useHtml) {
                  el.innerHTML = val;
                } else {
                  // Strip HTML tags — JSON body values may contain <p> etc. from AI generation;
                  // build-course.js strips at build time but variant swap must do the same
                  var clean = typeof val === 'string' ? val.replace(/<[^>]*>/g, '') : val;
                  // For stat-callout values, reconstruct prefix + value + suffix
                  if (el.hasAttribute('data-counter') && path.match(/_items\.\d+\.value$/)) {
                    var itemPath = path.replace(/\.value$/, '');
                    var itemParts = itemPath.split('.');
                    var itemObj = cd;
                    for (var m = 0; m < itemParts.length; m++) {
                      var ik = isNaN(itemParts[m]) ? itemParts[m] : parseInt(itemParts[m], 10);
                      if (itemObj === undefined || itemObj === null) break;
                      itemObj = itemObj[ik];
                    }
                    if (itemObj) {
                      clean = (itemObj.prefix || '') + clean + (itemObj.suffix || '');
                    }
                  }
                  el.textContent = clean;
                }
              }
            });

            // Update variant in JSON model
            cd.variant = targetVariant;
            saveCourseData();
          }
        }

        // Re-enable inline editing on swapped variant if authoring is active
        if (authoringActive && courseData) {
          // If the old section was in edit mode, carry it over to the new variant
          var wasEditing = currentSection.hasAttribute('data-editing');
          if (wasEditing) {
            newSection.setAttribute('data-editing', '');
          }
          enableInlineEditingForSection(newSection);
        }

        // Strip animation attributes so CSS [data-animate]{opacity:0} doesn't hide swapped variants
        newSection.removeAttribute('data-animate');
        newSection.removeAttribute('data-animate-stagger');
        newSection.removeAttribute('data-parallax');
        newSection.removeAttribute('data-text-reveal');
        newSection.querySelectorAll('[data-animate]').forEach(function(el) { el.removeAttribute('data-animate'); });
        newSection.querySelectorAll('[data-animate-stagger]').forEach(function(el) { el.removeAttribute('data-animate-stagger'); });
        // Force visible in case inline styles were set by GSAP before cloning
        newSection.style.opacity = '1'; newSection.style.transform = 'none'; newSection.style.clipPath = 'none';
        newSection.querySelectorAll('*').forEach(function(el) {
          if (el.style.opacity === '0') { el.style.opacity = '1'; el.style.transform = 'none'; }
        });

        entry.activeVariant = targetVariant;

        // Update button styles
        entry.toolbar.querySelectorAll('[data-authoring-variant]').forEach(function(btn) {
          var isActive = btn.getAttribute('data-authoring-variant') === targetVariant;
          btn.style.background = isActive ? 'rgba(0,0,0,0.4)' : 'transparent';
          btn.style.color = '#fff';
          btn.style.borderColor = isActive ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)';
        });

        console.log('Authoring: ' + entry.compType + ' → ' + targetVariant);
      }

      // ── Course data (JSON model) ──────────────────────────────────────
      var courseData = null;
      function loadCourseData() {
        if (courseData) return courseData;
        var el = document.getElementById('course-data');
        if (!el) return null;
        try { courseData = JSON.parse(el.textContent); } catch(e) { console.warn('Authoring: Failed to parse course-data JSON'); }
        return courseData;
      }

      function saveCourseData() {
        if (!courseData) return;
        var el = document.getElementById('course-data');
        if (el) el.textContent = JSON.stringify(courseData);
      }

      // ── Inline editing helpers ──────────────────────────────────────────
      var editableElements = [];

      // Map of which text fields are editable per component type
      // displayTitle → first heading, body → prose paragraphs
      var EDITABLE_FIELDS = {
        displayTitle: { selector: 'h1,h2,h3,h4,h5,h6', first: true },
        body: { selector: 'p', multi: true }
      };

      // Set a value at a dot-separated path (e.g., "_items.2.title")
      function setNestedValue(obj, path, value) {
        var parts = path.split('.');
        var target = obj;
        for (var k = 0; k < parts.length - 1; k++) {
          var key = isNaN(parts[k]) ? parts[k] : parseInt(parts[k], 10);
          if (target[key] === undefined) return;
          target = target[key];
        }
        var lastKey = isNaN(parts[parts.length - 1]) ? parts[parts.length - 1] : parseInt(parts[parts.length - 1], 10);
        target[lastKey] = value;
      }

      function getCompData(section) {
        var si = section.getAttribute('data-section-index');
        var ci = section.getAttribute('data-component-index');
        if (si === null || ci === null || !courseData) return null;
        var sec = courseData.sections[parseInt(si, 10)];
        if (!sec) return null;
        return sec.components[parseInt(ci, 10)] || null;
      }

      function enableInlineEditingForSection(section) {
        var compData = getCompData(section);
        if (!compData) return;
        var isInteractive = section.hasAttribute('data-interactive');

        // For interactive sections, editing is gated by the per-section toggle
        // (data-editing attribute). Non-interactive sections edit immediately.
        if (isInteractive && !section.hasAttribute('data-editing')) return;

        // Kill GSAP counter animations so they don't overwrite editable text
        section.querySelectorAll('[data-counter]').forEach(function(el) {
          if (el._counterTween) {
            el._counterTween.kill();
            el._counterTween = null;
          }
          // If animation hasn't played yet, restore the final value
          var finalText = el.getAttribute('data-counter-final');
          if (finalText && el.textContent.match(/^[^0-9]*0[^0-9]*$/)) {
            el.textContent = finalText;
          }
        });

        // displayTitle — first heading in the section
        if (compData.displayTitle !== undefined) {
          var heading = section.querySelector('h1,h2,h3,h4,h5,h6');
          if (heading && !heading.hasAttribute('data-editable') && !heading.hasAttribute('data-edit-path')) {
            heading.setAttribute('contenteditable', 'true');
            heading.setAttribute('data-editable', 'displayTitle');
            heading.setAttribute('spellcheck', 'true');
            editableElements.push(heading);

            // Only add listeners once (prevent zombie listeners on toggle cycles)
            if (!heading.hasAttribute('data-edit-bound')) {
              heading.setAttribute('data-edit-bound', '');
              heading.addEventListener('input', function() {
                var cd = getCompData(section);
                if (cd) { cd.displayTitle = heading.textContent; saveCourseData(); }
              });

              heading.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); heading.blur(); }
              });
            }
          }
        }

        // body — paragraph text (can be multiple paragraphs)
        if (compData.body !== undefined) {
          var paras = section.querySelectorAll('p');
          paras.forEach(function(p) {
            // Skip paragraphs inside carousel nav (prev/next buttons contain no editable text)
            if (p.closest('[data-carousel] nav')) return;
            if (p.hasAttribute('data-editable')) return;
            // Skip paragraphs that already have a data-edit-path (handled below)
            if (p.hasAttribute('data-edit-path')) return;

            p.setAttribute('contenteditable', 'true');
            p.setAttribute('data-editable', 'body');
            p.setAttribute('spellcheck', 'true');
            editableElements.push(p);

            if (!p.hasAttribute('data-edit-bound')) {
              p.setAttribute('data-edit-bound', '');
              p.addEventListener('input', function() {
                var cd = getCompData(section);
                if (!cd) return;
                var allParas = section.querySelectorAll('p[data-editable="body"]');
                var texts = [];
                allParas.forEach(function(pp) { texts.push(pp.innerHTML); });
                cd.body = texts.join('\n\n');
                saveCourseData();
              });

              p.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); }
              });
            }
          });
        }

        // Structured content — elements with data-edit-path (items, stats, nodes, etc.)
        section.querySelectorAll('[data-edit-path]').forEach(function(el) {
          if (el.hasAttribute('data-editable')) return;

          var path = el.getAttribute('data-edit-path');
          var useHtml = el.hasAttribute('data-edit-html');

          el.setAttribute('contenteditable', 'true');
          el.setAttribute('data-editable', 'path:' + path);
          el.setAttribute('spellcheck', 'true');
          editableElements.push(el);

          if (!el.hasAttribute('data-edit-bound')) {
            el.setAttribute('data-edit-bound', '');
            el.addEventListener('input', function() {
              var cd = getCompData(section);
              if (!cd) return;
              var value = useHtml ? el.innerHTML : el.textContent;
              setNestedValue(cd, path, value);
              saveCourseData();
            });

            el.addEventListener('keydown', function(e) {
              if (!useHtml && e.key === 'Enter') { e.preventDefault(); el.blur(); }
            });
          }
        });
      }

      // Disable inline editing for a single section (used by edit toggle)
      function disableInlineEditingForSection(section) {
        var toRemove = [];
        editableElements.forEach(function(el) {
          if (section.contains(el)) {
            el.removeAttribute('contenteditable');
            el.removeAttribute('data-editable');
            el.removeAttribute('spellcheck');
            el.removeAttribute('data-edit-bound');
            toRemove.push(el);
          }
        });
        toRemove.forEach(function(el) {
          var idx = editableElements.indexOf(el);
          if (idx > -1) editableElements.splice(idx, 1);
        });
      }

      function enableInlineEditing() {
        var data = loadCourseData();
        if (!data) { console.warn('Authoring: No course-data JSON found — inline editing disabled'); return; }

        document.querySelectorAll('section[data-component-type][data-section-index]').forEach(function(section) {
          enableInlineEditingForSection(section);
        });
      }

      function disableInlineEditing() {
        editableElements.forEach(function(el) {
          el.removeAttribute('contenteditable');
          el.removeAttribute('data-editable');
          el.removeAttribute('spellcheck');
          el.removeAttribute('data-edit-bound');
        });
        editableElements = [];
      }

      // ── Inline editing CSS ─────────────────────────────────────────────
      var editingStyleEl = document.createElement('style');
      editingStyleEl.textContent =
        '[data-editable] { cursor: text; transition: outline 0.15s ease, background 0.15s ease; outline: 2px solid transparent; outline-offset: 2px; border-radius: 4px; }' +
        '[data-editable]:hover { outline: 2px dashed rgba(59,130,246,0.5); }' +
        '[data-editable]:focus { outline: 2px solid rgba(59,130,246,0.8); background: rgba(59,130,246,0.05); }' +
        '[data-editable]::before { content: none; }' +
        // Disable gradient-text effect on editable elements — -webkit-text-fill-color:transparent
        // makes text invisible when contenteditable is active
        '[data-editable].text-gradient { -webkit-text-fill-color: currentColor; background: none; }' +
        // When a section is in editing mode, disable pointer events on checkboxes
        // so label clicks don't toggle them while editing text
        'section[data-editing] input[type="checkbox"] { pointer-events: none; }' +
        // Disable cursor:pointer on flashcards in edit mode
        'section[data-editing] [data-flashcard] { cursor: text !important; }' +
        // Disable cursor:pointer on interactive buttons in edit mode
        'section[data-editing] [data-choice] { cursor: text !important; }' +
        'section[data-editing] [data-tab-trigger] { cursor: text !important; }' +
        'section[data-editing] [data-path-option] { cursor: text !important; }' +
        // Ensure dividers are visible when authoring panel is active
        '[data-authoring-wrapper="divider"] section[data-component-type="divider"] { min-height: 48px; display: flex; align-items: center; padding-top: 16px !important; padding-bottom: 16px !important; margin: 0 !important; }';
      document.head.appendChild(editingStyleEl);
      editingStyleEl.disabled = true;

      // ── Toggle authoring mode ──────────────────────────────────────────
      authoringBtn.addEventListener('click', function() {
        authoringActive = !authoringActive;
        authoringBtn.textContent = authoringActive ? '✎ Edit ✓' : '✎ Edit';
        authoringBtn.style.opacity = authoringActive ? '1' : '0.7';

        if (authoringActive) {
          initEntries();
          entries.forEach(function(e) {
            e.toolbar.style.display = 'flex';
            e.wrapper.style.outline = '2px dashed ' + (e.catColor || '#f59e0b');
            e.wrapper.style.outlineOffset = '-2px';
            e.wrapper.style.borderRadius = '8px';
          });
          enableInlineEditing();
          editingStyleEl.disabled = false;
          exportBtn.style.display = 'block';
        } else {
          entries.forEach(function(e) {
            e.toolbar.style.display = 'none';
            e.wrapper.style.outline = 'none';
          });
          // Clear all data-editing states on interactive sections
          document.querySelectorAll('section[data-editing]').forEach(function(sec) {
            sec.removeAttribute('data-editing');
          });
          // Reset edit toggle buttons
          document.querySelectorAll('[data-authoring-edit-toggle="editing"]').forEach(function(btn) {
            btn.textContent = '✏️ Edit text';
            btn.setAttribute('data-authoring-edit-toggle', 'preview');
            btn.style.background = 'rgba(59,130,246,0.8)';
            btn.style.borderColor = 'rgba(59,130,246,0.9)';
          });
          disableInlineEditing();
          editingStyleEl.disabled = true;
          exportBtn.style.display = 'none';
        }
      });
    })();

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
