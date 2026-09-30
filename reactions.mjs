import {clamp} from './physics.mjs';
const durations={pet:1.8,poke:1.2,pull:1.4,release:1.5,hello:1.4};
const lines={pet:['わーい','エヘ…','♪'],poke:['ワッ','アッ','エッ'],pull:['ヤーッ','アー…','ワァ…'],release:['ふぅ…','ハァ…','…ッ'],hello:['…♪']};
export function createReactions(){return {kind:'idle',age:0,duration:0,intensity:0,direction:0,idleTime:0,visits:{},line:''};}
export function react(r,kind,{intensity=1,direction=0}={}){
 if(!durations[kind])throw new Error('Unknown reaction');
 const visit=r.visits[kind]||0;r.visits[kind]=visit+1;
 r.kind=kind;r.age=0;r.duration=durations[kind];r.intensity=clamp(intensity,0,1);r.direction=clamp(direction,-1,1);r.idleTime=0;
 r.line=lines[kind][visit%lines[kind].length];return r.line;
}
export function tickReaction(r,dt){const h=clamp(dt,0,60);r.age+=h;r.idleTime+=h;if(r.kind!=='idle'&&r.age>=r.duration){r.kind='idle';r.age=0;r.line='';}}
export function pose(r,now,held=false,reduced=false){
 const age=r.age,fade=Math.max(0,1-age/(r.duration||1));
 let expression='neutral',x=0,y=0,angle=0,scaleX=1,scaleY=1;
 if(r.kind==='pet'){expression='happy';y=-Math.abs(Math.sin(age*7.8))*10*fade;angle=Math.sin(age*9)*.045*fade;scaleX=1+Math.sin(age*12)*.025*fade;scaleY=1-Math.sin(age*12)*.025*fade;}
 else if(r.kind==='poke'){expression='surprised';y=-Math.sin(Math.min(1,age/.7)*Math.PI)*27;x=Math.sin(age*29)*5*fade;angle=Math.sin(age*20)*.06*fade;scaleX=1-.065*fade;scaleY=1+.065*fade;}
 else if(r.kind==='pull'||held){expression='worried';x=-r.direction*7*r.intensity;angle=-r.direction*.06*r.intensity;y=Math.sin(now/75)*2*r.intensity;scaleY=1-.025*r.intensity;}
 else if(r.kind==='release'){expression=age<.85?'worried':'surprised';x=Math.sin(age*34)*7*fade;angle=Math.sin(age*23)*.075*fade;}
 else if(r.kind==='hello')expression='happy';
 if(r.kind==='idle'&&!held){y=Math.sin(now/650)*2;if((r.idleTime%5.4)>5.23)expression='happy';}
 if(reduced){x=y=angle=0;scaleX=scaleY=1;}
 return {expression,x,y,angle,scaleX,scaleY};
}
