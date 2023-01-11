import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import * as awarenessProtocol from "y-protocols/awareness.js";
import { createInputBinding } from "./InputBinding";

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

interface SelectionRange {
  id: string;
  anchor: Y.RelativePosition;
  focus: Y.RelativePosition; // only show anchor for now.
}

interface UserInfo {
  id: number;
  color: string;
  cursor?: SelectionRange;
  current: boolean;
}

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
  const active = useTabActive();
  const [yText, setYText] = useState<Y.Text>();
  const text = useYTextString(yText);
  const [awareness, setAwareness] = useState<awarenessProtocol.Awareness>();
  const userInfos = useAwarenessUserInfos(awareness);
  const yDoc = yText?.doc;

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

  const fragments = useMemo(() => {
    if (!text || !yDoc) {
      return [];
    }

    const toAbsolute = (relativePosition?: Y.RelativePosition) => {
      if (relativePosition) {
        return (
          Y.createAbsolutePositionFromRelativePosition(relativePosition, yDoc)
            ?.index ?? -1
        );
      }
      return -1;
    };

    const sortedUserInfos = [...userInfos].sort(
      (a, b) => toAbsolute(a.cursor?.anchor) - toAbsolute(b.cursor?.anchor)
    );
    const fragments = [];

    let lastCursor = 0;
    for (let i = 0; i < sortedUserInfos.length; i++) {
      const userInfo = sortedUserInfos[i];
      if (userInfo.current) {
        continue;
      }
      if (toAbsolute(userInfo.cursor?.anchor) !== lastCursor) {
        fragments.push(
          <span className="hidden" key={i}>
            {text.substring(lastCursor, toAbsolute(userInfo.cursor?.anchor))}
          </span>
        );
      }
      fragments.push(
        <span
          className="user-cursor"
          key={userInfo.id}
          // @ts-ignore
          style={{ "--user-color": userInfo.color }}
        >
          <div className="user-cursor-label">{userInfo.id}</div>
        </span>
      );
      lastCursor = toAbsolute(userInfo.cursor?.anchor);
    }
    if (lastCursor !== text.length) {
      fragments.push(
        <span key={sortedUserInfos.length} className="hidden">
          {text.substring(lastCursor, text.length)}
        </span>
      );
    }
    return fragments;
  }, [userInfos, text, yDoc]);

  return (
    <div className="App" data-active={active}>
      <div className="text-container">
        <textarea className="input" ref={ref} />
        <div className="input overlay">{fragments}</div>
      </div>
    </div>
  );
}

export default App;
