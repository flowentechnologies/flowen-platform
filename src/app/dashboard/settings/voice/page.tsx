import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { VoiceSetupClient } from './VoiceSetupClient';

export const metadata = { title: 'AI Voice Setup — Flowen' };

export default async function VoiceSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('voice_clone_id, voice_clone_name')
    .eq('id', user.id)
    .single();

  return (
    <VoiceSetupClient
      existingVoiceId={profile?.voice_clone_id ?? null}
      existingVoiceName={profile?.voice_clone_name ?? null}
    />
  );
}
