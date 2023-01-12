import React from "react";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness.js";
import { Textarea } from "./Textarea";
import { UserInfo } from "./types";
import { Op } from "quill-delta";

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
  const userInfos = useAwarenessUserInfos(awareness);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const helperRef = React.useRef<HTMLDivElement>(null);
  const cursorsRef = React.useRef<HTMLDivElement>(null);

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
      const updateListener = (_?: any, origin?: any) => {
        input$.value = yText.toString();
        if (origin !== undoManager && origin != null) {
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
        }
        onSelectionChange();
      };

      updateListener();
      onSelectionChange();

      yDoc.on("update", updateListener);

      return () => {
        yDoc.off("update", updateListener);
      };
    }
  }, [yText, undoManager]);

  const renderCursor = React.useCallback(
    (userInfo: UserInfo) => {
      const yDoc = yText?.doc;
      const text = yText?.toString() ?? "";
      const overlayRect = helperRef.current?.getBoundingClientRect();
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
        if (!helperRef.current || start === -1 || end === -1) {
          return [];
        }
        helperRef.current.textContent = text + "\n";
        if (helperRef.current.firstChild == null) {
          return [];
        }
        const range = document.createRange();
        const max = text?.length ?? Number.MAX_VALUE;
        range.setStart(helperRef.current.firstChild, Math.min(start, max));
        range.setEnd(helperRef.current.firstChild, Math.min(end, max));
        return Array.from(range.getClientRects());
      }
    },
    [yText]
  );

  // sync scroll positions
  React.useEffect(() => {
    if (ref.current && cursorsRef.current && helperRef.current) {
      const input$ = ref.current;
      const cursors$ = cursorsRef.current;
      const helper$ = helperRef.current;
      const onScroll = () => {
        cursors$.scrollLeft = input$.scrollLeft;
        cursors$.scrollTop = input$.scrollTop;
        helper$.scrollLeft = input$.scrollLeft;
        helper$.scrollTop = input$.scrollTop;
      };
      input$.addEventListener("scroll", onScroll);
      return () => {
        input$.removeEventListener("scroll", onScroll);
      };
    }
  }, []);

  return (
    <div className="text-container">
      <Textarea
        className="input"
        ref={ref}
        onSelectionChange={onSelectionChange}
        onTextChange={onTextChange}
      />
      <div className="input overlay selection-helper-container hidden">
        <div className="selection-helper" ref={helperRef} />
      </div>
      <div className="overlay cursors-container" ref={cursorsRef}>
        <div className="cursors-wrapper">{userInfos.map(renderCursor)}</div>
      </div>
    </div>
  );
};
