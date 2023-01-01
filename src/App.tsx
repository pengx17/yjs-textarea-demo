import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import { createInputBinding } from './InputBinding';
import './App.css';

const room = 'pengx17-test-textarea';

function App() {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      const el = ref.current;
      const yDoc = new Y.Doc();
      const persistence = new IndexeddbPersistence(room, yDoc);
      const wrtcProvider = new WebrtcProvider(room, yDoc);

      let unlisten = () => {};

      persistence.once('synced', () => {
        console.log('initial content loaded');
        const yText = yDoc.getText('text');
        const undoManager = new Y.UndoManager(yText, {
          captureTimeout: 200,
        });
        unlisten = createInputBinding(yText, undoManager, el);
      });

      return () => {
        yDoc.destroy();
        unlisten();
        persistence.destroy();
        wrtcProvider.destroy();
      };
    }
  }, []);

  return (
    <div className="App">
      <textarea className="input" ref={ref} />
    </div>
  );
}

export default App;
