#!/usr/bin/env python3
"""
Flowen ASR Dataset Downloader
==============================
Downloads training samples from Supabase Storage and writes a HuggingFace-
compatible dataset manifest (metadata.csv) alongside the audio files.

Usage:
    python scripts/ml/download_dataset.py \
        --out ./data/flowen-asr \
        [--limit 500] \
        [--min-duration 10] \
        [--stage 1,2,3]

Requires:
    pip install supabase python-dotenv tqdm

Environment variables (from .env.local or exported):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / '.env.local')
except ImportError:
    pass

try:
    from supabase import create_client
except ImportError:
    print("Missing dependency: pip install supabase python-dotenv tqdm")
    sys.exit(1)

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(it, **kw):
        return it

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
BUCKET = 'training-data'


def parse_args():
    p = argparse.ArgumentParser(description='Download Flowen ASR training dataset')
    p.add_argument('--out',          default='./data/flowen-asr', help='Output directory')
    p.add_argument('--limit',        type=int, default=10_000,    help='Max samples to download')
    p.add_argument('--min-duration', type=int, default=5,          help='Min duration in seconds')
    p.add_argument('--stage',        default=None,                 help='Comma-separated stage IDs, e.g. 1,2,3')
    p.add_argument('--dry-run',      action='store_true',          help='Print stats without downloading')
    return p.parse_args()


def main():
    args = parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    out_dir = Path(args.out)
    audio_dir = out_dir / 'audio'
    if not args.dry_run:
        audio_dir.mkdir(parents=True, exist_ok=True)

    # ── Fetch sample metadata ─────────────────────────────────────────────────
    print("Fetching sample metadata…")

    query = (
        sb.table('training_samples')
        .select('id,session_id,user_id,storage_path,format,duration_seconds,stage_id,transcript,disfluency_events,created_at')
        .gte('duration_seconds', args.min_duration)
        .order('created_at', desc=False)
        .limit(args.limit)
    )

    if args.stage:
        stage_ids = [int(s.strip()) for s in args.stage.split(',')]
        query = query.in_('stage_id', stage_ids)

    resp = query.execute()
    samples = resp.data or []

    total_hours = sum((s.get('duration_seconds') or 0) for s in samples) / 3600
    print(f"  {len(samples)} samples | {total_hours:.2f} hours | min_duration≥{args.min_duration}s")

    if args.dry_run:
        print("Dry run — exiting.")
        return

    # ── Download audio files + write manifest ────────────────────────────────
    manifest_rows = []
    failed = []

    for s in tqdm(samples, desc='Downloading', unit='file'):
        sample_id    = s['id']
        storage_path = s['storage_path']
        filename     = f"{sample_id}.webm"
        local_path   = audio_dir / filename

        if local_path.exists():
            # Already downloaded — skip
            manifest_rows.append(_row(s, filename))
            continue

        try:
            result = sb.storage.from_(BUCKET).download(storage_path)
            local_path.write_bytes(result)
            manifest_rows.append(_row(s, filename))
        except Exception as exc:
            print(f"\n  WARN: failed to download {storage_path}: {exc}")
            failed.append(sample_id)
            time.sleep(0.5)

    # ── Write metadata.csv (HuggingFace AudioFolder format) ──────────────────
    csv_path = out_dir / 'metadata.csv'
    fieldnames = [
        'file_name', 'transcription', 'duration_seconds', 'stage_id',
        'session_id', 'disfluency_events', 'created_at',
    ]
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manifest_rows)

    print(f"\n✓  {len(manifest_rows)} samples written to {out_dir}")
    print(f"   metadata: {csv_path}")
    if failed:
        print(f"   {len(failed)} downloads failed (see above)")

    # ── Write disfluency JSONL for fine-grained analysis ─────────────────────
    jsonl_path = out_dir / 'disfluency_labels.jsonl'
    with open(jsonl_path, 'w', encoding='utf-8') as f:
        for s in samples:
            if s.get('disfluency_events'):
                f.write(json.dumps({
                    'sample_id':  s['id'],
                    'session_id': s['session_id'],
                    'events':     s['disfluency_events'],
                }) + '\n')
    print(f"   disfluency labels: {jsonl_path}")


def _row(s: dict, filename: str) -> dict:
    return {
        'file_name':          f'audio/{filename}',
        'transcription':      (s.get('transcript') or '').replace('\n', ' ').strip(),
        'duration_seconds':   s.get('duration_seconds') or '',
        'stage_id':           s.get('stage_id') or '',
        'session_id':         s.get('session_id') or '',
        'disfluency_events':  json.dumps(s['disfluency_events']) if s.get('disfluency_events') else '',
        'created_at':         s.get('created_at') or '',
    }


if __name__ == '__main__':
    main()
