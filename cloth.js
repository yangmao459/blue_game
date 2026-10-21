"use strict";
(() => {
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const VS=`precision highp float;
 attribute vec3 position;attribute vec3 normal;attribute vec2 texcoord;attribute float moisture;
 uniform mat4 camera;uniform vec3 lamp;uniform float floorY;uniform float shadow;uniform float kind;
 varying vec3 world;varying vec3 norm;varying vec2 uv;varying float wet;
 void main(){vec3 p=position;if(shadow>.5){float h=max(0.,p.y-floorY);p-=lamp*h/lamp.y;p.y=floorY+.004;}
 world=p;norm=normal;uv=texcoord;wet=moisture;gl_Position=camera*vec4(p,1.);gl_PointSize=kind>9.5?4.:kind>8.5?42.+moisture*40.:4.;}`;
 const FS=`precision highp float;
 uniform sampler2D fabric;uniform sampler2D waxMask;uniform sampler2D crackMask;uniform vec3 lamp;uniform vec3 eye;uniform float shadow;uniform float kind;uniform float alpha;uniform float time;uniform float waxRemain;
 varying vec3 world;varying vec3 norm;varying vec2 uv;varying float wet;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){
 if(shadow>.5){gl_FragColor=vec4(.13,.12,.10,.16);return;}
 if(kind>9.5){float d=distance(gl_PointCoord,vec2(.5));if(d>.48)discard;gl_FragColor=vec4(.62,.77,.79,.55*(1.-d));return;}
 if(kind>8.5){float a=1.-smoothstep(.1,.5,distance(gl_PointCoord,vec2(.5)));gl_FragColor=vec4(.93,.93,.86,a*.085*wet);return;}
 if(kind>7.5){gl_FragColor=vec4(vec3(.76,.60,.29)*(.6+.4*max(0.,dot(normalize(norm),normalize(lamp)))),1.);return;}
 if(kind>6.5){gl_FragColor=vec4(vec3(.49,.30,.14)*(.65+.35*max(0.,dot(normalize(norm),normalize(lamp)))),1.);return;}
 if(kind>5.5){gl_FragColor=vec4(vec3(.30,.19,.10)*(.65+.35*max(0.,dot(normalize(norm),normalize(lamp)))),1.);return;}
 if(kind>4.5){gl_FragColor=vec4(.08,.17,.19,1.);return;}
 if(kind>3.5){gl_FragColor=vec4(.08,.19,.23,.7);return;}
 if(kind>2.5){if(distance(gl_PointCoord,vec2(.5))>.48)discard;gl_FragColor=vec4(.28,.70,.77,1.);return;}
 if(kind>1.5){float rip=sin(world.x*18.+time)*sin(world.z*16.-time*.7);gl_FragColor=vec4(vec3(.08,.22,.28)+rip*.012,.28);return;}
 if(kind>.5){float grain=sin(world.x*95.+sin(world.z*4.)*2.)*.014+hash(floor(world.xz*700.))*.025;gl_FragColor=vec4(vec3(.57,.45,.31)+grain,1.);return;}
 vec3 n=normalize(norm)*(gl_FrontFacing?1.:-1.);vec3 l=normalize(lamp);vec3 v=normalize(eye-world);
 vec3 base=texture2D(fabric,uv).rgb;
 float wax=texture2D(waxMask,uv).a*(1.-smoothstep(.02,.4,texture2D(crackMask,uv).a))*waxRemain;
 float ex=texture2D(waxMask,uv+vec2(.0015,0)).a-texture2D(waxMask,uv-vec2(.0015,0)).a;
 float ey=texture2D(waxMask,uv+vec2(0,.0015)).a-texture2D(waxMask,uv-vec2(0,.0015)).a;
 n=normalize(n+vec3(ex*.16,ey*.08,ey*.16)*waxRemain);
 float thread=sin(uv.x*2262.)*sin(uv.y*2262.);base*=1.-wet*.15;
 float light=.50+.50*max(0.,dot(n,l));float back=.06*max(0.,dot(-n,l));
 float spec=pow(max(0.,dot(n,normalize(l+v))),mix(18.,70.,max(wet,wax)))*mix(.022,.17,max(wet,wax));
 float sheen=pow(1.-abs(dot(n,v)),4.)*.085*(1.-wax*.7);
 gl_FragColor=vec4(base*(light+back+thread*.012)+spec+sheen,alpha);
 }`;
 function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 function makeProgram(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
 class Cloth {
  constructor(canvas,material,options={}){
   this.canvas=canvas;this.material=material;this.options=options;this.stage='COMPOSE';this.active=true;this.view='cloth';this.yaw=0;this.lampAngle=-.65;this.grab=null;this.time=0;this.stageTime=0;this.bathLevel=-.65;this.immersion=1;this.dip=0;this.removedWax=0;this.frame=0;this.steps=0;this.last=0;this.maskVersion=0;this.textureDirty=true;
   this.N=matchMedia('(max-width:640px)').matches?28:36;this.count=(this.N+1)**2;
   this.pos=new Float32Array(this.count*3);this.prev=new Float32Array(this.count*3);this.normals=new Float32Array(this.count*3);this.uv=new Float32Array(this.count*2);this.wet=new Float32Array(this.count);this.wax=new Float32Array(this.count);this.exposure=new Float32Array(this.count);this.damage=new Float32Array(this.count);this.fold=new Float32Array(this.count);this.pins=new Uint8Array(this.count);this.links=[];this.tri=[];this.lines=[];
   for(let y=0;y<=this.N;y++)for(let x=0;x<=this.N;x++){
    const i=y*(this.N+1)+x;this.uv[i*2]=x/this.N;this.uv[i*2+1]=y/this.N;
    for(const [dx,dy,bend] of [[1,0,0],[0,1,0],[1,1,0],[-1,1,0],[2,0,1],[0,2,1]]){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<=this.N&&yy<=this.N){const j=yy*(this.N+1)+xx;this.links.push({i,j,rest:2.6/this.N*Math.hypot(dx,dy),bend,lambda:0});if(!bend)this.lines.push(i,j);}}
    if(x<this.N&&y<this.N){const b=i+1,c=i+this.N+1,d=c+1;this.tri.push(i,c,b,b,c,d);}
   }
   this.tri=new Uint16Array(this.tri);this.lines=new Uint16Array(this.lines);this.reset();
   const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL unavailable');this.gl=gl;this.program=makeProgram(gl);gl.useProgram(this.program);
   this.attrs={};for(const [name,size] of [['position',3],['normal',3],['texcoord',2],['moisture',1]]){const loc=gl.getAttribLocation(this.program,name),buffer=gl.createBuffer();this.attrs[name]={loc,buffer,size};}
   this.uniforms={};for(const name of ['camera','lamp','floorY','shadow','kind','alpha','time','eye','fabric','waxMask','crackMask','waxRemain'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
   this.index=gl.createBuffer();this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   this.waxTexture=this.makeMask();this.crackTexture=this.makeMask();
   this.contactCanvas=document.createElement('canvas');this.contactCanvas.width=this.contactCanvas.height=this.N+1;this.contactCtx=this.contactCanvas.getContext('2d');this.contactImage=this.contactCtx.createImageData(this.N+1,this.N+1);
   this.updateWax();this.updateCamera();this.bindInput();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.active=false;cancelAnimationFrame(this.frame);options.onUnavailable?.();});
   canvas.addEventListener('webglcontextrestored',()=>location.reload());
   this.animate=this.animate.bind(this);this.frame=requestAnimationFrame(this.animate);
  }
  reset(){
   this.grab=null;this.wet.fill(0);this.exposure.fill(0);this.damage.fill(0);this.fold.fill(0);this.pins.fill(0);
   for(let i=0;i<this.count;i++){const u=this.uv[i*2],v=this.uv[i*2+1];this.pos[i*3]=(u-.5)*2.6;this.pos[i*3+1]=.025;this.pos[i*3+2]=(v-.5)*2.6;}
   this.prev.set(this.pos);this.textureDirty=true;
  }
  setStage(stage){
   if(stage===this.stage)return;this.endGrab(false);this.stage=stage;this.stageTime=0;this.pins.fill(0);
   if(['DYE','REVEAL','RESULT'].includes(stage)){this.pins[0]=this.pins[this.N]=1;}
   if(stage==='COMPOSE'){this.reset();}
   if(stage==='DYE'){this.bathLevel=-.65;this.immersion=1;this.dip=0;this.wet.forEach((v,i)=>this.wet[i]=Math.max(v,.35));}
   this.prev.set(this.pos);this.textureDirty=true;
  }
  setActive(active){this.endGrab(false);this.active=active;this.last=0;}
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.75);if(!r.width)return;this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.updateCamera();}
  updateCamera(){
   const yaw=this.yaw,sy=Math.sin(yaw),cy=Math.cos(yaw),lift=this.stage==='DYE'?1-this.dip:0;this.right=[cy,0,-sy];this.up=[-.72*sy,.694,-.72*cy];this.forward=[.694*sy,.72,.694*cy];this.eye=this.forward.map(v=>v*6);this.scale=1.9+lift*.55;this.screenY=.06-lift*.34;
   const r=this.right,u=this.up,f=this.forward,s=this.scale;this.matrix=new Float32Array([r[0]/s,u[0]/s,-f[0]/10,0,r[1]/s,u[1]/s,-f[1]/10,0,r[2]/s,u[2]/s,-f[2]/10,0,0,this.screenY,0,1]);
  }
  project(i){const p=this.pos,k=i*3,r=this.right,u=this.up,f=this.forward,s=this.scale;return{x:(p[k]*r[0]+p[k+1]*r[1]+p[k+2]*r[2])/s,y:(p[k]*u[0]+p[k+1]*u[1]+p[k+2]*u[2])/s+this.screenY,z:p[k]*f[0]+p[k+1]*f[1]+p[k+2]*f[2]};}
  pick(clientX,clientY){
   const rect=this.canvas.getBoundingClientRect(),x=(clientX-rect.left)/rect.width*2-1,y=1-(clientY-rect.top)/rect.height*2,projected=Array.from({length:this.count},(_,i)=>this.project(i));let best=null;
   for(let t=0;t<this.tri.length;t+=3){const ia=this.tri[t],ib=this.tri[t+1],ic=this.tri[t+2],a=projected[ia],b=projected[ib],c=projected[ic],d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(d)<1e-9)continue;const wa=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/d,wb=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/d,wc=1-wa-wb;if(Math.min(wa,wb,wc)<-.001)continue;const depth=wa*a.z+wb*b.z+wc*c.z;if(best&&depth<=best.depth)continue;
    const ids=[ia,ib,ic],weights=[wa,wb,wc];const point=[0,0,0];let u=0,v=0;for(let j=0;j<3;j++){const i=ids[j],w=weights[j];for(let k=0;k<3;k++)point[k]+=this.pos[i*3+k]*w;u+=this.uv[i*2]*w;v+=this.uv[i*2+1]*w;}let index=ids[weights.indexOf(Math.max(...weights))];best={index,point,u,v,depth};
   }return best;
  }
  bindInput(){
   const c=this.canvas;
   c.addEventListener('pointerdown',e=>{if(!this.active||this.grab||!e.isPrimary||e.button>0)return;const hit=this.pick(e.clientX,e.clientY);if(!hit)return;e.preventDefault();c.setPointerCapture(e.pointerId);this.grab={id:e.pointerId,index:hit.index,wasPinned:this.pins[hit.index],start:[e.clientX,e.clientY],origin:hit.point,target:hit.point.slice(),path:[],maxLift:0};this.collectFold();c.style.cursor='grabbing';});
   c.addEventListener('pointermove',e=>{if(!this.grab||e.pointerId!==this.grab.id)return;e.preventDefault();const r=c.getBoundingClientRect(),g=this.grab,dx=(e.clientX-g.start[0])/r.width*2*this.scale,dy=-(e.clientY-g.start[1])/r.height*2*this.scale;for(let k=0;k<3;k++)g.target[k]=clamp(g.origin[k]+this.right[k]*dx+this.up[k]*dy,-2.5,2.5);g.target[1]=clamp(g.target[1],-.65,2.1);g.maxLift=Math.max(g.maxLift,Math.abs(g.target[1]-g.origin[1]));});
   const release=e=>{if(this.grab&&this.grab.id===e.pointerId)this.endGrab(true);};for(const event of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(event,release);
  }
  endGrab(commit){const g=this.grab;if(!g)return;this.grab=null;this.pins[g.index]=g.wasPinned;this.canvas.style.cursor='grab';if(this.canvas.hasPointerCapture(g.id))this.canvas.releasePointerCapture(g.id);if(commit&&this.stage==='CRACK'&&g.path.length)this.options.onFold?.(g.path,g.maxLift);}
  makeMask(){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
  updateWax(){const c=document.createElement('canvas');c.width=c.height=this.N+1;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(this.material.wax,0,0,c.width,c.height);const a=ctx.getImageData(0,0,c.width,c.height).data;for(let i=0;i<this.count;i++)this.wax[i]=a[i*4+3]/255;this.textureDirty=true;this.maskDirty=true;}
  inverseMass(i){return this.pins[i]?0:1/(1+this.wet[i]*.8);}
  solve(dt){
   const p=this.pos,prev=this.prev,n=this.N,wet=this.wet,grab=this.grab;
   const inBath=this.stage==='DYE',inHot=this.stage==='REVEAL',table=['COMPOSE','CRACK'].includes(this.stage),floor=table?.015:-1.35;
   if(inBath||inHot){this.bathLevel=inBath?-.65+Math.min(1,this.stageTime/1.5)*.95:-.35;this.dip+=((inHot?1:this.immersion)-this.dip)*Math.min(1,dt*2.8);}
   for(let i=0;i<this.count;i++){
    const k=i*3,sub=(inBath||inHot)&&p[k+1]<this.bathLevel;
    if(sub){if(inBath)this.exposure[i]+=dt;wet[i]=Math.min(1,wet[i]+dt*.9);}else if(this.stage==='RESULT')wet[i]=Math.max(0,wet[i]-dt*.055);
    if(this.pins[i]){const right=i===n,anchorY=inBath?3.2-this.dip*3.32:inHot?.90-this.dip*1.55:.90;const target=[right?1.2:-1.2,anchorY,-.6];for(let j=0;j<3;j++){p[k+j]+=(target[j]-p[k+j])*Math.min(1,dt*5);prev[k+j]=p[k+j];}continue;}
    for(let j=0;j<3;j++){const pos=p[k+j],velocity=clamp(pos-prev[k+j],-.07,.07);prev[k+j]=pos;const damp=sub?.84:inHot?.90:.992;p[k+j]+=velocity*damp;}
    // Constant gravity; water adds buoyancy and drag, rather than changing gravity.
    p[k+1]+=(-9.8+(sub?8.2:0))*dt*dt;
    if(!table)p[k]+=Math.sin(this.time*.8+this.uv[i*2+1]*4)*dt*dt*.28;
    if(p[k+1]<floor){p[k+1]=floor;prev[k]=p[k]+(prev[k]-p[k])*.65;prev[k+2]=p[k+2]+(prev[k+2]-p[k+2])*.65;}
   }
   for(const l of this.links)l.lambda=0;
   for(let iter=0;iter<6;iter++){
    for(const l of this.links){const a=l.i*3,b=l.j*3,dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],length=Math.hypot(dx,dy,dz);if(length<1e-8)continue;const wa=this.inverseMass(l.i),wb=this.inverseMass(l.j),wax=(this.wax[l.i]+this.wax[l.j])*.5*(1-this.removedWax),compliance=l.bend?(.00014/(1+wax*2)):.00000018,alpha=compliance/(dt*dt),dl=(-(length-l.rest)-alpha*l.lambda)/(wa+wb+alpha);l.lambda+=dl;const correction=dl/length;p[a]-=wa*correction*dx;p[a+1]-=wa*correction*dy;p[a+2]-=wa*correction*dz;p[b]+=wb*correction*dx;p[b+1]+=wb*correction*dy;p[b+2]+=wb*correction*dz;}
    if(grab){const i=grab.index,k=i*3;this.pins[i]=0;for(let j=0;j<3;j++)p[k+j]=grab.target[j];}
    for(let i=0;i<this.count;i++){const k=i*3;if(p[k+1]<floor)p[k+1]=floor;}
   }
   if(grab){const k=grab.index*3;for(let j=0;j<3;j++)prev[k+j]=p[k+j];}
   this.steps++;
  }
  computeNormals(){
   const p=this.pos,no=this.normals;no.fill(0);
   for(let t=0;t<this.tri.length;t+=3){const a=this.tri[t]*3,b=this.tri[t+1]*3,c=this.tri[t+2]*3,ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2],nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;for(const k of [a,b,c]){no[k]+=nx;no[k+1]+=ny;no[k+2]+=nz;}}
   for(let i=0;i<this.count;i++){const k=i*3,len=Math.hypot(no[k],no[k+1],no[k+2])||1;no[k]/=len;no[k+1]/=len;no[k+2]/=len;}
  }
  collectFold(){
   if(!this.grab||this.stage!=='CRACK')return;const p=this.pos,n=this.N;
   for(let y=1;y<n;y++)for(let x=1;x<n;x++){const i=y*(n+1)+x;if(this.wax[i]<.25||this.damage[i]>0)continue;let bend=0;for(const stride of [1,n+1]){const a=(i-stride)*3,b=i*3,c=(i+stride)*3,ax=p[a]-p[b],ay=p[a+1]-p[b+1],az=p[a+2]-p[b+2],bx=p[c]-p[b],by=p[c+1]-p[b+1],bz=p[c+2]-p[b+2];const cosine=(ax*bx+ay*by+az*bz)/(Math.hypot(ax,ay,az)*Math.hypot(bx,by,bz)||1);bend=Math.max(bend,1+cosine);}
    this.fold[i]=Math.max(this.fold[i],bend);if(bend>.16){this.damage[i]=1;if(this.grab.path.length<140)this.grab.path.push({x:this.uv[i*2]*1024,y:this.uv[i*2+1]*1024});}
   }
  }
  contact(){const a=this.contactImage.data;for(let i=0;i<this.count;i++){const submerged=this.stage==='DYE'&&this.pos[i*3+1]<this.bathLevel;const k=i*4;a[k]=a[k+1]=a[k+2]=submerged?255:0;a[k+3]=255;}this.contactCtx.putImageData(this.contactImage,0,0);return this.contactCanvas;}
  uploadTexture(){const gl=this.gl;this.material.render();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.material.canvas);if(this.maskDirty){for(const [t,c] of [[this.waxTexture,this.material.wax],[this.crackTexture,this.material.cracks]]){gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);}this.maskDirty=false;}this.textureDirty=false;}
  attribute(name,data){const gl=this.gl,a=this.attrs[name];gl.bindBuffer(gl.ARRAY_BUFFER,a.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(a.loc);gl.vertexAttribPointer(a.loc,a.size,gl.FLOAT,false,0,0);}
  geometry(pos,norm,uv,wet){this.attribute('position',pos);this.attribute('normal',norm);this.attribute('texcoord',uv);this.attribute('moisture',wet);}
  plane(y,kind){const extent=kind===1?7:1.75,p=new Float32Array([-extent,y,-extent,-extent,y,extent,extent,y,-extent,extent,y,-extent,-extent,y,extent,extent,y,extent]),norm=new Float32Array(18),uv=new Float32Array(12),wet=new Float32Array(6);for(let i=0;i<6;i++)norm[i*3+1]=1;this.geometry(p,norm,uv,wet);this.gl.uniform1f(this.uniforms.kind,kind);this.gl.drawArrays(this.gl.TRIANGLES,0,6);}
  box(x,y,z,w,h,d,kind=6){
   const corners=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],faces=[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]],normals=[[0,0,-1],[0,0,1],[-1,0,0],[1,0,0],[0,1,0],[0,-1,0]],p=[],no=[];
   faces.forEach((face,f)=>{for(const idx of [0,1,2,0,2,3]){const c=corners[face[idx]];p.push(x+c[0]*w/2,y+c[1]*h/2,z+c[2]*d/2);no.push(...normals[f]);}});this.geometry(new Float32Array(p),new Float32Array(no),new Float32Array(72),new Float32Array(36));this.gl.uniform1f(this.uniforms.kind,kind);this.gl.drawArrays(this.gl.TRIANGLES,0,36);
  }
  bowl(x,y,z){const p=[],no=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;for(const [theta,h,r] of [[a,0,.17],[b,0,.17],[b,.17,.24],[a,0,.17],[b,.17,.24],[a,.17,.24]]){p.push(x+Math.cos(theta)*r,y+h,z+Math.sin(theta)*r);no.push(Math.cos(theta),.2,Math.sin(theta));}p.push(x,y+.14,z,x+Math.cos(b)*.2,y+.14,z+Math.sin(b)*.2,x+Math.cos(a)*.2,y+.14,z+Math.sin(a)*.2);no.push(0,1,0,0,1,0,0,1,0);}
   this.geometry(new Float32Array(p),new Float32Array(no),new Float32Array(p.length/3*2),new Float32Array(p.length/3));this.gl.uniform1f(this.uniforms.kind,7);this.gl.drawArrays(this.gl.TRIANGLES,0,p.length/3);
  }
  props(){
   const stage=this.stage;
   if(stage==='COMPOSE'||stage==='CRACK'){this.bowl(1.55,.03,-.9);this.box(1.57,.07,.25,.055,.06,.65,6);this.box(1.57,.07,-.13,.10,.035,.14,7);this.box(-1.6,.08,-1.1,.27,.16,.24,8);}
   if(stage==='DYE'||stage==='REVEAL'){const rim=stage==='DYE'?.38:-.28,kind=stage==='DYE'?6:7;this.box(-1.65,rim,0,.12,.14,3.4,kind);this.box(1.65,rim,0,.12,.14,3.4,kind);this.box(0,rim,-1.65,3.4,.14,.12,kind);this.box(0,rim,1.65,3.4,.14,.12,kind);}
   if(stage==='RESULT'){for(const x of [-1.43,1.43]){this.box(x,-.18,-.65,.075,2.40,.075,6);this.box(x,-1.35,-.6,.30,.08,.60,6);}this.box(0,1.02,-.65,2.95,.075,.075,6);for(const x of [-1.2,1.2])this.box(x,.95,-.6,.06,.16,.07,7);}
  }
  atmosphericParticles(){
   const hot=this.stage==='REVEAL',dry=this.stage==='RESULT';if(!hot&&!dry)return;
   const p=[],no=[],wet=[];for(let i=0;i<32;i++){const phase=(this.time*.24+i*.618)%1;if(hot){p.push(Math.sin(i*17.3)*1.4,-.1+phase*1.8,Math.cos(i*8.4)*1.2);wet.push((1-phase)*(.3+this.removedWax*.7));}else{const index=this.N*(this.N+1)+Math.floor(i/32*this.N),k=index*3;if(this.wet[index]<.2)continue;p.push(this.pos[k]+Math.sin(i)*.02,this.pos[k+1]-phase*1.2,this.pos[k+2]);wet.push(this.wet[index]);}no.push(0,1,0);}
   this.geometry(new Float32Array(p),new Float32Array(no),new Float32Array(p.length/3*2),new Float32Array(wet));this.gl.uniform1f(this.uniforms.kind,hot?9:10);this.gl.depthMask(false);this.gl.drawArrays(this.gl.POINTS,0,p.length/3);this.gl.depthMask(true);
  }
  render(){
   this.updateCamera();const gl=this.gl,u=this.uniforms;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.84,.80,.71,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(this.program);
   gl.uniformMatrix4fv(u.camera,false,this.matrix);const lamp=[Math.sin(this.lampAngle)*2.5,3.5,Math.cos(this.lampAngle)*2.5];gl.uniform3fv(u.lamp,lamp);gl.uniform3fv(u.eye,this.eye);gl.uniform1f(u.time,this.time);gl.uniform1f(u.alpha,1);gl.uniform1f(u.shadow,0);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(u.fabric,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.waxTexture);gl.uniform1i(u.waxMask,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.crackTexture);gl.uniform1i(u.crackMask,2);gl.uniform1f(u.waxRemain,1-this.removedWax);
   const floor=['COMPOSE','CRACK'].includes(this.stage)?0:-1.4;gl.uniform1f(u.floorY,floor);this.plane(floor,1);
   this.geometry(this.pos,this.normals,this.uv,this.wet);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,this.tri,gl.DYNAMIC_DRAW);gl.uniform1f(u.kind,0);gl.uniform1f(u.shadow,1);gl.depthMask(false);gl.drawElements(gl.TRIANGLES,this.tri.length,gl.UNSIGNED_SHORT,0);gl.depthMask(true);gl.uniform1f(u.shadow,0);
   gl.uniform1f(u.alpha,this.view==='particles'?.20:1);gl.drawElements(gl.TRIANGLES,this.tri.length,gl.UNSIGNED_SHORT,0);
   if(this.view==='mesh'){gl.uniform1f(u.alpha,.7);gl.uniform1f(u.kind,4);gl.depthFunc(gl.LEQUAL);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,this.lines,gl.DYNAMIC_DRAW);gl.drawElements(gl.LINES,this.lines.length,gl.UNSIGNED_SHORT,0);gl.depthFunc(gl.LESS);}
   if(this.view==='particles'){gl.uniform1f(u.kind,3);gl.drawArrays(gl.POINTS,0,this.count);}
   if(this.stage==='DYE'||this.stage==='REVEAL'){gl.depthMask(false);this.plane(this.stage==='DYE'?this.bathLevel:-.35,2);gl.depthMask(true);}
   this.props();this.atmosphericParticles();
  }
  animate(t){
   this.frame=requestAnimationFrame(this.animate);if(document.hidden||!this.active||document.querySelector('dialog[open]')){this.last=0;return;}
   const dt=this.last?Math.min(.035,(t-this.last)/1000):1/60;this.last=t;this.time+=dt;this.stageTime+=dt;
   const substeps=3;for(let i=0;i<substeps;i++)this.solve(dt/substeps);this.computeNormals();if(this.steps%9===0)this.collectFold();
   if(this.textureDirty||this.stage==='DYE'||this.stage==='REVEAL')this.uploadTexture();this.render();
  }
  advanceDye(dt){
   // A host may suspend animation frames while a user-started dye timer runs.
   if(!this.active||!['DYE','REVEAL','RESULT'].includes(this.stage)||performance.now()-this.last<150)return;
   const step=Math.min(.06,dt);this.time+=step;this.stageTime+=step;for(let i=0;i<3;i++)this.solve(step/3);this.computeNormals();this.textureDirty=true;
  }
  snapshot(){
   let height=-Infinity,wetness=0,submerged=0;const bath=this.stage==='DYE'||this.stage==='REVEAL';
   for(let i=0;i<this.count;i++){height=Math.max(height,this.pos[i*3+1]);wetness+=this.wet[i];if(bath&&this.pos[i*3+1]<this.bathLevel)submerged++;}
   return{stage:this.stage,particles:this.count,steps:this.steps,finite:this.pos.every(Number.isFinite),height,wetness:wetness/this.count,grabbed:this.grab?.index??null,view:this.view,submerged,corners:[0,this.N].map(i=>({height:this.pos[i*3+1],exposure:this.exposure[i]})),immersion:this.immersion};
  }
 }
 window.BatikCloth=Cloth;
})();
