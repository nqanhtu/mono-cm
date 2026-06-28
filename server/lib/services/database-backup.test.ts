import { expect, test, describe } from "bun:test";
import { createPostgresBackup } from "./database-backup";
import * as zlib from "zlib";

describe("database-backup service", () => {
  test("creates a valid gzipped json backup", async () => {
    const backup = await createPostgresBackup();
    expect(backup.filename).toStartWith("court-management-");
    expect(backup.filename).toEndWith(".json.gz");
    expect(backup.size).toBeGreaterThan(0);
    expect(backup.buffer).toBeInstanceOf(Buffer);

    // Decompress and verify JSON structure
    const jsonStr = zlib.gunzipSync(backup.buffer).toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    console.log("Parsed backup data keys:", Object.keys(parsed.data));
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.version).toBe("1.0");
    expect(parsed.data).toBeDefined();
    if (parsed.data.user) {
      expect(parsed.data.user).toBeInstanceOf(Array);
    }

    await backup.cleanup();
  });
});
