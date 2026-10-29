"""Synergy's LED face: a timeline of pixel states baked into an atlas image.

Canon (LinkedIn Beats continuity notes and the approved camera-v2 plate):
  * a recessed, flat, black glass screen; all light stays inside the glass
  * a 22 x 16 matrix of square LEDs; unlit cells are barely visible
  * eyes: 2 wide x 3 tall, columns 5-6 and 15-16, rows 5-7 (row 0 = top)
  * mouth: ONE row of 22 small LEDs on a finer pitch, 80% down the screen.
    Speech changes brightness only, travelling LEFT TO RIGHT (~15 LEDs/s,
    falling off over ~7 LEDs). It never grows vertically. Idle glow 11%.
  * blinks collapse the eyes to one row, then dark for 2-3 frames
  * expressive register (rare, earned): 3x3 eyes, 4-LED brows with the
    viewer-right brow raised a row higher, one raised mouth-corner pixel

Each frame is evaluated to a 22 x 16 grid plus a 22-value mouth row. All
frames of a shot are stacked into one float atlas (22 wide, 17 rows per
frame). The screen shader selects the current block with a driver and draws
every LED as a soft rounded square, so the face stays crisp in macro.
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
LED_GREEN = (0.10, 1.0, 0.26)  # canon #4aff70, pre-saturated for AgX


class FaceTimeline:
    """Per-shot face performance. All frame arguments are film frames."""

    def __init__(self, start, end, eyes=1.0, mouth_idle=0.11):
        self.start, self.end = start, end
        self.n = end - start + 1
        self.eyes = np.full(self.n, eyes, dtype=np.float32)
        self.mouth_idle = np.full(self.n, mouth_idle, dtype=np.float32)
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
        rows_on = 3
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
                t = (frame - ev[1]) / max(1, ev[2])
                if 0 <= t <= 1:
                    closed = 1.0 - abs(2 * t - 1)       # 0 -> 1 -> 0
                    rows_on = min(rows_on, 3 - int(round(closed * 3)))
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
            # blink: rows switch off from the top
            m[3 - rows_on:, :] = 1.0
            if power is not None:
                order = [(r, c) for r in range(3) for c in range(w)]
                for k, (r, c) in enumerate(order):
                    m[r, c] *= min(1.0, max(0.0, power - k - n * len(order) + 1))
            g[y:y + 3, x:x + w] = np.maximum(g[y:y + 3, x:x + w], eye_level * m)
        if brows > 0:
            g[3 + dy, 3 + dx:7 + dx] = np.maximum(g[3 + dy, 3 + dx:7 + dx], brows * eye_level)
            g[2 + dy, 15 + dx:19 + dx] = np.maximum(g[2 + dy, 15 + dx:19 + dx], brows * eye_level)
        mouth = np.maximum(mouth, idle)
        if smirk:
            g[11, 17] = max(g[11, 17], eye_level)   # raised corner just above the mouth's right end
        return g, mouth

    def atlas(self, name):
        """Bake every frame into one float image: width COLS, BLOCK rows per frame.

        Within a block (image rows run bottom-up): row 0 = mouth values,
        rows 1..16 = grid rows from bottom (row 15) to top (row 0).
        """
        h = BLOCK * self.n
        px = np.zeros((h, COLS, 4), dtype=np.float32)
        for i in range(self.n):
            g, mouth = self.evaluate(self.start + i)
            base = i * BLOCK
            px[base, :MOUTH_N, 0] = mouth
            px[base + 1:base + 1 + ROWS, :, 0] = g[::-1]
        px[:, :, 3] = 1.0
        img = bpy.data.images.get(name)
        if img is not None:
            bpy.data.images.remove(img)
        img = bpy.data.images.new(name, COLS, h, alpha=False, float_buffer=True)
        img.colorspace_settings.name = 'Non-Color'
        img.pixels.foreach_set(px.ravel())
        img.pack()
        return img


def screen_material(timeline, name='SynergyScreen', strength=3.2, glass_roughness=0.06,
                    unlit=0.0015, color=LED_GREEN):
    """Black glass with the LED matrix driven by `timeline`.

    The screen mesh's UVs must span the glass 0..1 (u left->right as seen
    from the front, v bottom->top).
    """
    img = timeline.atlas(name + '_atlas')
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    for n in list(N):
        N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    bsdf = N.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.0045, 0.0052, 0.0035, 1)  # #0E100C
    bsdf.inputs['Roughness'].default_value = 0.4
    bsdf.inputs['Coat Weight'].default_value = 1.0
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

    def lookup(col, row_in_block):
        """Sample atlas cell (col, row_in_block) of the current frame block."""
        u = m('DIVIDE', m('ADD', col, vb=0.5), vb=COLS)
        row = m('ADD', m('MULTIPLY', frame_idx, vb=BLOCK), row_in_block)
        v = m('DIVIDE', m('ADD', row, vb=0.5), vb=BLOCK * timeline.n)
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
        """Soft rounded rectangle in a cell; returns (core, halo)."""
        ax = m('DIVIDE', m('ABSOLUTE', m('SUBTRACT', fx, vb=0.5)), vb=half_w / 0.5)
        ay = m('DIVIDE', m('ABSOLUTE', m('SUBTRACT', fy, vb=0.5)), vb=half_h / 0.5)
        d = m('POWER', m('ADD', m('POWER', ax, vb=6.0), m('POWER', ay, vb=6.0)), vb=1 / 6.0)
        return maprange(d, 0.5, 0.42), maprange(d, 0.9, 0.42)

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

    # main 22 x 16 matrix (lit square = 81% of the pitch)
    cx, cy = m('MULTIPLY', U, vb=COLS), m('MULTIPLY', V, vb=ROWS)
    ix, iy = m('FLOOR', cx), m('FLOOR', cy)
    fx, fy = m('SUBTRACT', cx, ix), m('SUBTRACT', cy, iy)
    grid_val = lookup(ix, m('ADD', iy, vb=1.0))
    core, halo = led_shape(fx, fy, 0.405, 0.405)
    grid_lit = m('MULTIPLY', m('ADD', core, m('MULTIPLY', halo, vb=0.2)), grid_val)
    grid_dim = m('MULTIPLY', core, vb=unlit)

    # mouth band: 22 LEDs, 3.4 x 6.8 mm on a 4.5 mm pitch
    mu = m('DIVIDE', m('SUBTRACT', U, vb=MOUTH_U[0]), vb=MOUTH_U[1] - MOUTH_U[0])
    mv = m('DIVIDE', m('SUBTRACT', V, vb=MOUTH_V - MOUTH_H / 2), vb=MOUTH_H)
    in_u = m('MULTIPLY', m('GREATER_THAN', mu, vb=0.0), m('LESS_THAN', mu, vb=1.0))
    in_v = m('MULTIPLY', m('GREATER_THAN', mv, vb=0.0), m('LESS_THAN', mv, vb=1.0))
    in_band = m('MULTIPLY', in_u, in_v)
    mcx = m('MULTIPLY', mu, vb=MOUTH_N)
    mix_ = m('FLOOR', mcx)
    mfx = m('SUBTRACT', mcx, mix_)
    mouth_val = lookup(mix_, N.new('ShaderNodeValue').outputs[0])
    mcore, mhalo = led_shape(mfx, mv, 0.38, 0.5)
    mouth_lit = m('MULTIPLY', m('MULTIPLY', m('ADD', mcore, m('MULTIPLY', mhalo, vb=0.2)), mouth_val), in_band)
    mouth_dim = m('MULTIPLY', m('MULTIPLY', mcore, in_band), vb=unlit)

    # the grid's own cells are suppressed inside the mouth band
    not_band = m('SUBTRACT', None, in_band, va=1.0)
    total = m('ADD',
              m('MULTIPLY', m('ADD', grid_lit, grid_dim), not_band),
              m('ADD', mouth_lit, mouth_dim))

    bsdf.inputs['Emission Color'].default_value = (*color, 1)
    L.new(m('MULTIPLY', total, vb=strength), bsdf.inputs['Emission Strength'])
    mat['face_start'] = timeline.start
    return mat
