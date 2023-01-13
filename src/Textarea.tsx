import React from "react";
import Delta, { Op } from "quill-delta";

interface TextareaProps
  extends Omit<React.HTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  onTextChange?: (delta: Op[] | "undo" | "redo") => void;
  onSelectionChange?: (start: number, end: number) => void;
}

function bindingTextarea(
  textarea: HTMLTextAreaElement,
  opts: Pick<TextareaProps, "onTextChange" | "onSelectionChange">
) {
  const recoverSetter = hackValueSetter();

  const { onTextChange, onSelectionChange } = opts;

  // set initial values
  let isComposing = false;
  // selection range before the next input event
  let range = [-1, -1];
  // value before the next input event
  let value = textarea.value;

  handleSelectionChange();

  // @ts-ignore
  textarea.addEventListener("input", handleInput);
  document.addEventListener("compositionstart", handleCompositionStart);
  document.addEventListener("compositionend", handleCompositionEnd);
  document.addEventListener("selectionchange", handleSelectionChange);

  // return a cleanup function
  return () => {
    recoverSetter();

    // @ts-ignore
    textarea.removeEventListener("input", handleInput);
    document.removeEventListener("compositionstart", handleCompositionStart);
    document.removeEventListener("compositionend", handleCompositionEnd);
    document.removeEventListener("selectionchange", handleSelectionChange);
  };

  // event handlers
  function handleSelectionChange() {
    if (!textarea || isComposing) {
      return;
    }
    const { selectionStart, selectionEnd } = textarea;
    if (range[0] !== selectionStart || range[1] !== selectionEnd) {
      onSelectionChange?.(selectionStart, selectionEnd);
      range = [textarea.selectionStart, textarea.selectionEnd];
    }
  }

  function handleInput(e: InputEvent) {
    const inputType = e.inputType;
    if (e.isComposing) {
      return; // handle composition events separately
    }
    // input event is earlier than selectionchange, so this oldRange is reliable
    const oldRange = range;
    const oldValue = value;
    const newValue = textarea.value;
    const newRange = [textarea.selectionStart, textarea.selectionEnd];
    if (inputType.startsWith("history")) {
      onTextChange?.(inputType.endsWith("Undo") ? "undo" : "redo");
    } else {
      const delta = new Delta();
      if (inputType.startsWith("insert")) {
        delta.retain(oldRange[0]);
        if (oldRange[0] !== oldRange[1]) {
          delta.delete(oldRange[1] - oldRange[0]);
        }
        delta.insert(newValue.substring(oldRange[0], newRange[0]));
      } else if (inputType.startsWith("delete")) {
        delta.retain(newRange[0]).delete(oldValue.length - newValue.length);
      } else {
        throw new Error("Unknown inputType: " + inputType);
      }
      onTextChange?.(delta.ops);
      handleSelectionChange();
    }
  }

  function handleCompositionStart() {
    isComposing = true;
  }

  function handleCompositionEnd() {
    isComposing = false;
    handleInput({ inputType: "insertText", isComposing: false } as any);
  }

  // hack the textarea's value setter to get the latest value
  function hackValueSetter() {
    const { set, ...rest } = Reflect.getOwnPropertyDescriptor(
      textarea,
      "value"
    )!;
    Reflect.defineProperty(textarea, "value", {
      ...rest,
      set(newValue: string) {
        value = newValue;
        set!.call(textarea, newValue);
      },
    });

    return () => {
      Reflect.defineProperty(textarea, "value", {
        ...rest,
        set,
      });
    };
  }
}

// A custom Textarea component that implements Quill delta operations
export const Textarea = React.forwardRef(
  (props: TextareaProps, ref: React.ForwardedRef<HTMLTextAreaElement>) => {
    const { onTextChange, onSelectionChange, ...rest } = props;
    const innerRef = React.useRef<HTMLTextAreaElement | null>();

    React.useEffect(() => {
      if (!innerRef.current) {
        return;
      }
      return bindingTextarea(innerRef.current, {
        onTextChange,
        onSelectionChange,
      });
    }, [onTextChange, onSelectionChange]);

    return (
      <textarea
        ref={(textarea$) => {
          if (!textarea$) {
            return;
          }
          if (typeof ref === "function") {
            ref(textarea$);
          } else if (ref) {
            ref.current = textarea$;
          }
          innerRef.current = textarea$;
        }}
        {...rest}
      />
    );
  }
);
