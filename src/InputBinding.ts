import * as Y from 'yjs';

export function createInputBinding(
  yText: Y.Text,
  undoManager: Y.UndoManager,
  // todo: support contenteditable?
  inputElment: HTMLInputElement | HTMLTextAreaElement
) {
  inputElment.value = yText.toString();
  const getRange = () =>
    [inputElment.selectionStart, inputElment.selectionEnd] as [number, number];
  const getElValue = (): string => {
    return inputElment.value ?? '';
  };
  const yDoc = yText.doc!;
  let oldRange = [0, 0];
  let oldValue = '';

  const kdListener = (_event: KeyboardEvent) => {
    oldRange = getRange();
    oldValue = getElValue();
  };

  const inputListener = (event: InputEvent) => {
    const newValue = getElValue();
    const newRange = getRange();
    const inputType = event.inputType;
    // see https://rawgit.com/w3c/input-events/v1/index.html#interface-InputEvent-Attributes
    if (inputType.startsWith('insert')) {
      yDoc.transact(() => {
        if (oldRange[0] !== oldRange[1]) {
          yText.delete(oldRange[0], oldRange[1] - oldRange[0]);
        }
        yText.insert(oldRange[0], newValue.substring(oldRange[0], newRange[0]));
      });
    } else if (inputType.startsWith('delete')) {
      yDoc.transact(() => {
        yText.delete(newRange[0], oldValue.length - newValue.length);
      });
    } else if (inputType.startsWith('history')) {
      if (inputType.endsWith('Undo')) {
        undoManager.undo();
      } else {
        undoManager.redo();
      }
    }
    inputElment.value = yText.toString();
    inputElment.setSelectionRange(newRange[0], newRange[1]);
  };

  const updateListener = (e: any, origin: any) => {
    if (origin !== undoManager && origin !== null) {
      const range = getRange();
      Y.applyUpdate(yDoc, e);
      inputElment.value = yText.toString();
      inputElment.setSelectionRange(range[0], range[1]);
    }
  };

  yDoc.on('update', updateListener);

  // @ts-ignore
  inputElment.addEventListener('keydown', kdListener);
  // @ts-ignore
  inputElment.addEventListener('input', inputListener);
  return () => {
    // @ts-ignore
    inputElment.removeEventListener('keydown', kdListener);
    // @ts-ignore
    inputElment.removeEventListener('input', inputListener);
    yText.doc?.off('update', updateListener);
  };
}
