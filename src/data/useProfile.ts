/**
 * React Query hooks for the `profiles` table (Concept A baseline, Concept D
 * persisted active weight, Concept E goal — all distinct columns on one row).
 *
 * All access is scoped to the authenticated caller: reads filter by
 * `user_id = userId` and writes carry `user_id`; Supabase RLS
 * (`auth.uid() = user_id`) is the authoritative enforcement. Passing `userId`
 * keeps cache keys per-user and disables queries until a session exists.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile, ProfileWrite } from '../types';
import { supabase } from '../lib/supabase';
import type { ProfileRow } from './dbTypes';
import { mapProfileRow, toProfileRowWrite } from './mappers';
import { queryKeys } from './queryKeys';

/** Fetch the caller's profile row (null when none exists yet). */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(userId ?? 'anonymous'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId as string)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data ? mapProfileRow(data as ProfileRow) : null;
    },
  });
}

/**
 * Create or update the caller's profile. Uses upsert on the `user_id` primary
 * key so onboarding (insert) and later edits (update) share one path. Baseline
 * weight only changes here through a deliberate write — it is never
 * auto-overwritten by progress logging (R4.8).
 */
export function useUpsertProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (write: ProfileWrite): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(toProfileRowWrite(write), { onConflict: 'user_id' })
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return mapProfileRow(data as ProfileRow);
    },
    onSuccess: () => {
      if (userId) {
        void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      }
    },
  });
}
