import type { QueryClient } from '@tanstack/react-query';
import type { OnboardingStep } from '@/hooks/useSellerOnboardingProgress';

export interface OnboardingProgressData {
  steps: OnboardingStep[];
  allRequiredComplete: boolean;
}

/**
 * Returns the route of the first REQUIRED step that is still incomplete,
 * ignoring the step the user just finished. Returns null when everything
 * required is done (caller should then show the celebration).
 */
export function firstIncompleteRoute(
  steps: OnboardingStep[] | undefined,
  justCompletedStepId?: string,
): string | null {
  if (!steps) return null;
  const next = steps.find(
    (s) => s.required && !s.completed && s.id !== justCompletedStepId,
  );
  return next?.route ?? null;
}

/**
 * Refetches the onboarding progress from the DB and resolves where the user
 * should go next: the first incomplete required step, or the checklist with
 * the celebration flag when nothing required is left.
 */
export async function resolveNextOnboardingRoute(
  queryClient: QueryClient,
  userId: string,
  justCompletedStepId?: string,
): Promise<string> {
  const key = ['seller-onboarding-progress', userId];
  await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
  await queryClient.refetchQueries({ queryKey: key });

  const data = queryClient.getQueryData<OnboardingProgressData | null>(key);
  const route = firstIncompleteRoute(data?.steps, justCompletedStepId);
  return route ?? '/seller-onboarding?celebrate=1';
}
