/**
 * React Query hooks for the `macro_settings` table (multipliers, defaults
 * 16.8 / 1.0 / 0.4). Scoped to the authenticated caller via `user_id`; RLS is
 * authoritative.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MacroSettingsRecord, MacroSettingsWrite } from '../types';
import { supabase } from '../lib/supabase';
import type { MacroSettingsRow } from './dbTypes';
import { mapMacroSettingsRow, toMacroSettingsRowWrite } from './mappers';
import { queryKeys } from './queryKeys';

/** Fetch the caller's macro settings (null when none exist yet). */
export function useMacroSettings(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.macroSettings(userId ?? 'anonymous'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<MacroSettingsRecord | null> => {
      const { data, error } = await supabase
        .from('macro_settings')
        .select('*')
        .eq('user_id', userId as string)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data ? mapMacroSettingsRow(data as MacroSettingsRow) : null;
    },
  });
}

/**
 * Create or update the caller's macro settings (upsert on the `user_id`
 * primary key). Changing multipliers recalculates macros from the *current*
 * active weight and must never touch baseline, progress, average, or goal
 * (R6.6) — those live on other rows/tables and are untouched here.
 */
export function useUpsertMacroSettings(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      write: MacroSettingsWrite,
    ): Promise<MacroSettingsRecord> => {
      const { data, error } = await supabase
        .from('macro_settings')
        .upsert(toMacroSettingsRowWrite(write), { onConflict: 'user_id' })
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return mapMacroSettingsRow(data as MacroSettingsRow);
    },
    onSuccess: () => {
      if (userId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.macroSettings(userId),
        });
      }
    },
  });
}
