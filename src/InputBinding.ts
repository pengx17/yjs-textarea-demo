import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness.js";

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
  const yDoc = yText.doc!;
  let oldRange = [0, 0];
  let oldValue = "";

  const kdListener = (_event: KeyboardEvent) => {
    oldRange = getRange();
    oldValue = getElValue();
  };

  const setAwarenessCursor = () => {
    awareness.setLocalStateField("cursor", getRange()[0] ?? 0);
  };

  const inputListener = (event: InputEvent) => {
    const newValue = getElValue();
    const newRange = getRange();
    const inputType = event.inputType;
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

  const updateListener = (e: any, origin: any) => {
    if (origin !== undoManager && origin !== null) {
      const range = getRange();
      Y.applyUpdate(yDoc, e);
      inputElement.value = yText.toString();
      inputElement.setSelectionRange(range[0], range[1]);
    }
    setAwarenessCursor();
  };

  yDoc.on("update", updateListener);

  setAwarenessCursor();

  // @ts-ignore
  inputElement.addEventListener("keydown", kdListener);
  // @ts-ignore
  inputElement.addEventListener("input", inputListener);
  document.addEventListener("selectionchange", setAwarenessCursor);
  return () => {
    // @ts-ignore
    inputElement.removeEventListener("keydown", kdListener);
    // @ts-ignore
    inputElement.removeEventListener("input", inputListener);
    document.removeEventListener("selectionchange", setAwarenessCursor);
    yText.doc?.off("update", updateListener);
  };
}
