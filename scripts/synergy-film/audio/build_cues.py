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
    'heater': 'ambience/sonniss2017-detunized-room-tones-office-building--rt-office-heater-tone-2.flac',
    'server': 'ambience/sonniss2015-giorgio-riolo-silentscapes--sfxw001-indoor-server-room.flac',
    'buzz': 'ambience/sonniss2015-soundopolis-sci-fi-electric--streetlight-buzz-fienup-002.wav',
    'computers': 'ambience/sonniss2017-detunized-room-tones-office-building--rt-office-turn-on-off-computers.flac',
    'walla': 'ambience/berklee-v10-crowd1.wav',
    'cardboard': 'sfx/cup_creak/sonniss2018-effectsworks-creaks-squeaks-squeals-card-cardboard-box-2-creak-small-file-3-takes-7.wav',
    'plastic_bend': 'sfx/cup_creak/sonniss2019-matt-script-squeaks-creaks-grinding-plastic-bending-tension-squeaking-creaking-under-pressure-11.wav',
    'deep_woosh': 'sfx/whoosh/mixkit-2604-deep-air-woosh.wav',
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
    'dotmatrix': 'sfx/printer/sonniss2017-chris-skyes-vintage-dot-matrix-printer-sfx-dot-matrix-vintage-printer-servo-47.wav',
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
    'hull_sub': 'sfx/ship_creak/mixkit-3076-ship-hull-creak.wav',
    'ship_sea': 'sfx/ship_creak/mixkit-1187-wooden-ship-on-the-sea.wav',
}

cues = []


def cue(shot, cid, key, at, bus, **kw):
    c = {'id': cid, 'file': F[key] if key in F else key, 'bus': bus, 'at_frame': at}
    c.update(kw)
    c['_comment'] = shot + (': ' + c.pop('note') if 'note' in c else '')
    cues.append(c)
    return c


# ------------------------------------------------------------------------------------------------
# MUSIC: the edit of music_edit.json (M1 intro pass 1, M2 intro pass 2 + groove, M3 offline return)
# ------------------------------------------------------------------------------------------------
for seg in EDIT['segments']:
    fr = seg['film_frames']
    ft = seg['file_time_s']
    cues.append({
        'id': f'music-{seg["id"]}', 'file': TRACK, 'bus': 'music',
        'src_in': ft[0], 'src_out': ft[1], 'at_frame': fr[0], 'end_frame': fr[1] + 1,
        'fade_in_samples': seg['fade_in']['samples'], 'fade_out_samples': seg['fade_out']['samples'],
        'guard_samples': seg['fade_out']['guard_samples'], 'automation': 'music_main',
        '_comment': f'music edit segment {seg["id"]}: {seg["role"]}; file {ft[0]:.4f}-{ft[1]:.4f} s on frames '
                    f'{fr[0]}-{fr[1]}, sample-exact butt edits (12-sample fade in, 4 ms fade out, 1 ms guard)'})

lanes = {
    # the music lives where the meeting lives
    'music_main': {
        'lowpass_hz': [
            [1, 400], [129, 400],                 # S01: through the paper wall
            [250, 'open'],                        # S02: opens (log sweep) as the camera leaves the cup
            [529, 600, 'step'], [609, 'open', 'step'],   # S06 inside the cup / S07 back in the room
            [753, 600, 'step'], [833, 5000, 'step'],     # S08 inside / S09 tension: gentle 5 kHz
            [1153, 'open', 'step'],               # S12: clean and close, offline at night
            [1249, 600, 'step'], [1281, 600],     # S13: heard from inside the cup
            [1297, 3000, 'smooth'], [1345, 3000], # opens to 3 kHz as the cup rises to the sip
            [1361, 'open', 'smooth'],             # S14: through the skylight, full fidelity for the last bar
        ],
        'gain_db': [
            [1, 0], [250, 0], [252.5, -24, 'ease_in'], [256.976, 0, 'step'],  # S02 held breath, back on the drop
            [352, 0], [353, -1.5, 'smooth'],                     # after the drop, make room for the foley (S04-S05)
            [529, -7.5, 'step'], [609, -1.5, 'step'],            # S06 inside the cup (-6 re the room) / S07
            [700, -1.5], [705, -4.5, 'smooth'], [752, -4.5],     # ride the hot fill bar (file bar 9) down 3 dB
            [753, -7.5, 'step'], [833, -5.5, 'step'],            # S08 inside (-6) / S09 ducked (-4) re the room
            [1153, -9, 'step'],                                  # S12: night, clean and close (and quiet)
            [1249, -14, 'step'], [1281, -14],                    # S13: from inside the cup, the kit re-enters muffled
            [1297, -8, 'smooth'], [1345, -8],                    # +6 dB swell as the cup rises, arriving on the sip
            [1361, -1, 'smooth'], [1409, -1],                    # S14: opens up for the last bar
        ],
    },
}

# ------------------------------------------------------------------------------------------------
# helpers for repeated ambience layers
# ------------------------------------------------------------------------------------------------


def offline_day(shot, a, b, *, srcs, breath_gain=-4, lap_gain=0, wind_gain=-24, fade_in=1):
    hv, st, wd = srcs
    cue(shot, f'{shot.lower()}-world-breath', 'hvac', a, 'amb', src_in=hv, src_out=hv + 24.0,
        pitch_mode='tape', pitch_semitones=-12, highpass_hz=28, lowpass_hz=900, loop=True, loop_xfade_ms=600,
        end_frame=b, fade_in=fade_in, fade_out=1.5, gain_db=breath_gain,
        note='the world breathing: HVAC drone loop, tape -12 st, high-passed at 28 Hz (its sub-30 Hz content is dropped)')
    cue(shot, f'{shot.lower()}-lapping', 'stream', a, 'amb', src_in=st, pitch_mode='tape',
        pitch_semitones=-5, highpass_hz=60, end_frame=b, fade_in=fade_in, fade_out=1.5, gain_db=lap_gain,
        note='espresso lapping on stone: quiet stream, tape -5 st (slower, larger)')
    cue(shot, f'{shot.lower()}-air', 'wind', a, 'amb', src_in=wd, highpass_hz=80, lowpass_hz=3000,
        end_frame=b, fade_in=fade_in, fade_out=1.5, gain_db=wind_gain, note='soft air in the cup')


def room_tone(shot, a, b, gain=-10, fade_in=1, fade_out=1.5, src=10.0):
    cue(shot, f'{shot.lower()}-roomtone', 'heater', a, 'amb', src_in=src, end_frame=b, fade_in=fade_in,
        fade_out=fade_out, gain_db=gain, highpass_hz=30, note='Long Room tone: office heater tone')


# ------------------------------------------------------------------------------------------------
# S01  f1-128  Offline day, inside the cup
# ------------------------------------------------------------------------------------------------
offline_day('S01', 1, 129, srcs=(6.0, 4.0, 20.0), fade_in=20)
for i, (at, take_in, take_out) in enumerate([(26, 3.55, 4.75), (78, 9.35, 10.45)]):
    cue('S01', f's01-cup-creak-{i + 1}', 'cardboard', at, 'fx', src_in=take_in, src_out=take_out, pitch_mode='tape',
        pitch_semitones=-24, lowpass_hz=1800, highpass_hz=40, fade_in=3, fade_out=6, gain_db=-14 - 3 * i,
        reverb='hall', reverb_send=-16, pan=-0.25 + 0.5 * i, end_frame=129,
        note='a paper cup squeezed, two octaves down: the cliffs creak (cardboard-box creak take, tape -24 st)')
cue('S01', 's01-eclipse-whoosh', 'deep_woosh', 104, 'fx', src_in=0.0, pitch_mode='tape', pitch_semitones=-5,
    anchor_s=0.0838, lowpass_hz=2200, gain_db=-15, fade_out=2, end_frame=129, reverb='hall', reverb_send=-16,
    note='eclipse at f104: long soft deep-air whoosh, tape -5 st; cut on the match cut')

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
cue('S02', 's02-blink-tick', 'cam_clicks', 240, 'foley', src_in=0.06, src_out=0.32, anchor_s='onset', gain_db=-27,
    lowpass_hz=8000, note='dry relay tick on the blink')

# ------------------------------------------------------------------------------------------------
# S03  f257-352  the drop: the wide room
# ------------------------------------------------------------------------------------------------
cue('S03-S05', 's03-crt-whine', 'buzz', 257, 'amb', src_in=5.0, end_frame=529, fade_out=1.5, gain_db=-8,
    highpass_hz=4000, highpass_slope=48, note='bed of high-frequency CRT whine: streetlight buzz, high-passed')
for f in (257, 321):
    cue('S03', f's03-printer-f{f}', 'printer', f, 'sync', src_in=0.010, fade_in_ms=3, anchor_s=0.0139, gain_db=-15, pan=-0.05,
        reverb='room', reverb_send=-14, note=f'printer sheet feed on the downbeat f{f} (pickup transient on the beat)')
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
DRAG = dict(src_out=5.40, pitch_mode='tape', pitch_semitones=-3, highpass_hz=180, lowpass_hz=6500, gain_db=-17,
            reverb='room', reverb_send=-16)
cue('S04', 's04-padlock-drag', 'drag', 377, 'foley', src_in=3.75, end_frame=424, fade_in=6, fade_out_ms=6,
    automation={'gain_db': [[377, -6], [390, 0], [408, 0], [424, -3]]}, **DRAG,
    note='long hiss of brass dragging on lacquered wood (metal-box drag, tape -3 st); no Doppler, we ride with it')
cue('S04', 's04-fingertip-rest', 'cup_down', 418, 'foley', src_in=0.30, src_out=0.60, anchor_s='onset', gain_db=-30,
    pan=0.25, note='bronze fingertip rests on the walnut')


def padlock_knock(shot, f):
    cue(shot, f'{shot.lower()}-knock-metal', 'gear_tap', f, 'sync', src_in=0.085, src_out=0.5, anchor_s=0.0948,
        gain_db=-11, pan=0.1, reverb='room', reverb_send=-16, note=f'precise knock as it stops (gear lock tap) f{f}')
    cue(shot, f'{shot.lower()}-knock-wood', 'cup_down', f, 'foley', src_in=5.57, src_out=5.95, anchor_s=5.591,
        gain_db=-12, pan=0.1, note='the walnut under it (cup set down on a wooden table, low thud)')


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
cue('S05', 's05-plip', 'metal_drops', 512, 'sync', src_in=10.69, src_out=11.55, anchor_s=10.7187, pitch_mode='tape',
    pitch_semitones=-2.4, gain_db=-15, fade_out=4, lowpass_hz=7000, reverb='room', reverb_send=-18, pan=0.1,
    note='wet plip into the cup at f512 (water drop into a vessel, tuned to Eb)')
cue('S05', 's05-far-below-whoosh', 'windy_swoosh', 514, 'fx', src_in=0.30, pitch_mode='tape', pitch_semitones=-7,
    lowpass_hz=1200, gain_db=-40, reverb='hall', reverb_send=0, end_frame=529, fade_in=3, fade_out=1.5,
    note='then far below a falling whoosh (leads into S06)')

# ------------------------------------------------------------------------------------------------
# S06  f529-608  inside the cup: the padlock lands at the arch
# ------------------------------------------------------------------------------------------------
offline_day('S06', 529, 609, srcs=(14.0, 14.0, 30.0))
cue('S06', 's06-fall-whoosh', 'windy_swoosh', 529, 'fx', src_in=0.405, anchor_s=0.405, pitch_mode='tape',
    pitch_semitones=-5, lowpass_hz=6000, gain_db=-15, end_frame=556, fade_out=3, reverb='hall', reverb_send=-16,
    note='windy whoosh as the padlock falls (peak just before the landing)')
cue('S06', 's06-impact-metal', 'long_metal', 553, 'fx', src_in=0.12, anchor_s=0.1604, pitch_mode='tape',
    pitch_semitones=-12, lowpass_hz=2200, gain_db=-11, end_frame=609, fade_out=4, reverb='hall', reverb_send=-12,
    note='f553: deep metal impact an octave down (long metal impact)')
cue('S06', 's06-impact-bulkhead', 'bulkhead', 553, 'sync', src_in=0.06, anchor_s=0.1013, lowpass_hz=1600,
    gain_db=-14, end_frame=609, fade_out=4, reverb='hall', reverb_send=-14, note='layered steel bulkhead hit')
cue('S06', 's06-impact-thud', 'cup_down', 553, 'fx', src_in=5.57, src_out=5.95, anchor_s=5.591, pitch_mode='tape',
    pitch_semitones=-24, lowpass_hz=500, gain_db=-8, reverb='hall', reverb_send=-16,
    note='low thud: the wooden cup-down thud two octaves down')
cue('S06', 's06-scree-metal', 'coins', 556, 'fx', src_in=0.40, src_out=1.0, anchor_s='onset', pitch_mode='tape',
    pitch_semitones=-19, lowpass_hz=3200, gain_db=-15, fade_out=6, reverb='hall', reverb_send=-16, pan=-0.15,
    note='scree slide of old padlocks: coins into a metal drawer, tape -19 st')
cue('S06', 's06-scree-stone', 'peas', 557, 'fx', src_in=0.12, src_out=0.85, pitch_mode='tape', pitch_semitones=-24,
    lowpass_hz=2600, gain_db=-17, fade_out=8, end_frame=600, reverb='hall', reverb_send=-16, pan=0.15,
    note='stone and grit under it: peas into glass, tape -24 st')
cue('S06', 's06-bounce', 'bulkhead', 566, 'fx', src_in=0.06, anchor_s=0.1013, pitch_mode='tape', pitch_semitones=-3,
    lowpass_hz=1400, gain_db=-22, end_frame=609, fade_out=4, reverb='hall', reverb_send=-14,
    note='the single bounce (f566)')
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
        cue('S07', f's07-arrive-{k + 1}-glass', 'glass_cup', f, 'foley', src_in=0.0, src_out=0.20, anchor_s='onset',
            gain_db=-20, pan=0.3, lowpass_hz=9000, reverb='room', reverb_send=-16,
            note='f609 Linda\'s glass zero arrives on the cut: glass on lacquered wood, stopped by a finger')
    elif kind == 'env':
        cue('S07', f's07-slide-{k + 1}-paper', 'paper_quick', f, 'foley', anchor_s=0.4222 + (0.08 if dt else 0.0),
            src_in=0.30 if dt else 0.15, src_out=0.62, fade_in=2, fade_out=2, gain_db=-21, highpass_hz=300,
            automation={'pan': [[f - (8 if dt else 14), -0.25], [f, 0.3]]}, reverb='room', reverb_send=-16,
            note=f'f{f} envelope spins up the table and stops (paper on wood)')
    else:
        cue('S07', f's07-arrive-{k + 1}-acrylic', 'plastic_hit', f, 'foley', src_in=0.10, src_out=0.32,
            anchor_s='onset', gain_db=-22, pan=0.3, lowpass_hz=10000, reverb='room', reverb_send=-16,
            note=f'f{f} green acrylic tabs stop with an acrylic tick')

# the posts: each plip lands on the next beat (8th notes in double time), a little melody in Eb minor pentatonic
POSTS = [  # frame, source key, src_in, src_out, semitones, note name
    (625, 'marble', 0.0, 0.80, 0.30, 'Db5', 'glass zero: a marble into the cup'),
    (641, 'metal_drops', 3.995, 4.50, -1.09, 'Gb5', 'envelope: water plip'),
    (657, 'wood_drops', 10.09, 10.40, -0.68, 'Bb4', 'tabs: hollow wooden drop'),
    (673, 'metal_drops', 2.41, 3.10, -1.75, 'Eb5', 'envelope: water plip'),
    (681, 'wood_drops', 11.90, 12.40, 1.58, 'Gb5', 'tabs: hollow wooden drop'),
    (689, 'metal_drops', 13.16, 13.80, 1.55, 'Ab5', 'envelope: water plip'),
    (697, 'metal_drops', 15.28, 15.90, 4.67, 'Bb5', 'envelope: water plip'),
    (705, 'wood_drops', 5.56, 6.05, -3.27, 'Eb6', 'tabs: hollow wooden drop'),
]
for k, (f, key, a, b, st, nm, what) in enumerate(POSTS):
    cue('S07', f's07-post-{k + 1}-{nm}', key, f, 'foley', src_in=a, src_out=b, anchor_s='onset', pitch_mode='tape',
        pitch_semitones=st, gain_db=-14 if key != 'marble' else -16, fade_out=3, lowpass_hz=6500, pan=0.38,
        reverb='room', reverb_send=-18, note=f'post {k + 1} on f{f}: {what}, tuned to {nm}')

# the droid: arrives f705-712, binder f721, squeeze f729-744, reverses out f737-752
cue('S07', 's07-droid-in-motor', 'servo_usc', 693, 'fx', src_in=20.0, src_out=21.0, pitch_mode='tape',
    pitch_semitones=3, end_frame=713, fade_in=6, fade_out=2, gain_db=-27, pan=0.25, reverb='room', reverb_send=-12,
    note='droid motor as it rolls into its bay')
cue('S07', 's07-droid-caster-stop', 'metal_wheels', 712, 'fx', src_in=1.20, src_out=1.95, anchor_s=1.89,
    fade_in=4, fade_out=3, gain_db=-20, pan=0.25, lowpass_hz=7000, reverb='room', reverb_send=-12,
    note='measured caster stop at f712 (chair with metal wheels)')
cue('S07', 's07-binder-lift', 'joints', 721, 'foley', src_in=1.15, src_out=1.50, anchor_s='onset', gain_db=-25,
    pan=0.35, fade_out=3, note='f721 binder lift: the arm takes the weight (metal joint creak)')
cue('S07', 's07-binder-crunch', 'crumble', 729, 'foley', src_in=0.0, src_out=1.55, pitch_mode='tape',
    pitch_semitones=-4, gain_db=-17, fade_out=4, end_frame=746, pan=0.35, reverb='room', reverb_send=-16,
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
    pan=-0.2, reverb='room', reverb_send=-4, end_frame=753, fade_out=1.5,
    note='at the far end the printer feeds another sheet (on beat 46, f737)')

# ------------------------------------------------------------------------------------------------
# S08  f753-832  everything deferred is landscape
# ------------------------------------------------------------------------------------------------
offline_day('S08', 753, 833, srcs=(24.0, 24.0, 40.0), lap_gain=-4)
cue('S08', 's08-falls', 'falls', 753, 'amb', src_in=3.0, end_frame=833, fade_in=1, fade_out=1.5, gain_db=-22,
    lowpass_hz=2600, highpass_hz=80, reverb='hall', reverb_send=-22,
    automation={'gain_db': [[753, -4], [832, 0]]}, note='the paper falls: big waterfall roar, far cliff')
cue('S08', 's08-falls-paper', 'shuffle', 753, 'amb', src_in=1.0, end_frame=833, fade_in=1, fade_out=1.5, gain_db=-24,
    lowpass_hz=6000, highpass_hz=400, reverb='hall', reverb_send=-20, note='massed paper riffle in the falls (shuffling paper)')
cue('S08', 's08-falls-wind-papers', 'papers_wind', 765, 'amb', src_in=0.4, end_frame=833, fade_in=10, fade_out=1.5,
    gain_db=-24, lowpass_hz=5000, reverb='hall', reverb_send=-20, note='wind blowing papers')
cue('S08', 's08-bird-unfold', 'page_turn', 772, 'foley', anchor_s=0.3237, gain_db=-20, pan=-0.12, highpass_hz=300,
    reverb='hall', reverb_send=-16, note='soft paper unfold on the foreground envelope-bird')
# murmuration: bird flying away, layered and staggered x12
for k in range(12):
    f = 776 + 4 * k
    st = [-2, -5, -3, -7, -4, -8, -6, -3, -9, -5, -7, -4][k]
    pan = [-0.6, 0.5, -0.2, 0.7, -0.45, 0.25, -0.7, 0.4, 0.0, -0.3, 0.6, -0.1][k]
    cue('S08', f's08-wings-{k + 1:02d}', 'bird', f, 'fx', src_in=0.20, anchor_s='onset', pitch_mode='tape',
        pitch_semitones=st, gain_db=-17 - (k % 3) * 2, pan=pan, lowpass_hz=6000, end_frame=833, fade_out=1.5,
        reverb='hall', reverb_send=-18, note=f'murmuration wing roar, layer {k + 1}/12 (bird flying away, tape {st} st)')
cue('S08', 's08-wings-paper-edge', 'paper_quick', 798, 'fx', src_in=0.18, src_out=0.76, pitch_mode='tape',
    pitch_semitones=-6, gain_db=-24, end_frame=833, fade_out=1.5, highpass_hz=500, reverb='hall', reverb_send=-18,
    note='paper-flutter edge on the wings')

# ------------------------------------------------------------------------------------------------
# S09  f833-928  the same padlock again
# ------------------------------------------------------------------------------------------------
room_tone('S09-S11', 833, 1153, fade_in=0.5, fade_out=1.5, src=70.0)
hum_dn = {'gain_db': [[833, 0], [960.976, 0], [961, -10, 'step']] +
          [[1001 + 5 * k + 0.5, -10 - 2 * (k + 1), 'step'] for k in range(7)] + [[1036.5, -120, 'step']]}
cue('S09-S11', 's09-meeting-hum', 'server', 833, 'amb', src_in=80.0, end_frame=1054, fade_in=0.5, fade_out=1, gain_db=-14,
    lowpass_hz=4500, highpass_hz=60, automation=hum_dn,
    note='meeting hum: drops 10 dB on the click (f961), then steps down with each terminal (f1001-1036)')
cue('S09-S11', 's09-crt-whine', 'buzz', 833, 'amb', src_in=30.0, end_frame=1054, fade_out=1, gain_db=-8,
    highpass_hz=4000, highpass_slope=48, automation=hum_dn,
    note='CRT whine: drops on the click, dies with the terminals')
kevin_murmur('S09', 833, pan=0.0, lp=2800)   # identical samples, identical rhythm: the repetition is the joke
S09_SHIFT = 852 - 424
src_at_841 = 3.75 + (841 - S09_SHIFT - 377) / 24 * 2 ** (-3 / 12)
cue('S09', 's09-padlock-drag', 'drag', 841, 'foley', src_in=round(src_at_841, 4), end_frame=852, fade_in=2,
    fade_out_ms=6, automation={'gain_db': [[841, 0], [852, -3]]}, **DRAG,
    note='the same drag hiss: the identical sample segment that ended S04\'s glide')
padlock_knock('S09', 852)
cue('S09', 's09-lookdown-tick', 'cam_clicks', 857, 'foley', src_in=0.38, src_out=0.70, anchor_s='onset', gain_db=-21,
    lowpass_hz=9000, note='a single servo tick on the look-down (f857)')
cue('S09', 's09-blink-tick', 'cam_clicks', 917, 'foley', src_in=0.06, src_out=0.32, anchor_s='onset', gain_db=-29,
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
    note='one knuckle flexes 1 degree: resolve (f953)')
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
    pan=-0.05, note='the walnut under it')
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
    cue('S11', f's11-crt-off-{k + 1}-{name}', 'computers', f, 'fx', src_in=a, src_out=b, anchor_s='onset',
        pitch_mode='tape', pitch_semitones=st, gain_db=round(-2 + att * 0.6 + EV_TRIM[a], 1), pan=pan,
        lowpass_hz=round(12000 - 380 * dist), fade_out=3, reverb='room', reverb_send=round(-14 + dist * 0.35, 1),
        note=f'f{f} {name} powers off ({dist} m): real office power switch and fan run-down, tape {st:+d} st')
cue('S11', 's11-printer-wind-down', 'dotmatrix', 1049, 'fx', src_in=1.40, src_out=2.36, pitch_mode='tape',
    pitch_semitones=-5, gain_db=-14, fade_in=2, lowpass_hz=5000, pan=-0.05, reverb='room', reverb_send=-6,
    automation={'gain_db': [[1049, 0], [1058, -4]]},
    note='f1049-1060 the printer motor winds down mid-sheet: stepper whirr to a stop thump (dot-matrix feed, tape -5 st)')
cue('S11', 's11-pat-thoom', 'humbuzz', 1085, 'fx', src_in=0.30, src_out=1.40, fade_in_ms=25, fade_out=14, gain_db=-24,
    lowpass_hz=1800, pan=0.18, reverb='room', reverb_send=-3,
    note='f1085 far away, Pat\'s CRT powers on: degauss hum burst (real electrical hum, distant)')
cue('S11', 's11-pat-degauss', 'static_up', 1085, 'fx', src_in=0.20, src_out=1.70, anchor_s='onset', gain_db=-30,
    lowpass_hz=3500, highpass_hz=200, fade_out=8, pan=0.18, reverb='room', reverb_send=-3,
    note='degauss buzz (electricity static power-up, distant)')
cue('S11', 's11-pat-glow', 'buzz', 1093, 'amb', src_in=40.0, end_frame=1153, fade_in=8, fade_out=1.5, gain_db=-26,
    highpass_hz=5000, highpass_slope=48, pan=0.25, note='one faint CRT whine remains: Pat')
cue('S11', 's11-turn-tick', 'cam_clicks', 1097, 'foley', src_in=0.06, src_out=0.32, anchor_s='onset', gain_db=-29,
    lowpass_hz=8000, note='tiny servo tick for the head turn (f1097)')
cue('S11', 's11-dip-tick', 'cam_clicks', 1109, 'foley', src_in=0.38, src_out=0.70, anchor_s='onset', gain_db=-28,
    lowpass_hz=8000, note='tiny servo tick for the only head dip in the film (f1109)')
cue('S11', 's11-headset-lift', 'headphone', 1129, 'foley', src_in=0.0, src_out=1.6, gain_db=-28, lowpass_hz=7000,
    fade_in=1, fade_out=6, end_frame=1145, pan=-0.3, note='f1129-1140 headband creaks as he lifts the headset')
cue('S11', 's11-headset-plastic', 'plastic_handling', 1150, 'foley', src_in=4.90, src_out=5.10, anchor_s='onset',
    gain_db=-20, pan=-0.3, fade_out=2, note='f1150 a soft plastic headset set down on wood: plastic half')
cue('S11', 's11-headset-wood', 'cup_down', 1150, 'foley', src_in=3.95, src_out=4.20, anchor_s='onset', gain_db=-21,
    pan=-0.3, fade_out=2, reverb='room', reverb_send=-14, note='wood half')

# ------------------------------------------------------------------------------------------------
# S12  f1153-1248  night in Offline
# ------------------------------------------------------------------------------------------------
cue('S12', 's12-night', 'night', 1153, 'amb', src_in=20.0, end_frame=1249, fade_in=2, fade_out=1.5, gain_db=-10,
    note='real night ambience: summer night in the forest (crickets, insects)')
cue('S12', 's12-lapping', 'stream', 1153, 'amb', src_in=24.0, pitch_mode='tape', pitch_semitones=-5, highpass_hz=60,
    end_frame=1249, fade_in=2, fade_out=1.5, gain_db=-4, note='water lapping on stone')
cue('S12', 's12-air', 'wind', 1153, 'amb', src_in=40.0, highpass_hz=80, lowpass_hz=2000, end_frame=1249, fade_in=2,
    fade_out=1.5, gain_db=-24, reverb='soft', reverb_send=-10, note='night air')

# ------------------------------------------------------------------------------------------------
# S13  f1249-1344  the first sip
# ------------------------------------------------------------------------------------------------
room_tone('S13-S14', 1249, 1363, fade_in=0.5, fade_out=3, src=100.0)
cue('S13', 's13-pat-whine', 'buzz', 1249, 'amb', src_in=44.0, end_frame=1363, fade_in=0.5, fade_out=3, gain_db=-28,
    highpass_hz=5000, highpass_slope=48, pan=0.2, note='Pat\'s faint screen across the dark room')
for k, f in enumerate((1249, 1265, 1281, 1297)):
    cue('S13', f's13-actuator-{k + 1}', 'power_window', f, 'foley', src_in=0.07, src_out=0.52, anchor_s=0.109,
        pitch_mode='tape', pitch_semitones=k, gain_db=-19 + k, fade_out=3, pan=0.1, lowpass_hz=7000,
        reverb='room', reverb_send=-16, note=f'actuator step {k + 1} on the beat f{f} (power-window servo)')
cue('S13', 's13-spout-contact', 'plastic_hit', 1296.6, 'foley', src_in=0.10, src_out=0.30, anchor_s=0.1256,
    gain_db=-27, pan=0.05, note='the spout touches the chin plate (f1297)')
cue('S13', 's13-sip', 'sip', 1297, 'sync', src_in=0.95, src_out=2.50, anchor_s=1.1171, fade_in_ms=40, gain_db=4, fade_out=6,
    pan=0.05, reverb='room', reverb_send=-20, note='f1297: soft, real, close-miked sip of a hot drink (the lip-and-liquid draw lands on f1297)')
cue('S13', 's13-tilt-creak', 'ship_wood', 1305, 'fx', src_in=16.20, src_out=19.6, anchor_s='onset', pitch_mode='tape',
    pitch_semitones=-5, gain_db=-8, lowpass_hz=1600, reverb='room', reverb_send=-10, end_frame=1409, fade_out_ms=3, guard_ms=0,
    note='f1305 a deep wooden structural creak as the tilt begins (large wooden ship, tape -5 st)')
cue('S13', 's13-tilt-sub', 'hull_sub', 1305, 'fx', src_in=0.40, src_out=4.5, gain_db=-14, fade_in=4, fade_out=8,
    lowpass_hz=250, note='felt sub groan under it (ship-hull creak)')
cue('S13', 's13-headset-slide', 'plastic_handling', 1318, 'foley', src_in=5.78, src_out=6.60, gain_db=-34, fade_in=4,
    fade_out=6, pan=0.35, lowpass_hz=6000, note='the headset on the table slides a few centimetres')
cue('S13', 's13-exhale', 'hyd_release', 1329, 'foley', src_in=4.40, src_out=4.95, gain_db=-34, highpass_hz=800,
    lowpass_hz=8000, fade_in=1, fade_out=6, pan=0.05, note='f1329 a faint pneumatic exhale')

# ------------------------------------------------------------------------------------------------
# S14  f1345-1440  up through the skylight; white; black; one printer sheet
# ------------------------------------------------------------------------------------------------
END = dict(end_frame=1409, fade_out_ms=3, guard_ms=0)
cue('S14', 's14-hull-creak', 'ship_wood', 1347, 'fx', src_in=19.70, src_out=24.5, anchor_s='onset', pitch_mode='tape',
    pitch_semitones=-7, gain_db=-8, lowpass_hz=1400, reverb='soft', reverb_send=-8, **END,
    note='a deep ship-hull creak as the world tilts (large wooden ship, tape -7 st)')
cue('S14', 's14-hull-sub', 'hull_sub', 1351, 'fx', src_in=4.9, src_out=7.4, gain_db=-14, fade_in=6, lowpass_hz=250,
    **END, note='sub groan of the tilting world')
cue('S14', 's14-swell', 'ship_sea', 1355, 'amb', src_in=8.0, pitch_mode='tape', pitch_semitones=-7, gain_db=-8,
    lowpass_hz=1500, highpass_hz=40, fade_in=10, reverb='soft', reverb_send=-12, **END,
    note='a long sea-swell wash (wooden ship on the sea, slowed: tape -7 st)')
cue('S14', 's14-night', 'night', 1357, 'amb', src_in=60.0, gain_db=-12, fade_in=6, **END,
    note='night crickets underneath, outside')
cue('S14', 's14-lapping', 'stream', 1361, 'amb', src_in=30.0, pitch_mode='tape', pitch_semitones=-5, highpass_hz=60,
    gain_db=-2, fade_in=6, **END, note='water on stone below')
cue('S14', 's14-rise-deep', 'deep_woosh', 1384, 'fx', src_in=0.0, anchor_s=0.4883, pitch_mode='tape',
    pitch_semitones=-3, gain_db=-16, highpass_hz=60, reverb='soft', reverb_send=-12, **END,
    note='rising air toward the slot (deep air woosh)')
cue('S14', 's14-rise-swoosh', 'flying_swoosh', 1404, 'fx', anchor_s=1.1783, gain_db=-4, highpass_hz=150,
    reverb='soft', reverb_send=-14, **END, note='a rising flying swoosh into the white; cut dead on f1409')
cue('S14', 's14-printer-over-black', 'printer', 1418, 'sync', src_in=0.010, fade_in_ms=3, src_out=0.66, anchor_s=0.0139,
    gain_db=-14, pan=-0.05, fade_out=2, reverb='room_black', reverb_send=-12,
    note='f1418 over black: one printer sheet feed, the whirr (pickup transient on f1418, then the feed run)')
cue('S14', 's14-printer-chunk', 'dotmatrix', 1434, 'foley', src_in=1.86, src_out=2.30, anchor_s=2.039, gain_db=-10,
    pan=-0.05, fade_in=0.5, end_frame=1441, fade_out=3, reverb='room_black', reverb_send=-12,
    note='...then the chunk (dot-matrix feed stop thump), settling by the last frame')

# ------------------------------------------------------------------------------------------------
# mix trims (dB), from measured per-cue loudness after the master gain (tools/cue_levels.py)
TRIM = {
    's01-world-breath': 2, 's01-air': -3, 's01-cup-creak-2': 3, 's01-eclipse-whoosh': -8,
    's02-plip': 6, 's02-far-below-whoosh': 8, 's02-neck-servo': 6, 's02-blink-tick': 4,
    's03-chair-creak': 6, 's03-droid-casters': 6, 's03-droid-trolley': 10,
    's04-knock-metal': -4, 's09-knock-metal': -4,
    's06-fall-whoosh': -7, 's06-impact-bulkhead': -2, 's06-impact-thud': -2, 's06-impact-metal': -1, 's06-pines': -9,
    's07-post-1-Db5': 2, 's07-post-2-Gb5': 10, 's07-post-3-Bb4': 2, 's07-post-4-Eb5': 5, 's07-post-5-Gb5': 9,
    's07-post-6-Ab5': 10, 's07-post-7-Bb5': 8, 's07-post-8-Eb6': 8, 's07-arrive-1-glass': 3, 's07-arrive-3-acrylic': 5,
    's07-arrive-5-acrylic': 5, 's07-arrive-8-acrylic': 5, 's07-slide-2-paper': 3, 's07-slide-4-paper': 3,
    's07-slide-6-paper': 3, 's07-slide-7-paper': 3, 's07-binder-cardboard': -4, 's07-binder-squeak': 6,
    's07-binder-plop': 6, 's07-binder-lift': 6, 's07-droid-in-motor': 4, 's07-droid-caster-stop': 4,
    's08-falls-wind-papers': -5, 's08-falls': 4, **{f's08-wings-{k:02d}': 3 for k in range(1, 13)},
    's09-blink-tick': 4,
    's10-finger-index': 10, 's10-finger-middle': 10, 's10-finger-thumb': 10, 's10-knuckle': 15,
    's10-jack-click': -5, 's10-cord-rattle-1': 4, 's10-cord-rattle-2': 4,
    's11-crt-off-1-synthia': 1, 's11-crt-off-2-keys': 7, 's11-crt-off-3-arjun': 2, 's11-crt-off-4-kevin': -8,
    's11-crt-off-5-strategy': 2, 's11-crt-off-6-operations': 1.5, 's11-crt-off-7-people-culture': 4,
    's11-crt-off-8-linda': 4, 's11-printer-wind-down': 6, 's11-pat-thoom': -2, 's11-headset-lift': 4,
    's12-night': -7, 's12-lapping': -5,
    's13-tilt-creak': -4, 's13-tilt-sub': -5, 's13-sip': -0.5,
    's14-swell': -8, 's14-hull-creak': -4, 's14-hull-sub': -3, 's14-night': -4, 's14-lapping': -4,
    's14-rise-deep': -5, 's14-rise-swoosh': -3.5, 's14-printer-over-black': -4, 's14-printer-chunk': 8,
}
for c in cues:
    if c['id'] in TRIM:
        c['gain_db'] = round(c.get('gain_db', 0.0) + TRIM.pop(c['id']), 2)
assert not TRIM, f'unknown trim ids: {sorted(TRIM)}'
for c in cues:
    if c['file'] == F['buzz'] and c['id'] in ('s03-crt-whine', 's07-crt-whine', 's09-crt-whine'):
        c['gain_db'] = round(c['gain_db'] - 3, 2)

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
    'buses': {
        'music': {'gain_db': -4.0},
        'amb': {'gain_db': 0.0,
                'automation': {'gain_db': [[1, 0], [250, 0], [252.5, -8, 'ease_in'], [256.976, 0, 'step']]}},
        'fx': {'gain_db': 0.0},
        'foley': {'gain_db': 0.0},
        'sync': {'gain_db': 0.0},
        'verb_room': {'gain_db': 0.0, 'automation': {'gain_db': [
            [1, 0], [529, 0], [531, 'mute'], [600, 'mute'], [602, 0], [753, 0], [755, 'mute'], [825, 'mute'], [827, 0],
            [1153, 0], [1155, 'mute'], [1240, 'mute'], [1242, 0], [1408.976, 'mute', 'step']]}},
        'verb_hall': {'gain_db': 0.0, 'automation': {'gain_db': [
            [1, 0], [129, 0], [132, 'mute'], [146, 'mute'], [148, 0], [609, 0], [612, 'mute'], [745, 'mute'],
            [747, 0], [833, 0], [836, 'mute']]}},
        'verb_soft': {'gain_db': 0.0, 'automation': {'gain_db': [[1, 0], [1408.976, 'mute', 'step']]}},
        'verb_black': {'gain_db': 0.0, 'automation': {'gain_db': [[1, 0], [1436, 0], [1440.95, 'mute']]}},
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
