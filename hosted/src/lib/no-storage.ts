// 26.11.58 (release sign-off, size budget): the website keeps no files in Supabase Storage (pictures and video stay on
// the church PC), but supabase-js builds a storage client in every createClient(), which brought the whole storage
// library (with an Iceberg catalog client and a 22 KB Buffer polyfill) into every page. next.config.ts points
// "@supabase/storage-js" here for the browser build only. Anything that ever calls supabase.storage gets a clear error.
const OFF = "Supabase Storage is not part of the FrameDecks website build (see hosted/src/lib/no-storage.ts).";

export class StorageApiError extends Error {
  status = 0;
}

export class StorageClient {
  from(): never {
    throw new Error(OFF);
  }
  listBuckets(): never {
    throw new Error(OFF);
  }
}
