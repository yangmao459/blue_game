"use strict";
(() => {
 const $=id=>document.getElementById(id),P=window.BatikPatterns,CATALOG=window.BatikCatalog,S=1024,KEY='indigo-generative-v2';
 const fresh=()=>({version:2,randomSeed:2718,thickness:65,density:6,strength:65,title:'',seeds:[{id:1,type:'bloom',x:.50,y:.46,angle:.10,spread:75,density:6,variant:2731},{id:2,type:'frond',x:.23,y:.76,angle:-.48,spread:46,density:6,variant:11745},{id:3,type:'frond',x:.79,y:.23,angle:2.65,spread:46,density:6,variant:20759}],gestures:[],strokes:[]});
 let recipe=fresh(),stage='COMPOSE',selected=1,mode='move',pendingSeed=null,wax=P.surface(),cracks=P.surface(),field=null,branches=0,drag=null,pending=0,geometryDirty=false,cracksDirty=false,draft=null,saveTimer=0,toastTimer=0,exportUrl=null,exportBusy=false,warned=false;
 let simulationFrame=0,runElapsed=0,totalDyeSeconds=0,passes=0,history=[],runStart=0,lastFrame=0,accumulator=0,dyePaused=false,dyeFault=false,dyeInBath=true,processPaused=false,finishPass=0;
 const overlay=$('interaction'),octx=overlay.getContext('2d');P.waxPattern(wax,recipe);
 const material=new window.BatikMaterial($('material'),wax,cracks);
 let cloth=null,clothView=true;
 try{cloth=new window.BatikCloth($('cloth-3d'),material,{
  onFold(points,lift){if(stage!=='CRACK'||lift<.04||recipe.gestures.length>=48)return;const strength=Number($('stress').value);recipe.gestures.push({strength,points:points.slice(0,140)});cracksDirty=true;requestPaint();save();},
  onUnavailable(){clothView=false;syncClothView();toast('三维显示暂不可用，已切换布面编辑。');}
 });}catch(e){console.warn('Cloth fallback:',e.message);clothView=false;}
 function syncClothView(){const enabled=!!cloth&&clothView;document.body.dataset.cloth=enabled?'3d':'flat';$('cloth-flat').setAttribute('aria-pressed',String(!enabled));$('cloth-lift').setAttribute('aria-pressed',String(enabled));$('cloth-lift').disabled=!cloth;$('cloth-view-options').hidden=!enabled;$('cloth-hint').hidden=!enabled;cloth?.setActive(enabled);if(enabled)cloth.resize();else requestPaint();}
 $('cloth-flat').onclick=()=>{clothView=false;syncClothView();};$('cloth-lift').onclick=()=>{clothView=true;syncClothView();};
 $('cloth-home').onclick=()=>{if(!cloth)return;cloth.reset();const next=stage;cloth.stage='';cloth.setStage(next);cloth.updateWax();};
 $('cloth-display').onchange=()=>{if(cloth)cloth.view=$('cloth-display').value;};$('cloth-angle').oninput=()=>{if(cloth){cloth.yaw=Number($('cloth-angle').value)/180*Math.PI;cloth.updateCamera();}};$('cloth-light').oninput=()=>{if(cloth)cloth.lampAngle=Number($('cloth-light').value)/180*Math.PI;};
 function setDyeImmersion(inBath){dyeInBath=inBath;if(cloth)cloth.immersion=inBath?1:0;$('dip-cloth').setAttribute('aria-pressed',String(inBath));$('lift-cloth').setAttribute('aria-pressed',String(!inBath));updateProcessStatus();}
 $('dip-cloth').onclick=()=>setDyeImmersion(true);$('lift-cloth').onclick=()=>setDyeImmersion(false);
 function updatePhasePhoto(){const data=window.BatikPhases[stage];$('stage-photo').src=data.image;$('stage-photo').alt=data.alt;$('phase-title').textContent=data.title;$('phase-number').textContent=String(['COMPOSE','CRACK','DYE','REVEAL','RESULT'].indexOf(stage)+1).padStart(2,'0')+' / 05';}
 function updateProcessStatus(){
  const state=cloth?.snapshot(),wet=state?Math.round(state.wetness*100):stage==='COMPOSE'||stage==='CRACK'?0:100;
  let surface=window.BatikPhases[stage].state,coating='蜡层完整';
  if(stage==='CRACK')coating=recipe.gestures.length?'蜡层已开裂':'可提起折揉';
  if(stage==='DYE'){surface=dyeInBath?'浸入染缸':'出缸显色';coating=!dyeInBath?'遇空气氧化':state&&state.corners.every(c=>c.exposure>.1)?'布角已入染':'整布下沉中';}
  if(stage==='REVEAL')coating='残蜡 '+(100-Number($('reveal').value))+'%';if(stage==='RESULT')coating='织纹显露';
  $('surface-state').textContent=surface;$('moisture-state').textContent=wet>0?'湿润 '+wet+'%':'干燥';$('coating-state').textContent=coating;
 }
 $('renderer-badge').textContent=material.gpu?'实时材质 · GPU 渲染':'实时材质 · 兼容模式';
 const names=Object.fromEntries(Object.entries(CATALOG).map(([id,item])=>[id,item.name])),stages=['COMPOSE','CRACK','DYE','REVEAL','RESULT'];
 const copy=o=>JSON.parse(JSON.stringify(o));
 function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
 function valid(r){
  if(!r||r.version!==2||!Number.isInteger(r.randomSeed)||!Array.isArray(r.seeds)||r.seeds.length>9||!Array.isArray(r.gestures)||r.gestures.length>48)return null;
  const finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
  if(!finite(r.thickness,20,100)||!finite(r.density,3,10)||!Number.isInteger(r.density)||!finite(r.strength,20,100))return null;
  const ids=new Set();for(const s of r.seeds){if(!s||!Number.isInteger(s.id)||ids.has(s.id)||!Object.hasOwn(names,s.type)||!finite(s.x,.08,.92)||!finite(s.y,.08,.92)||!finite(s.angle,-Math.PI*3,Math.PI*3)||!finite(s.spread,30,100)||(s.density!==undefined&&(!Number.isInteger(s.density)||!finite(s.density,3,10)))||(s.variant!==undefined&&!Number.isInteger(s.variant)))return null;ids.add(s.id);}
  let total=0;for(const g of r.gestures){if(!g||!finite(g.strength,10,100)||!Array.isArray(g.points)||!g.points.length||g.points.length>400)return null;total+=g.points.length;if(total>12000)return null;for(const p of g.points)if(!p||!finite(p.x,0,S)||!finite(p.y,0,S))return null;}
  const strokes=r.strokes??[];if(!Array.isArray(strokes)||strokes.length>150)return null;let inkPoints=0;for(const s of strokes){if(!s||!finite(s.size,4,48)||!Array.isArray(s.points)||!s.points.length||s.points.length>2000)return null;inkPoints+=s.points.length;if(inkPoints>20000)return null;for(const p of s.points)if(!p||!finite(p.x,0,S)||!finite(p.y,0,S))return null;}
  return {version:2,randomSeed:r.randomSeed,thickness:r.thickness,density:r.density,strength:r.strength,title:typeof r.title==='string'?Array.from(r.title).slice(0,16).join(''):'',seeds:r.seeds.map((s,i)=>({id:s.id,type:s.type,x:s.x,y:s.y,angle:s.angle,spread:s.spread,density:s.density??r.density,variant:s.variant??(r.randomSeed+i*9001+s.id*13)})),gestures:r.gestures.map(g=>({strength:g.strength,points:g.points.map(p=>({x:p.x,y:p.y}))})),strokes:strokes.map(s=>({size:s.size,points:s.points.map(p=>({x:p.x,y:p.y}))}))};
 }
 try{draft=valid(JSON.parse(localStorage.getItem(KEY)));}catch{}$('restore-recipe').hidden=!draft;
 function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(recipe));}catch{if(!warned){warned=true;toast('浏览器无法保存草稿，完成后请导出作品卡与配方。');}}},300);}
 function selectedSeed(){return recipe.seeds.find(s=>s.id===selected)||recipe.seeds[0]||null;}
 function editorSeed(){return mode==='add'?pendingSeed:selectedSeed();}
 function setMode(next){if(next==='add'){const source=selectedSeed()||{type:'bloom',spread:55,density:6,angle:0};pendingSeed={...source,id:null,variant:Math.floor(Math.random()*2147483647)};}else pendingSeed=null;mode=next;document.body.dataset.mode=mode;for(const [id,value] of [['move-mode','move'],['add-mode','add'],['draw-mode','draw']])$(id).setAttribute('aria-pressed',String(mode===value));$('object-tools').hidden=mode==='draw';$('ink-tools').hidden=mode!=='draw';$('compose-title').textContent=mode==='draw'?'画蜡':mode==='add'?'添加纹样':'纹样工具';$('compose-intro').textContent='';if(stage==='COMPOSE')$('stage-hint').textContent=mode==='draw'?'按住拖动绘制蜡线':mode==='add'?'点击布面放置新纹样':'拖圆点移动 · 拖圆环旋转';controls();requestPaint();}
 function controls(){
  const current=editorSeed(),s=current||{id:null,type:'bloom',x:.5,y:.5,angle:0,spread:55,density:6};if(mode!=='add')selected=s.id;$('spread').value=s.spread;$('spread-value').value=Math.round(s.spread);$('density').value=s.density;$('density-value').value=s.density;$('thickness').value=recipe.thickness;$('thickness-value').value=recipe.thickness<40?'偏薄':recipe.thickness<75?'中厚':'偏厚';
  $('seed-x').value=Math.round(s.x*100);$('seed-x-value').value=Math.round(s.x*100);$('seed-y').value=Math.round(s.y*100);$('seed-y-value').value=Math.round(s.y*100);$('seed-x').disabled=$('seed-y').disabled=mode==='add';let angle=Math.round(s.angle/Math.PI*180);if(angle>180)angle-=360;$('rotation').value=angle;$('rotation-value').value=angle+'°';
  $('object-select').replaceChildren();if(mode==='add'){const option=document.createElement('option');option.value='null';option.textContent='待添加 · '+names[s.type];$('object-select').append(option);}else recipe.seeds.forEach((object,i)=>{const option=document.createElement('option');option.value=String(object.id);option.textContent=`第 ${i+1} 簇 · ${names[object.type]}`;$('object-select').append(option);});$('object-select').value=String(s.id);$('object-select').disabled=!current||mode==='add';$('selected-controls').disabled=!current;$('object-scope').textContent='';
  document.querySelectorAll('[data-motif]').forEach(b=>b.setAttribute('aria-pressed',String(!!current&&b.dataset.motif===s.type)));$('remove-seed').disabled=!current||mode==='add';$('reseed').textContent=mode==='add'?'换个形态':'换个形态';$('motif-source').disabled=!current;$('seed-count').textContent=`${recipe.seeds.length} 簇纹样 · ${recipe.strokes.length} 笔手绘`;$('ink-count').textContent=`${recipe.strokes.length} 笔手绘`;$('undo-ink').disabled=$('clear-ink').disabled=!recipe.strokes.length;$('clear-motifs').disabled=!recipe.seeds.length;$('to-crack').disabled=!recipe.seeds.length&&!recipe.strokes.length;$('recipe-id').textContent='SEED / '+recipe.randomSeed;$('art-caption').textContent=stage==='RESULT'?'':'独立纹样与手绘 · 自由构图';$('art-caption').hidden=stage==='RESULT';
  updateStepNavigation();
 }
 function invalidateComposition(){
  if(recipe.gestures.length){recipe.gestures=[];toast('构图已改变，旧裂隙已重置。请重新揉蜡。');}
  field=null;branches=0;geometryDirty=true;material.reset();history=[];totalDyeSeconds=0;passes=0;requestPaint();save();
 }
 function updateCracks(){
  if(!field)field=new P.WaxField(wax);const preview=drag&&drag.type==='crack'?{...recipe,gestures:[...recipe.gestures,drag.gesture]}:recipe;branches=P.generateCracks(cracks,preview,field);material.updateMasks();if(cloth)cloth.maskDirty=true;$('crack-count').textContent=recipe.gestures.length?`${recipe.gestures.length} 次揉动 · ${branches} 段裂隙`:'未揉蜡 · 可直接浸染';$('undo-crack').disabled=$('clear-cracks').disabled=!recipe.gestures.length;
 }
 function requestPaint(){if(!pending)pending=requestAnimationFrame(()=>{pending=0;if(geometryDirty){const drawing=drag?.type==='ink'?{...recipe,strokes:[...recipe.strokes,drag.stroke]}:recipe;P.waxPattern(wax,drawing);cracks.getContext('2d').clearRect(0,0,S,S);material.updateMasks();geometryDirty=false;cloth?.updateWax();}if(cracksDirty){updateCracks();cracksDirty=false;}material.render(stage==='RESULT'?0:stage==='REVEAL'?1-Number($('reveal').value)/100:1,stage==='DYE');if(cloth){cloth.removedWax=stage==='RESULT'?1:stage==='REVEAL'?Number($('reveal').value)/100:0;cloth.textureDirty=true;}drawHandles();});}
 function directionPoint(s){return{x:s.x*S+Math.sin(s.angle)*84,y:s.y*S-Math.cos(s.angle)*84};}
 function drawHandles(){
  octx.clearRect(0,0,S,S);if(stage==='COMPOSE'&&mode==='move'){
   for(const s of recipe.seeds){const is=s.id===selected,x=s.x*S,y=s.y*S;octx.save();octx.strokeStyle=is?'#19495b':'#64755eaa';octx.fillStyle=is?'#f7f4e9':'#f7f4e9cc';octx.lineWidth=is?3:2;octx.beginPath();octx.arc(x,y,is?14:10,0,Math.PI*2);octx.fill();octx.stroke();octx.fillStyle='#19495b';octx.beginPath();octx.arc(x,y,3,0,Math.PI*2);octx.fill();if(is){const d=directionPoint(s);octx.setLineDash([5,7]);octx.lineWidth=1.5;octx.beginPath();octx.moveTo(x,y);octx.lineTo(d.x,d.y);octx.stroke();octx.setLineDash([]);octx.lineWidth=2;octx.fillStyle='#f7f4e9';octx.beginPath();octx.arc(d.x,d.y,10,0,Math.PI*2);octx.fill();octx.stroke();}octx.restore();}
  }else if(stage==='CRACK'&&drag&&drag.type==='crack'){
   const pts=drag.gesture.points;octx.strokeStyle='#a67c4399';octx.lineWidth=2;octx.setLineDash([6,8]);octx.beginPath();pts.forEach((p,i)=>i?octx.lineTo(p.x,p.y):octx.moveTo(p.x,p.y));octx.stroke();octx.setLineDash([]);if(pts.length){const p=pts[pts.length-1];octx.strokeStyle='#9f7b49aa';octx.beginPath();octx.arc(p.x,p.y,25+Number($('stress').value)*.15,0,Math.PI*2);octx.stroke();}
  }
 }
 const chapters={
  COMPOSE:['画蜡','','','画蜡台','',''],
  CRACK:['揉蜡','','','揉蜡','在蜡区拖动；可跳过',''],
  DYE:['浸染','','','染缸','观察着色，完成后取出',''],
  REVEAL:['脱蜡','','','脱蜡','拖动右侧滑块',''],
  RESULT:['成布','','','成布','提起查看 · 可调视角与光源','']
 };
 function setStage(next){
  if(!stages.includes(next))return;if(stage==='DYE'&&next!=='DYE'){clearTimeout(simulationFrame);simulationFrame=0;}stage=next;document.body.dataset.stage=stage;document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=el.dataset.panel!==stage);document.querySelectorAll('[data-stage]').forEach(el=>{const index=stages.indexOf(el.dataset.stage);el.classList.toggle('completed',index<stages.indexOf(stage));if(el.dataset.stage===stage)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  const c=chapters[stage];$('chapter-title').innerHTML=c[0];$('chapter-lead').innerHTML=c[1];$('chapter-lead').hidden=!c[1];$('chapter-description').textContent=c[2];$('bench-title').textContent=c[3];$('bench-title').parentElement.hidden=!c[3];$('bench-meta').textContent=c[4];$('principle').textContent=c[5];$('principle').closest('.principle-note').hidden=!c[5];$('stage-hint').hidden=!['COMPOSE','CRACK'].includes(stage);$('simulation-indicator').hidden=stage!=='DYE';if(stage==='COMPOSE')setMode(mode);if(stage==='CRACK')$('stage-hint').textContent='按住蜡区拖动 · 可跳过';
  if(stage==='RESULT'){$('result-seeds').textContent=recipe.seeds.length+' 簇 / '+recipe.strokes.length+' 笔';$('result-cracks').textContent=recipe.gestures.length+' 次';$('result-dye').textContent=totalDyeSeconds.toFixed(1)+' 秒';}
  cloth?.setStage(stage);finishPass=0;updatePhasePhoto();updateProcessStatus();$('cloth-flat').textContent=stage==='COMPOSE'?'编辑布面':stage==='CRACK'?'平面揉蜡':'平面查看';if(stage!=='COMPOSE'){clothView=!!cloth;syncClothView();}controls();requestPaint();
  const focus={COMPOSE:'move-mode',CRACK:'stress',DYE:'dye-strength',REVEAL:'reveal',RESULT:'title'}[stage];$(focus).focus({preventScroll:true});if(matchMedia('(max-width: 640px)').matches)$('studio').scrollIntoView({block:'start',behavior:'auto'});
 }
 function coords(e){const r=overlay.getBoundingClientRect();return{x:Math.max(0,Math.min(S,(e.clientX-r.left)/r.width*S)),y:Math.max(0,Math.min(S,(e.clientY-r.top)/r.height*S))};}
 function down(e){
  if(!e.isPrimary||drag||(e.pointerType==='mouse'&&e.button!==0)||!['COMPOSE','CRACK'].includes(stage))return;e.preventDefault();const p=coords(e);overlay.setPointerCapture(e.pointerId);
  if(stage==='COMPOSE'){
   if(mode==='draw'){const remaining=20000-recipe.strokes.reduce((n,s)=>n+s.points.length,0);if(recipe.strokes.length>=150||remaining<1){toast('手绘已较丰富，请先撤销部分笔画，或入染完成作品。');return;}drag={type:'ink',id:e.pointerId,remaining,stroke:{size:Number($('ink-size').value),points:[p]}};invalidateComposition();return;}
   if(mode==='add'){if(recipe.seeds.length>=9){toast('最多 9 处生长点。可以先移动或移除一簇。');return;}const s=pendingSeed||{type:'bloom',spread:55,density:6,angle:0,variant:2718};const id=Math.max(0,...recipe.seeds.map(s=>s.id))+1;recipe.seeds.push({id,type:s.type,x:Math.max(.08,Math.min(.92,p.x/S)),y:Math.max(.08,Math.min(.92,p.y/S)),angle:s.angle,spread:s.spread,density:s.density,variant:s.variant});selected=id;setMode('move');controls();invalidateComposition();drag={type:'move',id:e.pointerId};return;}
   const selectedOne=selectedSeed();if(!selectedOne){toast('先种一簇纹样，或切换自由绘蜡。');return;}const handle=directionPoint(selectedOne);if(Math.hypot(p.x-handle.x,p.y-handle.y)<29){drag={type:'rotate',id:e.pointerId};return;}
   const hit=recipe.seeds.reduce((best,s)=>Math.hypot(p.x-s.x*S,p.y-s.y*S)<Math.hypot(p.x-best.x*S,p.y-best.y*S)-2?s:best,selectedOne);if(Math.hypot(p.x-hit.x*S,p.y-hit.y*S)>42){toast('拖动圆点牵引构图，或选择“种一簇”加入新形态。');return;}selected=hit.id;drag={type:'move',id:e.pointerId,offset:{x:p.x-hit.x*S,y:p.y-hit.y*S}};controls();requestPaint();
  }else{
   if(recipe.gestures.length>=48){toast('揉动轨迹已较丰富，可以先入染，或撤销部分揉动。');return;}if(!field)field=new P.WaxField(wax);drag={type:'crack',id:e.pointerId,gesture:{strength:Number($('stress').value),points:[p]}};requestPaint();
  }
 }
 function move(e){
  const p=coords(e);
  if(stage==='RESULT'&&e.pointerType==='mouse'){material.light=[(p.x/S-.5)*1.3,(.5-p.y/S)*1.3];requestPaint();return;}
  if(!drag||e.pointerId!==drag.id)return;e.preventDefault();
  if(drag.type==='move'){const s=selectedSeed();s.x=Math.max(.08,Math.min(.92,(p.x-(drag.offset?.x||0))/S));s.y=Math.max(.08,Math.min(.92,(p.y-(drag.offset?.y||0))/S));controls();invalidateComposition();}
  else if(drag.type==='rotate'){const s=selectedSeed();s.angle=Math.atan2(p.x-s.x*S,-(p.y-s.y*S));controls();invalidateComposition();}
  else if(drag.type==='ink'){const points=drag.stroke.points,events=e.getCoalescedEvents?.()||[e];for(const event of events.length?events:[e]){const next=coords(event),last=points.at(-1);if(Math.hypot(next.x-last.x,next.y-last.y)>1.8&&points.length<Math.min(2000,drag.remaining))points.push(next);}geometryDirty=true;requestPaint();}
  else{const pts=drag.gesture.points,last=pts[pts.length-1];if(Math.hypot(p.x-last.x,p.y-last.y)>6&&pts.length<400){pts.push(p);cracksDirty=true;requestPaint();}}
 }
 function up(e){
  if(!drag||e.pointerId!==drag.id)return;
  if(drag.type==='ink'){recipe.strokes.push(drag.stroke);geometryDirty=true;save();controls();}
  if(drag.type==='crack'){
   const gesture=drag.gesture,hit=gesture.points.some(p=>field.at(p.x,p.y)>.28);if(hit){recipe.gestures.push(gesture);cracksDirty=true;save();}else toast('这次没有触及蜡区。试着在金色图案上揉动。');
  }drag=null;cracksDirty=stage==='CRACK';requestPaint();
 }
 overlay.addEventListener('pointerdown',down);overlay.addEventListener('pointermove',move);overlay.addEventListener('pointerup',up);overlay.addEventListener('pointercancel',up);overlay.addEventListener('lostpointercapture',up);overlay.addEventListener('pointerleave',()=>{if(stage==='RESULT'){material.light=[-.4,.4];requestPaint();}});
 function editMode(next){setMode(next);clothView=false;syncClothView();}
 $('move-mode').onclick=()=>editMode('move');$('add-mode').onclick=()=>editMode('add');$('draw-mode').onclick=()=>editMode('draw');
 for(const [type,item] of Object.entries(CATALOG)){const button=document.createElement('button');button.dataset.motif=type;button.setAttribute('aria-pressed','false');button.title=item.name+' · '+item.category;const thumbnail=document.createElement('canvas');thumbnail.width=thumbnail.height=64;thumbnail.setAttribute('aria-hidden','true');const layer=P.seedLayer({id:0,type,x:.5,y:.5,angle:0,spread:60,density:6,variant:2718},{thickness:65,randomSeed:2718,density:6});const tc=thumbnail.getContext('2d');tc.drawImage(layer,180,180,664,664,0,0,64,64);tc.globalCompositeOperation='source-in';tc.fillStyle='#9f7d46';tc.fillRect(0,0,64,64);const label=document.createElement('span');label.textContent=item.name;button.append(thumbnail,label);button.onclick=()=>{let s=editorSeed();if(!s){s={id:1,type,x:.5,y:.5,angle:0,spread:55,density:6,variant:2718};recipe.seeds.push(s);selected=1;}else s.type=type;controls();if(mode!=='add')invalidateComposition();};$('motif-buttons').append(button);}
 $('object-select').onchange=()=>{selected=Number($('object-select').value);controls();requestPaint();};
 $('motif-source').onclick=()=>{const s=editorSeed();if(!s)return;const item=CATALOG[s.type];$('motif-title').textContent=item.name+' · '+item.category;$('motif-description').textContent=item.note;$('motif-reference').textContent=item.source;if(item.url){$('motif-reference').href=item.url;$('motif-reference').hidden=false;}else{$('motif-reference').removeAttribute('href');$('motif-reference').hidden=false;}$('motif-dialog').showModal();};
 for(const id of ['spread','density','thickness','seed-x','seed-y','rotation'])$(id).addEventListener('input',()=>{const v=Number($(id).value),s=editorSeed();if(id==='thickness')recipe.thickness=v;else{if(!s)return;if(id==='spread')s.spread=v;else if(id==='density')s.density=v;else if(id==='seed-x')s.x=v/100;else if(id==='seed-y')s.y=v/100;else s.angle=v/180*Math.PI;}controls();if(mode!=='add'||id==='thickness')invalidateComposition();});
 $('reseed').onclick=()=>{const s=editorSeed();if(!s)return;s.variant=(s.variant+7919)%2147483647;controls();if(mode!=='add')invalidateComposition();};$('remove-seed').onclick=()=>{recipe.seeds=recipe.seeds.filter(s=>s.id!==selected);selected=recipe.seeds[0]?.id??null;controls();invalidateComposition();};
 $('ink-size').oninput=()=>{$('ink-size-value').value=$('ink-size').value;$('ink-preview').style.height=Number($('ink-size').value)/2+'px';};
 $('undo-ink').onclick=()=>{recipe.strokes.pop();controls();invalidateComposition();};let clearInkTimer=0,confirmInk=false;$('clear-ink').onclick=()=>{if(!confirmInk){confirmInk=true;$('clear-ink').textContent='再点清空手绘';clearInkTimer=setTimeout(()=>{confirmInk=false;$('clear-ink').textContent='清空手绘';},3000);return;}clearTimeout(clearInkTimer);confirmInk=false;$('clear-ink').textContent='清空手绘';recipe.strokes=[];controls();invalidateComposition();};
 $('clear-motifs').onclick=()=>$('clear-motifs-dialog').showModal();$('confirm-clear-motifs').onclick=()=>{$('clear-motifs-dialog').close();recipe.seeds=[];selected=null;controls();invalidateComposition();};
 $('to-crack').onclick=()=>{if(geometryDirty){P.waxPattern(wax,recipe);geometryDirty=false;}field=new P.WaxField(wax);updateCracks();setStage('CRACK');};$('back-compose').onclick=()=>setStage('COMPOSE');
 $('stress').oninput=()=>{$('stress-value').value=Number($('stress').value)<35?'轻柔':Number($('stress').value)<75?'适中':'较强';};
 $('undo-crack').onclick=()=>{recipe.gestures.pop();cloth?.damage.fill(0);cracksDirty=true;requestPaint();save();};$('clear-cracks').onclick=()=>{recipe.gestures=[];cloth?.damage.fill(0);cracksDirty=true;requestPaint();save();};
 function beginDye(reset){
  if(stage==='DYE'&&simulationFrame&&!dyeFault)return;clearTimeout(simulationFrame);simulationFrame=0;if(geometryDirty){P.waxPattern(wax,recipe);geometryDirty=false;field=new P.WaxField(wax);material.updateMasks();cloth?.updateWax();}if(cracksDirty){updateCracks();cracksDirty=false;}if(reset){material.reset();totalDyeSeconds=0;history=[];passes=0;}
  passes++;runElapsed=0;accumulator=0;lastFrame=0;runStart=performance.now();dyePaused=false;dyeFault=false;setDyeImmersion(true);$('dye-seconds').textContent='0.0';$('simulation-status').textContent='浸染中';$('to-reveal').disabled=true;$('to-reveal').textContent='浸染中…';$('dye-pass').textContent='第 '+passes+' 次浸染';setStage('DYE');
  const tick=()=>{
   simulationFrame=0;if(stage!=='DYE')return;const time=performance.now(),delta=lastFrame?Math.min(.1,(time-lastFrame)/1000):0;lastFrame=time;
   try{
    if(!dyePaused){
     if(material.lost)material.useCPU();cloth?.advanceDye(delta);
     const speed=material.gpu?(material.n<512?260:400):160;accumulator+=delta*speed;const count=Math.min(24,Math.floor(accumulator));accumulator-=count;const bath=Math.min(1,.02+runElapsed/2.5);
     if(count){material.setContact?.(cloth&&clothView?cloth.contact():null);const airOnly=!dyeInBath&&!(cloth&&clothView);material.step(bath,recipe.strength/100,count,airOnly);const last=history.at(-1);if(last&&last.bath===bath&&last.strength===recipe.strength&&last.airOnly===airOnly)last.steps+=count;else history.push({bath,strength:recipe.strength,steps:count,airOnly});}
     material.render(1,true);if(cloth&&clothView){cloth.textureDirty=true;if(time-cloth.last>150){cloth.uploadTexture();cloth.render();}}
     // Advance the displayed clock only after a successful compute/render tick.
     runElapsed+=delta;totalDyeSeconds+=delta;$('dye-seconds').textContent=runElapsed.toFixed(1);$('simulation-status').textContent=dyeInBath?'浸染中':'氧化显色中';updateProcessStatus();
     if(runElapsed>2.7&&material.iterations>0&&$('to-reveal').disabled){$('to-reveal').disabled=false;$('to-reveal').textContent='取出，进入脱蜡 →';updateStepNavigation();}
     if(runElapsed>=35){finishDye();toast('本轮浸染已暂停，可以脱蜡欣赏，或继续浸染。');return;}
    }
   }catch(error){
    console.warn('Dye tick recovered:',error.message);
    if(material.gpu&&typeof material.useCPU==='function'){material.useCPU();$('renderer-badge').textContent='兼容浸染';$('simulation-status').textContent='已切换兼容浸染';}
    else{dyeFault=true;$('simulation-status').textContent='浸染暂停，请重试';$('to-reveal').disabled=false;$('to-reveal').textContent='重试浸染';save();}
   }finally{if(stage==='DYE'&&!dyeFault)simulationFrame=setTimeout(tick,40);}
  };simulationFrame=setTimeout(tick,0);
 }
 function finishDye(){clearTimeout(simulationFrame);simulationFrame=0;material.develop(100);history.push({phase:'air',airOnly:true,bath:0,strength:0,steps:100});$('reveal').value=0;$('reveal-value').value='0%';$('to-result').disabled=true;setStage('REVEAL');save();}
 $('to-dye').onclick=()=>beginDye(true);$('to-reveal').onclick=()=>{if(dyeFault)beginDye(false);else if(runElapsed>2.7)finishDye();};$('dye-strength').oninput=()=>{recipe.strength=Number($('dye-strength').value);$('dye-strength-value').value=recipe.strength+'%';save();};
 $('reveal').oninput=()=>{const v=Number($('reveal').value);$('reveal-value').value=v+'%';$('to-result').disabled=v<100;updateStepNavigation();requestPaint();};$('to-result').onclick=()=>{if(Number($('reveal').value)<100)return;setStage('RESULT');save();};$('back-dye').onclick=()=>beginDye(false);$('redye').onclick=()=>beginDye(false);
 $('title').oninput=()=>{recipe.title=Array.from($('title').value).slice(0,16).join('');controls();save();};
 $('new-work').onclick=()=>$('reset-dialog').showModal();$('confirm-reset').onclick=()=>{$('reset-dialog').close();recipe=fresh();selected=1;mode='move';branches=0;field=null;material.reset();geometryDirty=true;history=[];totalDyeSeconds=0;passes=0;$('title').value='';$('dye-strength').value=recipe.strength;$('dye-strength-value').value=recipe.strength+'%';setStage('COMPOSE');save();};
 function restore(input){recipe=copy(input);selected=recipe.seeds[0]?.id??null;mode='move';pendingSeed=null;drag=null;geometryDirty=false;cracksDirty=false;$('title').value=recipe.title;$('dye-strength').value=recipe.strength;$('dye-strength-value').value=recipe.strength+'%';P.waxPattern(wax,recipe);field=new P.WaxField(wax);updateCracks();material.reset();cloth?.reset();cloth?.updateWax();history=[];passes=0;totalDyeSeconds=0;setMode('move');controls();requestPaint();$('restore-recipe').hidden=true;toast('已恢复独立纹样、手绘与揉动轨迹。可继续创作或入染。');}
 $('restore-recipe').onclick=()=>{if(draft)restore(draft);};
 $('import-recipe').onclick=()=>$('recipe-file').click();$('recipe-file').onchange=async()=>{const file=$('recipe-file').files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('size');const imported=valid(JSON.parse(await file.text()));if(!imported)throw Error('format');restore(imported);save();}catch{toast('无法导入：请选择本工坊导出的有效 JSON 配方（不超过 1MB）。');}finally{$('recipe-file').value='';}};
 function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 $('save-recipe').onclick=()=>{downloadBlob(new Blob([JSON.stringify({...recipe,model:'batik-redox-v3',gridSize:material.n,dyeHistory:history,dyeSeconds:totalDyeSeconds,iterations:material.iterations,notes:'Original generated forms. Heuristic cracks; simplified diffusion, uptake and air oxidation. Device precision may affect output.'},null,2)],{type:'application/json'}),'蓝生万象-创作配方-'+recipe.randomSeed+'.json');toast('创作配方已导出，包含控制点、揉动轨迹与浸染日程。');};
 async function exportArt(){
  if(exportBusy||stage!=='RESULT')return;exportBusy=true;$('save-art').disabled=true;
  try{
   material.light=[-.4,.4];material.render(0,false);const art=material.capture(),c=document.createElement('canvas');c.width=1440;c.height=1940;const ctx=c.getContext('2d'),font='"Microsoft YaHei","PingFang SC",sans-serif';
   ctx.fillStyle='#f7f4eb';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#173c50';ctx.font='43px '+font;ctx.fillText('蓝生万象',100,105);ctx.fillStyle='#7b817a';ctx.font='17px '+font;ctx.fillText('THE INDIGO ATELIER / II   ·   生纹与染',100,145);ctx.strokeStyle='#d6d7cb';ctx.beginPath();ctx.moveTo(100,177);ctx.lineTo(1340,177);ctx.stroke();ctx.fillStyle='#e5e1d5';ctx.fillRect(84,212,1272,1272);ctx.drawImage(art,100,228,1240,1240);
   const title=recipe.title.trim()||'我的一抹蓝';ctx.fillStyle='#173c50';let size=48;ctx.font=size+'px '+font;while(ctx.measureText(title).width>1220&&size>28)ctx.font=(--size)+'px '+font;ctx.fillText(title,100,1557);ctx.fillStyle='#7b817a';ctx.font='19px '+font;ctx.fillText(`${recipe.seeds.length} 簇纹样  ·  ${recipe.strokes.length} 笔手绘  ·  ${recipe.gestures.length} 次揉蜡  ·  ${totalDyeSeconds.toFixed(1)} 秒数字浸染  ·  SEED ${recipe.randomSeed}`,100,1609);ctx.strokeStyle='#d6d7cb';ctx.beginPath();ctx.moveTo(100,1655);ctx.lineTo(1340,1655);ctx.stroke();ctx.fillStyle='#173c50';ctx.font='26px '+font;ctx.fillText('蜡守其白，裂隙生蓝。',100,1713);ctx.fillStyle='#7b817a';ctx.font='18px '+font;ctx.fillText('工艺参考：中国非物质文化遗产网《苗族蜡染技艺》',100,1765);ctx.fillText('www.ihchina.cn/project_details/14300/',100,1798);ctx.fillText('原创算法形态 · 简化的裂纹、扩散与吸附模型 · 非传统纹样复刻',100,1848);ctx.font='16px '+font;ctx.fillText('数字浸染时间与参数不对应真实工艺耗时或实测材料常数',100,1885);
   const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG failed')),'image/png'));if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=URL.createObjectURL(blob);$('export-image').src=exportUrl;$('download-art').href=exportUrl;$('download-art').download='蓝生万象-'+title.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_')+'.png';$('export-dialog').showModal();
  }catch(e){console.error(e);toast('作品卡生成失败，请重试。当前创作仍保留。');}finally{exportBusy=false;$('save-art').disabled=false;}
 }
 $('save-art').onclick=exportArt;
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>$(b.dataset.open).showModal());document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close();}));
 material.onLost=()=>{material.useCPU();if(cloth)cloth.textureDirty=true;save();$('renderer-badge').textContent='兼容浸染';toast('已切换兼容渲染，创作继续保留。');};
 document.addEventListener('visibilitychange',()=>{processPaused=document.hidden;if(stage!=='DYE')return;dyePaused=document.hidden;lastFrame=0;$('simulation-status').textContent=dyePaused?'已暂停':'浸染中';});
 window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);try{localStorage.setItem(KEY,JSON.stringify(recipe));}catch{}clearTimeout(simulationFrame);simulationFrame=0;});
 document.addEventListener('keydown',e=>{if(stage==='COMPOSE'&&mode==='draw'&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.matches('input,select,textarea')&&!document.querySelector('dialog[open]')){e.preventDefault();$('undo-ink').click();}});
 function updateStepNavigation(){
  const hasArt=recipe.seeds.length>0||recipe.strokes.length>0,dyed=totalDyeSeconds>2.7;
  document.querySelectorAll('.step-trigger').forEach(button=>{const target=button.closest('[data-stage]').dataset.stage;button.disabled=target==='COMPOSE'?false:['CRACK','DYE'].includes(target)?!hasArt:target==='REVEAL'?!dyed:!dyed||Number($('reveal').value)<100;if(target===stage)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
 }
 document.querySelectorAll('.step-list [data-stage]').forEach(item=>{
  const button=document.createElement('button');button.type='button';button.className='step-trigger';button.setAttribute('aria-label',({COMPOSE:'01 画蜡',CRACK:'02 揉蜡',DYE:'03 浸染',REVEAL:'04 脱蜡',RESULT:'05 成布'})[item.dataset.stage]);while(item.firstChild)button.append(item.firstChild);item.append(button);
  button.onclick=()=>{const target=item.dataset.stage;if(target===stage)return;if(target==='COMPOSE')setStage('COMPOSE');else if(target==='CRACK')$('to-crack').click();else if(target==='DYE')beginDye(true);else if(target==='REVEAL'){if(stage==='DYE')finishDye();else setStage('REVEAL');}else if(target==='RESULT')$('to-result').click();};
 });
 window.BatikStudio={getRecipe:()=>copy(recipe),getStage:()=>stage,getHistory:()=>copy(history),getSelection:()=>selected,material,cloth,wax,cracks,getField:()=>field,getBranches:()=>branches};
 for(const data of Object.values(window.BatikPhases)){const entry=document.createElement('article');entry.className='photo-source-entry';const img=document.createElement('img');img.src=data.image;img.alt=data.alt;const text=document.createElement('div'),link=document.createElement('a'),credit=document.createElement('small');link.href=data.page;link.target='_blank';link.rel='noopener noreferrer';link.textContent=data.title+' · 图片来源 ↗';credit.textContent=data.author+' / Pexels License';text.append(link,credit);entry.append(img,text);$('photo-sources').append(entry);}
 let processTicks=0;const processTimer=setInterval(()=>{if(processPaused)return;if(++processTicks%4===0)updateProcessStatus();if(!['REVEAL','RESULT'].includes(stage))return;try{if(finishPass++<180){material.develop(8);material.render(stage==='RESULT'?0:1-Number($('reveal').value)/100,false);if(cloth)cloth.textureDirty=true;}if(cloth){cloth.advanceDye(.08);if(performance.now()-cloth.last>150&&clothView){if(cloth.textureDirty)cloth.uploadTexture();cloth.render();}}}catch(error){console.warn('Material finish:',error.message);}},80);
 window.addEventListener('pagehide',()=>clearInterval(processTimer));
 controls();setMode('move');document.body.dataset.stage='COMPOSE';material.render(1,false);drawHandles();syncClothView();updatePhasePhoto();updateProcessStatus();
})();
