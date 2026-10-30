"""Synergy's LED face: a timeline of pixel states baked into an atlas image.

Canon (LinkedIn Beats continuity notes and the approved camera-v2 plate):
  * a recessed, flat, black glass screen; all light stays inside the glass
  * a 22 x 16 matrix of square LEDs; unlit cells are barely visible
  * eyes: 2 wide x 3 tall, columns 5-6 and 15-16, rows 5-7 (row 0 = top)
  * mouth: ONE row of 22 small LEDs on a finer pitch, 80% down the screen.
    Speech changes brightness only, travelling LEFT TO RIGHT (~15 LEDs/s,
    falling off over ~7 LEDs). It never grows vertically. Idle glow 11%.
  * blinks: middle row only (2 frames), dark (2), middle row (2), full
  * the photographed idle mouth is 7 dim dots at twice the LED pitch (about a third
    of the eyes' brightness); speech lights the whole row (floor 16%) under the travelling wave
  * expressive register (rare, earned): 3x3 eyes, 4-LED brows with the
    viewer-right brow raised a row higher, one raised mouth-corner pixel

Each frame is evaluated to a 22 x 16 grid plus a 22-value mouth row. All
frames of a shot are stacked into one float atlas (22 wide, 17 rows per
frame). The screen shader selects the current block with a driver and draws
every LED as a small square with dark gaps between neighbours (eyes 66% of
the pitch, mouth dots 60%), so the face stays crisp in macro. Mouth levels are
canon perceptual values (idle 11%, floor 16%); the atlas stores them through
MOUTH_GAMMA so the idle dots read clearly but well below the eyes. The atlas wraps into
columns of FRAMES_PER_COLUMN frames (GPU texture limits). The LED emission is seen
by camera rays only: no light (and no green) ever lands on the chassis.
"""

import bpy
import numpy as np

COLS, ROWS = 22, 16
BLOCK = ROWS + 1               # 16 grid rows + 1 mouth row per frame
EYES = ((5, 5), (15, 5))       # top-left LED (col, row) of each eye
MOUTH_N = 22
MOUTH_V = 0.20                 # mouth band centre, UV v (0 = bottom of screen)
MOUTH_H = 0.050                # band height in UV
MOUTH_U = (0.225, 0.775)       # band extent in UV u
LED_GREEN = (0.07, 1.0, 0.22)  # canon #4aff70, pre-saturated for AgX (mid-tones ~#4DB062 after the view transform)
SCREEN_ASPECT = 0.190 / 0.135  # glass width / height (canon)
MOUTH_GAMMA = 0.70             # canon mouth level -> emission (idle 0.11 -> 0.21: the 7 idle dots read at
                               # ~1/3 of the eyes' peak; speech floor 0.16 -> 0.28, full 1.0)
FRAMES_PER_COLUMN = 64         # atlas wraps into columns (a 1440-frame timeline is 506 x 1088 px)
IDLE_DOTS = tuple(range(4, 17, 2))   # the photographed idle: 7 dots, every second LED
EYE_FILL = 0.66                # lit square / pitch (eyes and grid)
MOUTH_FILL = 0.60              # mouth dot / mouth pitch (square dots)


class FaceTimeline:
    """Per-shot face performance. All frame arguments are film frames."""

    def __init__(self, start, end, eyes=1.0, mouth_idle=0.11, idle_dots=IDLE_DOTS):
        """idle_dots: mouth LEDs lit by the idle glow (None = all 22)."""
        self.start, self.end = start, end
        self.n = end - start + 1
        self.eyes = np.full(self.n, eyes, dtype=np.float32)
        self.mouth_idle = np.full(self.n, mouth_idle, dtype=np.float32)
        self.idle_mask = np.zeros(MOUTH_N, dtype=np.float32)
        self.idle_mask[list(idle_dots) if idle_dots is not None else slice(None)] = 1.0
        self.events = []

    def _i(self, frame):
        return int(frame) - self.start

    def _span(self, a, b):
        return range(max(0, self._i(a)), min(self.n, self._i(b) + 1))

    # ---------------------------------------------------------- edits
    def off(self, a, b):
        """Screen fully dark between a and b."""
        for i in self._span(a, b):
            self.eyes[i] = 0.0
            self.mouth_idle[i] = 0.0
        return self

    def level(self, a, b, eyes=None, mouth_idle=None):
        for i in self._span(a, b):
            if eyes is not None:
                self.eyes[i] = eyes
            if mouth_idle is not None:
                self.mouth_idle[i] = mouth_idle
        return self

    def power_on(self, frame, step=3):
        """Boot: eye LEDs light one by one (step frames apart), then the mouth row fades in."""
        self.events.append(('power_on', frame, step))
        return self

    def blink(self, frame, dur=6):
        self.events.append(('blink', frame, dur))
        return self

    def speak(self, a, b, energy=0.9, speed=15.0, tail=7.0):
        """A brightness wave travels left->right along the mouth row."""
        self.events.append(('speak', a, b, energy, speed, tail))
        return self

    def sweep(self, frame, dur=14, energy=1.0):
        """One clean left->right pass of light along the mouth (a wordless hello)."""
        self.events.append(('sweep', frame, dur, energy))
        return self

    def wave(self, frame, speed=14.4, tail=7.0, floor=0.16, energy=1.0, end=None, fade=4):
        """ONE brightness wave from LED 1 to LED 22 (canon S05 'Outstanding.'):
        LED brightness max(floor, energy * (1 - d / tail)) while the wave crosses the row.
        end: the frame the row is back at idle (S05: wave(461, end=497)); the floor and the
        trailing tail fade out over the last `fade` frames before it (the head LED keeps its light)."""
        self.events.append(('wave', frame, speed, tail, floor, energy, end, fade))
        return self

    def stall(self, a, stop_led=9, hold=15, fade=8, speed=14.4, tail=7.0, floor=0.16, energy=1.0, stop_frame=None):
        """A wave that starts at frame a, stops dead when its head reaches LED stop_led
        (1-based), holds frozen for `hold` frames, then fades back to idle over `fade`.
        stop_frame: the exact frame the head arrives (S09: stall(885, stop_frame=897)); the
        speed is then set from it (canon 14.4 LEDs/s otherwise, arrival rounded to a frame)."""
        if stop_frame is not None:
            speed = (stop_led - 1) * 24.0 / max(1, stop_frame - a)
        self.events.append(('stall', a, stop_led, hold, fade, speed, tail, floor, energy))
        return self

    def fill(self, a, step=1.45, level=0.7, until=None):
        """Progress bar: LED n (0-based) switches on at a + round(n * step) and holds at `level`
        until `until` (default: the end of the timeline)."""
        self.events.append(('fill', a, step, level, self.end if until is None else until))
        return self

    def eyes_rows(self, a, b, rows='bottom', close=3):
        """Eyes show only some rows between a and b ('bottom', 'middle', 'top' or a tuple of
        row indices 0-2), closing over `close` frames at a and reopening over `close` at b."""
        keep = {'bottom': (2,), 'middle': (1,), 'top': (0,)}.get(rows, rows)
        self.events.append(('rows', a, b, tuple(keep), close))
        return self

    def wide(self, a, b):
        """3x3 eyes (the expressive register)."""
        self.events.append(('wide', a, b))
        return self

    def brows(self, a, b, level=1.0, ramp=3):
        """Instructor brows: 4 LEDs over each eye, viewer-right brow one row higher."""
        self.events.append(('brows', a, b, level, ramp))
        return self

    def smirk(self, a, b):
        """One raised pixel at the mouth's right end (with brows: the deadpan grin)."""
        self.events.append(('smirk', a, b))
        return self

    def look(self, a, b, dx=1, dy=0):
        """Shift both eyes by whole LEDs (a glance)."""
        self.events.append(('look', a, b, dx, dy))
        return self

    def flash(self, a, b, level=1.0):
        """Whole matrix pulses (a notification ping)."""
        self.events.append(('flash', a, b, level))
        return self

    # ---------------------------------------------------------- evaluation
    @staticmethod
    def _ramp(f, a, b, r):
        if f < a or f > b:
            return 0.0
        up = min(1.0, (f - a + 1) / max(1, r))
        down = min(1.0, (b - f + 1) / max(1, r))
        return max(0.0, min(up, down))

    def evaluate(self, frame):
        """Return (grid[ROWS, COLS], mouth[MOUTH_N]) brightness for a film frame."""
        i = self._i(frame)
        inside = 0 <= i < self.n
        eye_level = float(self.eyes[i]) if inside else 0.0
        idle = float(self.mouth_idle[i]) if inside else 0.0
        g = np.zeros((ROWS, COLS), dtype=np.float32)
        mouth = np.zeros(MOUTH_N, dtype=np.float32)
        w, dx, dy = 2, 0, 0
        brows = 0.0
        smirk = False
        rows_mask = np.ones(3, dtype=np.float32)
        power = None
        for ev in self.events:
            kind = ev[0]
            if kind == 'wide' and ev[1] <= frame <= ev[2]:
                w = 3
            elif kind == 'look' and ev[1] <= frame <= ev[2]:
                dx, dy = ev[3], ev[4]
            elif kind == 'brows':
                brows = max(brows, ev[3] * self._ramp(frame, ev[1], ev[2], ev[4]))
            elif kind == 'smirk' and ev[1] <= frame <= ev[2]:
                smirk = True
            elif kind == 'blink':
                # canon: middle row only, dark, middle row only, then full (2 frames each at dur 6)
                t = frame - ev[1]
                ph = max(1, int(ev[2]) // 3)
                if 0 <= t < ph or 2 * ph <= t < 3 * ph:
                    rows_mask = rows_mask * np.array([0, 1, 0], dtype=np.float32)
                elif ph <= t < 2 * ph:
                    rows_mask = rows_mask * 0.0
            elif kind == 'rows':
                _, a, b, keep, close = ev
                if a <= frame <= b:
                    k = min(frame - a + 1, b - frame + 1)        # frames into the close / before the reopen
                    want = np.zeros(3, dtype=np.float32)
                    for r in keep:
                        want[r] = 1.0
                    if k < close:                                 # rows go out (come back) from the top
                        n_on = max(len(keep), 3 - int(round(3 * k / max(1, close))))
                        want = np.zeros(3, dtype=np.float32)
                        want[3 - n_on:] = 1.0
                        for r in keep:
                            want[r] = 1.0
                    rows_mask = rows_mask * want
            elif kind == 'power_on':
                f0, step = ev[1], ev[2]
                k = (frame - f0) / max(1, step)
                power = k
                idle *= min(1.0, max(0.0, (k - 7) / 4.0)) if frame >= f0 else 0.0
            elif kind == 'speak':
                _, a, b, energy, speed, tail = ev
                if a <= frame <= b + 24:
                    head = (frame - a) / 24.0 * speed
                    span = MOUTH_N + tail
                    env = self._ramp(frame, a, b + 8, 3)
                    for c in range(MOUTH_N):
                        best = 0.0
                        for k in range(10):
                            pos = head - k * span * 0.6
                            d = pos - c
                            if 0 <= d <= tail:
                                best = max(best, (1 - d / tail) ** 1.5)
                        mouth[c] = max(mouth[c], max(0.16, energy * best) * env)
            elif kind == 'wave':
                _, f0, speed, tail, floor, energy, end, fade = ev
                head = (frame - f0) * speed / 24.0
                k = 1.0
                if end is not None:
                    if frame >= end:
                        continue
                    k = min(1.0, max(0.0, (end - frame) / max(1, fade)))
                if 0 <= head <= MOUTH_N + tail:
                    for c in range(MOUTH_N):
                        d = head - c
                        v = energy * (1 - d / tail) if 0 <= d <= tail else 0.0
                        if d >= 1.0:
                            v *= k
                        mouth[c] = max(mouth[c], floor * k, v)
            elif kind == 'stall':
                _, f0, stop, hold, fade, speed, tail, floor, energy = ev
                stop_c = stop - 1
                t_stop = round(stop_c * 24.0 / speed)          # the head arrives on a whole frame
                t = frame - f0
                if 0 <= t <= t_stop + hold + fade:
                    head = min(t * speed / 24.0, stop_c)
                    k = 1.0 - min(1.0, max(0.0, (t - t_stop - hold) / max(1, fade)))
                    for c in range(MOUTH_N):
                        d = head - c
                        v = energy * (1 - d / tail) if 0 <= d <= tail else 0.0
                        mouth[c] = max(mouth[c], k * max(floor, v) + (1 - k) * idle * self.idle_mask[c])
            elif kind == 'fill':
                _, f0, step, lvl, until = ev
                if f0 <= frame <= until:
                    for c in range(MOUTH_N):
                        if frame >= f0 + round(c * step):
                            mouth[c] = max(mouth[c], lvl)
            elif kind == 'sweep':
                t = (frame - ev[1]) / max(1, ev[2])
                if 0 <= t <= 1.5:
                    pos = t * (MOUTH_N + 6)
                    for c in range(MOUTH_N):
                        d = pos - c
                        if 0 <= d <= 6:
                            mouth[c] = max(mouth[c], ev[3] * (1 - d / 6) ** 1.3)
            elif kind == 'flash':
                v = ev[3] * self._ramp(frame, ev[1], ev[2], 2)
                g = np.maximum(g, 0.25 * v)
                mouth = np.maximum(mouth, 0.4 * v)
        # eyes
        for n, (ex, ey) in enumerate(EYES):
            x = ex + dx - (1 if (w == 3 and n == 0) else 0)
            y = ey + dy
            m = np.zeros((3, w), dtype=np.float32)
            m[:, :] = rows_mask[:, None]
            if power is not None:
                order = [(r, c) for r in range(3) for c in range(w)]
                for k, (r, c) in enumerate(order):
                    m[r, c] *= min(1.0, max(0.0, power - k - n * len(order) + 1))
            g[y:y + 3, x:x + w] = np.maximum(g[y:y + 3, x:x + w], eye_level * m)
        if brows > 0:
            g[3 + dy, 3 + dx:7 + dx] = np.maximum(g[3 + dy, 3 + dx:7 + dx], brows * eye_level)
            g[2 + dy, 15 + dx:19 + dx] = np.maximum(g[2 + dy, 15 + dx:19 + dx], brows * eye_level)
        mouth = np.maximum(mouth, idle * self.idle_mask)
        if smirk:
            g[11, 17] = max(g[11, 17], eye_level)   # raised corner just above the mouth's right end
        return g, mouth

    def atlas_shape(self):
        """(columns, frames per column) of the baked atlas."""
        fpc = min(self.n, FRAMES_PER_COLUMN)
        return (self.n + fpc - 1) // fpc, fpc

    def atlas(self, name):
        """Bake every frame into one float image of COLS-wide, BLOCK-tall cells, wrapped into
        columns of FRAMES_PER_COLUMN frames (so long timelines stay under GPU texture limits:
        1440 frames -> 506 x 1088 px). Frame i sits in column i // fpc, block i % fpc.

        Within a block (image rows run bottom-up): row 0 = mouth values,
        rows 1..16 = grid rows from bottom (row 15) to top (row 0).
        """
        ncol, fpc = self.atlas_shape()
        h = BLOCK * fpc
        px = np.zeros((h, COLS * ncol, 4), dtype=np.float32)
        for i in range(self.n):
            g, mouth = self.evaluate(self.start + i)
            base = (i % fpc) * BLOCK
            x0 = (i // fpc) * COLS
            px[base, x0:x0 + MOUTH_N, 0] = np.power(np.clip(mouth, 0.0, None), MOUTH_GAMMA)
            px[base + 1:base + 1 + ROWS, x0:x0 + COLS, 0] = g[::-1]
        px[:, :, 3] = 1.0
        img = bpy.data.images.get(name)
        if img is not None:
            bpy.data.images.remove(img)
        img = bpy.data.images.new(name, COLS * ncol, h, alpha=False, float_buffer=True)
        img.colorspace_settings.name = 'Non-Color'
        img.pixels.foreach_set(px.ravel())
        img.pack()
        return img


def screen_material(timeline, name='SynergyScreen', strength=0.95, glass_roughness=0.06,
                    unlit=0.0003, color=LED_GREEN, glass_color=(0.0080, 0.0091, 0.0044), specular=0.25,
                    coat=0.0, eye_fill=EYE_FILL, mouth_fill=MOUTH_FILL, hot_core=0.30):
    """Black glass with the LED matrix driven by `timeline`.

    The screen mesh's UVs must span the glass 0..1 (u left->right as seen
    from the front, v bottom->top). glass_color #16180E, roughness 0.06 and a
    low specular level keep the glass pure black apart from the LEDs and one
    sharp reflection of the brightest source (the skylight slot). The LEDs emit
    for camera rays only (no green spill on the chassis) and are never sampled
    as lights.
    """
    img = timeline.atlas(name + '_atlas')
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    try:
        mat.cycles.emission_sampling = 'NONE'
    except (AttributeError, TypeError):
        pass
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    for n in list(N):
        N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    bsdf = N.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (*glass_color, 1)  # #16180E
    bsdf.inputs['Roughness'].default_value = glass_roughness
    bsdf.inputs['Specular IOR Level'].default_value = specular
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = glass_roughness
    bsdf.inputs['Coat IOR'].default_value = 1.5
    L.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    def m(op, a=None, b=None, va=None, vb=None, clamp=False):
        node = N.new('ShaderNodeMath')
        node.operation = op
        node.use_clamp = clamp
        for idx, (sock, val) in enumerate(((a, va), (b, vb))):
            if sock is not None:
                L.new(sock, node.inputs[idx])
            elif val is not None:
                node.inputs[idx].default_value = val
        return node.outputs[0]

    def maprange(x, a, b):
        node = N.new('ShaderNodeMapRange')
        node.inputs['From Min'].default_value = a
        node.inputs['From Max'].default_value = b
        L.new(x, node.inputs['Value'])
        return node.outputs['Result']

    ncol, fpc = timeline.atlas_shape()

    def lookup(col, row_in_block):
        """Sample atlas cell (col, row_in_block) of the current frame block."""
        fcol = m('FLOOR', m('DIVIDE', frame_idx, vb=fpc))
        frow = m('SUBTRACT', frame_idx, m('MULTIPLY', fcol, vb=fpc))
        u = m('DIVIDE', m('ADD', m('ADD', col, m('MULTIPLY', fcol, vb=COLS)), vb=0.5), vb=COLS * ncol)
        row = m('ADD', m('MULTIPLY', frow, vb=BLOCK), row_in_block)
        v = m('DIVIDE', m('ADD', row, vb=0.5), vb=BLOCK * fpc)
        comb = N.new('ShaderNodeCombineXYZ')
        L.new(u, comb.inputs['X'])
        L.new(v, comb.inputs['Y'])
        tex = N.new('ShaderNodeTexImage')
        tex.image = img
        tex.interpolation = 'Closest'
        tex.extension = 'EXTEND'
        L.new(comb.outputs['Vector'], tex.inputs['Vector'])
        sep = N.new('ShaderNodeSeparateColor')
        L.new(tex.outputs['Color'], sep.inputs['Color'])
        return sep.outputs['Red']

    def led_shape(fx, fy, half_w, half_h):
        """Small square LED in a cell (soft 1-2 px edge); returns (core, halo, hot)."""
        ax = m('DIVIDE', m('ABSOLUTE', m('SUBTRACT', fx, vb=0.5)), vb=half_w / 0.5)
        ay = m('DIVIDE', m('ABSOLUTE', m('SUBTRACT', fy, vb=0.5)), vb=half_h / 0.5)
        d = m('POWER', m('ADD', m('POWER', ax, vb=8.0), m('POWER', ay, vb=8.0)), vb=1 / 8.0)
        dr = m('POWER', m('ADD', m('POWER', ax, vb=2.0), m('POWER', ay, vb=2.0)), vb=0.5)
        return maprange(d, 0.5, 0.45), maprange(d, 0.62, 0.45), maprange(dr, 0.45, 0.0)

    uvn = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(uvn.outputs['UV'], sep.inputs['Vector'])
    U, V = sep.outputs['X'], sep.outputs['Y']

    val = N.new('ShaderNodeValue')
    val.label = 'face_frame'
    drv = val.outputs[0].driver_add('default_value').driver
    drv.type = 'SCRIPTED'
    drv.expression = f'max(0, min({timeline.n - 1}, floor(frame) - {timeline.start}))'
    frame_idx = val.outputs[0]

    # main 22 x 16 matrix (lit square = eye_fill of the pitch, dark gaps between)
    cx, cy = m('MULTIPLY', U, vb=COLS), m('MULTIPLY', V, vb=ROWS)
    ix, iy = m('FLOOR', cx), m('FLOOR', cy)
    fx, fy = m('SUBTRACT', cx, ix), m('SUBTRACT', cy, iy)
    grid_val = lookup(ix, m('ADD', iy, vb=1.0))
    core, halo, hot = led_shape(fx, fy, eye_fill / 2, eye_fill / 2)
    lit_shape = m('MULTIPLY', m('ADD', core, m('MULTIPLY', halo, vb=0.12)), m('ADD', m('MULTIPLY', hot, vb=hot_core),
                                                                            vb=1.0))
    grid_lit = m('MULTIPLY', lit_shape, grid_val)
    grid_dim = m('MULTIPLY', core, vb=unlit)

    # mouth band: 22 square dots (mouth_fill of the 4.5 mm pitch, as tall as wide)
    mu = m('DIVIDE', m('SUBTRACT', U, vb=MOUTH_U[0]), vb=MOUTH_U[1] - MOUTH_U[0])
    mv = m('DIVIDE', m('SUBTRACT', V, vb=MOUTH_V - MOUTH_H / 2), vb=MOUTH_H)
    in_u = m('MULTIPLY', m('GREATER_THAN', mu, vb=0.0), m('LESS_THAN', mu, vb=1.0))
    in_v = m('MULTIPLY', m('GREATER_THAN', mv, vb=0.0), m('LESS_THAN', mv, vb=1.0))
    in_band = m('MULTIPLY', in_u, in_v)
    mcx = m('MULTIPLY', mu, vb=MOUTH_N)
    mix_ = m('FLOOR', mcx)
    mfx = m('SUBTRACT', mcx, mix_)
    mouth_val = lookup(mix_, N.new('ShaderNodeValue').outputs[0])
    dot_h = mouth_fill * (MOUTH_U[1] - MOUTH_U[0]) / MOUTH_N * SCREEN_ASPECT / MOUTH_H   # in band units
    mcore, mhalo, mhot = led_shape(mfx, mv, mouth_fill / 2, dot_h / 2)
    mshape = m('MULTIPLY', m('ADD', mcore, m('MULTIPLY', mhalo, vb=0.12)), m('ADD', m('MULTIPLY', mhot, vb=hot_core * 0.6),
                                                                             vb=1.0))
    mouth_lit = m('MULTIPLY', m('MULTIPLY', mshape, mouth_val), in_band)
    mouth_dim = m('MULTIPLY', m('MULTIPLY', mcore, in_band), vb=unlit)

    # the grid's own cells are suppressed inside the mouth band
    not_band = m('SUBTRACT', None, in_band, va=1.0)
    total = m('ADD',
              m('MULTIPLY', m('ADD', grid_lit, grid_dim), not_band),
              m('ADD', mouth_lit, mouth_dim))
    # all light stays inside the glass: emission is seen by camera rays only
    lp = N.new('ShaderNodeLightPath')
    total = m('MULTIPLY', total, lp.outputs['Is Camera Ray'])

    bsdf.inputs['Emission Color'].default_value = (*color, 1)
    L.new(m('MULTIPLY', total, vb=strength), bsdf.inputs['Emission Strength'])
    mat['face_start'] = timeline.start
    return mat
