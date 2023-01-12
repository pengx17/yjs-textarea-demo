import React from "react";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness.js";
import { Textarea } from "./Textarea";
import { UserInfo } from "./types";
import { Op } from "quill-delta";

const useYTextString = (text?: Y.Text) => {
  const [value, setValue] = React.useState(text?.toString());

  React.useEffect(() => {
    const listener = () => {
      setValue(text?.toString());
    };
    text?.observe(listener);
    if (text) {
      listener();
    }
    return () => {
      text?.unobserve(listener);
    };
  }, [text]);

  return value;
};

const useAwarenessUserInfos = (awareness?: awarenessProtocol.Awareness) => {
  const [userInfos, setUserInfos] = React.useState<UserInfo[]>([]);

  React.useEffect(() => {
    if (!awareness) {
      return;
    }
    const listener = () => {
      setUserInfos(
        [...awareness.getStates()].map(([id, info]: any) => {
          return {
            ...info.user,
            cursor: info.cursor,
            id,
            current: awareness.clientID === id,
          };
        })
      );
    };
    listener();
    awareness.on("change", listener);
    return () => {
      awareness.off("change", listener);
    };
  }, [awareness]);

  return userInfos;
};

const toRelative = (yPosAbs?: number, yText?: Y.Text) => {
  const relPos =
    yPosAbs != null && yText
      ? Y.createRelativePositionFromTypeIndex(yText, yPosAbs)
      : null;
  return relPos ?? null;
};

const toAbsolute = (yPosRel?: Y.RelativePosition, yDoc?: Y.Doc) => {
  const absPos =
    yPosRel && yDoc
      ? Y.createAbsolutePositionFromRelativePosition(yPosRel, yDoc)
      : null;
  return absPos?.index ?? -1;
};

export const YjsTextarea = (props: {
  yText?: Y.Text;
  awareness?: awarenessProtocol.Awareness;
}) => {
  const { yText, awareness } = props;
  const text = useYTextString(yText);
  const userInfos = useAwarenessUserInfos(awareness);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  const undoManager = React.useMemo(() => {
    if (yText) {
      return new Y.UndoManager(yText, {
        captureTimeout: 200,
      });
    }
  }, [yText]);

  const onSelectionChange = React.useCallback(() => {
    if (ref.current && awareness && yText) {
      const s = ref.current.selectionStart;
      const e = ref.current.selectionEnd;
      awareness.setLocalStateField("cursor", {
        anchor: toRelative(s, yText),
        focus: toRelative(e, yText),
      });
    }
  }, [yText, awareness]);

  const onTextChange = React.useCallback(
    (delta: Op[] | "undo" | "redo") => {
      console.log("onTextChange", delta);
      const input$ = ref.current;
      if (yText && undoManager && input$) {
        if (delta === "undo") {
          undoManager.undo();
        } else if (delta === "redo") {
          undoManager.redo();
        } else {
          yText.applyDelta(delta);
        }
        input$.value = yText.toString();
      }
      onSelectionChange();
    },
    [undoManager, yText]
  );

  // handle remote update
  React.useEffect(() => {
    if (yText && yText.doc && ref.current && awareness) {
      const yDoc = yText.doc;
      const input$ = ref.current;
      input$.value = yText.toString();
      const updateListener = (_: any, origin: any) => {
        if (origin !== undoManager && origin !== null) {
          console.log("remote update");
          input$.value = yText.toString();
          const cursor: UserInfo["cursor"] = awareness.getLocalState()?.cursor;
          const yPosRel0 = cursor?.anchor;
          const yPosRel1 = cursor?.focus;
          if (yPosRel0 && yPosRel1) {
            const newRange = [
              toAbsolute(yPosRel0, yDoc),
              toAbsolute(yPosRel1, yDoc),
            ] as const;
            input$.setSelectionRange(newRange[0], newRange[1]);
          }
          onSelectionChange();
        }
      };

      yDoc.on("update", updateListener);

      return () => {
        yDoc.off("update", updateListener);
      };
    }
  }, [yText, undoManager]);

  const renderCursor = React.useCallback(
    (userInfo: UserInfo) => {
      const yDoc = yText?.doc;
      const overlayRect = overlayRef.current?.getBoundingClientRect();
      if (!yDoc || !userInfo.cursor || !overlayRect || userInfo.current) {
        return [];
      }
      const { anchor, focus } = userInfo.cursor;

      const [start, end] = [toAbsolute(anchor, yDoc), toAbsolute(focus, yDoc)];
      let rects = getClientRects(start, end);

      if (start === end && rects.length > 0) {
        rects = [rects.at(-1)!];
      }

      return rects.map((rect, idx) => {
        return (
          <div
            key={userInfo.id + "_" + idx}
            className="user-indicator"
            style={{
              // @ts-ignore
              "--user-color": userInfo.color,
              left: rect.left - overlayRect.left,
              top: rect.top - overlayRect.top,
              width: rect.width,
              height: rect.height,
            }}
          >
            {idx === rects.length - 1 && (
              <div className="user-cursor">
                <div className="user-cursor-label">{userInfo.id}</div>
              </div>
            )}
            <div className="user-cursor-selection" />
          </div>
        );
      });

      function getClientRects(start: number, end: number) {
        if (
          !overlayRef.current ||
          !overlayRef.current.firstChild ||
          start === -1 ||
          end === -1
        ) {
          return [];
        }
        const range = document.createRange();
        const max =
          overlayRef.current.firstChild.textContent?.length ?? Number.MAX_VALUE;
        range.setStart(overlayRef.current.firstChild, Math.min(start, max));
        range.setEnd(overlayRef.current.firstChild, Math.min(end, max));
        return Array.from(range.getClientRects());
      }
    },
    [yText]
  );

  return (
    <div className="text-container">
      <Textarea
        className="input"
        ref={ref}
        onSelectionChange={onSelectionChange}
        onTextChange={onTextChange}
      />
      <div className="overlay cursors-container">
        {userInfos.map((userInfo) => renderCursor(userInfo))}
      </div>
      <div className="input overlay selection-helper hidden" ref={overlayRef}>
        {text}
      </div>
    </div>
  );
};
