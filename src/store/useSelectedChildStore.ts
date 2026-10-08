import { create } from 'zustand';
import { parentService } from '../services/api';
import type { ChildStatus } from '../services/api/parentService';
import { StudentProfile } from '../types';

/**
 * The parent's children + currently-active child, shared across every parent screen — mirrors
 * web's `localStorage.selectedChildId` + `childChanged` window event.
 *
 * Two lists:
 *  - `allChildren`: every child of the parent, whatever the state of its class requests
 *    ("Mes enfants" lists them all, with GET /parents/{id}/enfants/statuts in `statuses`);
 *  - `children`: only the children with at least one APPROVED class — the ones the child selector
 *    (header, chips) offers and the other parent screens work with.
 * When the statuses can't be read (older backend), every child counts as selectable.
 */
interface SelectedChildState {
  /** Parent whose children are loaded — a different account logging in must not inherit them. */
  ownerId: string | null;
  /** Selectable children (at least one approved class). */
  children: StudentProfile[];
  /** Every child of the parent. */
  allChildren: StudentProfile[];
  /** Per-child class request states, null when not loaded / unavailable. */
  statuses: ChildStatus[] | null;
  /** Load error of the statuses (Mes enfants shows it with a retry). */
  statusesError: string;
  loading: boolean;
  loaded: boolean;
  selectedChildId: string | null;
  setSelectedChildId: (id: string | null) => void;
  loadChildren: (parentId: string) => Promise<void>;
}

const hasApprovedClass = (s: ChildStatus) => s.classes.some((c) => String(c.statut).toUpperCase() === 'APPROUVEE');

/** True when at least one child of the parent has an approved class (statuses loaded). */
export const statusesHaveApprovedChild = (statuses: ChildStatus[] | null) => !!statuses && statuses.some(hasApprovedClass);

export const useSelectedChildStore = create<SelectedChildState>((set, get) => ({
  ownerId: null,
  children: [],
  allChildren: [],
  statuses: null,
  statusesError: '',
  loading: false,
  loaded: false,
  selectedChildId: null,
  setSelectedChildId: (selectedChildId) => set({ selectedChildId }),
  loadChildren: async (parentId: string) => {
    if (get().ownerId !== parentId) {
      set({ ownerId: parentId, children: [], allChildren: [], statuses: null, statusesError: '', loaded: false, selectedChildId: null });
    }
    set({ loading: true });
    const [listRes, statusRes] = await Promise.allSettled([
      parentService.getChildren(parentId),
      parentService.getChildrenStatuses(parentId),
    ]);
    if (get().ownerId !== parentId) return; // another account took over meanwhile
    if (listRes.status === 'rejected' && statusRes.status === 'rejected') {
      set({
        loading: false,
        loaded: true,
        statusesError: statusRes.reason instanceof Error ? statusRes.reason.message : String(statusRes.reason ?? ''),
      });
      return;
    }
    const list: StudentProfile[] = listRes.status === 'fulfilled' && Array.isArray(listRes.value) ? listRes.value : [];
    const statuses = statusRes.status === 'fulfilled' ? statusRes.value : null;

    // Every child: the linked profiles, plus any child only known by the statuses endpoint.
    const all: StudentProfile[] = list.map((c) => ({ ...c, id: String(c.id) }));
    statuses?.forEach((st) => {
      if (!all.some((c) => c.id === st.enfantId)) {
        all.push({ id: st.enfantId, prenom: st.prenom ?? undefined, nom: st.nom ?? undefined, niveau: st.niveau ?? undefined });
      }
    });

    // Selectable: an approved class. A child missing from the statuses (legacy link) stays selectable.
    const selectable = statuses
      ? all.filter((c) => {
          const st = statuses.find((x) => x.enfantId === c.id);
          return !st || hasApprovedClass(st);
        })
      : all;

    const current = get().selectedChildId;
    const stillValid = current && selectable.some((c) => c.id === current);
    set({
      allChildren: all,
      children: selectable,
      statuses,
      statusesError:
        statusRes.status === 'rejected' ? (statusRes.reason instanceof Error ? statusRes.reason.message : '') : '',
      loading: false,
      loaded: true,
      selectedChildId: stillValid ? current : selectable[0]?.id ?? null,
    });
  },
}));
