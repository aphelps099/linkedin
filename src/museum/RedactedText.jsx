import React from 'react';

export function RedactedText({ text, size = 13.5 }){
  const paragraphs = text.split(/\n{2,}/);
  return <>{paragraphs.map((paragraph, index) =>
    <p key={index} style={{ margin: index ? '10px 0 0' : 0, fontSize: size, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
      {paragraph.split(/(\[[A-Z@][A-Z0-9 @''&.-]*\])/g).map((segment, segmentIndex) =>
        /^\[[A-Z@]/.test(segment)
          ? <span key={segmentIndex} style={{ background: 'var(--blue)', color: '#fff', padding: '0 4px',
              fontSize: size - 2.5, fontWeight: 700, letterSpacing: '.04em' }}>{segment}</span>
          : segment)}
    </p>)}</>;
}
