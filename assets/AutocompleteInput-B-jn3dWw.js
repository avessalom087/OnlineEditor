import{i as M,j as l}from"./index-Gc2tveP3.js";import{a as f}from"./vendor-react-D7rv8Q1m.js";const U=`
  let items = [];
  self.onmessage = function(e) {
    const { type, payload } = e.data;
    if (type === 'INIT') {
      items = payload || [];
    } else if (type === 'SEARCH') {
      const { query, limit, searchId } = payload;
      const lower = (query || '').toLowerCase();
      const results = [];
      
      if (lower.trim() === '') {
        self.postMessage({ type: 'RESULTS', payload: { results: [], searchId } });
        return;
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.toLowerCase().includes(lower)) {
          results.push(item);
          if (results.length >= limit) break;
        }
      }
      self.postMessage({ type: 'RESULTS', payload: { results, searchId } });
    }
  };
`;class T{constructor(){try{const t=new Blob([U],{type:"application/javascript"}),o=URL.createObjectURL(t);this.worker=new Worker(o),URL.revokeObjectURL(o),this.callbacks=new Map,this.searchId=0,this.worker.onmessage=i=>{const{type:r,payload:d}=i.data;if(r==="RESULTS"){const{results:h,searchId:c}=d,b=this.callbacks.get(c);b&&(b(h),this.callbacks.delete(c))}}}catch(t){console.error("Failed to initialize Autocomplete Web Worker, falling back to main thread.",t),this.worker=null,this.items=[]}}init(t){this.worker?this.worker.postMessage({type:"INIT",payload:t}):this.items=t||[]}search(t,o=50,i){if(this.worker){const r=++this.searchId;this.callbacks.clear(),this.callbacks.set(r,i),this.worker.postMessage({type:"SEARCH",payload:{query:t,limit:o,searchId:r}})}else{const r=(t||"").toLowerCase();if(r.trim()===""){i([]);return}const d=[];for(let h=0;h<this.items.length;h++){const c=this.items[h];if(c.toLowerCase().includes(r)&&(d.push(c),d.length>=o))break}i(d)}}terminate(){this.worker&&this.worker.terminate()}}function W(n,t){if(!t)return n;const o=n.split(new RegExp(`(${t.replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&")})`,"gi"));return l.jsx("span",{children:o.map((i,r)=>i.toLowerCase()===t.toLowerCase()?l.jsx("strong",{style:{color:"var(--text-glow)",textShadow:"0 0 4px rgba(178, 250, 158, 0.4)"},children:i},r):l.jsx("span",{children:i},r))})}function F({suggestions:n=[],placeholder:t="",onSelect:o,value:i,onChange:r,style:d={},buttonLabel:h,layout:c="horizontal",showButton:b=!0}){const{t:A}=M(),E=h||A("map_add_btn"),g=i!==void 0&&r!==void 0,[R,L]=f.useState(""),[a,C]=f.useState([]),[x,p]=f.useState(!1),[k,I]=f.useState(null),[v,u]=f.useState(-1);f.useEffect(()=>{if(Array.isArray(n)&&n.length>100){const e=new T;return e.init(n),I(e),()=>{e.terminate()}}else I(null)},[n]),f.useEffect(()=>{u(-1)},[a]);const y=g?i:R,D=e=>{const s=e.target.value;if(g?r(s):L(s),s.trim())if(k)k.search(s,10,w=>{C(w.filter(m=>m.toLowerCase()!==s.toLowerCase())),p(!0)});else{const w=n.filter(m=>m.toLowerCase().includes(s.toLowerCase())&&m.toLowerCase()!==s.toLowerCase()).slice(0,10);C(w),p(!0)}else k&&k.search("",10,()=>{}),C([]),p(!1)},j=e=>{g?r(e):L(e),p(!1),o&&o(e)},S=()=>{y.trim()&&(o&&o(y.trim()),g||L(""),p(!1))};return l.jsx("div",{style:{width:"100%",...d},children:l.jsxs("div",{style:{display:"flex",flexDirection:c==="vertical"?"column":"row",gap:"6px"},children:[l.jsxs("div",{style:{position:"relative",width:"100%",flex:1},children:[l.jsx("input",{type:"text",placeholder:t,value:y,onChange:D,onFocus:()=>{y.trim()&&p(!0)},onBlur:()=>{p(!1)},onKeyDown:e=>{e.key==="Enter"?(e.preventDefault(),x&&v>=0&&v<a.length?j(a[v]):S()):e.key==="ArrowDown"?x&&a.length>0&&(e.preventDefault(),u(s=>(s+1)%a.length)):e.key==="ArrowUp"?x&&a.length>0&&(e.preventDefault(),u(s=>(s-1+a.length)%a.length)):e.key==="Escape"&&x&&(e.preventDefault(),p(!1),u(-1))},style:{width:"100%"}}),x&&a.length>0&&l.jsx("ul",{style:{position:"absolute",top:"100%",left:0,right:0,background:"var(--bg-secondary)",border:"1px solid var(--border-color)",borderRadius:"2px",padding:0,margin:"4px 0 0 0",listStyle:"none",zIndex:9999,maxHeight:"180px",overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,0.5)"},children:a.map((e,s)=>{const w=s===v;return l.jsx("li",{onMouseDown:m=>{m.preventDefault(),j(e)},style:{padding:"8px 12px",cursor:"pointer",fontFamily:"var(--font-mono)",fontSize:"12px",borderBottom:"1px solid rgba(30,48,30,0.1)",color:w?"var(--text-glow)":"var(--text-primary)",background:w?"rgba(149, 192, 149, 0.15)":"transparent",transition:"background 0.15s"},onMouseOver:()=>u(s),onMouseOut:()=>u(-1),children:W(e,y)},s)})})]}),o&&b&&l.jsx("button",{type:"button",className:"btn btn-accent",onClick:S,style:{padding:"8px 12px",justifyContent:"center",width:c==="vertical"?"100%":"auto"},children:E})]})})}export{F as A,T as a};
