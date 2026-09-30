import {createState,grabPoint,releaseCheek,step,deform,clamp} from './physics.mjs';
import {createReactions,react,tickReaction,pose} from './reactions.mjs';
const canvas=document.querySelector('#game'), loading=document.querySelector('#loading');
const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
let state=createState(),emotion=createReactions(),drag=null,last=performance.now(),enabled=true,audio=null,reactionTimer;
let frames={},activeFrame=null,particles=[],currentPose=pose(emotion,0),lastPullSound=0;
const fxCanvas=document.querySelector('#effects'),fx=fxCanvas.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const W=480,H=600,rect={x:112,y:250,w:256,h:280};
function transform(x,y,p){const pivotX=rect.x+rect.w/2,pivotY=525,dx=(x-pivotX)*p.scaleX,dy=(y-pivotY)*p.scaleY,cos=Math.cos(p.angle),sin=Math.sin(p.angle);return{x:pivotX+dx*cos-dy*sin+p.x,y:pivotY+dx*sin+dy*cos+p.y};}
function world(u,v){const d=deform(u,v,state);return transform(rect.x+u*rect.w+d.x,rect.y+v*rect.h+d.y,currentPose);}
function burst(kind,point=world(.5,.25)){
 if(reduced)return;const count=kind==='pet'?7:kind==='poke'?8:4;
 for(let i=0;i<count;i++){const a=i/count*Math.PI*2;particles.push({kind,x:point.x,y:point.y,vx:Math.cos(a)*(kind==='pet'?38:65),vy:Math.sin(a)*44-40,age:0,life:.7+(i%3)*.17,size:kind==='pet'?16+(i%2)*5:12});}particles=particles.slice(-48);
}
function effects(dt){
 fx.clearRect(0,0,W,H);
 for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=16*dt;fx.globalAlpha=Math.max(0,1-p.age/p.life);if(p.kind==='pet'){fx.font=`bold ${p.size}px sans-serif`;fx.fillStyle='#ee8295';fx.fillText('♥',p.x,p.y);}else{fx.strokeStyle=p.kind==='poke'?'#d79c40':'#78afbf';fx.lineWidth=2;fx.beginPath();fx.moveTo(p.x-p.size/2,p.y);fx.lineTo(p.x+p.size/2,p.y);fx.moveTo(p.x,p.y-p.size/2);fx.lineTo(p.x,p.y+p.size/2);fx.stroke();}}
 fx.globalAlpha=1;particles=particles.filter(p=>p.age<p.life);
}
function say(text){const el=document.querySelector('#reaction');el.textContent=text;el.classList.add('show');clearTimeout(reactionTimer);reactionTimer=setTimeout(()=>el.classList.remove('show'),2200);}
function update(){document.querySelector('#count').textContent=state.count;document.querySelector('#mood').textContent=emotion.kind==='pet'?'うれしい':emotion.kind==='poke'?'びっくり':emotion.kind==='pull'||emotion.kind==='release'?'こまった':'よい';}
function tone(kind,intensity=1){
 if(!enabled)return;try{
  audio??=new (window.AudioContext||window.webkitAudioContext)();void audio.resume();
  const patterns={pet:[[0,640,910,.13],[.15,780,1120,.16]],poke:[[0,520,1060,.065],[.08,960,380,.16]],pull:[[0,650,420,.24],[.24,560,230,.22]],release:[[0,410,220,.24]],hello:[[0,600,840,.13]]};
  for(const [delay,from,to,length] of patterns[kind]||patterns.poke){const t=audio.currentTime+delay,osc=audio.createOscillator(),gain=audio.createGain(),vibrato=audio.createOscillator(),depth=audio.createGain();osc.type='triangle';osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+length);vibrato.frequency.value=kind==='pull'?24:11;depth.gain.value=kind==='pull'?25:10;vibrato.connect(depth);depth.connect(osc.frequency);gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(.025+.018*clamp(intensity,0,1),t+.018);gain.gain.exponentialRampToValueAtTime(.001,t+length);osc.connect(gain);gain.connect(audio.destination);osc.start(t);vibrato.start(t);osc.stop(t+length+.02);vibrato.stop(t+length+.02);}
 }catch{}
}
function respond(kind,options={}){say(react(emotion,kind,options));tone(kind,options.intensity);update();if(kind==='pet'||kind==='poke')burst(kind,options.point);}
function pet(){if(!ready)return;state.count++;respond('pet');}
function poke(point){if(!ready)return;state.count++;respond('poke',{point});}
function reset(){state=createState();emotion=createReactions();drag=null;particles=[];respond('hello');document.querySelector('#hint').classList.remove('gone');}
document.querySelector('#pet').onclick=pet;document.querySelector('#poke').onclick=()=>poke();document.querySelector('#reset').onclick=reset;
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
 drag={id:e.pointerId,type:'part',control:c,start:p,base:{x:c.x,y:c.y},moved:0,reacted:false,lastX:p.x,direction:0,reversals:0,stroking:false};
 canvas.setPointerCapture(e.pointerId);
 react(emotion,picked.v<.24?'pet':'poke',{intensity:.4});update();
});
canvas.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;const p=point(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;drag.moved=Math.max(drag.moved,Math.hypot(dx,dy));
 const c=drag.control;c.x=clamp(drag.base.x+dx,-195,195);c.y=clamp(drag.base.y+dy,-165,165);c.vx=c.vy=0;
 const moveX=p.x-drag.lastX,nextDirection=Math.abs(moveX)>2?Math.sign(moveX):drag.direction;
 if(nextDirection&&drag.direction&&nextDirection!==drag.direction)drag.reversals++;
 drag.lastX=p.x;drag.direction=nextDirection;
 if(c.v<.24&&drag.moved<65&&Math.abs(dy)<30&&drag.reversals>=2){
  drag.stroking=true;c.x=drag.base.x;c.y=drag.base.y;
  if(emotion.kind!=='pet')respond('pet');else emotion.age=0;
  return;
 }
 drag.stroking=false;
 if(drag.moved>10){const intensity=clamp(drag.moved/110,.25,1),direction=Math.sign(dx);if(!drag.reacted){drag.reacted=true;respond('pull',{intensity,direction});lastPullSound=performance.now();}emotion.kind='pull';emotion.age=0;emotion.intensity=intensity;emotion.direction=direction;if(performance.now()-lastPullSound>1100){lastPullSound=performance.now();say(drag.moved>100?'ヤーッ':'アー…');tone('pull',intensity);}document.querySelector('#hint').classList.add('gone');}
});
function end(e,cancel=false){if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;
 if(cancel){react(emotion,'release',{intensity:.4});update();return;}
 if(d.stroking){d.control.x=d.base.x;d.control.y=d.base.y;pet();}
 else if(d.moved>10){const c=d.control;if(releaseCheek(state,c,c.x,c.y)){respond('release',{intensity:clamp(d.moved/100,.3,1)});burst('release',point(e));}}
 else if(d.control.v<.25)pet();else poke(point(e));
}
canvas.addEventListener('pointerup',e=>end(e));canvas.addEventListener('pointercancel',e=>end(e,true));canvas.addEventListener('lostpointercapture',e=>end(e,true));
window.addEventListener('blur',()=>{drag=null;});
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))return;e.preventDefault();if(e.repeat)return;
 if(e.key==='ArrowUp')pet();else if(e.key===' ')poke();else{const side=e.key==='ArrowLeft'?'left':'right',c=state[side];releaseCheek(state,side,clamp(c.restX+(side==='left'?-100:100),-195,195),c.restY+(state.pulls%2?20:-15));respond('pull',{intensity:1,direction:side==='left'?-1:1});document.querySelector('#hint').classList.add('gone');}
});
let ready=false,program,buffer,texture,indices,vertices,uvs,solid,n=40;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('描画の準備ができませんでした');return s;}
function setup(image){
 // Find sprite bounds without baking edits into the original generated asset.
 const scratch=document.createElement('canvas');scratch.width=image.width;scratch.height=image.height;const ctx=scratch.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data;
 let minX=image.width,maxX=0,minY=image.height,maxY=0;
 for(let y=0;y<Math.floor(image.height/2);y++)for(let x=0;x<Math.floor(image.width/2);x++)if(pixels[(y*image.width+x)*4+3]>50){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 const pad=5;minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(image.width,maxX+pad);maxY=Math.min(image.height,maxY+pad);
 rect.h=rect.w*(maxY-minY)/(maxX-minX);rect.y=525-rect.h;
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 a;attribute vec2 uv;varying vec2 v;void main(){v=uv;gl_Position=vec4(a.x/240.0-1.0,1.0-a.y/300.0,0,1);}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 v;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,v);}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('描画を開始できませんでした');gl.useProgram(program);
 vertices=new Float32Array((n+1)*(n+1)*4);uvs=[];solid=[];const ix=[];
 for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){const i=(y*(n+1)+x)*4;vertices[i+2]=(minX+x/n*(maxX-minX))/image.width;vertices[i+3]=(minY+y/n*(maxY-minY))/image.height;uvs.push([x/n,y/n]);if(x<n&&y<n){const a=y*(n+1)+x,b=a+n+1;ix.push(a,b,a+1,a+1,b,b+1);}}
 indices=new Uint16Array(ix);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
 for(const [u,v] of uvs){const x=Math.min(image.width-1,Math.floor(minX+u*(maxX-minX))),y=Math.min(image.height-1,Math.floor(minY+v*(maxY-minY)));solid.push(pixels[(y*image.width+x)*4+3]>80);}
 const pos=gl.getAttribLocation(program,'a'),uv=gl.getAttribLocation(program,'uv');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);
 texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);ready=true;loading.hidden=true;
 frames.neutral={texture,minX,maxX,minY,maxY,width:image.width,height:image.height};
}
function setExpression(name){const f=frames[name]||frames.neutral;if(activeFrame===f)return;activeFrame=f;gl.bindTexture(gl.TEXTURE_2D,f.texture);for(let i=0;i<uvs.length;i++){const [u,v]=uvs[i];vertices[i*4+2]=(f.minX+u*(f.maxX-f.minX))/f.width;vertices[i*4+3]=(f.minY+v*(f.maxY-f.minY))/f.height;}canvas.dataset.expression=name;}
function frame(now){const dt=Math.max(0,(now-last)/1000);last=now;step(state,dt,drag?.control);const previous=emotion.kind;tickReaction(emotion,dt);if(previous!==emotion.kind)update();
 if(ready){const bounds=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),width=Math.round(bounds.width*dpr),height=Math.round(bounds.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=fxCanvas.width=width;canvas.height=fxCanvas.height=height;gl.viewport(0,0,width,height);}fx.setTransform(width/W,0,0,height/H,0,0);
  currentPose=pose(emotion,now,Boolean(drag?.reacted&&!drag?.stroking),reduced);setExpression(currentPose.expression);
  for(let i=0;i<uvs.length;i++){const [u,v]=uvs[i],d=deform(u,v,state),p=transform(rect.x+u*rect.w+d.x,rect.y+v*rect.h+d.y,currentPose);vertices[i*4]=p.x;vertices[i*4+1]=p.y;}
  gl.clear(gl.COLOR_BUFFER_BIT);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,vertices);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);effects(dt);
  const head=world(.5,.02),bubble=document.querySelector('#reaction');bubble.style.left=`${clamp(head.x,85,W-85)/W*100}%`;bubble.style.top=`${clamp(head.y-24,100,470)/H*100}%`;
 }
 requestAnimationFrame(frame);
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;loading.hidden=false;loading.textContent='画面を再読み込みしてください';});
async function load(){try{if(!gl)throw new Error('このブラウザーでは表示できません。Safari / Chrome で開いてください');const image=new Image();image.src='reactions.png?v=1.1.0';await image.decode();setup(image);requestAnimationFrame(frame);await loadExpressions(image);}catch(e){if(ready)console.warn('表情画像を読み込めませんでした');else loading.textContent=e.message==='The source image cannot be decoded.'?'画像を読み込めませんでした。再読み込みしてください':e.message;}}
async function loadExpressions(image){
 const scratch=document.createElement('canvas');scratch.width=image.width;scratch.height=image.height;const ctx=scratch.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data;
 const texture=frames.neutral.texture;
 const cw=Math.floor(image.width/2),ch=Math.floor(image.height/2);
 for(const [name,col,row] of [['neutral',0,0],['happy',1,0],['surprised',0,1],['worried',1,1]]){const ax=col*cw,ay=row*ch;let minX=ax+cw,maxX=ax,minY=ay+ch,maxY=ay;for(let y=ay;y<ay+ch;y++)for(let x=ax;x<ax+cw;x++)if(pixels[(y*image.width+x)*4+3]>50){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}frames[name]={texture,minX:Math.max(ax,minX-4),maxX:Math.min(ax+cw,maxX+4),minY:Math.max(ay,minY-4),maxY:Math.min(ay+ch,maxY+4),width:image.width,height:image.height};}
 const base=frames.neutral;rect.h=rect.w*(base.maxY-base.minY)/(base.maxX-base.minX);rect.y=525-rect.h;
 solid=uvs.map(([u,v])=>{const x=Math.min(image.width-1,Math.floor(base.minX+u*(base.maxX-base.minX))),y=Math.min(image.height-1,Math.floor(base.minY+v*(base.maxY-base.minY)));return pixels[(y*image.width+x)*4+3]>80;});
 activeFrame=null;
}
load();
// Optional browser-agent controls mirror the same local game actions.
if(document.modelContext?.registerTool){
 const life=new AbortController();
 const registration={name:'care_for_chiikawa',title:'ちいかわのお世話',description:'Pet, poke, pull one cheek, or reset the local game. Updates the face, body movement, sound and lasting deformation.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['pet','poke','pull','reset']},side:{type:'string',enum:['left','right']},dx:{type:'number',minimum:-195,maximum:195},dy:{type:'number',minimum:-165,maximum:165}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(input){
  if(!input||!['pet','poke','pull','reset'].includes(input.action))throw new Error('Unknown action');
  if(input.action==='pull'){
   if(!['left','right'].includes(input.side)||!Number.isFinite(input.dx)||Math.abs(input.dx)>195||!Number.isFinite(input.dy)||Math.abs(input.dy)>165)throw new Error('Pull requires a side and finite dx / dy in range');
   releaseCheek(state,input.side,input.dx,input.dy);respond('pull',{intensity:clamp(Math.hypot(input.dx,input.dy)/150,.2,1),direction:Math.sign(input.dx)});document.querySelector('#hint').classList.add('gone');
  }else ({pet,poke:()=>poke(),reset})[input.action]();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return {count:state.count,pulls:state.pulls,reaction:emotion.kind,expression:pose(emotion,performance.now()).expression,left:{x:state.left.restX,y:state.left.restY},right:{x:state.right.restX,y:state.right.restY}};
 }};
 try{Promise.resolve(document.modelContext.registerTool(registration,{signal:life.signal})).catch(()=>{});}catch{}
 window.addEventListener('pagehide',()=>life.abort(),{once:true});
}
