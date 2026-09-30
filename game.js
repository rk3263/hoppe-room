import {createState,grabPoint,releaseCheek,step,deform,clamp} from './physics.mjs';
const canvas=document.querySelector('#game'), loading=document.querySelector('#loading');
const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
let state=createState(),drag=null,last=performance.now(),hit=0,stroke=0,enabled=false,audio=null,reactionTimer;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const W=480,H=600,rect={x:112,y:250,w:256,h:280};
function say(text){const el=document.querySelector('#reaction');el.textContent=text;el.classList.add('show');clearTimeout(reactionTimer);reactionTimer=setTimeout(()=>el.classList.remove('show'),750);}
function update(){document.querySelector('#count').textContent=state.count;document.querySelector('#mood').textContent=state.pulls>14?'よい':state.pulls>7?'ふつう':'よい';}
function tone(kind){if(!enabled)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';const t=audio.currentTime;osc.frequency.setValueAtTime(kind==='pet'?680:kind==='pull'?420:300,t);osc.frequency.exponentialRampToValueAtTime(kind==='pet'?950:130,t+.14);gain.gain.setValueAtTime(.045,t);gain.gain.exponentialRampToValueAtTime(.001,t+.18);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.2);}catch{}}
function pet(){stroke=1;state.count++;say('…♪');tone('pet');update();}
function poke(){hit=1;state.count++;say('ワ');tone('poke');update();}
function reset(){state=createState();drag=null;hit=stroke=0;update();say('…');document.querySelector('#hint').classList.remove('gone');}
document.querySelector('#pet').onclick=pet;document.querySelector('#poke').onclick=poke;document.querySelector('#reset').onclick=reset;
document.querySelector('#sound').onclick=e=>{enabled=!enabled;e.currentTarget.textContent=enabled?'音 ON':'音 OFF';e.currentTarget.setAttribute('aria-pressed',String(enabled));e.currentTarget.setAttribute('aria-label',enabled?'音をオフにする':'音をオンにする');if(enabled)tone('pet');};
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
function pick(p){
 let best=null,distance=30;
 // Hit-test the currently deformed opaque sprite, including ears, hands and feet.
 for(let i=0;i<uvs.length;i++){if(!solid[i])continue;const d=Math.hypot(vertices[i*4]-p.x,vertices[i*4+1]-p.y);if(d<distance){distance=d;best={u:uvs[i][0],v:uvs[i][1]};}}
 return best;
}
canvas.addEventListener('pointerdown',e=>{
 if(drag||e.button>0||!ready)return;e.preventDefault();canvas.focus({preventScroll:true});const p=point(e);
 const picked=pick(p);if(!picked)return;const c=grabPoint(state,picked.u,picked.v);
 drag={id:e.pointerId,type:'part',control:c,start:p,base:{x:c.x,y:c.y},moved:0};
 canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;const p=point(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;drag.moved=Math.max(drag.moved,Math.hypot(dx,dy));
 const c=drag.control;c.x=clamp(drag.base.x+dx,-195,195);c.y=clamp(drag.base.y+dy,-165,165);c.vx=c.vy=0;if(drag.moved>9)document.querySelector('#hint').classList.add('gone');
});
function end(e,cancel=false){if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;
 if(cancel)return;
 if(d.moved>10){const c=d.control;if(releaseCheek(state,c,c.x,c.y)){tone('pull');if(state.pulls<4)say('ェ');update();}}
 else if(d.control.v<.25)pet();else poke();
}
canvas.addEventListener('pointerup',e=>end(e));canvas.addEventListener('pointercancel',e=>end(e,true));canvas.addEventListener('lostpointercapture',e=>end(e,true));
window.addEventListener('blur',()=>{drag=null;});
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))return;e.preventDefault();if(e.repeat)return;
 if(e.key==='ArrowUp')pet();else if(e.key===' ')poke();else{const side=e.key==='ArrowLeft'?'left':'right',c=state[side];releaseCheek(state,side,clamp(c.restX+(side==='left'?-100:100),-195,195),c.restY+(state.pulls%2?20:-15));tone('pull');update();document.querySelector('#hint').classList.add('gone');}
});
let ready=false,program,buffer,texture,indices,vertices,uvs,solid,n=40;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('描画の準備ができませんでした');return s;}
function setup(image){
 // Find sprite bounds without baking edits into the original generated asset.
 const scratch=document.createElement('canvas');scratch.width=image.width;scratch.height=image.height;const ctx=scratch.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data;
 let minX=image.width,maxX=0,minY=image.height,maxY=0;
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>50){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 const pad=5;minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(image.width,maxX+pad);maxY=Math.min(image.height,maxY+pad);
 rect.h=rect.w*(maxY-minY)/(maxX-minX);rect.y=525-rect.h;
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 a;attribute vec2 uv;varying vec2 v;void main(){v=uv;gl_Position=vec4(a.x/240.0-1.0,1.0-a.y/300.0,0,1);}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 v;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,v);}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('描画を開始できませんでした');gl.useProgram(program);
 vertices=new Float32Array((n+1)*(n+1)*4);uvs=[];solid=[];const ix=[];
 for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){const i=(y*(n+1)+x)*4;vertices[i+2]=(minX+x/n*(maxX-minX))/image.width;vertices[i+3]=(minY+y/n*(maxY-minY))/image.height;uvs.push([x/n,y/n]);if(x<n&&y<n){const a=y*(n+1)+x,b=a+n+1;ix.push(a,b,a+1,a+1,b,b+1);}}
 indices=new Uint16Array(ix);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
 for(const [u,v] of uvs){const x=Math.min(image.width-1,Math.floor(minX+u*(maxX-minX))),y=Math.min(image.height-1,Math.floor(minY+v*(maxY-minY)));solid.push(pixels[(y*image.width+x)*4+3]>80);}
 const pos=gl.getAttribLocation(program,'a'),uv=gl.getAttribLocation(program,'uv');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);
 texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);ready=true;loading.hidden=true;
}
function frame(now){const dt=Math.min((now-last)/1000,.04);last=now;step(state,dt,drag?.control);hit=Math.max(0,hit-dt*4);stroke=Math.max(0,stroke-dt*1.5);
 if(ready){const bounds=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),width=Math.round(bounds.width*dpr),height=Math.round(bounds.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
  const bob=reduced?0:Math.sin(now/720)*1.8;for(let i=0;i<uvs.length;i++){const [u,v]=uvs[i],d=deform(u,v,state),squash=Math.sin(hit*Math.PI)*.07,petWave=reduced?0:Math.sin(now/85)*stroke*2;vertices[i*4]=rect.x+(u-.5)*rect.w*(1+squash)+rect.w/2+d.x+petWave*(1-v);vertices[i*4+1]=rect.y+v*rect.h+d.y+bob*(1-v)+squash*(1-v)*65;}
  gl.clear(gl.COLOR_BUFFER_BIT);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,vertices);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
 }
 requestAnimationFrame(frame);
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;loading.hidden=false;loading.textContent='画面を再読み込みしてください';});
async function load(){try{if(!gl)throw new Error('このブラウザーでは表示できません。Safari / Chrome で開いてください');const image=new Image();image.src='chiikawa.png';await image.decode();setup(image);requestAnimationFrame(frame);}catch(e){loading.textContent=e.message==='The source image cannot be decoded.'?'画像を読み込めませんでした。再読み込みしてください':e.message;}}
load();
// Optional browser-agent controls mirror the same local game actions.
if(document.modelContext?.registerTool){
 const life=new AbortController();
 const registration={name:'care_for_chiikawa',title:'ちいかわのお世話',description:'Pet, poke, pull one cheek, or reset this local game. Pulls accumulate the same lasting deformation as dragging.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['pet','poke','pull','reset']},side:{type:'string',enum:['left','right']},dx:{type:'number',minimum:-195,maximum:195},dy:{type:'number',minimum:-165,maximum:165}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){
  if(!input||!['pet','poke','pull','reset'].includes(input.action))throw new Error('Unknown action');
  if(input.action==='pull'){
   if(!['left','right'].includes(input.side)||!Number.isFinite(input.dx)||Math.abs(input.dx)>195||!Number.isFinite(input.dy)||Math.abs(input.dy)>165)throw new Error('Pull requires a side and finite dx / dy in range');
   releaseCheek(state,input.side,input.dx,input.dy);update();document.querySelector('#hint').classList.add('gone');
  }else ({pet,poke,reset})[input.action]();
  return {count:state.count,pulls:state.pulls,left:{x:state.left.restX,y:state.left.restY},right:{x:state.right.restX,y:state.right.restY}};
 }};
 try{Promise.resolve(document.modelContext.registerTool(registration,{signal:life.signal})).catch(()=>{});}catch{}
 window.addEventListener('pagehide',()=>life.abort(),{once:true});
}
