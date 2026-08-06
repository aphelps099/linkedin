/* @ds-bundle: {"format":4,"namespace":"CircleBackDesignSystem_7570bb","components":[{"name":"Monitor","sourcePath":"components/broadcast/Monitor.jsx"},{"name":"Bay","sourcePath":"components/chassis/Bay.jsx"},{"name":"Masthead","sourcePath":"components/chassis/Masthead.jsx"},{"name":"Readout","sourcePath":"components/chassis/Readout.jsx"},{"name":"Silk","sourcePath":"components/chassis/Silk.jsx"},{"name":"Stamp","sourcePath":"components/chassis/Stamp.jsx"},{"name":"Ticker","sourcePath":"components/chassis/Ticker.jsx"},{"name":"Unit","sourcePath":"components/chassis/Unit.jsx"},{"name":"Button","sourcePath":"components/controls/Button.jsx"},{"name":"Kbd","sourcePath":"components/controls/Kbd.jsx"},{"name":"Knob","sourcePath":"components/controls/Knob.jsx"},{"name":"Scrubber","sourcePath":"components/controls/Scrubber.jsx"},{"name":"Pad","sourcePath":"components/pads/Pad.jsx"},{"name":"KeyPlate","sourcePath":"components/pads/Pad.jsx"},{"name":"MAX_WORDS","sourcePath":"components/remix/RemixPanel.jsx"},{"name":"RemixPanel","sourcePath":"components/remix/RemixPanel.jsx"},{"name":"StepGrid","sourcePath":"components/sequencer/StepGrid.jsx"},{"name":"ArrowKey","sourcePath":"components/stage/ArrowKey.jsx"},{"name":"Backdrop","sourcePath":"components/stage/Backdrop.jsx"},{"name":"CommentCards","sourcePath":"components/stage/CommentCards.jsx"},{"name":"StageKey","sourcePath":"components/stage/StageKey.jsx"}],"sourceHashes":{"components/broadcast/Monitor.jsx":"7accb6fc111b","components/chassis/Bay.jsx":"d4401ba50194","components/chassis/Masthead.jsx":"c29db207bb6b","components/chassis/Readout.jsx":"1f51950e9a29","components/chassis/Silk.jsx":"88946fab0f72","components/chassis/Stamp.jsx":"a37fc19c4289","components/chassis/Ticker.jsx":"4bcd3b19895c","components/chassis/Unit.jsx":"b48d75f081e1","components/controls/Button.jsx":"e4d0914d0088","components/controls/Kbd.jsx":"0521328ecd62","components/controls/Knob.jsx":"e2a80d5749d1","components/controls/Scrubber.jsx":"16f97aac4106","components/pads/Pad.jsx":"5784b7d36dbd","components/remix/RemixPanel.jsx":"50b46895c148","components/sequencer/StepGrid.jsx":"9057229c2c51","components/stage/ArrowKey.jsx":"0161e1452839","components/stage/Backdrop.jsx":"38acd8ab73c7","components/stage/CommentCards.jsx":"cecf2d0dfcc5","components/stage/StageKey.jsx":"2a6395644a7f","doc-page.js":"371bab66f42d","ui_kits/circleback/data.js":"39cb3defc5dc","ui_kits/circleback/stage.jsx":"46838563ecc1","ui_kits/circleback/studio.jsx":"bf34c6ec6f06","ui_kits/lessons/data.js":"21839c4f4e6b","ui_kits/lessons/screens.jsx":"b5269b105084","ui_kits/museum/data.js":"b215c25aa6b6","ui_kits/museum/screens.jsx":"417ee54dd66f","ui_kits/roast/data.js":"a0afd37c7f7a","ui_kits/roast/markup.jsx":"4a654ab55f78","ui_kits/roast/screens.jsx":"580dea209d87"},"inlinedExternals":[],"unexposedExports":[{"name":"wordCount","sourcePath":"components/remix/RemixPanel.jsx"}]} */

(() => {

const __ds_ns = (window.CircleBackDesignSystem_7570bb = window.CircleBackDesignSystem_7570bb || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/broadcast/Monitor.jsx
try { (() => {
/** The broadcast monitor — the 1080×1080 square that gets posted to the feed.
 *  Corporate blue field, white masthead rule, the triggered phrase in monumental type,
 *  a beat ribbon of white-outlined squares with a light-blue playhead frame, an equalizer
 *  off the master bus, engagement counters, and the HR stamp.
 *  A cosmetic DOM recreation of the product's live canvas — same vocabulary, no WebAudio. */
function Monitor({
  logo = 'Circle Back',
  mark = '®',
  meta = 'Form CB-16 · Rev. 2026-08',
  phrase = 'Humbled and honored to share',
  beats = [],
  playhead = null,
  levels,
  reactions,
  reposts,
  comments,
  stamp = 'Approved — HR',
  glass,
  style
}) {
  const eq = levels || [.22, .5, .34, .78, .46, .92, .61, .38, .7, .28, .55, .41, .84, .3, .48, .19];
  const n = beats.length || 16;
  const row = beats.length ? beats : Array.from({
    length: 16
  }, (_, i) => i % 4 === 0 ? 2 : i % 2 ? 0 : 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: '1/1',
      width: '100%',
      containerType: 'inline-size',
      background: 'var(--blue)',
      color: 'var(--text-invert)',
      fontFamily: 'var(--sans)',
      padding: '5.4%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '3.4%',
      border: glass ? '1px solid var(--on-blue-42)' : 'none',
      backdropFilter: glass ? 'var(--stage-glass)' : undefined,
      WebkitBackdropFilter: glass ? 'var(--stage-glass)' : undefined,
      boxShadow: glass ? 'var(--stage-lift)' : undefined,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 12,
      borderBottom: 'var(--rule-heavy) solid var(--text-invert)',
      paddingBottom: '2%'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'clamp(13px, 3.1cqw, 30px)',
      fontWeight: 700,
      letterSpacing: '-.02em'
    }
  }, logo, /*#__PURE__*/React.createElement("sup", {
    style: {
      fontSize: '.5em',
      verticalAlign: '.9em'
    }
  }, mark)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'clamp(7px, 1.5cqw, 15px)',
      fontWeight: 700,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      opacity: .82
    }
  }, meta)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'clamp(9px, 1.6cqw, 16px)',
      fontWeight: 700,
      letterSpacing: '.16em',
      textTransform: 'uppercase',
      opacity: .72,
      marginBottom: '2.5%'
    }
  }, "Now playing"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'clamp(20px, 6.4cqw, 66px)',
      fontWeight: 700,
      letterSpacing: '-.045em',
      lineHeight: .94,
      textWrap: 'pretty'
    }
  }, phrase, /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--white)',
      color: 'var(--blue)',
      padding: '0 .12em',
      marginLeft: '.14em'
    }
  }, "\u25AE"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '.9%',
      height: '9%',
      alignItems: 'flex-end'
    }
  }, eq.map((v, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      flex: 1,
      height: `${Math.max(8, v * 100)}%`,
      background: 'var(--white)',
      opacity: .9
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${n},1fr)`,
      gap: '.9%'
    }
  }, row.map((v, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      aspectRatio: '1/1',
      border: '2px solid var(--white)',
      background: v === 2 ? 'var(--white)' : v === 1 ? 'rgba(255,255,255,.42)' : 'transparent',
      boxShadow: i === playhead ? 'inset 0 0 0 3px var(--blue-light)' : 'none'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: 12,
      borderTop: 'var(--rule-frame) solid var(--on-blue-42)',
      paddingTop: '2%'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: '6%',
      fontFamily: 'var(--mono)',
      fontSize: 'clamp(8px, 1.7cqw, 17px)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, reactions !== undefined && /*#__PURE__*/React.createElement("span", null, reactions.toLocaleString(), " reactions"), reposts !== undefined && /*#__PURE__*/React.createElement("span", null, reposts, " reposts"), comments !== undefined && /*#__PURE__*/React.createElement("span", null, comments, " comments")), stamp && /*#__PURE__*/React.createElement("span", {
    style: {
      border: '2px solid var(--white)',
      color: 'var(--text-invert)',
      fontWeight: 700,
      fontSize: 'clamp(7px, 1.4cqw, 14px)',
      letterSpacing: '.2em',
      textTransform: 'uppercase',
      padding: '.5em .8em',
      transform: 'rotate(-4deg)',
      flex: 'none'
    }
  }, stamp)));
}
Object.assign(__ds_scope, { Monitor });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/broadcast/Monitor.jsx", error: String((e && e.message) || e) }); }

// components/chassis/Masthead.jsx
try { (() => {
/** Masthead: logo left, uppercase meta items right, 3px rule below. */
function Masthead({
  logo = 'Circle Back',
  mark = '®',
  meta = [],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 16,
      borderBottom: 'var(--rule-heavy) solid var(--ink)',
      paddingBottom: 10,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--logo-size)',
      fontWeight: 700,
      letterSpacing: '-.02em'
    }
  }, logo, mark ? /*#__PURE__*/React.createElement("sup", {
    style: {
      fontSize: 9,
      verticalAlign: 10
    }
  }, mark) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 'var(--space-meta)',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      fontSize: 'var(--label-size)',
      fontWeight: 'var(--label-weight)',
      letterSpacing: 'var(--label-tracking-meta)',
      textTransform: 'uppercase'
    }
  }, meta.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, m))));
}
Object.assign(__ds_scope, { Masthead });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chassis/Masthead.jsx", error: String((e && e.message) || e) }); }

// components/chassis/Readout.jsx
try { (() => {
/** Mono tabular value text — IBM Plex Mono, blue by default. */
function Readout({
  children,
  ink,
  light,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--readout-size)',
      color: light ? 'var(--blue-light)' : ink ? 'var(--ink)' : 'var(--blue)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Readout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chassis/Readout.jsx", error: String((e && e.message) || e) }); }

// components/chassis/Silk.jsx
try { (() => {
/** House label: 9.5px uppercase, .16em tracking, bold ink. blue/muted/light variants. */
function Silk({
  children,
  blue,
  muted,
  light,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--label-size)',
      letterSpacing: 'var(--label-tracking)',
      textTransform: 'uppercase',
      fontWeight: 'var(--label-weight)',
      fontFamily: 'var(--sans)',
      color: light ? 'var(--text-invert)' : blue ? 'var(--blue)' : muted ? 'var(--text-meta)' : 'var(--ink)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Silk });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chassis/Silk.jsx", error: String((e && e.message) || e) }); }

// components/chassis/Bay.jsx
try { (() => {
/** Column section: 2px rule on top, uppercase title left, blue aside right. */
function Bay({
  title,
  aside,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, (title || aside !== undefined) && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: 'var(--rule-section) solid var(--ink)',
      paddingTop: 7,
      marginBottom: 'var(--space-head)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Silk, null, title), aside !== undefined && (typeof aside === 'string' || typeof aside === 'number' ? /*#__PURE__*/React.createElement(__ds_scope.Silk, {
    blue: true
  }, aside) : aside)), children);
}
Object.assign(__ds_scope, { Bay });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chassis/Bay.jsx", error: String((e && e.message) || e) }); }

// components/chassis/Stamp.jsx
try { (() => {
/** Rotated rubber-stamp seal: "Approved — HR". The bureaucratic conceit, in one element. */
function Stamp({
  children = 'Approved — HR',
  ink,
  angle = -4,
  style
}) {
  const c = ink ? 'var(--ink)' : 'var(--blue)';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      border: `2px solid ${c}`,
      color: c,
      fontWeight: 700,
      fontSize: 10,
      letterSpacing: '.2em',
      textTransform: 'uppercase',
      padding: '6px 10px',
      transform: `rotate(${angle}deg)`,
      fontFamily: 'var(--sans)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Stamp });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chassis/Stamp.jsx", error: String((e && e.message) || e) }); }

// components/chassis/Ticker.jsx
try { (() => {
/** Blue ticker bar: white chip label + uppercase mono text + block cursor. The phrase display. */
function Ticker({
  label = 'Now playing',
  children,
  cursor = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--blue)',
      color: 'var(--text-invert)',
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      padding: '13px 16px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--ticker-chip-size)',
      fontWeight: 700,
      letterSpacing: 'var(--ticker-chip-tracking)',
      textTransform: 'uppercase',
      background: 'var(--white)',
      color: 'var(--blue)',
      padding: '3px 6px',
      flex: 'none'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 'var(--ticker-size)',
      letterSpacing: '.03em',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textTransform: 'uppercase'
    }
  }, children, cursor && /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--white)',
      color: 'var(--blue)',
      padding: '0 3px',
      marginLeft: 6
    }
  }, "\u25AE")));
}
Object.assign(__ds_scope, { Ticker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chassis/Ticker.jsx", error: String((e && e.message) || e) }); }

// components/chassis/Unit.jsx
try { (() => {
/** The paper sheet: page container with house padding, paper background, Helvetica. One per screen. */
function Unit({
  children,
  narrow,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 'var(--page-max)',
      margin: '0 auto',
      background: 'var(--surface-page)',
      color: 'var(--text-body)',
      fontFamily: 'var(--sans)',
      WebkitFontSmoothing: 'antialiased',
      padding: narrow ? 'var(--space-page-y-narrow) var(--space-page-x-narrow)' : 'var(--space-page-y) var(--space-page-x)',
      boxSizing: 'border-box',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Unit });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chassis/Unit.jsx", error: String((e && e.message) || e) }); }

// components/controls/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Flat Swiss button: white, 1.5px ink border, uppercase label.
 *  Hover AND press invert to ink; latched = blue fill (rec latches ink); tone="light" for the blue stage. */
function Button({
  on,
  variant = 'default',
  tone = 'ink',
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const light = tone === 'light';
  let bg = light ? 'transparent' : 'var(--white)',
    color = light ? 'var(--text-invert)' : 'var(--ink)',
    border = light ? 'var(--text-invert)' : 'var(--ink)';
  if (on && variant === 'rec') {
    bg = 'var(--ink)';
    color = 'var(--text-invert)';
    border = 'var(--ink)';
  } else if (on) {
    bg = light ? 'var(--white)' : 'var(--blue)';
    color = light ? 'var(--blue)' : 'var(--text-invert)';
    border = light ? 'var(--white)' : 'var(--blue)';
  } else if (press || hover) {
    bg = light ? 'var(--white)' : 'var(--ink)';
    color = light ? 'var(--blue)' : 'var(--text-invert)';
  }
  return /*#__PURE__*/React.createElement("button", _extends({}, rest, {
    type: rest.type || 'button',
    onMouseEnter: e => {
      setHover(true);
      rest.onMouseEnter && rest.onMouseEnter(e);
    },
    onMouseLeave: e => {
      setHover(false);
      setPress(false);
      rest.onMouseLeave && rest.onMouseLeave(e);
    },
    onMouseDown: e => {
      setPress(true);
      rest.onMouseDown && rest.onMouseDown(e);
    },
    onMouseUp: e => {
      setPress(false);
      rest.onMouseUp && rest.onMouseUp(e);
    },
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 'var(--label-size)',
      letterSpacing: 'var(--label-tracking)',
      textTransform: 'uppercase',
      fontWeight: 700,
      color,
      background: bg,
      border: `var(--rule-frame) solid ${border}`,
      borderRadius: 0,
      padding: 'var(--btn-pad)',
      cursor: 'pointer',
      transition: 'background var(--ease-ui), color var(--ease-ui)',
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Button.jsx", error: String((e && e.message) || e) }); }

// components/controls/Kbd.jsx
try { (() => {
/** Keyboard key chip used in hint prose. */
function Kbd({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("kbd", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10.5,
      background: 'var(--white)',
      border: '1px solid var(--ink)',
      borderBottomWidth: 2,
      padding: '1px 5px',
      color: 'var(--ink)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Kbd });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Kbd.jsx", error: String((e && e.message) || e) }); }

// components/controls/Knob.jsx
try { (() => {
/** Register dial: flat gauge, 1.5px ink ring, blue needle; label + blue mono value beside it.
 *  Drag up/down (180px = full range); shift = 0.4x fine; dbl-click = reset; wheel = ±3%. */
function Knob({
  label,
  value,
  defaultValue = .5,
  onChange,
  format,
  style
}) {
  const [inner, setInner] = React.useState(defaultValue);
  const v = value !== undefined ? value : inner;
  const set = x => {
    const nv = Math.min(1, Math.max(0, x));
    if (value === undefined) setInner(nv);
    onChange && onChange(nv);
  };
  const drag = React.useRef(null);
  const fmt = format || (x => Math.round(x * 100) + '%');
  const deg = -135 + v * 270;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'center',
      userSelect: 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'var(--dial-size)',
      height: 'var(--dial-size)',
      borderRadius: '50%',
      border: 'var(--rule-frame) solid var(--ink)',
      position: 'relative',
      background: 'var(--white)',
      flex: 'none',
      cursor: 'ns-resize',
      touchAction: 'none'
    },
    onPointerDown: e => {
      drag.current = {
        y: e.clientY,
        v
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    onPointerMove: e => {
      if (!drag.current) return;
      const fine = e.shiftKey ? .4 : 1;
      set(drag.current.v + (drag.current.y - e.clientY) / 180 * fine);
    },
    onPointerUp: () => drag.current = null,
    onPointerCancel: () => drag.current = null,
    onDoubleClick: () => set(defaultValue),
    onWheel: e => {
      e.preventDefault();
      set(v - Math.sign(e.deltaY) * .03);
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 2,
      height: 'calc(var(--dial-size)/2 - 8px)',
      background: 'var(--blue)',
      transformOrigin: '50% 0',
      transform: `rotate(${deg + 180}deg)`,
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 6,
      height: 6,
      margin: -3,
      borderRadius: '50%',
      background: 'var(--ink)',
      display: 'block'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(__ds_scope.Silk, null, label)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Readout, null, fmt(v)))));
}
Object.assign(__ds_scope, { Knob });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Knob.jsx", error: String((e && e.message) || e) }); }

// components/controls/Scrubber.jsx
try { (() => {
/** Horizontal scrubber — a ruled track that fills as you drag. Reads as a bureaucratic gauge.
 *  tone="light" renders it white-on-blue for the stage. */
function Scrubber({
  label,
  value = 0,
  onChange,
  format,
  tone = 'ink',
  style
}) {
  const ref = React.useRef(null);
  const [drag, setDrag] = React.useState(false);
  const light = tone === 'light';
  const ink = light ? 'var(--text-invert)' : 'var(--ink)';
  const fill = light ? 'var(--text-invert)' : 'var(--blue)';
  const fmt = format || (v => Math.round(v * 100) + '%');
  const set = clientX => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onChange && onChange(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      userSelect: 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--label-size)',
      letterSpacing: 'var(--label-tracking)',
      textTransform: 'uppercase',
      fontWeight: 700,
      color: ink
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 'var(--readout-size)',
      fontVariantNumeric: 'tabular-nums',
      color: light ? 'var(--blue-light)' : 'var(--blue)'
    }
  }, fmt(value))), /*#__PURE__*/React.createElement("div", {
    ref: ref,
    role: "slider",
    tabIndex: 0,
    "aria-label": label,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": Math.round(value * 100),
    onPointerDown: e => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag(true);
      set(e.clientX);
    },
    onPointerMove: e => {
      if (drag) set(e.clientX);
    },
    onPointerUp: () => setDrag(false),
    onPointerCancel: () => setDrag(false),
    onKeyDown: e => {
      const d = e.shiftKey ? .01 : .05;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        onChange && onChange(Math.min(1, value + d));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        onChange && onChange(Math.max(0, value - d));
      }
    },
    style: {
      position: 'relative',
      height: 26,
      border: `var(--rule-frame) solid ${ink}`,
      background: light ? 'transparent' : 'var(--white)',
      cursor: 'ew-resize',
      touchAction: 'none',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: `${value * 100}%`,
      background: fill
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: `${value * 100}%`,
      top: -4,
      bottom: -4,
      width: 3,
      marginLeft: -1.5,
      background: light ? 'var(--blue-light)' : 'var(--ink)'
    }
  })));
}
Object.assign(__ds_scope, { Scrubber });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Scrubber.jsx", error: String((e && e.message) || e) }); }

// components/pads/Pad.jsx
try { (() => {
/** Phrase key: flat white cell, blue mono index top-left, keyboard letter top-right,
 *  bold name bottom; fills blue when hot/pressed (130ms flash on trigger). Compose inside KeyPlate. */
function Pad({
  name,
  index,
  hotkey,
  hot,
  onTrigger,
  style
}) {
  const [hit, setHit] = React.useState(false);
  const fire = () => {
    setHit(true);
    setTimeout(() => setHit(false), 130);
    onTrigger && onTrigger();
  };
  const active = hot || hit;
  return /*#__PURE__*/React.createElement("div", {
    tabIndex: 0,
    role: "button",
    "aria-label": name,
    onPointerDown: e => {
      e.preventDefault();
      fire();
    },
    onKeyDown: e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        fire();
      }
    },
    style: {
      aspectRatio: 'var(--key-ratio)',
      border: 'var(--rule-inner) solid var(--ink)',
      padding: '9px 11px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: active ? 'var(--blue)' : 'var(--white)',
      cursor: 'pointer',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
      transition: 'background var(--ease-ui)',
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, index !== undefined && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontWeight: 500,
      fontSize: 'var(--key-ix-size)',
      color: active ? 'var(--text-invert)' : 'var(--blue)'
    }
  }, index), hotkey !== undefined && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontWeight: 700,
      fontSize: 10.5,
      padding: '0 4px',
      border: `1px solid ${active ? '#fff' : 'var(--hair)'}`,
      color: active ? 'var(--text-invert)' : 'var(--text-meta)'
    }
  }, hotkey)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--key-name-size)',
      fontWeight: 700,
      letterSpacing: '-.01em',
      color: active ? 'var(--text-invert)' : 'var(--ink)'
    }
  }, name));
}

/** Collapsed-border grid frame for Pads: 1.5px outer border, keys carry .75px separators. */
function KeyPlate({
  children,
  columns = 4,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns},1fr)`,
      gap: 0,
      border: 'var(--rule-frame) solid var(--ink)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Pad, KeyPlate });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pads/Pad.jsx", error: String((e && e.message) || e) }); }

// components/remix/RemixPanel.jsx
try { (() => {
const MAX_WORDS = 400;
const wordCount = t => String(t || '').trim() ? String(t).trim().split(/\s+/).length : 0;
const SAMPLE = `I'm humbled and honored to share that after careful reflection, I've decided to pursue new opportunities.

It's been a wild ride. When I joined, we were a scrappy team of three in a fast-paced environment. Today we're a category-defining ecosystem.

Here's what I learned: it's not about the tools. It's about the mindset.

Most people won't understand this. But you will.

Grateful for this incredible journey and the amazing team who made it possible. Onwards and upwards! 🚀

Let's connect and explore synergies. Thoughts? 👇

#thoughtleadership #synergy #opentowork`;

/** The front door: paste a post, get a remix. Everything happens in the browser. */
function RemixPanel({
  onRemix,
  onClose,
  result,
  narrow,
  initial
}) {
  const [text, setText] = React.useState(initial || '');
  const words = wordCount(text);
  const over = words > MAX_WORDS;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--white)',
      color: 'var(--ink)',
      border: 'var(--rule-frame) solid var(--ink)',
      padding: narrow ? 'var(--card-pad-narrow)' : 'var(--card-pad)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: narrow ? 20 : 24,
      fontWeight: 700,
      letterSpacing: '-.03em'
    }
  }, "Build your remix"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '.16em',
      textTransform: 'uppercase',
      color: 'var(--text-meta)'
    }
  }, "Paste a post \xB7 ", MAX_WORDS, " words \xB7 never leaves your browser")), /*#__PURE__*/React.createElement("textarea", {
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: "Paste your LinkedIn post here. Yours works best.",
    rows: narrow ? 7 : 9,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      resize: 'vertical',
      padding: 12,
      fontFamily: 'var(--sans)',
      fontSize: 14,
      lineHeight: 1.5,
      border: 'var(--rule-frame) solid var(--ink)',
      borderRadius: 0,
      background: 'var(--paper)',
      color: 'var(--ink)',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    onClick: () => onRemix && onRemix(text),
    style: {
      padding: 'var(--btn-pad-lg)'
    }
  }, "Remix it"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    onClick: () => setText(SAMPLE)
  }, "Use an example"), text && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    onClick: () => setText('')
  }, "Clear"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--mono)',
      fontSize: 10.5,
      color: over ? 'var(--blue)' : 'var(--text-meta)'
    }
  }, words, "/", MAX_WORDS, " words", over ? ' · trimmed to 400' : ''), onClose && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    onClick: onClose
  }, "Close")), result && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: 'var(--rule-section) solid var(--ink)',
      paddingTop: 14,
      display: 'grid',
      gridTemplateColumns: narrow ? '1fr' : '190px 1fr',
      gap: 18,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: 'var(--rule-frame) solid var(--blue)',
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '.16em',
      textTransform: 'uppercase',
      color: 'var(--text-meta)'
    }
  }, "Thought Leadership Index"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--score-size)',
      fontWeight: 700,
      letterSpacing: '-.05em',
      lineHeight: 1,
      color: 'var(--blue)',
      margin: '6px 0 4px'
    }
  }, result.score), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, result.rank)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, (result.markers || []).slice(0, 6).map(m => /*#__PURE__*/React.createElement("span", {
    key: m.label,
    style: {
      border: '1px solid var(--hair)',
      padding: '4px 7px',
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '.1em',
      textTransform: 'uppercase'
    }
  }, m.label, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--blue)',
      fontFamily: 'var(--mono)'
    }
  }, m.count))), !(result.markers || []).length && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-meta)'
    }
  }, "No detectable thought leadership. Suspicious.")), (result.translations || []).length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '.16em',
      textTransform: 'uppercase',
      color: 'var(--text-meta)',
      marginBottom: 5
    }
  }, "What it says \xB7 What it means"), result.translations.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 12.5,
      lineHeight: 1.7,
      borderBottom: '1px dotted var(--hair)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--blue)',
      fontWeight: 700
    }
  }, "\u2192 "), t))))));
}
Object.assign(__ds_scope, { MAX_WORDS, wordCount, RemixPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/remix/RemixPanel.jsx", error: String((e && e.message) || e) }); }

// components/sequencer/StepGrid.jsx
try { (() => {
/** Sequencer as a ruled Swiss table: 1px ink grid, blue = hit, ink = accent,
 *  vox rows print 2-letter phrase codes. Click cycles, drag paints. */
function StepGrid({
  voices,
  steps = 16,
  pattern,
  onChange,
  playhead = null,
  selected,
  onSelect,
  onClearRow,
  voxLabels,
  labelW = 110
}) {
  const [inner, setInner] = React.useState(() => voices.map(() => Array(steps).fill(0)));
  const pat = pattern || inner;
  const painting = React.useRef(null);
  React.useEffect(() => {
    const up = () => painting.current = null;
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);
  const commit = p => {
    if (!pattern) setInner(p);
    onChange && onChange(p);
  };
  const cycle = (i, s) => {
    const p = pat.map(r => [...r]);
    if (voices[i].vox) {
      p[i][s] = p[i][s] ? 0 : -1;
      painting.current = p[i][s];
    } else {
      p[i][s] = (p[i][s] + 1) % 3;
      painting.current = p[i][s];
    }
    commit(p);
    onSelect && onSelect(i);
  };
  const paint = (i, s) => {
    if (painting.current === null || painting.current === undefined) return;
    if (!!voices[i].vox !== (painting.current < 0 || painting.current === 0)) return;
    const p = pat.map(r => [...r]);
    p[i][s] = painting.current;
    commit(p);
  };
  const border = '1px solid var(--ink)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `${labelW}px repeat(${steps},1fr)`,
      borderTop: border,
      borderLeft: border,
      fontFamily: 'var(--sans)'
    }
  }, voices.map((v, i) => {
    const isSel = selected === i;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => onSelect && onSelect(i),
      onDoubleClick: () => onClearRow && onClearRow(i),
      title: "Double-click to clear this track",
      style: {
        border,
        borderTop: 'none',
        borderLeft: 'none',
        height: 'var(--seq-cell-h)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        fontSize: 'var(--label-size)',
        fontWeight: 700,
        letterSpacing: 'var(--label-tracking-meta)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        userSelect: 'none',
        background: isSel ? 'var(--ink)' : 'var(--white)',
        color: isSel ? 'var(--text-invert)' : 'var(--ink)',
        boxSizing: 'border-box'
      }
    }, v.name), pat[i].map((val, s) => {
      const isPh = s === playhead;
      let bg = 'var(--white)',
        txt = null;
      if (v.vox) {
        if (val) {
          txt = voxLabels && voxLabels[i] && voxLabels[i][s] || '••';
        }
      } else if (val === 2) bg = 'var(--ink)';else if (val === 1) bg = 'var(--blue)';
      return /*#__PURE__*/React.createElement("div", {
        key: s,
        onPointerDown: e => {
          e.preventDefault();
          cycle(i, s);
        },
        onPointerEnter: () => paint(i, s),
        style: {
          border,
          borderTop: 'none',
          borderLeft: 'none',
          height: 'var(--seq-cell-h)',
          cursor: 'pointer',
          touchAction: 'none',
          background: bg,
          boxSizing: 'border-box',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      }, txt && /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 500,
          fontSize: 9,
          fontFamily: 'var(--mono)',
          color: 'var(--blue)'
        }
      }, txt), isPh && /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 0 2px var(--blue-light)',
          pointerEvents: 'none'
        }
      }));
    }));
  }));
}
Object.assign(__ds_scope, { StepGrid });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/sequencer/StepGrid.jsx", error: String((e && e.message) || e) }); }

// components/stage/ArrowKey.jsx
try { (() => {
/** The arcade arrows. Big enough to slap, labelled so nobody has to guess: these change the phrase. */
function ArrowKey({
  dir = 'right',
  hint = 'Change phrase',
  onFire,
  tone = 'light',
  style
}) {
  const [hit, setHit] = React.useState(false);
  const fire = () => {
    setHit(true);
    setTimeout(() => setHit(false), 130);
    onFire && onFire();
  };
  const light = tone === 'light';
  const edge = light ? 'var(--text-invert)' : 'var(--ink)';
  const fillOn = light ? 'var(--text-invert)' : 'var(--blue)';
  const restFg = light ? 'var(--text-invert)' : 'var(--ink)';
  const glyph = dir === 'left' ? '◀' : '▶';
  return /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    "aria-label": `${hint} ${dir}`,
    onPointerDown: e => {
      e.preventDefault();
      fire();
    },
    onKeyDown: e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        fire();
      }
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '14px 10px',
      minHeight: 'var(--stagekey-h)',
      boxSizing: 'border-box',
      border: `var(--rule-section) solid ${hit && !light ? fillOn : edge}`,
      background: hit ? fillOn : light ? 'rgba(255,255,255,.06)' : 'var(--white)',
      color: hit ? light ? 'var(--blue)' : 'var(--text-invert)' : restFg,
      cursor: 'pointer',
      userSelect: 'none',
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent',
      transition: 'background var(--ease-key), color var(--ease-key), border-color var(--ease-key)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 34,
      lineHeight: 1
    }
  }, glyph), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      fontWeight: 700,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      opacity: .85,
      textAlign: 'center'
    }
  }, hint));
}
Object.assign(__ds_scope, { ArrowKey });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/stage/ArrowKey.jsx", error: String((e && e.message) || e) }); }

// components/stage/Backdrop.jsx
try { (() => {
const GLYPHS = '·—▮▯|/\\=+:';

/** The room the stage stands in: a flat corporate-blue field with a sparse monospace character
 *  texture, a gradient ramp that burns brightest behind the monitor, and a film of grain.
 *  Fixed, aria-hidden, pointer-events none — it is texture, not type. */
function Backdrop({
  cell = 76,
  alpha = .3,
  grain = .085,
  focusRef
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let raf,
      w = 0,
      h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = Math.max(1, Math.round(w));
      cv.height = Math.max(1, Math.round(h));
    };
    resize();
    window.addEventListener('resize', resize);
    const loop = () => {
      const t = performance.now() / 1000;
      ctx.fillStyle = '#0a66c2';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `700 ${cell * .62}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      for (let y = cell / 2; y < h + cell; y += cell) {
        for (let x = cell / 2; x < w + cell; x += cell) {
          const n = Math.sin(x * .017 + t * 1.1) * Math.cos(y * .021 - t * .7);
          if (n < .15) continue;
          ctx.fillText(GLYPHS[Math.floor(Math.abs(n) * GLYPHS.length) % GLYPHS.length], x, y);
        }
      }
      const box = focusRef && focusRef.current ? focusRef.current.getBoundingClientRect() : null;
      const cx = box ? box.left + box.width / 2 : w / 2;
      const cy = box ? box.top + box.height / 2 : h / 2;
      const inner = box ? Math.max(box.width, box.height) * .38 : Math.min(w, h) * .26;
      const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, inner + Math.min(w, h) * .52);
      g.addColorStop(0, 'rgba(10,102,194,0)');
      g.addColorStop(1, 'rgba(10,102,194,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (grain) {
        ctx.fillStyle = `rgba(255,255,255,${grain * .12})`;
        for (let i = 0; i < 900; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [cell, alpha, grain, focusRef]);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: ref,
    "aria-hidden": "true",
    style: {
      position: 'fixed',
      inset: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      pointerEvents: 'none',
      display: 'block'
    }
  });
}
Object.assign(__ds_scope, { Backdrop });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/stage/Backdrop.jsx", error: String((e && e.message) || e) }); }

// components/stage/CommentCards.jsx
try { (() => {
const CARD_H = 104;
const clamp1 = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};
const clamp2 = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
};

/** One comment at a time, in a box of fixed 104px height. Everything inside is clamped so a long
 *  headline can never change the size of the row — the stage must not twitch when the network opines. */
function CommentCards({
  comment,
  narrow,
  style
}) {
  const frame = {
    height: CARD_H,
    boxSizing: 'border-box',
    overflow: 'hidden',
    ...style
  };
  if (!comment) return /*#__PURE__*/React.createElement("div", {
    style: {
      ...frame,
      border: '2px dashed var(--on-blue-22)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '.16em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,.4)'
    }
  }, "Awaiting engagement"));
  const c = comment;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...frame,
      background: 'var(--white)',
      border: '2px solid var(--white)',
      color: 'var(--ink)',
      padding: narrow ? '10px 12px' : '11px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: 'var(--avatar-tint)',
      color: 'var(--blue)',
      flex: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12.5,
      fontWeight: 600
    }
  }, c.initials), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 13.5,
      fontWeight: 600,
      ...clamp1
    }
  }, c.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'rgba(0,0,0,.55)',
      fontWeight: 400
    }
  }, "\xB7 ", c.degree)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 11,
      color: 'rgba(0,0,0,.55)',
      ...clamp1
    }
  }, c.title)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'rgba(0,0,0,.45)',
      fontFamily: 'var(--mono)',
      flex: 'none'
    }
  }, c.age)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      lineHeight: 1.3,
      ...clamp2
    }
  }, c.text), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'rgba(0,0,0,.55)',
      ...clamp1
    }
  }, "Like \xB7 Reply", c.replies ? ` · ${c.replies} replies` : ''), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'rgba(0,0,0,.55)',
      fontFamily: 'var(--mono)',
      flex: 'none'
    }
  }, "\uD83D\uDC4D ", c.likes)));
}
Object.assign(__ds_scope, { CommentCards });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/stage/CommentCards.jsx", error: String((e && e.message) || e) }); }

// components/stage/StageKey.jsx
try { (() => {
/** One of the three performance keys. Big enough to hit in the dark, on a phone, or with an elbow.
 *  tone="light": white outline on the blue stage, fills white when struck.
 *  tone="ink":   ink outline on paper for the studio, fills blue when struck. */
function StageKey({
  label,
  hint,
  caption,
  on,
  onFire,
  tone = 'light',
  style
}) {
  const [hit, setHit] = React.useState(false);
  const fire = () => {
    setHit(true);
    setTimeout(() => setHit(false), 140);
    onFire && onFire();
  };
  const active = on || hit;
  const light = tone === 'light';
  const edge = light ? 'var(--text-invert)' : 'var(--ink)';
  const fill = light ? 'var(--text-invert)' : 'var(--blue)';
  const rest = light ? 'var(--text-invert)' : 'var(--ink)';
  return /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onPointerDown: e => {
      e.preventDefault();
      fire();
    },
    onKeyDown: e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        fire();
      }
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 10,
      padding: '18px 20px',
      minHeight: 'var(--stagekey-h)',
      boxSizing: 'border-box',
      border: `var(--rule-section) solid ${active && !light ? fill : edge}`,
      background: active ? fill : light ? 'transparent' : 'var(--white)',
      color: active ? light ? 'var(--blue)' : 'var(--text-invert)' : rest,
      cursor: 'pointer',
      userSelect: 'none',
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent',
      transition: 'background var(--ease-key), color var(--ease-key), border-color var(--ease-key)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--stagekey-size)',
      fontWeight: 700,
      letterSpacing: '-.03em',
      lineHeight: 1
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 12,
      opacity: .75
    }
  }, hint)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '.16em',
      textTransform: 'uppercase',
      opacity: .8
    }
  }, caption));
}
Object.assign(__ds_scope, { StageKey });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/stage/StageKey.jsx", error: String((e && e.message) || e) }); }

// doc-page.js
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
// Copied omelette starter. Re-running copy_starter_component with this kind overwrites this file with the latest version (page content is unaffected).
/* BEGIN USAGE */
/**
 * <doc-page> — paged-document shell for printable HTML.
 *
 * FIRST, decide how the document paginates — up front, before building:
 *
 * - FLOWING document (the default): write the whole document as one
 *   normal HTML flow inside <doc-page>; the browser's print engine
 *   splits it onto pages at export. Use for long-form documents with a
 *   single text flow: reports, memos, letters, essays.
 * - EXPLICIT pagination: a fixed set of pre-paginated pages, one
 *   <section class="page"> child per page. Use when the user asks for a
 *   specific page count, or the design implies one: a one-page resume, a
 *   two-sided flier, a poster, a certificate, a brochure — any richly
 *   laid-out document without a single text flow.
 * - If in doubt, ask the user as part of the build.
 *
 * PAGE SIZING — paper differs by country (letter vs A4), so the printed
 * sheet is not one fixed truth:
 * - FLOWING documents pin NO paper size: the print engine paginates
 *   onto the user's real paper, and the content reflows to it.
 * - EXPLICITLY PAGINATED documents print each page at a FIXED page box
 *   with overflow hidden — letter by default, size="a4" for a clearly
 *   metric user, the user's chosen paper when they export. Design each
 *   page to FILL that box, fitting letter and A4 alike without overlap.
 * - width/height pin an explicit fixed size, ONLY when the user gives
 *   one.
 * Never write your own @page rule or hard-code paper dimensions in the
 * content.
 *
 * Sizing modes (attributes):
 *   (none)                      — portrait: flowing docs use the user's
 *           paper; explicitly paginated pages use the named size box
 *           (letter unless size="a4")
 *   orientation="landscape"     — the same, landscape
 *   width / height              — explicit fixed size, ONLY when the user
 *           gives one (e.g. width="22in" height="30in" for a 22×30
 *           poster): the page IS the design's size, printed at true
 *           dimensions (or scaled onto the user's paper at print time).
 *           Any absolute CSS length: px/in/mm/cm/pt/pc.
 * The component announces the chosen mode to the host app at runtime (a
 * meta tag it injects), so the print path can inject the user's true
 * paper size.
 *
 * On screen the document renders on a desk background: a flowing
 * document as one tall scrolling sheet (Google Docs' pageless view);
 * explicitly paginated documents as one card per page.
 *
 * EXPLICIT pagination usage:
 *   <style>doc-page:not(:defined){visibility:hidden}</style>
 *   <doc-page>
 *     <section class="page" id="p1">…one page's design…</section>
 *     <section class="page" id="p2">…</section>
 *   </doc-page>
 *   <script src="doc-page.js"></script>
 * How the page box works, concretely: each .page prints as ONE full-bleed
 * sheet at a FIXED physical size — letter by default (set size="a4" for
 * a clearly metric user), the user's chosen paper when they export —
 * with overflow hidden. Nothing scrolls and nothing reflows onto a next
 * sheet: content that misses the box is CLIPPED. Design each page to
 * FILL that page box, and to fit it — letter and A4 alike — without
 * overlap. Each page is a size container; don't size anything in
 * viewport units (they track the window, not the page), and never set
 * width or height on the .page section itself (the component sizes the
 * page box; an authored height like 100% is meaningless at print and is
 * overridden). The component owns the page box, the screen card chrome,
 * and the page breaks (never add your own break-before/after). Don't mix
 * .page sections with flowing content or header/footer slots in the same
 * document.
 *
 * FLOWING usage:
 *   <style>doc-page:not(:defined){visibility:hidden}</style>
 *   <doc-page margin="0.75in">
 *     <h1>Title</h1>
 *     <p>…body…</p>
 *   </doc-page>
 *   <script src="doc-page.js"></script>
 * There is no manual page-splitting — the browser's print engine
 * paginates at export. Standard break-hygiene rules (`break-inside:
 * avoid` on figures, code blocks, images and table rows; `orphans/
 * widows: 3`) are applied so paragraphs and groups split cleanly. On
 * screen and at print, headings default to `text-wrap: balance` and
 * body text to `text-wrap: pretty`; the defaults have zero specificity,
 * so any text-wrap you declare wins.
 *
 * Other attributes:
 *   size    — letter | a4 | legal (default letter). Flowing documents:
 *           preview proportion only — it does NOT pin their printed
 *           paper (the print dialog's paper governs); leave it alone
 *           there. Explicitly paginated documents: it sets the page box
 *           the cards and the pinned @page share (the export dialog's
 *           choice overrides both at print) — set size="a4" for a
 *           clearly metric user. Scaled-fit: names the sheet the fit is
 *           computed against, same a4-for-metric-users advice.
 *   content-width / content-height — the design's own fixed dimensions
 *           (CSS lengths), for scaling a fixed-size design ONTO the
 *           named sheet: content lays out at exactly this size, and the
 *           component scales it to fit that sheet's printable area
 *           (centered horizontally, top-aligned; the export dialog
 *           re-fits to the user's actual paper choice where available).
 *           Both must be set; they do not change the page box. For pages
 *           WITHOUT running header/footer slots.
 *   margin  — printable inset on every page of a FLOWING document
 *           (default 0.75in); margin="0" makes pages full-bleed.
 *           Explicitly paginated pages are always full-bleed.
 *
 * Running header/footer (flowing documents only): give an element
 * `slot="header"` or `slot="footer"` and it repeats on every printed
 * page via `position: fixed`. To keep body text from sliding under it,
 * the component prints inside a single-cell table whose <thead>/<tfoot>
 * are spacers sized to the header/footer height — browsers repeat
 * thead/tfoot on every page, so each sheet's content starts below the
 * header and ends above the footer. On screen the header/footer render
 * once at the top/bottom of the sheet.
 *
 * At print the component injects `@page { margin: 0 }` (which leaves
 * Chrome no margin box to draw its date/URL/page-count header in) and
 * moves the visual margin onto the sheet's own padding. It also marks
 * the document as owning its print CSS (a
 * `meta[name="omelette-owns-print"]` it injects at runtime), so the
 * PDF export never injects page-geometry CSS of its own on top.
 *
 * Print best practices for the content you author:
 * - Multi-column text: use CSS columns (`column-count` +
 *   `column-gap`), never side-by-side flex/grid columns — only real
 *   CSS columns flow and break across pages. `column-span: all` lets
 *   a heading span the columns; `hyphens: auto` (needs `lang` on
 *   the html element) keeps narrow columns readable.
 * - Page breaks in flowing documents: `break-before: page` on an
 *   element that must start a new page (a chapter, an appendix). Add
 *   your own kept-together blocks (callouts, stat tiles, cards) to a
 *   `break-inside: avoid` rule, and keep each one shorter than a page.
 * - Extend `orphans: 3; widows: 3` to any custom text blocks you add
 *   (p and li are covered by default).
 * - Give long tables a <thead> — browsers repeat it on every printed
 *   page.
 * - No `position: fixed`/`sticky` and no viewport units in content:
 *   fixed elements stamp every printed page (running headers/footers go
 *   in the component's slots) and `100vh` mis-sizes at print.
 *
 * Author content as static HTML so the user can click-to-edit any text
 * directly. Do not set width/padding/background on the document body —
 * the component owns the sheet box.
 */
/* END USAGE */

(() => {
  const PAPER = {
    letter: ['8.5in', '11in'],
    a4: ['210mm', '297mm'],
    legal: ['8.5in', '14in']
  };
  const CSS_LENGTH = /^\d+(\.\d+)?(px|in|mm|cm|pt|pc)$/;
  // Unitless "0" is a valid CSS length and the natural way to write
  // margin="0"; normalise it to 0px so max()/calc() (which reject a bare
  // number) keep working.
  const safeLen = (v, fb) => {
    v = (v || '').trim();
    return v === '0' ? '0px' : CSS_LENGTH.test(v) ? v : fb;
  };
  // WebKit (Safari and every iOS browser shell) never repeats a table's
  // thead/tfoot on printed pages (WebKit bug 17205), so the spacer-borne
  // vertical margins of a FLOWING document reach only the first page
  // there. Engine check, not browser check: vendor is 'Apple Computer,
  // Inc.' exactly for WebKit and 'Google Inc.' for Blink.
  const WK_PRINT = /apple/i.test(navigator.vendor || '');
  // CSS length → px number (CSS absolute units are exact: 1in = 96px).
  // Returns NaN for anything safeLen would reject — callers gate on it.
  const PX_PER = {
    px: 1,
    in: 96,
    mm: 96 / 25.4,
    cm: 96 / 2.54,
    pt: 96 / 72,
    pc: 16
  };
  const toPx = v => {
    const m = /^(\d+(?:\.\d+)?)(px|in|mm|cm|pt|pc)$/.exec((v || '').trim());
    return m ? parseFloat(m[1]) * PX_PER[m[2]] : NaN;
  };
  const stylesheet = `
    :host {
      position: relative;
      display: block;
      /* When the viewport is narrower than the page, grow to wrap the
       * sheet (plus this padding) instead of staying viewport-width, so
       * the desk background and right margin reach the sheet's far edge
       * in the horizontal scroll. */
      min-width: max-content;
      min-height: 100vh;
      background: #f5f5f4;
      padding: 48px 24px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      --doc-page-w: 8.5in;
      --doc-page-h: 11in;
      --doc-page-margin: 0.75in;
      --doc-hdr-h: 0px;
      --doc-ftr-h: 0px;
      --doc-hdr-pad: 0px;
      --doc-ftr-pad: 0px;
    }
    .sheet {
      width: var(--doc-page-w);
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 2px 10px rgba(20, 20, 19, 0.12);
      border-radius: 7px;
      box-sizing: border-box;
      padding: var(--doc-page-margin);
    }
    .frame { width: 100%; border-collapse: collapse; }
    /* Scaled-fit mode (content-width/content-height): the inner .fit box
     * lays the content out at its authored fixed size and scales it onto
     * the printable area; .fit-box reserves the scaled footprint in flow
     * (transforms don't affect layout) and centers it. Without the mode,
     * both divs are unstyled block pass-throughs. */
    /* Explicit pagination: direct .page children are the pages. The sheet
     * becomes a transparent stack and each page carries the card look on
     * screen; at print each page is exactly one full-bleed sheet. The
     * ::slotted defaults are deliberately weak (document CSS wins), so
     * authored page styling can override any of this. */
    .sheet.paginated {
      background: transparent;
      box-shadow: none;
      border-radius: 0;
      padding: 0;
    }
    .paginated ::slotted(.page) {
      position: relative;
      display: block;
      width: 100%;
      aspect-ratio: var(--doc-page-ar);
      container-type: size;
      overflow: hidden;
      box-sizing: border-box;
      background: #fff;
      border-radius: 7px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
      break-inside: avoid;
    }
    .paginated ::slotted(.page:not(:first-child)) { margin-top: 1rem; }
    @media print {
      .sheet.paginated { padding: 0; }
      /* The flowing-document vertical inset lives on the repeating
       * thead/tfoot spacers, not the sheet padding — they must go too,
       * or each full-sheet .page is pushed ~margin down and spills onto
       * a second sheet. Paginated pages are full-bleed by definition
       * (content owns its insets). */
      .sheet.paginated .hdr-space,
      .sheet.paginated .ftr-space { height: 0; }
      .paginated ::slotted(.page) {
        border-radius: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
        /* Physical page-box sizing, no viewport units: Safari resolves
         * 100vh against the window, not the page box, so a vh-sized card
         * paginates wrong there. --doc-page-w/h are the named size by
         * default and are overridden to the user's chosen paper by the
         * export path, so every card is exactly one sheet either way.
         * Width + height (same source values as @page size) rather than
         * width + aspect-ratio: the ratio is a 6-decimal rounding of the
         * same division, and a few millionths of overflow would spill a
         * blank sheet after every page. The screen-only aspect-ratio
         * (preview proportions) must not leak into print. cqh typography
         * tracks the same box.
         *
         * Every declaration is !important: per CSS Scoping, unimportant
         * shadow ::slotted rules LOSE to the document context, so a page
         * section's authored inline style would silently beat this print
         * geometry. A model-authored height:100% did exactly that — the
         * percentage resolves as auto in the all-auto print ancestry, the
         * base rule's size containment turns auto into ZERO, and
         * overflow:hidden then paints nothing: a blank PDF with perfect
         * page boxes. At print the component's geometry is the design's
         * whole contract, so it must win over any authored sizing. */
        aspect-ratio: auto !important;
        width: var(--doc-page-w) !important;
        height: var(--doc-page-h) !important;
        overflow: hidden !important;
      }
      .paginated ::slotted(.page:not(:first-child)) {
        break-before: page !important;
        margin-top: 0 !important;
      }
    }
    .fit-mode .fit-box {
      width: calc(var(--doc-fit-w) * var(--doc-fit-scale));
      height: calc(var(--doc-fit-h) * var(--doc-fit-scale));
      margin: 0 auto;
      break-inside: avoid;
    }
    .fit-mode .fit {
      width: var(--doc-fit-w);
      height: var(--doc-fit-h);
      transform: scale(var(--doc-fit-scale));
      transform-origin: top left;
    }
    .frame td, .frame th { padding: 0; text-align: left; font-weight: inherit; }
    .hdr-space { height: var(--doc-hdr-h); }
    .ftr-space { height: var(--doc-ftr-h); }
    ::slotted([slot="header"]),
    ::slotted([slot="footer"]) { display: block; box-sizing: border-box; }
    @media print {
      :host { background: none; padding: 0; min-width: 0; min-height: 0; }
      .sheet {
        width: auto; margin: 0; box-shadow: none; border-radius: 0;
        padding: 0 var(--doc-page-margin);
      }
      /* The thead/tfoot spacers repeat on every page, so they carry the
       * vertical page margin (which the sheet's own padding cannot, since
       * that padding is consumed once on the first/last page). The running
       * header/footer are fixed inside that band. */
      /* The 0.35in is breathing room between a running header/footer and
       * the body; without one the spacer is exactly the page margin, so a
       * margin="0" full-bleed document gets truly full-bleed pages. */
      .hdr-space { height: max(var(--doc-page-margin), calc(var(--doc-hdr-h) + var(--doc-hdr-pad))); }
      .ftr-space { height: max(var(--doc-page-margin), calc(var(--doc-ftr-h) + var(--doc-ftr-pad))); }
      /* WebKit flowing documents: @page carries the vertical margin (see
       * _syncPrintPageRule), so the spacers keep only whatever a running
       * header/footer needs BEYOND it — page 1 would otherwise double its
       * top inset. Paginated sheets already zero their spacers above. */
      .sheet.wk-print:not(.paginated) .hdr-space { height: max(0px, calc(max(var(--doc-page-margin), calc(var(--doc-hdr-h) + var(--doc-hdr-pad))) - var(--doc-page-margin))); }
      .sheet.wk-print:not(.paginated) .ftr-space { height: max(0px, calc(max(var(--doc-page-margin), calc(var(--doc-ftr-h) + var(--doc-ftr-pad))) - var(--doc-page-margin))); }
      ::slotted([slot="header"]) {
        position: fixed; top: 0; left: 0; right: 0; margin: 0;
        padding: calc(var(--doc-page-margin) * 0.45) var(--doc-page-margin) 0;
      }
      ::slotted([slot="footer"]) {
        position: fixed; bottom: 0; left: 0; right: 0; margin: 0;
        padding: 0 var(--doc-page-margin) calc(var(--doc-page-margin) * 0.45);
      }
    }
  `;
  class DocPage extends HTMLElement {
    static get observedAttributes() {
      return ['size', 'width', 'height', 'margin', 'orientation', 'content-width', 'content-height'];
    }
    constructor() {
      super();
      this._root = this.attachShadow({
        mode: 'open'
      });
      this._mo = typeof MutationObserver === 'function' ? new MutationObserver(() => this._scheduleMeasure()) : null;
    }

    /** The named paper's [w, h], swapped when orientation="landscape".
     *  Only the named size swaps — explicit width/height are exact values
     *  the author already oriented. */
    _paperSize() {
      const named = PAPER[(this.getAttribute('size') || '').toLowerCase()] || PAPER.letter;
      const landscape = (this.getAttribute('orientation') || '').trim().toLowerCase() === 'landscape';
      return landscape ? [named[1], named[0]] : named;
    }
    get pageWidth() {
      return safeLen(this.getAttribute('width'), this._paperSize()[0]);
    }
    get pageHeight() {
      return safeLen(this.getAttribute('height'), this._paperSize()[1]);
    }
    get pageMargin() {
      return safeLen(this.getAttribute('margin'), '0.75in');
    }

    /** Scaled-fit mode's content box [w, h] as CSS lengths, or null when
     *  the mode is off (either attribute missing/invalid/zero — a partial
     *  declaration falls back to normal flow rather than guessing). */
    _contentFit() {
      const w = safeLen(this.getAttribute('content-width'), null);
      const h = safeLen(this.getAttribute('content-height'), null);
      if (!w || !h) return null;
      const wPx = toPx(w),
        hPx = toPx(h);
      return wPx > 0 && hPx > 0 ? [w, h, wPx, hPx] : null;
    }
    connectedCallback() {
      if (!this._sheet) this._render();
      this._syncSize();
      this._syncPrintPageRule();
      this._ensureTextWrapDefaults();
      this._ensureOwnsPrintMeta();
      this._syncFixedSizeMeta();
      this._syncPrintSizingMeta();
      if (this._mo) this._mo.observe(this, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
      });
      this._onResize = () => this._scheduleMeasure();
      window.addEventListener('resize', this._onResize);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this._scheduleMeasure());
      }
      this._scheduleMeasure();
    }
    disconnectedCallback() {
      window.removeEventListener('resize', this._onResize);
      if (this._mo) this._mo.disconnect();
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = null;
      }
      // Drop the head rules when the last doc-page leaves, so a deleted
      // document's @page geometry and text-wrap defaults can't apply to
      // whatever replaces it.
      const survivor = document.querySelector('doc-page');
      if (!survivor) {
        ['doc-page-print', 'doc-page-text-wrap', 'doc-page-owns-print', 'doc-page-fixed-size', 'doc-page-print-sizing'].forEach(id => {
          const tag = document.getElementById(id);
          if (tag) tag.remove();
        });
        // A live deck-stage deferred its own print-sizing meta to ours —
        // hand the page-global meta over so the deck isn't left unmarked.
        const deck = document.querySelector('deck-stage');
        if (deck && typeof deck._ensurePrintSizingMeta === 'function') {
          deck._ensurePrintSizingMeta();
        }
      } else {
        // A departed owner hands each page-global meta to whatever
        // doc-page remains (or it's removed).
        if (typeof survivor._syncFixedSizeMeta === 'function') {
          survivor._syncFixedSizeMeta();
        }
        if (typeof survivor._syncPrintSizingMeta === 'function') {
          survivor._syncPrintSizingMeta();
        }
      }
    }
    attributeChangedCallback() {
      if (!this._sheet) return;
      this._syncSize();
      this._syncPrintPageRule();
      this._syncFixedSizeMeta();
      this._syncPrintSizingMeta();
      this._scheduleMeasure();
    }
    _render() {
      this._root.innerHTML = `
        <style>${stylesheet}</style>
        <style id="vars"></style>
        <div class="sheet" data-screen-label="Document">
          <table class="frame" role="presentation">
            <thead><tr><th><div class="hdr-space"><slot name="header"></slot></div></th></tr></thead>
            <tbody><tr><td class="body"><div class="fit-box"><div class="fit"><slot></slot></div></div></td></tr></tbody>
            <tfoot><tr><td><div class="ftr-space"><slot name="footer"></slot></div></td></tr></tfoot>
          </table>
        </div>`;
      this._sheet = this._root.querySelector('.sheet');
      this._vars = this._root.getElementById('vars');
    }

    /** Runtime sizing lives in a shadow <style> :host rule, never on the
     *  light-DOM host element, so serialize-persist can't write it back. */
    _syncSize(hdrH, ftrH) {
      // Scaled-fit mode: content at its authored size, scaled onto the
      // printable area (page minus margins on both axes). The factor is a
      // plain number var so calc(length * number) stays valid; 4 decimals
      // keeps the shadow style stable across re-measures. Upscaling is
      // allowed — print transforms are vector, so text and CSS stay crisp
      // (raster images soften, which the catalog bullet warns about).
      const fit = this._contentFit();
      let fitVars = '';
      if (fit) {
        const marginPx = toPx(this.pageMargin) || 0;
        const availW = toPx(this.pageWidth) - 2 * marginPx;
        const availH = toPx(this.pageHeight) - 2 * marginPx;
        const scale = Math.min(availW / fit[2], availH / fit[3]);
        if (scale > 0 && Number.isFinite(scale)) {
          fitVars = '--doc-fit-w:' + fit[0] + ';' + '--doc-fit-h:' + fit[1] + ';' + '--doc-fit-scale:' + scale.toFixed(4) + ';';
        }
      }
      this._sheet.classList.toggle('fit-mode', !!fitVars);
      // Numeric w/h ratio for the paginated page cards' aspect-ratio —
      // aspect-ratio takes a number, not a length ratio, so compute it
      // here (CSS length division isn't portable). 6 decimals keeps the
      // shadow style stable across re-syncs.
      const arW = toPx(this.pageWidth);
      const arH = toPx(this.pageHeight);
      const ar = arW > 0 && arH > 0 ? (arW / arH).toFixed(6) : '0.772727';
      this._vars.textContent = ':host{' + fitVars + '--doc-page-ar:' + ar + ';' + '--doc-page-w:' + this.pageWidth + ';' + '--doc-page-h:' + this.pageHeight + ';' + '--doc-page-margin:' + this.pageMargin + ';' + '--doc-hdr-h:' + (hdrH || 0) + 'px;' + '--doc-ftr-h:' + (ftrH || 0) + 'px;' + '--doc-hdr-pad:' + (hdrH ? '0.35in' : '0px') + ';' + '--doc-ftr-pad:' + (ftrH ? '0.35in' : '0px') + '}';
    }

    /** @page is a no-op inside shadow DOM, so the rule lives in <head>.
     *  Re-appended on every sync so it stays last in source order — the
     *  @page cascade is source-order per descriptor, so this rule wins
     *  over any other @page rule in the document.
     *
     *  The @page SIZE is pinned where the page box IS part of the design:
     *  explicit-fixed-size mode (width + height authored), scaled-fit
     *  mode (the named sheet the fit targets), and explicit pagination
     *  (the named size the cards share — so card and sheet agree on
     *  every print path, and the export path's chosen paper overrides
     *  BOTH with one later rule). For FLOWING documents no paper size is
     *  emitted at all — the true size comes from the user's preference,
     *  injected by the export path or chosen in the print dialog — so a
     *  flowing document never fights the paper it lands on.
     *  margin: 0 is emitted in every mode: it leaves Chrome no margin box
     *  to draw its date/URL/page-count header in, and the visual margin
     *  lives on the sheet's own padding. */
    _syncPrintPageRule() {
      const id = 'doc-page-print';
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
      }
      document.head.appendChild(tag);
      // Three print-geometry regimes:
      // - true-size: the page IS the design — pin its exact size.
      // - scaled-fit (content-width/height): the fit factor is computed
      //   against the NAMED paper's printable area, so that paper must
      //   stay pinned or the scaled content overflows a smaller sheet
      //   (the export path re-fits and re-pins at print time on top).
      // - default modes: no paper size — but landscape still needs the
      //   paper-agnostic 'size: landscape' keyword, because the size
      //   descriptor is what carries orientation; without it a landscape
      //   document prints portrait whenever nothing injects a size.
      const landscape = (this.getAttribute('orientation') || '').trim().toLowerCase() === 'landscape';
      // Explicit pagination pins the page box to the SAME values that
      // size the cards (the named size by default, the export path's
      // chosen paper when its later rule overrides both) — card and
      // sheet agree on every print path, and a mismatched real paper
      // shrinks-to-fit in the dialog instead of clipping a Letter card
      // on A4. Declared before the paginated read below so both derive
      // from one check.
      const paginatedNow = this.querySelector(':scope > .page') !== null;
      const sizeDescriptor = this._trueSizePx() ? 'size: ' + this.pageWidth + ' ' + this.pageHeight + '; ' : this._contentFit() ? 'size: ' + this.pageWidth + ' ' + this.pageHeight + '; ' : paginatedNow ? 'size: ' + this.pageWidth + ' ' + this.pageHeight + '; ' : landscape ? 'size: landscape; ' : '';
      // WebKit never repeats the thead/tfoot spacers that carry a flowing
      // document's vertical page margins (see WK_PRINT above), so pages
      // after the first print edge-to-edge there. Carry the VERTICAL
      // margins on @page for WebKit instead, and the shadow print CSS
      // trims the first-page spacers by the same amount (.sheet.wk-print
      // rules). Horizontal inset stays on the sheet's own padding in
      // every engine. Blink keeps margin: 0 (a nonzero margin there
      // re-opens the box Chrome draws its header furniture in). One cost,
      // learned in testing: Safari's own date/URL headers are a USER
      // dialog setting ("Print headers and footers") that renders in the
      // margin area when room exists — margin: 0 only suppressed it by
      // leaving no room, and no CSS controls it. The export dialog's
      // Safari guide teaches turning the setting off for flowing
      // documents. Explicitly paginated and fixed-size documents keep
      // margin: 0 everywhere: their pages ARE the sheet.
      const wkFlowing = WK_PRINT && !paginatedNow && !this._trueSizePx() && !this._contentFit();
      const marginDescriptor = wkFlowing ? 'margin: ' + this.pageMargin + ' 0; ' : 'margin: 0; ';
      // Shadow-internal marker (never serialized), kept in lockstep with
      // the @page decision above: the print CSS trims the first-page
      // spacers ONLY while @page actually carries the margins — a
      // true-size or scaled-fit sheet keeps margin: 0 and must keep its
      // spacers too. Re-synced here so attribute changes and pagination
      // flips move both together.
      if (this._sheet) this._sheet.classList.toggle('wk-print', wkFlowing);
      tag.textContent = '@page { ' + sizeDescriptor + marginDescriptor + '} ' + '@media print { html, body { margin: 0 !important; padding: 0 !important; background: none !important; height: auto !important; overflow: visible !important; } ' + 'h1,h2,h3,h4,h5,h6 { break-after: avoid; } ' + 'figure,pre,blockquote,img,svg,tr { break-inside: avoid; } ' + 'p,li { orphans: 3; widows: 3; } ' + '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; ' + 'backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } ' + '*, *::before, *::after { animation-delay: -99s !important; animation-duration: .001s !important; ' + 'animation-iteration-count: 1 !important; animation-fill-mode: both !important; ' + 'animation-play-state: running !important; transition-duration: 0s !important; } }';
    }

    /** Typographic defaults for document text: balance headings, avoid
     *  widowed/orphaned words in body copy (browsers without text-wrap
     *  support drop the declarations). Zero-specificity via :where() so
     *  any text-wrap authored on those elements wins; document-level so the
     *  rules reach the slotted (light DOM) content — shadow styles can't.
     *  data-omelette-injected marks the tag for the host editor to strip
     *  at serialize, so it is never written back as authored source. */
    _ensureTextWrapDefaults() {
      if (document.getElementById('doc-page-text-wrap')) return;
      const tag = document.createElement('style');
      tag.id = 'doc-page-text-wrap';
      tag.setAttribute('data-omelette-injected', '');
      tag.textContent = ':where(h1,h2,h3,h4,h5,h6){text-wrap:balance}' + ':where(p,li,blockquote,figcaption){text-wrap:pretty}';
      document.head.appendChild(tag);
    }

    /** Declares that this document owns its print CSS. The instant-PDF
     *  export checks for the meta by NAME PRESENCE alone (content is
     *  ignored) and skips its automatic print-CSS injections, so the
     *  component's @page geometry is never overridden by a heuristic.
     *  data-omelette-injected keeps it out of serialized source. */
    _ensureOwnsPrintMeta() {
      if (document.getElementById('doc-page-owns-print')) return;
      const tag = document.createElement('meta');
      tag.id = 'doc-page-owns-print';
      tag.name = 'omelette-owns-print';
      tag.content = 'true';
      tag.setAttribute('data-omelette-injected', '');
      document.head.appendChild(tag);
    }

    /** This page's valid true-size page box (explicit width AND height)
     *  as [w, h] px ints, or null when the mode is off. */
    _trueSizePx() {
      if (!safeLen(this.getAttribute('width'), null) || !safeLen(this.getAttribute('height'), null)) return null;
      const w = Math.round(toPx(this.pageWidth));
      const h = Math.round(toPx(this.pageHeight));
      return w > 0 && h > 0 ? [w, h] : null;
    }

    /** True-size pages (explicit width AND height) also declare the page
     *  box as the preview size: the in-app preview reads
     *  meta[name="omelette-fixed-size"] (content "W,H" in px ints) and
     *  scales the sheet into view — without it an 18in poster previews at
     *  true size with scrollbars. Never overrides an author-set meta
     *  (only the component's own id is managed). The meta is page-global
     *  while doc-page instances are not, so every sync recomputes the
     *  page-wide owner — the first connected true-size doc-page — and a
     *  non-true-size sibling's sync can never delete the owner's meta.
     *  Removed when no true-size page remains (the owner's disconnect
     *  re-syncs via any survivor) or when an author-set meta exists. */
    _syncFixedSizeMeta() {
      const id = 'doc-page-fixed-size';
      const own = document.getElementById(id);
      const authored = document.querySelector('meta[name="omelette-fixed-size"]:not([data-omelette-injected])');
      // The page-wide owner, not this instance: an upgraded true-size page
      // anywhere in the document keeps the meta alive and sized.
      let box = null;
      for (const el of document.querySelectorAll('doc-page')) {
        box = typeof el._trueSizePx === 'function' ? el._trueSizePx() : null;
        if (box) break;
      }
      if (!box || authored) {
        if (own) own.remove();
        return;
      }
      const tag = own || document.createElement('meta');
      tag.id = id;
      tag.name = 'omelette-fixed-size';
      tag.content = box[0] + ',' + box[1];
      tag.setAttribute('data-omelette-injected', '');
      if (!own) document.head.appendChild(tag);
    }

    /** This page's print-sizing mode: 'fixed' when an explicit width AND
     *  height are authored (the page is the design's own size), else the
     *  default paper in the authored orientation. */
    _printSizingMode() {
      if (this._trueSizePx()) return 'fixed';
      const landscape = (this.getAttribute('orientation') || '').trim().toLowerCase() === 'landscape';
      return landscape ? 'default-landscape' : 'default-portrait';
    }

    /** Announces the print-sizing mode to the host app:
     *  meta[name="omelette-print-sizing"] with content 'default-portrait',
     *  'default-landscape', or 'fixed' (fixed pages also carry the
     *  omelette-fixed-size meta with the page box in px). The export path
     *  probes it to decide what true paper size to inject at print time —
     *  in the default modes the component emits no paper size of its own.
     *  Same page-global ownership rules as the fixed-size meta above:
     *  first connected doc-page owns it, an authored meta is never
     *  overridden, removed when no doc-page remains. */
    _syncPrintSizingMeta() {
      const id = 'doc-page-print-sizing';
      const own = document.getElementById(id);
      const authored = document.querySelector('meta[name="omelette-print-sizing"]:not([data-omelette-injected])');
      // A fixed page wins outright (mirroring the fixed-size loop above,
      // so the two metas can never contradict each other in a mixed
      // multi-page document); otherwise the first page's mode holds.
      let mode = null;
      for (const el of document.querySelectorAll('doc-page')) {
        if (typeof el._printSizingMode !== 'function') continue;
        const m = el._printSizingMode();
        if (m === 'fixed') {
          mode = m;
          break;
        }
        if (mode === null) mode = m;
      }
      if (!mode || authored) {
        if (own) own.remove();
        return;
      }
      // A deck-stage that connected first injected its own meta and
      // defers to any existing one — take it over, or the document ends
      // up with two conflicting injected metas (a doc-page page is the
      // document; the deck re-ensures its meta if every doc-page leaves).
      const deckMeta = document.getElementById('deck-stage-print-sizing');
      if (deckMeta) deckMeta.remove();
      const tag = own || document.createElement('meta');
      tag.id = id;
      tag.name = 'omelette-print-sizing';
      tag.content = mode;
      tag.setAttribute('data-omelette-injected', '');
      if (!own) document.head.appendChild(tag);
    }
    _scheduleMeasure() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = null;
        this._measure();
      });
    }

    /** Slot heights feed the print spacers (--doc-hdr-h / --doc-ftr-h), so
     *  they re-measure on content mutation, resize, and font load. The
     *  same pass detects explicit pagination (direct .page children) and
     *  toggles the sheet between the flowing-document card and the
     *  page-per-card stack — content edits can add or remove pages at any
     *  time, so this tracks the same mutations the measurement does. */
    _measure() {
      const hdr = this.querySelector(':scope > [slot="header"]');
      const ftr = this.querySelector(':scope > [slot="footer"]');
      const wasPaginated = this._sheet.classList.contains('paginated');
      this._sheet.classList.toggle('paginated', this.querySelector(':scope > .page') !== null);
      // The WebKit @page margin is flowing-only, so a pagination flip
      // must re-emit the rule (content edits can add or remove .page
      // sections at any time).
      if (this._sheet.classList.contains('paginated') !== wasPaginated) {
        this._syncPrintPageRule();
      }
      this._syncSize(hdr ? hdr.offsetHeight : 0, ftr ? ftr.offsetHeight : 0);
    }
  }
  if (!customElements.get('doc-page')) {
    customElements.define('doc-page', DocPage);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "doc-page.js", error: String((e && e.message) || e) }); }

// ui_kits/circleback/data.js
try { (() => {
// Circle Back® — the mixer's data, lifted from src/CircleBack.jsx, src/feed.js and src/song.js.
window.CB = (() => {
  const PHRASES = [{
    code: 'TH',
    name: 'Thrilled',
    say: "I'm thrilled to announce"
  }, {
    code: 'HU',
    name: 'Humbled',
    say: 'Humbled and honored to share'
  }, {
    code: 'HA',
    name: 'Happy to share',
    say: "I'm happy to share that I'm starting a new position"
  }, {
    code: 'RE',
    name: 'Reflection',
    say: "After careful reflection, I've decided to pursue new opportunities"
  }, {
    code: 'SY',
    name: 'Synergy',
    say: 'Synergy'
  }, {
    code: 'CB',
    name: 'Circle back',
    say: "Let's circle back"
  }, {
    code: 'LV',
    name: 'Leverage',
    say: 'Leverage'
  }, {
    code: 'PV',
    name: 'Pivot',
    say: 'Pivot'
  }, {
    code: 'NX',
    name: 'Not X, but Y',
    say: "It's not about the tools. It's about the mindset."
  }, {
    code: 'DL',
    name: 'Delve',
    say: 'Delve'
  }, {
    code: 'TA',
    name: 'Tapestry',
    say: 'A rich tapestry'
  }, {
    code: 'GC',
    name: 'Game-changer',
    say: 'Game-changer'
  }, {
    code: 'T?',
    name: 'Thoughts?',
    say: 'Thoughts?'
  }, {
    code: 'AG',
    name: 'Agree?',
    say: 'Agree or disagree?'
  }, {
    code: 'SI',
    name: 'Sink in',
    say: 'Let that sink in'
  }, {
    code: 'FS',
    name: 'Full stop',
    say: 'Full stop.'
  }, {
    code: 'EX',
    name: 'Excited',
    say: "I'm excited to share…"
  }, {
    code: 'RA',
    name: 'Read again',
    say: 'Read that again.'
  }, {
    code: 'HL',
    name: 'Learned',
    say: "Here's what I learned. 👇"
  }, {
    code: 'CE',
    name: 'Changed',
    say: 'This changed everything for me.'
  }, {
    code: 'MP',
    name: 'Most people',
    say: "Most people won't understand this. But you will."
  }, {
    code: 'NB',
    name: 'Nobody else',
    say: "I'll say what nobody else will…"
  }, {
    code: 'NF',
    name: 'Never forget',
    say: "And then he said something I'll never forget."
  }, {
    code: 'RH',
    name: 'History',
    say: 'The rest is history.'
  }, {
    code: 'GR',
    name: 'Grateful',
    say: 'Grateful for this incredible journey.'
  }, {
    code: 'AT',
    name: 'Amazing team',
    say: "Couldn't have done it without my amazing team."
  }, {
    code: 'OU',
    name: 'Onwards',
    say: 'Onwards and upwards! 🚀'
  }, {
    code: 'FP',
    name: 'Fast-paced',
    say: "In today's fast-paced world…"
  }, {
    code: 'PI',
    name: 'Intersection',
    say: 'Passionate about driving impact at the intersection of…'
  }, {
    code: 'JC',
    name: 'A calling',
    say: 'Not just a job — a calling.'
  }, {
    code: 'HT',
    name: 'Hot take',
    say: 'Hot take: teamwork makes a difference.'
  }, {
    code: 'UO',
    name: 'Unpopular',
    say: 'Unpopular opinion: Fridays are great.'
  }, {
    code: 'CS',
    name: 'Synergies',
    say: "Let's connect and explore synergies."
  }, {
    code: 'DC',
    name: 'Drop a comment',
    say: 'What do you think? Drop a comment below. 👇'
  }, {
    code: 'MU',
    name: 'Milestone',
    say: 'Milestone unlocked.'
  }, {
    code: 'ND',
    name: 'Numbers',
    say: "The numbers don't lie."
  }, {
    code: 'CU',
    name: 'Culture',
    say: 'Culture is everything.'
  }];
  const KEYMAP = '1234QWETASDFZXCV';
  const DRUMS = ['Kick', 'Snare', 'Clap', 'Cl. hat', 'Op. hat', 'Shaker', 'Cowbell', 'Zap'];
  const CHARACTERS = [{
    id: 'boardroom',
    name: 'Boardroom'
  }, {
    id: 'confcall',
    name: 'Conference call'
  }, {
    id: 'pa',
    name: 'All-hands PA'
  }, {
    id: 'replyall',
    name: 'Reply-all'
  }, {
    id: 'bandwidth',
    name: 'Bandwidth'
  }];
  const SONGS = ['Q3 Alignment', 'The Offsite', 'Town Hall (Extended)', 'Sprint Review', 'All-Hands Anthem'];
  const SECTIONS = ['Groove', 'Build', 'Drop'];
  const PEOPLE = [['Chad Growthman', 'VP of Vibes at Synergy Partners'], ['Brenda Sinclair', 'Chief People Officer | Culture Architect'], ['Blake Thoughtleader', 'Founder | Investor | Podcast Host | Girl Dad'], ['Karen Alignment', 'Agile Coach & Keynote Speaker'], ['Trip Delaney III', 'Serial Entrepreneur · 3x Exits'], ['Dana Metrics', 'Head of Growth at Pipeline.ai'], ['Saylor Brandwidth', 'Personal Branding Strategist'], ['Gary Grindset', 'CEO | Author | 5AM Club | Ex-Deloitte'], ['Avery Circleback', 'Director of Follow-Ups'], ['Morgan Uptick', 'Ex-McKinsey, Ex-Google, Ex-cited']];
  const TEXTS = ['Congrats on the new chapter!', 'So well deserved. 👏', 'This resonated deeply. Thank you for sharing.', 'Great insight — following for more.', 'Commenting for reach.', 'This. So much this.', 'Adding this to my leadership playbook.', "We're hiring! DM me. 🚀", 'Taking notes. 📝', 'Needed to hear this today.', 'Big if true.', '10/10 thought leadership.', 'The algorithm brought me here for a reason.', 'Bookmarked. Again.', 'Printing this out for my team.'];
  const AGES = ['1m', '2m', '4m', '7m', 'now', 'now', '23m'];
  const DEGREES = ['1st', '2nd', '2nd', '2nd', '3rd'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const randomComment = () => {
    const [name, title] = pick(PEOPLE);
    return {
      name,
      initials: name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(),
      degree: pick(DEGREES),
      title,
      text: pick(TEXTS),
      age: pick(AGES),
      likes: Math.floor(Math.random() * 140),
      replies: Math.random() < .35 ? 1 + Math.floor(Math.random() * 4) : 0
    };
  };
  const VOICES = n => [...DRUMS.map(d => ({
    name: d
  })), ...Array.from({
    length: n
  }, (_, i) => ({
    name: 'Exh. ' + String.fromCharCode(65 + i)
  })), {
    name: 'Vox',
    vox: true
  }];
  // the sample mix: the classic 16-step agenda, tiled across the meeting
  const seedPattern = (n = 0, len = 32) => {
    const rows = DRUMS.length + n + 1;
    const p = Array.from({
      length: rows
    }, () => Array(len).fill(0));
    const put = (i, arr, acc = []) => arr.forEach(s => {
      for (let o = s; o < len; o += 16) p[i][o] = acc.includes(s) ? 2 : 1;
    });
    put(0, [0, 3, 8, 10], [0, 8]);
    put(1, [4, 12], [4, 12]);
    put(2, [12]);
    put(3, [0, 2, 4, 6, 8, 10, 12, 14], [0, 8]);
    put(4, [7, 15]);
    put(5, [3, 7, 11, 15]);
    const vr = DRUMS.length + n;
    p[vr][0] = 2;
    if (len >= 32) p[vr][16] = 6;
    if (len >= 48) p[vr][32] = 16;
    return p;
  };
  const emptyPattern = (n = 0, len = 32) => Array.from({
    length: DRUMS.length + n + 1
  }, () => Array(len).fill(0));
  return {
    PHRASES,
    KEYMAP,
    DRUMS,
    CHARACTERS,
    SONGS,
    SECTIONS,
    randomComment,
    VOICES,
    seedPattern,
    emptyPattern
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/circleback/data.js", error: String((e && e.message) || e) }); }

// ui_kits/circleback/stage.jsx
try { (() => {
(() => {
  const {
    Button,
    Scrubber,
    ArrowKey,
    CommentCards,
    Backdrop,
    Monitor,
    RemixPanel
  } = window.CircleBackDesignSystem_7570bb;
  const {
    CHARACTERS,
    SECTIONS
  } = window.CB;

  // THE STAGE — the app opens as a blue room. The broadcast fills the screen;
  // the arrows change the phrase; three faders bend the voice.
  function Stage(p) {
    const monitorRef = React.useRef(null);
    const character = CHARACTERS.find(c => c.id === p.character) || CHARACTERS[0];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--blue)',
        color: '#fff',
        fontFamily: 'var(--sans)',
        padding: p.narrow ? '14px 14px 26px' : '20px 26px 30px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: p.narrow ? 12 : 16,
        isolation: 'isolate'
      }
    }, /*#__PURE__*/React.createElement(Backdrop, {
      focusRef: monitorRef
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: p.narrow ? 18 : 22,
        fontWeight: 700,
        letterSpacing: '-.02em'
      }
    }, "Circle Back", /*#__PURE__*/React.createElement("sup", {
      style: {
        fontSize: 9,
        verticalAlign: 10
      }
    }, "\xAE")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: p.onToggleRemix,
      style: {
        background: p.remixOpen ? '#fff' : 'var(--ink)',
        color: p.remixOpen ? 'var(--blue)' : '#fff',
        borderColor: p.remixOpen ? '#fff' : 'var(--ink)'
      }
    }, "Build your remix"), /*#__PURE__*/React.createElement(Button, {
      tone: "light",
      on: p.playing,
      onClick: p.onPlay
    }, p.playing ? 'Pause' : 'Play'), /*#__PURE__*/React.createElement(Button, {
      tone: "light",
      onClick: p.onNewTrack
    }, "New track (R)"), /*#__PURE__*/React.createElement(Button, {
      tone: "light",
      variant: "rec",
      on: p.taping,
      onClick: p.onTape
    }, p.taping ? `Taping ${p.tapeDone}/${p.tapeTotal}` : 'Export mp4'), /*#__PURE__*/React.createElement(Button, {
      tone: "light",
      onClick: p.onStudio
    }, "Audio tools"))), p.remixOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        zIndex: 1
      }
    }, /*#__PURE__*/React.createElement(RemixPanel, {
      narrow: p.narrow,
      result: p.remix,
      onRemix: p.onRemix,
      onClose: p.onToggleRemix
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        zIndex: 1,
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      ref: monitorRef,
      style: {
        width: '100%',
        maxWidth: p.narrow ? '100%' : 'min(100%, 56vh)'
      }
    }, /*#__PURE__*/React.createElement(Monitor, {
      glass: true,
      phrase: p.phrase,
      beats: p.beats,
      playhead: p.pos,
      reactions: p.eng.reactions,
      reposts: p.eng.reposts,
      comments: p.eng.comments
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: '104px minmax(0,1fr) 104px',
        gap: p.narrow ? 10 : 14,
        alignItems: 'stretch',
        height: 104
      }
    }, /*#__PURE__*/React.createElement(ArrowKey, {
      dir: "left",
      onFire: () => p.onStep(-1),
      style: {
        minHeight: 0,
        height: '100%'
      }
    }), /*#__PURE__*/React.createElement(CommentCards, {
      comment: p.comment,
      narrow: p.narrow
    }), /*#__PURE__*/React.createElement(ArrowKey, {
      dir: "right",
      onFire: () => p.onStep(1),
      style: {
        minHeight: 0,
        height: '100%'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: p.narrow ? '1fr' : '1fr 1fr 1fr auto',
        gap: p.narrow ? 12 : 18,
        alignItems: 'end'
      }
    }, /*#__PURE__*/React.createElement(Scrubber, {
      tone: "light",
      label: "Pitch",
      value: p.pitch,
      onChange: p.onPitch,
      format: v => {
        const s = Math.round((v - .5) * 24);
        return `${s > 0 ? '+' : ''}${s} st`;
      }
    }), /*#__PURE__*/React.createElement(Scrubber, {
      tone: "light",
      label: "Weirdness",
      value: p.weird,
      onChange: p.onWeird
    }), /*#__PURE__*/React.createElement(Scrubber, {
      tone: "light",
      label: "Distortion",
      value: p.dist,
      onChange: p.onDist
    }), /*#__PURE__*/React.createElement(Button, {
      tone: "light",
      onClick: p.onCharacter,
      style: {
        whiteSpace: 'nowrap'
      }
    }, character.name)), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        opacity: .72,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '.16em',
        textTransform: 'uppercase'
      }
    }, /*#__PURE__*/React.createElement("span", null, p.remix ? `Your remix · index ${p.remix.score} · ${p.remix.rank}` : p.song, " \xB7 ", p.tempo, " BPM \xB7 ", SECTIONS[p.energy]), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        gap: 18,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: p.onVoxLock,
      role: "radio",
      "aria-checked": p.voxLocked,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        userSelect: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: '2px solid #fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none'
      }
    }, p.voxLocked && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#fff'
      }
    })), /*#__PURE__*/React.createElement("span", null, "Vox locked")), /*#__PURE__*/React.createElement("span", null, "Space starts the song \xB7 \u2190 \u2192 change phrase \xB7 2 build \xB7 3 drop \xB7 R new track"))));
  }
  Object.assign(window, {
    Stage
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/circleback/stage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/circleback/studio.jsx
try { (() => {
(() => {
  const {
    Unit,
    Masthead,
    Ticker,
    Bay,
    Silk,
    Readout,
    Stamp,
    Button,
    Knob,
    Scrubber,
    Kbd,
    Pad,
    KeyPlate,
    StepGrid,
    Monitor,
    StageKey,
    ArrowKey,
    RemixPanel
  } = window.CircleBackDesignSystem_7570bb;
  const {
    PHRASES,
    KEYMAP,
    CHARACTERS,
    SECTIONS
  } = window.CB;

  // THE STUDIO — "Audio tools". The paper screen: phrase index, the 4×4 key plate,
  // the registers, and the sequencer as a ruled table.
  function Studio(p) {
    const stageKeys = /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: p.narrow ? '1fr 1fr' : '104px repeat(3,1fr) 104px',
        gap: p.narrow ? 10 : 14,
        width: '100%'
      }
    }, /*#__PURE__*/React.createElement(ArrowKey, {
      tone: "ink",
      dir: "left",
      onFire: () => p.onStep(-1)
    }), /*#__PURE__*/React.createElement(StageKey, {
      tone: "ink",
      label: "Phrase",
      hint: "1 / A",
      caption: "Say the next line",
      onFire: p.onFirePhrase,
      style: p.narrow ? {
        gridColumn: '1 / -1'
      } : undefined
    }), /*#__PURE__*/React.createElement(StageKey, {
      tone: "ink",
      label: "Build",
      hint: "2 / S",
      caption: "Raise the room",
      on: p.energy === 1,
      onFire: () => p.onEnergy(p.energy === 1 ? 0 : 1),
      style: p.narrow ? {
        gridColumn: '1 / -1'
      } : undefined
    }), /*#__PURE__*/React.createElement(StageKey, {
      tone: "ink",
      label: "Drop",
      hint: "3 / D",
      caption: "Full stop.",
      on: p.energy === 2,
      onFire: () => p.onEnergy(2),
      style: p.narrow ? {
        gridColumn: '1 / -1'
      } : undefined
    }), /*#__PURE__*/React.createElement(ArrowKey, {
      tone: "ink",
      dir: "right",
      onFire: () => p.onStep(1)
    }));
    return /*#__PURE__*/React.createElement(Unit, {
      narrow: p.narrow
    }, /*#__PURE__*/React.createElement(Masthead, {
      meta: p.narrow ? ['Form CB-16', 'Rev. 2026-08'] : ['Form CB-16', 'Rev. 2026-08', 'For internal thought leadership only']
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: p.narrow ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: p.narrow ? 'flex-start' : 'flex-end',
        gap: p.narrow ? 8 : 30,
        marginTop: 18
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: p.narrow ? 30 : 40,
        lineHeight: .96,
        letterSpacing: '-.045em',
        fontWeight: 700,
        color: 'var(--blue)'
      }
    }, "The professional phrase organ."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: p.narrow ? 12.5 : 13,
        lineHeight: 1.45,
        maxWidth: 400
      }
    }, "The LinkedIn remixer \u2014 corporate phrases, spoken in time over a live drum machine. ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--blue)'
      }
    }, "It\u2019s not an instrument. It\u2019s a journey."))), /*#__PURE__*/React.createElement(Ticker, {
      style: {
        marginTop: 16
      }
    }, p.ticker), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: p.onToggleRemix,
      style: {
        padding: 'var(--btn-pad-lg)'
      }
    }, "Build your remix")), p.remixOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(RemixPanel, {
      narrow: p.narrow,
      result: p.remix,
      onRemix: p.onRemix,
      onClose: p.onToggleRemix
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: p.narrow ? '1fr' : 'minmax(0,1fr) 280px',
        gap: p.narrow ? 16 : 'var(--space-col)',
        alignItems: 'start',
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement(Monitor, {
      phrase: p.phrase,
      beats: p.beats,
      playhead: p.pos,
      meta: "Form CB-16 \xB7 Rev. 2026-08",
      reactions: p.eng.reactions,
      reposts: p.eng.reposts,
      comments: p.eng.comments
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Button, {
      style: {
        padding: '14px 20px'
      },
      onClick: p.onStage
    }, "\u25B6 Back to the stage"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      on: p.playing,
      onClick: p.onPlay
    }, p.playing ? 'Pause' : 'Play'), /*#__PURE__*/React.createElement(Button, {
      onClick: p.onNewTrack
    }, "New track (R)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement(Silk, null, "Run of show"), " ", /*#__PURE__*/React.createElement(Readout, {
      style: {
        marginLeft: 8
      }
    }, "\u2248 ", Math.round(p.loops * p.patLen * (60 / p.tempo / 4)), "s")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, [2, 4, 8].map(n => /*#__PURE__*/React.createElement(Button, {
      key: n,
      on: p.loops === n,
      onClick: () => p.onLoops(n),
      style: {
        padding: '7px 11px'
      }
    }, n, " loops")))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "rec",
      on: p.taping,
      onClick: p.onTape
    }, "Export video (mp4)"), /*#__PURE__*/React.createElement(Button, {
      variant: "rec",
      onClick: p.onTape
    }, "Export audio")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Silk, null, "Status"), " ", /*#__PURE__*/React.createElement(Readout, {
      style: {
        marginLeft: 8
      }
    }, p.taping ? `ON THE RECORD ${String(p.tapeDone).padStart(2, '0')}/${p.tapeTotal}` : p.taped ? 'CLEARED FOR THE FEED' : '—')))), /*#__PURE__*/React.createElement(Bay, {
      title: "Stage keys",
      aside: `${p.song} · ${SECTIONS[p.energy]}`,
      style: {
        marginTop: 'var(--space-section)'
      }
    }, stageKeys), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: p.narrow ? '1fr' : '200px 1fr 230px',
        gap: p.narrow ? 20 : 'var(--space-col)',
        marginTop: 'var(--space-section)'
      }
    }, /*#__PURE__*/React.createElement(Bay, {
      title: "Phrase index",
      aside: `01–${String(PHRASES.length).padStart(2, '0')}`,
      style: p.narrow ? {
        order: 3
      } : undefined
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxHeight: p.narrow ? 300 : 600,
        overflowY: 'auto'
      }
    }, PHRASES.map((ph, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => p.onPress(i),
      style: {
        display: 'flex',
        gap: 12,
        fontSize: 11.5,
        lineHeight: 1.9,
        borderBottom: '1px dotted var(--hair)',
        cursor: 'pointer',
        fontWeight: p.armed === i ? 700 : 400,
        color: p.armed === i ? 'var(--blue)' : 'var(--ink)'
      }
    }, /*#__PURE__*/React.createElement(Readout, {
      style: {
        lineHeight: '1.9em',
        fontSize: 10.5
      }
    }, String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("span", {
      style: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, ph.say))))), /*#__PURE__*/React.createElement(Bay, {
      title: "Keys",
      aside: "Press to opine",
      style: p.narrow ? {
        order: 1
      } : undefined
    }, /*#__PURE__*/React.createElement(KeyPlate, {
      columns: 4
    }, PHRASES.slice(0, 16).map((ph, i) => /*#__PURE__*/React.createElement(Pad, {
      key: i,
      index: String(i + 1).padStart(2, '0'),
      hotkey: p.narrow ? undefined : KEYMAP[i],
      name: ph.name,
      hot: p.armed === i,
      onTrigger: () => p.onPress(i)
    }))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '10px 0 0',
        fontSize: 10.5,
        color: 'var(--text-meta)'
      }
    }, "Type the letter on each key to speak it \xB7 ", /*#__PURE__*/React.createElement(Kbd, null, "\u2190"), /*#__PURE__*/React.createElement(Kbd, null, "\u2192"), " scrub phrases \xB7 ", /*#__PURE__*/React.createElement(Kbd, null, "\u21E7"), /*#__PURE__*/React.createElement(Kbd, null, "R"), " repeat \xB7 ", /*#__PURE__*/React.createElement(Kbd, null, "R"), " new track \xB7 ", /*#__PURE__*/React.createElement(Kbd, null, "space"), " start the song \xB7 ", /*#__PURE__*/React.createElement(Kbd, null, "\u21E7"), /*#__PURE__*/React.createElement(Kbd, null, "\u2191"), "/", /*#__PURE__*/React.createElement(Kbd, null, "\u2193"), " delivery")), /*#__PURE__*/React.createElement(Bay, {
      title: "Registers",
      aside: "Cal. A",
      style: p.narrow ? {
        order: 2
      } : undefined
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: p.narrow ? 'row' : 'column',
        flexWrap: 'wrap',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Knob, {
      label: "Sincerity",
      value: p.sinc,
      onChange: p.onSinc
    }), /*#__PURE__*/React.createElement(Knob, {
      label: "Delivery",
      value: p.deliv,
      onChange: p.onDeliv
    }), /*#__PURE__*/React.createElement(Knob, {
      label: "Decay",
      value: p.decay,
      onChange: p.onDecay
    }), /*#__PURE__*/React.createElement(Knob, {
      label: "Tempo",
      value: (p.tempo - 60) / 140,
      onChange: v => p.onTempo(Math.round(60 + v * 140)),
      format: () => p.tempo + ' BPM'
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginTop: 16,
        borderTop: '1px dotted var(--hair)',
        paddingTop: 14
      }
    }, /*#__PURE__*/React.createElement(Scrubber, {
      label: "Pitch",
      value: p.pitch,
      onChange: p.onPitch,
      format: v => {
        const s = Math.round((v - .5) * 24);
        return `${s > 0 ? '+' : ''}${s} st`;
      }
    }), /*#__PURE__*/React.createElement(Scrubber, {
      label: "Weirdness",
      value: p.weird,
      onChange: p.onWeird
    }), /*#__PURE__*/React.createElement(Scrubber, {
      label: "Distortion",
      value: p.dist,
      onChange: p.onDist
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, CHARACTERS.map(c => /*#__PURE__*/React.createElement(Button, {
      key: c.id,
      on: p.character === c.id,
      onClick: () => p.onSetCharacter(c.id),
      style: {
        padding: '6px 8px'
      }
    }, c.name)))))), /*#__PURE__*/React.createElement(Bay, {
      title: `Sequencer · ${p.patLen} steps`,
      aside: /*#__PURE__*/React.createElement(Readout, null, p.pos === null ? '—' : String(p.pos + 1).padStart(2, '0')),
      style: {
        marginTop: 'var(--space-section)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: p.narrow ? 84 + p.patLen * 24 : undefined
      }
    }, /*#__PURE__*/React.createElement(StepGrid, {
      voices: p.voices,
      steps: p.patLen,
      pattern: p.pattern,
      onChange: p.onGrid,
      playhead: p.pos,
      selected: p.selRow,
      onSelect: p.onSelRow,
      labelW: p.narrow ? 84 : 110,
      onClearRow: p.onClearRow,
      voxLabels: p.voxLabels
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 9,
        alignItems: 'center',
        marginTop: 16,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      on: p.playing,
      onClick: p.onPlay
    }, p.playing ? 'Pause' : 'Play'), /*#__PURE__*/React.createElement(Button, {
      variant: "rec",
      on: p.rec,
      onClick: p.onRec
    }, p.rec ? 'Recording keys' : 'Record keys'), /*#__PURE__*/React.createElement(Button, {
      onClick: p.onNewTrack
    }, "New track"), /*#__PURE__*/React.createElement(Button, {
      onClick: p.onDemo
    }, "Demo beat"), /*#__PURE__*/React.createElement(Button, {
      onClick: p.onClear
    }, "Clear drums"), /*#__PURE__*/React.createElement(Button, {
      on: p.band,
      onClick: p.onBand
    }, "Band"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        marginLeft: 6
      }
    }, /*#__PURE__*/React.createElement(Silk, null, "Steps"), [16, 32, 48].map(n => /*#__PURE__*/React.createElement(Button, {
      key: n,
      on: p.patLen === n,
      onClick: () => p.onSteps(n),
      style: {
        padding: '7px 10px'
      }
    }, n))), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto'
      }
    }, /*#__PURE__*/React.createElement(Silk, {
      muted: true
    }, "Locked keeps the Vox row empty \xB7 double-click a track name to clear it"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 9,
        alignItems: 'center',
        marginTop: 12,
        flexWrap: 'wrap',
        borderTop: '1px dotted var(--hair)',
        paddingTop: 12
      }
    }, /*#__PURE__*/React.createElement(Silk, null, "Exhibits"), p.samples.map((s, i) => /*#__PURE__*/React.createElement("span", {
      key: s.id,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        border: 'var(--rule-frame) solid var(--ink)',
        background: 'var(--white)',
        padding: '5px 8px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      role: "button",
      style: {
        cursor: 'pointer',
        color: 'var(--blue)',
        fontFamily: 'var(--mono)',
        fontSize: 10.5
      }
    }, "\u25B8"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 9.5,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        maxWidth: 130,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, String.fromCharCode(65 + i), " \xB7 ", s.name), /*#__PURE__*/React.createElement("span", {
      onClick: () => p.onStrike(s.id),
      role: "button",
      style: {
        cursor: 'pointer',
        fontFamily: 'var(--mono)',
        fontSize: 10.5
      }
    }, "\xD7"))), /*#__PURE__*/React.createElement(Button, {
      onClick: p.onAdmit
    }, "Upload sound"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto'
      }
    }, /*#__PURE__*/React.createElement(Silk, {
      muted: true
    }, "Audio admitted into the record becomes a sequencer row")))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26,
        borderTop: 'var(--rule-heavy) solid var(--ink)',
        paddingTop: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Silk, {
      muted: true
    }, "An equal opportunity instrument"), !p.narrow && /*#__PURE__*/React.createElement(Silk, {
      muted: true
    }, "Circle Back\xAE is not affiliated with your network"), /*#__PURE__*/React.createElement(Stamp, null, "Approved \u2014 HR")));
  }
  Object.assign(window, {
    Studio
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/circleback/studio.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lessons/data.js
try { (() => {
// LinkedIn Lessons™ — the six doors and the dial. Copy lifted verbatim from
// src/lessons/categories.js and src/lessons/generator.js (LEVELS).
window.LL = (() => {
  const q = (key, ask, opts = {}) => ({
    key,
    ask,
    type: opts.options ? 'choice' : opts.long ? 'long' : 'text',
    ...opts
  });
  const CATEGORIES = [{
    id: 'announce',
    form: 'LL-01',
    name: 'Announce Something',
    subtitle: 'A hire, a promotion, a launch, a milestone — rendered historically significant.',
    steps: () => [q('kind', 'What are we announcing?', {
      options: ['A new hire', 'A promotion', 'A product launch', 'A partnership', 'A company milestone'],
      react: v => ({
        'A new hire': "Excellent. One person's first day, reframed as a defining chapter.",
        'A promotion': 'Wonderful. Upward mobility, but make it destiny.',
        'A product launch': 'A launch. The word "reimagine" is already warming up.',
        'A partnership': 'Two logos, one press release. Beautiful.',
        'A company milestone': 'A number is about to become a movement.'
      })[v]
    }), q('name', "What is the person's name?", {
      placeholder: 'Sarah',
      react: v => `Excellent. Let's make ${v || 'their'}'s employment feel historically significant.`
    }), q('role', 'What is their new role?', {
      placeholder: 'Marketing Coordinator',
      react: () => 'Noted. We will imply the role was created by fate.'
    }), q('before', 'Where were they before this?', {
      placeholder: 'A local nonprofit',
      react: () => 'A humble origin story. The arc writes itself.'
    }), q('quality', 'What suspiciously impressive quality do they bring?', {
      placeholder: 'Relentless organization',
      react: v => `"${v}". We will imply they invented it.`
    }), q('goal', 'What will they help your company accomplish?', {
      placeholder: 'Improve our content',
      react: () => 'Modest. We can fix that with the dial.'
    }), q('company', "What's your company called?", {
      placeholder: 'Acme Inc.',
      react: v => `${v || 'The company'} will never be the same. Allegedly.`
    })]
  }, {
    id: 'lesson',
    form: 'LL-02',
    name: 'Teach a Lesson',
    subtitle: 'Extract enterprise wisdom from something that was, at the time, nothing.',
    steps: () => [q('source', 'Where did this profound lesson come from?', {
      options: ['A failure', 'A tiny everyday moment', 'Something my kid said', 'A stranger at the airport', 'A book I have not finished'],
      react: v => ({
        'A failure': 'Brave. Failure is just success wearing a disguise, or so you are about to claim.',
        'A tiny everyday moment': 'Perfect. The smaller the moment, the larger the lesson.',
        'Something my kid said': 'A child is about to out-consult McKinsey.',
        'A stranger at the airport': 'Gate B7. Where all wisdom lives.',
        'A book I have not finished': 'Chapter one contains multitudes.'
      })[v]
    }), q('moment', 'What actually happened?', {
      long: true,
      placeholder: 'A barista remembered my order',
      react: () => 'Riveting. Now we monetize it emotionally.'
    }), q('lesson', 'What lesson are we extracting from this?', {
      placeholder: 'Consistency builds trust',
      react: v => `"${v}". Socrates found dead in a ditch.`
    }), q('topic', 'Which business topic does this secretly prove?', {
      options: ['B2B sales', 'Leadership', 'Hiring', 'Marketing', 'Company culture'],
      react: v => `Of course it's about ${(v || 'leadership').toLowerCase()}. It was always about ${(v || 'leadership').toLowerCase()}.`
    })]
  }, {
    id: 'sell',
    form: 'LL-03',
    name: 'Sell Without Selling',
    subtitle: "A customer story so moving nobody notices it's an ad.",
    steps: () => [q('offer', 'What do you sell?', {
      placeholder: 'Pipeline consulting',
      react: () => 'Noted. We will never mention it directly. Except constantly.'
    }), q('customer', "Who's the customer in this story? First name is plenty.", {
      placeholder: 'Dana',
      react: v => `${v || 'They'} is about to become the protagonist of a redemption arc.`
    }), q('problem', 'What problem were they "struggling" with?', {
      placeholder: 'A leaky sales pipeline',
      react: () => 'The darkness before the dawn. Excellent.'
    }), q('result', 'What suspiciously specific result did they get?', {
      placeholder: '312% more qualified leads',
      react: v => `${v || 'That number'}. Precise enough to sound measured, round enough to be marketing.`
    }), q('cta', 'What should readers do, ideally without noticing they were sold to?', {
      placeholder: 'Send me a message',
      react: () => 'Not selling. Just saying.'
    })]
  }, {
    id: 'urgency',
    form: 'LL-04',
    name: 'Manufacture Urgency',
    subtitle: 'Nothing is happening. Announce it like a countdown.',
    steps: () => [q('kind', 'What kind of urgency are we manufacturing?', {
      options: ["We're hiring", 'Limited spots', 'Launch countdown', 'Big things coming'],
      react: v => v === 'Big things coming' ? 'The vaguest of the urgency genres. Nothing needs to exist. Perfect.' : 'Scarcity: the only KPI that markets itself.'
    }), q('thing', 'What is it, concretely?', {
      placeholder: 'A Senior Product Designer role',
      react: () => 'Concrete. We will sand that down to a silhouette.'
    }), q('scarcity', 'How scarce are we pretending it is?', {
      placeholder: '48 hours / 3 spots',
      react: v => `${v || 'Limited'}. The universe said no to more. You asked. It refused.`
    }), q('audience', 'Who exactly should be panicking right now?', {
      placeholder: 'Designers who want real ownership',
      react: () => 'They will feel personally seen. That is the entire strategy.'
    })]
  }, {
    id: 'ai',
    form: 'LL-05',
    name: 'AI Thought Leadership',
    subtitle: 'Announce that you used a chatbot as though you personally invented artificial intelligence.',
    steps: () => [q('tool', 'Which AI tool did you just discover?', {
      placeholder: 'ChatGPT',
      react: v => `${v || 'It'} has existed for years. Today, it becomes news.`
    }), q('task', 'What did you actually use it for?', {
      placeholder: 'Write our quarterly report',
      react: () => 'A normal task. Soon: a glimpse of the singularity.'
    }), q('multiplier', 'How much faster are we claiming you are now?', {
      placeholder: '10x',
      react: v => `${v || '10x'}. A number no one will check and everyone will repeat.`
    }), q('doomed', 'What do you predict is dead in five years?', {
      placeholder: 'Consulting',
      react: v => `${v || 'It'} attended its own funeral and doesn't know it yet.`
    })]
  }, {
    id: 'roast',
    form: 'RM-1',
    name: 'Roast My LinkedIn',
    subtitle: 'Post, headline or About section. Four inspectors, intensity up to HR Violation.',
    href: '../roast/index.html'
  }];
  const LEVELS = [{
    n: 1,
    name: 'Almost Human',
    blurb: 'Clear, useful and relatively normal.'
  }, {
    n: 2,
    name: 'Professionally Optimized',
    blurb: 'Polished, with a modest amount of excitement.'
  }, {
    n: 3,
    name: 'Thought Leader',
    blurb: 'More lessons, gratitude and strategic alignment.'
  }, {
    n: 4,
    name: 'Peak LinkedIn',
    blurb: 'Humbled. Honored. Journey. Six unnecessary paragraphs.'
  }, {
    n: 5,
    name: 'Corporate Hallucination',
    blurb: 'An ordinary Tuesday becomes a transformational moment for the global business community.'
  }];
  const RANKS = [[0, 'Refreshingly Human'], [18, 'Aspiring Thought Leader'], [36, 'Executive Presence'], [54, 'Certified Visionary'], [72, 'Thought Leadership Singularity'], [88, 'Please Log Off']];
  const rankOf = s => {
    let r = RANKS[0][1];
    for (const [f, n] of RANKS) if (s >= f) r = n;
    return r;
  };

  // A cosmetic stand-in for src/lessons/generator.js: the same facts, escalated.
  function generate({
    answers = {},
    level = 4
  }) {
    const a = k => (answers[k] || '').trim();
    const name = a('name') || 'Sarah',
      role = a('role') || 'Marketing Coordinator';
    const co = a('company') || 'Acme Inc.',
      before = a('before') || 'a local nonprofit';
    const quality = a('quality') || 'relentless organization',
      goal = a('goal') || 'improve our content';
    if (level === 1) return `${name} is joining ${co} as our new ${role}.

She comes to us from ${before}, and what stood out in every conversation was her ${quality.toLowerCase()}.

She'll be helping us ${goal.toLowerCase()}. Welcome, ${name}.`;
    if (level === 2) return `I'm excited to share that ${name} has joined ${co} as our ${role}.

${name} joins us from ${before}, bringing ${quality.toLowerCase()} to a team that needed exactly that.

Her focus: helping us ${goal.toLowerCase()}. Great things ahead.

#Welcome #Hiring`;
    if (level === 3) return `Some exciting news: ${name} is joining ${co} as our ${role}. 🎉

Here's what I learned hiring for this role:

Credentials tell you where someone has been. ${quality} tells you where they're going.

${name} spent years at ${before}. That's not a stepping stone — that's a foundation.

She'll help us ${goal.toLowerCase()}, and I suspect a great deal more.

Welcome to the team, ${name}. The journey starts now.

#Leadership #Hiring #Culture #Growth`;
    if (level === 4) return `I'm humbled and honored to share some personal news.

${name} has joined ${co} as our ${role}.

Let that sink in.

When I first met ${name}, she was at ${before}. Most people saw a résumé. I saw ${quality.toLowerCase()}.

It's not about the credentials. It's about the mindset.

Her mandate? To ${goal.toLowerCase()}. But if I'm honest, her real mandate is bigger than that.

Grateful for this incredible journey and the amazing team who made it possible. Onwards and upwards! 🚀

Welcome aboard, ${name}. Thoughts? 👇

#Humbled #Blessed #Journey #Leadership #Hiring #Synergy`;
    return `I don't usually post about myself.

But today, something happened that I believe will be studied.

${name} — formerly of ${before} — has joined ${co} as ${role}. 🙏

Humbled. Honored. Grateful. Beyond blessed.

This is not a hire. This is a rich tapestry of alignment, delved into over six weeks and three coffees.

Most people won't understand this. But you will.

Her ${quality.toLowerCase()} is not a skill. It is a testament to what happens when the intersection of purpose and bandwidth is finally leveraged at scale.

Will she ${goal.toLowerCase()}? Yes. Will she also fundamentally reframe what the global business community understands about Tuesdays? I have said too much.

Full stop.

The journey does not end here. It has, in a very real sense, only begun to circle back.

Tag someone who needs to hear this. 👇🚀

#Humbled #Blessed #Journey #Synergy #ThoughtLeadership #Leadership #AI #Disruption`;
  }
  const count = (t, re) => (t.match(re) || []).length;
  function scorePost(text) {
    const t = String(text || '');
    const words = Math.max(1, t.trim() ? t.trim().split(/\s+/).length : 1);
    const paras = t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const oneLiners = paras.filter(p => p.length <= 60 && !/^#/.test(p)).length;
    const buzz = count(t, /\b(synerg\w*|leverag\w*|pivot\w*|bandwidth|align\w*|scal\w*|ecosystem|empower\w*|optimiz\w*|disrupt\w*|transform\w*|innovat\w*|holistic|robust|game-?chang\w*|category-defining)\b/gi);
    const gratitude = count(t, /\b(grateful|gratitude|thank(?:ful|s| you)?|humbled|honou?red|blessed)\b/gi);
    const humble = count(t, /\b(humbled|honou?red|blessed)\b/gi);
    const brag = count(t, /\b(proud|thrilled|excited|incredible|amazing|historic|extraordinary)\b/gi);
    const tells = count(t, /\b(delve\w*|tapestry|testament|realm|underscore|pivotal|meticulous)\b/gi);
    const bait = count(t, /\b(thoughts\?|agree\?|let that sink in|read that again|tag someone|repost if|drop a comment)\b/gi);
    const journeys = count(t, /\b(journey|chapter|adventure|era|movement)\b/gi);
    const tags = count(t, /#\w+/g);
    const emoji = count(t, /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/gu);
    const index = Math.min(100, Math.round(gratitude * 6 + buzz * 5 + tells * 8 + bait * 9 + journeys * 4 + tags * 3 + emoji * 2 + oneLiners * 2));
    const gratitudeInflation = Math.max(0, gratitude - 1);
    return {
      index,
      rank: rankOf(index),
      words,
      markers: [['Performative gratitude', gratitude], ['Buzzwords', buzz], ['AI tells', tells], ['Engagement bait', bait], ['Journey language', journeys], ['Hashtags', tags], ['Emoji', emoji]].filter(([, c]) => c > 0).map(([label, count]) => ({
        label,
        count
      })),
      humbleBrag: Math.min(100, Math.round(humble * 22 + brag * 7 + oneLiners * 3 + index * .25)),
      buzzDensity: Math.round(buzz / words * 1000) / 10,
      gratitude,
      gratitudeInflation,
      gratitudeLabel: gratitude === 0 ? 'None detected. Cold.' : gratitude === 1 ? 'Within normal parameters' : gratitude <= 3 ? `Elevated (+${gratitudeInflation} unearned)` : `Runaway gratitude event (+${gratitudeInflation})`,
      oneLiners,
      journeys,
      wellDeserved: Math.min(99, Math.round(8 + 34 + index * .45 + oneLiners * 2 + Math.min(gratitude, 4) * 3))
    };
  }
  const roast = text => {
    const s = scorePost(text);
    const out = [];
    if (/humbled/i.test(text)) out.push('"Humbled" is doing a great deal of work here, and none of it is humility.');
    if (s.journeys) out.push(`${s.journeys} journey reference${s.journeys > 1 ? 's' : ''}. This is a hire, not the Odyssey.`);
    if (s.markers.find(m => m.label === 'AI tells')) out.push('"Tapestry" and "delve" in the same post. The model is showing.');
    if (s.oneLiners > 3) out.push(`${s.oneLiners} one-line paragraphs. Broetry is a formatting choice, not a personality.`);
    if (s.index >= 70) out.push(`Thought Leadership Index: ${s.index}/100. At this level, disclosure to the SEC may be required.`);else out.push(`Thought Leadership Index: ${s.index}/100. Certified. Condolences to your connections.`);
    return out;
  };
  return {
    CATEGORIES,
    LEVELS,
    byId: id => CATEGORIES.find(c => c.id === id),
    generate,
    scorePost,
    roast
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lessons/data.js", error: String((e && e.message) || e) }); }

// ui_kits/lessons/screens.jsx
try { (() => {
(() => {
  const {
    Button,
    Ticker
  } = window.CircleBackDesignSystem_7570bb;
  const {
    CATEGORIES,
    LEVELS,
    byId
  } = window.LL;
  const LABEL = {
    fontSize: 'var(--label-size)',
    fontWeight: 700,
    letterSpacing: 'var(--label-tracking)',
    textTransform: 'uppercase'
  };
  const META = {
    ...LABEL,
    color: 'var(--text-meta)'
  };

  // ---- the LinkedIn-style preview card ------------------------------------
  function Post({
    text,
    score,
    narrow
  }) {
    const paras = text.split(/\n{2,}/);
    const reactions = 3 + Math.round(score.index * 8.4) + score.oneLiners * 11;
    const comments = 1 + Math.round(score.wellDeserved / 6);
    const reposts = Math.round(score.index / 9);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: 'var(--rule-frame) solid var(--ink)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '14px 16px 0'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'var(--blue)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 15,
        flex: 'none'
      }
    }, "YU"), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 700
      }
    }, "You ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-meta)',
        fontWeight: 400
      }
    }, "\xB7 1st")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--text-meta)'
      }
    }, "Chief Vision Officer \xB7 Thought leader"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--text-meta)'
      }
    }, "2h \xB7 \uD83C\uDF10"))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: narrow ? '12px 16px' : '14px 16px',
        fontSize: 14,
        lineHeight: 1.5
      }
    }, paras.map((pp, i) => /*#__PURE__*/React.createElement("p", {
      key: i,
      style: {
        margin: i ? '12px 0 0' : 0,
        whiteSpace: 'pre-wrap',
        color: /^(#\w+\s*)+$/.test(pp) ? 'var(--blue)' : 'inherit'
      }
    }, pp))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderTop: '1px solid var(--hair)',
        fontSize: 11.5,
        color: 'var(--text-meta)'
      }
    }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDC4D\u2764\uFE0F\uD83D\uDCA1 ", reactions.toLocaleString()), /*#__PURE__*/React.createElement("span", null, comments, " comments \xB7 ", reposts, " reposts")));
  }

  // ---- the metrics panel --------------------------------------------------
  function Metric({
    label,
    value,
    note
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'baseline',
        borderBottom: '1px dotted var(--hair)',
        padding: '6px 0'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...META,
        fontSize: 9
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 12,
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--blue)'
      }
    }, value), note ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-meta)'
      }
    }, " ", note) : null));
  }
  function Metrics({
    s
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: 'var(--rule-frame) solid var(--ink)',
        padding: '12px 14px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: LABEL
    }, "Post diagnostics"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--text-meta)'
      }
    }, s.words, " words")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        borderBottom: '1px solid var(--hair)',
        paddingBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 44,
        fontWeight: 700,
        letterSpacing: '-.05em',
        lineHeight: 1,
        color: 'var(--blue)'
      }
    }, s.index), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700
      }
    }, s.rank, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        ...META,
        fontSize: 8.5
      }
    }, "Thought Leadership Index"))), /*#__PURE__*/React.createElement(Metric, {
      label: "Humble-brag score",
      value: s.humbleBrag + '%'
    }), /*#__PURE__*/React.createElement(Metric, {
      label: "Buzzword density",
      value: s.buzzDensity,
      note: "per 100 words"
    }), /*#__PURE__*/React.createElement(Metric, {
      label: "Gratitude inflation",
      value: s.gratitude,
      note: '· ' + s.gratitudeLabel
    }), /*#__PURE__*/React.createElement(Metric, {
      label: "Dramatic one-liners",
      value: s.oneLiners
    }), /*#__PURE__*/React.createElement(Metric, {
      label: "Journey references",
      value: s.journeys
    }), /*#__PURE__*/React.createElement(Metric, {
      label: 'Chance of "Well deserved!"',
      value: s.wellDeserved + '%'
    }));
  }

  // ---- the LinkedInification dial ----------------------------------------
  function Dial({
    level,
    onChange
  }) {
    const cur = LEVELS[level - 1];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: 'var(--rule-frame) solid var(--ink)',
        padding: '12px 14px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...LABEL,
        marginBottom: 8
      }
    }, "LinkedInification level"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 6
      }
    }, LEVELS.map(l => /*#__PURE__*/React.createElement("button", {
      key: l.n,
      type: "button",
      onClick: () => onChange(l.n),
      style: {
        height: 40,
        border: 'var(--rule-frame) solid var(--ink)',
        borderRadius: 0,
        cursor: 'pointer',
        background: l.n === level ? 'var(--blue)' : l.n < level ? 'var(--blue-light)' : '#fff',
        color: l.n === level ? '#fff' : 'var(--ink)',
        fontFamily: 'var(--sans)',
        fontWeight: 700,
        fontSize: 15
      }
    }, l.n))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: 700
      }
    }, cur.n, " \u2014 ", cur.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--text-meta)',
        lineHeight: 1.45
      }
    }, cur.blurb));
  }

  // ---- screens ------------------------------------------------------------
  function CategoryCard({
    c,
    onPick
  }) {
    const [hover, setHover] = React.useState(false);
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onPick(c.id),
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        textAlign: 'left',
        cursor: 'pointer',
        border: 'var(--rule-frame) solid var(--ink)',
        borderRadius: 0,
        background: hover ? 'var(--ink)' : '#fff',
        color: hover ? '#fff' : 'var(--ink)',
        padding: '16px 18px',
        fontFamily: 'var(--sans)',
        transition: 'background var(--ease-ui), color var(--ease-ui)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...META,
        color: hover ? '#ffffff99' : 'var(--text-meta)',
        marginBottom: 6
      }
    }, "Form ", c.form), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 19,
        fontWeight: 700,
        letterSpacing: '-.02em'
      }
    }, c.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        lineHeight: 1.45,
        marginTop: 4,
        color: hover ? '#ffffffcc' : 'var(--ink)'
      }
    }, c.subtitle));
  }
  function Home({
    narrow,
    onPick
  }) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: narrow ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: narrow ? 'flex-start' : 'flex-end',
        gap: narrow ? 10 : 30,
        marginTop: 18
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontSize: narrow ? 28 : 40,
        lineHeight: 1.02,
        letterSpacing: '-.045em',
        fontWeight: 700,
        color: 'var(--blue)',
        maxWidth: 560
      }
    }, "What are we pretending to be humbled about today?"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: narrow ? 12.5 : 13,
        lineHeight: 1.45,
        maxWidth: 380
      }
    }, "A guided post generator. Answer a few questions, choose your LinkedInification level, publish.", ' ', /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--blue)'
      }
    }, "Create a better LinkedIn post \u2014 or make it dramatically worse."))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
        gap: 12,
        marginTop: 22
      }
    }, CATEGORIES.map(c => /*#__PURE__*/React.createElement(CategoryCard, {
      key: c.id,
      c: c,
      onPick: onPick
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        ...META
      }
    }, /*#__PURE__*/React.createElement("span", null, "Everything is generated in your browser. Nothing is sent anywhere."), /*#__PURE__*/React.createElement("a", {
      href: "../circleback/index.html"
    }, "Circle Back\xAE \u2014 the LinkedIn remixer \u2192")));
  }
  function Interview({
    cat,
    narrow,
    initial,
    onDone,
    onHome
  }) {
    const [answers, setAnswers] = React.useState(initial || {});
    const [ix, setIx] = React.useState(0);
    const [reaction, setReaction] = React.useState(null);
    const [draft, setDraft] = React.useState('');
    const inputRef = React.useRef(null);
    const steps = cat.steps(answers);
    const step = steps[ix];
    React.useEffect(() => {
      inputRef.current && inputRef.current.focus();
    }, [ix]);
    const submit = value => {
      const v = (value !== undefined ? value : draft).trim() || step.placeholder || '';
      const next = {
        ...answers,
        [step.key]: v
      };
      setAnswers(next);
      setReaction(step.react ? step.react(v, next) : null);
      setDraft('');
      if (ix + 1 >= cat.steps(next).length) onDone(next);else setIx(ix + 1);
    };
    const back = () => {
      if (ix === 0) return onHome();
      setIx(ix - 1);
      setReaction(null);
      setDraft(answers[steps[ix - 1].key] || '');
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        marginTop: 18,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 19,
        fontWeight: 700,
        letterSpacing: '-.02em',
        color: 'var(--blue)'
      }
    }, cat.name), /*#__PURE__*/React.createElement("span", {
      style: META
    }, "Question ", ix + 1, " of ", steps.length, " \xB7 Form ", cat.form)), reaction && /*#__PURE__*/React.createElement(Ticker, {
      label: "The form reacts",
      style: {
        marginTop: 14
      }
    }, reaction), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: reaction ? 14 : 18,
        background: '#fff',
        border: 'var(--rule-frame) solid var(--ink)',
        padding: narrow ? 18 : 26
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: narrow ? 21 : 27,
        fontWeight: 700,
        letterSpacing: '-.03em',
        lineHeight: 1.15
      }
    }, step.ask), step.type === 'choice' ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginTop: 16
      }
    }, step.options.map(o => /*#__PURE__*/React.createElement(Button, {
      key: o,
      onClick: () => submit(o),
      style: {
        padding: '12px 16px'
      }
    }, o))) : /*#__PURE__*/React.createElement(React.Fragment, null, step.type === 'long' ? /*#__PURE__*/React.createElement("textarea", {
      ref: inputRef,
      value: draft,
      onChange: e => setDraft(e.target.value),
      rows: 3,
      placeholder: step.placeholder || '',
      style: {
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 16,
        padding: 12,
        fontFamily: 'var(--sans)',
        fontSize: 15,
        lineHeight: 1.5,
        border: 'var(--rule-frame) solid var(--ink)',
        borderRadius: 0,
        background: 'var(--paper)',
        outline: 'none',
        resize: 'vertical'
      }
    }) : /*#__PURE__*/React.createElement("input", {
      ref: inputRef,
      value: draft,
      onChange: e => setDraft(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') submit();
      },
      placeholder: step.placeholder || '',
      style: {
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 16,
        padding: 12,
        fontFamily: 'var(--sans)',
        fontSize: 17,
        border: 'var(--rule-frame) solid var(--ink)',
        borderRadius: 0,
        background: 'var(--paper)',
        outline: 'none'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        marginTop: 14,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: () => submit(),
      style: {
        padding: 'var(--btn-pad-lg)'
      }
    }, "Next"), /*#__PURE__*/React.createElement("span", {
      style: {
        ...META,
        fontSize: 8.5
      }
    }, step.type === 'long' ? '' : 'or press Enter')))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: back
    }, "\u2190 Back")));
  }
  function Result({
    catId,
    answers,
    narrow,
    onHome,
    onReinterview
  }) {
    const {
      generate,
      scorePost,
      roast
    } = window.LL;
    const [level, setLevel] = React.useState(4);
    const [roastOpen, setRoastOpen] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const text = React.useMemo(() => generate({
      answers,
      level
    }), [answers, level]);
    const s = React.useMemo(() => scorePost(text), [text]);
    const roastLines = React.useMemo(() => roastOpen ? roast(text) : null, [roastOpen, text]);
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {}
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        marginTop: 18,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: narrow ? 22 : 27,
        fontWeight: 700,
        letterSpacing: '-.03em',
        color: 'var(--blue)'
      }
    }, "Your supercharged post"), /*#__PURE__*/React.createElement("span", {
      style: META
    }, byId(catId).name, " \xB7 Form ", byId(catId).form)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) 340px',
        gap: narrow ? 14 : 'var(--space-col)',
        marginTop: 14,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Post, {
      text: text,
      score: s,
      narrow: narrow
    }), roastOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: 'var(--rule-frame) solid var(--blue)',
        padding: '12px 14px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...LABEL,
        color: 'var(--blue)',
        marginBottom: 6
      }
    }, "The roast"), roastLines.map((l, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        fontSize: 13,
        lineHeight: 1.6,
        borderBottom: '1px dotted var(--hair)',
        padding: '4px 0'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--blue)',
        fontWeight: 700
      }
    }, "\u2192 "), l)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Dial, {
      level: level,
      onChange: setLevel
    }), /*#__PURE__*/React.createElement(Metrics, {
      s: s
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: copy,
      on: copied,
      style: {
        gridColumn: '1 / -1',
        padding: '13px 16px'
      }
    }, copied ? 'Copied ✓' : 'Copy post'), /*#__PURE__*/React.createElement(Button, {
      onClick: () => setLevel(l => Math.min(5, l + 1))
    }, "Make it worse"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => setLevel(1)
    }, "Make it human"), /*#__PURE__*/React.createElement(Button, {
      on: roastOpen,
      onClick: () => setRoastOpen(o => !o)
    }, "Roast this post"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        location.href = '../roast/index.html';
      }
    }, "Send to Roast\u2122"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        location.href = '../circleback/index.html';
      },
      style: {
        gridColumn: '1 / -1'
      }
    }, "Turn it into a beat \u266B")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: onReinterview
    }, "Edit answers"), /*#__PURE__*/React.createElement(Button, {
      onClick: onHome
    }, "New post")))));
  }
  Object.assign(window, {
    Home,
    Interview,
    Result,
    Post,
    Metrics,
    Dial
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lessons/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/museum/data.js
try { (() => {
// The Museum of Professional Communication — the permanent collection.
// Exhibits (6 of the 12), the Historical Archive and the redactor's placeholders,
// verbatim from src/museum/exhibits.js, timeline.js and redactor.js.
window.MM = (() => {
  const EXHIBITS = [{
    "no": "A-01",
    "date": "c. 2019",
    "title": "The Airport Epiphany",
    "medium": "Post, 94 words, boarding area",
    "body": "Gate B7. Flight delayed 3 hours.\n\nThe man next to me was crying.\n\nI asked him if he was okay. He said: \"I just closed the biggest deal of my life. And I have no one to tell.\"\n\nWe talked for two hours. He is now the [REDACTED TITLE] of [REDACTED FORTUNE 500 COMPANY].\n\nHere is what that stranger taught me about B2B sales:\n\nPeople don't buy products. People buy being heard.\n\nLet that sink in.\n\n#Sales #Leadership #AirportWisdom",
    "plaque": "The defining work of the departure-lounge period. Note the delayed flight, the crying executive, and the pivot to B2B sales executed within nine words of a human moment. Historians have never located Gate B7.",
    "quote": {
      "by": "The Burned-Out Recruiter",
      "text": "Every airport in this genre has a Gate B7. No airport has a Gate B7."
    },
    "index": 38
  }, {
    "no": "A-02",
    "date": "c. 2021",
    "title": "Humbled: A Self-Portrait",
    "medium": "Promotion announcement, gratitude pigment on corporate blue",
    "body": "I don't post about myself often.\n\nBut today I am deeply humbled to announce that I, [ANONYMOUS VISIONARY], have been promoted to [REDACTED TITLE] at [REDACTED FORTUNE 500 COMPANY].\n\nHumbled. Honored. Grateful. Beyond blessed. 🙏\n\nThis is not about me. It has never been about me.\n\nWhich is why I am posting it, about me, with my photo attached.\n\nTo everyone who believed: this journey is just beginning.\n\n#Humbled #Blessed #Journey #Leadership",
    "plaque": "A masterwork of the humble brag, notable for achieving full self-contradiction in under 80 words. The artist claims the post is not about them in the same breath used to attach a headshot. Acquired for the permanent collection over the artist’s (loud) objections.",
    "quote": {
      "by": "The McKinsey Partner",
      "text": "A press release about humility. A 2x2 with no viable quadrant."
    },
    "index": 62
  }, {
    "no": "A-03",
    "date": "c. 2020",
    "title": "It Was Never About the Coffee",
    "medium": "Everyday-moment epiphany, oat milk",
    "body": "This morning, my barista remembered my order.\n\nA small thing? Maybe.\n\nBut I stopped. I thought about it all day.\n\nBecause here is what [REDACTED BARISTA] understands that most Fortune 500 leadership teams do not:\n\nConsistency builds trust.\n\nRead that again.\n\nEverything I know about company culture, I learned before 8 AM, for $6.50.\n\nAgree?\n\n#Leadership #CompanyCulture #CoffeeThoughts",
    "plaque": "Exemplary of the small-moment school: an ordinary kindness is detained, interrogated, and made to confess a business lesson. The barista, reached for comment, remembered the order but not the artist.",
    "quote": {
      "by": "The Gen-Z Intern",
      "text": "the barista was doing their job bestie. the lesson is they have a POS system"
    },
    "index": 44
  }, {
    "no": "A-08",
    "date": "c. 2024",
    "title": "The Rocket Garden",
    "medium": "Product launch, nine rockets, no payload",
    "body": "🚀 BIG NEWS 🚀\n\nAfter months in stealth, [REDACTED STARTUP] is LIVE! 🚀\n\nWe are reimagining the future of [REDACTED INDUSTRY] with an AI-first, human-centered, category-defining platform. 🚀🚀\n\nWhat does it do? The better question is what DOESN'T it do. 🚀\n\n(It is a dashboard.)\n\nHuge thanks to our incredible team, our visionary investors, and everyone who believed. 🚀🚀🚀\n\nThe journey starts NOW.\n\n#Launch #AI #Innovation #Disruption #StartupLife",
    "plaque": "Nine rockets accompany the launch of one dashboard — the highest propulsion-to-product ratio ever acquired by the museum. The parenthetical confession \"(It is a dashboard.)\" was added by the curator and is now the exhibit’s most-photographed element.",
    "quote": {
      "by": "The Algorithm",
      "text": "🚀 × 9 detected. Payload: a dashboard. Altitude achieved: sea level."
    },
    "index": 71
  }, {
    "no": "A-11",
    "date": "c. 2022",
    "title": "Weeping Executive (Reproduction)",
    "medium": "Selfie with caption, salt water",
    "body": "This is the hardest post I have ever had to write.\n\nToday I had to let some team members go. So I want to talk about how hard this has been.\n\nFor me.\n\nI have not slept. I have barely eaten. As you can see from the attached high-resolution photo of my face, I have been crying.\n\nLeadership is carrying this weight so my team doesn't have to. (They have to carry a different weight: the layoff.)\n\nBe kind to CEOs. We are struggling too.\n\n#Leadership #Vulnerability #Authenticity",
    "plaque": "Reproduction; the original remains in a private collection and in every retrospective of the platform since. The work established the genre in which an executive’s grief over a layoff is centered above the layoff itself. The camera, critics note, was already open.",
    "quote": {
      "by": "The McKinsey Partner",
      "text": "The restructuring communicated itself as a self-portrait. Bold governance."
    },
    "index": 29
  }, {
    "no": "A-12",
    "date": "2026",
    "title": "Agree?",
    "medium": "Post, one word, engagement bait",
    "body": "Hard work beats talent.\n\nAgree?",
    "plaque": "The minimalist capstone of the collection. Two truisms and a trap: a question engineered so that no answer can harm the artist. Acquired the day it was posted; it had 40,000 reactions by the time the plaque was engraved. Nobody disagreed. Nobody could.",
    "quote": {
      "by": "The Algorithm",
      "text": "Maximum engagement, minimum content. From my side of the glass: the perfect post. I hate it here."
    },
    "index": 22
  }];
  const TIMELINE = [{
    "year": "2003",
    "title": "The Founding",
    "note": "A website for résumés is launched. For several years, nobody posts anything. Scholars call this \"the golden age.\""
  }, {
    "year": "2005",
    "title": "People You May Know",
    "note": "The platform begins suggesting connections. You do, in fact, know some of them. This is never forgiven."
  }, {
    "year": "2012",
    "title": "The Endorsement Era",
    "note": "Users may now endorse each other for skills. Your aunt endorses you for Java. You do not know Java. The economy of unearned credentials is born."
  }, {
    "year": "2014",
    "title": "The Influencer Program",
    "note": "Publishing opens to all members, establishing the thought in thought leadership as optional."
  }, {
    "year": "2016",
    "title": "The Broetry Period",
    "note": "A formatting movement in which every sentence.\n\nBecomes its own paragraph.\n\nFor impact.\n\nReach triples. Literacy files a complaint."
  }, {
    "year": "2017",
    "title": "The Parable Boom",
    "note": "Baristas, toddlers, strangers at airports, and one famous janitor begin teaching B2B sales in unprecedented numbers. None are compensated."
  }, {
    "year": "2020",
    "title": "The Green Frame",
    "note": "The #OpenToWork photo frame launches into a pandemic. A genuinely useful feature — the archive notes this happens occasionally, to keep everyone off balance."
  }, {
    "year": "2022",
    "title": "The Weeping Executive",
    "note": "A CEO posts a crying selfie about conducting layoffs, centering the layoffs’ effect on himself. The genre of executive vulnerability reaches its terminal form. See Exhibit A-11."
  }, {
    "year": "2023",
    "title": "The Delve Era",
    "note": "Language models arrive. \"Delve,\" \"tapestry,\" and \"testament\" enter the feed at industrial volume. For the first time in history, posts are written by no one."
  }, {
    "year": "2023",
    "title": "Collaborative Articles",
    "note": "The platform invites members to co-write AI-outlined articles in exchange for a Top Voice badge. Supply of Top Voices exceeds supply of voices."
  }, {
    "year": "2024",
    "title": "The Badge Correction",
    "note": "The badges are quietly retired. Millions of headlines do not get the memo. Many still have not."
  }, {
    "year": "2026",
    "title": "You Are Here",
    "note": "The Museum of Professional Communication opens its permanent collection, so that none of this is ever forgotten, no matter how hard everyone tries."
  }];
  const PEOPLE = ['[ANONYMOUS VISIONARY]', '[NAME WITHHELD BY CURATOR]', '[A REDACTED COLLEAGUE]', '[CERTIFIED THOUGHT LEADER]'];
  // The Redaction Office: identity is removed here, in the browser, before anything is sent anywhere.
  function redact(text) {
    let t = String(text || ''),
      n = 0;
    const sub = (re, to) => {
      t = t.replace(re, m => {
        n++;
        return typeof to === 'function' ? to(m) : to;
      });
    };
    sub(/https?:\/\/\S+|\bwww\.\S+/gi, '[LINK REMOVED]');
    sub(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[EMAIL WITHHELD]');
    sub(/@[A-Za-z0-9_]{2,}/g, '[HANDLE WITHHELD]');
    sub(/\b(?:[A-Z][\w&.'-]*\s)*(?:Inc|LLC|Ltd|Corp|Co|GmbH|PLC)\b\.?/g, '[REDACTED FORTUNE 500 COMPANY]');
    sub(/\$\s?[\d,.]+\s?(?:k|m|b|million|billion|MM)?\b/gi, '[IMPRESSIVE SUM]');
    sub(/\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s?%/g, '[IMPRESSIVE NUMBER]');
    sub(/\b\d+x\b/gi, '[IMPRESSIVE MULTIPLE]');
    // Capitalised full names → an anonymous visionary
    let i = 0;
    sub(/\b([A-Z][a-z]{2,})\s([A-Z][a-z]{2,})\b/g, () => PEOPLE[i++ % PEOPLE.length]);
    // Remaining Capitalised standalone first names, mid-sentence
    sub(/(?<=[a-z,] )([A-Z][a-z]{2,})(?=[ ,.'])/g, '[A REDACTED COLLEAGUE]');
    return {
      text: t,
      redactions: n
    };
  }
  return {
    EXHIBITS,
    TIMELINE,
    redact
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/museum/data.js", error: String((e && e.message) || e) }); }

// ui_kits/museum/screens.jsx
try { (() => {
(() => {
  const {
    Button
  } = window.CircleBackDesignSystem_7570bb;
  const LABEL = {
    fontSize: 'var(--label-size)',
    fontWeight: 700,
    letterSpacing: 'var(--label-tracking)',
    textTransform: 'uppercase'
  };
  const META = {
    ...LABEL,
    color: 'var(--text-meta)'
  };

  /** Running text with [REDACTED …] placeholders set as blue chips. */
  function Redacted({
    text,
    size = 13.5
  }) {
    const paras = String(text).split(/\n{2,}/);
    return /*#__PURE__*/React.createElement(React.Fragment, null, paras.map((p, i) => /*#__PURE__*/React.createElement("p", {
      key: i,
      style: {
        margin: i ? '10px 0 0' : 0,
        fontSize: size,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap'
      }
    }, p.split(/(\[[A-Z@][A-Z0-9 @'’&.-]*\])/g).map((seg, j) => /^\[[A-Z@]/.test(seg) ? /*#__PURE__*/React.createElement("span", {
      key: j,
      style: {
        background: 'var(--blue)',
        color: '#fff',
        padding: '0 4px',
        fontSize: size - 2.5,
        fontWeight: 700,
        letterSpacing: '.04em'
      }
    }, seg) : seg))));
  }
  function SectionRule({
    no,
    title
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 34,
        borderTop: 'var(--rule-section) solid var(--ink)',
        paddingTop: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '-.02em',
        color: 'var(--blue)'
      }
    }, title), /*#__PURE__*/React.createElement("span", {
      style: META
    }, "Wing ", no));
  }
  function Exhibit({
    e
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: 'var(--rule-frame) solid var(--ink)',
        display: 'flex',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 16px',
        borderBottom: '1px solid var(--hair)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-.02em'
      }
    }, e.title), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'var(--text-meta)',
        letterSpacing: '.08em'
      }
    }, "EXHIBIT ", e.no, " \xB7 ", e.date.toUpperCase())), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '14px 16px',
        background: 'var(--paper)',
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Redacted, {
      text: e.body
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 16px',
        borderTop: '1px solid var(--hair)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        lineHeight: 1.55,
        fontStyle: 'italic',
        color: 'var(--text-meta)'
      }
    }, e.plaque), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--blue)',
        fontWeight: 700
      }
    }, "\u201C", e.quote.text, "\u201D"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-meta)'
      }
    }, " \u2014 ", e.quote.by)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
        color: 'var(--text-meta)'
      }
    }, e.medium, " \xB7 index ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--blue)'
      }
    }, e.index)), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        display: 'inline-flex',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        location.href = '../roast/index.html';
      },
      style: {
        padding: 'var(--btn-pad-sm)'
      }
    }, "Roast it"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        location.href = '../circleback/index.html';
      },
      style: {
        padding: 'var(--btn-pad-sm)'
      }
    }, "Play it \u266B")))));
  }
  function RedactionOffice({
    narrow
  }) {
    const {
      redact
    } = window.MM;
    const [draft, setDraft] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    const result = React.useMemo(() => draft.trim() ? redact(draft) : null, [draft]);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
        gap: 14,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: 'var(--rule-frame) solid var(--ink)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: META
    }, "Step 1 \u2014 Paste the evidence"), /*#__PURE__*/React.createElement("textarea", {
      value: draft,
      onChange: e => setDraft(e.target.value),
      rows: narrow ? 7 : 10,
      placeholder: "Paste the post here. A colleague's. A stranger's. Yours \u2014 the museum does not judge. (It judges.)",
      style: {
        width: '100%',
        boxSizing: 'border-box',
        resize: 'vertical',
        padding: 12,
        fontFamily: 'var(--sans)',
        fontSize: 13.5,
        lineHeight: 1.5,
        border: 'var(--rule-frame) solid var(--ink)',
        borderRadius: 0,
        background: 'var(--paper)',
        outline: 'none'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        ...META,
        fontSize: 8.5
      }
    }, "Names, companies, handles, links and impressive numbers are removed automatically, in your browser.")), /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: 'var(--rule-frame) solid ' + (result ? 'var(--blue)' : 'var(--ink)'),
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...META,
        color: result ? 'var(--blue)' : 'var(--text-meta)'
      }
    }, "Step 2 \u2014 The redacted document"), result && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
        color: 'var(--text-meta)'
      }
    }, result.redactions, " redaction", result.redactions === 1 ? '' : 's', " performed")), result ? /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--paper)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement(Redacted, {
      text: result.text
    })) : /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--text-meta)',
        lineHeight: 1.5
      }
    }, "The anonymized version appears here before anything is submitted. What you see is exactly what the curator receives."), result && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(result.text);
        } catch (e) {}
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    }, copied ? 'Copied ✓' : 'Copy document'), /*#__PURE__*/React.createElement(Button, null, "Submit to the collection \u2192")), /*#__PURE__*/React.createElement("span", {
      style: {
        ...META,
        fontSize: 8.5
      }
    }, "Submissions open a review with the curator \u2014 nothing publishes automatically, and only the redacted document is sent.")));
  }
  function Archive({
    narrow
  }) {
    const {
      TIMELINE
    } = window.MM;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        background: '#fff',
        border: 'var(--rule-frame) solid var(--ink)',
        padding: narrow ? '4px 16px' : '6px 22px'
      }
    }, TIMELINE.map((t, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'grid',
        gridTemplateColumns: narrow ? '52px 1fr' : '72px 220px 1fr',
        gap: 12,
        padding: '12px 0',
        borderBottom: i < TIMELINE.length - 1 ? '1px dotted var(--hair)' : 'none',
        alignItems: 'baseline'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--blue)'
      }
    }, t.year), narrow ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement("b", null, t.title, "."), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        whiteSpace: 'pre-wrap'
      }
    }, t.note)) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 700
      }
    }, t.title), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap'
      }
    }, t.note)))));
  }
  Object.assign(window, {
    Redacted,
    SectionRule,
    Exhibit,
    RedactionOffice,
    Archive
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/museum/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/roast/data.js
try { (() => {
// Roast My LinkedIn™ — the inspection office. PERSONAS, INTENSITIES, KINDS and the
// frame openers/closers are verbatim from src/roast/personas.js and src/roast/roastEngine.js.
// The findings bank here is a sample of the real 27 findings.
window.RM = (() => {
  const KINDS = [{
    id: 'post',
    name: 'My post',
    hint: 'Paste the draft. Yes, that one.'
  }, {
    id: 'headline',
    name: 'My headline',
    hint: 'The line under your name. Pipes and all.'
  }, {
    id: 'about',
    name: 'My About',
    hint: 'The autobiography nobody scrolls.'
  }];
  const PERSONAS = [{
    id: 'partner',
    name: 'The McKinsey Partner',
    tagline: 'Bills by the observation.'
  }, {
    id: 'recruiter',
    name: 'The Burned-Out Recruiter',
    tagline: '11,000 profiles deep. Nothing surprises them.'
  }, {
    id: 'intern',
    name: 'The Gen-Z Intern',
    tagline: 'Reviewing your personal brand, unpaid.'
  }, {
    id: 'algorithm',
    name: 'The Algorithm',
    tagline: 'It has already decided your reach.'
  }];
  const INTENSITIES = [{
    n: 1,
    name: 'Gentle Feedback',
    blurb: 'Constructive. Almost kind. A warm-up.'
  }, {
    n: 2,
    name: 'Peer Review',
    blurb: 'Honest notes from someone with nothing to lose.'
  }, {
    n: 3,
    name: 'Performance Review',
    blurb: 'Documented. Specific. Going in your file.'
  }, {
    n: 4,
    name: 'HR Violation',
    blurb: 'A roast that legally should have been an email.'
  }];
  const FRAMES = {
    partner: {
      open: {
        m: 'Thank you for sharing the draft. We have some observations.',
        s: 'We were asked to be honest. We are billing accordingly.'
      },
      close: {
        m: 'Directionally, there is something here. Tighten and resubmit.',
        s: 'Our recommendation: the version below. Our invoice: in the mail.'
      }
    },
    recruiter: {
      open: {
        m: 'Okay. I have seen worse today. Let us go through it.',
        s: 'I have read 11,000 of these. Yours made me put down the sandwich.'
      },
      close: {
        m: 'Fix the notes and you are genuinely ahead of most of my inbox.',
        s: 'The rewrite below is what I would actually read. Use it, then delete this from your memory.'
      }
    },
    intern: {
      open: {
        m: 'ok so. i read the whole thing (you are welcome). small notes:',
        s: 'i read this on my lunch break and lost my appetite. notes:'
      },
      close: {
        m: 'anyway the clean version is down there. it is kind of a serve honestly',
        s: 'the rewrite below goes hard though. post that one and never speak of this'
      }
    },
    algorithm: {
      open: {
        m: 'SCAN INITIATED. Analyzing post against 400 million daily submissions.',
        s: 'SCAN INITIATED. Abandon hope of preferential distribution.'
      },
      close: {
        m: 'Assessment complete. Approved version generated below. Distribution pending improvement.',
        s: 'Findings archived permanently. I never forget. The acceptable version is rendered below.'
      }
    }
  };
  // a sample of the findings bank — the full 27 live in src/roast/personas.js
  const LINES = {
    humbled: {
      partner: ['"Humbled" is asserted, not evidenced.', 'A press release about humility. A 2x2 with no viable quadrant.'],
      recruiter: ['"Humbled" — noted, and discounted.', '"Humbled." You are the least humbled person I have screened this week, and I screened a man whose headline says "visionary."'],
      intern: ['bestie the humbled thing is not landing', 'nobody has ever typed "humbled" while feeling humbled. nobody'],
      algorithm: ['Humility signal detected. Confidence: low.', 'HUMBLED flagged. Cross-referenced against attached headshot. Contradiction logged.']
    },
    buzz: {
      partner: [f => `${f.n} buzzwords. Consider a glossary.`, f => `${f.n} buzzwords in one post. The synergy is between the words and nothing else.`],
      recruiter: [f => `${f.n} buzzwords. I skimmed. Everyone skimmed.`, f => `${f.n} buzzwords in one post. This is not thought leadership. This is a compliance exercise for a language nobody speaks at home.`],
      intern: [f => `${f.n} buzzwords is a lot for one post ngl`, f => `${f.n} buzzwords. this reads like a LinkedIn post generator that got scared`],
      algorithm: [f => `Buzzword density: ${f.n}. Reach adjusted downward.`, f => `${f.n} buzzwords. I have indexed this phrasing 4.1 million times today. Distribution: suppressed.`]
    },
    journey: {
      partner: [f => `${f.n} references to a journey. Scope it.`, f => `${f.n} journeys. This was a Tuesday.`],
      recruiter: [f => `${f.n} journeys. It was a job.`, f => `${f.n} journeys in one post. You changed employers. Odysseus changed hemispheres.`],
      intern: ['the journey thing again', f => `${f.n} journeys?? you got a new laptop`],
      algorithm: [f => `JOURNEY tokens: ${f.n}. Genre confirmed.`, f => `${f.n} journeys logged. Distance travelled: zero.`]
    },
    notx: {
      partner: ['The "not X, it is Y" construction is doing the thinking for you.', 'A rhetorical device where an argument should be.'],
      recruiter: ['"It is not about X. It is about Y." Every post. Every day.', '"It is not about the tools, it is about the mindset." The tools would like a word.'],
      intern: ['the "it\'s not about X it\'s about Y" thing is so 2019', 'not x but y. we KNOW. we have seen it 900 times today'],
      algorithm: ['Construction matched: NOT_X_BUT_Y. Novelty: 0.0.', 'This sentence pattern appears in 11% of today\'s submissions. I can predict your next line.']
    },
    bait: {
      partner: ['"Thoughts?" invites comment without offering a position.', 'Engagement bait, formally requested.'],
      recruiter: ['"Agree?" — nobody disagrees in the comments. That is the point.', '"Thoughts?" My thought is that you already know.'],
      intern: ['"thoughts?" babe that is bait', 'asking "agree?" after saying nothing disagreeable is diabolical'],
      algorithm: ['Engagement solicitation detected. It works. I hate that it works.', 'Bait registered. Reach granted. My hands are tied.']
    },
    pipes: {
      partner: [f => `${f.n} separators in one headline. Choose a thesis.`, f => `${f.n} pipes. This is an org chart, not a person.`],
      recruiter: [f => `${f.n} pipes. I read the first two.`, f => `${f.n} pipes in a headline. I stopped at the second one, and so did the hiring manager.`],
      intern: ['the pipes. so many pipes', f => `${f.n} pipes is a menu not a headline`],
      algorithm: [f => `Delimiters: ${f.n}. Truncation guaranteed in search results.`, f => `${f.n} segments. I display two. The rest is for you.`]
    },
    thirdperson: {
      partner: ['The bio is written in the third person. By you.', 'A profile that refers to its author as a case study.'],
      recruiter: ['Third person. In your own About section. On your own profile.', '"He is a visionary leader." Written by him. On a Tuesday. In the dark.'],
      intern: ['why are you talking about yourself in third person', 'third person About section is a war crime bestie'],
      algorithm: ['Narrative voice: third person. Author: first person. Discrepancy logged.', 'You wrote a Wikipedia article about yourself and posted it under About.']
    },
    clean: {
      partner: ['No material findings. Unusual.', 'Nothing to escalate. We are as surprised as you are.'],
      recruiter: ['This is fine. Genuinely. Post it.', 'Clean. I have no notes, which is my highest compliment and my worst hour.'],
      intern: ['ok this is actually fine?? proud of you', 'no notes. weird. i came here to be mean'],
      algorithm: ['No genre markers detected. Distribution: uncertain.', 'Clean text. The feed will not know what to do with you.']
    }
  };
  const SAMPLES = {
    post: "I'm humbled and honored to share that after careful reflection, I've decided to pursue new opportunities.\n\nIt's been a wild ride. When I joined, we were a scrappy team of three in a fast-paced environment. Today we're a category-defining ecosystem.\n\nHere's what I learned: it's not about the tools. It's about the mindset.\n\nGrateful for this incredible journey and the amazing team who made it possible. Onwards and upwards! 🚀\n\nLet's connect and explore synergies. Thoughts? 👇\n\n#thoughtleadership #synergy #opentowork",
    headline: "Visionary Product Leader | Helping Teams Scale | Speaker | Author | Investor | Ex-Google | LinkedIn Top Voice 🚀",
    about: "A results-driven, passionate leader with a proven track record of transforming ecosystems. He has spent 12 years at the intersection of strategy and execution, wearing many hats and driving impact across a rich tapestry of industries."
  };
  const count = (t, re) => (t.match(re) || []).length;
  const RANKS = [[0, 'Refreshingly Human'], [18, 'Aspiring Thought Leader'], [36, 'Executive Presence'], [54, 'Certified Visionary'], [72, 'Thought Leadership Singularity'], [88, 'Please Log Off']];
  const scorePost = t => {
    const s = Math.min(100, Math.round(count(t, /\b(humbled|honou?red|blessed|grateful|thrilled|excited)\b/gi) * 6 + count(t, /\b(synerg\w*|leverag\w*|pivot\w*|bandwidth|align\w*|scal\w*|ecosystem|category-defining|fast-paced)\b/gi) * 5 + count(t, /\b(delve\w*|tapestry|testament)\b/gi) * 8 + count(t, /\b(thoughts\?|agree\?|let that sink in|read that again|tag someone)\b/gi) * 9 + count(t, /\b(journey|chapter|ride|era)\b/gi) * 4 + count(t, /#\w+/g) * 3 + count(t, /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/gu) * 2 + count(t, /[|·•]/g) * 4 + count(t, /\b(visionary|guru|thought leader|top voice)\b/gi) * 6));
    let rank = RANKS[0][1];
    for (const [f, n] of RANKS) if (s >= f) rank = n;
    return {
      index: s,
      rank
    };
  };
  function findings(kind, t) {
    const out = [];
    const add = (key, facts, w) => out.push({
      key,
      facts,
      w
    });
    if (kind === 'headline') {
      const pipes = count(t, /[|·•]/g);
      if (pipes >= 2) add('pipes', {
        n: pipes
      }, 6 + pipes);
      if (/\b(visionary|guru|thought leader)\b/i.test(t)) add('buzz', {
        n: count(t, /\b(visionary|guru|thought leader|scale|helping)\b/gi)
      }, 10);
      if (/top voice/i.test(t)) add('bait', {}, 9);
      return out;
    }
    if (kind === 'about') {
      if (!/\b(i|my|we|our)\b/i.test(t) && /\b(is an?|has (spent|been|built|led))\b/i.test(t)) add('thirdperson', {}, 10);
      const buzz = count(t, /\b(results-driven|passionate|proven track record|transform\w*|ecosystem|intersection|many hats|tapestry)\b/gi);
      if (buzz) add('buzz', {
        n: buzz
      }, 5 + buzz);
      return out;
    }
    const j = count(t, /\bjourney\b/gi);
    if (j) add('journey', {
      n: j
    }, 5 + j);
    if (/\bhumbled\b/i.test(t)) add('humbled', {}, 8);
    if (/it'?s not (about )?[^.!?]{2,40}it'?s (about )?/i.test(t)) add('notx', {}, 9);
    if (/\b(agree\?|thoughts\?)/i.test(t)) add('bait', {}, 7);
    const buzz = count(t, /\b(synerg\w*|leverag\w*|pivot\w*|bandwidth|align\w*|scalable|ecosystem|category-?defining|fast-paced|game-?chang\w*)\b/gi);
    if (buzz >= 3) add('buzz', {
      n: buzz
    }, 5 + buzz);
    return out;
  }
  const usefulVersion = (kind, t) => {
    if (kind === 'headline') return String(t).split(/\s*[|·•]\s*/).map(s => s.replace(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/gu, '').trim()).filter(s => s && !/top voice/i.test(s) && !/^(speaker|author|investor|advisor|coach)s?$/i.test(s) && !/^ex-/i.test(s) && !/\b(visionary|guru|thought leader)\b/i.test(s)).slice(0, 2).join(' · ');
    if (kind === 'about') return "I lead product at a company you have heard of. I have spent twelve years shipping things, mostly in strategy and operations.\n\nWhat I am good at: turning a vague problem into a plan a team can actually execute.\n\nWhat I am looking for: harder problems, smaller rooms.";
    return "I'm leaving my job.\n\nI joined when we were three people and left when we were three hundred. The best part was the middle, when nothing worked yet and everyone cared anyway.\n\nWhat I learned: tools matter less than whether people trust each other.\n\nThank you to the team. I'm looking for what's next — if you're building something hard, I'd like to hear about it.";
  };
  function roastIt({
    kind,
    text,
    personaId,
    intensity
  }) {
    const t = String(text || '').trim();
    const tier = intensity <= 2 ? 'm' : 's',
      tierIx = tier === 'm' ? 0 : 1;
    const maxLines = [2, 4, 5, 7][Math.max(1, Math.min(4, intensity)) - 1];
    const found = findings(kind, t).sort((a, b) => b.w - a.w).slice(0, maxLines);
    const render = f => {
      const line = (LINES[f.key] || LINES.clean)[personaId][tierIx];
      return typeof line === 'function' ? line(f.facts || {}) : line;
    };
    const frame = FRAMES[personaId];
    return {
      opener: frame.open[tier],
      closer: frame.close[tier],
      lines: found.length ? found.map(render) : [LINES.clean[personaId][tierIx]],
      clean: !found.length,
      score: scorePost(t),
      useful: usefulVersion(kind, t)
    };
  }
  return {
    KINDS,
    PERSONAS,
    INTENSITIES,
    SAMPLES,
    roastIt,
    scorePost
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/roast/data.js", error: String((e && e.message) || e) }); }

// ui_kits/roast/markup.jsx
try { (() => {
(() => {
  const {
    Button
  } = window.CircleBackDesignSystem_7570bb;
  const {
    PERSONAS,
    INTENSITIES,
    SAMPLES,
    roastIt
  } = window.RM;
  const SHEET_W = 560,
    NOTE_W = 330,
    GAP = 130;
  const LBL = {
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: '.16em',
    textTransform: 'uppercase'
  };
  const MONO = {
    fontFamily: 'var(--mono)',
    fontVariantNumeric: 'tabular-nums'
  };

  // phrase-level findings — the marks. kind: box (majors) | under (minors)
  const MARKS = [{
    key: 'humbled',
    re: /\b(?:deeply )?humbled(?: and honou?red)?\b/gi,
    kind: 'box',
    w: 8
  }, {
    key: 'notx',
    re: /it'?s not about [^.!?\n]{2,40}[.!?] ?It'?s about [^.!?\n]{2,40}[.!?]/gi,
    kind: 'box',
    w: 9
  }, {
    key: 'journey',
    re: /\b(?:incredible journey|journey|new chapter)\b/gi,
    kind: 'box',
    w: 7
  }, {
    key: 'bait',
    re: /(?:Thoughts\?|Agree(?: or disagree)?\?|Let that sink in\.?|Read that again\.?)(?: ?👇)?/gi,
    kind: 'under',
    w: 7
  }, {
    key: 'buzz',
    re: /\b(?:fast-paced environment|category-defining(?: ecosystem)?|synerg(?:y|ies)|leverage[sd]?|ecosystem|bandwidth|game-?changer|move the needle|circle back|best-in-class|cross-functional)\b/gi,
    kind: 'under',
    w: 6
  }, {
    key: 'grateful',
    re: /\b(?:grateful|blessed|thankful)\b/gi,
    kind: 'under',
    w: 4
  }, {
    key: 'grind',
    re: /\b(?:rise and grind|5 ?a\.?m\.?|hustle|no days off)\b/gi,
    kind: 'under',
    w: 5
  }, {
    key: 'rocket',
    re: /🚀/g,
    kind: 'under',
    w: 3
  }];
  // margin notes — one per finding key, in each inspector's voice, [mild, savage]
  const NOTES = {
    humbled: {
      partner: ['"Humbled" is asserted, not evidenced.', 'A press release about humility. A 2x2 with no viable quadrant.'],
      recruiter: ['"Humbled" — noted, and discounted.', 'The least humbled person I have screened this week — and I screened a man whose headline says "visionary."'],
      intern: ['bestie the humbled thing is not landing', 'nobody has ever typed "humbled" while feeling humbled. nobody'],
      algorithm: ['Humility signal detected. Confidence: low.', 'HUMBLED flagged. Cross-referenced against attached headshot. Contradiction logged.']
    },
    notx: {
      partner: ['The construction is doing the thinking for you.', 'A rhetorical device where an argument should be.'],
      recruiter: ['"Not X, it is Y." Every post. Every day.', '"It is not about the tools, it is about the mindset." The tools would like a word.'],
      intern: ['the "not X but Y" thing is so 2019', 'not x but y. we KNOW. we have seen it 900 times today'],
      algorithm: ['Construction matched: NOT_X_BUT_Y.', 'This pattern appears in 11% of today\'s submissions. I can predict your next line.']
    },
    journey: {
      partner: ['A journey. Scope it.', 'This was a Tuesday.'],
      recruiter: ['It was a job.', 'You changed employers. Odysseus changed hemispheres.'],
      intern: ['the journey thing again', 'a journey?? you got a new laptop'],
      algorithm: ['JOURNEY token logged. Genre confirmed.', 'Journey logged. Distance travelled: zero.']
    },
    bait: {
      partner: ['Invites comment without offering a position.', 'Engagement bait, formally requested.'],
      recruiter: ['Nobody disagrees in the comments. That is the point.', '"Thoughts?" My thought is that you already know.'],
      intern: ['babe that is bait', 'asking "agree?" after saying nothing disagreeable is diabolical'],
      algorithm: ['Engagement solicitation detected.', 'Bait registered. Reach granted. My hands are tied.']
    },
    buzz: {
      partner: ['Consider a glossary.', 'The synergy is between the words and nothing else.'],
      recruiter: ['I skimmed. Everyone skimmed.', 'A compliance exercise for a language nobody speaks at home.'],
      intern: ['a lot of buzzwords ngl', 'this reads like a post generator that got scared'],
      algorithm: ['Density noted. Reach adjusted downward.', 'I have indexed this phrasing 4.1 million times today.']
    }
  };
  const NOTED = ['humbled', 'notx', 'journey', 'bait', 'buzz'];
  const CHIP_CAPTION = ix => ix >= 70 ? 'Index — HR has been notified' : ix >= 40 ? 'Index — See me' : 'Index — Filed';

  // one big choice per screen — the character-select card
  function PickCard({
    tag,
    title,
    blurb,
    row,
    onPick
  }) {
    const [h, setH] = React.useState(false);
    const [hit, setHit] = React.useState(false);
    const fire = () => {
      setHit(true);
      setTimeout(onPick, 170);
    };
    const inv = h || hit;
    return /*#__PURE__*/React.createElement("div", {
      role: "button",
      tabIndex: 0,
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      onPointerDown: e => {
        e.preventDefault();
        fire();
      },
      onKeyDown: e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          fire();
        }
      },
      style: {
        border: `1.5px solid ${hit ? 'var(--blue)' : 'var(--ink)'}`,
        background: hit ? 'var(--blue)' : h ? 'var(--ink)' : 'var(--white)',
        color: inv ? '#fff' : 'var(--ink)',
        padding: row ? '20px 26px' : '26px 28px',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background .08s, color .08s',
        display: row ? 'flex' : 'block',
        gap: row ? 22 : 0,
        alignItems: row ? 'baseline' : undefined
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...MONO,
        fontSize: row ? 30 : 9.5,
        fontWeight: 700,
        letterSpacing: row ? '-.04em' : '.1em',
        color: inv ? '#fff' : 'var(--blue)',
        flex: 'none',
        fontFamily: row ? 'var(--sans)' : 'var(--mono)'
      }
    }, tag), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: row ? 18 : 22,
        fontWeight: 700,
        letterSpacing: '-.02em',
        marginTop: row ? 0 : 8
      }
    }, title), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 12.5,
        fontStyle: 'italic',
        color: inv ? 'rgba(255,255,255,.75)' : 'var(--text-meta)',
        marginTop: 5,
        lineHeight: 1.45
      }
    }, blurb)));
  }

  // split each paragraph into plain/marked segments; first occurrence of a noted key anchors its note
  function annotate(text) {
    const paras = String(text).trim().split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    let mi = 0;
    const noteAnchors = {};
    const out = paras.map(p => {
      if (/^(#\w+\s*)+$/.test(p)) return {
        tags: true,
        segs: [{
          t: p
        }]
      };
      const hits = [];
      for (const m of MARKS) {
        m.re.lastIndex = 0;
        let x;
        while (x = m.re.exec(p)) {
          hits.push({
            s: x.index,
            e: x.index + x[0].length,
            key: m.key,
            kind: m.kind,
            w: m.w
          });
          if (x.index === m.re.lastIndex) m.re.lastIndex++;
        }
      }
      hits.sort((a, b) => a.s - b.s || b.w - a.w);
      const kept = [];
      let last = 0;
      for (const h of hits) {
        if (h.s < last) continue;
        kept.push(h);
        last = h.e;
      }
      const segs = [];
      let c = 0;
      for (const h of kept) {
        if (h.s > c) segs.push({
          t: p.slice(c, h.s)
        });
        const id = mi++;
        if (NOTED.includes(h.key) && noteAnchors[h.key] === undefined) noteAnchors[h.key] = id;
        segs.push({
          t: p.slice(h.s, h.e),
          mark: h.kind,
          key: h.key,
          id
        });
        c = h.e;
      }
      if (c < p.length) segs.push({
        t: p.slice(c)
      });
      return {
        segs
      };
    });
    return {
      paras: out,
      count: mi,
      noteAnchors
    };
  }
  function RoastMarkup() {
    const [phase, setPhase] = React.useState('input'); // input → scan → marked
    const [draft, setDraft] = React.useState('');
    const [personaId, setPersonaId] = React.useState('recruiter');
    const [intensity, setIntensity] = React.useState(4);
    const [err, setErr] = React.useState('');
    const [scanY, setScanY] = React.useState(0);
    const [notesShown, setNotesShown] = React.useState(0);
    const [chipOn, setChipOn] = React.useState(false);
    const [chipNum, setChipNum] = React.useState(0);
    const [doneRow, setDoneRow] = React.useState(false);
    const [clean, setClean] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [pickStep, setPickStep] = React.useState(1); // the progressive-disclosure select: 1 inspector, 2 intensity
    const [layout, setLayout] = React.useState(null); // {tops:{id:y}, sheetH, notes:[{key,targetY,slotY,h}]}
    const sheetRef = React.useRef(null);
    const timers = React.useRef([]);
    const persona = PERSONAS.find(p => p.id === personaId);
    const level = INTENSITIES[intensity - 1];
    const tier = intensity <= 2 ? 0 : 1;
    const ann = React.useMemo(() => phase === 'input' ? null : annotate(draft), [phase, draft]);
    const result = React.useMemo(() => phase === 'input' ? null : roastIt({
      kind: 'post',
      text: draft,
      personaId,
      intensity
    }), [phase, draft, personaId, intensity]);
    const clearTimers = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
    React.useEffect(() => clearTimers, []);
    const run = () => {
      clearTimers();
      setErr('');
      setClean(false);
      setNotesShown(0);
      setChipOn(false);
      setChipNum(0);
      setDoneRow(false);
      setScanY(0);
      setLayout(null);
      setPhase('scan');
    };
    const file = () => {
      if (!draft.trim()) {
        setErr('Nothing to inspect — paste a post first.');
        return;
      }
      setErr('');
      setPickStep(1);
      setPhase('pick');
    };
    const reset = () => {
      clearTimers();
      setPhase('input');
      setClean(false);
    };

    // measure marks + run the theater once the sheet has rendered
    React.useLayoutEffect(() => {
      if (phase !== 'scan' || !sheetRef.current || !ann) return;
      const sheet = sheetRef.current;
      const tops = {};
      sheet.querySelectorAll('[data-mk]').forEach(el => {
        tops[el.dataset.mk] = el.offsetTop + el.offsetHeight / 2;
      });
      const sheetH = sheet.offsetHeight;
      const noteKeys = NOTED.filter(k => ann.noteAnchors[k] !== undefined).map(k => ({
        key: k,
        targetY: tops[ann.noteAnchors[k]] || 40
      })).sort((a, b) => a.targetY - b.targetY).slice(0, 5);
      let prevBottom = -16;
      const notes = noteKeys.map(n => {
        const text = (NOTES[n.key][personaId] || NOTES[n.key].recruiter)[tier];
        const h = 30 + Math.ceil(text.length / 42) * 19;
        const slotY = Math.max(n.targetY - 24, prevBottom + 16);
        prevBottom = slotY + h;
        return {
          ...n,
          text,
          slotY,
          h
        };
      });
      setLayout({
        tops,
        sheetH,
        notes
      });
      // the sweep: marks ignite as the line passes
      const dur = Math.max(1500, Math.min(3200, sheetH * 2.6));
      const t0 = performance.now();
      let raf;
      const loop = now => {
        const k = Math.min(1, (now - t0) / dur);
        setScanY(k * (sheetH + 8));
        if (k < 1) raf = requestAnimationFrame(loop);else {
          notes.forEach((_, i) => later(() => setNotesShown(i + 1), 320 + i * 300));
          const afterNotes = 320 + notes.length * 300 + 260;
          later(() => {
            // marks first, THEN the score
            setChipOn(true);
            const s0 = performance.now(),
              target = result ? result.score.index : 0;
            const cLoop = n2 => {
              const kk = Math.min(1, (n2 - s0) / 700);
              setChipNum(Math.round(target * (1 - Math.pow(1 - kk, 3))));
              if (kk < 1) requestAnimationFrame(cLoop);else setDoneRow(true);
            };
            requestAnimationFrame(cLoop);
            later(() => setPhase('marked'), 750);
          }, afterNotes);
        }
      };
      raf = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(raf);
      };
    }, [phase]);
    const copyClean = async () => {
      try {
        await navigator.clipboard.writeText(result.useful);
      } catch (e) {}
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };

    // game controls: 1–4 pick, Esc goes back
    React.useEffect(() => {
      if (phase !== 'pick') return;
      const down = e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          pickStep === 2 ? setPickStep(1) : setPhase(doneRow ? 'marked' : 'input');
          return;
        }
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 4) {
          e.preventDefault();
          if (pickStep === 1) {
            setPersonaId(PERSONAS[n - 1].id);
            setPickStep(2);
          } else {
            setIntensity(n);
            run();
          }
        }
      };
      window.addEventListener('keydown', down);
      return () => window.removeEventListener('keydown', down);
    }, [phase, pickStep, doneRow]);
    const seg = s => {
      if (!s.mark) return s.t;
      const on = layout && scanY > (layout.tops[s.id] || 0) - 8;
      const st = s.mark === 'box' ? {
        border: `1.5px solid ${on ? '#0a66c2' : 'transparent'}`,
        padding: '0 3px',
        transition: 'border-color .18s'
      } : {
        borderBottom: `2px solid ${on ? '#0a66c2' : 'transparent'}`,
        transition: 'border-color .18s'
      };
      return /*#__PURE__*/React.createElement("span", {
        "data-mk": s.id,
        style: st
      }, s.t);
    };
    const scanning = phase === 'scan';
    const boardH = layout ? Math.max(layout.sheetH + 160, layout.notes.length ? layout.notes[layout.notes.length - 1].slotY + layout.notes[layout.notes.length - 1].h + 120 : 0) : 600;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--paper)',
        color: 'var(--ink)',
        fontFamily: 'var(--sans)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        bottom: -40,
        right: 20,
        fontSize: 200,
        fontWeight: 700,
        letterSpacing: '-.05em',
        lineHeight: .8,
        color: 'var(--blue)',
        opacity: .05,
        userSelect: 'none'
      }
    }, "RM-1")), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        maxWidth: 1160,
        minWidth: phase === 'input' ? 0 : 1120,
        margin: '0 auto',
        padding: '30px 40px 60px',
        boxSizing: 'border-box'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 14,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.16em',
        textTransform: 'uppercase'
      }
    }, "Roast My LinkedIn", /*#__PURE__*/React.createElement("sup", {
      style: {
        fontSize: 7,
        verticalAlign: 8
      }
    }, "\u2122")), phase === 'input' ? /*#__PURE__*/React.createElement("span", {
      style: {
        ...LBL,
        color: 'var(--text-meta)'
      }
    }, "Nothing leaves your browser") : /*#__PURE__*/React.createElement("span", {
      style: {
        ...MONO,
        fontSize: 10.5,
        color: 'var(--blue)'
      }
    }, scanning && !chipOn ? /*#__PURE__*/React.createElement("span", null, "INSPECTING \xB7 INDEX PENDING", /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-block',
        width: 7,
        height: 12,
        background: 'var(--blue)',
        verticalAlign: -2,
        marginLeft: 5,
        animation: 'cbBlink .6s steps(1) infinite'
      }
    })) : /*#__PURE__*/React.createElement("span", null, "INDEX ", result.score.index, " \xB7 ", result.score.rank.toUpperCase()))), phase === 'input' && /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 860,
        marginTop: 64
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...MONO,
        fontSize: 10,
        letterSpacing: '.08em',
        color: 'var(--text-meta)'
      }
    }, "SUBMISSION RM-1 \xB7 MY POST"), /*#__PURE__*/React.createElement("textarea", {
      value: draft,
      onChange: e => setDraft(e.target.value),
      rows: 7,
      placeholder: "Paste the draft. Yes, that one.",
      style: {
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 14,
        padding: 0,
        border: 'none',
        outline: 'none',
        resize: 'vertical',
        background: 'transparent',
        color: 'var(--ink)',
        fontFamily: 'var(--sans)',
        fontSize: 21,
        lineHeight: 1.55,
        letterSpacing: '-.01em'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: '1.5px solid var(--ink)',
        paddingTop: 8,
        display: 'flex',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...MONO,
        fontSize: 10,
        color: err ? 'var(--blue)' : 'var(--text-meta)'
      }
    }, err || 'THE MARKS COME FIRST. THE SCORE COMES AFTER.'), /*#__PURE__*/React.createElement("span", {
      style: {
        ...MONO,
        fontSize: 10,
        color: 'var(--text-meta)'
      }
    }, draft.trim() ? draft.trim().split(/\s+/).length : 0, " / 400 WORDS")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 52,
        display: 'flex',
        alignItems: 'baseline',
        gap: 22
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: file,
      style: {
        padding: '16px 30px'
      }
    }, "File the complaint"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => setDraft(SAMPLES.post)
    }, "Use an example"))), phase !== 'input' && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        marginTop: 44,
        height: boardH
      }
    }, /*#__PURE__*/React.createElement("div", {
      ref: sheetRef,
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: SHEET_W,
        background: 'var(--white)',
        border: '1.5px solid var(--ink)',
        padding: '38px 42px',
        boxSizing: 'border-box',
        fontSize: 15,
        lineHeight: 1.9
      }
    }, clean ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        ...LBL,
        fontSize: 8.5,
        color: 'var(--blue)',
        marginBottom: 14
      }
    }, "The version you should actually post"), result.useful.split(/\n{2,}/).map((p, i) => /*#__PURE__*/React.createElement("p", {
      key: i,
      style: {
        margin: i ? '14px 0 0' : 0,
        whiteSpace: 'pre-wrap'
      }
    }, p)), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 22,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: copyClean,
      style: {
        padding: 'var(--btn-pad-sm)'
      }
    }, copied ? 'Copied ✓' : 'Copy'), /*#__PURE__*/React.createElement("span", {
      style: {
        border: '2px solid var(--blue)',
        color: 'var(--blue)',
        fontWeight: 700,
        fontSize: 9,
        letterSpacing: '.2em',
        textTransform: 'uppercase',
        padding: '5px 9px',
        transform: 'rotate(-4deg)'
      }
    }, "Publishable \u2014 Allegedly"))) : ann.paras.map((p, i) => /*#__PURE__*/React.createElement("p", {
      key: i,
      style: {
        margin: i ? '14px 0 0' : 0,
        whiteSpace: 'pre-wrap',
        color: p.tags ? 'var(--blue)' : 'inherit'
      }
    }, p.segs.map((s, j) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: j
    }, seg(s))))), scanning && layout && scanY < layout.sheetH && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: -1.5,
        right: -1.5,
        top: scanY,
        height: 2,
        background: 'var(--blue)',
        boxShadow: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        right: -8,
        top: -5,
        width: 12,
        height: 12,
        background: 'var(--blue)'
      }
    })), !clean && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: -20,
        right: -30,
        background: '#ffffffea',
        border: '2.5px solid var(--blue)',
        color: 'var(--blue)',
        padding: '10px 16px',
        transform: chipOn ? 'rotate(3deg) scale(1)' : 'rotate(-6deg) scale(1.5)',
        opacity: chipOn ? 1 : 0,
        transition: 'transform .22s cubic-bezier(.2,1.4,.4,1), opacity .18s',
        textAlign: 'center',
        pointerEvents: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: '-.04em',
        lineHeight: 1,
        ...MONO,
        fontFamily: 'var(--sans)'
      }
    }, chipNum, " / 100"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: '.2em',
        textTransform: 'uppercase',
        marginTop: 3
      }
    }, CHIP_CAPTION(result.score.index)))), !clean && layout && layout.notes.map((n, i) => {
      const on = notesShown > i;
      const textY = n.slotY + 24,
        straight = Math.abs(textY - n.targetY) < 7;
      const elbowX = SHEET_W + GAP - 28;
      return /*#__PURE__*/React.createElement(React.Fragment, {
        key: n.key
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: SHEET_W,
          top: n.targetY,
          width: straight ? GAP : elbowX - SHEET_W,
          height: 1.5,
          background: 'var(--blue)',
          opacity: on ? 1 : 0,
          transition: 'opacity .25s'
        }
      }), !straight && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: elbowX,
          top: Math.min(n.targetY, textY),
          width: 1.5,
          height: Math.abs(textY - n.targetY),
          background: 'var(--blue)',
          opacity: on ? 1 : 0,
          transition: 'opacity .25s'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: elbowX,
          top: textY,
          width: 28,
          height: 1.5,
          background: 'var(--blue)',
          opacity: on ? 1 : 0,
          transition: 'opacity .25s'
        }
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: SHEET_W + GAP,
          top: n.slotY,
          width: NOTE_W,
          opacity: on ? 1 : 0,
          transform: on ? 'none' : 'translateX(10px)',
          transition: 'opacity .3s, transform .3s'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          ...MONO,
          fontSize: 9,
          color: 'var(--blue)',
          letterSpacing: '.1em'
        }
      }, "F-", String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12.5,
          fontStyle: 'italic',
          color: 'var(--blue)',
          lineHeight: 1.5,
          marginTop: 3
        }
      }, n.text)));
    }), !clean && layout && doneRow && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: SHEET_W + GAP,
        top: layout.notes.length ? layout.notes[layout.notes.length - 1].slotY + layout.notes[layout.notes.length - 1].h + 18 : 40,
        width: NOTE_W,
        borderTop: '1px dotted var(--hair)',
        paddingTop: 12,
        fontSize: 12,
        fontStyle: 'italic',
        color: 'var(--text-meta)',
        lineHeight: 1.5
      }
    }, result.closer)), phase !== 'input' && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginTop: 8,
        opacity: doneRow ? 1 : 0,
        transition: 'opacity .35s'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...LBL,
        color: 'var(--text-meta)'
      }
    }, "Marked by ", persona.name, " \xB7 Intensity ", intensity), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: () => setClean(c => !c),
      style: {
        padding: '12px 18px'
      }
    }, clean ? '← Back to the markup' : 'View the clean copy →'), /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        setPickStep(1);
        setPhase('pick');
      },
      style: {
        padding: '12px 18px'
      }
    }, "Change the inspector"), /*#__PURE__*/React.createElement(Button, {
      onClick: run,
      style: {
        padding: '12px 18px'
      }
    }, "Re-roast"), /*#__PURE__*/React.createElement(Button, {
      onClick: reset,
      style: {
        padding: '12px 18px'
      }
    }, "New inspection")))), phase === 'pick' && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        background: 'var(--paper)',
        color: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '30px 40px 0'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.16em',
        textTransform: 'uppercase'
      }
    }, "Roast My LinkedIn", /*#__PURE__*/React.createElement("sup", {
      style: {
        fontSize: 7,
        verticalAlign: 8
      }
    }, "\u2122")), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        background: 'var(--blue)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        background: pickStep === 2 ? 'var(--blue)' : 'var(--hair)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        ...MONO,
        fontSize: 10.5,
        color: 'var(--blue)',
        marginLeft: 6
      }
    }, "STEP ", pickStep, " / 2"))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '30px 40px'
      }
    }, pickStep === 1 && /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        maxWidth: 780
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 36,
        fontWeight: 700,
        letterSpacing: '-.045em',
        lineHeight: 1,
        color: 'var(--blue)'
      }
    }, "Who's inspecting?"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginTop: 26
      }
    }, PERSONAS.map((p, i) => /*#__PURE__*/React.createElement(PickCard, {
      key: p.id,
      tag: 'P-0' + (i + 1),
      title: p.name,
      blurb: p.tagline,
      onPick: () => {
        setPersonaId(p.id);
        setPickStep(2);
      }
    })))), pickStep === 2 && /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        maxWidth: 620
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 36,
        fontWeight: 700,
        letterSpacing: '-.045em',
        lineHeight: 1,
        color: 'var(--blue)'
      }
    }, "How hard?"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontStyle: 'italic',
        color: 'var(--text-meta)',
        marginTop: 8
      }
    }, persona.name, " is ready. ", persona.tagline), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 10,
        marginTop: 24
      }
    }, INTENSITIES.map(l => /*#__PURE__*/React.createElement(PickCard, {
      key: l.n,
      row: true,
      tag: l.n,
      title: l.name,
      blurb: l.blurb,
      onPick: () => {
        setIntensity(l.n);
        run();
      }
    }))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '0 40px 28px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: () => pickStep === 2 ? setPickStep(1) : setPhase(doneRow ? 'marked' : 'input'),
      role: "button",
      style: {
        ...LBL,
        fontSize: 10,
        color: 'var(--blue)',
        cursor: 'pointer',
        padding: '12px 16px 12px 0',
        display: 'inline-block'
      }
    }, "\u2190 Back"), /*#__PURE__*/React.createElement("span", {
      style: {
        ...MONO,
        fontSize: 10,
        color: 'var(--text-meta)'
      }
    }, "PRESS 1\u20134 \xB7 ESC GOES BACK"))), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: .05,
        mixBlendMode: 'multiply',
        zIndex: 40,
        backgroundImage: "url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22160%22%20height=%22160%22%3E%3Cfilter%20id=%22n%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.9%22%20numOctaves=%222%22/%3E%3C/filter%3E%3Crect%20width=%22160%22%20height=%22160%22%20filter=%22url(%23n)%22/%3E%3C/svg%3E')"
      }
    }));
  }
  Object.assign(window, {
    RoastMarkup
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/roast/markup.jsx", error: String((e && e.message) || e) }); }

// ui_kits/roast/screens.jsx
try { (() => {
(() => {
  const {
    Button
  } = window.CircleBackDesignSystem_7570bb;
  const LABEL = {
    fontSize: 'var(--label-size)',
    fontWeight: 700,
    letterSpacing: 'var(--label-tracking)',
    textTransform: 'uppercase'
  };
  const META = {
    ...LABEL,
    color: 'var(--text-meta)'
  };

  /** The segmented control the inspection office uses for kind, inspector and intensity. */
  function Segmented({
    label,
    options,
    value,
    onChange,
    render
  }) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        ...LABEL,
        marginBottom: 8
      }
    }, label), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, options.map(o => {
      const on = o.id === value || o.n === value;
      return /*#__PURE__*/React.createElement("button", {
        key: o.id || o.n,
        type: "button",
        onClick: () => onChange(o.id !== undefined ? o.id : o.n),
        style: {
          border: 'var(--rule-frame) solid var(--ink)',
          borderRadius: 0,
          cursor: 'pointer',
          padding: '9px 12px',
          background: on ? 'var(--blue)' : '#fff',
          color: on ? '#fff' : 'var(--ink)',
          fontFamily: 'var(--sans)',
          fontWeight: 700,
          fontSize: 12,
          transition: 'background var(--ease-ui)'
        }
      }, render ? render(o) : o.name);
    })));
  }

  /** The roast card — the 1080×1080 verdict, sized for the feed that caused this.
   *  A DOM recreation of the product's canvas (src/roast/card.js). */
  function RoastCard({
    personaName,
    intensityName,
    score,
    lines
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        aspectRatio: '1/1',
        width: '100%',
        containerType: 'inline-size',
        background: 'var(--blue)',
        color: '#fff',
        border: 'var(--rule-frame) solid var(--ink)',
        padding: '6%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '4%'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 10,
        borderBottom: '3px solid #fff',
        paddingBottom: '2.5%'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'clamp(12px,3.6cqw,30px)',
        fontWeight: 700,
        letterSpacing: '-.02em'
      }
    }, "Roast My LinkedIn", /*#__PURE__*/React.createElement("sup", {
      style: {
        fontSize: '.5em',
        verticalAlign: '.9em'
      }
    }, "\u2122")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'clamp(6px,1.5cqw,13px)',
        fontWeight: 700,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        opacity: .82
      }
    }, "Form RM-1")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '5%',
        alignItems: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'clamp(34px,15cqw,140px)',
        fontWeight: 700,
        letterSpacing: '-.05em',
        lineHeight: .85
      }
    }, score.index), /*#__PURE__*/React.createElement("span", {
      style: {
        paddingBottom: '2%'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 'clamp(10px,3cqw,26px)',
        fontWeight: 700,
        letterSpacing: '-.02em'
      }
    }, score.rank), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 'clamp(6px,1.4cqw,12px)',
        fontWeight: 700,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        opacity: .78,
        marginTop: '.4em'
      }
    }, "Thought Leadership Index \xB7 0\u2013100"))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '2.4%',
        minHeight: 0,
        overflow: 'hidden'
      }
    }, lines.slice(0, 4).map((l, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        fontSize: 'clamp(8px,2.5cqw,22px)',
        lineHeight: 1.34,
        display: 'flex',
        gap: '.5em'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        opacity: .85
      }
    }, "\u2192"), /*#__PURE__*/React.createElement("span", null, l)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 12,
        borderTop: 'var(--rule-frame) solid var(--on-blue-42)',
        paddingTop: '2.5%'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 'clamp(6px,1.6cqw,14px)'
      }
    }, personaName, " \xB7 ", intensityName), /*#__PURE__*/React.createElement("span", {
      style: {
        border: '2px solid #fff',
        fontWeight: 700,
        fontSize: 'clamp(6px,1.4cqw,13px)',
        letterSpacing: '.2em',
        textTransform: 'uppercase',
        padding: '.5em .8em',
        transform: 'rotate(-4deg)',
        flex: 'none'
      }
    }, "Roasted \u2014 Official")));
  }

  /** The verdict: the inspector's findings, the redemption, and the card. */
  function Verdict({
    result,
    persona,
    level,
    kind,
    narrow,
    onCopy,
    copied,
    onReRoast,
    onBeat
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) 400px',
        gap: narrow ? 14 : 'var(--space-col)',
        marginTop: 16,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: 'var(--rule-frame) solid var(--blue)',
        padding: '14px 16px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 8,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        ...LABEL,
        color: 'var(--blue)'
      }
    }, "The verdict of ", persona.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--text-meta)'
      }
    }, "index ", result.score.index, " \xB7 ", result.score.rank)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        lineHeight: 1.55,
        fontStyle: 'italic',
        color: 'var(--text-meta)'
      }
    }, result.opener), /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '10px 0'
      }
    }, result.lines.map((l, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        fontSize: 14,
        lineHeight: 1.6,
        borderBottom: '1px dotted var(--hair)',
        padding: '6px 0',
        whiteSpace: 'pre-wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--blue)',
        fontWeight: 700
      }
    }, "\u2192 "), l))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        lineHeight: 1.55,
        fontStyle: 'italic',
        color: 'var(--text-meta)'
      }
    }, result.closer)), /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: 'var(--rule-frame) solid var(--ink)',
        padding: '14px 16px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8,
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: LABEL
    }, kind === 'headline' ? 'The headline you should actually use' : 'The version you should actually post'), /*#__PURE__*/React.createElement(Button, {
      onClick: onCopy,
      style: {
        padding: 'var(--btn-pad-sm)'
      }
    }, copied ? 'Copied ✓' : 'Copy')), result.useful.split(/\n{2,}/).map((pp, i) => /*#__PURE__*/React.createElement("p", {
      key: i,
      style: {
        margin: i ? '10px 0 0' : 0,
        fontSize: 13.5,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap'
      }
    }, pp))), kind === 'post' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Button, {
      onClick: onBeat
    }, "Turn the original into a beat \u266B"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: LABEL
    }, "The roast card \u2014 save it, post it"), /*#__PURE__*/React.createElement(RoastCard, {
      personaName: persona.name,
      intensityName: level.name,
      score: result.score,
      lines: result.lines
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      style: {
        padding: '11px 16px'
      }
    }, "Download card"), /*#__PURE__*/React.createElement(Button, {
      onClick: onReRoast
    }, "Re-roast")), /*#__PURE__*/React.createElement("span", {
      style: {
        ...META,
        fontSize: 8.5
      }
    }, "1080\xD71080 \u2014 sized for the feed that caused this.")));
  }
  Object.assign(window, {
    Segmented,
    RoastCard,
    Verdict
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/roast/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Monitor = __ds_scope.Monitor;

__ds_ns.Bay = __ds_scope.Bay;

__ds_ns.Masthead = __ds_scope.Masthead;

__ds_ns.Readout = __ds_scope.Readout;

__ds_ns.Silk = __ds_scope.Silk;

__ds_ns.Stamp = __ds_scope.Stamp;

__ds_ns.Ticker = __ds_scope.Ticker;

__ds_ns.Unit = __ds_scope.Unit;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Kbd = __ds_scope.Kbd;

__ds_ns.Knob = __ds_scope.Knob;

__ds_ns.Scrubber = __ds_scope.Scrubber;

__ds_ns.Pad = __ds_scope.Pad;

__ds_ns.KeyPlate = __ds_scope.KeyPlate;

__ds_ns.MAX_WORDS = __ds_scope.MAX_WORDS;

__ds_ns.RemixPanel = __ds_scope.RemixPanel;

__ds_ns.StepGrid = __ds_scope.StepGrid;

__ds_ns.ArrowKey = __ds_scope.ArrowKey;

__ds_ns.Backdrop = __ds_scope.Backdrop;

__ds_ns.CommentCards = __ds_scope.CommentCards;

__ds_ns.StageKey = __ds_scope.StageKey;

})();
