import React from "react";
import { Sparkle, X, CheckCircle, Lightning } from "@phosphor-icons/react";
import { useCreditStore } from "../store/credit.store";

export const UpgradePlanModal: React.FC = () => {
  const isOpen = useCreditStore((s) => s.isUpgradeModalOpen);
  const close = useCreditStore((s) => s.closeUpgradeModal);
  const setBalance = useCreditStore((s) => s.setBalance);

  if (!isOpen) return null;

  const handleUpgradeMock = () => {
    // Upgrades to Pro and grants 1000 credits
    setBalance(1000);
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#16161a] p-6 text-white shadow-2xl">
        <button
          onClick={close}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="mb-4 flex items-center gap-2 text-cyan-400">
          <Lightning size={24} weight="fill" />
          <span className="text-xs font-bold uppercase tracking-wider">AI Credit Quota Reached</span>
        </div>

        <h3 className="text-xl font-bold tracking-tight">Upgrade to Veytrix Pro</h3>
        <p className="mt-2 text-sm text-gray-400">
          You have exhausted your welcome free credits. Unlock continuous video generation and unlimited tool automation.
        </p>

        <div className="my-6 space-y-3 rounded-xl bg-black/40 p-4 border border-white/5">
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle size={18} weight="fill" className="text-emerald-400" />
            <span><strong>1,000 AI Credits</strong> per month</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle size={18} weight="fill" className="text-emerald-400" />
            <span>Full access to all 25 timeline tools & effects</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle size={18} weight="fill" className="text-emerald-400" />
            <span>Zero latency 4K cloud rendering priority</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={close}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10"
          >
            Later
          </button>
          <button
            onClick={handleUpgradeMock}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-cyan-400 hover:to-blue-500"
          >
            <Sparkle size={16} weight="fill" />
            <span>Upgrade ($19/mo)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
