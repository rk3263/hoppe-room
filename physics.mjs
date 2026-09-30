export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function control(u,v,id){return {id,u,v,radius:v>.72?.18:.29,x:0,y:0,vx:0,vy:0,restX:0,restY:0};}
export function createState(){const left=control(.21,.50,'left'),right=control(.79,.50,'right');return {count:0,pulls:0,left,right,points:[left,right]};}
export function grabPoint(state,u,v){
 let nearest=state.points[0],distance=Infinity;
 for(const c of state.points){const d=Math.hypot(c.u-u,c.v-v);if(d<distance){distance=d;nearest=c;}}
 if(distance<.085||state.points.length>=40)return nearest;
 const c=control(clamp(u,0,1),clamp(v,0,1),'part-'+state.points.length);state.points.push(c);return c;
}
export function releaseCheek(state,side,dx,dy){
 const c=typeof side==='string'?state[side]:side, distance=Math.hypot(dx-c.restX,dy-c.restY);
 if(distance<10)return false;
 state.pulls++;state.count++;
 const retention=Math.min(.64,.05+state.pulls*.036);
 // Deliberately accumulate plastic deformation: the joke is the broken return spring.
 c.restX=clamp(c.restX+(dx-c.restX)*retention,-155,155);
 c.restY=clamp(c.restY+(dy-c.restY)*retention,-135,135);
 c.x=dx;c.y=dy;return true;
}
export function step(state,dt,active){
 const h=Math.min(Math.max(dt,0),.035);
 for(const c of state.points){if(c===active||c.id===active)continue;
 c.vx+=(c.restX-c.x)*135*h;c.vy+=(c.restY-c.y)*135*h;
 c.vx*=Math.exp(-11*h);c.vy*=Math.exp(-11*h);c.x+=c.vx*h;c.y+=c.vy*h;
 }
}
export function deform(u,v,state){
 let x=0,y=0;
 for(const c of state.points){
  const w=Math.exp(-(((u-c.u)/c.radius)**2+((v-c.v)/c.radius)**2)*1.6);
  x+=c.x*w;y+=c.y*w;
 }
 return {x:clamp(x,-230,230),y:clamp(y,-220,220)};
}
