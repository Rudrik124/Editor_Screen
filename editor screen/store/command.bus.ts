import { useEditorStore } from "./editor.store";
import { EditorCommand, CommandType } from "../types/command.types";

export type CommandListener = (command: EditorCommand) => void;

class CommandBusService {
  private listeners: Set<CommandListener> = new Set();

  public subscribe(listener: CommandListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispatch(command: EditorCommand): boolean {
    const success = useEditorStore.getState().dispatch(command);
    if (success) {
      this.listeners.forEach((listener) => {
        try {
          listener(command);
        } catch (err) {
          console.error("Command listener error:", err);
        }
      });
    }
    return success;
  }

  public createAndDispatch(
    type: CommandType,
    payload: Record<string, unknown>
  ): boolean {
    const command: EditorCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      timestamp: Date.now(),
    };
    return this.dispatch(command);
  }

  public undo(): boolean {
    return useEditorStore.getState().undo();
  }

  public redo(): boolean {
    return useEditorStore.getState().redo();
  }

  public getHistory(): EditorCommand[] {
    return useEditorStore.getState().history;
  }

  public getFuture(): EditorCommand[] {
    return useEditorStore.getState().future;
  }
}

export const commandBus = new CommandBusService();
