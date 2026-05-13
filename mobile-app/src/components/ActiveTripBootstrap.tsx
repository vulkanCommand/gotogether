import { useEffect, useRef } from 'react';

import { fetchTripDetails, fetchTrips } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { readStoredSelectedTripId, useTripStore } from '../store/tripStore';
import { mapApiMembersToCrew, pickPrimaryTrip } from '../utils/tripFlow';

export default function ActiveTripBootstrap() {
  const user = useAuthStore((state) => state.user);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const setCurrentTrip = useTripStore((state) => state.setCurrentTrip);
  const setCrew = useTripStore((state) => state.setCrew);
  const setTripLead = useTripStore((state) => state.setTripLead);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    if (!user?.profile_complete || currentTrip || requestInFlightRef.current) {
      return;
    }

    let cancelled = false;
    requestInFlightRef.current = true;

    const restoreActiveTrip = async () => {
      try {
        const [tripResponse, savedTripId] = await Promise.all([fetchTrips(), readStoredSelectedTripId()]);
        const trips = Array.isArray(tripResponse.trips) ? tripResponse.trips : [];

        if (!trips.length || cancelled || useTripStore.getState().currentTrip) {
          return;
        }

        const candidateTrip =
          (savedTripId ? trips.find((trip) => trip.id === savedTripId) ?? null : null) ?? pickPrimaryTrip(trips);

        if (!candidateTrip) {
          return;
        }

        setCurrentTrip(candidateTrip);

        const details = await fetchTripDetails(candidateTrip.id);

        if (cancelled) {
          return;
        }

        const latestCurrentTrip = useTripStore.getState().currentTrip;

        if (latestCurrentTrip && latestCurrentTrip.id !== candidateTrip.id) {
          return;
        }

        const crew = mapApiMembersToCrew(details.members);
        setCurrentTrip(details.trip);
        setCrew(crew);
        setTripLead(crew.find((member) => member.role === 'lead') ?? crew[0] ?? null);
      } catch (error) {
        console.log('Active trip restore failed', error);
      } finally {
        requestInFlightRef.current = false;
      }
    };

    void restoreActiveTrip();

    return () => {
      cancelled = true;
    };
  }, [currentTrip, setCrew, setCurrentTrip, setTripLead, user?.profile_complete]);

  return null;
}
