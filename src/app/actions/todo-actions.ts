'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';

/**
 * Server actions behind the manually-tracked half of /admin/todo.
 * The auto-detected half (failing cron jobs, open PRs) has no actions —
 * it's computed live on every page load and needs nothing to resolve it.
 */

export async function toggleActionItem(id: string, done: boolean): Promise<void> {
  const admin = await assertAdmin();

  const { error } = await adminDb()
    .from('admin_action_items')
    .update({
      status:      done ? 'done' : 'open',
      resolved_at: done ? new Date().toISOString() : null,
      resolved_by: done ? (admin.email ?? 'admin') : null,
    })
    .eq('id', id);

  if (error) throw new Error(`Failed to update action item: ${error.message}`);
  revalidatePath('/admin/todo');
}

export async function createActionItem(formData: FormData): Promise<void> {
  await assertAdmin();

  const title       = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const category    = String(formData.get('category') ?? 'general').trim();

  if (!title) throw new Error('Title is required');

  const { error } = await adminDb()
    .from('admin_action_items')
    .insert({ title, description: description || null, category });

  if (error) throw new Error(`Failed to create action item: ${error.message}`);
  revalidatePath('/admin/todo');
}

export async function deleteActionItem(id: string): Promise<void> {
  await assertAdmin();

  const { error } = await adminDb().from('admin_action_items').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete action item: ${error.message}`);
  revalidatePath('/admin/todo');
}
