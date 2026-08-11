import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp = path.join(root, "scripts", ".tmp-doubles");
fs.mkdirSync(tmp, { recursive: true });

const transpile = (code, filename) =>
  ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;

fs.writeFileSync(
  path.join(tmp, "pairEntry.mjs"),
  transpile(fs.readFileSync(path.join(root, "lib", "pairEntry.ts"), "utf8"), "pairEntry.ts")
);
fs.writeFileSync(
  path.join(tmp, "doublesFieldImport.mjs"),
  transpile(
    fs
      .readFileSync(path.join(root, "lib", "doublesFieldImport.ts"), "utf8")
      .replace("./pairEntry", "./pairEntry.mjs"),
    "doublesFieldImport.ts"
  )
);

const { parseDoublesFieldCsv } = await import(
  pathToFileURL(path.join(tmp, "doublesFieldImport.mjs")).href
);

const csv = [
  "Name,pdga_number,official_rating,hometown,state,country",
  "18 Wheels,Stevie Frisch,989,Boston,MA,United States",
  ",David Fleck,1011,Woodstock,CT,United States",
  "HeimBuhrg,Calvin Heimburg,1049,Safety Harbor,FL,United States",
  ",Gannon Buhr,1061,Urbandale,IA,United States",
  "Break 50,Jesse Nieminen,1031,Kuopio,,Finland",
  ",Albert Tamm,1022,Tartu,,Estonia",
].join("\n");

const ok = parseDoublesFieldCsv(csv);
assert.equal(ok.errors.length, 0, ok.errors.join("; "));
assert.equal(ok.pairs.length, 3);
assert.equal(ok.pairs[0].teamName, "18 Wheels");
assert.equal(ok.pairs[0].members[1].name, "David Fleck");
assert.equal(ok.pairs[1].teamName, "HeimBuhrg");
assert.equal(ok.pairs[1].averageRating, 1055);

const incomplete = parseDoublesFieldCsv(
  [
    "Name,pdga_number,official_rating",
    "Lonely,Only One,1000",
    "Complete,A,1000",
    ",B,1010",
  ].join("\n")
);
assert.equal(incomplete.pairs.length, 0);
assert.ok(incomplete.errors.some((e) => /Lonely/.test(e) && /2/.test(e)), incomplete.errors.join("; "));

const badRating = parseDoublesFieldCsv(
  ["Name,pdga_number,official_rating", "X,A,abc", ",B,1000"].join("\n")
);
assert.equal(badRating.pairs.length, 0);
assert.ok(badRating.errors.some((e) => /rating/i.test(e)), badRating.errors.join("; "));

console.log("doubles CSV parser OK");
fs.rmSync(tmp, { recursive: true, force: true });
