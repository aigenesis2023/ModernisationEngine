/**
 * adapt-translator.js — Converts CoursePlan to Adapt Framework JSON
 *
 * Takes the output of ContentPlanner.planCourse() and generates
 * the 5 JSON files Adapt needs: course.json, contentObjects.json,
 * articles.json, blocks.json, components.json
 *
 * Uses a central ID Manager to ensure all parent-child relationships
 * are bulletproof. One broken ID reference = broken course.
 */
window.AdaptTranslator = (function () {

  // ---- ID Manager ----
  // Central authority for all IDs. Guarantees unique IDs and valid parent refs.
  function createIdManager() {
    var counters = { co: 0, a: 0, b: 0, c: 0 };
    var trackingId = 0;
    var registry = {}; // id -> { type, parentId }

    return {
      nextPage: function () {
        counters.co++;
        var id = 'co-' + (counters.co * 100);
        registry[id] = { type: 'contentObject', parentId: 'course' };
        return id;
      },
      nextArticle: function (parentPageId) {
        if (!registry[parentPageId]) throw new Error('Invalid parent page: ' + parentPageId);
        counters.a++;
        var id = 'a-' + (counters.a * 100);
        registry[id] = { type: 'article', parentId: parentPageId };
        return id;
      },
      nextBlock: function (parentArticleId) {
        if (!registry[parentArticleId]) throw new Error('Invalid parent article: ' + parentArticleId);
        counters.b++;
        var id = 'b-' + (counters.b * 100);
        registry[id] = { type: 'block', parentId: parentArticleId };
        return id;
      },
      nextComponent: function (parentBlockId) {
        if (!registry[parentBlockId]) throw new Error('Invalid parent block: ' + parentBlockId);
        counters.c++;
        var id = 'c-' + (counters.c * 100);
        registry[id] = { type: 'component', parentId: parentBlockId };
        return id;
      },
      nextTrackingId: function () {
        return trackingId++;
      },
      validate: function () {
        // Verify every child's parent exists
        var errors = [];
        for (var id in registry) {
          var entry = registry[id];
          if (entry.parentId !== 'course' && !registry[entry.parentId]) {
            errors.push(id + ' references missing parent ' + entry.parentId);
          }
        }
        return errors;
      }
    };
  }

  // ---- Helper: escape HTML for Adapt body fields ----
  function escHtml(str) {
    if (!str) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- Helper: extract string from text (may be string, {content:string}, or {text:string}) ----
  function textVal(t) {
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (typeof t === 'object') {
      if (t.content) return String(t.content);
      if (t.text) return String(t.text);
    }
    return String(t);
  }

  // ---- Helper: convert text array to HTML body ----
  function textsToBody(texts) {
    if (!texts || texts.length === 0) return '';
    return texts.map(function (t) {
      return '<p>' + escHtml(textVal(t)) + '</p>';
    }).join('');
  }

  // ---- Helper: extract image path from image data (may be string or object) ----
  function getImageSrc(imgData) {
    if (!imgData) return '';
    if (typeof imgData === 'string') return imgData;
    return imgData.originalPath || imgData.src || imgData.path || '';
  }

  function getImageAlt(imgData) {
    if (!imgData) return '';
    if (typeof imgData === 'string') return '';
    return imgData.altText || imgData.alt || '';
  }

  function getImageRole(imgData) {
    if (!imgData || typeof imgData === 'string') return 'content';
    return imgData.role || 'content';
  }

  // ---- Helper: build image path for Adapt ----
  function adaptImagePath(imgDataOrPath) {
    var rawPath = typeof imgDataOrPath === 'string' ? imgDataOrPath : getImageSrc(imgDataOrPath);
    if (!rawPath) return '';
    // Adapt expects images in course/en/images/
    var filename = rawPath.split('/').pop();
    return 'course/en/images/' + filename;
  }

  // ---- Helper: build media path for Adapt ----
  function adaptMediaPath(originalPath) {
    if (!originalPath) return '';
    var filename = originalPath.split('/').pop();
    return 'course/en/video/' + filename;
  }

  // ---- Generate course.json ----
  function generateCourse(coursePlan, brandProfile) {
    var title = coursePlan.meta.title || 'Untitled Course';
    var mastery = coursePlan.meta.masteryScore || 80;

    return {
      _id: 'course',
      _type: 'course',
      _classes: '',
      _htmlClasses: '',
      title: title,
      displayTitle: title,
      description: '',
      body: '',
      instruction: '',
      _buttons: {
        _submit: { buttonText: 'Submit', ariaLabel: 'Submit' },
        _reset: { buttonText: 'Reset', ariaLabel: 'Reset' },
        _showCorrectAnswer: { buttonText: 'Show correct answer', ariaLabel: 'Show correct answer' },
        _hideCorrectAnswer: { buttonText: 'Show your answer', ariaLabel: 'Show your answer' },
        _showFeedback: { buttonText: 'Show feedback', ariaLabel: 'Show feedback' },
        _remainingAttemptsText: 'remaining attempts',
        _remainingAttemptText: 'final attempt'
      },
      _globals: {
        _accessibility: {
          accessibilityToggleTextOn: 'Turn accessibility on?',
          accessibilityToggleTextOff: 'Turn accessibility off?',
          _accessibilityInstructions: {
            touch: 'Usage instructions. Use swipe left for next. Use swipe right for previous. Use a double tap to select. Use a two finger drag to scroll the page.',
            notouch: 'Usage instructions. Use tab for next. Use shift tab for previous. Use enter to select. Use escape to go back.',
            ipad: 'Usage instructions for touchscreens. Use swipe left for next. Use swipe right for previous. Use a double tap to select. Use a two finger drag to scroll the page.'
          },
          skipNavigationText: 'Skip Navigation'
        }
      },
      _latestTrackingId: 0, // Will be updated after all components are generated
      _start: {
        _isEnabled: false,
        _startIds: [],
        _force: false,
        _isMenuDisabled: false
      },
      _boxMenu: {
        _backgroundImage: { _large: '', _medium: '', _small: '' },
        _backgroundStyles: { _backgroundRepeat: '', _backgroundSize: '', _backgroundPosition: '' },
        _menuHeader: { _backgroundImage: { _large: '', _medium: '', _small: '' }, _backgroundStyles: {}, _minimumHeights: { _large: 0, _medium: 0, _small: 0 } }
      },
      _pageLevelProgress: {
        _isEnabled: true,
        _showPageCompletion: true
      },
      _spoor: {
        _isEnabled: true,
        _tracking: {
          _shouldStoreResponses: true,
          _shouldStoreAttempts: false,
          _shouldRecordInteractions: true,
          _shouldCompress: true
        },
        _reporting: {
          _onTrackingCriteria: 'completed',
          _onAssessmentFailure: 'incomplete',
          _resetStatusOnLanguageChange: false
        },
        _advancedSettings: {
          _showDebugWindow: false,
          _commitOnStatusChange: true,
          _commitOnAnyChange: false,
          _timedCommit: true,
          _timedCommitFrequency: 30000,
          _maxCommitRetries: 5
        }
      }
    };
  }

  // ---- Generate contentObjects.json (single page for deep-scroll) ----
  function generateContentObjects(coursePlan, idManager) {
    var pageId = idManager.nextPage();
    var title = coursePlan.meta.title || 'Course';

    return {
      pageId: pageId,
      data: [{
        _id: pageId,
        _parentId: 'course',
        _type: 'page',
        _classes: '',
        _htmlClasses: '',
        title: title,
        displayTitle: title,
        body: '',
        pageBody: '',
        instruction: 'Scroll down to explore the course content.',
        _graphic: { src: '', alt: '' },
        linkText: 'View',
        duration: '',
        _pageLevelProgress: {
          _isEnabled: true,
          _showPageCompletion: true,
          _excludeAssessments: false,
          _isCompletionIndicatorEnabled: false
        }
      }]
    };
  }

  // ---- Map section type to Adapt article classes ----
  function sectionClasses(sectionType) {
    var map = {
      hero: 'section-hero',
      content: 'section-content',
      form: 'section-form',
      branching: 'section-branching',
      assessment: 'section-assessment',
      results: 'section-results',
      glossary: 'section-glossary'
    };
    return map[sectionType] || '';
  }

  // ---- Build components for a slide ----
  function buildSlideComponents(slide, section, blockId, idManager, sectionImageTracker) {
    var components = [];
    var presentation = slide.presentation || 'narrative';

    // Filter images: use content/hero images freely, allow ONE background per section
    var allImages = (slide.content && slide.content.images) || [];
    var contentImages = allImages.filter(function (img) {
      var role = getImageRole(img);
      // Skip very small images (icons/decorative under 80px)
      var w = img.width || img.originalWidth || 0;
      var h = img.height || img.originalHeight || 0;
      if (w > 0 && h > 0 && w < 80 && h < 80) return false;
      // Skip logo images
      if (role === 'logo') return false;
      // Content and hero images: always include
      if (role === 'content' || role === 'hero') return true;
      // Background images: allow the first unique one per section as a banner
      if (role === 'background') {
        var src = getImageSrc(img);
        var filename = src ? src.split('/').pop() : '';
        if (filename && !sectionImageTracker['bg_' + filename]) {
          sectionImageTracker['bg_' + filename] = true;
          return true;
        }
        return false; // Skip duplicate backgrounds
      }
      return true;
    });

    // Deduplicate: skip if this exact image was already used in this section
    contentImages = contentImages.filter(function (img) {
      var src = getImageSrc(img);
      if (!src) return false;
      var filename = src.split('/').pop();
      if (sectionImageTracker[filename]) return false;
      sectionImageTracker[filename] = true;
      return true;
    });

    var hasImage = contentImages.length > 0;
    var hasVideo = slide.content && (slide.content.videos || []).length > 0;
    var headings = ((slide.content && slide.content.headings) || []).map(textVal);
    var bodyTexts = ((slide.content && slide.content.bodyTexts) || []).map(textVal);
    var callouts = ((slide.content && slide.content.callouts) || []).map(textVal);
    var allTexts = bodyTexts.concat(callouts);

    // Fix ALL CAPS headings — title-case them
    headings = headings.map(function (h) {
      if (h && h === h.toUpperCase() && h.length > 4) {
        return h.charAt(0) + h.slice(1).toLowerCase();
      }
      return h;
    });

    // Determine component type based on presentation and content
    if (presentation === 'hero' || section.type === 'hero') {
      // Hero: full-viewport splash with animated title and optional background image
      var compId = idManager.nextComponent(blockId);
      var heroGraphic = contentImages.length > 0 ? {
        alt: getImageAlt(contentImages[0]) || '',
        large: adaptImagePath(contentImages[0]),
        small: adaptImagePath(contentImages[0])
      } : null;
      components.push({
        _id: compId,
        _parentId: blockId,
        _type: 'component',
        _component: 'hero',
        _classes: '',
        _layout: 'full',
        title: slide.originalTitle || section.title || '',
        displayTitle: headings[0] || slide.originalTitle || section.title || '',
        body: textsToBody(allTexts),
        instruction: '',
        _graphic: heroGraphic
      });
    } else if (presentation === 'media-feature' || hasVideo) {
      // Video: media component
      var videoSrc = slide.content.videos[0];
      var compId = idManager.nextComponent(blockId);
      components.push({
        _id: compId,
        _parentId: blockId,
        _type: 'component',
        _component: 'media',
        _classes: '',
        _layout: 'full',
        title: headings[0] || 'Video',
        displayTitle: headings[0] || '',
        body: textsToBody(allTexts),
        instruction: '',
        _media: {
          mp4: adaptMediaPath(typeof videoSrc === 'string' ? videoSrc : videoSrc.src || ''),
          poster: ''
        },
        _setCompletionOn: 'play',
        _allowFullScreen: true,
        _playsinline: false,
        _pauseWhenOffScreen: true,
        _showVolumeControl: true,
        _startVolume: '80%',
        _preventForwardScrubbing: false
      });
    } else if (presentation === 'interactive' && slide.layers && slide.layers.length > 0) {
      // Layers → accordion OR narrative component depending on content
      var layerItems = slide.layers.map(function (layer) {
        var layerTexts = (layer.texts || []).map(textVal);
        var layerTitle = layer.name || layerTexts[0] || 'Details';
        var layerBody = layerTexts.length > 1 ? textsToBody(layerTexts.slice(1)) :
          (layerTexts.length === 1 ? textsToBody(layerTexts) : '');
        var layerGraphic = null;

        // Include layer images
        if (layer.images && layer.images.length > 0) {
          var layerImg = layer.images[0];
          var layerImgSrc = typeof layerImg === 'string' ? layerImg : (layerImg.src || layerImg.originalPath || '');
          layerGraphic = {
            src: adaptImagePath(layerImgSrc),
            large: adaptImagePath(layerImgSrc),
            alt: (typeof layerImg === 'object' ? layerImg.alt : '') || ''
          };
          // Also embed in body for accordion fallback
          if (!layerGraphic.src) layerGraphic = null;
          else {
            layerBody += '<p><img src="' + adaptImagePath(layerImgSrc) +
              '" alt="' + escHtml(layerGraphic.alt) + '" style="max-width:100%"></p>';
          }
        }

        return {
          title: layerTitle,
          body: layerBody || '<p>' + escHtml(layerTitle) + '</p>',
          _graphic: layerGraphic
        };
      });

      // Filter out empty/duplicate items
      layerItems = layerItems.filter(function (item) {
        return item.body && item.body.length > 10;
      });

      if (layerItems.length > 0) {
        // Decide: if most layers have images → use narrative (carousel), else accordion
        var layersWithImages = layerItems.filter(function(item) { return item._graphic; }).length;
        var useNarrative = layersWithImages > layerItems.length / 2 && layerItems.length >= 2;

        var compId = idManager.nextComponent(blockId);
        if (useNarrative) {
          components.push({
            _id: compId,
            _parentId: blockId,
            _type: 'component',
            _component: 'narrative',
            _classes: '',
            _layout: 'full',
            title: headings[0] || slide.originalTitle || '',
            displayTitle: headings[0] || '',
            body: textsToBody(allTexts.slice(0, 1)),
            instruction: 'Use the arrows to explore each item.',
            _setCompletionOn: 'allItems',
            _items: layerItems
          });
        } else {
          components.push({
            _id: compId,
            _parentId: blockId,
            _type: 'component',
            _component: 'accordion',
            _classes: '',
            _layout: 'full',
            title: headings[0] || slide.originalTitle || '',
            displayTitle: headings[0] || '',
            body: textsToBody(allTexts.slice(0, 1)),
            instruction: layerItems.length > 1 ? 'Select each heading to learn more.' : '',
            _setCompletionOn: 'allItems',
            _shouldCollapseItems: true,
            _shouldExpandFirstItem: false,
            _items: layerItems
          });
        }
      }
    } else if (presentation === 'form' && slide.formFields && slide.formFields.length > 0) {
      // Form fields → single textInput component with all fields as items
      var formItems = slide.formFields.map(function (field) {
        return {
          prefix: field.label || '',
          _answers: [''],
          placeholder: field.label || 'Enter your response'
        };
      });
      var formTitle = headings[0] || slide.originalTitle || '';
      var formBody = allTexts.length > 0 ? textsToBody(allTexts) : '';
      var compId = idManager.nextComponent(blockId);
      components.push({
        _id: compId,
        _parentId: blockId,
        _type: 'component',
        _component: 'textinput',
        _classes: '',
        _layout: 'full',
        title: formTitle,
        displayTitle: formTitle,
        body: formBody || '<p>Please complete the fields below.</p>',
        instruction: '',
        _items: formItems,
        _attempts: 1,
        _canShowFeedback: false,
        _canShowMarking: false,
        _canShowModelAnswer: false,
        _shouldDisplayAttempts: false,
        _recordInteraction: false
      });
    } else if (presentation === 'quiz' && slide.quizData) {
      // Quiz question → MCQ component
      var q = slide.quizData;
      var compId = idManager.nextComponent(blockId);
      var items = (q.choices || []).map(function (choice) {
        return {
          text: choice.text || '',
          _shouldBeSelected: choice.correct || false,
          _isPartlyCorrect: false,
          feedback: ''
        };
      });

      components.push({
        _id: compId,
        _parentId: blockId,
        _type: 'component',
        _component: 'mcq',
        _classes: '',
        _layout: 'full',
        title: q.questionText || 'Question',
        displayTitle: '',
        body: '<p>' + escHtml(q.questionText || '') + '</p>',
        instruction: 'Choose your answer then submit.',
        ariaQuestion: q.questionText || '',
        _items: items,
        _attempts: 1,
        _selectable: q.questionType === 'pick-many' ? items.filter(function (i) { return i._shouldBeSelected; }).length : 1,
        _isRandom: false,
        _canShowFeedback: true,
        _canShowMarking: true,
        _canShowModelAnswer: true,
        _canShowCorrectness: true,
        _shouldDisplayAttempts: false,
        _questionWeight: 1,
        _recordInteraction: true,
        _hasItemScoring: false,
        _feedback: {
          title: '',
          correct: q.correctFeedback || 'Correct!',
          _incorrect: {
            notFinal: q.incorrectFeedback || 'That\'s not quite right.',
            final: q.incorrectFeedback || 'That\'s not quite right.'
          }
        }
      });
    } else if (presentation === 'branching' && slide.interactions) {
      // Branching options → BranchingCards component with interactive selection
      var optionTexts = slide.interactions.filter(function (i) {
        return i.type === 'button' || i.type === 'option';
      }).map(function (i) { return textVal(i.label || i.text || ''); }).filter(Boolean);

      // Build body with options as list items for BranchingCards to parse
      var bodyHtml = '';
      if (allTexts.length > 0) {
        bodyHtml += textsToBody(allTexts);
      }
      if (optionTexts.length > 0) {
        bodyHtml += '<ul>';
        optionTexts.forEach(function (opt) {
          bodyHtml += '<li>' + escHtml(opt) + '</li>';
        });
        bodyHtml += '</ul>';
      }

      var compId = idManager.nextComponent(blockId);
      components.push({
        _id: compId,
        _parentId: blockId,
        _type: 'component',
        _component: 'branching',
        _classes: '',
        _layout: 'full',
        title: headings[0] || slide.originalTitle || '',
        displayTitle: headings[0] || '',
        body: bodyHtml,
        instruction: ''
      });
    } else if (hasImage && allTexts.length > 0) {
      // Text + image → GraphicText split component (single component, not two)
      var contentImg = contentImages[0];
      var imgSrc = getImageSrc(contentImg);
      var imgAlt = getImageAlt(contentImg);

      var compId = idManager.nextComponent(blockId);
      components.push({
        _id: compId,
        _parentId: blockId,
        _type: 'component',
        _component: 'graphic-text',
        _classes: '',
        _layout: 'full',
        title: headings[0] || '',
        displayTitle: headings[0] || '',
        body: textsToBody(allTexts),
        instruction: '',
        _graphic: {
          alt: imgAlt,
          large: adaptImagePath(imgSrc),
          small: adaptImagePath(imgSrc)
        }
      });
    } else {
      // Default: text component
      var displayTitle = headings[0] || '';
      var body = textsToBody(headings.length > 1 ? headings.slice(1).concat(allTexts) : allTexts);

      // If there's an image but no text, use graphic component
      if (hasImage && allTexts.length === 0) {
        var imgData = contentImages[0];
        var imgSrc = getImageSrc(imgData);
        var compId = idManager.nextComponent(blockId);
        components.push({
          _id: compId,
          _parentId: blockId,
          _type: 'component',
          _component: 'graphic',
          _classes: '',
          _layout: 'full',
          title: displayTitle,
          displayTitle: displayTitle,
          body: '',
          instruction: '',
          _graphic: {
            alt: '',
            large: adaptImagePath(imgSrc),
            small: adaptImagePath(imgSrc)
          }
        });
      } else if (body || displayTitle) {
        var compId = idManager.nextComponent(blockId);
        components.push({
          _id: compId,
          _parentId: blockId,
          _type: 'component',
          _component: 'text',
          _classes: '',
          _layout: 'full',
          title: displayTitle,
          displayTitle: displayTitle,
          body: body,
          instruction: ''
        });
      }
    }

    // Filter out empty components (no content = no value to the learner)
    return components.filter(function (comp) {
      var hasBody = comp.body && comp.body.replace(/<[^>]*>/g, '').trim().length > 0;
      var hasTitle = comp.displayTitle && comp.displayTitle.trim().length > 0;
      var hasItems = comp._items && comp._items.length > 0;
      var hasGraphic = comp._graphic && (comp._graphic.large || comp._graphic.src);
      var hasMedia = comp._media && (comp._media.mp4 || comp._media.source);
      return hasBody || hasTitle || hasItems || hasGraphic || hasMedia;
    });
  }

  // ---- Main translation function ----
  function translate(coursePlan, brandProfile, log) {
    log = log || function () { };
    var idManager = createIdManager();

    log('Generating Adapt JSON...');

    // 1. course.json
    var courseJson = generateCourse(coursePlan, brandProfile);

    // 2. contentObjects.json (single page for deep-scroll)
    var contentResult = generateContentObjects(coursePlan, idManager);
    var pageId = contentResult.pageId;
    var contentObjectsJson = contentResult.data;

    // 3-5. articles, blocks, components
    var articlesJson = [];
    var blocksJson = [];
    var componentsJson = [];

    var sections = coursePlan.sections || [];
    log('Processing ' + sections.length + ' sections...');

    sections.forEach(function (section, sectionIndex) {
      // Skip message/prompt scenes
      if (section.type === 'system') return;

      // Create article for this section
      var articleId = idManager.nextArticle(pageId);
      var articleTitle = section.title || 'Section ' + (sectionIndex + 1);

      // Hero sections don't need a section header (the HeroSplash handles it)
      var showSectionTitle = section.type !== 'hero';

      articlesJson.push({
        _id: articleId,
        _parentId: pageId,
        _type: 'article',
        _classes: sectionClasses(section.type),
        title: articleTitle,
        displayTitle: showSectionTitle ? articleTitle : '',
        body: '',
        instruction: ''
      });

      // Process slides within section
      var slides = section.slides || [];
      var sectionHasContent = false;
      var sectionImageTracker = {}; // Track images used in this section to deduplicate

      slides.forEach(function (slide, slideIndex) {
        // Create block for this slide
        var blockId = idManager.nextBlock(articleId);
        var trackingId = idManager.nextTrackingId();

        // Build components first, then only add block if there are components
        var comps = buildSlideComponents(slide, section, blockId, idManager, sectionImageTracker);

        if (comps.length > 0) {
          sectionHasContent = true;
          blocksJson.push({
            _id: blockId,
            _parentId: articleId,
            _type: 'block',
            _classes: '',
            title: textVal(slide.originalTitle) || '',
            displayTitle: '',
            body: '',
            instruction: '',
            _trackingId: trackingId,
            _onScreen: {
              _isEnabled: true,
              _classes: 'fade-in-bottom',
              _percentInviewVertical: 50
            }
          });
          componentsJson = componentsJson.concat(comps);
        }
      });

      // Remove article if no blocks were generated (empty section)
      if (!sectionHasContent) {
        articlesJson.pop();
      }
    });

    // Update the latest tracking ID in course.json
    courseJson._latestTrackingId = idManager.nextTrackingId();

    // Validate ID integrity
    var validationErrors = idManager.validate();
    if (validationErrors.length > 0) {
      log('WARNING: ID validation errors:');
      validationErrors.forEach(function (e) { log('  ' + e); });
    } else {
      log('ID validation: all ' + componentsJson.length + ' components have valid parent references');
    }

    log('Generated: ' + contentObjectsJson.length + ' page, ' +
      articlesJson.length + ' articles, ' +
      blocksJson.length + ' blocks, ' +
      componentsJson.length + ' components');

    return {
      course: courseJson,
      contentObjects: contentObjectsJson,
      articles: articlesJson,
      blocks: blocksJson,
      components: componentsJson
    };
  }

  // ---- Generate brand CSS overrides ----
  // Creates a CSS string that overrides Adapt's compiled theme colors
  // with the brand profile from the URL scraper. This avoids recompiling
  // the LESS — we just layer CSS on top.
  function generateBrandCSS(brandProfile) {
    if (!brandProfile || !brandProfile.colors) return '';

    var c = brandProfile.colors;
    var t = brandProfile.typography || {};
    var s = brandProfile.style || {};
    var primary = c.primary || '#117F93';
    var secondary = c.secondary || '#263944';
    var accent = c.accent || primary;
    var background = c.background || '#ffffff';
    var surface = c.surface || '#f9f9f9';
    var text = c.text || '#4D4D4D';
    var textMuted = c.textMuted || '#666666';
    var success = c.success || '#065f28';
    var error = c.error || '#ff0000';
    var gradient = c.gradient || '';

    var headingFont = t.headingFont || '';
    var bodyFont = t.bodyFont || '';
    var fontImport = t.fontImportUrl || '';

    var borderRadius = s.borderRadius || '12px';
    var isDark = s.mood === 'dark' || s.mood === 'bold';

    var css = '/* Brand CSS Overrides — generated by Modernisation Engine */\n';

    // Font import
    if (fontImport) {
      css += '@import url("' + fontImport + '");\n\n';
    }

    // Root overrides
    css += ':root {\n';
    css += '  --brand-primary: ' + primary + ';\n';
    css += '  --brand-secondary: ' + secondary + ';\n';
    css += '  --brand-accent: ' + accent + ';\n';
    css += '  --brand-bg: ' + background + ';\n';
    css += '  --brand-surface: ' + surface + ';\n';
    css += '  --brand-text: ' + text + ';\n';
    css += '  --brand-success: ' + success + ';\n';
    css += '  --brand-error: ' + error + ';\n';
    css += '}\n\n';

    // Body background
    css += 'body { background-color: ' + background + '; color: ' + text + '; }\n';
    if (bodyFont) {
      css += 'body, .component__body, .page__body, .block__body { font-family: "' + bodyFont + '", sans-serif; }\n';
    }

    // Headings
    css += '.page__title, .article__title, .component__title, .menu__title {\n';
    css += '  color: ' + primary + ';\n';
    if (headingFont) css += '  font-family: "' + headingFont + '", sans-serif;\n';
    css += '}\n\n';

    // Accordion & interactive items
    css += '.accordion__item-btn, .narrative__controls, .hotgraphic__pin {\n';
    css += '  background-color: ' + primary + ';\n';
    css += '  color: #fff;\n';
    css += '}\n';
    css += '.accordion__item-btn:hover, .accordion__item-btn:focus {\n';
    css += '  background-color: ' + secondary + ';\n';
    css += '}\n\n';

    // Buttons
    css += '.btn__action, .btn__feedback {\n';
    css += '  background-color: ' + primary + ';\n';
    css += '  color: #fff;\n';
    css += '  border-radius: ' + borderRadius + ';\n';
    css += '}\n';
    css += '.btn__action:hover, .btn__feedback:hover {\n';
    css += '  background-color: ' + secondary + ';\n';
    css += '}\n\n';

    // MCQ choices
    css += '.mcq__item.is-selected .mcq__item__icon {\n';
    css += '  background-color: ' + primary + ';\n';
    css += '  border-color: ' + primary + ';\n';
    css += '}\n\n';

    // Navigation bar
    css += '.nav { background-color: ' + (isDark ? secondary : surface) + '; }\n';
    css += '.nav__btn { color: ' + (isDark ? '#fff' : text) + '; }\n\n';

    // Page level progress
    css += '.pagelevelprogress__indicator-bar { background-color: ' + primary + '; }\n';

    // Validation
    css += '.is-correct { background-color: ' + success + '; color: #fff; }\n';
    css += '.is-incorrect { background-color: ' + error + '; color: #fff; }\n\n';

    // Dark theme overrides
    if (isDark) {
      css += '/* Dark theme */\n';
      css += 'body { background-color: ' + background + '; color: ' + (c.text || '#f0f0f0') + '; }\n';
      css += '.page { background-color: ' + background + '; }\n';
      css += '.block { background-color: ' + (surface || '#1a1a2e') + '; }\n';
      css += '.component__body, .page__body { color: ' + (c.text || '#f0f0f0') + '; }\n';
      css += '.accordion__item-title-btn-text { color: #fff; }\n';
      css += '.menu { background-color: ' + background + '; }\n';
      css += '.menu-item { background-color: ' + (surface || '#1a1a2e') + '; }\n';
      css += '.menu-item__title, .menu__title { color: ' + primary + '; }\n';
      css += '.menu-item__body { color: ' + (c.text || '#f0f0f0') + '; }\n';
    }

    // Gradient if available
    if (gradient) {
      css += '/* Brand gradient */\n';
      css += '.page__header { background: ' + gradient + '; }\n';
    }

    return css;
  }

  // ---- Public API ----
  return {
    translate: translate,
    generateBrandCSS: generateBrandCSS
  };
})();
