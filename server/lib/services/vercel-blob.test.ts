import { expect, test, describe } from "bun:test";
import { uploadBackupToBlob, cleanExpiredBlobs } from "./vercel-blob";

describe("vercel-blob service", () => {
  test("uploadBackupToBlob throws if token is missing", async () => {
    const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    try {
      await expect(uploadBackupToBlob("test.gz", Buffer.from("test"))).rejects.toThrow("BLOB_READ_WRITE_TOKEN is not configured");
    } finally {
      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    }
  });
});
