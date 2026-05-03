import { CrewMember } from '../store/tripStore';

type ProposalStatusKey = 'confirmed' | 'needs_response' | 'waiting';

export function getMemberProposalMeta(status?: string) {
  const normalized = (status || '').trim() as ProposalStatusKey;

  if (normalized === 'confirmed') {
    return {
      key: 'confirmed' as const,
      label: 'Confirmed',
      tone: 'success' as const,
    };
  }

  if (normalized === 'needs_response') {
    return {
      key: 'needs_response' as const,
      label: 'Needs you',
      tone: 'danger' as const,
    };
  }

  return {
    key: 'waiting' as const,
    label: 'Waiting',
    tone: 'neutral' as const,
  };
}

export function summarizeCrewProgress(crew: CrewMember[]) {
  const totalCount = crew.length;
  const confirmedMembers = crew.filter((member) => member.proposalStatus === 'confirmed');
  const waitingMembers = crew.filter((member) => member.proposalStatus !== 'confirmed');
  const viewerMember = crew.find((member) => member.isViewer) ?? null;
  const pendingNames = waitingMembers
    .filter((member) => !member.isViewer)
    .map((member) => member.name)
    .filter(Boolean);

  return {
    totalCount,
    confirmedCount: confirmedMembers.length,
    waitingCount: waitingMembers.length,
    viewerNeedsResponse: viewerMember?.proposalStatus === 'needs_response',
    pendingNames,
    progressRatio: totalCount > 0 ? confirmedMembers.length / totalCount : 0,
  };
}
