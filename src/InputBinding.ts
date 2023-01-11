import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness.js";
import { UserInfo } from "./types";

export function createInputBinding(
  yText: Y.Text,
  undoManager: Y.UndoManager,
  awareness: awarenessProtocol.Awareness,
  // todo: support contenteditable?
  inputElement: HTMLInputElement | HTMLTextAreaElement
) {
  inputElement.value = yText.toString();
  const getRange = () =>
    [inputElement.selectionStart, inputElement.selectionEnd] as [
      number,
      number
    ];
  const getElValue = (): string => {
    return inputElement.value ?? "";
  };
  const toRelative = (index: number) => {
    return Y.createRelativePositionFromTypeIndex(yText, index);
  };
  const toAbsolute = (yPosRel?: Y.RelativePosition) => {
    const absPos = yPosRel
      ? Y.createAbsolutePositionFromRelativePosition(yPosRel, yDoc)
      : null;
    return absPos?.index ?? -1;
  };
  const yDoc = yText.doc!;

  const resetLocalAwarenessCursor = () => {
    const [s, e] = getRange();
    awareness.setLocalStateField("cursor", {
      anchor: toRelative(s ?? 0),
      focus: toRelative(e ?? 0),
    });
  };

  const inputListener = (event: InputEvent) => {
    const newValue = getElValue();
    const newRange = getRange();
    const inputType = event.inputType;
    const cursor: UserInfo["cursor"] = awareness.getLocalState()?.cursor;
    const oldRange = [toAbsolute(cursor?.anchor), toAbsolute(cursor?.focus)];
    const oldValue = yText.toString();
    // see https://rawgit.com/w3c/input-events/v1/index.html#interface-InputEvent-Attributes
    if (inputType.startsWith("insert")) {
      yDoc.transact(() => {
        if (oldRange[0] !== oldRange[1]) {
          yText.delete(oldRange[0], oldRange[1] - oldRange[0]);
        }
        yText.insert(oldRange[0], newValue.substring(oldRange[0], newRange[0]));
      });
    } else if (inputType.startsWith("delete")) {
      yDoc.transact(() => {
        yText.delete(newRange[0], oldValue.length - newValue.length);
      });
    } else if (inputType.startsWith("history")) {
      if (inputType.endsWith("Undo")) {
        undoManager.undo();
      } else {
        undoManager.redo();
      }
    }
    inputElement.value = yText.toString();
    inputElement.setSelectionRange(newRange[0], newRange[1]);
  };

  const updateListener = (_: any, origin: any) => {
    if (origin !== undoManager && origin !== null) {
      inputElement.value = yText.toString();
    }
    const cursor: UserInfo["cursor"] = awareness.getLocalState()?.cursor;
    const yPosRel0 = cursor?.anchor;
    const yPosRel1 = cursor?.focus;
    if (yPosRel0 && yPosRel1) {
      const newRange = [toAbsolute(yPosRel0), toAbsolute(yPosRel1)] as const;
      inputElement.setSelectionRange(newRange[0], newRange[1]);
    }
    resetLocalAwarenessCursor();
  };

  yDoc.on("update", updateListener);

  resetLocalAwarenessCursor();

  // @ts-ignore
  inputElement.addEventListener("input", inputListener);
  document.addEventListener("selectionchange", resetLocalAwarenessCursor);
  return () => {
    // @ts-ignore
    inputElement.removeEventListener("input", inputListener);
    document.removeEventListener("selectionchange", resetLocalAwarenessCursor);
    yDoc.off("update", updateListener);
  };
}
