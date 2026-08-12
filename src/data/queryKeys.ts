/**
 * Centralized React Query cache keys. Every server resource is scoped by the
 * authenticated user's id so caches never bleed across accounts and mutations
 * can invalidate precisely.
 */
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  macroSettings: (userId: string) => ['macroSettings', userId] as const,
  progressEntries: (userId: string) => ['progressEntries', userId] as const,
  macroTargetHistory: (userId: string) => ['macroTargetHistory', userId] as const,
  reminderPreferences: (userId: string) =>
    ['reminderPreferences', userId] as const,
} as const;
