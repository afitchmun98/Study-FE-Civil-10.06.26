import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const dist=path.join(root,"dist");
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
fs.copyFileSync(path.join(root,"index.html"),path.join(dist,"index.html"));
const optionalFiles = ["firebase-applet-config.json", "firebase-blueprint.json", "metadata.json", "firestore.rules", "FIRESTORE_RULES.rules"];
for (const file of optionalFiles) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(dist, file));
  }
}
fs.writeFileSync(path.join(dist,".nojekyll"),"");
console.log(JSON.stringify({output:"dist/index.html",hosting:"static"},null,2));
