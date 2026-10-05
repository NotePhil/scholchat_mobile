import { create } from 'zustand';
import { parentService } from '../services/api';
import { StudentProfile } from '../types';

/**
 * The parent's children list + currently-active child, shared across every
 * parent screen — mirrors web's `localStorage.selectedChildId` +
 * `childChanged` window event (StudentParentStats.jsx,
 * StudentDevoirsContent.jsx, StudentClassList.jsx,
 * CoursProgrammeManagement.jsx all read/listen for it there). Each mobile
 * parent screen used to fetch its own children list AND keep its own local
 * `selectedChildId` useState, so switching the child on one tab had zero
 * effect on the others, and the list was fetched up to 5 times per visit.
 */
interface SelectedChildState {
  /** Parent whose children are loaded — a different account logging in must not inherit them. */
  ownerId: string | null;
  children: StudentProfile[];
  loading: boolean;
  loaded: boolean;
  selectedChildId: string | null;
  setSelectedChildId: (id: string | null) => void;
  loadChildren: (parentId: string) => Promise<void>;
}

export const useSelectedChildStore = create<SelectedChildState>((set, get) => ({
  ownerId: null,
  children: [],
  loading: false,
  loaded: false,
  selectedChildId: null,
  setSelectedChildId: (selectedChildId) => set({ selectedChildId }),
  loadChildren: async (parentId: string) => {
    if (get().ownerId !== parentId) {
      set({ ownerId: parentId, children: [], loaded: false, selectedChildId: null });
    }
    set({ loading: true });
    try {
      const data = await parentService.getChildren(parentId);
      if (get().ownerId !== parentId) return; // another account took over meanwhile
      const current = get().selectedChildId;
      const stillValid = current && data.some((c) => c.id === current);
      set({
        children: data,
        loading: false,
        loaded: true,
        selectedChildId: stillValid ? current : data[0]?.id ?? null,
      });
    } catch {
      if (get().ownerId === parentId) set({ loading: false, loaded: true });
    }
  },
}));
