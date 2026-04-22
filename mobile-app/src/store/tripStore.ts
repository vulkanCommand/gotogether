import { create } from 'zustand';

export type CrewMember = {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
};

export type DestinationOption = {
  id: string;
  name: string;
  country?: string;
  emoji?: string;
  accent?: string;
  votes: string[];
};

export type ItineraryEventStatus = 'upcoming' | 'active' | 'completed';

export type ItineraryEvent = {
  id: string;
  title: string;
  time: string;
  location: string;
  attendees: string[];
  notes: string;
  status: ItineraryEventStatus;
};

export type ItineraryDay = {
  id: string;
  title: string;
  dateLabel: string;
  status?: ItineraryEventStatus;
  events: ItineraryEvent[];
};

export type ExpenseSplit = {
  memberId: string;
  memberName: string;
  amount: number;
};

export type ExpenseItem = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  paidByUserId?: number;
  expenseGroupId?: number;
  linkedEventId?: string;
  splitMethod: string;
  notes: string;
  createdAt: string;
  splitPreview: ExpenseSplit[];
};

export type ExpenseGroup = {
  id: number;
  tripId: number;
  name: string;
  createdAt: string;
  expenses: ExpenseItem[];
};

export type CurrentTrip = {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  members_count?: number;
  image_url?: string;
  completed_at?: string;
  viewer_role?: string;
  lead_user_id?: number;
};

type TripStore = {
  currentTrip: CurrentTrip | null;
  crew: CrewMember[];
  selectedDates: string[];
  bestMatchRange: string;
  destinationOptions: DestinationOption[];
  selectedDestinationId: string | null;
  tripLead: CrewMember | null;
  itineraryDays: ItineraryDay[];
  expenses: ExpenseItem[];
  expenseGroups: ExpenseGroup[];

  setCurrentTrip: (trip: CurrentTrip | null) => void;
  setCrew: (crew: CrewMember[]) => void;
  toggleCrewMember: (member: CrewMember) => void;
  clearCrew: () => void;

  setSelectedDates: (dates: string[]) => void;
  toggleSelectedDate: (date: string) => void;
  clearSelectedDates: () => void;
  setBestMatchRange: (range: string) => void;

  setDestinationOptions: (options: DestinationOption[]) => void;
  setSelectedDestinationId: (destinationId: string | null) => void;
  voteDestination: (destinationId: string, memberId: string) => void;
  clearDestinationVotes: () => void;

  setTripLead: (lead: CrewMember | null) => void;

  setItineraryDays: (days: ItineraryDay[]) => void;
  addDay: (day: ItineraryDay) => void;
  updateDay: (dayId: string, updates: Partial<ItineraryDay>) => void;
  removeDay: (dayId: string) => void;
  addEventToDay: (dayId: string, event: ItineraryEvent) => void;
  updateEventInDay: (dayId: string, eventId: string, updates: Partial<ItineraryEvent>) => void;
  removeEventFromDay: (dayId: string, eventId: string) => void;

  setExpenses: (expenses: ExpenseItem[]) => void;
  setExpenseGroups: (groups: ExpenseGroup[]) => void;
  addExpense: (expense: ExpenseItem) => void;
  updateExpense: (expenseId: string, updates: Partial<ExpenseItem>) => void;
  removeExpense: (expenseId: string) => void;
  clearExpenses: () => void;

  selectedDestination: () => DestinationOption | null;
  totalPlans: () => number;
  totalConfirmedPlans: () => number;
  nextUp: () => { day: string; time: string; title: string; meta: string };
  totalExpenseAmount: () => number;

  hydratePlannerDefaults: (payload?: {
    crew?: CrewMember[];
    selectedDates?: string[];
    bestMatchRange?: string;
    destinationOptions?: DestinationOption[];
    selectedDestinationId?: string | null;
    tripLead?: CrewMember | null;
  }) => void;

  resetPlannerState: () => void;
  resetTrip: () => void;
};

const initialPlannerState = {
  crew: [] as CrewMember[],
  selectedDates: [] as string[],
  bestMatchRange: '',
  destinationOptions: [] as DestinationOption[],
  selectedDestinationId: null as string | null,
  tripLead: null as CrewMember | null,
  itineraryDays: [] as ItineraryDay[],
  expenses: [] as ExpenseItem[],
  expenseGroups: [] as ExpenseGroup[],
};

const normalizeUniqueStrings = (values: string[]) => {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
};

const buildDefaultNextUp = () => ({
  day: 'No day yet',
  time: 'TBD',
  title: 'Add your first itinerary event',
  meta: 'Your next plan will appear here',
});

export const useTripStore = create<TripStore>((set, get) => ({
  currentTrip: null,
  ...initialPlannerState,

  setCurrentTrip: (currentTrip) => set({ currentTrip }),

  setCrew: (crew) =>
    set({
      crew: crew.filter(
        (member, index, array) => array.findIndex((item) => item.id === member.id) === index
      ),
    }),

  toggleCrewMember: (member) =>
    set((state) => {
      const exists = state.crew.some((item) => item.id === member.id);
      return {
        crew: exists ? state.crew.filter((item) => item.id !== member.id) : [...state.crew, member],
      };
    }),

  clearCrew: () => set({ crew: [] }),

  setSelectedDates: (selectedDates) => set({ selectedDates: normalizeUniqueStrings(selectedDates) }),

  toggleSelectedDate: (date) =>
    set((state) => {
      const normalized = date.trim();
      if (!normalized) {
        return state;
      }
      const exists = state.selectedDates.includes(normalized);
      return {
        selectedDates: exists
          ? state.selectedDates.filter((item) => item !== normalized)
          : [...state.selectedDates, normalized],
      };
    }),

  clearSelectedDates: () => set({ selectedDates: [] }),
  setBestMatchRange: (bestMatchRange) => set({ bestMatchRange }),

  setDestinationOptions: (destinationOptions) =>
    set({
      destinationOptions: destinationOptions.map((option) => ({
        ...option,
        votes: normalizeUniqueStrings(option.votes ?? []),
      })),
    }),

  setSelectedDestinationId: (selectedDestinationId) => set({ selectedDestinationId }),

  voteDestination: (destinationId, memberId) =>
    set((state) => {
      const normalizedMemberId = memberId.trim();
      if (!normalizedMemberId) {
        return state;
      }

      return {
        destinationOptions: state.destinationOptions.map((option) => {
          const alreadyVotedForThis = option.votes.includes(normalizedMemberId);
          if (option.id === destinationId) {
            return {
              ...option,
              votes: alreadyVotedForThis
                ? option.votes.filter((id) => id !== normalizedMemberId)
                : [...option.votes, normalizedMemberId],
            };
          }
          return {
            ...option,
            votes: option.votes.filter((id) => id !== normalizedMemberId),
          };
        }),
      };
    }),

  clearDestinationVotes: () =>
    set((state) => ({
      destinationOptions: state.destinationOptions.map((option) => ({ ...option, votes: [] })),
    })),

  setTripLead: (tripLead) => set({ tripLead }),
  setItineraryDays: (itineraryDays) => set({ itineraryDays }),

  addDay: (day) =>
    set((state) => {
      if (state.itineraryDays.some((item) => item.id === day.id)) {
        return state;
      }
      return { itineraryDays: [...state.itineraryDays, day] };
    }),

  updateDay: (dayId, updates) =>
    set((state) => ({
      itineraryDays: state.itineraryDays.map((day) => (day.id === dayId ? { ...day, ...updates } : day)),
    })),

  removeDay: (dayId) =>
    set((state) => ({ itineraryDays: state.itineraryDays.filter((day) => day.id !== dayId) })),

  addEventToDay: (dayId, event) =>
    set((state) => ({
      itineraryDays: state.itineraryDays.map((day) =>
        day.id === dayId ? { ...day, events: [...day.events, event] } : day
      ),
    })),

  updateEventInDay: (dayId, eventId, updates) =>
    set((state) => ({
      itineraryDays: state.itineraryDays.map((day) =>
        day.id === dayId
          ? { ...day, events: day.events.map((event) => (event.id === eventId ? { ...event, ...updates } : event)) }
          : day
      ),
    })),

  removeEventFromDay: (dayId, eventId) =>
    set((state) => ({
      itineraryDays: state.itineraryDays.map((day) =>
        day.id === dayId ? { ...day, events: day.events.filter((event) => event.id !== eventId) } : day
      ),
    })),

  setExpenses: (expenses) => set({ expenses }),
  setExpenseGroups: (expenseGroups) => set({ expenseGroups }),
  addExpense: (expense) => set((state) => ({ expenses: [expense, ...state.expenses] })),
  updateExpense: (expenseId, updates) =>
    set((state) => ({ expenses: state.expenses.map((expense) => (expense.id === expenseId ? { ...expense, ...updates } : expense)) })),
  removeExpense: (expenseId) => set((state) => ({ expenses: state.expenses.filter((expense) => expense.id !== expenseId) })),
  clearExpenses: () => set({ expenses: [] }),

  selectedDestination: () => {
    const { destinationOptions, selectedDestinationId } = get();
    return destinationOptions.find((item) => item.id === selectedDestinationId) ?? null;
  },

  totalPlans: () => get().itineraryDays.reduce((sum, day) => sum + day.events.length, 0),

  totalConfirmedPlans: () =>
    get()
      .itineraryDays.flatMap((day) => day.events)
      .filter((event) => event.attendees.some((attendee) => attendee.toLowerCase().includes('confirmed'))).length,

  nextUp: () => {
    const { itineraryDays } = get();
    for (const day of itineraryDays) {
      const activeEvent = day.events.find((item) => item.status === 'active');
      if (activeEvent) {
        return {
          day: day.title,
          time: activeEvent.time,
          title: activeEvent.title,
          meta: `${activeEvent.location} • ${activeEvent.attendees.join(', ') || 'Crew pending'}`,
        };
      }
      const upcomingEvent = day.events.find((item) => item.status === 'upcoming');
      if (upcomingEvent) {
        return {
          day: day.title,
          time: upcomingEvent.time,
          title: upcomingEvent.title,
          meta: `${upcomingEvent.location} • ${upcomingEvent.attendees.join(', ') || 'Crew pending'}`,
        };
      }
    }
    return buildDefaultNextUp();
  },

  totalExpenseAmount: () => get().expenses.reduce((sum, expense) => sum + expense.amount, 0),

  hydratePlannerDefaults: (payload) =>
    set((state) => ({
      crew: state.crew.length > 0 ? state.crew : payload?.crew ? payload.crew : state.crew,
      selectedDates:
        state.selectedDates.length > 0
          ? state.selectedDates
          : payload?.selectedDates
            ? normalizeUniqueStrings(payload.selectedDates)
            : state.selectedDates,
      bestMatchRange: state.bestMatchRange || payload?.bestMatchRange || state.bestMatchRange,
      destinationOptions:
        state.destinationOptions.length > 0
          ? state.destinationOptions
          : payload?.destinationOptions
            ? payload.destinationOptions.map((option) => ({ ...option, votes: normalizeUniqueStrings(option.votes ?? []) }))
            : state.destinationOptions,
      selectedDestinationId: state.selectedDestinationId ?? payload?.selectedDestinationId ?? state.selectedDestinationId,
      tripLead: state.tripLead ?? payload?.tripLead ?? state.tripLead,
    })),

  resetPlannerState: () => set({ ...initialPlannerState }),
  resetTrip: () => set({ currentTrip: null, ...initialPlannerState }),
}));
