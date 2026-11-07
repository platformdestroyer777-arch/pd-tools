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

// CSV formula injection: exporting untrusted cells must not run formulas in Excel.
const attackCells=[["label","payload"],["a","=HYPERLINK(\"https://evil.example\",\"Click\")"],["b","+SUM(1,2)"],["c","@SUM(2,2)"],["d","-cmd|' /C calc'!A0"],["e","-123.45"]];
const safeCSV=csv.encodeCSV(attackCells);
assert.ok(safeCSV.includes("'+SUM(1,2)"));
assert.ok(safeCSV.includes("'@SUM(2,2)"));
assert.ok(safeCSV.includes("'-cmd"));
assert.ok(safeCSV.includes("'-")===false || !safeCSV.includes("'-123.45"),"Negative numeric values should remain numeric");
assert.ok(!safeCSV.includes('\r\nb,+SUM'));


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

// Decode each GIF frame's LZW stream to validate actual pixel data,
// not just file headers. No third-party image dependencies.
function decodeGIFFrames(g){
 let p=13+256*3,frames=[];
 const word=at=>g[at]|(g[at+1]<<8);
 while(p<g.length){
   const mark=g[p++];
   if(mark===0x3b)break;
   if(mark===0x21){
     p++; // extension label
     while(true){const length=g[p++];if(!length)break;p+=length}
     continue;
   }
   assert.equal(mark,0x2c,"Invalid GIF image separator");
   const width=word(p+4),height=word(p+6),flags=g[p+8];p+=9;
   if(flags&0x80)p+=3*(1<<((flags&7)+1));
   const min=g[p++],compressed=[];
   while(true){const len=g[p++];if(!len)break;compressed.push(...g.slice(p,p+len));p+=len}
   const clear=1<<min,end=clear+1;
   let dict,codeSize,next,last,bits=0,pixel=[];
   const reset=()=>{dict=Array.from({length:clear},(_,i)=>[i]);next=end+1;codeSize=min+1;last=null};
   const read=()=>{let code=0;for(let j=0;j<codeSize;j++){code|=((compressed[bits>>3]>>(bits&7))&1)<<j;bits++}return code};
   reset();
   for(let guard=0;guard<width*height*2+256;guard++){
     const code=read();if(code===clear){reset();continue}if(code===end)break;
     let entry=dict[code];
     if(!entry&&code===next&&last)entry=[...last,last[0]];
     assert.ok(entry,"Invalid GIF LZW dictionary code "+code);
     pixel.push(...entry);
     if(last){
       dict[next++]=[...last,entry[0]];
       if(next===(1<<codeSize)&&codeSize<12)codeSize++;
     }
     last=entry;
   }
   assert.equal(pixel.length,width*height,"GIF pixel stream length");
   frames.push({width,height,pixel});
 }
 return frames;
}
const frames=decodeGIFFrames(bytes);
assert.equal(frames.length,2);
assert.deepEqual(frames[0].pixel,[224,28,3,255]);


const noisy=new Uint8Array(80*50*4),expectedIndexes=[];
for(let i=0;i<80*50;i++){
 const r=(i*173+(i>>2)*29)%256,g=(i*87+(i>>4)*149)%256,b=(i*31+(i>>1)*113)%256;
 noisy[i*4]=r;noisy[i*4+1]=g;noisy[i*4+2]=b;noisy[i*4+3]=255;
 expectedIndexes.push(((r>>5)<<5)|((g>>5)<<2)|(b>>6));
}
const complex=media.gif([noisy],80,50,8);
const complexFrames=decodeGIFFrames(new Uint8Array(await complex.arrayBuffer()));
assert.equal(complexFrames.length,1);
assert.deepEqual(complexFrames[0].pixel,expectedIndexes,"Complex GIF image pixels differ");

console.log("PD Tools Premium: 35 tools; 20 registered; CSV, SRT/VTT, GIF and storefront checks passed.");