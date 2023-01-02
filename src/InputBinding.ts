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
  const getRelativePos = (index: number) => {
    return Y.createRelativePositionFromTypeIndex(yText, index, index);
  };
  const getAbsoluteIndex = (yPosRel: Y.RelativePosition) => {
    return Y.createAbsolutePositionFromRelativePosition(yPosRel, yDoc)?.index;
  };
  const yDoc = yText.doc!;
  let oldRange = [0, 0];
  let oldValue = "";

  // relative positions before transactions
  // so that we can restore after update
  let yPosRel0: Y.RelativePosition | null = null;
  let yPosRel1: Y.RelativePosition | null = null;

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

  const beforeTransactionListener = () => {
    if (yPosRel0 || yPosRel1) {
      return
    }
    const range = getRange();
    yPosRel0 = getRelativePos(range[0]);
    yPosRel1 = getRelativePos(range[1]);
  };

  const afterTransactionsListener = () => {
    yPosRel0 = null;
    yPosRel1 = null;
  }

  const updateListener = (_: any, origin: any) => {
    if (origin !== undoManager && origin !== null) {
      inputElement.value = yText.toString();
    }
    if (yPosRel0 && yPosRel1) {
      const range = getRange();
      const newRange = [
        getAbsoluteIndex(yPosRel0) ?? range[0],
        getAbsoluteIndex(yPosRel1) ?? range[1],
      ] as const;
      inputElement.setSelectionRange(newRange[0], newRange[1]);
    }
    setAwarenessCursor();
  };

  yDoc.on("update", updateListener);
  yDoc.on("beforeAllTransactions", beforeTransactionListener);
  yDoc.on("afterAllTransactions", afterTransactionsListener);

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
    yDoc.off("update", updateListener);
    yDoc.off("beforeAllTransactions", beforeTransactionListener);
    yDoc.off("afterAllTransactions", afterTransactionsListener);
  };
}
