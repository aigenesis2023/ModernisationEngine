import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Parse body HTML into table rows.
 * Handles: <li> items, <p> or <br>-separated lines, plain line breaks.
 * Each line is split on " - ", " : ", or " | " to produce columns.
 */
function parseBodyToRows(html) {
  if (!html) return [];

  var temp = document.createElement('div');
  temp.innerHTML = html;

  // Try extracting from <li> elements first
  var listItems = temp.querySelectorAll('li');
  var lines = [];

  if (listItems.length > 0) {
    listItems.forEach(function (li) {
      lines.push(li.textContent.trim());
    });
  } else {
    // Fall back to <p> elements or line breaks
    var paragraphs = temp.querySelectorAll('p');
    if (paragraphs.length > 1) {
      paragraphs.forEach(function (p) {
        var text = p.textContent.trim();
        if (text) lines.push(text);
      });
    } else {
      // Split on <br> or newlines
      var raw = temp.innerHTML.replace(/<br\s*\/?>/gi, '\n');
      var textContent = raw.replace(/<[^>]+>/g, '');
      textContent.split('\n').forEach(function (line) {
        var trimmed = line.trim();
        if (trimmed) lines.push(trimmed);
      });
    }
  }

  // Split each line into columns using common separators
  var separatorPattern = /\s+[-–—:|]\s+/;
  return lines.map(function (line) {
    return line.split(separatorPattern).map(function (cell) {
      return cell.trim();
    });
  });
}

/**
 * Detect if a string looks numeric (for monospace styling).
 */
function isNumeric(str) {
  return /^[\d,.$%€£¥+\-()]+$/.test(str.trim());
}

export default function DataTable({ data = {} }) {
  var ref = useRef(null);
  var isInView = useInView(ref, { once: true, amount: 0.2 });

  var title = data.displayTitle || '';
  var body = data.body || '';
  var rows = parseBodyToRows(body);
  var maxCols = rows.reduce(function (max, row) {
    return Math.max(max, row.length);
  }, 0);

  // If we only got single-column data, render as a simple list
  var isSingleColumn = maxCols <= 1;

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={fadeInUp}
      className="w-full flex justify-center py-6 sm:py-8"
    >
      <div
        className="w-full rounded-xl border overflow-hidden"
        style={{
          maxWidth: '900px',
          background: 'var(--ui-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'var(--ui-glass-border)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Sticky header */}
        {title && (
          <div
            className="sticky top-0 z-10 px-6 sm:px-8 py-4 border-b"
            style={{
              background: 'var(--brand-surface, rgba(10, 10, 26, 0.9))',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderColor: 'var(--ui-glass-border)',
            }}
          >
            <h2
              className="text-xl sm:text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--brand-heading, #ffffff)' }}
            >
              {title}
            </h2>
          </div>
        )}

        {/* Table content */}
        <div className="overflow-x-auto">
          {rows.length > 0 ? (
            <table className="w-full">
              <tbody>
                {rows.map(function (row, rowIdx) {
                  var isEvenRow = rowIdx % 2 === 0;
                  return (
                    <tr
                      key={rowIdx}
                      style={{
                        background: isEvenRow
                          ? 'rgba(255, 255, 255, 0.02)'
                          : 'transparent',
                      }}
                    >
                      {row.map(function (cell, colIdx) {
                        var isNum = isNumeric(cell);
                        return (
                          <td
                            key={colIdx}
                            className="px-6 sm:px-8 py-3 text-sm sm:text-base border-b"
                            style={{
                              borderColor: 'var(--ui-glass-border)',
                              color: colIdx === 0
                                ? 'var(--brand-text, rgba(255, 255, 255, 0.85))'
                                : 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))',
                              fontFamily: isNum ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace' : 'inherit',
                              fontWeight: colIdx === 0 ? 500 : 400,
                              whiteSpace: isSingleColumn ? 'normal' : 'nowrap',
                            }}
                          >
                            {cell}
                          </td>
                        );
                      })}
                      {/* Fill empty cells if row has fewer columns */}
                      {!isSingleColumn && Array.from({ length: maxCols - row.length }).map(function (_, k) {
                        return (
                          <td
                            key={'empty-' + k}
                            className="px-6 sm:px-8 py-3 border-b"
                            style={{ borderColor: 'var(--ui-glass-border)' }}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* Fallback: render body as HTML if parsing yielded nothing */
            body && (
              <div
                className="px-6 sm:px-8 py-6 text-base leading-relaxed [&>p]:mb-3"
                style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                dangerouslySetInnerHTML={{ __html: body }}
              />
            )
          )}
        </div>
      </div>
    </motion.section>
  );
}
