/**
 * React Query hooks for the `reminder_preferences` table (optional "Body
 * Composition Check-In" reminders — R16). Scoped to the authenticated caller
 * via `user_id`; RLS (`auth.uid() = user_id`) is authoritative.
 *
 * Reminders are OFF by default: when no row exists yet the query resolves to
 * `null` and the UI treats that as disabled (R16.1). Enabling requires explicit
 * user opt-in PLUS notification permission — that gating lives in the UI; this
 * hook only persists the resulting preference. There is deliberately no
 * notification backend here (R16.4).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ReminderPreferences,
  ReminderPreferencesWrite,
} from '../types';
import { supabase } from '../lib/supabase';
import type { ReminderPreferencesRow } from './dbTypes';
import {
  mapReminderPreferencesRow,
  toReminderPreferencesRowWrite,
} from './mappers';
import { queryKeys } from './queryKeys';

/** Fetch the caller's reminder preferences (null when none exist — OFF). */
export function useReminderPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reminderPreferences(userId ?? 'anonymous'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ReminderPreferences | null> => {
      const { data, error } = await supabase
        .from('reminder_preferences')
        .select('*')
        .eq('user_id', userId as string)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data
        ? mapReminderPreferencesRow(data as ReminderPreferencesRow)
        : null;
    },
  });
}

/**
 * Create or update the caller's reminder preferences (upsert on the `user_id`
 * primary key). Persists only the reminder opt-in flag and the human-readable
 * check-in schedule — nothing else.
 */
export function useUpsertReminderPreferences(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      write: ReminderPreferencesWrite,
    ): Promise<ReminderPreferences> => {
      const { data, error } = await supabase
        .from('reminder_preferences')
        .upsert(toReminderPreferencesRowWrite(write), {
          onConflict: 'user_id',
        })
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return mapReminderPreferencesRow(data as ReminderPreferencesRow);
    },
    onSuccess: () => {
      if (userId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.reminderPreferences(userId),
        });
      }
    },
  });
}
