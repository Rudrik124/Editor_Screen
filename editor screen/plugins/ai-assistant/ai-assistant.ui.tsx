import React, { useState, useRef, useEffect } from "react";
import {
  Sparkle,
  PaperPlaneRight,
  X,
  Lightning,
  ArrowCounterClockwise,
  CircleNotch,
  Play,
  ListChecks,
} from "@phosphor-icons/react";
import { useEditorStore } from "../../store/editor.store";
import { useCreditStore } from "../../store/credit.store";
import { sendPromptToAssistant, ChatHistoryMessage } from "./ai-assistant.processor";
import { EditorCommand } from "../../types/command.types";
import { CaptionProcessor } from "../caption/caption.processor";
import "./ai-assistant.ui.css";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  planSteps?: string[];
  requiresConfirmation?: boolean;
  commands?: EditorCommand[];
  isApplied?: boolean;
}

export const AIAssistantPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hi! I am Veytrix AI, your video editing copilot. I can plan complex edits, split clips, apply transitions, color grade, or answer any video production and programming questions. What are we creating today?",
    },
  ]);
  const [lastBatchCommands, setLastBatchCommands] = useState<EditorCommand[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Zustand Store selectors
  const duration = useEditorStore((s) => s.duration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const dispatch = useEditorStore((s) => s.dispatch);
  const undo = useEditorStore((s) => s.undo);

  // Credit Store selectors
  const creditBalance = useCreditStore((s) => s.balance);
  const fetchBalance = useCreditStore((s) => s.fetchBalance);
  const setBalance = useCreditStore((s) => s.setBalance);
  const decrementOptimistic = useCreditStore((s) => s.decrementOptimistic);
  const openUpgradeModal = useCreditStore((s) => s.openUpgradeModal);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages, isOpen]);

  const executeCommandList = async (commands: EditorCommand[]) => {
    for (const cmd of commands) {
      if ((cmd as any).type === "AUTO_TRANSCRIBE_CAPTIONS") {
        try {
          const payload = cmd.payload as any;
          await CaptionProcessor.autoTranscribe(payload?.clipId, payload?.language);
        } catch (err) {
          console.warn("AI Auto-transcribe error:", err);
        }
      } else {
        dispatch(cmd);
      }
    }
    setLastBatchCommands(commands);
  };

  const handleSend = async () => {
    const trimmed = inputPrompt.trim();
    if (!trimmed || isProcessing) return;

    if (creditBalance <= 0) {
      openUpgradeModal();
      return;
    }

    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, sender: "user", text: trimmed }]);
    setInputPrompt("");
    setIsProcessing(true);
    decrementOptimistic();

    try {
      const manifest = {
        duration,
        currentTime,
        aspectRatio,
        selectedClipId,
        tracks,
        clips,
      };

      // Extract conversation history for multi-turn context
      const history: ChatHistoryMessage[] = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }));

      const result = await sendPromptToAssistant(trimmed, manifest, history);
      setBalance(result.remaining_credits);

      const hasCommands = result.commands && result.commands.length > 0;
      const requiresConfirmation = Boolean(result.requiresConfirmation && hasCommands);

      // If it doesn't require confirmation, apply immediately
      if (hasCommands && !requiresConfirmation) {
        executeCommandList(result.commands);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          text: result.responseText || result.message || "Done!",
          planSteps: result.planSteps,
          requiresConfirmation,
          commands: result.commands,
          isApplied: hasCommands && !requiresConfirmation,
        },
      ]);
    } catch (err: any) {
      if (err.message?.includes("INSUFFICIENT_CREDITS")) {
        openUpgradeModal();
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: "assistant",
            text: `Error: ${err.message || "Failed to process request."}`,
          },
        ]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyPlan = (msgId: string, commands: EditorCommand[]) => {
    executeCommandList(commands);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isApplied: true, requiresConfirmation: false } : m))
    );
  };

  const handleUndoAIBatch = () => {
    if (lastBatchCommands.length === 0) return;
    for (let i = 0; i < lastBatchCommands.length; i++) {
      undo();
    }
    setLastBatchCommands([]);
    setMessages((prev) => [
      ...prev,
      {
        id: `undo-${Date.now()}`,
        sender: "assistant",
        text: "Reverted last AI edit batch.",
      },
    ]);
  };

  // Helper to render code blocks or formatted text
  const renderMessageContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3).trim().split("\n");
        const code = lines.slice(lines[0].match(/^[a-zA-Z0-9_-]+$/) ? 1 : 0).join("\n");
        return (
          <pre key={index} className="ai-code-block">
            <code>{code}</code>
          </pre>
        );
      }
      return (
        <span key={index} className="ai-text-content">
          {part}
        </span>
      );
    });
  };

  return (
    <>
      {!isOpen && (
        <button
          className="ai-toggle-fab"
          onClick={() => setIsOpen(true)}
          title="Open Veytrix AI Assistant"
        >
          <Sparkle size={18} weight="fill" />
          <span>AI Copilot</span>
        </button>
      )}

      {isOpen && (
        <div className="veytrix-ai-panel">
          <div className="ai-panel-header">
            <div className="ai-header-title">
              <Sparkle size={16} weight="fill" className="text-cyan-400" />
              <span>Veytrix AI Copilot</span>
              <div
                className="ai-credits-badge cursor-pointer"
                onClick={openUpgradeModal}
                title="Click to view or upgrade credits"
              >
                <Lightning size={12} weight="fill" />
                <span>{creditBalance} credits</span>
              </div>
            </div>
            <div className="ai-header-actions">
              <button
                className="ai-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="ai-chat-body">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`ai-msg ${m.sender === "user" ? "ai-msg-user" : "ai-msg-assistant"}`}
              >
                <div>{renderMessageContent(m.text)}</div>

                {/* Structured Plan Card for multi-step batches */}
                {m.planSteps && m.planSteps.length > 0 && (
                  <div className="ai-plan-card">
                    <div className="ai-plan-title">
                      <ListChecks size={14} weight="bold" />
                      <span>Editing Plan ({m.planSteps.length} steps)</span>
                    </div>
                    {m.planSteps.map((step, idx) => (
                      <div key={idx} className="ai-plan-step">
                        <span className="ai-plan-step-num">{idx + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}

                    {m.requiresConfirmation && !m.isApplied && m.commands && (
                      <button
                        className="ai-apply-plan-btn"
                        onClick={() => handleApplyPlan(m.id, m.commands!)}
                      >
                        <Play size={13} weight="fill" />
                        <span>Apply Plan ({m.commands.length} edits)</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Applied Commands badges */}
                {m.isApplied && m.commands && m.commands.length > 0 && (
                  <div className="ai-commands-container">
                    {m.commands.map((cmd) => (
                      <span key={cmd.id} className="ai-command-tag">
                        ✓ {cmd.type}
                      </span>
                    ))}
                    <div>
                      <button
                        className="ai-undo-batch-btn"
                        onClick={handleUndoAIBatch}
                        title="Revert these edits"
                      >
                        <ArrowCounterClockwise size={12} />
                        <span>Undo AI Changes</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="ai-msg ai-msg-assistant flex items-center gap-2 text-gray-400">
                <CircleNotch size={14} className="animate-spin" />
                <span>Thinking & drafting plan...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="ai-input-area">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              className="ai-text-input"
              placeholder="e.g. Split into 5 clips and add transitions..."
              value={inputPrompt}
              disabled={isProcessing}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              className="ai-send-btn"
              disabled={isProcessing || !inputPrompt.trim()}
              onClick={handleSend}
            >
              <PaperPlaneRight size={15} weight="bold" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
