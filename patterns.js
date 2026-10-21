"use strict";
(() => {
 const S=1024;
 const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const surface=()=>{const c=document.createElement('canvas');c.width=c.height=S;return c;};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function leaf(ctx,x,y,angle,length,width){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-width,-length*.25,-width,-length*.74,0,-length);ctx.bezierCurveTo(width,-length*.74,width,-length*.25,0,0);ctx.fill();
  ctx.globalCompositeOperation='destination-out';ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(0,-length*.12);ctx.quadraticCurveTo(width*.10,-length*.5,0,-length*.84);ctx.stroke();ctx.restore();
 }
 function seedLayer(seed,recipe){
   const canvas=surface(),sc=canvas.getContext('2d'),t=recipe.thickness/100;
   const rng=random(seed.variant??(recipe.randomSeed+seed.id*13)),radius=75+seed.spread*1.9,density=seed.density??recipe.density??6;
   sc.save();sc.translate(seed.x*S,seed.y*S);sc.rotate(seed.angle);sc.fillStyle='#fff';sc.strokeStyle='#fff';sc.lineCap='round';sc.lineJoin='round';
   if(seed.type==='bloom'){
    const petals=density+2,inner=radius*.18;
    for(let k=0;k<petals;k++){const a=k/petals*Math.PI*2+(rng()-.5)*.10,len=radius*(.78+rng()*.22);leaf(sc,Math.sin(a)*inner,Math.cos(a)*inner,Math.PI-a,len-inner,len*(.17+t*.10));}
    sc.beginPath();sc.arc(0,0,inner*.90,0,Math.PI*2);sc.fill();sc.globalCompositeOperation='destination-out';sc.beginPath();sc.arc(0,0,inner*.51,0,Math.PI*2);sc.fill();sc.globalCompositeOperation='source-over';sc.beginPath();sc.arc(0,0,inner*.19,0,Math.PI*2);sc.fill();
    for(let k=0;k<petals;k++){const a=(k+.5)/petals*Math.PI*2;sc.beginPath();sc.arc(Math.sin(a)*radius*1.05,Math.cos(a)*radius*1.05,3+t*3,0,Math.PI*2);sc.fill();}
   }else if(seed.type==='frond'){
    const bend=(rng()-.5)*radius*.6;sc.lineWidth=5+t*7;sc.beginPath();sc.moveTo(0,radius*.85);sc.bezierCurveTo(bend*1.7,radius*.3,-bend,-radius*.4,0,-radius);sc.stroke();
    for(let k=0;k<density;k++){const u=(k+.6)/(density+1),y=radius*.73-u*radius*1.5,x=Math.sin(u*Math.PI*2)*bend*.35,len=radius*(.27+Math.sin(u*Math.PI)*.30);leaf(sc,x,y,-.70,len,len*.23);leaf(sc,x,y,.70,len*(.88+rng()*.2),len*.23);}leaf(sc,0,-radius*.63,0,radius*.44,radius*.09);
   }else if(seed.type==='orbit'){
    const rings=density+1;sc.lineWidth=6+t*8;for(let k=0;k<rings;k++){const r=radius*(.23+k/(rings-1)*.77);sc.beginPath();for(let j=0;j<=180;j++){const a=j/180*Math.PI*2,rr=r*(1+.045*Math.sin(a*3+k*.9)),x=Math.cos(a)*rr,y=Math.sin(a)*rr*.80;j?sc.lineTo(x,y):sc.moveTo(x,y);}sc.closePath();sc.stroke();}sc.beginPath();sc.arc(0,0,radius*.12,0,Math.PI*2);sc.fill();
   }else if(seed.type==='butterfly'){
    sc.lineWidth=5+t*6;sc.beginPath();sc.ellipse(0,0,radius*.065,radius*.55,0,0,Math.PI*2);sc.fill();
    for(const side of [-1,1]){
     sc.save();sc.scale(side,1);sc.beginPath();sc.moveTo(radius*.04,-radius*.12);sc.bezierCurveTo(radius*.30,-radius*1.12,radius*.98,-radius*1.0,radius*.90,-radius*.28);sc.bezierCurveTo(radius*.85,radius*.10,radius*.45,radius*.06,radius*.05,radius*.16);sc.bezierCurveTo(radius*.82,-radius*.02,radius*.94,radius*.80,radius*.43,radius*.83);sc.bezierCurveTo(radius*.13,radius*.86,radius*.10,radius*.36,radius*.04,radius*.15);sc.fill();
     sc.globalCompositeOperation='destination-out';sc.lineWidth=3+t*2;for(let k=0;k<density;k++){const u=(k+1)/(density+1);sc.beginPath();sc.moveTo(radius*.12,-radius*.04);sc.quadraticCurveTo(radius*(.2+u*.3),-radius*(.12+u*.4),radius*(.4+u*.36),-radius*(.2+u*.58));sc.stroke();}sc.beginPath();sc.ellipse(radius*.43,radius*.45,radius*.12,radius*.15,-.3,0,Math.PI*2);sc.stroke();sc.globalCompositeOperation='source-over';sc.beginPath();sc.moveTo(radius*.03,-radius*.38);sc.quadraticCurveTo(radius*.18,-radius*.70,radius*.24,-radius*.63);sc.stroke();sc.restore();
    }
   }else if(seed.type==='fish'){
    sc.beginPath();sc.moveTo(-radius*.93,0);sc.bezierCurveTo(-radius*.40,-radius*.70,radius*.26,-radius*.60,radius*.62,0);sc.bezierCurveTo(radius*.26,radius*.60,-radius*.40,radius*.70,-radius*.93,0);sc.fill();sc.beginPath();sc.moveTo(radius*.55,0);sc.lineTo(radius*1.03,-radius*.48);sc.lineTo(radius*.90,0);sc.lineTo(radius*1.03,radius*.48);sc.closePath();sc.fill();
    sc.globalCompositeOperation='destination-out';sc.beginPath();sc.arc(-radius*.61,-radius*.06,radius*.055,0,Math.PI*2);sc.fill();sc.lineWidth=3+t*2;sc.beginPath();sc.moveTo(-radius*.36,-radius*.35);sc.quadraticCurveTo(-radius*.09,0,-radius*.36,radius*.35);sc.stroke();for(let k=0;k<density;k++){let x=-radius*.12+k/(density+1)*radius*.7;sc.beginPath();sc.moveTo(x,-radius*.26);sc.quadraticCurveTo(x+radius*.25,0,x,radius*.26);sc.stroke();}sc.globalCompositeOperation='source-over';sc.lineWidth=5+t*3;sc.beginPath();sc.moveTo(-radius*.12,-radius*.42);sc.lineTo(radius*.13,-radius*.72);sc.lineTo(radius*.39,-radius*.30);sc.stroke();
   }else if(seed.type==='bird'){
    sc.lineWidth=5+t*5;sc.beginPath();sc.moveTo(-radius*.46,-radius*.12);sc.bezierCurveTo(-radius*.23,radius*.49,radius*.45,radius*.42,radius*.57,-radius*.02);sc.bezierCurveTo(radius*.15,-radius*.32,-radius*.04,-radius*.34,-radius*.46,-radius*.12);sc.fill();sc.beginPath();sc.moveTo(-radius*.42,-radius*.03);sc.bezierCurveTo(-radius*.48,-radius*.80,-radius*.15,-radius*.96,-radius*.15,-radius*.54);sc.stroke();sc.beginPath();sc.arc(-radius*.19,-radius*.64,radius*.14,0,Math.PI*2);sc.fill();sc.beginPath();sc.moveTo(-radius*.30,-radius*.65);sc.lineTo(-radius*.57,-radius*.57);sc.lineTo(-radius*.29,-radius*.53);sc.fill();
    for(let k=0;k<density;k++){const a=-.8+k/(density-1)*1.5;leaf(sc,radius*.43,radius*.07,a+Math.PI/2,radius*(.44+rng()*.25),radius*.10);}sc.globalCompositeOperation='destination-out';sc.lineWidth=3+t*2;sc.beginPath();sc.moveTo(-radius*.22,-radius*.10);sc.quadraticCurveTo(radius*.06,radius*.32,radius*.29,-radius*.03);sc.stroke();sc.beginPath();sc.arc(-radius*.22,-radius*.67,radius*.028,0,Math.PI*2);sc.fill();sc.globalCompositeOperation='source-over';sc.lineWidth=4;for(const x of [-.05,.18]){sc.beginPath();sc.moveTo(radius*x,radius*.27);sc.lineTo(radius*(x-.04),radius*.64);sc.lineTo(radius*(x-.18),radius*.67);sc.stroke();}
   }else if(seed.type==='pomegranate'){
    sc.beginPath();sc.moveTo(0,-radius*.65);sc.bezierCurveTo(-radius*.95,-radius*.71,-radius*.94,radius*.72,0,radius*.82);sc.bezierCurveTo(radius*.94,radius*.72,radius*.95,-radius*.71,0,-radius*.65);sc.fill();sc.beginPath();sc.moveTo(-radius*.23,-radius*.61);sc.lineTo(-radius*.30,-radius*.94);sc.lineTo(-radius*.07,-radius*.80);sc.lineTo(0,-radius*1.02);sc.lineTo(radius*.09,-radius*.80);sc.lineTo(radius*.30,-radius*.94);sc.lineTo(radius*.23,-radius*.61);sc.fill();
    sc.globalCompositeOperation='destination-out';sc.lineWidth=4;sc.beginPath();sc.ellipse(0,radius*.08,radius*.48,radius*.52,0,0,Math.PI*2);sc.stroke();const rows=Math.max(3,Math.round(density*.65));for(let y=0;y<rows;y++)for(let x=0;x<rows;x++){const px=(x-(rows-1)/2)*radius*.65/rows,py=(y-(rows-1)/2)*radius*.72/rows+radius*.10;sc.beginPath();sc.ellipse(px,py,radius*.04,radius*.055,.3,0,Math.PI*2);sc.fill();}
   }else if(seed.type==='spiral'){
    sc.lineWidth=6+t*8;const turns=1.6+density*.28;sc.beginPath();for(let k=0;k<=400;k++){const u=k/400,a=u*Math.PI*2*turns,r=radius*(.06+u*.88),x=Math.cos(a)*r,y=Math.sin(a)*r;k?sc.lineTo(x,y):sc.moveTo(x,y);}sc.stroke();
   }else if(seed.type==='drum'){
    const rays=density+5;sc.lineWidth=5+t*4;for(const scale of [.22,.49,.78,.96]){sc.beginPath();sc.arc(0,0,radius*scale,0,Math.PI*2);sc.stroke();}for(let k=0;k<rays;k++){const a=k/rays*Math.PI*2;sc.save();sc.rotate(a);sc.beginPath();sc.moveTo(-radius*.065,-radius*.24);sc.lineTo(0,-radius*.46);sc.lineTo(radius*.065,-radius*.24);sc.fill();sc.beginPath();sc.arc(0,-radius*.63,radius*.04,0,Math.PI*2);sc.fill();sc.restore();}sc.beginPath();sc.arc(0,0,radius*.11,0,Math.PI*2);sc.fill();
   }
   sc.restore();return canvas;
 }
 function paintInk(ctx,strokes){
  ctx.save();ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineCap='round';ctx.lineJoin='round';
  for(const s of strokes||[]){const points=s.points;if(!points.length)continue;ctx.lineWidth=s.size;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);if(points.length===1){ctx.arc(points[0].x,points[0].y,s.size/2,0,Math.PI*2);ctx.fill();continue;}for(let i=1;i<points.length-1;i++){const p=points[i],q=points[i+1];ctx.quadraticCurveTo(p.x,p.y,(p.x+q.x)/2,(p.y+q.y)/2);}const last=points.at(-1);ctx.lineTo(last.x,last.y);ctx.stroke();}ctx.restore();
 }
 const layerCache=new Map();
 function waxPattern(canvas,recipe){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,S,S);ctx.fillStyle='#fff';ctx.strokeStyle='#fff';ctx.lineCap='round';ctx.lineJoin='round';
  const t=recipe.thickness/100;
  // An original double-line border; no third-party motif assets.
  ctx.lineWidth=3+t*5;ctx.strokeRect(43,43,938,938);ctx.lineWidth=1.5;ctx.strokeRect(57,57,910,910);
  for(let k=0;k<24;k++){const x=82+k*37.4;for(const [px,py] of [[x,29],[x,995],[29,x],[995,x]]){ctx.beginPath();ctx.arc(px,py,2+t,0,Math.PI*2);ctx.fill();}}
  const active=new Set(recipe.seeds.map(s=>s.id));for(const id of layerCache.keys())if(!active.has(id))layerCache.delete(id);
  for(const seed of recipe.seeds){const signature=JSON.stringify([seed,recipe.thickness,seed.variant===undefined?recipe.randomSeed:0,seed.density===undefined?recipe.density:0]);let entry=layerCache.get(seed.id);if(!entry||entry.signature!==signature){entry={signature,canvas:seedLayer(seed,recipe)};layerCache.set(seed.id,entry);}ctx.drawImage(entry.canvas,0,0);}
  paintInk(ctx,recipe.strokes);
  return canvas;
 }
 class WaxField{
  constructor(canvas){this.n=256;this.build(canvas);}
  build(canvas){
   const n=this.n,c=document.createElement('canvas');c.width=c.height=n;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,n,n);const image=ctx.getImageData(0,0,n,n).data;this.coverage=new Float32Array(n*n);this.distance=new Float32Array(n*n);
   for(let i=0;i<n*n;i++){this.coverage[i]=image[i*4+3]/255;this.distance[i]=this.coverage[i]>.4?10000:0;}
   const d=this.distance,sq=Math.SQRT2;
   for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=y*n+x;if(d[i])d[i]=Math.min(d[i],d[i-1]+1,d[i-n]+1,d[i-n-1]+sq,d[i-n+1]+sq);}
   for(let y=n-2;y>0;y--)for(let x=n-2;x>0;x--){const i=y*n+x;if(d[i])d[i]=Math.min(d[i],d[i+1]+1,d[i+n]+1,d[i+n+1]+sq,d[i+n-1]+sq);}
  }
  index(x,y){return clamp(Math.round(y/S*this.n),1,this.n-2)*this.n+clamp(Math.round(x/S*this.n),1,this.n-2);}
  at(x,y){return this.coverage[this.index(x,y)];}
  gradient(x,y){const i=this.index(x,y),d=this.distance;return {x:(d[i+1]-d[i-1])*.5,y:(d[i+this.n]-d[i-this.n])*.5};}
 }
 function generateCracks(canvas,recipe,field){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,S,S);ctx.strokeStyle='#fff';ctx.lineCap='round';ctx.lineJoin='round';
  let branches=0;
  const widthFactor=(1.2-recipe.thickness/140);
  recipe.gestures.forEach((gesture,gi)=>{
   const rng=random(recipe.randomSeed+gi*7357+3991),power=gesture.strength/100;
   const trace=(x,y,angle,length,depth)=>{
    const points=[{x,y}];let outside=0;const step=3.2+rng()*2;
    for(let j=0;j<length/step;j++){
     const g=field.gradient(x,y);angle+=(rng()-.5)*.48;
     // A small boundary-directed bias. This is a heuristic, not a fracture solver.
     const gradAngle=Math.atan2(-g.y,-g.x),diff=Math.atan2(Math.sin(gradAngle-angle),Math.cos(gradAngle-angle));if(Math.hypot(g.x,g.y)>.05)angle+=diff*.035;
     x+=Math.cos(angle)*step;y+=Math.sin(angle)*step;
     if(x<6||x>S-6||y<6||y>S-6)break;
     outside=field.at(x,y)<.3?outside+1:0;if(outside>2)break;points.push({x,y});
     if(depth<2&&j>3&&j%9===0&&rng()<.36+power*.20)trace(x,y,angle+(rng()>.5?1:-1)*(.55+rng()*.6),length*.34,depth+1);
    }
    if(points.length<3)return;ctx.lineWidth=(1.2+power*3.7)*widthFactor*(depth? .55:1);ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let k=1;k<points.length;k++)ctx.lineTo(points[k].x,points[k].y);ctx.stroke();branches++;
   };
   let last=null;
   for(let pi=0;pi<gesture.points.length;pi++){
    const p=gesture.points[pi];if(last&&Math.hypot(p.x-last.x,p.y-last.y)<13)continue;
    const prev=gesture.points[Math.max(0,pi-1)],next=gesture.points[Math.min(gesture.points.length-1,pi+1)];let angle=Math.atan2(next.y-prev.y,next.x-prev.x)+Math.PI/2;last=p;
    if(field.at(p.x,p.y)<.28)continue;
    const length=(30+power*130)*(1.35-recipe.thickness/170);trace(p.x,p.y,angle+(rng()-.5)*.6,length,0);trace(p.x,p.y,angle+Math.PI+(rng()-.5)*.6,length*.8,0);
   }
  });
  return branches;
 }
 window.BatikPatterns={surface,waxPattern,seedLayer,paintInk,WaxField,generateCracks,random};
})();
