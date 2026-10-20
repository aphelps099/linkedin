import React, {Fragment} from 'react';

// Tiny markdown for program copy: paragraphs, **bold**, *italic*, `code`,
// bullet lists, and GFM tables. The chapters are written to this subset.
function inline(text, keyBase){
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let last = 0, m, i = 0;
  while((m = re.exec(text)) !== null){
    if(m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0], key = `${keyBase}-${i++}`;
    if(tok.startsWith('**')) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if(tok.startsWith('`')) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if(last < text.length) out.push(text.slice(last));
  return out;
}
const isTable = lines => lines.length >= 2 && lines[0].includes('|') && /^[\s:|-]+$/.test(lines[1]);
const cells = line => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());

export function Markdown({text, className}){
  const blocks = String(text || '').trim().split(/\n{2,}/);
  return <div className={className}>
    {blocks.map((block, bi) => {
      const lines = block.split('\n');
      if(isTable(lines)){
        const head = cells(lines[0]);
        const body = lines.slice(2).filter(l => l.includes('|')).map(cells);
        return <table key={bi}><thead><tr>{head.map((c, i) => <th key={i}>{inline(c, `${bi}h${i}`)}</th>)}</tr></thead>
          <tbody>{body.map((row, ri) => <tr key={ri}>{row.map((c, ci) => <td key={ci}>{inline(c, `${bi}-${ri}-${ci}`)}</td>)}</tr>)}</tbody></table>;
      }
      if(lines.every(l => /^\s*[-*]\s+/.test(l))){
        return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ''), `${bi}-${li}`)}</li>)}</ul>;
      }
      return <p key={bi}>{lines.map((l, li) => <Fragment key={li}>{li > 0 && <br/>}{inline(l, `${bi}-${li}`)}</Fragment>)}</p>;
    })}
  </div>;
}
