/**
 * Data-access layer barrel (Task 9). React Query hooks over the typed Supabase
 * client, snake_case <-> camelCase mappers, cache keys, and the query
 * client/provider wiring.
 */
export { queryKeys } from './queryKeys';
export { createAppQueryClient, queryClient } from './queryClient';
export { QueryProvider } from './QueryProvider';

export * from './mappers';

export { useProfile, useUpsertProfile } from './useProfile';
export { useMacroSettings, useUpsertMacroSettings } from './useMacroSettings';
export {
  useProgressEntries,
  useUpsertProgressEntry,
  useDeleteProgressEntry,
} from './useProgressEntries';
export {
  useMacroTargetHistory,
  useAppendMacroTargetHistory,
} from './useMacroTargetHistory';
export {
  useReminderPreferences,
  useUpsertReminderPreferences,
} from './useReminderPreferences';
export { useDeleteAccount } from './useDeleteAccount';

export type {
  ProfileRow,
  ProfileRowWrite,
  MacroSettingsRow,
  MacroSettingsRowWrite,
  ProgressEntryRow,
  ProgressEntryRowWrite,
  MacroTargetHistoryRow,
  MacroTargetHistoryRowWrite,
  ReminderPreferencesRow,
  ReminderPreferencesRowWrite,
} from './dbTypes';
