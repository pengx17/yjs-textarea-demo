import * as Y from "yjs";
import sqlite3Default from "sqlite3";
import * as encoding from "lib0/encoding";

const sqlite3 = sqlite3Default.verbose();

const schema = `CREATE TABLE IF NOT EXISTS "updates" (
  id  INTEGER PRIMARY KEY AUTOINCREMENT,
  data BLOB NOT NULL
)`;

sqlite3.verbose();

// By default, it uses the OPEN_READWRITE | OPEN_CREATE mode.
const db = new sqlite3.Database("./test.db");

db.run(schema);

// db.close();

export async function getUpdates() {
  return new Promise<{ id: number; data: any }[]>((resolve, reject) => {
    // do we need to order by id?
    db.all("SELECT * FROM updates", (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as any as { id: number; data: any }[]);
      }
    });
  });
}

export async function getDoc() {
  const updates = await getUpdates();
  const doc = new Y.Doc();
  updates.forEach((update) => {
    Y.applyUpdate(doc, Buffer.from(update.data));
  });
  return Y.encodeStateAsUpdate(doc);
}

export async function addUpdate(data: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    db.run("INSERT INTO updates (data) VALUES (?)", [data], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
} 

// (async () => {
//   const ydoc = new Y.Doc();
//   const yText = ydoc.getText('text');
//   yText.insert(0, "Hello World");
//   const update = Y.encodeStateAsUpdate(ydoc);
//   await addUpdate(update);
// })();