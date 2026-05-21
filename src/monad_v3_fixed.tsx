// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* ── Constants ─────────────────────────────────────────────── */
const PHI  = (1 + Math.sqrt(5)) / 2;
const TAU  = Math.PI * 2;
const N    = 190;           // nodes on outer shell
const K    = 6;             // neighbours per node
const ARC  = 20;            // arc segments per edge
const CIR  = 54;            // FOL circle segments

// Five memory layers – shells from inside out
const SHELLS = [
  { r: 2.8,  label: "Meta",        color: 0x9B72CF, nodes: 30  },
  { r: 3.8,  label: "Associative", color: 0xEF476F, nodes: 60  },
  { r: 4.8,  label: "Procedural",  color: 0x118AB2, nodes: 100 },
  { r: 5.8,  label: "Episodic",    color: 0x06D6A0, nodes: 150 },
  { r: 6.8,  label: "Semantic",    color: 0xFFD166, nodes: N   },
];

// RLI component labels & colors
const RLI_KEYS = ["stability","tuning_speed","conflict_dissolution","non_repetition","creative_continuity"];
const RLI_LABELS = ["Stability","Tuning Speed","Conflict Dissolution","Non-Repetition","Creative Continuity"];
const RLI_COLORS = ["#06D6A0","#FFD166","#EF476F","#118AB2","#9B72CF"];

// Node activation colors
const C_DEFAULT = new THREE.Color(0xB0CCEE);
const C_CORE    = new THREE.Color(0xFF3388);
const C_R1      = new THREE.Color(0xFF7799);
const C_R2      = new THREE.Color(0xAA3366);
const C_R3      = new THREE.Color(0x774488);
const C_BRIDGE  = new THREE.Color(0x44DDFF);

/* ── Geometry helpers ──────────────────────────────────────── */
function fibSphere(n, r) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const theta = Math.acos(1 - 2*(i+0.5)/n);
    const phi   = TAU * i / PHI;
    pts.push(new THREE.Vector3(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.cos(theta),
      r * Math.sin(theta) * Math.sin(phi)
    ));
  }
  return pts;
}

function buildAdj(pos, k) {
  const edgeSet = new Set();
  const adj = Array.from({length:pos.length},()=>[]);
  pos.forEach((p,i) => {
    pos.map((q,j)=>({j,d:p.distanceTo(q)}))
       .sort((a,b)=>a.d-b.d).slice(1,k+1)
       .forEach(({j})=>{
         const key=`${Math.min(i,j)}_${Math.max(i,j)}`;
         if(!edgeSet.has(key)){edgeSet.add(key);adj[i].push(j);adj[j].push(i);}
       });
  });
  return {edges:[...edgeSet],adj};
}

function makeArcLines(pos,edges,r,color,opacity){
  const verts=[];
  edges.forEach(e=>{
    const [a,b]=e.split("_").map(Number);
    const p1=pos[a].clone().normalize(), p2=pos[b].clone().normalize();
    for(let i=0;i<ARC;i++){
      const t1=i/ARC, t2=(i+1)/ARC;
      const v1=new THREE.Vector3().lerpVectors(p1,p2,t1).normalize().multiplyScalar(r*1.004);
      const v2=new THREE.Vector3().lerpVectors(p1,p2,t2).normalize().multiplyScalar(r*1.004);
      verts.push(v1.x,v1.y,v1.z,v2.x,v2.y,v2.z);
    }
  });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
  return new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity}));
}

function makeCircles(pos,r,circRad,color,opacity){
  const verts=[];
  pos.forEach(c=>{
    const n=c.clone().normalize();
    let up=new THREE.Vector3(0,1,0);
    if(Math.abs(n.y)>0.92) up.set(1,0,0);
    const t1=new THREE.Vector3().crossVectors(n,up).normalize();
    const t2=new THREE.Vector3().crossVectors(n,t1).normalize();
    const ca=Math.cos(circRad), sa=Math.sin(circRad);
    for(let i=0;i<CIR;i++){
      for(const f of[i/CIR,(i+1)/CIR]){
        const a=f*TAU;
        const v=n.clone().multiplyScalar(ca)
          .addScaledVector(t1,sa*Math.cos(a))
          .addScaledVector(t2,sa*Math.sin(a))
          .normalize().multiplyScalar(r);
        verts.push(v.x,v.y,v.z);
      }
    }
  });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
  return new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity}));
}

/* ── Main component ────────────────────────────────────────── */
export default function MONAD() {
  const mountRef = useRef(null);
  const stRef    = useRef({});
  const [busy,    setBusy]    = useState(false);
  const [query,   setQuery]   = useState("");
  const [log,     setLog]     = useState([]);
  const [activeShell, setActiveShell] = useState(4); // Semantic outer

  // S = (T, C, D, A, M)  – live state
  const [stateVec, setStateVec] = useState(
    { T:0.52, C:0.74, D:0.61, A:0.48, M:0.28 }
  );
  // RLI live vector
  const [rli, setRli] = useState(
    { stability:0.68, tuning_speed:0.55, conflict_dissolution:0.44,
      non_repetition:0.71, creative_continuity:0.59 }
  );
  const [activeLayer, setActiveLayer] = useState(null);

  /* ── Three.js setup ── */
  useEffect(()=>{
    const el = mountRef.current;
    const W=el.clientWidth, H=el.clientHeight;

    const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setSize(W,H);
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.shadowMap.enabled=false;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020814);

    const camera = new THREE.PerspectiveCamera(46,W/H,0.1,100);
    camera.position.z=17;

    /* ── Build all shells ── */
    const group = new THREE.Group();
    const shellData = [];

    SHELLS.forEach((sh, si)=>{
      const pos = fibSphere(sh.nodes, sh.r);
      const {edges,adj} = buildAdj(pos, K);

      const isOuter = si === SHELLS.length-1;

      // FOL circles on outer shell only
      if(isOuter){
        const avgLen = edges.reduce((s,e)=>{
          const [a,b]=e.split("_").map(Number);
          return s+pos[a].distanceTo(pos[b]);
        },0)/edges.length;
        const circRad = Math.asin(avgLen/(2*sh.r))*1.92;
        const circles = makeCircles(pos,sh.r,circRad,0x132560,0.38);
        group.add(circles);
      }

      // Arc connections
      const arcOpacity = isOuter ? 0.55 : 0.08 + si*0.04;
      const arcColor   = isOuter ? 0x2255AA : sh.color;
      const arcs = makeArcLines(pos,edges,sh.r,arcColor,arcOpacity);
      group.add(arcs);

      // Ghost wireframe sphere for inner shells
      if(!isOuter){
        const wGeo = new THREE.SphereGeometry(sh.r,24,16);
        const wMat = new THREE.MeshBasicMaterial({
          color:sh.color, wireframe:true, transparent:true, opacity:0.04+si*0.02
        });
        group.add(new THREE.Mesh(wGeo,wMat));
      }

      // Instanced nodes
      const nGeo  = new THREE.SphereGeometry(isOuter?0.13:0.07+si*0.015,10,8);
      const nMat  = new THREE.MeshPhongMaterial({shininess:120,specular:new THREE.Color(0x4477AA)});
      const iMesh = new THREE.InstancedMesh(nGeo,nMat,sh.nodes);
      iMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const m4=new THREE.Matrix4();
      pos.forEach((p,i)=>{
        m4.setPosition(p.clone().multiplyScalar(1.012));
        iMesh.setMatrixAt(i,m4);
        const col = isOuter ? C_DEFAULT : new THREE.Color(sh.color).multiplyScalar(0.6);
        iMesh.setColorAt(i,col);
      });
      iMesh.instanceMatrix.needsUpdate=true;
      iMesh.instanceColor.needsUpdate=true;
      group.add(iMesh);

      // Inter-shell bridge lines (sparse, between this shell and next)
      if(si < SHELLS.length-1){
        const nextSh = SHELLS[si+1];
        const nextPos = fibSphere(nextSh.nodes, nextSh.r);
        const bridgeVerts=[];
        // pick ~20 random bridges
        for(let b=0;b<20;b++){
          const ia=Math.floor(Math.random()*pos.length);
          const ib=Math.floor(Math.random()*nextPos.length);
          bridgeVerts.push(pos[ia].x,pos[ia].y,pos[ia].z,
                           nextPos[ib].x,nextPos[ib].y,nextPos[ib].z);
        }
        const bGeo=new THREE.BufferGeometry();
        bGeo.setAttribute("position",new THREE.Float32BufferAttribute(bridgeVerts,3));
        const bMat=new THREE.LineBasicMaterial({color:sh.color,transparent:true,opacity:0.08});
        group.add(new THREE.LineSegments(bGeo,bMat));
      }

      shellData.push({pos,adj,edges,iMesh,sh,isOuter});
    });

    /* ── Outer glow ── */
    const glowGeo=new THREE.SphereGeometry(SHELLS[4].r*1.08,32,32);
    const glowMat=new THREE.MeshBasicMaterial({color:0x0A1A55,transparent:true,opacity:0.07,side:THREE.BackSide});
    group.add(new THREE.Mesh(glowGeo,glowMat));

    scene.add(group);

    /* ── Lighting ── */
    scene.add(new THREE.AmbientLight(0x112244,1.5));
    const dl1=new THREE.DirectionalLight(0x7799FF,2.2);dl1.position.set(8,7,9);scene.add(dl1);
    const dl2=new THREE.DirectionalLight(0x220033,0.9);dl2.position.set(-7,-5,-7);scene.add(dl2);
    const pl=new THREE.PointLight(0x2244AA,1.1,25);pl.position.set(0,10,4);scene.add(pl);

    /* ── Propagation ── */
    const propagate = (shellIdx, startIdx) => {
      const {pos,adj,iMesh} = shellData[shellIdx];
      const n = pos.length;
      if(!iMesh||!adj) return 0;
      const visited=new Set([startIdx]);
      const bfsQ=[{idx:startIdx,depth:0}];
      const order=[];
      while(bfsQ.length){
        const {idx,depth}=bfsQ.shift();
        order.push({idx,depth});
        if(depth<3){
          (adj[idx]||[]).forEach(nb=>{
            if(!visited.has(nb)){visited.add(nb);bfsQ.push({idx:nb,depth:depth+1});}
          });
        }
      }
      setBusy(true);
      order.forEach(({idx,depth},i)=>{
        const on=depth*140+i*18;
        const off=on+2600;
        const col=depth===0?C_CORE:depth===1?C_R1:depth===2?C_R2:C_R3;
        setTimeout(()=>{iMesh.setColorAt(idx,col);iMesh.instanceColor.needsUpdate=true;},on);
        setTimeout(()=>{
          const def=shellData[shellIdx].isOuter?C_DEFAULT:new THREE.Color(shellData[shellIdx].sh.color).multiplyScalar(0.6);
          iMesh.setColorAt(idx,def);iMesh.instanceColor.needsUpdate=true;
        },off);
      });
      const last=order[order.length-1];
      const totalMs=(last?.depth??0)*140+(order.length-1)*18+2700;
      setTimeout(()=>setBusy(false),totalMs);

      // Update state vector on propagation
      setStateVec(s=>({
        T: Math.min(0.99,Math.max(0.1,s.T+(Math.random()-0.4)*0.08)),
        C: Math.min(0.99,Math.max(0.1,s.C+(Math.random()-0.3)*0.06)),
        D: Math.min(0.99,Math.max(0.1,s.D+(Math.random()-0.45)*0.07)),
        A: Math.min(0.99,Math.max(0.1,s.A+(Math.random()-0.3)*0.09)),
        M: Math.min(0.99,Math.max(0.1,s.M-(Math.random()-0.3)*0.06)),
      }));
      setRli(r=>({
        stability:          Math.min(0.99,Math.max(0.05,r.stability          +(Math.random()-0.3)*0.05)),
        tuning_speed:       Math.min(0.99,Math.max(0.05,r.tuning_speed       +(Math.random()-0.35)*0.06)),
        conflict_dissolution:Math.min(0.99,Math.max(0.05,r.conflict_dissolution+(Math.random()-0.25)*0.05)),
        non_repetition:     Math.min(0.99,Math.max(0.05,r.non_repetition     +(Math.random()-0.4)*0.04)),
        creative_continuity:Math.min(0.99,Math.max(0.05,r.creative_continuity+(Math.random()-0.3)*0.07)),
      }));

      return order.length;
    };

    stRef.current = { propagate, shellData };

    /* ── Background coherence drift ── */
    const driftIv = setInterval(()=>{
      setStateVec(s=>({
        T:Math.min(0.99,Math.max(0.1,s.T+(Math.random()-0.5)*0.01)),
        C:Math.min(0.99,Math.max(0.1,s.C+(Math.random()-0.48)*0.008)),
        D:Math.min(0.99,Math.max(0.1,s.D+(Math.random()-0.5)*0.01)),
        A:Math.min(0.99,Math.max(0.1,s.A+(Math.random()-0.5)*0.009)),
        M:Math.min(0.99,Math.max(0.1,s.M+(Math.random()-0.52)*0.008)),
      }));
    },1100);

    /* ── Mouse drag ── */
    let drag=false, prev=null, velX=0, velY=0, autoX=0, autoY=0;
    const getXY=e=>e.touches?{x:e.touches[0].clientX,y:e.touches[0].clientY}:{x:e.clientX,y:e.clientY};
    const onDown=e=>{drag=true;prev=getXY(e);velX=0;velY=0;};
    const onMove=e=>{
      if(!drag||!prev)return;
      const c=getXY(e);
      velX=(c.y-prev.y)*0.006; velY=(c.x-prev.x)*0.006;
      autoX+=velX; autoY+=velY;
      group.rotation.x=autoX; group.rotation.y=autoY; prev=c;
    };
    const onUp=()=>{drag=false;prev=null;};

    // Click to propagate on outer shell
    const ray=new THREE.Raycaster(); const m2=new THREE.Vector2();
    const onClick=e=>{
      if(Math.abs(velX)+Math.abs(velY)>0.012)return;
      const rect=el.getBoundingClientRect();
      m2.x=((e.clientX-rect.left)/W)*2-1;
      m2.y=-((e.clientY-rect.top)/H)*2+1;
      ray.setFromCamera(m2,camera);
      const outerMesh=shellData[shellData.length-1].iMesh;
      const hits=ray.intersectObject(outerMesh);
      if(hits.length>0){
        const si=stRef.current.activeShell??4;
        stRef.current.propagate(si,hits[0].instanceId);
      }
    };

    el.addEventListener("mousedown",onDown);
    el.addEventListener("touchstart",onDown,{passive:true});
    window.addEventListener("mousemove",onMove);
    window.addEventListener("touchmove",onMove,{passive:true});
    window.addEventListener("mouseup",onUp);
    window.addEventListener("touchend",onUp);
    el.addEventListener("click",onClick);

    /* ── Render loop ── */
    let raf, t=0;
    const tick=()=>{
      raf=requestAnimationFrame(tick);
      t+=0.008;
      if(!drag){
        autoY+=0.003;
        autoX+=Math.sin(autoY*0.15)*0.0007;
        group.rotation.y=autoY;
        group.rotation.x=autoX;
      }
      velX*=0.88; velY*=0.88;
      // Subtle inner shell pulse
      if(shellData.length){
        shellData.slice(0,-1).forEach((sd,si)=>{
          if(sd.iMesh) sd.iMesh.material.emissiveIntensity=0.15+0.1*Math.sin(t*1.2+si);
        });
      }
      renderer.render(scene,camera);
    };
    tick();

    return ()=>{
      clearInterval(driftIv);
      cancelAnimationFrame(raf);
      el.removeEventListener("mousedown",onDown);
      el.removeEventListener("touchstart",onDown);
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("touchmove",onMove);
      window.removeEventListener("mouseup",onUp);
      window.removeEventListener("touchend",onUp);
      el.removeEventListener("click",onClick);
      renderer.dispose();
      if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  },[]);

  // Keep activeShell synced in ref
  useEffect(()=>{ stRef.current.activeShell=activeShell; },[activeShell]);

  const doQuery = useCallback(()=>{
    if(!query.trim()||busy) return;
    const {propagate,shellData}=stRef.current;
    if(!propagate||!shellData) return;
    const si=activeShell;
    const nNodes=shellData[si].pos.length;
    const start=Math.floor(Math.random()*nNodes);
    const count=propagate(si,start);
    const cohVal=(0.65+Math.random()*0.33).toFixed(3);
    setLog(prev=>[{
      q:query.trim(), shell:SHELLS[si].label,
      count, coh:cohVal, t:Date.now()
    },...prev].slice(0,6));
    setQuery("");
  },[query,busy,activeShell]);

  /* ── Computed coherence (from C component of state) ── */
  const globalCoh = stateVec.C;

  /* ── UI ── */
  const mono = "'Courier New', monospace";
  const dim  = "rgba(255,255,255,0.035)";
  const bd   = "rgba(80,120,220,0.15)";

  return (
    <div style={{width:"100vw",height:"100vh",background:"#020814",overflow:"hidden",
                 position:"relative",fontFamily:mono,color:"#8899BB"}}>

      {/* 3D canvas */}
      <div ref={mountRef} style={{position:"absolute",inset:0,cursor:"grab"}}/>

      {/* Vignette */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1,
        background:"radial-gradient(ellipse at center, transparent 35%, rgba(2,8,20,0.75) 100%)"}}/>

      {/* ── HEADER ── */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:10,
        padding:"14px 22px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",
        background:"linear-gradient(to bottom,rgba(2,8,20,0.95) 0%,transparent 100%)"}}>
        <div>
          <div style={{fontSize:24,fontWeight:700,letterSpacing:"0.35em",
            color:"#AACCEE",textShadow:"0 0 28px rgba(80,160,255,0.65)"}}>◈ MONAD</div>
          <div style={{fontSize:7.5,letterSpacing:"0.22em",color:"#1E3060",marginTop:2}}>
            SPHERICAL MULTI-LAYER MEMORY · RESONANT QUANTUM LEARNING
          </div>
        </div>
        <div style={{display:"flex",gap:20,fontSize:9,color:"#1E3060",textAlign:"right"}}>
          {[
            {label:"NODES",  val: SHELLS.reduce((s,sh)=>s+sh.nodes,0),     col:"#5577AA"},
            {label:"SHELLS", val: SHELLS.length,                             col:"#4466AA"},
            {label:"STATUS", val: busy?"ACTIVE":"IDLE",                     col:busy?"#FF5588":"#3388AA"},
            {label:"COHER.", val:`${(globalCoh*100).toFixed(1)}%`,          col:"#6699CC"},
          ].map(({label,val,col})=>(
            <div key={label}>{label}<br/>
              <span style={{color:col,fontSize:13,fontWeight:700}}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── LEFT: Shell selector + State vector ── */}
      <div style={{position:"absolute",top:80,left:14,zIndex:10,
        display:"flex",flexDirection:"column",gap:8,width:168}}>

        {/* Shell selector */}
        <div style={{background:"rgba(2,8,20,0.85)",border:`1px solid ${bd}`,
          borderRadius:4,padding:"10px 11px"}}>
          <div style={{fontSize:7.5,letterSpacing:"0.2em",color:"#1A2E60",marginBottom:8}}>
            MEMORY SHELLS
          </div>
          {SHELLS.map((sh,si)=>{
            const hexCol="#"+sh.color.toString(16).padStart(6,"0");
            const act=activeShell===si;
            return (
              <div key={sh.label} onClick={()=>setActiveShell(si)}
                style={{cursor:"pointer",padding:"6px 8px",marginBottom:4,borderRadius:3,
                  border:`1px solid ${act?hexCol:"rgba(255,255,255,0.04)"}`,
                  background:act?hexCol+"18":"transparent",transition:"all 0.2s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:9,color:hexCol,letterSpacing:"0.08em"}}>{sh.label}</span>
                  <span style={{fontSize:7,color:"#1A2E60"}}>{sh.nodes}</span>
                </div>
                <div style={{height:1.5,background:"rgba(255,255,255,0.04)",borderRadius:1,marginTop:4}}>
                  <div style={{height:"100%",width:`${(si+1)/SHELLS.length*100}%`,
                    background:hexCol,borderRadius:1}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* State vector S=(T,C,D,A,M) */}
        <div style={{background:"rgba(2,8,20,0.85)",border:`1px solid ${bd}`,
          borderRadius:4,padding:"10px 11px"}}>
          <div style={{fontSize:7.5,letterSpacing:"0.2em",color:"#1A2E60",marginBottom:8}}>
            STATE  S = (T,C,D,A,M)
          </div>
          {Object.entries(stateVec).map(([k,v])=>(
            <div key={k} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:8,color:"#2A4070",letterSpacing:"0.1em"}}>{k}</span>
                <span style={{fontSize:8,color:"#5577AA"}}>{v.toFixed(3)}</span>
              </div>
              <div style={{height:2,background:"rgba(255,255,255,0.04)",borderRadius:1}}>
                <div style={{height:"100%",width:`${v*100}%`,
                  background:k==="M"?"#EF476F":k==="T"?"#FFD166":"#4477BB",
                  borderRadius:1,transition:"width 1.2s ease"}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: RLI vector ── */}
      <div style={{position:"absolute",top:80,right:14,zIndex:10,width:175,
        display:"flex",flexDirection:"column",gap:8}}>

        <div style={{background:"rgba(2,8,20,0.85)",border:`1px solid ${bd}`,
          borderRadius:4,padding:"10px 11px"}}>
          <div style={{fontSize:7.5,letterSpacing:"0.2em",color:"#1A2E60",marginBottom:8}}>
            RLI  RESONANCE LEARNING INDEX
          </div>
          {RLI_KEYS.map((k,i)=>(
            <div key={k} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:7.5,color:RLI_COLORS[i],letterSpacing:"0.05em"}}>
                  {RLI_LABELS[i]}
                </span>
                <span style={{fontSize:8,color:RLI_COLORS[i]}}>
                  {(rli[k]*100).toFixed(0)}
                </span>
              </div>
              <div style={{height:2,background:"rgba(255,255,255,0.04)",borderRadius:1}}>
                <div style={{height:"100%",width:`${rli[k]*100}%`,
                  background:RLI_COLORS[i],borderRadius:1,transition:"width 1.4s ease",
                  boxShadow:`0 0 6px ${RLI_COLORS[i]}66`}}/>
              </div>
            </div>
          ))}
        </div>

        {/* Wave logic readout */}
        <div style={{background:"rgba(2,8,20,0.85)",border:`1px solid ${bd}`,
          borderRadius:4,padding:"10px 11px"}}>
          <div style={{fontSize:7.5,letterSpacing:"0.2em",color:"#1A2E60",marginBottom:8}}>
            WAVE LOGIC
          </div>
          {[
            {label:"Amplitude", val:(stateVec.C*0.6+stateVec.T*0.4), note:"trust / strength"},
            {label:"Phase",     val:(stateVec.D*0.7+stateVec.A*0.3), note:"direction / alignment"},
            {label:"Waveform",  val:(1-stateVec.M*0.8),              note:"coherence / quality"},
          ].map(({label,val,note})=>(
            <div key={label} style={{marginBottom:7}}>
              <div style={{fontSize:7.5,color:"#2A4070",letterSpacing:"0.08em"}}>{label}</div>
              <div style={{fontSize:7,color:"#152040",marginBottom:2}}>{note}</div>
              <div style={{height:2,background:"rgba(255,255,255,0.04)",borderRadius:1}}>
                <div style={{height:"100%",width:`${val*100}%`,
                  background:"linear-gradient(to right,#2244AA,#44AAFF)",
                  borderRadius:1,transition:"width 1.3s ease"}}/>
              </div>
            </div>
          ))}
        </div>

        {/* Retrieval log */}
        {log.length>0 && (
          <div style={{background:"rgba(2,8,20,0.85)",border:`1px solid ${bd}`,
            borderRadius:4,padding:"10px 11px"}}>
            <div style={{fontSize:7.5,letterSpacing:"0.2em",color:"#1A2E60",marginBottom:8}}>
              RETRIEVAL LOG
            </div>
            {log.map((l,i)=>(
              <div key={l.t} style={{marginBottom:8,opacity:1-i*0.16}}>
                <div style={{fontSize:8.5,color:"#4466AA",marginBottom:2,wordBreak:"break-all"}}>
                  "{l.q}"
                </div>
                <div style={{fontSize:7.5,color:"#1A2E60",lineHeight:1.8}}>
                  <span style={{color:"#2A4888"}}>{l.shell}</span>
                  {"  "}·{"  "}
                  <span>n={l.count}</span>
                  {"  "}·{"  "}
                  <span style={{color:"#3A5899"}}>coh={l.coh}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM: Query bar ── */}
      <div style={{position:"absolute",bottom:36,left:"50%",transform:"translateX(-50%)",
        display:"flex",gap:8,width:"min(540px,80vw)",zIndex:10}}>
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&doQuery()}
          placeholder={`query → ${SHELLS[activeShell].label} shell retrieval...`}
          style={{flex:1,background:"rgba(2,8,20,0.92)",
            border:"1px solid rgba(60,100,220,0.22)",borderRadius:3,
            padding:"10px 14px",color:"#AACCEE",fontSize:10.5,
            fontFamily:mono,outline:"none",letterSpacing:"0.04em"}}
        />
        <button onClick={doQuery} disabled={busy} style={{
          background:busy?"rgba(20,40,100,0.18)":"rgba(30,60,160,0.28)",
          border:"1px solid rgba(70,120,255,0.25)",color:"#5577BB",
          padding:"10px 16px",borderRadius:3,cursor:busy?"wait":"pointer",
          fontSize:9.5,letterSpacing:"0.15em",fontFamily:mono}}>
          {busy?"···":"RECALL"}
        </button>
      </div>

      {/* ── BOTTOM hint ── */}
      <div style={{position:"absolute",bottom:14,left:"50%",transform:"translateX(-50%)",
        fontSize:7,color:"#0A1530",letterSpacing:"0.18em",zIndex:10,whiteSpace:"nowrap"}}>
        DRAG TO ROTATE · CLICK NODE TO PROPAGATE RQL WAVE · SELECT SHELL TO TARGET LAYER
      </div>

      {/* ── Patent tag (corner) ── */}
      <div style={{position:"absolute",bottom:14,right:14,zIndex:10,
        fontSize:6.5,color:"#0D1A30",letterSpacing:"0.12em",textAlign:"right",lineHeight:1.7}}>
        ISOTROPIC SPHERICAL NODE NETWORK<br/>
        FIBONACCI LATTICE · GEODESIC ARCS · k=6<br/>
        SPATIAL ADDRESSING · GEOMETRIC RECONSTRUCTION
      </div>
    </div>
  );
}
