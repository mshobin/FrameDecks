// FrameDecks 8.3 - pictures, videos, audio and slides added on the website. They never go to the cloud (owner's
// choice, 8.2): they are kept in this browser (IndexedDB, per workspace) and travel to the service PC inside the
// .frame file (Export for Service PC). Another browser or device does not have them; the Frame keeps the file name.
import { FRAME_MAX_BYTES, type FrameMedia } from "@/lib/frame-file";
import { safeFileName } from "@/lib/frame-flow";

const DB = "framedecks-media";
const STORE = "files";
type Stored = { key: string; ws: string; name: string; type: string; size: number; blob: Blob; at: number };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("This browser cannot keep files."));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("This browser cannot keep files."));
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => (db.close(), resolve(req.result));
        tx.onerror = tx.onabort = () => (db.close(), reject(tx.error ?? new Error("The file could not be kept.")));
      }),
  );
}

/** Keeps a file for this workspace and returns the name the Frame uses. */
export async function keepMedia(ws: string, file: File): Promise<string> {
  if (file.size > FRAME_MAX_BYTES) throw new Error("This file is larger than 300 MB. Add it on the service PC instead.");
  const name = safeFileName(file.name);
  const row: Stored = { key: `${ws}/${name}`, ws, name, type: file.type || "application/octet-stream", size: file.size, blob: file, at: Date.now() };
  await run("readwrite", (s) => s.put(row));
  return name;
}

/** The names of the files this browser keeps for the workspace. */
export async function keptNames(ws: string): Promise<Set<string>> {
  try {
    const all = (await run("readonly", (s) => s.getAll())) as Stored[];
    return new Set(all.filter((r) => r.ws === ws).map((r) => r.name));
  } catch {
    return new Set();
  }
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The kept files the plan uses, ready for the .frame file (up to 300 MB in all); `left` are the ones not included. */
export async function mediaForExport(ws: string, names: string[]): Promise<{ media: FrameMedia[]; left: string[] }> {
  const media: FrameMedia[] = [];
  const left: string[] = [];
  let total = 0;
  for (const name of names) {
    let row: Stored | undefined;
    try {
      row = (await run("readonly", (s) => s.get(`${ws}/${name}`))) as Stored | undefined;
    } catch {
      row = undefined;
    }
    if (!row || total + row.size > FRAME_MAX_BYTES) {
      left.push(name);
      continue;
    }
    const buf = await row.blob.arrayBuffer();
    total += buf.byteLength;
    media.push({ file: name, type: row.type, size: buf.byteLength, sha256: await sha256(buf), data: base64(buf) });
  }
  return { media, left };
}
