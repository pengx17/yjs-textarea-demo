import React from "react";
import Delta, { Op } from "quill-delta";

interface TextareaProps
  extends Omit<React.HTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  onTextChange?: (delta: Op[] | "undo" | "redo") => void;
  onSelectionChange?: (start: number, end: number) => void;
}

// A custom Textarea component that implements Quill delta operations
export const Textarea = React.forwardRef(
  (props: TextareaProps, ref: React.ForwardedRef<HTMLTextAreaElement>) => {
    const { onTextChange, onSelectionChange, ...rest } = props;
    const innerRef = React.useRef<HTMLTextAreaElement | null>();
    const rangeRef = React.useRef([0, 0]);
    const valueRef = React.useRef("");

    const handleSelectionChange = React.useCallback(() => {
      const input$ = innerRef.current;
      if (!input$) {
        return;
      }
      const { selectionStart, selectionEnd } = input$;
      if (
        rangeRef.current[0] !== selectionStart ||
        rangeRef.current[1] !== selectionEnd
      ) {
        onSelectionChange?.(selectionStart, selectionEnd);
        rangeRef.current = [input$.selectionStart, input$.selectionEnd];
      }
    }, [onSelectionChange]);

    React.useEffect(() => {
      handleSelectionChange();
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => {
        document.removeEventListener("selectionchange", handleSelectionChange);
      };
    }, [handleSelectionChange]);

    React.useEffect(() => {
      if (innerRef?.current) {
        const input$ = innerRef.current;
        valueRef.current = input$.value;
        const listener = (e: InputEvent) => {
          const inputType = e.inputType;
          // input event is earlier than selectionchange, so this oldRange is reliable
          const oldRange = rangeRef.current;
          const oldValue = valueRef.current;
          const newValue = input$.value;
          const newRange = [input$.selectionStart, input$.selectionEnd];
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
              delta
                .retain(newRange[0])
                .delete(oldValue.length - newValue.length);
            } else {
              throw new Error("Unknown inputType: " + inputType);
            }
            onTextChange?.(delta.ops);
            handleSelectionChange();
          }
        };
        // @ts-ignore
        input$.addEventListener("input", listener);
        return () => {
          // @ts-ignore
          input$.removeEventListener("input", listener);
        };
      }
    }, [onTextChange]);

    return (
      <textarea
        ref={(r) => {
          if (!r) {
            return;
          }
          const { set, ...rest } = Reflect.getOwnPropertyDescriptor(
            r,
            "value"
          )!;
          Reflect.defineProperty(r, "value", {
            ...rest,
            set(newValue: string) {
              valueRef.current = newValue;
              set!.call(r, newValue);
            },
          });
          if (typeof ref === "function") {
            ref(r);
          } else if (ref) {
            ref.current = r;
          }
          innerRef.current = r;
        }}
        {...rest}
      />
    );
  }
);
