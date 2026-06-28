import { expect, test, describe } from "bun:test";
import { createPostgresBackup } from "./database-backup";
import { restorePostgresBackup } from "./database-restore";

describe("database-restore service", () => {
  test("restores database successfully from a backup", async () => {
    const backup = await createPostgresBackup();
    
    const file = new File([backup.buffer], backup.filename, { type: "application/gzip" });
    const result = await restorePostgresBackup({
      file,
      filename: backup.filename,
      size: backup.size
    });

    expect(result.filename).toBe(backup.filename);
    expect(result.size).toBe(backup.size);
  }, 15000);
});
