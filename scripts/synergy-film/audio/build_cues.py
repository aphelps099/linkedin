"""Generate audio/cues.json, the complete 60 s soundtrack of "Offline", for audio/mix.py.

    python3 audio/build_cues.py            # writes audio/cues.json
    python3 audio/mix.py audio/cues.json --out out/audio/mix.wav --stems out/audio/stems
    python3 audio/verify_mix.py            # checks the render against the brief

cues.json is generated: edit this file, not the JSON. Every frame number comes from TREATMENT.md and
the music edit from audio/music_edit.json. Beat b starts at frame 16b+1; bar k at 64k+1; frame f covers
samples [(f-1)*2000, f*2000). Numeric anchor_s values are measured attack times in the source files
(HF-weighted 1 ms envelope, first point within 12 dB of the attack peak), so each hit lands on its frame.
Shot-by-shot notes, files and licences: audio/CUES.md.
"""
import json
import os

FILM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(FILM, 'audio', 'cues.json')
EDIT = json.load(open(os.path.join(FILM, 'audio', 'music_edit.json')))


def B(b):
    return 16 * b + 1


TRACK = 'music_lofi/mixkit-970-night-sky-hip-hop.mp3'
F = {  # library files (relative to out/audio/raw)
    'hvac': 'ambience/sonniss2017-hzandbits-hvac-elements--roomtone-hvac-drone-hum-low-mids-loop.wav',
    'stream': 'ambience/sonniss2018-discover-oregon-ocean-and-stream--streams-quietstream.wav',
    'wind': 'ambience/mixkit-2658-wind-blowing-ambience.wav',
    'pines': 'ambience/sonniss2015-soundopolis-natures-fury-wind-01--wind-trees-cattails-fienup-001.wav',
    'falls': 'ambience/mixkit-2515-big-waterfall-loop.wav',
    'night': 'ambience/mixkit-1227-summer-night-in-the-forest.wav',
    'frog': 'ambience/mixkit-1241-forest-ambience-with-croaking-frogs.wav',
    'heater': 'ambience/sonniss2017-detunized-room-tones-office-building--rt-office-heater-tone-2.flac',
    'server': 'ambience/sonniss2015-giorgio-riolo-silentscapes--sfxw001-indoor-server-room.flac',
    'buzz': 'ambience/sonniss2015-soundopolis-sci-fi-electric--streetlight-buzz-fienup-002.wav',
    'computers': 'ambience/sonniss2017-detunized-room-tones-office-building--rt-office-turn-on-off-computers.flac',
    'walla': 'ambience/berklee-v10-crowd1.wav',
    'cardboard': 'sfx/cup_creak/sonniss2018-effectsworks-creaks-squeaks-squeals-card-cardboard-box-2-creak-small-file-3-takes-7.wav',
    'plastic_bend': 'sfx/cup_creak/sonniss2019-matt-script-squeaks-creaks-grinding-plastic-bending-tension-squeaking-creaking-under-pressure-11.wav',
    'windy_swoosh': 'sfx/whoosh/mixkit-1474-transition-windy-swoosh.wav',
    'flying_swoosh': 'sfx/whoosh/mixkit-3161-transition-flying-swoosh.wav',
    'swoosh': 'sfx/whoosh/berklee-v8-swoosh1.wav',
    'mouse': 'sfx/office/mixkit-1113-mouse-click-close.wav',
    'paper_quick': 'sfx/paper/mixkit-2380-paper-quick-movement.wav',
    'page_turn': 'sfx/paper/mixkit-1105-big-paper-page-turn.wav',
    'crumble': 'sfx/paper/mixkit-2382-paper-crumble.wav',
    'papers_wind': 'sfx/paper/mixkit-2652-wind-blowing-papers.wav',
    'shuffle': 'sfx/paper/sonniss2018-hear-and-now-sound-office-equipment-and---shuffling-paper-4.wav',
    'cave_drop': 'sfx/nature/mixkit-3179-water-drop-splashes-in-cave.wav',
    'metal_drops': 'sfx/cup_drop/usc-gold-tape-53-54-water-g54-34-metallic-drops.wav',
    'wood_drops': 'sfx/cup_drop/usc-gold-tape-53-54-water-g54-36-wooden-drops.wav',
    'marble': 'sfx/cup_drop/sonniss2019-the-sound-pack-tree-marbles-247405-small-marble-throw-in-05.wav',
    'coins': 'sfx/cup_drop/sonniss2017-hzandbits-money-money-coins-drop-in-cash-register.wav',
    'peas': 'sfx/cup_drop/sonniss2017-alexander-ahura-groats-part1-peas-into-glass-cup-019.wav',
    'servo_usc': 'sfx/caster_motor/usc-sse-library-motors-servo-motrsrvo-spaceship-servo-motors-from-2010-cs-usc.wav',
    'servo006': 'sfx/robot_mech/sonniss2016-matiasmacsd-the-machines-robotic-sounds--robot-servo-006.wav',
    'power_window': 'sfx/robot_mech/sonniss2015-thelibrarybyemptysea-robobiotics--thelibrarybymtc-robo-servo-powerwindow-035.wav',
    'joints': 'sfx/robot_mech/sonniss2015-thelibrarybyemptysea-robobiotics--thelibrarybymtc-robo-foley-joints-mvmt-002.wav',
    'cam_clicks': 'sfx/foley_misc/sonniss2015-eiravaein-works-start-select-startselect-ui-set57-camera-mechanics-servo-clicks-clacks-meaty-opera.wav',
    'canister': 'sfx/hydraulic/sonniss2023-sanojsounds-essentials-vol-1--airmisc-metalcanisterpressurequickairreleasesuckin-sanojsoun.flac',
    'hyd_release': 'sfx/hydraulic/sonniss2023-justsoundeffects-industrial-robot--mechhydr-hydraulic-pressure-releasing-jse-ir-01-stereo.wav',
    'printer': 'sfx/office/sonniss2015-robert-cordova-base--printer-02.wav',
    'chair_creak': 'sfx/office/sonniss2017-soundbits-unsettling-creaks-and-squeaks--office-chair-creak-70.wav',
    'carpet_wheels': 'sfx/caster_motor/sonniss2023-badlands-sound-retro-vacuum-retro-vacuum-cleaner-exterior-wheels-moving-slowly-on-carpet-left-to-r.wav',
    'rattle_wheels': 'sfx/caster_motor/usc-red-library-machines-2-r18-18-chair-with-little-wheels-rattles.wav',
    'metal_wheels': 'sfx/caster_motor/usc-red-library-foley-props-1-r09-08-chair-with-metal-wheels.wav',
    'drag': 'sfx/resonance/sonniss2017-double-trouble-audio-metal-resonances--mr-small-metal-box-bright-creaking-tonal-dragging-96-khz.wav',
    'gear_tap': 'sfx/robot_mech/mixkit-2857-gear-fast-lock-tap.wav',
    'cup_down': 'sfx/foley_misc/usc-red-library-foley-props-2-r19-11-set-cup-down-on-table.wav',
    'plastic_hit': 'sfx/foley_misc/mixkit-3204-plastic-hit.wav',
    'plastic_handling': 'sfx/foley_misc/usc-red-library-foley-props-1-r16-39-handling-plastic-objects.wav',
    'plastic_clatter': 'sfx/foley_misc/commons-plastic-object-clattering.ogg',
    'glass_cup': 'sfx/liquid/berklee-v10-glass_cup_1.wav',
    'long_metal': 'sfx/impact/sonniss2016-3maze-high-impact--long-metal-005.wav',
    'bulkhead': 'sfx/impact/sonniss2016-alexander-kopeikin-sci-fi-metal-elements--sci-fi-metal-impact-steel-bulkhead-hit-low-01.wav',
    'bird': 'sfx/nature/mixkit-2702-bird-flying-away.wav',
    'trs': 'sfx/jack/sonniss2024-bolt-arp-2600-droids-blips-drones-more-mechmisc-trs-cable-plug-in-solid-metal-thump-bolt-arp2600.wav',
    'metal_clicks': 'sfx/jack/usc-sse-library-mechanical-click-mechclik-metal-clicks-several-takes-cs-usc.wav',
    'amp_cable': 'sfx/jack/sonniss2016-matiasmacsd-noise-electricguitarampcableconnection-003.wav',
    'static_up': 'sfx/power/mixkit-2600-electricity-static-power-up.wav',
    'humbuzz': 'sfx/power/sonniss2015-detunized-humbuzz--humbuzz-hum-17.wav',
    'headphone': 'sfx/foley_misc/sonniss2015-rdgsfx005-squeaks-and-creaks-v2-squeaks-and-creaks-headphone-squeaks-short-01-m.wav',
    'sip': 'sfx/sip/mixkit-153-mouth-sipping-a-hot-small-drink.wav',
    'ship_wood': 'sfx/ship_creak/usc-red-library-creaks-r28-03-large-wood-ship-creaking.wav',
    'ship_groan': 'sfx/ship_creak/usc-gold-tape-27-creaks-g27-11-ship-creaks.wav',
    'ship_sea': 'sfx/ship_creak/mixkit-1187-wooden-ship-on-the-sea.wav',
}

cues = []

# the camera-mechanics clicks file: two clean single clicks (measured: 1 ms envelope peak / -12 dB onset)
TICK_A = dict(src_in=0.1405, src_out=0.200, anchor_s=0.1466)   # loud click, peak 0.1476 s
TICK_B = dict(src_in=0.4100, src_out=0.450, anchor_s=0.4154)   # second click, peak 0.4166 s


def cue(shot, cid, key, at, bus, **kw):
    c = {'id': cid, 'file': F[key] if key in F else key, 'bus': bus, 'at_frame': at}
    c.update(kw)
    c['_comment'] = shot + (': ' + c.pop('note') if 'note' in c else '')
    cues.append(c)
    return c


# ------------------------------------------------------------------------------------------------
# MUSIC: the edit of music_edit.json (M1 intro pass 1, M2 intro pass 2 + groove, M3 offline return)
# ------------------------------------------------------------------------------------------------
# mix.py has no EQ lane, so a narrow, local EQ move on the score is made by handing the segment over to an identical,
# sample-aligned copy of itself that carries the EQ, and back. At each hand-over the outgoing piece fades out linearly
# over `xf` samples from the boundary while the incoming piece fades in linearly over the same samples (complementary
# and coherent: the sum is the plain track, so only the EQ changes); every piece runs on the same music_main lanes, and
# the last piece carries the segment's hard stop. Windows (start frame, end frame or None = to the end, label, eq,
# xf in, xf out, why):
EQ_PRN = [{'type': 'peak', 'hz': 2400, 'gain_db': -3.0, 'q': 0.8}]
EQ_WINDOWS = {
    'M2': [(256.5, 260.6, 'printer-f257', EQ_PRN, 1000, 2000,
            'a 3 dB dip at 1.5-4 kHz for the 150 ms after the drop, under the printer feed'),
           (320.5, 324.6, 'printer-f321', EQ_PRN, 1000, 2000,
            'a 3 dB dip at 1.5-4 kHz for the 150 ms after f321, under the printer feed'),
           (704.5, 709.5, 'post8', [{'type': 'peak', 'hz': 1245, 'gain_db': -6.0, 'q': 1.5}], 1000, 2000,
            'a 6 dB notch at 1245 Hz (Q 1.5) for the 150 ms of the Eb6 post on f705, the melody\'s top note'),
           (929, None, 'S10', [{'type': 'peak', 'hz': 3000, 'gain_db': -3.0, 'q': 1.0}], 480, None,
            'a 3 dB dip at 2-4 kHz (peak 3 kHz, Q 1) for the finger, grip and knuckle foley, from the cut')],
    'M3': [(1304, 1322, 'tilt', [{'type': 'peak', 'hz': 200, 'gain_db': -4.0, 'q': 1.0}], 2000, 4000,
            'a 4 dB dip at 100-400 Hz (peak 200 Hz, Q 1) under the tilt creak, f1304-1322'),
           (1363, None, 'S14', [{'type': 'peak', 'hz': 200, 'gain_db': -2.5, 'q': 1.0}], 8000, None,
            'a 2.5 dB dip at 150-300 Hz (peak 200 Hz, Q 1) under the hull creak, faded in over 4 frames')],
}
for seg in EDIT['segments']:
    fr = seg['film_frames']
    ft = seg['file_time_s']
    base = {
        'id': f'music-{seg["id"]}', 'file': TRACK, 'bus': 'music',
        'src_in': ft[0], 'src_out': ft[1], 'at_frame': fr[0], 'end_frame': fr[1] + 1,
        'fade_in_samples': seg['fade_in']['samples'], 'fade_out_samples': seg['fade_out']['samples'],
        'guard_samples': seg['fade_out']['guard_samples'], 'automation': 'music_main',
        '_comment': f'music edit segment {seg["id"]}: {seg["role"]}; file {ft[0]:.4f}-{ft[1]:.4f} s on frames '
                    f'{fr[0]}-{fr[1]}, sample-exact butt edits (12-sample fade in, 4 ms fade out, 1 ms guard)'}
    wins = EQ_WINDOWS.get(seg['id'])
    if not wins:
        cues.append(base)
        continue
    # boundaries: (frame, xf, eq of the piece that starts there, label, why)
    bounds = []
    for (a, b, label, eq, xin, xout, why) in wins:
        bounds.append((a, xin, eq, label, why))
        if b is not None:
            bounds.append((b, xout, None, None, None))
    pieces = [(fr[0], None, None, None)] + [(f, eq, label, why) for (f, xf, eq, label, why) in bounds]
    xfs = [x for (f, x, *_ ) in bounds]
    n_plain = 0
    for k, (start, eq, label, why) in enumerate(pieces):
        c = dict(base)
        if k == 0:
            pid = base['id']
        elif eq is not None:
            pid = f'{base["id"]}-{label}'
        else:
            n_plain += 1
            pid = f'{base["id"]}-{n_plain + 1}'
        src = ft[0] + (start - fr[0]) * 2000 / 48000      # file time at the piece start (an exact sample)
        c.update(id=pid, src_in=src, at_frame=start, fade_shape='lin')
        if k > 0:
            c['fade_in_samples'] = xfs[k - 1]
        if k < len(pieces) - 1:
            nxt, xf = pieces[k + 1][0], xfs[k]
            c.update(end_frame=nxt + xf / 2000, fade_out_samples=xf, guard_samples=0)
        if eq is not None:
            c['eq'] = eq
        what = (f'with {why}' if eq is not None else 'plain')
        c['_comment'] = (f'music edit segment {seg["id"]}, piece {k + 1}/{len(pieces)} ({what}): file {src:.4f} s on '
                         f'f{start:g}, sample-aligned with the rest of the segment; linear crossfades at the hand-overs'
                         + (f'; hard stop on f{fr[1] + 1} (4 ms fade out, 1 ms guard)' if k == len(pieces) - 1 else ''))
        cues.append(c)

# Steps that change space on a cut sit 0.2 frame (8.3 ms) before the cut, so the downbeat attack that starts a few
# ms before the frame is already inside the new space (no full-band tick of the room's drums in the cup), while the
# 10 ms filter crossfade ends 1.7 ms after the cut (rev2: was 0.3 frame, 12.5 ms early, outside +-10 ms).
CUT = -0.2
lanes = {
    # the music lives where the meeting lives
    'music_main': {
        'lowpass_hz': [
            [1, 400], [129, 400],                 # S01: through the paper wall
            [250, 'open'],                        # S02: opens (log sweep) as the camera leaves the cup
            [529 + CUT, 600, 'step'], [609 + CUT, 'open', 'step'],   # S06 inside the cup / S07 back in the room
            [753 + CUT, 600, 'step'], [833 + CUT, 5000, 'step'],     # S08 inside / S09 tension: gentle 5 kHz
            [1153, 'open', 'step'],               # S12: clean and close, offline at night
            [1249 + CUT, 600, 'step'], [1281, 600],   # S13: heard from inside the cup
            [1296, 3000, 'smooth'], [1356, 3000],     # opens to 3 kHz as the cup rises to his face (f1281-1296)
            [1362, 'open', 'smooth'],             # S14: opens to full fidelity inside the white flare (f1357-1362)
        ],
        'gain_db': [
            [1, 0], [250, 0], [252.5, -24, 'ease_in'], [256.976, 0, 'step'],  # S02 held breath, back on the drop
            [352, 0], [353, -4.5, 'smooth'],                     # S04: room for Kevin's murmur, the drag and the knock,
            [428, -4.5], [432, -1.5, 'smooth'],                  # in the same relation as their S09 repeat; S05 -1.5
            [505, -1.5], [508, -4, 'smooth'], [519, -4], [526, -1.5, 'smooth'],  # S05: room for the post and plip
            [529 + CUT, -7.5, 'step'], [609 + CUT, -3, 'step'],      # S06 inside the cup (-6 re the room) / S07,
            [700, -3], [705, -6, 'smooth'],                      # 1.5 dB under S05 for the deferral machine; the hot
            [719, -6], [722, -7, 'smooth'], [746, -7], [749, -6, 'smooth'],  # fill bar 3 dB down, the binder 1 dB
                                                                 # more (4 dB re the S07 level): the cardboard carries it
            [753 + CUT, -7.5, 'step'], [833 + CUT, -5.5, 'step'],    # S08 inside (-6 re S05) / S09 ducked (-4)
            [943, -5.5], [956, -3, 'smooth'], [960, -3],         # S10 holds the S09 level, then a pre-stop push to
                                                                 # -3 so the click has a full groove to kill
            [1153, -9.5, 'step'],                                # S12: night, clean and close, and quiet
            [1249 + CUT, -14, 'step'], [1281, -14],              # S13: from inside the cup, the kit re-enters muffled
            [1296, -8, 'smooth'],                                # the swell: +6 dB as the cup rises (f1281-1296)
            [1296.6, -8], [1297.4, -10, 'smooth'], [1310, -10],  # a 2 dB give for the sip and the start of the tilt,
            [1316, -8, 'smooth'],                                # back to the full swell by f1316
            [1356, -8], [1362, -1, 'smooth'], [1409, -1],        # S14: opens up in the white flare for the last bar
        ],
        # the recording itself leans right from file bar 9 (film f705): L/R energy -0.9 dB in bar 9, -1.1 to -1.6 dB in
        # bars 10-12 (measured per bar); a balance ride re-centres it to within 0.5 dB (-0.08 attenuates R 0.6 dB,
        # -0.15 1.2 dB)
        'pan': [[1, 0], [701, 0], [705, -0.08, 'smooth'], [765, -0.08], [769, -0.15, 'smooth'], [960, -0.15],
                [1153, 0, 'step']],
    },
}



def lane_eval(pts, fr):
    """Value of a gain lane (list of [frame, value(, shape)]) at a frame, with mix.py's segment shapes."""
    import math
    pts = sorted(pts, key=lambda p: p[0])
    if fr <= pts[0][0]:
        return pts[0][1]
    for (f0, v0, *_), p1 in zip(pts, pts[1:]):
        f1, v1 = p1[0], p1[1]
        shape = p1[2] if len(p1) > 2 else 'lin'
        if f0 <= fr < f1:
            if shape == 'step':
                return v0
            u = (fr - f0) / (f1 - f0)
            u = {'smooth': 0.5 - 0.5 * math.cos(math.pi * u), 'ease_in': u * u, 'ease_out': 1 - (1 - u) ** 2}.get(shape, u)
            return v0 + (v1 - v0) * u
    return pts[-1][1]


def add_notches(pts, notches):
    """Short clip-gain dips in a gain lane: for each (peak_frame, depth_db) the lane ramps down over the 0.6 frame
    before the peak, holds 1.1 frames and recovers over 2 frames (smooth). Base points inside the dip are re-evaluated."""
    out = [list(p) for p in pts]
    for pk, d in notches:
        a, b0, b1, c = pk - 0.7, pk - 0.12, pk + 1.0, pk + 3.0
        base = {x: lane_eval(out, x) for x in (a, b0, b1, c)}
        steps = [p for p in out if a <= p[0] <= c and len(p) > 2 and p[2] == 'step']
        out = [p for p in out if not (a <= p[0] <= c) or p in steps]
        if steps:   # a step (a cut) just before the hit: the step itself lands on the dipped value
            for p in steps:
                p[1] = round(p[1] - d, 3)
            out += [[b1, round(base[b1] - d, 3)], [c, round(base[c], 3), 'smooth']]
        else:
            out += [[a, round(base[a], 3)], [b0, round(base[b0] - d, 3), 'smooth'], [b1, round(base[b1] - d, 3)],
                    [c, round(base[c], 3), 'smooth']]
        out.sort(key=lambda p: p[0])
    return out


# the deferral machine: the music gives 1.5 dB under each post (ramping in 0.6 frame ahead of it), so the plips sit on
# top of the beat they share with the kit without the groove pumping (rev2: was 3.5-5 dB; the posts carry their own
# +3 dB shelf at 4 kHz)
POST_DUCK = [(f + 0.1, 1.5) for f in (625, 641, 657, 673, 681, 689, 697, 705)]
# clip gain on the hottest transients of the licensed track (measured: the limiter's driver at these frames is the
# music stem, peaking above the -1 dBTP ceiling after the master gain); each is a 1-2 frame dip of the size needed
MUSIC_NOTCHES = [(205.12, 1.0), (257.09, 2.5), (269.11, 1.5), (308.94, 1.1), (321.39, 0.7),
                 (653.12, 0.5)]   # (frame of the music's true peak, dB); f385/f397 need none now that S04 sits lower
# inside the cup, the landing swallows the groove for a moment: 6 dB under the hit on f553
LANDING_DUCK = [(553.0, 6.0)]
lanes['music_main']['gain_db'] = add_notches(lanes['music_main']['gain_db'], POST_DUCK + MUSIC_NOTCHES + LANDING_DUCK)

# ------------------------------------------------------------------------------------------------
# helpers for repeated ambience layers
# ------------------------------------------------------------------------------------------------


DETAIL = [{'type': 'peak', 'hz': 3500, 'gain_db': 3.0, 'q': 0.7}]   # rev2: +3 dB at 2-6 kHz on the upper-detail layers
SUB_SHELF = [{'type': 'lowshelf', 'hz': 50, 'gain_db': -3.0, 'q': 0.707}]   # rev2: -3 dB below 50 Hz on the sub layers


def offline_day(shot, a, b, *, srcs, breath_gain=-4, lap_gain=0, wind_gain=-24, fade_in=1, bed_lane=None, lap_lane=None):
    hv, st, wd = srcs
    bed = {'automation': bed_lane} if bed_lane else {}
    lap = {'automation': lap_lane} if lap_lane else bed
    cue(shot, f'{shot.lower()}-world-breath', 'hvac', a, 'amb', src_in=hv, src_out=hv + 24.0,
        pitch_mode='tape', pitch_semitones=-12, highpass_hz=35, highpass_slope=48, lowpass_hz=900, loop=True,
        loop_xfade_ms=600, end_frame=b, fade_in=fade_in, fade_out=1.5, gain_db=breath_gain, eq=SUB_SHELF,
        note='the world breathing: HVAC drone loop, tape -12 st, high-passed at 35 Hz / 48 dB per octave (no infrasound), '
             '3 dB low shelf below 50 Hz')
    # lapping and air sit 3 dB higher than in v0, and +3 dB at 2-6 kHz (rev2), so the inside-the-cup shots keep their
    # detail on phone speakers
    cue(shot, f'{shot.lower()}-lapping', 'stream', a, 'amb', src_in=st, pitch_mode='tape',
        pitch_semitones=-5, highpass_hz=60, end_frame=b, fade_in=fade_in, fade_out=1.5, gain_db=lap_gain + 3, **lap,
        eq=DETAIL, note='espresso lapping on stone: quiet stream, tape -5 st (slower, larger)')
    cue(shot, f'{shot.lower()}-air', 'wind', a, 'amb', src_in=wd, highpass_hz=80, lowpass_hz=4500,
        end_frame=b, fade_in=fade_in, fade_out=1.5, gain_db=wind_gain + 3, **bed, eq=DETAIL,
        note='soft air in the cup')


def room_tone(shot, a, b, gain=-10, fade_in=1, fade_out=1.5, src=10.0, tilt=False, pan=0.0, up_gain=0.0):
    # split at 120 Hz: the low end folded to mono (it was decorrelated L/R and cancelled on mono speakers), the rest
    # narrowed to width 0.3. tilt (rev2, the dark room after the unplug): +3 dB at 1-3 kHz on the upper part, and the
    # low part 4 dB down with the take's 60 Hz hum line notched 4 dB, so the silence reads as a room, not as rumble
    up_eq = [{'type': 'peak', 'hz': 1700, 'gain_db': 3.0, 'q': 0.8}] if tilt else None
    lf_eq = [{'type': 'lowshelf', 'hz': 80, 'gain_db': -4.0, 'q': 0.707},
             {'type': 'peak', 'hz': 60, 'gain_db': -4.0, 'q': 4.0}] if tilt else None
    cue(shot, f'{shot.lower()}-roomtone', 'heater', a, 'amb', src_in=src, end_frame=b, fade_in=fade_in,
        fade_out=fade_out, gain_db=gain + 3.2 + up_gain, highpass_hz=120, width=0.3, pan=pan, **({'eq': up_eq} if up_eq else {}),
        note='Long Room tone: office heater tone above 120 Hz at width 0.3 (its L/R are slightly anti-correlated, so '
             'at full width it cancelled on mono speakers); +3.2 dB restores the per-channel level'
             + ('; +3 dB at 1-3 kHz (rev2 tilt)' if tilt else ''))
    cue(shot, f'{shot.lower()}-roomtone-lf', 'heater', a, 'amb', src_in=src, end_frame=b, fade_in=fade_in,
        fade_out=fade_out, gain_db=gain + 6, highpass_hz=30, lowpass_hz=120, channels='mono',
        **({'eq': lf_eq} if lf_eq else {}),
        note='Long Room tone: the same take below 120 Hz, folded to mono (+6 dB: its L/R are uncorrelated, so the '
             'fold and the centre pan each cost 3 dB)' + ('; -4 dB low shelf at 80 Hz, 60 Hz hum notched 4 dB '
                                                          '(rev2 tilt)' if tilt else ''))


# ------------------------------------------------------------------------------------------------
# S01  f1-128  Offline day, inside the cup
# ------------------------------------------------------------------------------------------------
# the espresso lapping gives 5 dB under each creak (f26-60, f78-110), so the fibrous crackle reads
offline_day('S01', 1, 129, srcs=(6.0, 4.0, 20.0), fade_in=20, breath_gain=-6, lap_gain=2,
            lap_lane={'gain_db': [[1, 0], [24, 0], [28, -5, 'smooth'], [58, -5], [62, 0, 'smooth'], [76, 0],
                                  [80, -5, 'smooth'], [108, -5], [112, 0, 'smooth']]})
for i, (at, take_in, take_out) in enumerate([(26, 3.55, 4.75), (78, 9.35, 10.45)]):
    cue('S01', f's01-cup-creak-{i + 1}', 'cardboard', at, 'fx', src_in=take_in, src_out=take_out, pitch_mode='tape',
        pitch_semitones=-24, lowpass_hz=3000, highpass_hz=90, highpass_slope=48, fade_in=3, fade_out=6,
        gain_db=-14 - 3 * i + 9, reverb='hall', reverb_send=-16, pan=-0.25 + 0.5 * i, end_frame=129,
        note='a paper cup squeezed, two octaves down: the cliffs creak (cardboard-box creak take, tape -24 st); '
             'low-passed at 3 kHz so the fibrous crackle sits above the 400 Hz music')
# rev2: the Mixkit "deep air woosh" is dual mono with no recording noise floor (cannot be confirmed as a recording); the
# eclipse is now the Berklee organic swoosh (a real -60 dB floor), tape -9 st (0.6x speed): its rise starts on f104,
# its body peaks around f122 as the fingers cover the slot, and the match cut takes it
cue('S01', 's01-eclipse-whoosh', 'swoosh', 104, 'fx', src_in=0.05, anchor_s=0.12, pitch_mode='tape', pitch_semitones=-9,
    lowpass_hz=1800, highpass_hz=30, gain_db=-6.5, fade_out=2, end_frame=129, reverb='hall', reverb_send=-14,
    note='eclipse at f104: a long, soft, deep air whoosh (Berklee swoosh1, tape -9 st, low-passed at 1.8 kHz); cut on '
         'the match cut')

# ------------------------------------------------------------------------------------------------
# S02  f129-256  lid macro, pull back to Synergy
# ------------------------------------------------------------------------------------------------
room_tone('S02-S05', 129, 529, fade_in=0.5)
cue('S02-S05', 's02-s05-meeting-hum', 'server', 129, 'amb', src_in=20.0, end_frame=529, fade_in=0.5, fade_out=1.5,
    gain_db=-14, lowpass_hz=4500, highpass_hz=60, note='the live meeting: terminals and hub fans (server-room ambience, low)')
cue('S02', 's02-lid-tick', 'mouse', 131, 'foley', src_in=0.12, src_out=0.40, anchor_s='onset', gain_db=-17,
    pan=0.05, lowpass_hz=9000, note='plastic lid tick under the fingertip (close mouse click)')
cue('S02', 's02-envelope-rustle', 'paper_quick', 142, 'foley', anchor_s=0.4222, gain_db=-19, highpass_hz=250,
    pan=0.05, note='envelope paper slides into the slot (peak on f142)')
cue('S02', 's02-plip', 'cave_drop', 148, 'sync', anchor_s='onset', src_in=0.02, src_out=0.9, gain_db=-21,
    lowpass_hz=7000, fade_out=4, note='tiny wet plip as it vanishes (water drop, close and quiet)')
cue('S02', 's02-far-below-whoosh', 'swoosh', 150, 'fx', src_in=0.10, pitch_mode='tape', pitch_semitones=-7,
    lowpass_hz=1400, gain_db=-40, reverb='hall', reverb_send=0, fade_in=2,
    note='far below, a faint long whoosh (organic swoosh, tape -7 st, mostly the hall)')
cue('S02', 's02-neck-servo', 'servo_usc', 157, 'foley', src_in=2.0, src_out=4.45, pitch_mode='tape',
    pitch_semitones=-5, end_frame=233, fade_in=8, fade_out=10, gain_db=-27, lowpass_hz=3500,
    note='low neck-servo whirr under the pull-back (real servo motors, tape -5 st)')
cue('S02', 's02-blink-tick', 'cam_clicks', 240, 'foley', **TICK_A, fade_in_ms=1, fade_out_ms=15, gain_db=-27,
    lowpass_hz=14000, note='dry relay tick on the blink (one click, on f240)')

# ------------------------------------------------------------------------------------------------
# S03  f257-352  the drop: the wide room
# ------------------------------------------------------------------------------------------------
cue('S03-S05', 's03-crt-whine', 'buzz', 257, 'amb', src_in=5.0, end_frame=529, fade_out=1.5, gain_db=-8,
    highpass_hz=4000, highpass_slope=48, note='bed of high-frequency CRT whine: streetlight buzz, high-passed')
# rev2: the printer motif must be learned here (its payoff is the last sound of the film): +6.5 dB, high-passed at
# 250 Hz so its chunk does not stack on the kick, a 3 dB shelf from 2 kHz for the feed's rattle, and the score dips
# 3 dB at 1.5-4 kHz for the 150 ms after each feed (EQ_WINDOWS)
PRINTER_EQ = [{'type': 'highshelf', 'hz': 2000, 'gain_db': 3.0, 'q': 0.707}]
for f in (257, 321):
    cue('S03', f's03-printer-f{f}', 'printer', f, 'sync', src_in=0.010, fade_in_ms=3, anchor_s=0.0139,
        gain_db=-8.5 + (1.5 if f == 321 else 0), pan=-0.05,
        highpass_hz=250, eq=PRINTER_EQ, reverb='room', reverb_send=-14,
        note=f'printer sheet feed on the downbeat f{f} (pickup transient on the beat)')
cue('S03', 's03-chair-creak', 'chair_creak', 290, 'foley', src_in=3.9, src_out=4.9, anchor_s='peak', gain_db=-26,
    pan=0.4, fade_in=2, fade_out=4, lowpass_hz=6000, reverb='room', reverb_send=-8, note='quiet office-chair creak')
droid_lanes = {'pan': [[300, 0.45], [352, 0.08]], 'gain_db': [[300, 0], [352, -12]],
               'lowpass_hz': [[300, 9000], [352, 2400]]}
cue('S03', 's03-droid-motor', 'servo_usc', 300, 'fx', src_in=20.0, src_out=22.6, pitch_mode='tape', pitch_semitones=3,
    end_frame=353, fade_in=4, fade_out=1.5, gain_db=-25, automation=droid_lanes, reverb='room', reverb_send=-10,
    note='the droid sets off: small electric motor whine, receding (pan, gain and low-pass lanes)')
cue('S03', 's03-droid-casters', 'carpet_wheels', 300, 'fx', src_in=2.3, src_out=5.3, end_frame=353, fade_in=3,
    fade_out=1.5, gain_db=-14, channels='mono', automation=droid_lanes, reverb='room', reverb_send=-10,
    note='casters on the cobalt carpet, receding')
cue('S03', 's03-droid-trolley', 'rattle_wheels', 300, 'fx', src_in=6.0, src_out=9.0, end_frame=353, fade_in=4,
    fade_out=1.5, gain_db=-24, lowpass_hz=6000, automation=droid_lanes, reverb='room', reverb_send=-10,
    note='caster rattle of the steel trolley (chair with little wheels)')

# ------------------------------------------------------------------------------------------------
# S04  f353-432  Kevin speaks; the padlock glides; knock at f424
# ------------------------------------------------------------------------------------------------
MURMUR = [(0, 15.72, 16.06), (8, 22.22, 22.50), (16, 16.10, 16.44)]   # (frame offset, src_in, src_out)


def kevin_murmur(shot, start, pan=-0.08, lp=3000):
    for k, (off, a, b) in enumerate(MURMUR):
        cue(shot, f'{shot.lower()}-kevin-murmur-{k + 1}', 'walla', start + off, 'foley', src_in=a, src_out=b,
            channels='mono', pan=pan, highpass_hz=300, lowpass_hz=lp, lowpass_slope=24,
            eq=[{'type': 'peak', 'hz': 1400, 'gain_db': 4, 'q': 1.2}], fade_in_ms=15, fade_out_ms=45, gain_db=-12,
            reverb='room', reverb_send=-12,
            note=f'Kevin\'s terminal speaks: crowd walla band-passed 300 Hz-3 kHz, chopped into one voice (burst {k + 1})')


kevin_murmur('S04', 353)
DRAG = dict(src_out=5.40, pitch_mode='tape', pitch_semitones=-3, highpass_hz=180, lowpass_hz=6500, gain_db=-14,
            reverb='room', reverb_send=-16)
cue('S04', 's04-padlock-drag', 'drag', 377, 'foley', src_in=3.75, end_frame=424, fade_in=6, fade_out_ms=6,
    automation={'gain_db': [[377, -6], [390, 0], [408, 0], [424, -3]]}, **DRAG,
    note='long hiss of brass dragging on lacquered wood (metal-box drag, tape -3 st); no Doppler, we ride with it')
cue('S04', 's04-fingertip-rest', 'cup_down', 418, 'foley', src_in=0.30, src_out=0.60, anchor_s='onset', gain_db=-30,
    pan=0.25, fade_out_ms=4, note='bronze fingertip rests on the walnut')


def padlock_knock(shot, f):
    cue(shot, f'{shot.lower()}-knock-metal', 'gear_tap', f, 'sync', src_in=0.085, src_out=0.5, anchor_s=0.0948,
        gain_db=-11, pan=0.1, reverb='room', reverb_send=-16, note=f'precise knock as it stops (gear lock tap) f{f}')
    cue(shot, f'{shot.lower()}-knock-wood', 'cup_down', f, 'foley', src_in=5.57, src_out=5.95, anchor_s=5.591,
        gain_db=-11, pan=0.1, note='the walnut under it (cup set down on a wooden table, low thud)')


padlock_knock('S04', 424)

# ------------------------------------------------------------------------------------------------
# S05  f433-528  'Outstanding.'  servo + piston hiss; the post; plip f512; far-below whoosh
# ------------------------------------------------------------------------------------------------
cue('S05', 's05-head-servo', 'servo006', 447, 'foley', src_in=0.05, src_out=0.62, anchor_s='onset', gain_db=-22,
    fade_out=3, pan=0.05, note='small servo whirr on the head tilt')
cue('S05', 's05-piston-hiss', 'canister', 451, 'foley', src_in=1.12, src_out=1.52, fade_in=2, fade_out=4, gain_db=-28,
    highpass_hz=900, pan=0.12, note='short pneumatic hiss from the neck pistons (pressure release, trimmed)')
cue('S05', 's05-head-return-servo', 'servo006', 489, 'foley', src_in=0.05, src_out=0.62, anchor_s='onset',
    pitch_mode='tape', pitch_semitones=-2, gain_db=-28, fade_out=3, pan=0.05, note='head returns to neutral')
cue('S05', 's05-lid-contact', 'mouse', 508, 'foley', src_in=0.12, src_out=0.40, anchor_s='onset', gain_db=-28,
    pan=0.1, note='padlock touches the lid')
cue('S05', 's05-plip', 'metal_drops', 512, 'sync', src_in=10.7150, src_out=10.850, anchor_s=10.7187, pitch_mode='tape',
    pitch_semitones=-2.42, gain_db=-15, fade_in_ms=2, fade_out_ms=45, lowpass_hz=9000, reverb='room', reverb_send=-18,
    pan=0.1, note='wet plip into the cup at f512: ONE water drop into a vessel (10.715-10.850 s), tuned to Eb5')
cue('S05', 's05-far-below-whoosh', 'windy_swoosh', 514, 'fx', src_in=0.30, pitch_mode='tape', pitch_semitones=-7,
    lowpass_hz=1200, gain_db=-14, reverb='hall', reverb_send=0, end_frame=529, fade_in=3, fade_out=1.5,
    note='then far below a falling whoosh (leads into S06)')

# ------------------------------------------------------------------------------------------------
# S06  f529-608  inside the cup: the padlock lands at the arch
# ------------------------------------------------------------------------------------------------
# a 100 ms suck-out before the landing: the water and air dip 8 dB from f550 to f552.8 and come back after it
# (by f576), so the hit has a clean edge
offline_day('S06', 529, 609, srcs=(14.0, 14.0, 30.0),
            bed_lane={'gain_db': [[529, 0], [550, 0], [552.8, -8, 'smooth'], [560, -8], [576, 0, 'smooth']]})
cue('S06', 's06-fall-whoosh', 'windy_swoosh', 529, 'fx', src_in=0.405, anchor_s=0.405, pitch_mode='tape',
    pitch_semitones=-5, lowpass_hz=6000, gain_db=-15, end_frame=552.8, fade_out=3, reverb='hall', reverb_send=-16,
    note='windy whoosh as the padlock falls (peak f551), sucked out just before the landing so f553 starts clean')
cue('S06', 's06-impact-metal', 'long_metal', 553, 'fx', src_in=0.0395, anchor_s=0.0405, pitch_mode='tape',
    pitch_semitones=-12, lowpass_hz=2200, highpass_hz=30, highpass_slope=48, gain_db=-11, end_frame=609, fade_out=4,
    eq=SUB_SHELF, reverb='hall', reverb_send=-12, automation={'gain_db': [[553, 0], [570, 0], [584, -5, 'smooth'], [609, -5]]},
    note='f553: deep metal impact an octave down (long metal impact); the region starts at the file\'s own attack '
         '(0.040 s, on f553, no pre-roll), and its ring swell is ridden 5 dB down from f570 so the pines read')
# the bulkhead file opens with a soft pre-contact (0.098 s, 20 dB down); the region starts after it (0.1115 s) and
# the hit itself (onset 0.1125 s, peak 0.1158 s) lands on f553
SUB_SHELF60 = [{'type': 'lowshelf', 'hz': 60, 'gain_db': -4.0, 'q': 0.707}]
cue('S06', 's06-impact-bulkhead', 'bulkhead', 553, 'sync', src_in=0.1115, fade_in_ms=1, anchor_s=0.1125, lowpass_hz=3000,
    highpass_hz=35, highpass_slope=48, gain_db=-14, end_frame=609, fade_out=4, eq=SUB_SHELF60, reverb='hall', reverb_send=-14,
    note='layered steel bulkhead hit')
cue('S06', 's06-impact-ring', 'bulkhead', 553, 'fx', src_in=0.1115, fade_in_ms=1, anchor_s=0.1125, highpass_hz=1000, lowpass_hz=3500,
    gain_db=-19, end_frame=609, fade_out=4, reverb='hall', reverb_send=-14,
    note='the bulkhead\'s own 1-3.5 kHz ring, about 7 dB under it, so the landing survives a phone speaker')
cue('S06', 's06-impact-thud', 'cup_down', 553, 'fx', src_in=5.588, src_out=5.95, anchor_s=5.591, fade_in_ms=10,
    pitch_mode='tape',
    pitch_semitones=-24, lowpass_hz=500, highpass_hz=30, highpass_slope=48, gain_db=-8, eq=SUB_SHELF, reverb='hall',
    reverb_send=-16, note='low thud: the wooden cup-down thud two octaves down (3 dB low shelf below 50 Hz)')
cue('S06', 's06-scree-metal', 'coins', 556, 'fx', src_in=0.40, src_out=1.0, anchor_s='onset', pitch_mode='tape',
    pitch_semitones=-19, lowpass_hz=3200, highpass_hz=30, highpass_slope=48, gain_db=-15, fade_out=6, eq=DETAIL,
    reverb='hall', reverb_send=-16, pan=-0.15,
    note='scree slide of old padlocks: coins into a metal drawer, tape -19 st')
cue('S06', 's06-scree-stone', 'peas', 557, 'fx', src_in=0.12, src_out=0.85, pitch_mode='tape', pitch_semitones=-24,
    lowpass_hz=2600, highpass_hz=30, highpass_slope=48, gain_db=-17, fade_out=8, end_frame=600, eq=DETAIL, reverb='hall',
    reverb_send=-16, pan=0.15,
    note='stone and grit under it: peas into glass, tape -24 st')
cue('S06', 's06-bounce', 'bulkhead', 566, 'fx', src_in=0.1115, fade_in_ms=1, anchor_s=0.1125, pitch_mode='tape', pitch_semitones=-3,
    lowpass_hz=1400, highpass_hz=30, highpass_slope=48, gain_db=-22, end_frame=609, fade_out=4, eq=SUB_SHELF60, reverb='hall',
    reverb_send=-14, note='the single bounce (f566)')
cue('S06', 's06-pines', 'pines', 565, 'amb', src_in=13.0, end_frame=609, fade_in=22, fade_out=1.5, gain_db=-2,
    highpass_hz=250, note='wind through pine needles at the crest as we tilt up')

# ------------------------------------------------------------------------------------------------
# S07  f609-752  the deferral machine
# ------------------------------------------------------------------------------------------------
room_tone('S07', 609, 753, fade_in=0.5, src=40.0)
cue('S07', 's07-meeting-hum', 'server', 609, 'amb', src_in=50.0, end_frame=753, fade_in=0.5, fade_out=1.5, gain_db=-14,
    lowpass_hz=4500, highpass_hz=60, note='the live meeting hum')
cue('S07', 's07-crt-whine', 'buzz', 609, 'amb', src_in=20.0, end_frame=753, fade_out=1.5, gain_db=-8,
    highpass_hz=4000, highpass_slope=48, note='CRT whine bed')

# arrivals on the beat (stop sounds) and slides before them
ARR = [(609, 'zero'), (625, 'env'), (641, 'tabs'), (657, 'env'), (673, 'tabs'), (681, 'env'), (689, 'env'), (697, 'tabs')]
for k, (f, kind) in enumerate(ARR):
    dt = k >= 4
    if kind == 'zero':
        # the file opens with a soft precursor touch (0.001 s, 8 dB down); the region starts after it, so the
        # main clink (peak 0.0749 s) is the only event and lands on f609
        cue('S07', f's07-arrive-{k + 1}-glass', 'glass_cup', f, 'foley', src_in=0.066, src_out=0.20, anchor_s=0.0725,
            fade_in_ms=1, gain_db=-20, pan=0.3, reverb='room', reverb_send=-16,
            note='f609 Linda\'s glass zero arrives on the cut: glass on lacquered wood, stopped by a finger')
    elif kind == 'env':
        # one anchor rule for all four envelopes: the slide's stop (0.4222 s) on the beat; the region starts at
        # 0.30 s so the double-time slides fit inside their 8-frame cycle
        cue('S07', f's07-slide-{k + 1}-paper', 'paper_quick', f, 'foley', anchor_s=0.4222,
            src_in=0.30, src_out=0.62, fade_in=1, fade_out=2, gain_db=-21, highpass_hz=300,
            automation={'pan': [[f - 3, -0.25], [f, 0.3]]}, reverb='room', reverb_send=-16,
            note=f'f{f} envelope spins up the table and stops on the beat (paper on wood)')
    else:
        # the tick rises over 11 ms (onset 0.1256 s, peak 0.1363 s): its middle (0.131 s) sits on the beat
        cue('S07', f's07-arrive-{k + 1}-acrylic', 'plastic_hit', f, 'foley', src_in=0.10, src_out=0.32,
            anchor_s=0.131, gain_db=-22, pan=0.3, lowpass_hz=10000, reverb='room', reverb_send=-16,
            note=f'f{f} green acrylic tabs stop with an acrylic tick')

# the posts: each plip lands on the next beat (8th notes in double time), a little melody in Eb minor pentatonic.
# Each post is ONE isolated drop, cut to a window of about 150 ms around it (no second drop within 12 dB), with its
# envelope peak on the beat. Measured per drop: the 1 ms envelope peak (s, dBFS), its -20 dB onset (s) and its dominant
# pitch over 150 ms (Hz); the tape shift puts that pitch on the note.
NOTE_HZ = {'Bb4': 466.16, 'Db5': 554.37, 'Eb5': 622.25, 'Gb5': 739.99, 'Ab5': 830.61, 'Bb5': 932.33, 'Eb6': 1244.51}
POSTS = [  # frame, source key, peak s, onset s, level dB, f0 Hz, note, what
    (625, 'wood_drops', 24.0946, 24.0856, -23.7, 506.8, 'Db5', 'glass zero: a hollow drop'),
    (641, 'metal_drops', 22.1941, 22.1903, -11.6, 696.5, 'Gb5', 'envelope: a water plip into a metal vessel'),
    (657, 'wood_drops', 34.8326, 34.8289, -9.5, 468.8, 'Bb4', 'tabs: a heavy wooden drop'),
    (673, 'wood_drops', 13.9838, 13.9826, -30.5, 630.6, 'Eb5', 'envelope: a small drop'),
    (681, 'wood_drops', 20.0060, 20.0036, -30.9, 760.3, 'Gb5', 'tabs: a bubble plip (rising chirp)'),
    (689, 'metal_drops', 3.6551, 3.6539, -25.6, 907.5, 'Ab5', 'envelope: a water plip into a metal vessel'),
    (697, 'wood_drops', 18.9140, 18.9117, -25.6, 943.4, 'Bb5', 'envelope: a clear bubble plip'),
    (705, 'wood_drops', 19.7303, 19.7220, -15.9, 1176.3, 'Eb6', 'tabs: a high bubble plip'),
]
POST_LEVEL = -15.0   # common envelope-peak level of the posts before their trims (rev2: -1 dB, the groove ducks less)
# per-post trims (dB), measured solo: equal K-weighted loudness over 150 ms (-28.5 LUFS before the master gain),
# less 1 dB, and no post peaks above -11.5 dBFS there (drops have a 17-21 dB crest; the hottest four sit lower)
POST_TRIM = [0.5, -3.9, 2.0, -3.8, -0.4, -0.8, -5.9, 0.7]   # rev2: the top note (Eb6, f705) +1.6 dB, with its own notch in the score
for k, (f, key, pk, on, lvl, f0, nm, what) in enumerate(POSTS):
    import math as _m
    st = round(12 * _m.log2(NOTE_HZ[nm] / f0), 2)
    # the Ab5 drop has a second, quieter drop 0.10 s after it: a longer fade-out (70 ms) takes it 16 dB down
    win, fo = 0.14, (70 if nm == 'Ab5' else 40)
    cue('S07', f's07-post-{k + 1}-{nm}', key, f, 'foley', src_in=round(on - 0.002, 4), src_out=round(pk + win, 4),
        anchor_s=round(pk - 0.003, 4), pitch_mode='tape', pitch_semitones=st,
        gain_db=round(POST_LEVEL - lvl + POST_TRIM[k], 1),
        fade_in_ms=1.5, fade_out_ms=fo, highpass_hz=150, lowpass_hz=9000,
        eq=[{'type': 'highshelf', 'hz': 4000, 'gain_db': 3, 'q': 0.707}], pan=0.38, reverb='room', reverb_send=-18,
        note=f'post {k + 1} on f{f}: {what} ({key} {on:.3f} s, one drop), tape {st:+.2f} st to {nm}')

# the droid: arrives f705-712, binder f721, squeeze f729-744, reverses out f737-752
cue('S07', 's07-droid-in-motor', 'servo_usc', 693, 'fx', src_in=20.0, src_out=21.0, pitch_mode='tape',
    pitch_semitones=3, end_frame=713, fade_in=6, fade_out=2, gain_db=-27, pan=0.25, reverb='room', reverb_send=-12,
    note='droid motor as it rolls into its bay')
cue('S07', 's07-droid-caster-stop', 'metal_wheels', 711, 'fx', src_in=1.50, src_out=1.95, anchor_s=1.6257,
    fade_in=2, fade_out=4, gain_db=-20, pan=0.25, lowpass_hz=7000, reverb='room', reverb_send=-12,
    note='measured caster stop: the casters\' last roll (its peak on f711) settling to rest (chair with metal wheels)')
cue('S07', 's07-binder-lift', 'joints', 721, 'foley', src_in=1.15, src_out=1.50, anchor_s='onset', gain_db=-25,
    pan=0.35, fade_out=3, note='f721 binder lift: the arm takes the weight (metal joint creak)')
cue('S07', 's07-binder-crunch', 'crumble', 729, 'foley', src_in=0.0, src_out=1.55, pitch_mode='tape',
    pitch_semitones=-4, gain_db=-17, fade_out=4, end_frame=746, lowpass_hz=6000, pan=0.35, reverb='room', reverb_send=-16,
    note='f729-744 the binder squeezes through: deep paper crunch (paper crumble, close, tape -4 st)')
cue('S07', 's07-binder-cardboard', 'cardboard', 731, 'foley', src_in=5.95, src_out=6.70, pitch_mode='tape',
    pitch_semitones=-5, gain_db=-14, fade_in=1, fade_out=4, end_frame=746, pan=0.35, note='the body of the squeeze')
cue('S07', 's07-binder-squeak', 'plastic_bend', 735, 'foley', src_in=0.95, src_out=1.40, gain_db=-24, fade_in=1,
    fade_out=3, pan=0.35, lowpass_hz=7000, note='the lid squeaks around it (plastic under pressure)')
cue('S07', 's07-binder-plop', 'metal_drops', 745, 'foley', src_in=0.13, src_out=1.20, anchor_s='onset',
    gain_db=-16, fade_out=6, end_frame=753, lowpass_hz=4000, pan=0.38, note='and it is gone: a deep plop (Bb3)')
cue('S07', 's07-droid-out-motor', 'servo_usc', 737, 'fx', src_in=22.6, src_out=24.0, pitch_mode='tape',
    pitch_semitones=2, end_frame=753, fade_in=3, fade_out=1.5, gain_db=-28, reverb='room', reverb_send=-12,
    automation={'pan': [[737, 0.25], [752, -0.1]], 'gain_db': [[737, 0], [752, -6]]},
    note='the droid reverses out')
cue('S07', 's07-droid-out-casters', 'carpet_wheels', 737, 'fx', src_in=3.2, src_out=4.3, end_frame=753, fade_in=3,
    fade_out=1.5, gain_db=-18, channels='mono', automation={'pan': [[737, 0.25], [752, -0.1]]},
    reverb='room', reverb_send=-12, note='casters on carpet, reversing')
cue('S07', 's07-printer-far', 'printer', 737, 'foley', src_in=0.010, fade_in_ms=3, anchor_s=0.0139, gain_db=-28, lowpass_hz=4000,
    highpass_hz=250, eq=PRINTER_EQ,
    pan=-0.2, reverb='room', reverb_send=-4, end_frame=753, fade_out=1.5,
    note='at the far end the printer feeds another sheet (on beat 46, f737)')

# ------------------------------------------------------------------------------------------------
# S08  f753-832  everything deferred is landscape
# ------------------------------------------------------------------------------------------------
# rev2: the crane rises 410 m off the shore, so the close espresso lapping fades 11 dB over f753-790 and the falls
# (waterfall roar + massed paper riffle) take over; the birds duck them only 3 dB from f774
offline_day('S08', 753, 833, srcs=(24.0, 24.0, 40.0), lap_gain=-4, breath_gain=-8,
            lap_lane={'gain_db': [[753, 0], [790, -11, 'smooth'], [833, -11]]})
cue('S08', 's08-falls', 'falls', 753, 'amb', src_in=3.0, end_frame=833, fade_in=1, fade_out=1.5, gain_db=-22,
    lowpass_hz=2600, highpass_hz=80, reverb='hall', reverb_send=-22,
    automation={'gain_db': [[753, -4], [774, -2.9], [780, -5.9, 'smooth'], [832, -4]]},
    note='the paper falls: big waterfall roar, far cliff; ducked 3 dB under the murmuration from f774')
cue('S08', 's08-falls-paper', 'shuffle', 753, 'amb', src_in=1.0, end_frame=833, fade_in=1, fade_out=1.5, gain_db=-14,
    lowpass_hz=8000, highpass_hz=400, reverb='hall', reverb_send=-20,
    automation={'gain_db': [[753, 0], [774, 0], [780, -3, 'smooth'], [832, -3]]},
    note='massed paper riffle in the falls (shuffling paper, open to 8 kHz); ducked 3 dB with the falls from f774')
cue('S08', 's08-falls-wind-papers', 'papers_wind', 765, 'amb', src_in=0.4, end_frame=833, fade_in=10, fade_out=1.5,
    gain_db=-24, lowpass_hz=5000, reverb='hall', reverb_send=-20, note='wind blowing papers')
cue('S08', 's08-bird-unfold', 'page_turn', 772, 'foley', anchor_s=0.3237, gain_db=-20, pan=-0.12, highpass_hz=300,
    reverb='hall', reverb_send=-16, note='soft paper unfold on the foreground envelope-bird')
# murmuration: bird flying away, layered and staggered x12
for k in range(12):
    f = 776 + 4 * k
    st = [-2, -5, -3, -7, -4, -8, -6, -3, -9, -5, -7, -4][k]
    pan = [-0.8, 0.65, -0.3, 0.8, -0.55, 0.35, -0.8, 0.5, 0.05, -0.4, 0.75, -0.15][k]
    cue('S08', f's08-wings-{k + 1:02d}', 'bird', f, 'fx', src_in=0.20, anchor_s='onset', pitch_mode='tape',
        pitch_semitones=st, gain_db=-17 - (k % 3) * 2, pan=pan, lowpass_hz=6000, end_frame=833, fade_out=1.5,
        reverb='hall', reverb_send=-18, note=f'murmuration wing roar, layer {k + 1}/12 (bird flying away, tape {st} st)')
cue('S08', 's08-wings-paper-edge', 'paper_quick', 798, 'fx', src_in=0.18, src_out=0.76, pitch_mode='tape',
    pitch_semitones=-6, gain_db=-24, end_frame=833, fade_out=1.5, highpass_hz=500, eq=DETAIL, reverb='hall', reverb_send=-18,
    note='paper-flutter edge on the wings')

# ------------------------------------------------------------------------------------------------
# S09  f833-928  the same padlock again
# ------------------------------------------------------------------------------------------------
# S09-S10 keep the plain room tone (so the S09 repeat sits in the same room as S04); on the cut to S11 it hands over,
# sample-aligned (complementary cos fades over 10 ms), to the same take tilted for the dark room, its air 4 dB up
room_tone('S09-S10', 833, 993 + 0.24, fade_in=0.5, fade_out=0.24, src=70.0)
room_tone('S11', 993, 1153, fade_in=0.24, fade_out=1.5, src=70.0 + (993 - 833) / 24, tilt=True, up_gain=4.0)
hum_dn = {'gain_db': [[833, 0], [960.976, 0], [961, -20, 'step']] +
          [[1001 + 5 * k + 0.5, -20 - 2 * (k + 1), 'step'] for k in range(7)] + [[1036.5, -120, 'step']]}
cue('S09-S11', 's09-meeting-hum', 'server', 833, 'amb', src_in=80.0, end_frame=1054, fade_in=0.5, fade_out=1, gain_db=-14,
    lowpass_hz=4500, highpass_hz=60, automation=hum_dn,
    note='meeting hum: drops 20 dB on the click (f961), so S10 ends on room tone and the cord, then steps down '
         'with each terminal (f1001-1036)')
cue('S09-S11', 's09-crt-whine', 'buzz', 833, 'amb', src_in=30.0, end_frame=1054, fade_out=1, gain_db=-8,
    highpass_hz=4000, highpass_slope=48, automation=hum_dn,
    note='CRT whine: drops 20 dB on the click, dies with the terminals')
kevin_murmur('S09', 833, pan=0.0, lp=3000)   # identical samples, identical rhythm: the repetition is the joke
S09_SHIFT = 852 - 424
src_at_841 = 3.75 + (841 - S09_SHIFT - 377) / 24 * 2 ** (-3 / 12)
cue('S09', 's09-padlock-drag', 'drag', 841, 'foley', src_in=round(src_at_841, 4), end_frame=852, fade_in=2,
    fade_out_ms=6, automation={'gain_db': [[841, 0], [852, -3]]}, **DRAG,
    note='the same drag hiss: the identical sample segment that ended S04\'s glide')
padlock_knock('S09', 852)
cue('S09', 's09-lookdown-tick', 'cam_clicks', 857, 'foley', **TICK_B, fade_in_ms=1, fade_out_ms=12, gain_db=-21,
    lowpass_hz=9000, note='a single servo tick on the look-down (f857)')
cue('S09', 's09-blink-tick', 'cam_clicks', 917, 'foley', **TICK_A, fade_in_ms=1, fade_out_ms=15, gain_db=-29,
    lowpass_hz=8000, note='dry tick on the slow blink')
cue('S09', 's09-head-lift', 'servo006', 921, 'foley', src_in=0.05, src_out=0.55, anchor_s='onset', pitch_mode='tape',
    pitch_semitones=-3, gain_db=-31, fade_out=3, note='the head lifts back to level (barely)')

# ------------------------------------------------------------------------------------------------
# S10  f929-992  the jack
# ------------------------------------------------------------------------------------------------
cue('S10', 's10-live-line', 'amp_cable', 929, 'fx', src_in=3.14, src_out=6.6, end_frame=961, guard_ms=0, fade_in=4,
    fade_out_ms=2, gain_db=-34, lowpass_hz=6000, note='the live line, barely there; dies with the music on f961')
for f, a, nm in ((937, 0.45, 'index'), (939, 2.67, 'middle'), (941, 0.45, 'thumb')):
    cue('S10', f's10-finger-{nm}', 'joints', f, 'foley', src_in=a, src_out=a + 0.09, anchor_s='onset', gain_db=-24,
        pitch_mode='tape', pitch_semitones={'index': 0, 'middle': 2, 'thumb': -2}[nm], fade_out=1, pan=0.05,
        note=f'finger-joint servo as the {nm} finger closes (f{f})')
cue('S10', 's10-grip', 'metal_clicks', 945, 'foley', src_in=12.68, src_out=12.80, anchor_s='onset', gain_db=-30,
    lowpass_hz=6000, note='the grip on the knurled barrel (f945)')
cue('S10', 's10-knuckle', 'joints', 953, 'foley', src_in=2.12, src_out=2.17, anchor_s='onset', gain_db=-32,
    fade_out_ms=4, note='one knuckle flexes 1 degree: resolve (f953)')
cue('S10', 's10-jack-click', 'trs', 961, 'sync', src_in=2.02, src_out=2.30, anchor_s=2.0358, gain_db=-6,
    fade_out=2, reverb='room', reverb_send=-20,
    note='f961: crisp close-miked 3.5 mm jack click (TRS patch cable), the music hard-stops on this frame')
cue('S10', 's10-jack-tick', 'metal_clicks', 961, 'foley', src_in=15.83, src_out=16.00, anchor_s=15.840, gain_db=-15,
    highpass_hz=1500, note='layer: a tiny metal tick')
cue('S10', 's10-cord-rattle-1', 'plastic_clatter', 964, 'foley', src_in=0.05, src_out=0.70, gain_db=-24, fade_in=0.5,
    fade_out=4, lowpass_hz=6000, pan=0.1, note='the yellow coil springs and relaxes across the walnut')
cue('S10', 's10-cord-rattle-2', 'plastic_clatter', 973, 'foley', src_in=1.6, src_out=2.3, gain_db=-30, fade_in=1,
    fade_out=5, lowpass_hz=5000, pan=0.15, note='cord settles')

# ------------------------------------------------------------------------------------------------
# S11  f993-1152  no music: terminals die, Pat joins, the head dip, headset off
# ------------------------------------------------------------------------------------------------
cue('S11', 's11-jack-drop', 'metal_clicks', 995, 'foley', src_in=6.49, src_out=6.62, anchor_s='onset', gain_db=-22,
    pan=-0.05, note='f995 the jack drops to the walnut')
cue('S11', 's11-jack-drop-wood', 'cup_down', 995, 'foley', src_in=0.30, src_out=0.60, anchor_s='onset', gain_db=-24,
    pan=-0.05, fade_out_ms=4, note='the walnut under it')
cue('S11', 's11-jack-bounce', 'metal_clicks', 1000, 'foley', src_in=8.18, src_out=8.28, anchor_s='onset', gain_db=-34,
    pan=-0.05, note='small bounce')
# the shutdown wave, near to far: Synthia R3, Keys R8, Arjun L8, Kevin R13, Strategy L13, Operations R18, P&C L18, Linda L23
SHUT = [('synthia', 0.55, 3), ('keys', 0.42, 8), ('arjun', -0.42, 8), ('kevin', 0.3, 13), ('strategy', -0.3, 13),
        ('operations', 0.2, 18), ('people-culture', -0.2, 18), ('linda', -0.12, 23)]
EVTS = [(166.40, 167.30), (0.70, 1.30), (166.40, 167.30), (44.00, 44.60), (95.27, 95.85), (166.40, 167.30),
        (96.77, 97.35), (0.70, 1.30)]
PITCH = [3, 1, -1, 2, 0, -2, 1, -3]
EV_TRIM = {166.40: 0.0, 0.70: -15.0, 44.00: -1.0, 95.27: 0.0, 96.77: -6.0}
for k, ((name, pan, dist), (a, b), st) in enumerate(zip(SHUT, EVTS, PITCH)):
    f = 1001 + 5 * k
    att = 20 * __import__('math').log10(3.0 / dist)
    # folded to mono and panned (the stereo room recording was decorrelated: S11 lost 2 LU on mono speakers);
    # +3 dB makes up the fold; the room sends sit 4 dB lower than in v0 for the same reason
    cue('S11', f's11-crt-off-{k + 1}-{name}', 'computers', f, 'fx', src_in=a, src_out=b, anchor_s='onset',
        pitch_mode='tape', pitch_semitones=st, gain_db=round(1 + att * 0.6 + EV_TRIM[a], 1), pan=pan, channels='mono',
        lowpass_hz=round(12000 - 380 * dist), fade_out=3, reverb='room', reverb_send=round(-18 + dist * 0.35, 1),
        note=f'f{f} {name} powers off ({dist} m): real office power switch and fan run-down, tape {st:+d} st')
# f1049-1060 the printer stops mid-feed: the SAME printer as f257, f321, f737 and f1418 (Sonniss Printer 02). One
# continuous piece of the take, 0.70-1.162 s: its second run's whirr, then its own spin-down and stop chunk (1.0635 s),
# which lands on f1059. Tape -2 st, so the take runs a little slower and lower than its feeds: the motor winding down
# mid-sheet. No splice. Hard stop at f1061, so f1061-1084 is room tone only.
cue('S11', 's11-printer-stop', 'printer', 1059, 'fx', src_in=0.70, src_out=1.162, anchor_s=1.0635, pitch_mode='tape',
    pitch_semitones=-2, gain_db=-23, fade_in=2, end_frame=1061, fade_out_ms=30, guard_ms=0, lowpass_hz=5000,
    highpass_hz=70, channels='mono', pan=-0.05, reverb='room', reverb_send=-6,
    automation={'lowpass_hz': [[1049, 5000], [1057, 5000], [1059, 3200, 'smooth']]},
    note='f1049-1060 the printer at the foot stops mid-feed: Printer 02\'s whirr, spin-down and stop chunk in one '
         'continuous piece (tape -2 st), the stop on f1059; dead by f1061')
cue('S11', 's11-pat-thoom', 'humbuzz', 1085, 'fx', src_in=0.30, src_out=1.40, fade_in_ms=25, fade_out=14, gain_db=-24,
    lowpass_hz=1800, pan=0.18, channels='mono', reverb='room', reverb_send=-6,
    note='f1085 far away, Pat\'s CRT powers on: degauss hum burst (real electrical hum, distant)')
cue('S11', 's11-pat-degauss', 'static_up', 1085, 'fx', src_in=0.20, src_out=1.70, anchor_s='onset', gain_db=-30,
    lowpass_hz=3500, highpass_hz=200, fade_out=8, pan=0.18, channels='mono', reverb='room', reverb_send=-6,
    note='degauss buzz (electricity static power-up, distant)')
cue('S11', 's11-pat-glow', 'buzz', 1093, 'amb', src_in=40.0, end_frame=1153, fade_in=8, fade_out=1.5, gain_db=-26,
    highpass_hz=5000, highpass_slope=48, pan=0.25, note='one faint CRT whine remains: Pat')
cue('S11', 's11-turn-tick', 'cam_clicks', 1097, 'foley', **TICK_A, fade_in_ms=1, fade_out_ms=15, gain_db=-29,
    lowpass_hz=8000, note='tiny servo tick for the head turn (f1097)')
cue('S11', 's11-dip-tick', 'cam_clicks', 1109, 'foley', **TICK_B, fade_in_ms=1, fade_out_ms=12, gain_db=-28,
    lowpass_hz=8000, note='tiny servo tick for the only head dip in the film (f1109)')
cue('S11', 's11-headset-lift', 'headphone', 1129, 'foley', src_in=0.0, src_out=1.6, gain_db=-28, lowpass_hz=7000,
    fade_in=1, fade_out=6, end_frame=1145, pan=-0.3, note='f1129-1140 headband creaks as he lifts the headset')
cue('S11', 's11-headset-plastic', 'plastic_handling', 1150, 'foley', src_in=4.90, src_out=5.10, anchor_s='onset',
    gain_db=-20, pan=-0.3, end_frame=1153, fade_out_ms=10,
    note='f1150 a soft plastic headset set down on wood: plastic half (ends with the shot)')
cue('S11', 's11-headset-wood', 'cup_down', 1150, 'foley', src_in=3.95, src_out=4.20, anchor_s='onset', gain_db=-21,
    pan=-0.3, end_frame=1153, fade_out_ms=10, reverb='room', reverb_send=-14, note='wood half (ends with the shot)')

# ------------------------------------------------------------------------------------------------
# S12  f1153-1248  night in Offline
# ------------------------------------------------------------------------------------------------
cue('S12', 's12-night', 'night', 1153, 'amb', src_in=20.0, end_frame=1249, fade_in=2, fade_out=1.5, gain_db=-10,
    note='real night ambience: summer night in the forest (crickets, insects)')
cue('S12', 's12-lapping', 'stream', 1153, 'amb', src_in=24.0, pitch_mode='tape', pitch_semitones=-5, highpass_hz=60,
    end_frame=1249, fade_in=2, fade_out=1.5, gain_db=-4, note='water lapping on stone')
cue('S12', 's12-air', 'wind', 1153, 'amb', src_in=40.0, highpass_hz=80, lowpass_hz=2000, end_frame=1249, fade_in=2,
    fade_out=1.5, gain_db=-24, reverb='soft', reverb_send=-10, note='night air')
# rev2: the distant frog the S12 note asks for (the cricket take has none): Mixkit #1241, its frog section (45.8-50.2 s:
# croaks at 45.9, 46.3, 47.5-48.5, 49.3, 49.8 s, their pulse trains mostly at 1.5-2.7 kHz), folded to mono, band-limited
# to 300 Hz-3 kHz for distance (no air above), off to the right across the paddies, in the Sommertheater; 6 dB under
# the crickets (K-weighted), so only its croak peaks come through
cue('S12', 's12-frog', 'frog', 1153, 'amb', src_in=45.8, src_out=50.2, end_frame=1249, fade_in=3, fade_out=1.5,
    channels='mono', pan=0.35, highpass_hz=300, lowpass_hz=3000, gain_db=-16, reverb='soft', reverb_send=-6,
    note='a distant frog across the terraces (forest ambience with croaking frogs, its frog section)')

# ------------------------------------------------------------------------------------------------
# S13  f1249-1344  the first sip
# ------------------------------------------------------------------------------------------------
room_tone('S13-S14', 1249, 1363, fade_in=0.5, fade_out=3, src=100.0)
cue('S13', 's13-pat-whine', 'buzz', 1249, 'amb', src_in=44.0, end_frame=1363, fade_in=0.5, fade_out=3, gain_db=-28,
    highpass_hz=5000, highpass_slope=48, pan=0.2, note='Pat\'s faint screen across the dark room')
# four steps (rev2): each region starts at the step's attack (0.109 s, 3 ms fade-in), so the whirr starts ON the
# frame (was 39 ms early, from a region already 9 dB up). Step 3 meets the kit's re-entry: +5 dB and high-passed at
# 300 Hz so it clears the kick. Steps 1-3 start with their moves on the beats; step 4 (S13 crit) starts with the
# final rise on f1293 and runs its 4 frames into the spout tick and the sip on f1297 (a short whirr: source to
# 0.30 s, a 1-frame fade), 3 dB down, high-passed the same way, so it no longer plays over the arm at rest
for k, f in enumerate((1249, 1265, 1281, 1293)):
    cue('S13', f's13-actuator-{k + 1}', 'power_window', f, 'foley', src_in=0.109, src_out=0.52 if k < 3 else 0.30,
        fade_in_ms=3, pitch_mode='tape', pitch_semitones=k,
        gain_db=-19 + k + (5 if k == 2 else 0) - (3 if k == 3 else 0), fade_out=3 if k < 3 else 1,
        pan=0.1, lowpass_hz=7000, reverb='room', reverb_send=-16, **({'highpass_hz': 300} if k >= 2 else {}),
        note=(f'actuator step {k + 1} on the beat f{f} (power-window servo, tape +{k} st)' if k < 3 else
              f'actuator step 4 with the final rise f{f}-1297 (power-window servo, tape +{k} st), into the spout '
              'tick and the sip'))
cue('S13', 's13-spout-contact', 'plastic_hit', 1296.6, 'foley', src_in=0.10, src_out=0.30, anchor_s=0.1256,
    gain_db=-27, pan=0.05, note='the spout touches the chin plate (f1297)')
# the sip's onset transient lands on f1297 (+3 ms) and its first 120 ms keep their level; from f1300 its body (the
# lip-and-liquid draw, which peaks about 130 ms after the frame) is ridden 3.5 dB down and its 300 Hz mud cut 3 dB, so it
# stays a soft, close sip over the swell and leaves the tilt creak its low mids; a 3 dB shelf from 3 kHz keeps its lip
# detail above the music's 3 kHz low-pass
cue('S13', 's13-sip', 'sip', 1297, 'sync', src_in=0.95, src_out=2.50, anchor_s=1.1171, fade_in_ms=40, gain_db=7, fade_out=6,
    eq=[{'type': 'peak', 'hz': 300, 'gain_db': -3.0, 'q': 1.0}, {'type': 'highshelf', 'hz': 3000, 'gain_db': 3.0, 'q': 0.707}],
    automation={'gain_db': [[1297, 0], [1300, 0], [1302, -3.5, 'smooth']]},
    pan=0.05, reverb='room', reverb_send=-20,
    note='f1297: soft, real, close-miked sip of a hot drink: its onset transient on f1297; the draw peaks about 130 ms later')
cue('S13', 's13-tilt-creak', 'ship_wood', 1305, 'fx', src_in=16.20, src_out=19.6, anchor_s='onset', pitch_mode='tape',
    pitch_semitones=-5, gain_db=-8, lowpass_hz=2600, highpass_hz=35, highpass_slope=48, fade_in=8, reverb='room',
    eq=[{'type': 'peak', 'hz': 200, 'gain_db': 3.0, 'q': 0.7}],
    reverb_send=-10, end_frame=1409, fade_out_ms=3, guard_ms=0,
    note='f1305 a deep wooden structural creak as the tilt begins (large wooden ship, tape -5 st), fading in over 8 '
         'frames so the sip keeps its tail')
cue('S13', 's13-tilt-sub', 'ship_groan', 1305, 'fx', src_in=0.37, src_out=1.66, pitch_mode='tape', pitch_semitones=-12,
    gain_db=-14, fade_in=6, fade_out=10, lowpass_hz=250, highpass_hz=30, highpass_slope=48,
    note='felt groan under it: the big low groan of a real ship creak (USC G27-11), an octave down, low-passed at 250 Hz')
cue('S13', 's13-headset-slide', 'plastic_handling', 1318, 'foley', src_in=5.78, src_out=6.60, gain_db=-34, fade_in=4,
    fade_out=6, pan=0.35, lowpass_hz=6000, note='the headset on the table slides a few centimetres')
cue('S13', 's13-exhale', 'hyd_release', 1329, 'foley', src_in=4.40, src_out=4.95, gain_db=-34, highpass_hz=800,
    lowpass_hz=8000, fade_in=1, fade_out=6, pan=0.05, note='f1329 a faint pneumatic exhale')

# ------------------------------------------------------------------------------------------------
# S14  f1345-1440  up through the skylight; white; black; one printer sheet
# ------------------------------------------------------------------------------------------------
END = dict(end_frame=1409, fade_out_ms=3, guard_ms=0)
cue('S14', 's14-hull-creak', 'ship_wood', 1347, 'fx', src_in=19.70, src_out=24.5, anchor_s='onset', pitch_mode='tape',
    pitch_semitones=-7, gain_db=-8, lowpass_hz=1400, highpass_hz=35, highpass_slope=48, reverb='soft', reverb_send=-8, **END,
    note='a deep ship-hull creak as the world tilts (large wooden ship, tape -7 st)')
cue('S14', 's14-hull-sub', 'ship_wood', 1351, 'fx', src_in=38.2, src_out=39.4, pitch_mode='tape', pitch_semitones=-14,
    gain_db=-14, fade_in=6, lowpass_hz=250, highpass_hz=30, highpass_slope=48, **END,
    note='sub groan of the tilting world: a timber groan of the large wooden ship (USC R28-03), tape -14 st, low-passed')
cue('S14', 's14-swell', 'ship_sea', 1355, 'amb', src_in=8.0, pitch_mode='tape', pitch_semitones=-7, gain_db=-8,
    lowpass_hz=1500, highpass_hz=40, fade_in=10, reverb='soft', reverb_send=-12, **END,
    note='a long sea-swell wash (wooden ship on the sea, slowed: tape -7 st)')
cue('S14', 's14-night', 'night', 1357, 'amb', src_in=60.0, gain_db=-12, fade_in=6, **END,
    note='night crickets underneath, outside')
cue('S14', 's14-lapping', 'stream', 1361, 'amb', src_in=30.0, pitch_mode='tape', pitch_semitones=-5, highpass_hz=60,
    gain_db=-2, fade_in=6, **END, note='water on stone below')
cue('S14', 's14-rise-deep', 'swoosh', 1392, 'fx', src_in=0.05, anchor_s=0.62, pitch_mode='tape',
    pitch_semitones=-7, gain_db=-9, highpass_hz=60, lowpass_hz=3000, fade_in=2, reverb='soft', reverb_send=-12, **END,
    note='rising air toward the slot (Berklee swoosh1, tape -7 st, its body on f1392; replaces the unverifiable '
         'Mixkit deep air woosh)')
cue('S14', 's14-rise-swoosh', 'flying_swoosh', 1404, 'fx', anchor_s=1.1783, gain_db=-4, highpass_hz=150,
    reverb='soft', reverb_send=-14, **END, note='a rising flying swoosh into the white; cut dead on f1409')
# over black: ONE printer recording (Sonniss Printer 02): its pickup clunk on f1418 and the feed whirr (0.01-0.69 s,
# where the first run winds down), then one splice to the same take's own spin-down and stop (1.00-1.162 s), whose
# stop chunk lands on f1436; silent before f1440. Folded to mono and centred (the take leans 2 dB left; there is
# nothing on screen to place it), high-passed at 70 Hz (no infrasound, no DC at the end).
cue('S14', 's14-printer-over-black', 'printer', 1418, 'sync', src_in=0.010, fade_in_ms=3, src_out=0.69, anchor_s=0.0139,
    gain_db=-14, pan=0.0, channels='mono', highpass_hz=70, fade_out_ms=25, reverb='room_black', reverb_send=-12,
    note='f1418 over black: one printer sheet feed: the pickup clunk on f1418, then the feed whirr')
cue('S14', 's14-printer-stop', 'printer', 1435.8, 'sync', src_in=1.00, src_out=1.162, anchor_s=1.0635, gain_db=-14,
    pan=0.0, channels='mono', highpass_hz=70, fade_in_ms=25, fade_out_ms=10, reverb='room_black', reverb_send=-12,
    note='...then, spliced from the end of the same take, its spin-down and stop chunk (on f1436)')

# ------------------------------------------------------------------------------------------------
# mix trims (dB), from measured per-cue loudness after the master gain (tools/cue_levels.py)
TRIM = {
    's01-world-breath': 2, 's01-air': -3, 's01-cup-creak-2': 3, 's01-eclipse-whoosh': -8,
    # rev1: tactile foley forward (S02 servo/tick +8, S05 +6..+12, S10 fingers +12, S11 storytelling ticks +6)
    's02-plip': 6, 's02-far-below-whoosh': 19, 's02-neck-servo': 20, 's02-blink-tick': 20,
    's03-chair-creak': 14, 's03-droid-motor': 16, 's03-droid-casters': 22, 's03-droid-trolley': 26,
    's04-knock-metal': 0.5, 's09-knock-metal': 0.5,
    's05-head-servo': 14, 's05-piston-hiss': 19, 's05-head-return-servo': 6, 's05-lid-contact': 12, 's05-plip': 12,
    's06-fall-whoosh': -7, 's06-impact-bulkhead': -2, 's06-impact-thud': -2, 's06-impact-metal': -1, 's06-pines': -6,
    # rev1: S07 arrivals and slides +4, the binder +14, its plop +8, the droid's caster stop +10
    's07-arrive-1-glass': 12, 's07-arrive-3-acrylic': 9, 's07-arrive-5-acrylic': 9, 's07-arrive-8-acrylic': 9,
    's07-slide-2-paper': 7, 's07-slide-4-paper': 7, 's07-slide-6-paper': 7, 's07-slide-7-paper': 7,
    's07-binder-cardboard': 13.5, 's07-binder-squeak': 15.5, 's07-binder-crunch': 12,
    's07-binder-plop': 14, 's07-binder-lift': 23, 's07-droid-in-motor': 10, 's07-droid-caster-stop': 20, 's07-printer-far': 20,
    's08-falls-wind-papers': -5, 's08-falls': 9, **{f's08-wings-{k:02d}': 11 for k in range(1, 13)},
    's08-bird-unfold': 8,
    's09-blink-tick': 17, 's09-lookdown-tick': 12,
    's10-finger-index': 26, 's10-finger-middle': 26, 's10-finger-thumb': 26, 's10-knuckle': 31, 's10-grip': 19,
    's10-jack-click': -5, 's10-cord-rattle-1': 4, 's10-cord-rattle-2': 4,
    's11-crt-off-1-synthia': 1, 's11-crt-off-2-keys': 7, 's11-crt-off-3-arjun': 2, 's11-crt-off-4-kevin': -2.5,
    's11-crt-off-5-strategy': 2, 's11-crt-off-6-operations': 4.5, 's11-crt-off-7-people-culture': 7,
    's11-crt-off-8-linda': 4,
    's11-pat-thoom': -2, 's11-headset-lift': 10, 's11-turn-tick': 10, 's11-dip-tick': 6,
    's12-night': -8, 's12-lapping': -5,
    's13-tilt-creak': 2.0, 's13-tilt-sub': -5, 's13-sip': -0.5,
    's14-swell': -8, 's14-hull-creak': 3, 's14-hull-sub': -3, 's14-night': -4, 's14-lapping': -4,
    's14-rise-deep': -5, 's14-rise-swoosh': -3.5, 's14-printer-over-black': -0.5, 's14-printer-stop': -0.5,
}
for c in cues:
    if c['id'] in TRIM:
        c['gain_db'] = round(c.get('gain_db', 0.0) + TRIM.pop(c['id']), 2)
assert not TRIM, f'unknown trim ids: {sorted(TRIM)}'
for c in cues:
    if c['file'] == F['buzz'] and c['id'] in ('s07-crt-whine', 's09-crt-whine'):
        c['gain_db'] = round(c['gain_db'] - 3, 2)
    if c['id'] == 's03-crt-whine':     # rev2: named in the S03 note, so 6 dB more there (still a bed)
        c['gain_db'] = round(c['gain_db'] + 3, 2)

# edit hygiene (rev2): every non-music edge gets a fade. An edge with no fade of its own gets 2 ms; a region that starts
# on its own anchored transient (an "onset"/"peak" anchor, or a numeric anchor within 5 ms of src_in) gets 1 ms, which
# removes the step without softening the click.
for c in cues:
    if c['bus'] == 'music':
        continue
    has_in = any(c.get(k) is not None for k in ('fade_in', 'fade_in_ms', 'fade_in_samples'))
    has_out = any(c.get(k) is not None for k in ('fade_out', 'fade_out_ms', 'fade_out_samples'))
    if not has_in:
        an = c.get('anchor_s')
        on_attack = isinstance(an, str) or (an is not None and abs(float(an) - float(c.get('src_in', 0.0))) <= 0.005)
        c['fade_in_ms'] = 1.0 if on_attack else 2.0
    if not has_out:
        c['fade_out_ms'] = 2.0

SAFETY_HP = 20
sheet = {
    'title': 'Offline - complete soundtrack (60.000 s)',
    'note': ('Cue sheet for audio/mix.py. Built to the final frame numbers of TREATMENT.md and the sample-exact '
             'music edit of audio/music_edit.json. Only licensed recordings; processing is editing, gain, filters, '
             'tape/rubberband pitch, and convolution with three recorded room impulse responses (Zenodo, CC BY 4.0). '
             'Buses: music, amb (beds), fx, foley (close, dry), plus one return bus per reverb. Each cue carries a '
             '_comment with its shot and purpose. Generated by audio/build_cues.py (edit that, not this file). '
             'Report: audio/CUES.md.'),
    'frames': 1440,
    'library_root': '../out/audio/raw',
    'manifest': '../out/audio/raw/manifest.json',
    'grid': {'bpm': 90, 'zero_frame': 1, 'beats_per_bar': 4},
    'calibration_ref': {'file': TRACK, 'src_in': 5.3333333333, 'src_out': 25.3333333333},
    # every bus carries a 20 Hz, 24 dB/oct safety high-pass (no infrasound reaches the master). A filter rings on
    # after its input stops, so each bus is also muted (exact digital silence) at the hard stops it must honour:
    # f961-1152 for the music, f1409 for everything, the printer's sync bus re-opening just before f1418
    'buses': {
        'music': {'gain_db': -4.0, 'automation': {'highpass_hz': SAFETY_HP, 'gain_db': [
            [1, 0], [960.976, 'mute', 'step'], [1152.5, 0, 'step'], [1408.976, 'mute', 'step']]}},
        'amb': {'gain_db': 0.0, 'automation': {'highpass_hz': SAFETY_HP, 'gain_db': [
            [1, 0], [250, 0], [252.5, -8, 'ease_in'], [256.976, 0, 'step'], [1408.976, 'mute', 'step']]}},
        'fx': {'gain_db': 0.0, 'automation': {'highpass_hz': SAFETY_HP, 'gain_db': [[1, 0], [1408.976, 'mute', 'step']]}},
        'foley': {'gain_db': 0.0, 'automation': {'highpass_hz': SAFETY_HP,
                  'gain_db': [[1, 0], [1408.976, 'mute', 'step']]}},
        'sync': {'gain_db': 0.0, 'automation': {'highpass_hz': SAFETY_HP, 'gain_db': [
            [1, 0], [1408.976, 'mute', 'step'], [1417.5, 0, 'step']]}},
        'verb_room': {'gain_db': 0.0, 'automation': {'highpass_hz': SAFETY_HP, 'gain_db': [
            [1, 0], [529, 0], [531, 'mute'], [600, 'mute'], [602, 0], [753, 0], [755, 'mute'], [825, 'mute'], [827, 0],
            [1153, 0], [1155, 'mute'], [1240, 'mute'], [1242, 0], [1408.976, 'mute', 'step']]}},
        'verb_hall': {'gain_db': 0.0, 'automation': {'highpass_hz': SAFETY_HP, 'gain_db': [
            [1, 0], [129, 0], [132, 'mute'], [146, 'mute'], [148, 0], [609, 0], [612, 'mute'], [745, 'mute'],
            [747, 0], [833, 0], [836, 'mute']]}},
        # the Sommertheater (night) return dies on the cut to the dark room and comes back for S14
        'verb_soft': {'gain_db': 0.0, 'automation': {'highpass_hz': SAFETY_HP, 'gain_db': [
            [1, 0], [1249, 0], [1251, 'mute'], [1343, 'mute'], [1345, 0], [1408.976, 'mute', 'step']]}},
        'verb_black': {'gain_db': 0.0, 'automation': {'highpass_hz': SAFETY_HP,
                       'gain_db': [[1, 0], [1436, 0], [1440.95, 'mute']]}},
    },
    'lanes': lanes,
    'reverbs': {
        'room': {'ir': 'ir/zenodo-tub-spirit-meeting-room-kemar-brir-front.wav', 'src_in': 0.0085, 'src_out': 0.80,
                 'fade_in_ms': 1.0, 'fade_out_ms': 250, 'predelay_ms': 8, 'highpass_hz': 120, 'lowpass_hz': 9000,
                 'return_bus': 'verb_room'},
        'hall': {'ir': 'ir/zenodo-churchir-cremona-omni-pair-sc-ml10-mr10.wav', 'src_in': 0.080, 'src_out': 4.60,
                 'fade_in_ms': 2.0, 'fade_out_ms': 1200, 'predelay_ms': 35, 'highpass_hz': 60, 'lowpass_hz': 8000,
                 'return_bus': 'verb_hall'},
        'soft': {'ir': 'ir/zenodo-detmold-sommertheater-dummyhead-c1s1r4.wav', 'src_in': 0.075, 'src_out': 1.60,
                 'fade_in_ms': 2.0, 'fade_out_ms': 500, 'predelay_ms': 20, 'highpass_hz': 100, 'lowpass_hz': 8000,
                 'return_bus': 'verb_soft'},
        'room_black': {'ir': 'ir/zenodo-tub-spirit-meeting-room-kemar-brir-front.wav', 'src_in': 0.0085,
                       'src_out': 0.80, 'fade_in_ms': 1.0, 'fade_out_ms': 250, 'predelay_ms': 8, 'highpass_hz': 120,
                       'lowpass_hz': 9000, 'return_bus': 'verb_black'},
    },
    'master': {'lufs': -16.0, 'true_peak_dbtp': -1.0, 'normalize': True,
               'glue': {'enabled': False},
               'limiter': {'lookahead_ms': 3.0, 'release_ms': 120.0}},
    'cues': cues,
}
json.dump(sheet, open(OUT, 'w'), indent=1)
print(f'{len(cues)} cues -> {OUT}')
