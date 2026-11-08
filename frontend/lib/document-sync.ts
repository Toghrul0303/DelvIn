import { getSupabasePublicEnv } from "@/lib/supabase/env"

export const DOCUMENTS_BUCKET = "documents"

export function documentObjectPath(userId: string, threadId: string, fileName: string) {
  const cleaned = fileName.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^[_\.]+|[_\.]+$/g, "")
  const safe = (cleaned || "document.pdf").slice(0, 180)
  return `${userId}/${threadId}/${safe}`
}

function storageObjectUrl(baseUrl: string, objectPath: string) {
  const encoded = objectPath.split("/").map((segment) => encodeURIComponent(segment)).join("/")
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/${DOCUMENTS_BUCKET}/${encoded}`
}

export async function uploadSessionPdf(options: {
  userId: string
  threadId: string
  file: File
  accessToken: string
  onProgress?: (percent: number) => void
}): Promise<string | null> {
  const env = getSupabasePublicEnv()
  if (!env || !options.accessToken) return null
  const objectPath = documentObjectPath(options.userId, options.threadId, options.file.name)
  const contentType = options.file.type || "application/pdf"
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", storageObjectUrl(env.url, objectPath))
      xhr.setRequestHeader("Authorization", `Bearer ${options.accessToken}`)
      xhr.setRequestHeader("apikey", env.anonKey)
      xhr.setRequestHeader("Content-Type", contentType)
      xhr.setRequestHeader("cache-control", "max-age=3600")
      xhr.setRequestHeader("x-upsert", "true")
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return
        options.onProgress?.(Math.floor((event.loaded / event.total) * 100))
      }
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve()
          return
        }
        reject(new Error(`storage upload failed: ${xhr.status}`))
      }
      xhr.onerror = () => reject(new Error("storage upload failed: network"))
      xhr.onabort = () => reject(new Error("storage upload aborted"))
      xhr.send(options.file)
    })
    return objectPath
  } catch (error) {
    const message = error instanceof Error ? error.message : "storage upload failed"
    console.error("[Documents] Upload failed", message)
    return null
  }
}
