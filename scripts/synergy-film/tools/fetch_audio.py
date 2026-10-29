#!/usr/bin/env python3
"""Download the film's licensed sound library from its original sources.

The recordings are not committed (Mixkit's licence forbids redistributing
sounds on their own, and the library is ~2.5 GB). audio/library.json lists
every file with its source page, direct file URL, licence and attribution.

    python3 tools/fetch_audio.py                 # everything (~340 files)
    python3 tools/fetch_audio.py --only music    # just one kind

Files land in out/audio/raw/<path>, and a machine-local manifest.json with
absolute paths is written next to them for audio/mix.py.
"""

import argparse
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def fetch(url, dest, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'synergy-film/1.0'})
            with urllib.request.urlopen(req, timeout=120) as r, open(dest + '.part', 'wb') as fh:
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
    p.add_argument('--only', default='', help='music | sfx | ambience')
    args = p.parse_args()
    lib = json.load(open(os.path.join(ROOT, 'audio', 'library.json')))
    failed = []
    local = []
    for e in lib['files']:
        if args.only and e['kind'] != args.only:
            continue
        dest = os.path.join(args.out, e['path'])
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if not os.path.exists(dest):
            print('get', e['path'], flush=True)
            if not fetch(e['file_url'], dest):
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
