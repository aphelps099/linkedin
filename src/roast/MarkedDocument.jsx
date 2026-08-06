import React from 'react';

const PATTERNS = {
  journey: /\bjourney\b/gi,
  humbled: /\bhumbled\b/gi,
  sink: /let that sink in|read that again/gi,
  hashtags: /#\w+/g,
  rockets: /🚀/gu,
  notx: /it'?s not[^.!?\n]{2,70}it'?s (?:about )?/gi,
  bait: /\b(?:agree|thoughts)\?/gi,
  gratbrag: /\b(?:grateful|gratitude|thankful|proud|excited|thrilled)\b/gi,
  aitells: /\b(?:delve|tapestry|testament)\b/gi,
  grindset: /\b(?:5 ?a\.?m\.?|rise and grind|hustle|no days off)\b/gi,
  buzz: /\b(?:synerg\w*|leverag\w*|pivot\w*|bandwidth|alignment|scalable|ecosystem|empower\w*|disrupt\w*|game-?chang\w*|cross-functional|best-in-class)\b/gi,
  pipes: /[|·•]/g,
  helping: /\bhelping\b.{3,60}\b(?:grow|scale|win|thrive|succeed|transform|tell)\w*/gi,
  inflation: /\b(?:visionary|guru|ninja|rockstar|wizard|evangelist|thought leader|dreamer|disruptor|growth hacker)\b/gi,
  exflex: /\bex-[A-Z][\w-]*/g,
  topvoice: /top voice/gi,
  hemoji: /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/gu,
  speakerauthor: /\b(?:speaker|author|investor|advisor|coach|podcast host)\b/gi,
  passionate: /passionate about/gi,
  resultsdriven: /results-driven|proven track record/gi,
  manyhats: /wear(?:ing)? many hats/gi,
};

function rangesFor(text, findings, visibleCount) {
  const ranges = [];
  findings.slice(0, visibleCount).forEach((finding, findingIndex) => {
    const pattern = PATTERNS[finding.key];
    if (!pattern) return;
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
        findingIndex,
      });
      if (!pattern.global) break;
    }
  });

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  return ranges.filter((range, index, all) =>
    !all.slice(0, index).some(accepted =>
      range.start < accepted.end && range.end > accepted.start));
}

export function MarkedDocument({
  text,
  findings,
  visibleCount,
  scanning = false,
  activeFinding = null,
}) {
  const ranges = React.useMemo(
    () => rangesFor(text, findings, visibleCount),
    [text, findings, visibleCount],
  );
  const parts = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(
      <mark
        className={`rm-mark ${activeFinding === range.findingIndex ? 'is-active' : ''}`}
        data-finding={range.findingIndex}
        data-mark={range.findingIndex + 1}
        key={`${range.start}-${range.end}-${index}`}
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <article className={`rm-document ${scanning ? 'is-scanning' : ''}`} data-testid="document-inspection">
      <header className="rm-document__header">
        <span>Submitted material</span>
        <span>Exhibit A</span>
      </header>
      <div className="rm-document__body">{parts}</div>
      {scanning && <div className="rm-scanline" aria-hidden="true" />}
    </article>
  );
}
