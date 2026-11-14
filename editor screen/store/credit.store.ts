import { create } from "zustand";
import { fetchUserCredits } from "../plugins/ai-assistant/ai-assistant.processor";

interface CreditState {
  balance: number;
  tier: "free" | "pro";
  isLoading: boolean;
  isUpgradeModalOpen: boolean;
  fetchBalance: (userId?: string) => Promise<void>;
  setBalance: (balance: number) => void;
  decrementOptimistic: () => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
}

export const useCreditStore = create<CreditState>((set) => ({
  balance: 50,
  tier: "free",
  isLoading: false,
  isUpgradeModalOpen: false,

  fetchBalance: async (userId: string = "default_user") => {
    set({ isLoading: true });
    try {
      const data = await fetchUserCredits(userId);
      set({ balance: data.balance, tier: data.tier as "free" | "pro", isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setBalance: (balance: number) => set({ balance }),

  decrementOptimistic: () =>
    set((state) => ({
      balance: Math.max(0, state.balance - 1),
    })),

  openUpgradeModal: () => set({ isUpgradeModalOpen: true }),
  closeUpgradeModal: () => set({ isUpgradeModalOpen: false }),
}));
