/**
 * Content Planner — The intelligence layer between extraction and generation.
 * Takes raw CourseIR and produces a structured CoursePlan that:
 *   1. Cleans noise (junk variables, decorative shapes, auto-generated names)
 *   2. Understands course structure and narrative flow
 *   3. Groups slides into logical sections
 *   4. Classifies content for optimal deep-scroll presentation
 *   5. Preserves all meaningful interactions, triggers, and states
 *   6. Produces a verification report of what was kept vs dropped
 *
 * Output: CoursePlan { meta, sections[], quizBanks[], verification }
 */
window.ContentPlanner = (function () {
  'use strict';

  // ---- Noise detection ----

  // Exact match junk (decorative elements, Storyline internals)
  var JUNK_TEXT_PATTERNS = [
    /^(rectangle|oval|shape|round diagonal corner|freeform|group)\s*\d*$/i,
    /^(slide|scene)\s*\d+(\.\d+)?$/i,
    /^layer\s*\d*$/i,
    /^(question|correct|incorrect|submit|prev|next|back|continue)$/i,
    /^(true|false)$/i,
    /^pick\s*(one|many|all)$/i,
    /^text\s*\d*$/i,
    /^(shape|image|picture|photo|button)\s*\d+$/i,
    /%_player\.[^%]+%/,
    /^\s*$/,
    /^results?$/i,
    /^introduction$/i
  ];

  // Storyline UI instruction text — these tell users how to interact with the
  // Storyline player and are not meaningful course content in the modernised version
  var STORYLINE_UI_PATTERNS = [
    /click\s*(on\s*)?(the\s+)?(arrow|tab|button|icon|image|next|menu|item)/i,
    /click\s*(on\s*)?(each|the|an?)\s+(arrow|tab|button|icon|image|item|topic|section)/i,
    /click\s*(on\s*)?here\s+to/i,
    /click\s+to\s+(continue|proceed|begin|start|advance|move|go)/i,
    /tap\s+(on\s*)?(the\s+)?(arrow|tab|button|icon|image|next)/i,
    /select\s+(the|an?|each)\s+(arrow|tab|button|icon|image|item|topic)/i,
    /press\s+(the\s+)?(next|back|forward|arrow|play)\s*(button)?/i,
    /drag\s+(the|each|an?)\s+(item|image|word|phrase|answer)/i,
    /hover\s+over/i,
    /mouse\s+over/i,
    /roll\s+over/i,
    /use\s+the\s+(arrows?|buttons?|tabs?|slider|scroll\s*bar|menu)/i,
    /navigate\s+(using|with|by)/i,
    /explore\s+the\s+(tabs?|buttons?|arrows?|menu|topics?|sections?|items?)/i,
    /click\s+on\s+the\s+arrows?\s+to\s+explore/i,
    /swipe\s+(left|right|up|down)/i,
    /scroll\s+(down|up)\s+to\s+(continue|see|view|read)/i,
    /click\s+on\s+the\s+most\s+relevant/i,
    /click\s+(on\s+)?(the\s+)?most\s+relevant/i,
    /choose\s+(the|your)\s+(most\s+)?(relevant|appropriate|correct)/i,
    /make\s+your\s+(selection|choice)/i,
    /click\s+(on\s+)?(a|the|your)\s+(response|answer|option|choice)/i
  ];

  function isJunkText(text) {
    if (!text || text.length < 2) return true;
    return JUNK_TEXT_PATTERNS.some(function (p) { return p.test(text.trim()); });
  }

  /**
   * Detect Storyline UI instruction text that shouldn't appear in the modernised course.
   * These are instructions about how to interact with the Storyline player.
   */
  function isStorylineUIText(text) {
    if (!text) return false;
    var cleaned = text.trim();
    // Short text that is purely an instruction
    if (cleaned.length < 80) {
      return STORYLINE_UI_PATTERNS.some(function (p) { return p.test(cleaned); });
    }
    return false;
  }

  function isNavigationElement(el) {
    if (el.type !== 'button') return false;
    var label = (el.label || '').toLowerCase();
    return label === '<' || label === '>' || label === 'prev' ||
      label === 'next' || label === 'back' || label === 'continue' ||
      label === 'submit' || label.includes('hotspot') ||
      label.length <= 1;
  }

  function isMeaningfulText(text) {
    if (!text || isJunkText(text)) return false;
    if (isStorylineUIText(text)) return false;
    var cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > 3;
  }

  // ---- Section grouping ----

  /**
   * Group slides into logical sections based on course structure.
   * Storyline courses typically have: title > content > quiz > results
   * We detect natural section breaks (title slides, topic changes, quiz boundaries).
   */
  function groupIntoSections(slides, navigation) {
    var sections = [];
    var currentSection = null;

    for (var i = 0; i < slides.length; i++) {
      var slide = slides[i];
      var shouldBreak = false;

      // Start a new section on:
      if (slide.type === 'title') shouldBreak = true;
      else if (slide.type === 'results') shouldBreak = true;
      else if (slide.type === 'branching') shouldBreak = true;
      else if (!currentSection) shouldBreak = true;

      // Also break if there's a big topic shift (title keywords change significantly)
      if (currentSection && currentSection.slides.length >= 5 && slide.type === 'content') {
        var prevSlide = currentSection.slides[currentSection.slides.length - 1];
        if (prevSlide && isTopicShift(prevSlide.title, slide.title)) {
          shouldBreak = true;
        }
      }

      if (shouldBreak) {
        currentSection = {
          id: 'section_' + sections.length,
          type: classifySectionType(slide, slides, i),
          title: deriveSectionTitle(slide, sections.length),
          slides: []
        };
        sections.push(currentSection);
      }

      currentSection.slides.push(planSlide(slide, navigation));
    }

    return sections;
  }

  function isTopicShift(prevTitle, nextTitle) {
    if (!prevTitle || !nextTitle) return false;
    var prevWords = new Set(prevTitle.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 3; }));
    var nextWords = new Set(nextTitle.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 3; }));
    if (prevWords.size === 0 || nextWords.size === 0) return false;
    var overlap = 0;
    prevWords.forEach(function (w) { if (nextWords.has(w)) overlap++; });
    return overlap === 0;
  }

  function classifySectionType(firstSlide, allSlides, startIndex) {
    if (firstSlide.type === 'title') return 'hero';
    if (firstSlide.type === 'results') return 'results';
    if (firstSlide.type === 'branching') return 'branching';
    if (firstSlide.type === 'quiz') return 'assessment';
    if (firstSlide.type === 'form') return 'form';
    return 'content';
  }

  function deriveSectionTitle(slide, sectionIndex) {
    if (slide.type === 'title') return slide.title || 'Welcome';
    if (slide.type === 'results') return 'Your Results';
    if (slide.type === 'branching') return slide.title || 'Choose Your Path';
    if (sectionIndex === 0) return slide.title || 'Introduction';
    return slide.title || 'Section ' + (sectionIndex + 1);
  }

  // ---- Slide planning ----

  /**
   * Plan how a single slide should be presented in the deep-scroll output.
   * Extracts all meaningful content and classifies presentation style.
   */
  function planSlide(slide, navigation) {
    var plan = {
      id: slide.id,
      originalTitle: slide.title,
      type: slide.type,
      slideNumber: slide.slideNumber,
      presentation: 'standard',
      content: {
        headings: [],
        bodyTexts: [],
        callouts: [],
        images: [],
        videos: [],
        audio: []
      },
      layers: [],
      interactions: [],
      triggers: [],
      states: [],
      formFields: [],
      quizData: null
    };

    // Extract and classify all meaningful text
    slide.elements.forEach(function (el) {
      if (el.type === 'text' && isMeaningfulText(el.content)) {
        var cleaned = cleanTextContent(el.content);
        if (el.role === 'heading') {
          plan.content.headings.push({
            text: cleaned,
            fontSize: el.fontSize,
            fontFamily: el.fontFamily,
            color: el.color,
            align: el.textAlign
          });
        } else if (el.role === 'callout') {
          plan.content.callouts.push(cleaned);
        } else {
          plan.content.bodyTexts.push(cleaned);
        }
      }

      if (el.type === 'image' && el.assetId !== -1) {
        plan.content.images.push({
          assetId: el.assetId,
          originalPath: el.originalPath,
          altText: el.altText,
          role: el.instructionalRole || 'content',
          width: el.width,
          height: el.height
        });
      }

      if (el.type === 'video') {
        plan.content.videos.push({
          assetId: el.assetId,
          originalPath: el.originalPath,
          durationMs: el.durationMs,
          posterPath: el.posterPath
        });
      }

      if (el.type === 'audio') {
        plan.content.audio.push({
          assetId: el.assetId,
          originalPath: el.originalPath,
          durationMs: el.durationMs
        });
      }

      // Capture interactions (hotspots, sliders, scroll panels)
      if (el.type === 'interaction') {
        plan.interactions.push({
          type: el.interactionType,
          label: el.label,
          variableName: el.variableName,
          children: (el.children || []).map(function (c) {
            return { type: c.type, content: c.content || c.label, role: c.role };
          })
        });
      }

      // Capture meaningful buttons (for branching options and states)
      if (el.type === 'button' && !isNavigationElement(el)) {
        if (!plan.buttons) plan.buttons = [];
        plan.buttons.push({
          id: el.id,
          label: cleanButtonLabel(el.label),
          action: el.action
        });
        if (el.states && el.states.length > 0) {
          plan.states.push({
            elementId: el.id,
            label: el.label,
            states: el.states.map(function (s) {
              return { name: s.name, label: s.label, altText: s.altText };
            })
          });
        }
      }

      // Capture form fields
      if (el.type === 'form' && el.fields) {
        plan.formFields = el.fields.map(function (f) {
          return {
            label: f.label,
            fieldType: f.fieldType,
            variableName: f.variableName,
            required: f.required
          };
        });
      }

      // Capture quiz data
      if (el.type === 'quiz' && el.question) {
        plan.quizData = el.question;
      }
    });

    // Also check audioNarrationId
    if (slide.audioNarrationId) {
      plan.content.audio.push({
        assetId: slide.audioNarrationId,
        originalPath: '',
        durationMs: 0,
        isNarration: true
      });
    }

    // Plan layers with full content preservation
    if (slide.layers && slide.layers.length > 0) {
      plan.layers = slide.layers
        .filter(function (l) { return l.elements && l.elements.length > 0; })
        .map(function (layer) { return planLayer(layer); })
        .filter(function (l) { return l.hasContent; });
    }

    // Capture slide-level triggers
    if (slide.triggers && slide.triggers.length > 0) {
      plan.triggers = slide.triggers.map(function (t) {
        return {
          id: t.id,
          event: t.event,
          actions: t.actions,
          conditions: t.conditions,
          targetObjectId: t.targetObjectId
        };
      });
    }

    // Determine presentation style
    plan.presentation = classifyPresentation(plan);

    return plan;
  }

  /**
   * Plan a layer's content and interaction style.
   */
  function planLayer(layer) {
    var texts = [];
    var images = [];
    var videos = [];
    var audio = layer.audio || [];
    var interactions = [];

    layer.elements.forEach(function (el) {
      if (el.type === 'text' && isMeaningfulText(el.content)) {
        texts.push({
          content: cleanTextContent(el.content),
          role: el.role,
          fontSize: el.fontSize
        });
      }
      if (el.type === 'image' && el.assetId !== -1) {
        images.push({
          assetId: el.assetId,
          originalPath: el.originalPath,
          altText: el.altText,
          role: el.instructionalRole || 'content'
        });
      }
      if (el.type === 'video') {
        videos.push({
          assetId: el.assetId,
          originalPath: el.originalPath,
          durationMs: el.durationMs
        });
      }
      if (el.type === 'interaction') {
        interactions.push({
          type: el.interactionType,
          label: el.label,
          children: el.children || []
        });
      }
    });

    var layerTriggers = (layer.triggers || []).map(function (t) {
      return {
        id: t.id,
        event: t.event,
        actions: t.actions,
        conditions: t.conditions
      };
    });

    // Improve generic layer names using content
    var layerName = layer.name;
    if (/^Layer\s*\d*$/i.test(layerName) && texts.length > 0) {
      // Prefer a unique, descriptive text (long enough to be meaningful, not too long)
      var nameCandidate = texts.find(function (t) {
        return t.content.length > 20 && t.content.length < 80;
      });
      if (!nameCandidate) {
        nameCandidate = texts.find(function (t) { return t.content.length > 3; });
      }
      if (nameCandidate) {
        layerName = nameCandidate.content.substring(0, 60) + (nameCandidate.content.length > 60 ? '...' : '');
      } else {
        layerName = texts[0].content.substring(0, 50) + (texts[0].content.length > 50 ? '...' : '');
      }
    }

    return {
      id: layer.id,
      name: layerName,
      texts: texts,
      images: images,
      videos: videos,
      audio: audio,
      interactions: interactions,
      triggers: layerTriggers,
      hasContent: texts.length > 0 || images.length > 0 || videos.length > 0 || interactions.length > 0
    };
  }

  // ---- Presentation classification ----

  /**
   * Decide how a planned slide should be presented in the deep-scroll layout.
   * Options:
   *   - hero: full-viewport title slide with gradient/image background
   *   - narrative: text-heavy content with optional images (flowing paragraphs)
   *   - media-feature: large image or video as the focal point
   *   - interactive: layers with accordion/modal/bento interactions
   *   - card-grid: multiple short content blocks in a grid
   *   - form: input fields
   *   - quiz: quiz questions
   *   - branching: path selection
   *   - results: score display
   */
  function classifyPresentation(plan) {
    if (plan.type === 'title') return 'hero';
    if (plan.type === 'results') return 'results';
    if (plan.type === 'branching') return 'branching';
    if (plan.type === 'form' || plan.formFields.length > 0) return 'form';
    if (plan.quizData) return 'quiz';

    var hasLayers = plan.layers.length > 0;
    var hasVideo = plan.content.videos.length > 0;
    var hasHeroImage = plan.content.images.some(function (img) { return img.role === 'hero'; });
    var textLength = plan.content.bodyTexts.join(' ').length;

    // Lots of layers → interactive section
    if (hasLayers && plan.layers.length >= 2) {
      // Classify the interaction type
      var layerHasImages = plan.layers.some(function (l) { return l.images.length > 0; });
      var avgTextLen = plan.layers.reduce(function (sum, l) {
        return sum + l.texts.reduce(function (s, t) { return s + t.content.length; }, 0);
      }, 0) / plan.layers.length;

      if (plan.layers.length >= 3 && avgTextLen < 200) {
        plan.interactionType = 'bento';
      } else if (layerHasImages) {
        plan.interactionType = 'modal';
      } else {
        plan.interactionType = 'accordion';
      }
      return 'interactive';
    }

    // Video or large image focal point
    if (hasVideo) return 'media-feature';
    if (hasHeroImage && textLength < 200) return 'media-feature';

    // Text-heavy → narrative flow
    if (textLength > 100) return 'narrative';

    return 'standard';
  }

  // ---- Text cleaning ----

  function cleanTextContent(text) {
    return text
      .replace(/\r\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/%_player\.\w+%/g, '')
      .trim();
  }

  function cleanButtonLabel(label) {
    return (label || '')
      .replace(/\r\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---- Verification report ----

  /**
   * Build a report showing what content was found, kept, and dropped.
   */
  function buildVerification(courseIR, sections) {
    var extracted = {
      totalSlides: courseIR.slides.length,
      totalElements: 0,
      totalTexts: 0,
      totalImages: 0,
      totalVideos: 0,
      totalAudio: 0,
      totalLayers: 0,
      totalTriggers: 0,
      totalInteractions: 0,
      totalStates: 0,
      totalVariables: courseIR.variables ? courseIR.variables.length : 0
    };

    courseIR.slides.forEach(function (slide) {
      extracted.totalLayers += slide.layers.length;
      extracted.totalTriggers += slide.triggers.length;
      slide.layers.forEach(function (l) {
        extracted.totalTriggers += l.triggers.length;
      });
      slide.elements.forEach(function (el) {
        extracted.totalElements++;
        if (el.type === 'text') extracted.totalTexts++;
        if (el.type === 'image') extracted.totalImages++;
        if (el.type === 'video') extracted.totalVideos++;
        if (el.type === 'audio') extracted.totalAudio++;
        if (el.type === 'interaction') extracted.totalInteractions++;
        if (el.states && el.states.length > 0) extracted.totalStates += el.states.length;
      });
    });

    var planned = {
      totalSections: sections.length,
      totalSlides: 0,
      textsKept: 0,
      textsDropped: 0,
      imagesKept: 0,
      videosKept: 0,
      audioKept: 0,
      layersKept: 0,
      triggersKept: 0,
      interactionsKept: 0,
      statesKept: 0
    };

    sections.forEach(function (section) {
      section.slides.forEach(function (slide) {
        planned.totalSlides++;
        planned.textsKept += slide.content.headings.length + slide.content.bodyTexts.length + slide.content.callouts.length;
        planned.imagesKept += slide.content.images.length;
        planned.videosKept += slide.content.videos.length;
        planned.audioKept += slide.content.audio.length;
        planned.layersKept += slide.layers.length;
        planned.triggersKept += slide.triggers.length;
        planned.interactionsKept += slide.interactions.length;
        planned.statesKept += slide.states.length;
        slide.layers.forEach(function (l) {
          planned.triggersKept += l.triggers.length;
        });
      });
    });

    planned.textsDropped = extracted.totalTexts - planned.textsKept;

    return {
      extracted: extracted,
      planned: planned,
      contentRetention: extracted.totalElements > 0
        ? Math.round((planned.textsKept + planned.imagesKept + planned.videosKept) /
            Math.max(1, extracted.totalTexts + extracted.totalImages + extracted.totalVideos) * 100)
        : 100
    };
  }

  // ---- Main entry point ----

  /**
   * Create a CoursePlan from a CourseIR.
   * @param {object} courseIR - The raw extracted course data
   * @param {Function} log - Logging callback
   * @returns {object} CoursePlan
   */
  function planCourse(courseIR, log) {
    log('Planning course structure...');

    var sections = groupIntoSections(courseIR.slides, courseIR.navigation);
    log('Identified ' + sections.length + ' sections from ' + courseIR.slides.length + ' slides');

    // Log section breakdown
    sections.forEach(function (section) {
      log('  ' + section.type.toUpperCase() + ': "' + section.title + '" (' + section.slides.length + ' slides)');
    });

    var verification = buildVerification(courseIR, sections);
    log('Content retention: ' + verification.contentRetention + '% of meaningful content preserved');
    if (verification.planned.textsDropped > 0) {
      log('  Dropped ' + verification.planned.textsDropped + ' junk/decorative text elements');
    }

    return {
      meta: courseIR.meta,
      sections: sections,
      quizBanks: courseIR.questionBanks,
      navigation: courseIR.navigation,
      variables: courseIR.variables,
      assets: courseIR.assets,
      verification: verification
    };
  }

  return { planCourse: planCourse };
})();
