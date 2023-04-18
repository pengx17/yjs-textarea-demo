import { useEffect, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as awarenessProtocol from "y-protocols/awareness.js";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import { YjsTextarea } from "./YjsTextarea";

import * as db from "./db";

const room = "pengx17-test-textarea";

const usercolors = [
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
  const [yText, setYText] = useState<Y.Text>();
  const [awareness, setAwareness] = useState<awarenessProtocol.Awareness>();

  useEffect(() => {
    const yDoc = new Y.Doc();
    // const persistence = new IndexeddbPersistence(room, yDoc);
    // const wrtcProvider = new WebrtcProvider(room, yDoc);

    // wrtcProvider.awareness.setLocalStateField("user", {
    //   color: myColor,
    // });

    // persistence.once("synced", () => {
    //   const yText = yDoc.getText("text");
    //   console.log("synced", yText);
    //   setYText(yText);
    //   // setAwareness(wrtcProvider.awareness);
    // });

    db.fetchDoc().then((doc) => {
      Y.applyUpdate(yDoc, doc);
      const yText = yDoc.getText("text");
      console.log("synced", yText);
      setYText(yText);

      yDoc.on("update", (update, b, c) => {
        // console.log(update, b, c, Y.encodeStateAsUpdate(yDoc));
        db.storeUpdates(update);
      });
    });

    // db.fetchUpdates().then((updates) => {
    //   updates.rows.forEach((update: any) => {
    //     console.log(
    //       Array.from(update.data),
    //       new Uint8Array(Array.from(update.data))
    //     );
    //     Y.applyUpdate(yDoc, new Uint8Array(update.data));
    //   });

    //   const yText = yDoc.getText("text");
    //   console.log("synced", yText);
    //   setYText(yText);
    // });

    return () => {
      yDoc.destroy();
      // persistence.destroy();
      // wrtcProvider.destroy();
      setYText(undefined);
      setAwareness(undefined);
    };
  }, []);

  return (
    <div className="App">
      <YjsTextarea yText={yText} awareness={awareness} />
    </div>
  );
}

export default App;
