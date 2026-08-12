/**
 * React Query hooks for the `macro_target_history` table (append-only audit
 * log of macro TARGETS, not consumed food). Scoped to the authenticated
 * caller; RLS is authoritative and grants no update policy, so history rows
 * can never be overwritten (R13.1, R13.5).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  MacroTargetHistoryInsert,
  MacroTargetHistoryRecord,
} from '../types';
import { supabase } from '../lib/supabase';
import type { MacroTargetHistoryRow } from './dbTypes';
import {
  mapMacroTargetHistoryRow,
  toMacroTargetHistoryRowWrite,
} from './mappers';
import { queryKeys } from './queryKeys';

/**
 * Fetch the caller's macro-target history, most recent first (the order the
 * history list renders in).
 */
export function useMacroTargetHistory(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.macroTargetHistory(userId ?? 'anonymous'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<MacroTargetHistoryRecord[]> => {
      const { data, error } = await supabase
        .from('macro_target_history')
        .select('*')
        .eq('user_id', userId as string)
        .order('effective_date', { ascending: false });
      if (error) {
        throw error;
      }
      return ((data ?? []) as MacroTargetHistoryRow[]).map(
        mapMacroTargetHistoryRow,
      );
    },
  });
}

/**
 * Append a single macro-target-history row. This is INSERT-ONLY by design:
 * there is no update path, mirroring the append-only RLS policy. Prior rows are
 * never touched (R13.1).
 */
export function useAppendMacroTargetHistory(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      insert: MacroTargetHistoryInsert,
    ): Promise<MacroTargetHistoryRecord> => {
      const { data, error } = await supabase
        .from('macro_target_history')
        .insert(toMacroTargetHistoryRowWrite(insert))
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return mapMacroTargetHistoryRow(data as MacroTargetHistoryRow);
    },
    onSuccess: () => {
      if (userId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.macroTargetHistory(userId),
        });
      }
    },
  });
}
