export async function fetchUpdates() {
  return await fetch("/api/updates").then(res => res.json());
} 

export async function fetchDoc() {
  const buffer = await fetch("/api/doc").then(res => res.arrayBuffer());
  return new Uint8Array(buffer);
}

export async function storeUpdates(updates: Uint8Array) {
  return await fetch("/api/updates", {
    method: "POST",
    // don't bother digging why sending binary not working ...
    body: JSON.stringify(Array.from(updates)),
  }).then(res => res.json());
}

declare global {
  interface Window {
    fetchUpdates: () => Promise<any>;
    fetchDoc: () => Promise<any>;
  }
}

window.fetchUpdates = fetchUpdates;
window.fetchDoc = fetchDoc;