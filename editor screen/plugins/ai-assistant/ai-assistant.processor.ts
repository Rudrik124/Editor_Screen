import { EditorCommand } from "../../types/command.types";
import { TimelineStateManifest } from "./ai-assistant.tools";

const API_BASE = "http://127.0.0.1:8000/api/v1";

export interface ToolCallItem {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantApiResponse {
  success: boolean;
  message: string;
  responseText: string;
  planSteps: string[];
  requiresConfirmation: boolean;
  tool_calls: ToolCallItem[];
  commands: EditorCommand[];
  validation_errors: string[];
  remaining_credits: number;
  model_used: string;
}

export async function sendPromptToAssistant(
  prompt: string,
  timelineState: TimelineStateManifest,
  conversationHistory: ChatHistoryMessage[] = [],
  userId: string = "default_user",
  projectId?: string
): Promise<AssistantApiResponse> {
  const payload = {
    prompt,
    timelineState,
    selectedClipId: timelineState.selectedClipId,
    currentTime: timelineState.currentTime,
    conversationHistory,
    userId,
    projectId,
  };

  const response = await fetch(`${API_BASE}/ai/assistant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 402) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "INSUFFICIENT_CREDITS");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server returned ${response.status}`);
  }

  return response.json();
}

export async function fetchUserCredits(userId: string = "default_user"): Promise<{ balance: number; tier: string }> {
  try {
    const res = await fetch(`${API_BASE}/ai/credits?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return { balance: 50, tier: "free" };
    return res.json();
  } catch {
    return { balance: 50, tier: "free" };
  }
}
