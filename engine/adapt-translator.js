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

  // ---- Helper: build image path for Adapt ----
  function adaptImagePath(originalPath) {
    if (!originalPath) return '';
    // Adapt expects images in course/en/images/
    var filename = originalPath.split('/').pop();
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
  function buildSlideComponents(slide, section, blockId, idManager) {
    var components = [];
    var presentation = slide.presentation || 'narrative';
    var hasImage = slide.content && (slide.content.images.length > 0);
    var hasVideo = slide.content && (slide.content.videos.length > 0);
    var headings = ((slide.content && slide.content.headings) || []).map(textVal);
    var bodyTexts = ((slide.content && slide.content.bodyTexts) || []).map(textVal);
    var callouts = ((slide.content && slide.content.callouts) || []).map(textVal);
    var allTexts = bodyTexts.concat(callouts);

    // Determine component type based on presentation and content
    if (presentation === 'hero' || section.type === 'hero') {
      // Hero: text component with title
      var compId = idManager.nextComponent(blockId);
      components.push({
        _id: compId,
        _parentId: blockId,
        _type: 'component',
        _component: 'text',
        _classes: 'hero-text',
        _layout: 'full',
        title: slide.originalTitle || section.title || '',
        displayTitle: headings[0] || slide.originalTitle || section.title || '',
        body: textsToBody(allTexts),
        instruction: ''
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
      // Layers → accordion component
      var items = slide.layers.map(function (layer) {
        var layerTexts = (layer.texts || []).map(textVal);
        var layerTitle = layer.name || layerTexts[0] || 'Details';
        var layerBody = layerTexts.length > 1 ? textsToBody(layerTexts.slice(1)) :
          (layerTexts.length === 1 ? textsToBody(layerTexts) : '');

        // Include layer images if any
        if (layer.images && layer.images.length > 0) {
          layerBody += '<p><img src="' + adaptImagePath(layer.images[0].src || layer.images[0]) +
            '" alt="' + escHtml(layer.images[0].alt || '') + '" style="max-width:100%"></p>';
        }

        return {
          title: layerTitle,
          body: layerBody || '<p>' + escHtml(layerTitle) + '</p>'
        };
      });

      // Filter out empty/duplicate items
      items = items.filter(function (item) {
        return item.body && item.body.length > 10;
      });

      if (items.length > 0) {
        var compId = idManager.nextComponent(blockId);
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
          instruction: items.length > 1 ? 'Select each heading to learn more.' : '',
          _setCompletionOn: 'allItems',
          _shouldCollapseItems: true,
          _shouldExpandFirstItem: false,
          _items: items
        });
      }
    } else if (presentation === 'form' && slide.formFields && slide.formFields.length > 0) {
      // Form fields → textInput components
      slide.formFields.forEach(function (field) {
        var compId = idManager.nextComponent(blockId);
        components.push({
          _id: compId,
          _parentId: blockId,
          _type: 'component',
          _component: 'textinput',
          _classes: '',
          _layout: 'full',
          title: field.label || 'Input',
          displayTitle: '',
          body: '<p>' + escHtml(field.label || 'Please enter your response') + '</p>',
          instruction: '',
          ariaQuestion: field.label || '',
          _items: [{ prefix: '', _answers: [''], placeholder: field.label || '' }],
          _attempts: 1,
          _canShowFeedback: false,
          _canShowMarking: false,
          _canShowModelAnswer: false,
          _shouldDisplayAttempts: false,
          _recordInteraction: false
        });
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
      // Branching options → text component with styled buttons
      // Adapt doesn't have a native branching component, so we use
      // a narrative or text component to present the options
      var optionTexts = slide.interactions.filter(function (i) {
        return i.type === 'button' || i.type === 'option';
      }).map(function (i) { return textVal(i.label || i.text || ''); }).filter(Boolean);

      var bodyHtml = textsToBody(allTexts);
      if (optionTexts.length > 0) {
        bodyHtml += '<ul class="branching-options">';
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
        _component: 'text',
        _classes: 'branching-component',
        _layout: 'full',
        title: headings[0] || slide.originalTitle || '',
        displayTitle: headings[0] || '',
        body: bodyHtml,
        instruction: ''
      });
    } else if (hasImage && allTexts.length > 0) {
      // Text + image → split layout (text left, graphic right)
      var imgData = slide.content.images[0];
      var imgSrc = typeof imgData === 'string' ? imgData : (imgData.src || imgData.path || '');
      var imgAlt = typeof imgData === 'string' ? '' : (imgData.alt || '');

      var textCompId = idManager.nextComponent(blockId);
      components.push({
        _id: textCompId,
        _parentId: blockId,
        _type: 'component',
        _component: 'text',
        _classes: '',
        _layout: 'left',
        title: headings[0] || '',
        displayTitle: headings[0] || '',
        body: textsToBody(allTexts),
        instruction: ''
      });

      var graphicCompId = idManager.nextComponent(blockId);
      components.push({
        _id: graphicCompId,
        _parentId: blockId,
        _type: 'component',
        _component: 'graphic',
        _classes: '',
        _layout: 'right',
        title: '',
        displayTitle: '',
        body: '',
        instruction: '',
        _graphic: {
          alt: imgAlt,
          longdescription: '',
          large: adaptImagePath(imgSrc),
          small: adaptImagePath(imgSrc),
          attribution: ''
        },
        _isOptional: true
      });
    } else {
      // Default: text component
      var displayTitle = headings[0] || '';
      var body = textsToBody(headings.length > 1 ? headings.slice(1).concat(allTexts) : allTexts);

      // If there's an image but no text, use graphic component
      if (hasImage && allTexts.length === 0) {
        var imgData = slide.content.images[0];
        var imgSrc = typeof imgData === 'string' ? imgData : (imgData.src || imgData.path || '');
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

    return components;
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

      articlesJson.push({
        _id: articleId,
        _parentId: pageId,
        _type: 'article',
        _classes: sectionClasses(section.type),
        title: articleTitle,
        displayTitle: '',
        body: '',
        instruction: ''
      });

      // Process slides within section
      var slides = section.slides || [];

      slides.forEach(function (slide, slideIndex) {
        // Create block for this slide
        var blockId = idManager.nextBlock(articleId);
        var trackingId = idManager.nextTrackingId();

        blocksJson.push({
          _id: blockId,
          _parentId: articleId,
          _type: 'block',
          _classes: '',
          title: slide.originalTitle || '',
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

        // Build components for this slide
        var comps = buildSlideComponents(slide, section, blockId, idManager);
        componentsJson = componentsJson.concat(comps);

        // If slide has layers AND wasn't handled as accordion above,
        // create additional blocks for layer content
        if (slide.layers && slide.layers.length > 0 &&
          slide.presentation !== 'interactive') {
          // Layers rendered as separate blocks if presentation isn't interactive
        }
      });
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

  // ---- Public API ----
  return {
    translate: translate
  };
})();
