import { getSupabasePublicEnv } from "@/lib/supabase/env"

export const DOCUMENTS_BUCKET = "documents"

const PART_SIZE = 8 * 1024 * 1024
const QUEUE_SIZE = 4

export function documentObjectPath(userId: string, threadId: string, fileName: string) {
  const cleaned = fileName.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^[_\.]+|[_\.]+$/g, "")
  const safe = (cleaned || "document.pdf").slice(0, 180)
  return `${userId}/${threadId}/${safe}`
}

export function supabaseProjectRef(supabaseUrl: string): string | null {
  try {
    const match = new URL(supabaseUrl).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/** Direct storage host. The API gateway host is what throttled the single POST. */
export function storageS3Endpoint(supabaseUrl: string): string | null {
  const ref = supabaseProjectRef(supabaseUrl)
  if (!ref) return null
  return `https://${ref}.storage.supabase.co/storage/v1/s3`
}

export async function uploadSessionPdf(options: {
  userId: string
  threadId: string
  file: File
  accessToken: string
}): Promise<string | null> {
  const env = getSupabasePublicEnv()
  const region = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_REGION?.trim() ?? ""
  if (!env || !options.accessToken || !options.file.size) return null
  if (!region) {
    console.error("[Documents] Upload failed", "NEXT_PUBLIC_SUPABASE_STORAGE_REGION is not set")
    return null
  }
  const projectRef = supabaseProjectRef(env.url)
  const endpoint = storageS3Endpoint(env.url)
  if (!projectRef || !endpoint) {
    console.error("[Documents] Upload failed", "Supabase URL is not a project host")
    return null
  }
  const objectPath = documentObjectPath(options.userId, options.threadId, options.file.name)
  try {
    const { S3Client } = await import("@aws-sdk/client-s3")
    const { Upload } = await import("@aws-sdk/lib-storage")
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: projectRef,
        secretAccessKey: env.anonKey,
        sessionToken: options.accessToken,
      },
    })
    await new Upload({
      client,
      params: {
        Bucket: DOCUMENTS_BUCKET,
        Key: objectPath,
        Body: options.file,
        ContentType: options.file.type || "application/pdf",
      },
      partSize: PART_SIZE,
      queueSize: QUEUE_SIZE,
      leavePartsOnError: false,
    }).done()
    return objectPath
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload failed"
    console.error("[Documents] Upload failed", message)
    return null
  }
}
