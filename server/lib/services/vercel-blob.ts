import { put, list, del } from '@vercel/blob';

export async function uploadBackupToBlob(filename: string, buffer: Buffer): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }

  const blob = await put(`backups/${filename}`, buffer, {
    access: 'public',
    addRandomSuffix: false,
    token,
  });

  return blob.url;
}

export async function cleanExpiredBlobs(retentionDays: number): Promise<string[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }

  const prefix = 'backups/court-management-';
  const { blobs } = await list({ prefix, token });

  const expireTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const deletedUrls: string[] = [];

  for (const blob of blobs) {
    // Extract date from filename: backups/court-management-YYYY-MM-DDTHH-mm-ss.json.gz
    const match = blob.pathname.match(/court-management-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    if (match) {
      const dateStr = match[1].replace(/-/g, ':').replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const fileDate = new Date(dateStr).getTime();
      if (!isNaN(fileDate) && fileDate < expireTime) {
        await del(blob.url, { token });
        deletedUrls.push(blob.url);
      }
    }
  }

  return deletedUrls;
}
