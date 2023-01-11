import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import * as awarenessProtocol from "y-protocols/awareness.js";
import { createInputBinding } from "./InputBinding";
import { UserInfo } from "./types";

const room = "pengx17-test-textarea";

const useTabActive = () => {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        setActive(true);
      } else {
        setActive(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, []);

  return active;
};

const useYTextString = (text?: Y.Text) => {
  const [value, setValue] = useState(text?.toString());

  useEffect(() => {
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
  const [userInfos, setUserInfos] = useState<UserInfo[]>([]);

  useEffect(() => {
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

export const usercolors = [
  "#30bced",
  "#6eeb83",
  "#ffbc42",
  "#ecd444",
  "#ee6352",
  "#9ac2c9",
  "#8acb88",
  "#1be7ff",
];
const myColor = usercolors[Math.floor(Math.random() * usercolors.length)];

function App() {
  const ref = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const active = useTabActive();
  const [yText, setYText] = useState<Y.Text>();
  const text = useYTextString(yText);
  const [awareness, setAwareness] = useState<awarenessProtocol.Awareness>();
  const userInfos = useAwarenessUserInfos(awareness);

  useEffect(() => {
    if (ref.current) {
      const el = ref.current;
      const yDoc = new Y.Doc();
      const persistence = new IndexeddbPersistence(room, yDoc);
      const wrtcProvider = new WebrtcProvider(room, yDoc);

      wrtcProvider.awareness.setLocalStateField("user", {
        color: myColor,
      });

      let unlisten = () => {};

      persistence.once("synced", () => {
        const yText = yDoc.getText("text");
        setYText(yText);
        setAwareness(wrtcProvider.awareness);
        const undoManager = new Y.UndoManager(yText, {
          captureTimeout: 200,
        });
        unlisten = createInputBinding(
          yText,
          undoManager,
          wrtcProvider.awareness,
          el
        );
      });

      return () => {
        yDoc.destroy();
        unlisten();
        persistence.destroy();
        wrtcProvider.destroy();
        setYText(undefined);
        setAwareness(undefined);
      };
    }
  }, []);

  const getClientRects = useCallback((start: number, end: number) => {
    if (!overlayRef.current || !overlayRef.current.firstChild) {
      return [];
    }
    const range = document.createRange();
    const max = overlayRef.current.firstChild.textContent?.length ?? 99999;
    range.setStart(overlayRef.current.firstChild, Math.min(start, max));
    range.setEnd(overlayRef.current.firstChild, Math.min(end, max));
    return Array.from(range.getClientRects());
  }, []);

  const renderCursor = useCallback(
    (userInfo: UserInfo) => {
      const yDoc = yText?.doc;
      const overlayRect = overlayRef.current?.getBoundingClientRect();
      if (!yDoc || !userInfo.cursor || !overlayRect || userInfo.current) {
        return [];
      }
      const { anchor, focus } = userInfo.cursor;
      const toAbsolute = (yPosRel?: Y.RelativePosition) => {
        const absPos = yPosRel
          ? Y.createAbsolutePositionFromRelativePosition(yPosRel, yDoc)
          : null;
        return absPos?.index ?? -1;
      };
      const [start, end] = [toAbsolute(anchor), toAbsolute(focus)];
      let rects = getClientRects(start, end);

      if (start === end && rects.length > 1) {
        rects = [rects.at(-1)!];
      }

      return rects.map((rect, idx) => {
        return (
          <div
            key={userInfo.id + "_" + idx}
            className="user-cursor"
            style={{
              // @ts-ignore
              "--user-color": userInfo.color,
              left: rect.left - overlayRect.left,
              top: rect.top - overlayRect.top,
              width: rect.width,
              height: rect.height,
            }}
          >
            {idx === 0 && (
              <div className="user-cursor-label">{userInfo.id}</div>
            )}
            <div className="user-cursor-selection" />
          </div>
        );
      });
    },
    [yText]
  );

  return (
    <div className="App" data-active={active}>
      <div className="text-container">
        <textarea className="input" ref={ref} />
        <div className="overlay cursors-container">
          {userInfos.map((userInfo) => renderCursor(userInfo))}
        </div>
        <div className="input overlay selection-helper hidden" ref={overlayRef}>
          {text}
        </div>
      </div>
    </div>
  );
}

export default App;
