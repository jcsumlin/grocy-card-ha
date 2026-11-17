import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const options = {
  entryPoints: ["src/grocy-chore-card.ts"],
  outfile: "dist/grocy-chore-card.js",
  bundle: true,
  format: "iife",
  target: "es2021",
  minify: !process.argv.includes("--watch"),
  sourcemap: false,
  legalComments: "none",
  define: { __VERSION__: JSON.stringify(version) },
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
