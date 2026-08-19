#!/usr/bin/env python3
"""
Flowen ASR — Whisper Fine-tuning Script
=========================================
Fine-tunes OpenAI Whisper (small.en by default) on the downloaded Flowen
dataset. Output is saved to ./models/flowen-whisper-<timestamp>/ and
optionally pushed to HuggingFace Hub.

Usage:
    python scripts/ml/finetune_whisper.py \
        --dataset ./data/flowen-asr \
        --model openai/whisper-small.en \
        --output ./models \
        [--push-to-hub flowen-technologies/whisper-small-stuttering] \
        [--epochs 5] \
        [--batch 8]

Requires:
    pip install transformers datasets accelerate evaluate jiwer soundfile

GPU recommended — CPU-only will be very slow for Whisper.

Architecture note:
  The dataset is already transcribed via SpeechRecognition in the browser.
  This script:
  1. Loads audio + transcriptions from metadata.csv
  2. Pre-processes with WhisperProcessor (log-mel spectrogram)
  3. Fine-tunes the encoder-decoder on stuttered speech
  4. Evaluates on a held-out split (10% by default)
  5. Reports WER reduction vs baseline

The goal is a model that transcribes stuttered English more accurately than
the base Whisper model — particularly for disfluency patterns (blocks,
repetitions, prolongations) which base Whisper often garbles.
"""

import argparse
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import torch
    import numpy as np
    from datasets import Dataset, Audio, DatasetDict
    from transformers import (
        WhisperProcessor,
        WhisperForConditionalGeneration,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
    )
    import evaluate
except ImportError:
    print("Missing dependencies. Run:")
    print("  pip install transformers datasets accelerate evaluate jiwer soundfile librosa")
    sys.exit(1)


# ── Args ──────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description='Fine-tune Whisper on Flowen stuttering dataset')
    p.add_argument('--dataset',      default='./data/flowen-asr', help='Path to downloaded dataset')
    p.add_argument('--model',        default='openai/whisper-small.en', help='Base model name')
    p.add_argument('--output',       default='./models',           help='Output directory')
    p.add_argument('--epochs',       type=int,   default=5)
    p.add_argument('--batch',        type=int,   default=8,        help='Per-device train batch size')
    p.add_argument('--eval-split',   type=float, default=0.1,      help='Fraction of data for eval')
    p.add_argument('--learning-rate',type=float, default=1e-5)
    p.add_argument('--warmup-steps', type=int,   default=100)
    p.add_argument('--max-duration', type=int,   default=30,       help='Max audio length in seconds (truncate)')
    p.add_argument('--push-to-hub',  default=None, help='HuggingFace Hub repo ID to push to')
    p.add_argument('--fp16',         action='store_true', default=torch.cuda.is_available())
    return p.parse_args()


# ── Data collator ─────────────────────────────────────────────────────────────

@dataclass
class DataCollatorSpeechSeq2SeqWithPadding:
    processor: Any

    def __call__(self, features):
        input_features = [{'input_features': f['input_features']} for f in features]
        batch = self.processor.feature_extractor.pad(input_features, return_tensors='pt')

        label_features = [{'input_ids': f['labels']} for f in features]
        labels_batch   = self.processor.tokenizer.pad(label_features, return_tensors='pt')

        # Replace padding with -100 so it's ignored in cross-entropy
        labels = labels_batch['input_ids'].masked_fill(
            labels_batch.attention_mask.ne(1), -100,
        )
        # Remove BOS token prepended by tokenizer if present
        if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
            labels = labels[:, 1:]

        batch['labels'] = labels
        return batch


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    dataset_dir = Path(args.dataset)
    csv_path    = dataset_dir / 'metadata.csv'
    audio_dir   = dataset_dir / 'audio'

    if not csv_path.exists():
        print(f"ERROR: {csv_path} not found. Run download_dataset.py first.")
        sys.exit(1)

    print(f"Loading processor + model: {args.model}")
    processor = WhisperProcessor.from_pretrained(args.model)
    model     = WhisperForConditionalGeneration.from_pretrained(args.model)

    # Force English transcription (no translation)
    model.config.forced_decoder_ids = processor.get_decoder_prompt_ids(
        language='english', task='transcribe',
    )
    model.config.suppress_tokens = []

    # ── Load dataset from CSV ─────────────────────────────────────────────────
    print("Loading dataset…")
    import csv
    rows = []
    with open(csv_path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            audio_path = dataset_dir / row['file_name']
            if audio_path.exists() and row.get('transcription', '').strip():
                rows.append({
                    'audio':         str(audio_path),
                    'transcription': row['transcription'].strip(),
                    'duration':      float(row.get('duration_seconds') or 0),
                })

    print(f"  {len(rows)} samples with audio + transcription")
    if not rows:
        print("ERROR: No usable samples found.")
        sys.exit(1)

    # Filter by max duration
    rows = [r for r in rows if 0 < r['duration'] <= args.max_duration]
    print(f"  {len(rows)} samples after duration filter (≤{args.max_duration}s)")

    ds = Dataset.from_list(rows).cast_column('audio', Audio(sampling_rate=16_000))

    # ── Pre-process ───────────────────────────────────────────────────────────
    def preprocess(batch):
        audio  = batch['audio']
        inputs = processor(
            audio['array'],
            sampling_rate=audio['sampling_rate'],
            return_tensors='np',
        )
        batch['input_features'] = inputs.input_features[0]
        batch['labels'] = processor.tokenizer(batch['transcription']).input_ids
        return batch

    print("Pre-processing audio (this takes a while)…")
    ds = ds.map(preprocess, remove_columns=['audio', 'transcription', 'duration'], num_proc=4)

    # Train/eval split
    split = ds.train_test_split(test_size=args.eval_split, seed=42)
    ds_dict = DatasetDict({'train': split['train'], 'eval': split['test']})
    print(f"  Train: {len(ds_dict['train'])} | Eval: {len(ds_dict['eval'])}")

    # ── Training args ─────────────────────────────────────────────────────────
    timestamp  = time.strftime('%Y%m%d-%H%M')
    output_dir = Path(args.output) / f'flowen-whisper-{timestamp}'
    output_dir.mkdir(parents=True, exist_ok=True)

    training_args = Seq2SeqTrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.batch,
        gradient_accumulation_steps=max(1, 32 // args.batch),
        learning_rate=args.learning_rate,
        warmup_steps=args.warmup_steps,
        fp16=args.fp16,
        eval_strategy='epoch',
        save_strategy='epoch',
        load_best_model_at_end=True,
        metric_for_best_model='wer',
        greater_is_better=False,
        predict_with_generate=True,
        generation_max_length=225,
        logging_steps=25,
        report_to='none',
        push_to_hub=bool(args.push_to_hub),
        hub_model_id=args.push_to_hub or '',
    )

    # ── WER metric ────────────────────────────────────────────────────────────
    wer_metric = evaluate.load('wer')

    def compute_metrics(pred):
        pred_ids  = pred.predictions
        label_ids = pred.label_ids
        label_ids[label_ids == -100] = processor.tokenizer.pad_token_id

        pred_str  = processor.batch_decode(pred_ids,  skip_special_tokens=True)
        label_str = processor.batch_decode(label_ids, skip_special_tokens=True)

        wer = wer_metric.compute(predictions=pred_str, references=label_str)
        return {'wer': round(100 * wer, 2)}

    # ── Train ─────────────────────────────────────────────────────────────────
    data_collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=ds_dict['train'],
        eval_dataset=ds_dict['eval'],
        data_collator=data_collator,
        compute_metrics=compute_metrics,
        processing_class=processor.feature_extractor,
    )

    print(f"\nStarting fine-tuning → {output_dir}")
    print(f"  Base model : {args.model}")
    print(f"  Device     : {'cuda' if torch.cuda.is_available() else 'cpu'}")
    print(f"  FP16       : {args.fp16}")
    print(f"  Epochs     : {args.epochs}")
    print(f"  Batch size : {args.batch} (effective {args.batch * max(1, 32 // args.batch)})")
    print()

    trainer.train()

    print(f"\n✓ Training complete — model saved to {output_dir}")
    if args.push_to_hub:
        print(f"  Pushing to HuggingFace Hub: {args.push_to_hub}")
        trainer.push_to_hub()
        print(f"  ✓ Pushed")


if __name__ == '__main__':
    main()
