import React, { useEffect, useRef, useState } from 'react';
import { Pad, KeyPlate } from '../components/pads/Pad.jsx';
import { StepGrid } from '../components/sequencer/StepGrid.jsx';
import { Stamp } from '../components/chassis/Stamp.jsx';

// LinkedIn Beats — the umbrella-brand homepage ("The Loud Filing"), served at
// /v2. Ported from design_handoff_linkedin_beats_site/. The Circle Back design
// system in campaign voice: offset ink shadows, slight rotations, one marquee.
// Everything runs client-side; nothing is sent anywhere.

const CLAIMS = ['deeply humbled', 'beyond excited', 'truly honored', 'very thrilled'];
const CLAIM_SECONDS = 2.2;

const MARQUEE = ["I'm thrilled to announce", 'Let that sink in', 'Agree?', "We're not just building a company", "Here's what nobody tells you"];

const KEYS = '1234QWETASDFZXCV';
const PADS = [
  { name: 'Humbled', line: 'Humbled and honored to share' },
  { name: 'Thrilled', line: "I'm thrilled to announce" },
  { name: 'Synergy', line: 'Unlocking cross-functional synergies' },
  { name: 'Circle Back', line: "Let's circle back on this" },
  { name: 'Journey', line: 'It has been quite the journey' },
  { name: 'Agree?', line: 'Agree?' },
  { name: 'Thoughts?', line: 'Thoughts?' },
  { name: 'Sink In', line: 'Let that sink in' },
  { name: '10x', line: 'A true 10x mindset' },
  { name: 'Disrupt', line: 'We are disrupting the space' },
  { name: 'My Why', line: 'I found my why' },
  { name: 'Plot Twist', line: 'Plot twist:' },
  { name: 'Family', line: "We're not a company, we're a family" },
  { name: 'Rockstar', line: 'Looking for a rockstar' },
  { name: 'Pivot', line: 'The pivot was the plan all along' },
  { name: 'Onwards', line: 'Onwards and upwards! 🚀' },
];

const TRACKS = [
  { label: 'Synergy in B2B Minor', dur: '2:47' },
  { label: 'Let That Sink In (Remix)', dur: '3:12' },
  { label: 'Per My Last Email', dur: '2:58' },
  { label: 'Thrilled to Announce', dur: '2:31' },
  { label: 'We Are a Family (Live)', dur: '4:04' },
];

const PERSONAS = {
  founder: { name: 'Founder', title: 'Chief Executive Storyteller', posts: '247', humble: '96%', lines: '1,108', word: 'journey' },
  ai: { name: 'AI expert', title: 'Prompt Visionary', posts: '611', humble: '12%', lines: '4,392', word: 'agents' },
  recruiter: { name: 'Recruiter', title: 'People Person Person', posts: '384', humble: '83%', lines: '2,019', word: 'rockstar' },
};

const BINGO = ['Agree?', 'Let that sink in', 'Humbled', 'Game-changer', 'My why', 'Plot twist', 'Unpopular opinion', 'Read that again', 'Thoughts?', '10x', 'Disrupting', 'I failed', 'Value-add', 'No one talks about', "We're a family", 'Link in comments'];
const BINGO_RES = [/agree\?/i, /let that sink in/i, /humbled/i, /game-?chang/i, /my why/i, /plot twist/i, /unpopular opinion/i, /read that again/i, /thoughts\?/i, /\b10x\b/i, /disrupt/i, /\bi failed\b/i, /value-?add/i, /no ?(one|body) talks about/i, /we('| a)?re a family|we are a family/i, /link in (the )?comments/i];

const VOICES = [{ name: 'Kick' }, { name: 'Snare' }, { name: 'Hat' }, { name: 'Vox', vox: true }];
const INIT_PATTERN = [
  [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 1, 0],
  [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 6, 0, 0, 0, 12, 0, 0, 0, 8, 0],
];

export default function V2() {
  const [claimIdx, setClaimIdx] = useState(0);
  const [persona, setPersona] = useState('founder');
  const [checkedC, setCheckedC] = useState([false, true, true, false, false, true, false, false, true, false, true, false, false, false, false, false]);
  const [copied, setCopied] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [scored, setScored] = useState(false);
  const [padHot, setPadHot] = useState(-1);
  const [lastPhrase, setLastPhrase] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [trackIdx, setTrackIdx] = useState(0);
  const [selRow, setSelRow] = useState(0);
  const [pattern, setPattern] = useState(INIT_PATTERN);

  const seqTimer = useRef(null);
  const padTimer = useRef(null);
  const copyTimer = useRef(null);

  // rotating hero claim — fixed line box, so rotation never reflows
  useEffect(() => {
    const t = setInterval(() => setClaimIdx(i => (i + 1) % CLAIMS.length), CLAIM_SECONDS * 1000);
    return () => clearInterval(t);
  }, []);

  // transport: advance the 16-step position while playing
  useEffect(() => {
    if (!playing) return;
    seqTimer.current = setInterval(() => setPos(p => (p + 1) % 16), 134);
    return () => clearInterval(seqTimer.current);
  }, [playing]);

  useEffect(() => () => { clearTimeout(padTimer.current); clearTimeout(copyTimer.current); }, []);

  const trigger = (i, line) => {
    clearTimeout(padTimer.current);
    setPadHot(i); setLastPhrase(line);
    padTimer.current = setTimeout(() => setPadHot(-1), 130);
  };

  // global hotkeys 1234QWETASDFZXCV strike the matching key
  useEffect(() => {
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const i = KEYS.indexOf(e.key.toUpperCase());
      if (i >= 0) { e.preventDefault(); trigger(i, PADS[i].line); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copy = text => {
    try { navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {}); } catch (e) {}
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2600);
  };

  const togglePlay = () => { if (playing) { setPlaying(false); setPos(0); } else { setPos(0); setPlaying(true); } };
  const openRoast = () => { window.location.href = '../roast/'; };
  const sendCoworker = () => copy('No pressure, but your LinkedIn has been placed on a performance improvement plan. https://linkedinbeats.com');

  const runDetection = () => {
    const t = postText || '';
    setCheckedC(BINGO_RES.map(re => re.test(t)));
    setScored(true);
  };
  const clearC = () => setCheckedC(BINGO.map(() => false));
  const countC = checkedC.filter(Boolean).length;
  const shareBingoC = () => copy('LinkedIn Cringe Bingo: ' + countC + '/16 squares before lunch. Beat that. https://linkedinbeats.com');
  const copyCaption = () => copy('Official Cliché Detection Grid, Form BD-16: this post scored ' + countC + '/16. Verified by Barry (Compliance). linkedinbeats.com');

  const downloadBingo = () => {
    const S = 1080, c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d');
    const hits = checkedC, n = hits.filter(Boolean).length;
    x.fillStyle = '#f6f5f1'; x.fillRect(0, 0, S, S);
    x.strokeStyle = '#111111'; x.lineWidth = 12; x.strokeRect(6, 6, S - 12, S - 12);
    const sans = (w, px) => x.font = w + ' ' + px + 'px "Helvetica Neue", Helvetica, Arial, sans-serif';
    x.fillStyle = '#111111'; sans(700, 42); x.fillText('LinkedIn Cringe Bingo', 60, 96);
    x.font = '400 20px "IBM Plex Mono", monospace'; x.textAlign = 'right';
    x.fillText('FORM BD-16 · OFFICIAL', S - 60, 90); x.textAlign = 'left';
    x.fillRect(60, 122, S - 120, 5);
    const gx = 60, gy = 160, cw = (S - 120) / 4, ch = 190;
    for (let i = 0; i < 16; i++) {
      const col = i % 4, row = Math.floor(i / 4), px = gx + col * cw, py = gy + row * ch;
      x.fillStyle = hits[i] ? '#0a66c2' : '#ffffff'; x.fillRect(px, py, cw, ch);
      x.strokeStyle = '#111111'; x.lineWidth = 3; x.strokeRect(px, py, cw, ch);
      if (hits[i]) { x.fillStyle = 'rgba(159,200,234,.85)'; sans(700, 110); x.textAlign = 'center'; x.fillText('✓', px + cw / 2, py + ch / 2 + 40); }
      x.fillStyle = hits[i] ? '#ffffff' : '#111111'; sans(700, 24); x.textAlign = 'center';
      const words = BINGO[i].split(' ');
      let line = '', lines = [];
      for (const w of words) { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > cw - 30 && line) { lines.push(line); line = w; } else line = test; }
      lines.push(line);
      lines.forEach((ln, li) => x.fillText(ln, px + cw / 2, py + ch / 2 - (lines.length - 1) * 14 + li * 28 + 8));
      x.textAlign = 'left';
    }
    x.fillStyle = '#111111'; x.font = '400 22px "IBM Plex Mono", monospace';
    x.fillText(n + '/16 OBSERVED IN THE POST ABOVE · LINKEDINBEATS.COM', 60, S - 42);
    x.save(); x.translate(S - 190, S - 60); x.rotate(-4 * Math.PI / 180);
    sans(700, 22); x.textAlign = 'center'; const st = 'VERIFIED — BD-16';
    const stw = x.measureText(st).width; x.strokeStyle = '#0a66c2'; x.lineWidth = 4;
    x.strokeRect(-stw / 2 - 16, -26, stw + 32, 48); x.fillStyle = '#0a66c2'; x.fillText(st, 0, 6);
    x.restore(); x.textAlign = 'left';
    const a = document.createElement('a'); a.download = 'cringe-bingo-bd16.png'; a.href = c.toDataURL('image/png'); a.click();
  };

  const P = PERSONAS[persona];
  const posTime = '0:' + String(pos * 2).padStart(2, '0');
  const voxLabels = [null, null, null, PADS.map(p => p.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase())];
  const wordmark = <span className="lb-wordmark">LinkedIn <b className="lb-beats-chip">Beats</b><span className="lb-cursor">▮</span></span>;

  return <div className="lb-app">
    <div className="lb-page">
      {/* masthead */}
      <header className="lb-head">
        {wordmark}
        <nav className="lb-nav">
          <a href="#beats-3">The Beats</a>
          <a href="#wrapped-3">Your Wrapped</a>
          <a href="#bingo-3">Bingo</a>
          <a href="#merch-3">Merch</a>
          <a href="../museum/">About</a>
        </nav>
        <button className="lb-roast-btn" onClick={openRoast}>Roast me <span className="k">R</span></button>
      </header>

      {/* hero */}
      <div className="lb-hero">
        <div className="lb-hero-l">
          <p className="lb-bulletin"><span>Bulletin</span> Everyone is saying the exact same thing.</p>
          <h1 className="lb-h1">The soundtrack of<span className="lb-claim">{CLAIMS[claimIdx]}<span className="lb-blink">▮</span></span>professionals.</h1>
          <p className="lb-dek">Roast your LinkedIn. Assemble a legally distinct thought-leadership anthem. Send it to the coworker who posts like a hostage negotiator.</p>
          <div className="lb-cta-row">
            <button className="lb-split" onClick={openRoast}><span className="a">Roast my LinkedIn</span><span className="b">It's free →</span></button>
            <button className="lb-outline-btn" onClick={sendCoworker}>Send to a coworker ↗</button>
            {copied && <span className="lb-copied">✓ COPIED — CLEARED FOR THE FEED</span>}
          </div>
          <p className="lb-microcopy">No login. No coaching funnel. Mild emotional damage.</p>
        </div>
        <div className="lb-hero-r">
          <div className="lb-record-wrap">
            <div className="lb-record">
              <div className="lb-record-groove"></div>
              <div className="lb-record-label">
                <small>NOW PLAYING</small>
                <b>SYNERGY<br />IN B2B MINOR</b>
                <span>2:47 · FEAT. THE ALGORITHM</span>
              </div>
            </div>
          </div>
          <span className="lb-sticker lb-sticker-otw">#OPEN<br />TO WORK</span>
          <span className="lb-sticker lb-sticker-q3">Q3<br />BANGER</span>
          <span className="lb-hero-caption">It has thoughts. None are its own.</span>
        </div>
      </div>

      {/* marquee */}
      <div className="lb-marquee">
        <div className="lb-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}<b>▮</b></span>)}
        </div>
      </div>

      {/* Drop a beat */}
      <div id="beats-3" className="lb-beats">
        <div className="lb-beats-head">
          <div>
            <p className="lb-beats-kicker">Form CB-16 · The professional phrase organ</p>
            <h2 className="lb-beats-h2">Drop a beat.<br />Cite your sources.</h2>
          </div>
          <p className="lb-beats-lede">Sixteen keys of certified corporate vocabulary over a live drum machine. Strike a key. Paint the grid. It's not an instrument. It's a journey.</p>
        </div>
        <div className="lb-rig">
          {/* iPod LB-01 */}
          <div className="lb-ipod">
            <div className="lb-screen">
              <div className="lb-screen-top"><span>NOW PLAYING · {trackIdx + 1} OF 5</span><span>{playing ? '◼' : '▶'} {posTime}</span></div>
              <div className="lb-screen-now">
                <b>{TRACKS[trackIdx].label}</b>
                <span className="lb-screen-sub">LINKEDIN BEATS · FEAT. THE ALGORITHM</span>
                <span className="lb-progress"><i></i></span>
                <span className="lb-screen-time"><span>{posTime}</span><span>-{TRACKS[trackIdx].dur}</span></span>
              </div>
              {TRACKS.map((t, i) => {
                const on = i === trackIdx;
                return <button key={i} className="lb-track" onClick={() => setTrackIdx(i)}
                  style={{ background: on ? '#fff' : 'transparent', color: on ? '#084d92' : '#fff' }}>
                  {(i + 1) + '. ' + t.label}<span>{on ? '▸' : ''}</span></button>;
              })}
              <div className="lb-teletype">ON THE RECORD · "{lastPhrase ?? 'STRIKE A KEY. IT SPEAKS IN TIME.'}"<span className="lb-blink">▮</span></div>
            </div>
            <div className="lb-wheel">
              <span className="lb-wheel-menu">MENU</span>
              <button className="lb-wheel-btn lb-wheel-prev" onClick={() => setTrackIdx(i => (i + TRACKS.length - 1) % TRACKS.length)}>◀◀</button>
              <button className="lb-wheel-btn lb-wheel-next" onClick={() => setTrackIdx(i => (i + 1) % TRACKS.length)}>▶▶</button>
              <button className="lb-wheel-btn lb-wheel-play" onClick={togglePlay}>▶ ◼</button>
              <button className="lb-wheel-center" onClick={togglePlay}
                style={{ background: playing ? '#0a66c2' : '#fff', color: playing ? '#fff' : '#111' }}>{playing ? 'ADJOURN' : 'CONVENE'}</button>
            </div>
            <p className="lb-ipod-cap">CORPORATE LISTENING DEVICE · MODEL LB-01<br />DO NOT OPERATE DURING ALL-HANDS</p>
          </div>

          {/* CB-16 chassis */}
          <div className="lb-chassis">
            <div className="lb-rack">
              <div className="lb-rack-plate"><b>Circle Back<sup>®</sup></b><span>CB-16</span></div>
              <div className="lb-rack-readout"><span>THE INSTRUMENT REPORTS TO THE DEVICE. STRIKE A KEY.</span></div>
              <div className="lb-rack-cal"><span>CAL. A · 112 BPM</span></div>
            </div>
            <div className="lb-bay lb-bay-keys">
              <div className="lb-bay-head"><b>The keys</b><span>HOTKEYS 1—V</span></div>
              <KeyPlate columns={4}>
                {PADS.map((p, i) => <Pad key={i} index={String(i + 1).padStart(2, '0')} hotkey={KEYS[i]} name={p.name} hot={padHot === i} onTrigger={() => trigger(i, p.line)} />)}
              </KeyPlate>
            </div>
            <div className="lb-bay">
              <div className="lb-bay-head"><b>The minutes</b><span>CLICK CYCLES · DRAG PAINTS</span></div>
              <div className="lb-seq-scroll">
                <StepGrid voices={VOICES} steps={16} pattern={pattern} onChange={setPattern}
                  playhead={playing ? pos : null} selected={selRow} onSelect={setSelRow} voxLabels={voxLabels} />
              </div>
              <div className="lb-bay-foot">
                <span>EVERYTHING IS GENERATED IN YOUR BROWSER. NOTHING IS SENT ANYWHERE.</span>
                <a href="../">Open the full studio →</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Beat */}
      <div className="lb-daily">
        <div className="lb-daily-tab"><span>THE DAILY BEAT</span></div>
        <div className="lb-daily-mid">
          <p className="lb-daily-kicker">Business</p>
          <h2 className="lb-daily-h2">Local man announces promotion with the bravery of a wartime correspondent.</h2>
          <span className="lb-daily-quote">"I couldn't have done it without the team," confirms man who absolutely could have.</span>
        </div>
        <div className="lb-daily-stat">
          <b>14,208</b>
          <span>IMPRESSIONS</span>
          <small>3 people read it</small>
        </div>
      </div>

      {/* Wrapped */}
      <div id="wrapped-3" className="lb-wrapped">
        <div className="lb-wrapped-head">
          <p>Your professional listening habits</p>
          <h2>You posted.<br />The algorithm endured.</h2>
          <span>Turn a profile into a brutally shareable year-in-review.</span>
        </div>
        <div className="lb-wrapped-tabs">
          {Object.keys(PERSONAS).map(k => {
            const on = persona === k;
            return <button key={k} className="lb-wrapped-tab" onClick={() => setPersona(k)}
              style={{ background: on ? '#0a66c2' : '#fff', color: on ? '#fff' : '#111' }}>{PERSONAS[k].name} mode</button>;
          })}
        </div>
        <div className="lb-wrapped-card">
          <div className="lb-wrapped-cardhead"><span>LINKEDIN BEATS <b>WRAPPED</b></span><span>JAN—DEC 2026</span></div>
          <div className="lb-wrapped-title">
            <small>YOUR UNOFFICIAL TITLE</small>
            <h3>{P.title}</h3>
          </div>
          <div className="lb-wrapped-grid">
            <div className="lb-wstat"><small>POSTS PUBLISHED</small><b>{P.posts}</b><span>That is between you and HR.</span></div>
            <div className="lb-wstat"><small>HUMBLE / BRAG RATIO</small><b>{P.humble}</b><span>A delicate balance.</span></div>
            <div className="lb-wstat"><small>DRAMATIC LINE BREAKS</small><b>{P.lines}</b><span>One.<br />Word.<br />At. A. Time.</span></div>
            <div className="lb-wstat"><small>WORD OF THE YEAR</small><b className="w40">"{P.word}"</b><span>Used with extraordinary courage.</span></div>
          </div>
          <div className="lb-wrapped-foot">
            <span>TOP 0.4% OF PEOPLE WHO SAID "AUTHENTIC"</span>
            <button onClick={() => copy('Apparently I am a ' + P.title + '. This explains a lot. https://linkedinbeats.com')}>Share my results ↗</button>
          </div>
        </div>
      </div>

      {/* Cringe Bingo */}
      <div id="bingo-3" className="lb-bingo">
        <div className="lb-bingo-l">
          <p className="lb-bingo-kicker">Play along during your next scroll</p>
          <h2 className="lb-bingo-h2">LINKEDIN<br /><i>CRINGE</i><br />BINGO.</h2>
          <p className="lb-bingo-lede">Tap what you see. Get four in a row. Send the evidence to the group chat that keeps you employed.</p>
          <div className="lb-bingo-btns">
            <button className="lb-score-btn" onClick={() => setScoreOpen(o => !o)}>Score someone's post ▸</button>
            <button className="lb-clear-btn" onClick={clearC}>Clear the evidence ×</button>
          </div>
          {scoreOpen &&
            <div className="lb-intake">
              <p>EXHIBIT INTAKE · PASTE THE POST IN QUESTION</p>
              <textarea value={postText} onChange={e => setPostText(e.target.value)} rows={5} placeholder="Paste their post here. You know the one." />
              <div className="lb-intake-row">
                <button className="lb-detect-btn" onClick={runDetection}>Run the detection ▸</button>
                {scored && <>
                  <button className="lb-intake-alt solid" onClick={downloadBingo}>Download comment card ↓</button>
                  <button className="lb-intake-alt ghost" onClick={copyCaption}>Copy the caption</button>
                </>}
              </div>
              {scored && <p className="lb-intake-note">DETECTED {countC}/16 · MARKED ON THE GRID → ATTACH THE CARD AS YOUR COMMENT. THAT IS THE WHOLE MOVE.</p>}
            </div>}
        </div>
        <div className="lb-bingo-r">
          <div className="lb-card">
            <div className="lb-card-free"><span>FREE SPACE:</span><b>"I asked AI to make this sound human."</b></div>
            <div className="lb-card-grid">
              {BINGO.map((label, i) => {
                const on = checkedC[i];
                return <button key={i} className="lb-cell" onClick={() => setCheckedC(a => { const n = a.slice(); n[i] = !n[i]; return n; })}
                  style={{ background: on ? '#0a66c2' : '#fff', color: on ? '#fff' : '#111' }}>
                  <b className="lb-cell-mark" style={{ opacity: on ? .88 : 0 }}>✓</b>
                  <span className="lb-cell-label">{label}</span></button>;
              })}
            </div>
          </div>
          <button className="lb-share-card" onClick={shareBingoC}>Share my card <span className="n">{countC}</span> ↗</button>
        </div>
      </div>

      {/* Barry interlude */}
      <div className="lb-barry">
        <img src="../barry/barry.png" alt="Barry, the company pigeon, wearing a top hat and a conference lanyard" />
        <div>
          <p className="lb-barry-kicker">Barry (Compliance) has reviewed your work</p>
          <h2 className="lb-barry-h2">He would like a word.</h2>
        </div>
        <button className="lb-barry-btn" onClick={openRoast}>Get your roast receipt →</button>
      </div>

      {/* Merch */}
      <div id="merch-3" className="lb-merch">
        <div className="lb-merch-head">
          <div>
            <p className="lb-merch-kicker">Office supplies for the spiritually tired</p>
            <h2 className="lb-merch-h2">Wear your<br />boundaries.</h2>
          </div>
          <div>
            <p className="lb-merch-lede">Real merch for surviving fake urgency. Designed for Slack huddles, airport lounges, and all-hands meetings that could have been a GIF.</p>
            <a className="lb-shop-btn" href="../store/">Shop career apparel ↗</a>
          </div>
        </div>
        <div className="lb-products">
          <a className="lb-product" href="../store/">
            <div className="lb-product-art tee"><i className="lb-silhouette lb-sil-tee"></i><span>DEEPLY<br />HUMBLED</span></div>
            <div className="lb-product-info"><span><b className="name">DEEPLY HUMBLED TEE</b><span>100% cotton. 0% humility.</span></span><b className="price">$32</b></div>
            <span className="lb-product-cart">Add to career cart +</span>
          </a>
          <a className="lb-product" href="../store/">
            <div className="lb-product-art cap"><i className="lb-silhouette lb-sil-cap-a"></i><i className="lb-silhouette lb-sil-cap-b"></i><span>CIRCLE<br />BACK</span></div>
            <div className="lb-product-info"><span><b className="name">CIRCLE BACK CAP</b><span>Adjustable. Like the deadline.</span></span><b className="price">$28</b></div>
            <span className="lb-product-cart">Add to career cart +</span>
          </a>
          <a className="lb-product" href="../store/">
            <div className="lb-product-art tote"><i className="lb-silhouette lb-sil-tote"></i><span className="sm">PER MY<br />LAST EMAIL</span></div>
            <div className="lb-product-info"><span><b className="name">PER MY LAST EMAIL TOTE</b><span>Carries 14 unanswered follow-ups.</span></span><b className="price">$24</b></div>
            <span className="lb-product-cart">Add to career cart +</span>
          </a>
        </div>
      </div>

      {/* Final CTA */}
      <div className="lb-cta">
        <span className="lb-cta-glyph a">↗</span>
        <span className="lb-cta-glyph b">↗</span>
        <p>Know someone who needs this?</p>
        <h2>Stage a professional<br />intervention.</h2>
        <button className="lb-cta-btn" onClick={sendCoworker}>Send to a coworker <span>↗</span></button>
        <small>Anonymous-ish. Loving-ish. Extremely shareable.</small>
      </div>

      {/* footer */}
      <footer className="lb-foot">
        <span className="lb-foot-wordmark">LinkedIn <b className="lb-beats-chip">Beats</b><span className="lb-cursor">▮</span></span>
        <span className="lb-foot-disclaimer">We make professional networking slightly less professional. Not affiliated with your network.</span>
        <Stamp>Humbled — Allegedly</Stamp>
      </footer>
    </div>
  </div>;
}
