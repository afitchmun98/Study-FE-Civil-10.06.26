import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const host="0.0.0.0";
const port=Number.parseInt(process.env.PORT||"3000",10);
const indexPath=path.join(root,"index.html");

const server=http.createServer((request,response)=>{
  const pathname=new URL(request.url||"/","http://localhost").pathname;
  if(pathname==="/"||pathname==="/index.html"){
    const body=fs.readFileSync(indexPath);
    response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
    response.end(body);
    return;
  }
  const safePath=path.normalize(pathname).replace(/^(\.\.[\/\\])+/,"");
  const filePath=path.join(root,safePath);
  if(fs.existsSync(filePath)&&fs.statSync(filePath).isFile()){
    const ext=path.extname(filePath).toLowerCase();
    const mimeTypes={
      ".json":"application/json; charset=utf-8",
      ".js":"application/javascript; charset=utf-8",
      ".mjs":"application/javascript; charset=utf-8",
      ".css":"text/css; charset=utf-8",
      ".html":"text/html; charset=utf-8",
      ".txt":"text/plain; charset=utf-8",
      ".png":"image/png",
      ".jpg":"image/jpeg",
      ".svg":"image/svg+xml"
    };
    const contentType=mimeTypes[ext]||"application/octet-stream";
    response.writeHead(200,{"Content-Type":contentType,"Cache-Control":"no-store"});
    response.end(fs.readFileSync(filePath));
    return;
  }
  response.writeHead(404,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});
  response.end("Not found\n");
});

server.listen(port,host,()=>console.log(`FE Civil Practice Lab available at http://${host}:${port}`));
