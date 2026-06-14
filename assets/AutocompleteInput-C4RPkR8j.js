import{j as d}from"./index-CqjP0k8Z.js";import{a as f}from"./vendor-react-D7rv8Q1m.js";const E=`
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
`;class R{constructor(){try{const s=new Blob([E],{type:"application/javascript"}),r=URL.createObjectURL(s);this.worker=new Worker(r),URL.revokeObjectURL(r),this.callbacks=new Map,this.searchId=0,this.worker.onmessage=a=>{const{type:o,payload:c}=a.data;if(o==="RESULTS"){const{results:p,searchId:l}=c,x=this.callbacks.get(l);x&&(x(p),this.callbacks.delete(l))}}}catch(s){console.error("Failed to initialize Autocomplete Web Worker, falling back to main thread.",s),this.worker=null,this.items=[]}}init(s){this.worker?this.worker.postMessage({type:"INIT",payload:s}):this.items=s||[]}search(s,r=50,a){if(this.worker){const o=++this.searchId;this.callbacks.clear(),this.callbacks.set(o,a),this.worker.postMessage({type:"SEARCH",payload:{query:s,limit:r,searchId:o}})}else{const o=(s||"").toLowerCase();if(o.trim()===""){a([]);return}const c=[];for(let p=0;p<this.items.length;p++){const l=this.items[p];if(l.toLowerCase().includes(o)&&(c.push(l),c.length>=r))break}a(c)}}terminate(){this.worker&&this.worker.terminate()}}function W({suggestions:h=[],placeholder:s="",onSelect:r,value:a,onChange:o,style:c={},buttonLabel:p="ADD",layout:l="horizontal",showButton:x=!0}){const b=a!==void 0&&o!==void 0,[j,I]=f.useState(""),[i,L]=f.useState([]),[y,n]=f.useState(!1),[k,C]=f.useState(null),[g,u]=f.useState(-1);f.useEffect(()=>{if(Array.isArray(h)&&h.length>100){const e=new R;return e.init(h),C(e),()=>{e.terminate()}}else C(null)},[h]),f.useEffect(()=>{u(-1)},[i]);const v=b?a:j,D=e=>{const t=e.target.value;if(b?o(t):I(t),t.trim())if(k)k.search(t,10,w=>{L(w.filter(m=>m.toLowerCase()!==t.toLowerCase())),n(!0)});else{const w=h.filter(m=>m.toLowerCase().includes(t.toLowerCase())&&m.toLowerCase()!==t.toLowerCase()).slice(0,10);L(w),n(!0)}else k&&k.search("",10,()=>{}),L([]),n(!1)},S=e=>{b?o(e):I(e),n(!1),r&&r(e)},A=()=>{v.trim()&&(r&&r(v.trim()),b||I(""),n(!1))};return d.jsx("div",{style:{width:"100%",...c},children:d.jsxs("div",{style:{display:"flex",flexDirection:l==="vertical"?"column":"row",gap:"6px"},children:[d.jsxs("div",{style:{position:"relative",width:"100%",flex:1},children:[d.jsx("input",{type:"text",placeholder:s,value:v,onChange:D,onFocus:()=>{v.trim()&&n(!0)},onBlur:()=>{n(!1)},onKeyDown:e=>{e.key==="Enter"?(e.preventDefault(),y&&g>=0&&g<i.length?S(i[g]):A()):e.key==="ArrowDown"?y&&i.length>0&&(e.preventDefault(),u(t=>(t+1)%i.length)):e.key==="ArrowUp"?y&&i.length>0&&(e.preventDefault(),u(t=>(t-1+i.length)%i.length)):e.key==="Escape"&&y&&(e.preventDefault(),n(!1),u(-1))},style:{width:"100%"}}),y&&i.length>0&&d.jsx("ul",{style:{position:"absolute",top:"100%",left:0,right:0,background:"var(--bg-secondary)",border:"1px solid var(--border-color)",borderRadius:"2px",padding:0,margin:"4px 0 0 0",listStyle:"none",zIndex:9999,maxHeight:"180px",overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,0.5)"},children:i.map((e,t)=>{const w=t===g;return d.jsx("li",{onMouseDown:m=>{m.preventDefault(),S(e)},style:{padding:"8px 12px",cursor:"pointer",fontFamily:"var(--font-mono)",fontSize:"12px",borderBottom:"1px solid rgba(30,48,30,0.1)",color:w?"var(--text-glow)":"var(--text-primary)",background:w?"rgba(149, 192, 149, 0.15)":"transparent",transition:"background 0.15s"},onMouseOver:()=>u(t),onMouseOut:()=>u(-1),children:e},t)})})]}),r&&x&&d.jsx("button",{type:"button",className:"btn btn-accent",onClick:A,style:{padding:"8px 12px",justifyContent:"center",width:l==="vertical"?"100%":"auto"},children:p})]})})}export{W as A,R as a};
