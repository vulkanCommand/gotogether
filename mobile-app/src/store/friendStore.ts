import { create } from 'zustand';

export type Friend = {
  id: number;
  name: string;
  email: string;
  phone: string;
  username: string;
  home_city: string;
};

type FriendState = {
  friends: Friend[];
  setFriends: (friends: Friend[]) => void;
  clearFriends: () => void;
};

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  setFriends: (friends) => set({ friends }),
  clearFriends: () => set({ friends: [] }),
}));
