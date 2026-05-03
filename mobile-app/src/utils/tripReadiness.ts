import { ApiTrip } from '../config/api';

type TripReadinessKey = 'completed' | 'needs_your_response' | 'waiting_on_crew' | 'ready';

export type TripReadinessMeta = {
  key: TripReadinessKey;
  label: string;
  tone: 'neutral' | 'accent' | 'success' | 'danger';
  support: string;
  homeActionLabel: string;
};

function pluralizeFriends(count: number) {
  return `${count} friend${count === 1 ? '' : 's'}`;
}

export function getTripReadinessMeta(trip: Pick<ApiTrip, 'completed_at' | 'readiness_status' | 'setup_pending_count'>): TripReadinessMeta {
  const pendingCount = Math.max(0, Number(trip.setup_pending_count ?? 0));
  const readiness = (trip.readiness_status || '').trim() as TripReadinessKey;

  if (trip.completed_at || readiness === 'completed') {
    return {
      key: 'completed',
      label: 'Completed',
      tone: 'neutral',
      support: 'This trip is wrapped and saved for reference.',
      homeActionLabel: 'Review recap',
    };
  }

  if (readiness === 'waiting_on_crew') {
    return {
      key: 'waiting_on_crew',
      label: pendingCount > 0 ? `Waiting on ${pluralizeFriends(pendingCount)}` : 'Waiting on crew',
      tone: 'accent',
      support: pendingCount > 0 ? `${pluralizeFriends(pendingCount)} still need to confirm the proposal.` : 'The crew is still confirming the proposal.',
      homeActionLabel: 'Review proposal',
    };
  }

  if (readiness === 'ready') {
    return {
      key: 'ready',
      label: 'Ready to go',
      tone: 'success',
      support: 'Everyone has confirmed, so the trip is ready to plan and use.',
      homeActionLabel: 'Open trip',
    };
  }

  return {
    key: 'needs_your_response',
    label: 'Needs your response',
    tone: 'danger',
    support: 'You still need to confirm your dates and trip lead vote.',
    homeActionLabel: 'Finish setup',
  };
}
