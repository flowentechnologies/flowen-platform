#!/usr/bin/env node
/**
 * Flowen Self-Healing Diagnostic Agent
 *
 * Watches diagnostics/heal-queue/ for trigger files written by
 * src/app/api/infra/error-boundary/route.ts.
 *
 * Repair loop for each trigger:
 *  1. Read the failing source file
 *  2. Send error context + source to Claude Sonnet with prompt caching
 *  3. Apply the corrected file
 *  4. Run `tsc --noEmit` to verify
 *  5. If OK → git commit + Slack notification
 *  6. If NOT OK → restore original + Slack notification
 *
 * Safety constraints:
 *  - SELF_HEAL_ENABLED=true must be set (double-checked here)
 *  - Only repairs files under src/ — no scripts, configs, or migrations
 *  - Never executes code from Claude's response — only writes file content
 *  - Always backs up the original before applying any change
 *  - Commits only after TypeScript verification passes
 *
 * Run:
 *   SELF_HEAL_ENABLED=true node scripts/infra/self-heal-agent.js
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fs        = require('fs');
const fsp       = require('fs/promises');
const path      = require('path');
const { execSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT        = path.resolve(__dirname, '../..');
const QUEUE_DIR   = path.join(ROOT, 'diagnostics', 'heal-queue');
const BACKUP_DIR  = path.join(ROOT, 'diagnostics', 'heal-backups');
const SLACK_URL   = process.env.SLACK_WEBHOOK_URL ?? '';
const MODEL       = 'claude-sonnet-4-6';
const MAX_TOKENS  = 8192;

// System prompt — sent with cache_control so it's reused across requests.
const SYSTEM_PROMPT = `You are a TypeScript/Next.js expert embedded in an autonomous repair agent.
You receive a runtime error report (message + stack trace) and the current content of the failing source file.
Your task is to return the corrected file content — the complete file, no truncation, no markdown fences, no explanation.
Output ONLY the raw TypeScript/JavaScript source code that fixes the error.
Preserve all existing imports, exports, types, and logic. Make the minimal change required.
If the error cannot be fixed by modifying this file alone, output the original file unchanged.`;

// ── Guard ─────────────────────────────────────────────────────────────────────

if (process.env.SELF_HEAL_ENABLED !== 'true') {
  console.error('[self-heal] SELF_HEAL_ENABLED is not set to "true". Exiting.');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[self-heal] ANTHROPIC_API_KEY is not set. Exiting.');
  process.exit(1);
}

// ── Slack helper ──────────────────────────────────────────────────────────────

async function slack(text) {
  if (!SLACK_URL) return;
  try {
    await fetch(SLACK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
  } catch { /* non-critical */ }
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function gitAdd(filePath) {
  execSync(`git -C "${ROOT}" add "${filePath}"`, { stdio: 'pipe' });
}

function gitCommit(message) {
  execSync(
    `git -C "${ROOT}" commit -m "${message.replace(/"/g, "'")}"`,
    { stdio: 'pipe' },
  );
  return execSync('git -C "${ROOT}" rev-parse --short HEAD', { stdio: 'pipe' })
    .toString()
    .trim();
}

// ── TypeScript verification ───────────────────────────────────────────────────

function verify() {
  try {
    execSync('npx tsc --noEmit --skipLibCheck', {
      cwd:   ROOT,
      stdio: 'pipe',
      timeout: 60_000,
    });
    return { ok: true, errors: '' };
  } catch (e) {
    return { ok: false, errors: (e.stdout ?? e.stderr ?? '').toString().slice(0, 2000) };
  }
}

// ── Anthropic client ──────────────────────────────────────────────────────────

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

async function repairWithClaude(trigger, sourceContent) {
  const userContent =
    `File: ${trigger.file}\n\n` +
    `Error message:\n${trigger.message}\n\n` +
    `Stack trace:\n${(trigger.stack ?? '(none)').slice(0, 3000)}\n\n` +
    `Current file content:\n${sourceContent}`;

  const response = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type:          'text',
        text:          SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },  // cache system prompt across calls
      },
    ],
    messages: [
      { role: 'user', content: userContent },
    ],
  });

  const block = response.content.find(b => b.type === 'text');
  return block?.text ?? null;
}

// ── Repair loop ───────────────────────────────────────────────────────────────

async function processTrigger(triggerPath) {
  let trigger;
  try {
    trigger = JSON.parse(await fsp.readFile(triggerPath, 'utf8'));
  } catch {
    console.warn(`[self-heal] Could not parse trigger: ${triggerPath}`);
    return;
  }

  const { id, message, file } = trigger;
  if (!file || !file.startsWith('src/')) {
    console.log(`[self-heal] Skipping non-src file: ${file}`);
    await fsp.unlink(triggerPath).catch(() => null);
    return;
  }

  const absPath    = path.join(ROOT, file);
  const backupPath = path.join(BACKUP_DIR, `${id}_${path.basename(file)}.bak`);

  // Verify the file actually exists before attempting repair.
  if (!fs.existsSync(absPath)) {
    console.warn(`[self-heal] Source file not found: ${absPath}`);
    await fsp.unlink(triggerPath).catch(() => null);
    return;
  }

  console.log(`[self-heal] Processing ${id} — ${file}`);
  await slack(`🔧 Self-heal attempting fix for \`${file}\` (error ID: ${id})`);

  const original = await fsp.readFile(absPath, 'utf8');

  // Back up the original.
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  await fsp.writeFile(backupPath, original, 'utf8');

  let corrected;
  try {
    corrected = await repairWithClaude(trigger, original);
  } catch (apiErr) {
    console.error(`[self-heal] Claude API error for ${id}:`, apiErr.message);
    await slack(`❌ Self-heal API call failed for \`${file}\`: ${apiErr.message}`);
    await fsp.unlink(triggerPath).catch(() => null);
    return;
  }

  if (!corrected || corrected.trim() === original.trim()) {
    console.log(`[self-heal] No change produced for ${id} — skipping commit`);
    await slack(`ℹ️ Self-heal produced no change for \`${file}\` — manual review required`);
    await fsp.unlink(triggerPath).catch(() => null);
    return;
  }

  // Apply the patch.
  await fsp.writeFile(absPath, corrected, 'utf8');

  // Verify with TypeScript.
  const { ok, errors } = verify();

  if (ok) {
    gitAdd(file);
    const hash = gitCommit(`fix(self-heal): auto-repair ${file} [${id}]`);
    console.log(`[self-heal] ✅ Committed ${hash} for ${id}`);
    await slack(`✅ Self-heal committed \`${hash}\` — \`${file}\` repaired (error ID: ${id})`);
  } else {
    // Restore original.
    await fsp.writeFile(absPath, original, 'utf8');
    console.error(`[self-heal] ❌ Verification failed for ${id} — original restored`);
    await slack(
      `❌ Self-heal verification failed for \`${file}\` — original restored.\n` +
      `TypeScript errors:\n\`\`\`${errors.slice(0, 800)}\`\`\``,
    );
  }

  // Remove processed trigger.
  await fsp.unlink(triggerPath).catch(() => null);
}

// ── Watcher ───────────────────────────────────────────────────────────────────

async function boot() {
  await fsp.mkdir(QUEUE_DIR, { recursive: true });

  // Process any triggers that accumulated before the agent started.
  const existing = (await fsp.readdir(QUEUE_DIR))
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(QUEUE_DIR, f));

  for (const p of existing) {
    await processTrigger(p);
  }

  console.log(`[self-heal] Watching ${QUEUE_DIR}`);

  fs.watch(QUEUE_DIR, { persistent: true }, async (eventType, filename) => {
    if (eventType !== 'rename' || !filename?.endsWith('.json')) return;

    const triggerPath = path.join(QUEUE_DIR, filename);

    // Brief delay to ensure the file write is complete before reading.
    await new Promise(r => setTimeout(r, 200));

    if (!fs.existsSync(triggerPath)) return;  // file was deleted, not created
    await processTrigger(triggerPath);
  });
}

boot().catch(err => {
  console.error('[self-heal] Fatal startup error:', err);
  process.exit(1);
});
