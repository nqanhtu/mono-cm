const result = await Bun.build({
  entrypoints: ["server/api-entry.ts"],
  outdir: "api",
  target: "bun",
  format: "esm",
  naming: {
    entry: "entry.generated.js",
  },
  minify: true,
  sourcemap: "external",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}
