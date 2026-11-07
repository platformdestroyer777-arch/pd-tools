import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Tests never create Pix payments or touch user records.
const source = path => readFileSync(path,"utf8");
const expected = [
 "video-frames","audio-trim","audio-volume","video-gif","photo-collage",
 "favicon-maker","svg-png","privacy-blur","device-mockup","thumbnail-maker",
 "csv-editor","file-organizer","bulk-rename","zip-maker","qr-reader",
 "sitemap-maker","meta-generator","css-animations","markdown-editor","subtitle-converter"
];
const modules=["premium-new-media.js","premium-new-design.js","premium-new-productivity.js","premium-new-creators.js"];
const registered=[];
for(const path of modules){
  const context={window:{PDNewTools:{register:(id,handler)=>{
    assert.equal(typeof handler,"function",id+" must have a handler");
    registered.push(id);
  },esc:s=>String(s)}}};
  vm.runInNewContext(source(path),context,{timeout:4000,filename:path});
}
assert.equal(registered.length,20,"Should register exactly 20 new tools");
assert.deepEqual([...registered].sort(),[...expected].sort(),"Registered tools mismatch");
assert.equal(new Set(registered).size,20,"New tool IDs duplicated");

const catalog=source("premium-filter.js");
const toolsSection=catalog.split("const premiumTools = [")[1]?.split("];")[0]||"";
const ids=[...toolsSection.matchAll(/\bid:\s*"([^"]+)"/g)].map(x=>x[1]);
assert.equal(ids.length,35,"Expected 35 Premium tools in the catalog");
assert.equal(new Set(ids).size,35,"Duplicate Premium tool IDs");
for(const id of expected)assert.ok(ids.includes(id),"Missing in catalog: "+id);
assert.match(catalog,/renderPremiumCards\(\);/,"Premium catalogue should render without requiring paid status");
assert.match(catalog,/pd-premium-unlock/,"Non-subscribers must see an upgrade invitation");
assert.match(source("premium-new-core.js"),/\/api\/premium-status/,"Server-side subscription check missing");

const html=source("index.html");
for(const file of ["premium-new-core.js",...modules,"premium-marketing.css","premium-marketing.js"])
  assert.ok(html.includes('"'+file+'"'),"Homepage does not load "+file);
for(const value of ['35 ferramentas','R$ 5,00','30 dias','premiumExplore','pdPremiumExample'])
  assert.ok(html.includes(value),"Offer is missing: "+value);

function expose(path,names,extra={}){
  const src=source(path).replace(/\}\)\(\);\s*$/,'globalThis.__tests = {'+names.join(",")+"};})();");
  const c={window:{PDNewTools:{register:()=>{},esc:s=>String(s)}},Blob,...extra};
  vm.runInNewContext(src,c,{timeout:4000,filename:path});return c.__tests;
}
const csv=expose("premium-new-productivity.js",["parseCSV","encodeCSV"]);
const data=csv.parseCSV('Nome,Texto\n"Ana, B.","Diz ""oi"""\n',' , '.trim());
assert.equal(data.length,2);
assert.equal(data[1][0],"Ana, B.");
assert.equal(data[1][1],'Diz "oi"');
assert.equal(csv.encodeCSV(data).includes('"Ana, B."'),true);

const subtitle=expose("premium-new-creators.js",["convertSubs"]);
const srt='1\n00:00:01,000 --> 00:00:03,000\nOlá, mundo!';
const vtt=subtitle.convertSubs(srt,"vtt");
assert.ok(vtt.startsWith("WEBVTT")&&vtt.includes("00:00:01.000"));
assert.ok(subtitle.convertSubs(vtt,"srt").includes("00:00:01,000"));

const media=expose("premium-new-media.js",["gif"],{});
const picture=new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
const output=media.gif([picture,picture],2,2,10);
const bytes=new Uint8Array(await output.arrayBuffer());
assert.equal(new TextDecoder().decode(bytes.slice(0,6)),"GIF89a");
assert.equal(bytes.at(-1),0x3b);
assert.ok(bytes.length>800,"Palette or frame payload missing");
console.log("PD Tools Premium: 35 tools; 20 registered; CSV, SRT/VTT, GIF and storefront checks passed.");