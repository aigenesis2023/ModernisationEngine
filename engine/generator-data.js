/**
 * Data Builders — Converts CourseIR into simplified slide/quiz JSON
 * for the React app component. Part 2 of the generator.
 *
 * Layer Interaction Classification:
 *   - accordion: text-heavy layers (click-to-reveal paragraphs)
 *   - modal: layers with images + text (detailed explorations)
 *   - bento: 3+ layers with mixed short content (visual tile grid)
 */
window.GeneratorData = (function () {
  'use strict';

  function cleanText(text) {
    return text.replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function isJunkText(text) {
    var lower = text.toLowerCase();
    if (/^(round diagonal corner|rectangle|oval|shape)\s*\d*$/i.test(text)) return true;
    if (text.includes('%_player.') && text.includes('$PercentScore')) return true;
    if (lower === 'question' || lower === 'correct' || lower === 'incorrect') return true;
    return false;
  }

  function resolveImage(el, images) {
    if (!el) return undefined;
    var generated = images && images.entries
      ? images.entries.find(function (e) { return e.originalAssetId === el.assetId && e.status === 'generated'; })
      : null;
    if (generated && generated.generatedPath) return generated.generatedPath;
    var filename = (el.originalPath || '').split('/').pop() || '';
    return filename ? 'assets/images/' + filename : undefined;
  }

  /**
   * Classify how layers should be rendered based on their content.
   */
  function classifyInteraction(layers) {
    if (!layers || layers.length === 0) return null;

    var hasImages = layers.some(function (l) { return l.image; });
    var avgTextLen = layers.reduce(function (sum, l) {
      return sum + (l.texts ? l.texts.join(' ').length : 0);
    }, 0) / layers.length;

    // Bento grid: 3+ layers, each relatively short
    if (layers.length >= 3 && avgTextLen < 200) return 'bento';
    // Modal: layers with images (detailed exploration)
    if (hasImages) return 'modal';
    // Accordion: text-heavy content
    return 'accordion';
  }

  function buildSlidesData(course, images) {
    return course.slides.map(function (slide) {
      var data = { type: slide.type, title: slide.title };

      // Extract text content
      var texts = slide.elements
        .filter(function (el) { return el.type === 'text' && el.role !== 'unknown'; })
        .map(function (el) { return cleanText(el.content); })
        .filter(function (t) { return t.length > 3 && !isJunkText(t); });

      if (texts.length > 0) data.texts = texts;

      // Hero/content image
      var imgEl = slide.elements.find(function (el) {
        return el.type === 'image' && ['hero', 'content', 'background'].includes(el.instructionalRole);
      });
      if (imgEl) data.image = resolveImage(imgEl, images);

      // Video element
      var videoEl = slide.elements.find(function (el) { return el.type === 'video'; });
      if (videoEl) {
        var vFilename = (videoEl.originalPath || '').split('/').pop() || '';
        data.video = {
          src: 'assets/media/' + vFilename,
          poster: videoEl.posterPath ? 'assets/images/' + videoEl.posterPath.split('/').pop() : undefined,
        };
      }

      // Audio element
      var audioEl = slide.elements.find(function (el) { return el.type === 'audio'; });
      if (audioEl) {
        var aFilename = (audioEl.originalPath || '').split('/').pop() || '';
        data.audio = { src: 'assets/media/' + aFilename };
      }

      // Layer content — classify interaction type
      if (slide.layers.length > 0) {
        var layerData = slide.layers
          .filter(function (l) { return l.elements.length > 0; })
          .map(function (l) {
            var layerTexts = l.elements
              .filter(function (el) { return el.type === 'text' && el.role !== 'unknown'; })
              .map(function (el) { return cleanText(el.content); })
              .filter(function (t) { return t.length > 3 && !isJunkText(t); });
            var layerImg = l.elements.find(function (el) {
              return el.type === 'image' && ['hero', 'content'].includes(el.instructionalRole);
            });
            return {
              name: l.name,
              texts: layerTexts,
              image: resolveImage(layerImg, images),
            };
          })
          .filter(function (l) { return l.texts.length > 0 || l.image; });

        if (layerData.length > 0) {
          data.layers = layerData;
          data.interactionType = classifyInteraction(layerData);
        }
      }

      // Slide-type specific data
      switch (slide.type) {
        case 'title': {
          var descriptiveTitle = texts.find(function (t) {
            return t.length > 5 && !t.toLowerCase().includes('test') && !t.toLowerCase().includes('scene');
          });
          if (descriptiveTitle) {
            data.title = descriptiveTitle;
            data.subtitle = texts.find(function (t) { return t !== descriptiveTitle; }) || undefined;
          } else {
            data.title = course.meta.title;
            if (texts.length > 0) data.subtitle = texts[0];
          }
          break;
        }

        case 'form': {
          var formEl = slide.elements.find(function (el) { return el.type === 'form'; });
          if (formEl) {
            data.fields = formEl.fields.map(function (f) {
              return { label: f.label.trim(), placeholder: f.label.trim(), fieldType: f.fieldType, variableName: f.variableName };
            });
          }
          data.title = 'Your Details';
          var instruction = texts.find(function (t) {
            return t.toLowerCase().includes('enter') || t.toLowerCase().includes('please');
          });
          data.instruction = instruction || 'Please fill in your details';
          data.texts = undefined;
          break;
        }

        case 'branching': {
          var buttons = slide.elements.filter(function (el) { return el.type === 'button'; });
          var branchInstruction = texts.find(function (t) {
            return t.toLowerCase().includes('click') || t.toLowerCase().includes('select');
          });
          data.instruction = branchInstruction;

          var greeting = texts.find(function (t) { return t.includes('%'); });
          if (greeting) data.greeting = greeting.replace(/%_player\.TextEntry\d+%/g, '%name%');

          var quizBankIds = course.questionBanks.map(function (qb) { return qb.id; });
          var branchButtons = buttons.filter(function (b) {
            return b.label && !b.label.includes('Hotspot') && b.label !== '<' && b.label.length > 1;
          });

          if (branchButtons.length > 0) {
            data.options = branchButtons.map(function (b, idx) {
              var label = cleanText(b.label);
              var lowerLabel = label.toLowerCase();
              var quizBank;
              if (b.action && b.action.targetSlideId) {
                quizBank = undefined;
              } else if (lowerLabel.includes('skip') || lowerLabel.includes('no thanks')) {
                quizBank = undefined;
              } else if (quizBankIds.length > 0) {
                quizBank = quizBankIds[Math.min(idx, quizBankIds.length - 1)];
              }
              return { label: label, value: label, quizBank: quizBank };
            });
          }
          data.texts = undefined;
          break;
        }

        case 'results':
          data.title = 'Your Results';
          data.texts = undefined;
          break;
      }

      return data;
    });
  }

  function buildQuizData(course) {
    return course.questionBanks.map(function (bank) {
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
            incorrectFeedback: q.incorrectFeedback,
          };
        }),
      };
    });
  }

  return { buildSlidesData: buildSlidesData, buildQuizData: buildQuizData };
})();
