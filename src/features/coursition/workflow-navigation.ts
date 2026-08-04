import type { AiMode } from '@shared/coursition/workflow';
import type { WorkflowActionIntent } from './workflow-request-coordinator';

type WorkflowRunner = (action: WorkflowActionIntent, shouldNavigate?: boolean) => void;

export const updateModeWithoutNavigation = (
  runWorkflow: WorkflowRunner,
  draftId: string,
  mode: AiMode,
) => {
  runWorkflow({ action: 'setMode', draftId, mode }, false);
};
