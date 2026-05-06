import { ApiTrip, ApiTripMember } from '../config/api';
import { CrewMember } from '../store/tripStore';

export const dateValue = (value?: string) => {
  if (!value) {
    return 0;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const formatTripDate = (value?: string) => {
  if (!value) {
    return 'TBD';
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const formatTripRange = (start?: string, end?: string) =>
  `${formatTripDate(start)} - ${formatTripDate(end)}`;

export const tripTimelineStatus = (trip: ApiTrip) => {
  if (trip.completed_at) {
    return 'Completed';
  }
  if (trip.completion_requested) {
    return 'Pending';
  }

  const todayTime = currentDayValue();
  const start = dateValue(trip.start_date);
  const end = dateValue(trip.end_date);

  if (start && start <= todayTime && (!end || end >= todayTime)) {
    return 'Active';
  }
  if (start && start > todayTime) {
    return trip.setup_required ? 'Planning' : 'Upcoming';
  }
  return 'Planning';
};

export const currentDayValue = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

export const isTripActive = (trip: ApiTrip) => {
  if (trip.completed_at) {
    return false;
  }
  const todayTime = currentDayValue();
  const start = dateValue(trip.start_date);
  const end = dateValue(trip.end_date);
  return Boolean(start && start <= todayTime && (!end || end >= todayTime));
};

export const isTripUpcoming = (trip: ApiTrip) => {
  if (trip.completed_at) {
    return false;
  }
  const start = dateValue(trip.start_date);
  return Boolean(start && start > currentDayValue());
};

export const isTripCurrentSection = (trip: ApiTrip) => {
  if (trip.completed_at) {
    return false;
  }
  if (isTripActive(trip)) {
    return true;
  }
  const end = dateValue(trip.end_date);
  return Boolean(end && end < currentDayValue());
};

export const pickPrimaryTrip = (trips: ApiTrip[]) => {
  const active = trips
    .filter((trip) => isTripActive(trip))
    .sort((a, b) => dateValue(a.start_date) - dateValue(b.start_date));
  if (active[0]) {
    return active[0];
  }

  const upcoming = trips
    .filter((trip) => isTripUpcoming(trip))
    .sort((a, b) => dateValue(a.start_date) - dateValue(b.start_date));
  if (upcoming[0]) {
    return upcoming[0];
  }

  return trips
    .filter((trip) => trip.completed_at)
    .sort((a, b) => dateValue(b.end_date) - dateValue(a.end_date))[0] ?? null;
};

export const mapApiMembersToCrew = (members: ApiTripMember[]): CrewMember[] =>
  members.map((member) => ({
    id: String(member.id),
    name: member.name,
    role: member.role,
    availableDates: member.available_dates,
    leadVoteUserId: member.lead_vote_user_id,
    setupCompletedAt: member.setup_completed_at,
    isViewer: member.is_viewer,
    proposalStatus: member.proposal_status,
  }));
