/**
 * Data Builders — Converts CoursePlan into the JSON data structures
 * consumed by the generated React app.
 *
 * Now works from CoursePlan (output of ContentPlanner) instead of raw CourseIR.
 * Produces section-based data for deep-scroll layout.
 */
window.GeneratorData = (function () {
  'use strict';

  function resolveImage(img, generatedImages) {
    if (!img) return undefined;
    var generated = generatedImages && generatedImages.entries
      ? generatedImages.entries.find(function (e) { return e.originalAssetId === img.assetId && e.status === 'generated'; })
      : null;
    if (generated && generated.generatedPath) return generated.generatedPath;
    var filename = (img.originalPath || '').split('/').pop() || '';
    return filename ? 'assets/images/' + filename : undefined;
  }

  function resolveMediaPath(originalPath, folder) {
    var filename = (originalPath || '').split('/').pop() || '';
    return filename ? 'assets/' + folder + '/' + filename : undefined;
  }

  /**
   * Build the sections data array for the deep-scroll React app.
   */
  function buildSectionsData(coursePlan, images) {
    return coursePlan.sections.map(function (section) {
      return {
        id: section.id,
        type: section.type,
        title: section.title,
        slides: section.slides.map(function (slide) {
          return buildSlideData(slide, images, coursePlan);
        })
      };
    });
  }

  /**
   * Build data for a single planned slide.
   */
  function buildSlideData(slide, images, coursePlan) {
    var data = {
      id: slide.id,
      type: slide.type,
      presentation: slide.presentation,
      title: slide.originalTitle
    };

    // Text content
    if (slide.content.headings.length > 0) {
      data.headings = slide.content.headings.map(function (h) { return h.text; });
    }
    if (slide.content.bodyTexts.length > 0) {
      data.texts = slide.content.bodyTexts;
    }
    if (slide.content.callouts.length > 0) {
      data.callouts = slide.content.callouts;
    }

    // Images
    var resolvedImages = slide.content.images.map(function (img) {
      return {
        src: resolveImage(img, images),
        alt: img.altText || slide.originalTitle || '',
        role: img.role
      };
    }).filter(function (img) { return img.src; });
    if (resolvedImages.length > 0) data.images = resolvedImages;

    // Legacy: single image for backward compat with title slides etc.
    var heroImg = slide.content.images.find(function (img) { return img.role === 'hero' || img.role === 'background'; });
    if (heroImg) data.image = resolveImage(heroImg, images);
    if (!data.image && resolvedImages.length > 0) data.image = resolvedImages[0].src;

    // Videos
    if (slide.content.videos.length > 0) {
      data.videos = slide.content.videos.map(function (v) {
        return {
          src: resolveMediaPath(v.originalPath, 'media'),
          poster: v.posterPath ? resolveMediaPath(v.posterPath, 'images') : undefined,
          durationMs: v.durationMs
        };
      }).filter(function (v) { return v.src; });
      // Legacy single video
      if (data.videos.length > 0) data.video = data.videos[0];
    }

    // Audio (slide-level AND layer audio AND narration)
    var allAudio = slide.content.audio.map(function (a) {
      return {
        src: resolveMediaPath(a.originalPath, 'media'),
        durationMs: a.durationMs,
        isNarration: a.isNarration || false
      };
    }).filter(function (a) { return a.src; });
    if (allAudio.length > 0) {
      data.audio = allAudio[0];
      if (allAudio.length > 1) data.allAudio = allAudio;
    }

    // Layers with full content
    if (slide.layers.length > 0) {
      data.layers = slide.layers.map(function (layer) {
        var layerData = {
          id: layer.id,
          name: layer.name,
          texts: layer.texts.map(function (t) { return t.content; }).filter(function (t) { return t.length > 0; }),
          image: layer.images.length > 0 ? resolveImage(layer.images[0], images) : undefined,
          interactions: layer.interactions.length > 0 ? layer.interactions : undefined
        };

        // Layer audio
        if (layer.audio && layer.audio.length > 0) {
          layerData.audio = layer.audio.map(function (a) {
            return { src: resolveMediaPath(a.originalPath, 'media'), durationMs: a.durationMs };
          }).filter(function (a) { return a.src; });
        }

        // Layer videos
        if (layer.videos && layer.videos.length > 0) {
          layerData.videos = layer.videos.map(function (v) {
            return { src: resolveMediaPath(v.originalPath, 'media') };
          }).filter(function (v) { return v.src; });
        }

        return layerData;
      }).filter(function (l) { return l.texts.length > 0 || l.image || (l.interactions && l.interactions.length > 0); });

      if (data.layers.length > 0) {
        data.interactionType = slide.interactionType || classifyInteraction(data.layers);
      } else {
        delete data.layers;
      }
    }

    // Interactions (hotspots, sliders, scroll panels)
    if (slide.interactions.length > 0) {
      data.interactions = slide.interactions;
    }

    // Element states
    if (slide.states.length > 0) {
      data.states = slide.states;
    }

    // Form fields
    if (slide.formFields.length > 0) {
      data.fields = slide.formFields.map(function (f) {
        return {
          label: f.label.trim(),
          placeholder: f.label.trim(),
          fieldType: f.fieldType,
          variableName: f.variableName
        };
      });
      data.instruction = slide.content.bodyTexts.find(function (t) {
        var lower = t.toLowerCase();
        return lower.includes('enter') || lower.includes('please') || lower.includes('fill');
      }) || 'Please fill in your details';
      // Clean up auto-generated form titles like "Text Entry", "Text Entry 1"
      var formTitle = (slide.originalTitle || '').trim();
      data.title = /^text\s*entry/i.test(formTitle) ? 'Your Details' : (formTitle || 'Your Details');
    }

    // Branching
    if (slide.type === 'branching') {
      data.title = slide.originalTitle || 'Choose Your Path';

      // Include descriptive body texts (exclude greetings and short UI text)
      var descriptiveTexts = slide.content.bodyTexts.filter(function (t) {
        return t.length > 30 && !t.includes('%');
      });
      if (descriptiveTexts.length > 0) {
        data.texts = descriptiveTexts;
      }

      // Include headings that provide context
      if (slide.content.headings.length > 0) {
        data.headings = slide.content.headings.map(function (h) { return h.text; });
      }

      // Greeting with universal variable substitution
      var greeting = slide.content.bodyTexts.find(function (t) { return t.includes('%'); });
      if (greeting) data.greeting = greeting.replace(/%_player\.[^%]+%/g, '%name%');

      // Build options from extracted buttons
      var quizBankIds = coursePlan && coursePlan.quizBanks
        ? coursePlan.quizBanks.map(function (qb) { return qb.id; })
        : [];

      if (slide.buttons && slide.buttons.length > 0) {
        data.options = slide.buttons.map(function (btn, idx) {
          var label = btn.label;
          var lowerLabel = label.toLowerCase();
          var quizBank;
          if (lowerLabel.includes('skip') || lowerLabel.includes('no thanks')) {
            quizBank = undefined;
          } else if (quizBankIds.length > 0) {
            quizBank = quizBankIds[Math.min(idx, quizBankIds.length - 1)];
          }
          return { label: label, value: label, quizBank: quizBank };
        });
      }

      // Also pass quiz bank IDs for reference
      if (quizBankIds.length > 0) {
        data.quizBankIds = quizBankIds;
      }
    }

    // Quiz
    if (slide.quizData) {
      data.quiz = {
        questionText: slide.quizData.questionText,
        questionType: slide.quizData.questionType,
        choices: slide.quizData.choices,
        correctFeedback: slide.quizData.correctFeedback,
        incorrectFeedback: slide.quizData.incorrectFeedback
      };
    }

    // Results
    if (slide.type === 'results') {
      data.title = slide.originalTitle || 'Your Results';
    }

    // Title slide extras
    if (slide.type === 'title') {
      var descriptiveTitle = slide.content.headings[0]
        ? slide.content.headings[0].text
        : (slide.content.bodyTexts[0] || slide.originalTitle);
      if (descriptiveTitle) {
        data.title = descriptiveTitle;
        var subtitleSource = slide.content.headings.length > 1
          ? slide.content.headings[1].text
          : slide.content.bodyTexts[0];
        if (subtitleSource && subtitleSource !== descriptiveTitle) {
          data.subtitle = subtitleSource;
        }
      }
    }

    return data;
  }

  /**
   * Classify how layers should be rendered.
   */
  function classifyInteraction(layers) {
    if (!layers || layers.length === 0) return null;
    var hasImages = layers.some(function (l) { return l.image; });
    var avgTextLen = layers.reduce(function (sum, l) {
      return sum + (l.texts ? l.texts.join(' ').length : 0);
    }, 0) / layers.length;
    if (layers.length >= 3 && avgTextLen < 200) return 'bento';
    if (hasImages) return 'modal';
    return 'accordion';
  }

  /**
   * Build quiz bank data (unchanged — quiz banks are already clean).
   */
  function buildQuizData(coursePlan) {
    return (coursePlan.quizBanks || []).map(function (bank) {
      return {
        id: bank.id,
        title: bank.title,
        group: bank.group,
        drawCount: bank.drawCount,
        questions: bank.questions.map(function (q) {
          return {
            questionText: q.questionText,
            questionType: q.questionType,
            choices: q.choices.map(function (c) { return { text: c.text, isCorrect: c.isCorrect }; }),
            correctFeedback: q.correctFeedback,
            incorrectFeedback: q.incorrectFeedback
          };
        })
      };
    });
  }

  return { buildSectionsData: buildSectionsData, buildQuizData: buildQuizData };
})();
