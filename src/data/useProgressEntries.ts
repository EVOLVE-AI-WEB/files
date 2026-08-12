/**
 * React Query hooks for the `progress_entries` table (Concept B — daily
 * morning-weight observations). Scoped to the authenticated caller; RLS is
 * authoritative.
 *
 * Writes upsert against the UNIQUE(user_id, logged_date) constraint so a second
 * submission for a date edits the existing row instead of inserting a duplicate
 * (R10.4). A mutation-in-flight guard (React Query `isPending` + a ref) blocks
 * rapid duplicate submissions (R10.5). Writing an entry NEVER mutates the
 * baseline weight (R10.6); the rolling average is derived on read from the
 * (now invalidated + refetched) entries list (R10.8, R11.6).
 */
import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProgressEntry, ProgressEntryWrite } from '../types';
import { supabase } from '../lib/supabase';
import type { ProgressEntryRow } from './dbTypes';
import { mapProgressEntryRow, toProgressEntryRowWrite } from './mappers';
import { queryKeys } from './queryKeys';

/**
 * Fetch the caller's progress entries in chronological order (oldest first),
 * which is the order the rolling-average and trend-chart selectors expect.
 */
export function useProgressEntries(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.progressEntries(userId ?? 'anonymous'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ProgressEntry[]> => {
      const { data, error } = await supabase
        .from('progress_entries')
        .select('*')
        .eq('user_id', userId as string)
        .order('logged_date', { ascending: true });
      if (error) {
        throw error;
      }
      return ((data ?? []) as ProgressEntryRow[]).map(mapProgressEntryRow);
    },
  });
}

/**
 * Upsert (insert-or-edit) a progress entry for a given date. The conflict
 * target is `(user_id, logged_date)`: an existing date is updated in place,
 * satisfying the duplicate-date edit rule without ever inserting a duplicate.
 *
 * The returned `submit` wrapper enforces the rapid-submit guard: while a write
 * is in flight, further calls are ignored (they resolve to `null`). Consumers
 * should also disable the submit control using the exposed `isPending`.
 */
export function useUpsertProgressEntry(userId: string | undefined) {
  const qc = useQueryClient();
  const inFlight = useRef(false);

  const mutation = useMutation({
    mutationFn: async (write: ProgressEntryWrite): Promise<ProgressEntry> => {
      const { data, error } = await supabase
        .from('progress_entries')
        .upsert(toProgressEntryRowWrite(write), {
          onConflict: 'user_id,logged_date',
        })
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return mapProgressEntryRow(data as ProgressEntryRow);
    },
    onSettled: () => {
      inFlight.current = false;
    },
    onSuccess: () => {
      if (userId) {
        // Recompute derived rolling averages by refetching the entries list.
        void qc.invalidateQueries({
          queryKey: queryKeys.progressEntries(userId),
        });
      }
    },
  });

  const submit = useCallback(
    (write: ProgressEntryWrite): Promise<ProgressEntry | null> => {
      // Rapid-submit guard: drop overlapping submissions of the same entry.
      if (inFlight.current) {
        return Promise.resolve(null);
      }
      inFlight.current = true;
      return mutation.mutateAsync(write);
    },
    [mutation],
  );

  return { ...mutation, submit };
}

/** Delete a progress entry by id; invalidates the list so averages recompute. */
export function useDeleteProgressEntry(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { error } = await supabase
        .from('progress_entries')
        .delete()
        .eq('id', id);
      if (error) {
        throw error;
      }
      return id;
    },
    onSuccess: () => {
      if (userId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.progressEntries(userId),
        });
      }
    },
  });
}
