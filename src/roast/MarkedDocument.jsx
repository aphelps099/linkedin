import React from 'react';
import { annotationRanges, EDITORIAL_NOTES } from './editorial.js';

export function MarkedDocument({ text, findings, activeFinding = null, onSelect }) {
  const ranges = React.useMemo(() => annotationRanges(text, findings), [text, findings]);
  const parts = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    const finding = findings[range.findingIndex];
    parts.push(<button type="button"
      className={`rp-mark rp-mark--${finding.key} ${activeFinding === range.findingIndex ? 'is-active' : ''}`}
      data-finding={range.findingIndex}
      aria-pressed={activeFinding === range.findingIndex}
      aria-controls={`roast-note-${range.findingIndex}`}
      aria-label={`${text.slice(range.start, range.end)} — ${EDITORIAL_NOTES[finding.key]?.[0] || 'View editing note'}`}
      onClick={() => onSelect(range.findingIndex)} key={`${range.start}-${index}`}>
      {text.slice(range.start, range.end)}
    </button>);
    cursor = range.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <div className="rp-marked-text" data-testid="document-inspection" aria-label="Your original with red pen annotations">{parts}</div>;
}
