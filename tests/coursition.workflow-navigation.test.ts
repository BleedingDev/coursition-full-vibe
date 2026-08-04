import { describe, expect, test } from '@rstest/core';
import type { WorkflowActionIntent } from '../src/features/coursition/workflow-request-coordinator';
import { updateModeWithoutNavigation } from '../src/features/coursition/workflow-navigation';

describe('Coursition workflow navigation authority', () => {
  test('changing the AI mode updates data without changing the current URL', () => {
    const calls: { action: WorkflowActionIntent; shouldNavigate?: boolean }[] = [];

    updateModeWithoutNavigation(
      (action, shouldNavigate) => {
        calls.push({ action, shouldNavigate });
      },
      'draft_123',
      'generate',
    );

    expect(calls).toEqual([
      {
        action: { action: 'setMode', draftId: 'draft_123', mode: 'generate' },
        shouldNavigate: false,
      },
    ]);
  });
});
