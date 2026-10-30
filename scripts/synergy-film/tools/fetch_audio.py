#!/usr/bin/env python3
"""Download the film's licensed sound library from its original sources.

The recordings are not committed (Mixkit's licence forbids redistributing
sounds on their own, and the library is ~2.5 GB). audio/library.json lists
every file with its source page, direct file URL, licence and attribution.

    python3 tools/fetch_audio.py                 # everything (~340 files)
    python3 tools/fetch_audio.py --only music    # just one kind

Files land in out/audio/raw/<path>, and a machine-local manifest.json with
absolute paths is written next to them for audio/mix.py.

Entries with an "extract" recipe (the recorded impulse responses) come out of
a container instead of a direct file: file_url is the container (a zip or a
SOFA file), downloaded once to out/audio/containers/ and checked against its
sha256, then
    {"type": "zip", "members": ["a.wav"]}              one member, copied byte for byte
    {"type": "zip", "members": ["l.wav", "r.wav"]}     mono members -> one multichannel WAV
    {"type": "sofa", "index": [m, e]}                  Data.IR[m, :, e, :] -> one WAV (needs h5py)
Nothing is computed: the samples are written exactly as measured (float32 WAV).
"""

import argparse
import hashlib
import io
import json
import os
import ssl
import sys
import time
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def extract(e, dest, containers):
    """Materialise an entry with an "extract" recipe from its downloaded container."""
    import numpy as np
    import soundfile as sf
    ex = e['extract']
    os.makedirs(containers, exist_ok=True)
    cpath = os.path.join(containers, ex['container'])
    if not os.path.exists(cpath):
        print('  container', ex['container'], flush=True)
        if not fetch(e['file_url'], cpath):
            return False
    if ex.get('sha256') and sha256(cpath) != ex['sha256']:
        print(f'  {ex["container"]}: sha256 mismatch, refusing to extract', flush=True)
        return False
    if ex['type'] == 'zip':
        with zipfile.ZipFile(cpath) as z:
            if len(ex['members']) == 1:
                with z.open(ex['members'][0]) as src, open(dest + '.part', 'wb') as out:
                    out.write(src.read())
            else:
                chans, rates = [], set()
                for m in ex['members']:
                    x, sr = sf.read(io.BytesIO(z.read(m)), dtype='float32', always_2d=True)
                    chans.append(x[:, 0])
                    rates.add(sr)
                if len(rates) != 1 or len({len(c) for c in chans}) != 1:
                    print('  members differ in rate or length', flush=True)
                    return False
                sf.write(dest + '.part', np.stack(chans, axis=1), rates.pop(), subtype='FLOAT', format='WAV')
    elif ex['type'] == 'sofa':
        import h5py
        m, em = ex['index']
        with h5py.File(cpath, 'r') as f:
            ir = np.asarray(f['Data.IR'][m, :, em, :], dtype=np.float32)  # (receivers, samples)
            sr = int(round(float(f['Data.SamplingRate'][0])))
        sf.write(dest + '.part', ir.T, sr, subtype='FLOAT', format='WAV')
    else:
        print(f'  unknown extract type {ex["type"]!r}', flush=True)
        return False
    os.replace(dest + '.part', dest)
    return True


def ssl_context():
    """Trust certifi's CA bundle when available (python.org builds on macOS ship without system CAs)."""
    try:
        import certifi
    except ImportError:
        return None
    return ssl.create_default_context(cafile=certifi.where())


def fetch(url, dest, tries=4):
    ctx = ssl_context()
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'synergy-film/1.0'})
            with urllib.request.urlopen(req, timeout=120, context=ctx) as r, open(dest + '.part', 'wb') as fh:
                while True:
                    chunk = r.read(1 << 16)
                    if not chunk:
                        break
                    fh.write(chunk)
            os.replace(dest + '.part', dest)
            return True
        except Exception as exc:  # network hiccups: back off and retry
            print(f'  retry {attempt + 1}: {exc}', flush=True)
            time.sleep(2 ** (attempt + 1))
    return False


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--out', default=os.path.join(ROOT, 'out', 'audio', 'raw'))
    p.add_argument('--only', default='', help='music | sfx | ambience | ir')
    p.add_argument('--containers', default=os.path.join(ROOT, 'out', 'audio', 'containers'),
                   help='download cache for the zip / SOFA containers that IRs are extracted from')
    args = p.parse_args()
    lib = json.load(open(os.path.join(ROOT, 'audio', 'library.json')))
    failed = []
    local = []
    for e in lib['files']:
        dest = os.path.join(args.out, e['path'])
        if args.only and e['kind'] != args.only:
            # not fetched this time, but keep it in the manifest if it is already on disk
            if os.path.exists(dest):
                local.append(dict(e, path=os.path.abspath(dest)))
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if not os.path.exists(dest):
            print('get', e['path'], flush=True)
            ok = extract(e, dest, args.containers) if e.get('extract') else fetch(e['file_url'], dest)
            if not ok:
                failed.append(e['path'])
                continue
        local.append(dict(e, path=os.path.abspath(dest)))
    manifest = dict(lib, root=os.path.abspath(args.out), files=local)
    with open(os.path.join(args.out, 'manifest.json'), 'w') as fh:
        json.dump(manifest, fh, indent=1)
    print(f'{len(local)} files ready, {len(failed)} failed', flush=True)
    for f in failed:
        print('  FAILED', f)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
