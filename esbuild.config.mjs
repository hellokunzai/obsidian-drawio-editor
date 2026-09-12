import esbuild from "esbuild";
import { readFile, copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const production = process.argv.includes("--production");

// Plugin to inline binary/text files as raw strings
const rawLoaderPlugin = {
  name: "raw-loader",
  setup(build) {
    // mxClient.min.js → string
    build.onLoad({ filter: /mxClient\.min\.js$/ }, async (args) => {
      const contents = await readFile(args.path, "utf8");
      return {
        contents: `export default ${JSON.stringify(contents)};`,
        loader: "js",
      };
    });
    // Stencil XML files → string
    build.onLoad({ filter: /\.xml$/ }, async (args) => {
      const contents = await readFile(args.path, "utf8");
      return {
        contents: `export default ${JSON.stringify(contents)};`,
        loader: "js",
      };
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",
  external: ["obsidian", "electron"],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  minify: production,
  plugins: [rawLoaderPlugin],
  define: {
    "process.env.NODE_ENV": production ? '"production"' : '"development"',
  },
});

if (production) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
