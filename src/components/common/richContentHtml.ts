/**
 * Shared pieces of the rich-text (course chapter) pipeline on mobile, kept in
 * step with scholchat_front/src/components/richtext (sanitizeRichHtml.js +
 * richContent.css) so a chapter written on either platform looks the same on
 * both:
 *  - richContentCss(): the web typography (headings, lists, alignment, Quill
 *    classes, figures, attachment chips, tables, dark mode) for a WebView.
 *  - RICH_SANITIZER_JS: the web allowlist sanitizer, as ES5 source that runs
 *    INSIDE the WebView (it needs DOMParser). It defines
 *    window.__scSanitize(html, opts) → clean HTML. No script, event handler,
 *    iframe, form or javascript: URL survives, while every style the editor
 *    produces (inline text-align / colour / size, <font>, classes ql-* / rc-*)
 *    is kept.
 * Plain strings on purpose: Hermes does not keep function source, so a
 * Function.prototype.toString() trick would not work in release builds.
 */

export interface RichCssColors {
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  surfaceElevated: string;
}

/** Web's richContent.css, scoped to `.rich-content`, with theme colours. */
export const richContentCss = (c: RichCssColors, isDark: boolean) => `
.rich-content{color:${c.text};font-size:15px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word;display:flow-root;max-width:100%;}
.rich-content>:first-child{margin-top:0;}
.rich-content>:last-child{margin-bottom:0;}
.rich-content p{margin:0.5em 0;}
.rich-content div{margin:0;}
.rich-content h1,.rich-content h2,.rich-content h3,.rich-content h4,.rich-content h5,.rich-content h6{font-weight:700;line-height:1.3;margin:0.9em 0 0.4em;color:inherit;}
.rich-content h1{font-size:1.75em;}.rich-content h2{font-size:1.45em;}.rich-content h3{font-size:1.2em;}
.rich-content h4{font-size:1.05em;}.rich-content h5,.rich-content h6{font-size:1em;}
.rich-content b,.rich-content strong{font-weight:700;}
.rich-content i,.rich-content em{font-style:italic;}
.rich-content u,.rich-content ins{text-decoration:underline;}
.rich-content s,.rich-content strike,.rich-content del{text-decoration:line-through;}
.rich-content mark{background:#fef08a;color:#111827;padding:0 0.1em;}
.rich-content ul,.rich-content ol{margin:0.5em 0;padding-left:1.6em;}
.rich-content ul{list-style:disc outside;}.rich-content ol{list-style:decimal outside;}
.rich-content ul ul{list-style-type:circle;}.rich-content ul ul ul{list-style-type:square;}
.rich-content ol ol{list-style-type:lower-alpha;}.rich-content ol ol ol{list-style-type:lower-roman;}
.rich-content li{margin:0.2em 0;display:list-item;}
.rich-content li>p{margin:0;}
.rich-content ol[type="a"]{list-style-type:lower-alpha;}.rich-content ol[type="A"]{list-style-type:upper-alpha;}
.rich-content ol[type="i"]{list-style-type:lower-roman;}.rich-content ol[type="I"]{list-style-type:upper-roman;}
.rich-content .ql-align-center{text-align:center;}.rich-content .ql-align-right{text-align:right;}.rich-content .ql-align-justify{text-align:justify;}
.rich-content .ql-size-small{font-size:0.75em;}.rich-content .ql-size-large{font-size:1.5em;}.rich-content .ql-size-huge{font-size:2.5em;}
.rich-content .ql-indent-1{padding-left:3em;}.rich-content .ql-indent-2{padding-left:6em;}.rich-content .ql-indent-3{padding-left:9em;}.rich-content .ql-indent-4{padding-left:12em;}
.rich-content blockquote{margin:0.75em 0;padding:0.35em 1em;border-left:4px solid ${isDark ? "#475569" : "#cbd5e1"};color:${isDark ? "#cbd5e1" : "#475569"};background:rgba(148,163,184,${isDark ? "0.1" : "0.08"});border-radius:0 6px 6px 0;}
.rich-content blockquote[style*="margin: 0px 0px 0px 40px"],.rich-content blockquote[style*="margin: 0 0 0 40px"]{background:transparent;border-radius:0;color:inherit;}
.rich-content pre{margin:0.75em 0;padding:0.75em 1em;background:${isDark ? "#1e293b" : "#f1f5f9"};color:${isDark ? "#e2e8f0" : "#0f172a"};border-radius:8px;overflow-x:auto;white-space:pre;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.875em;line-height:1.5;}
.rich-content code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.9em;background:${isDark ? "#1e293b" : "#f1f5f9"};color:${isDark ? "#e2e8f0" : "#0f172a"};padding:0.1em 0.35em;border-radius:4px;}
.rich-content pre code{background:transparent;padding:0;font-size:inherit;}
.rich-content hr{border:0;border-top:1px solid ${isDark ? "#475569" : "#cbd5e1"};margin:1em 0;}
.rich-content a{color:${isDark ? "#93c5fd" : c.primary};text-decoration:underline;text-underline-offset:2px;}
.rich-content img,.rich-content video{display:inline-block;max-width:100%!important;height:auto;vertical-align:middle;border-radius:6px;}
.rich-content video{background:#000;max-height:70vh;}
.rich-content audio{max-width:100%;}
.rich-content [data-file-id]{max-width:100%;}
.rich-content [data-file-id][style*="margin: 8px auto"]{text-align:center;}
.rich-content [data-file-id][style*="margin: 8px auto"] img{margin-left:auto;margin-right:auto;}
.rich-content .rc-figure{margin:0.5em 0;max-width:100%;}
.rich-content .rc-figure img,.rich-content .rc-figure video{display:inline-block;}
.rich-content .rc-figure.rc-float-left{float:left;margin:0.25em 1em 0.5em 0;}
.rich-content .rc-figure.rc-float-right{float:right;margin:0.25em 0 0.5em 1em;}
.rich-content .rc-figure figcaption,.rich-content .rc-caption{font-size:0.75em;color:${isDark ? "#94a3b8" : "#64748b"};text-align:center;margin-top:0.25em;}
@media (max-width:480px){
.rich-content:not(.rich-content--editor) .rc-figure.rc-float-left,.rich-content:not(.rich-content--editor) .rc-figure.rc-float-right,.rich-content:not(.rich-content--editor) [data-file-id][style*="float"]{float:none!important;margin:0.5em 0!important;display:block!important;width:auto!important;}
}
.rich-content .rc-attachment{display:flex;align-items:center;gap:0.6em;margin:0.5em 0;padding:0.55em 0.8em;max-width:100%;box-sizing:border-box;background:${isDark ? "#1f2937" : "#f8fafc"};border:1px solid ${isDark ? "#374151" : "#e2e8f0"};border-radius:8px;text-align:left;}
.rich-content .rc-attachment-icon{font-size:1.15em;flex-shrink:0;}
.rich-content .rc-attachment a,.rich-content .rc-attachment .rc-attachment-name{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rich-content .rc-attachment-meta{margin-left:auto;flex-shrink:0;font-size:0.75em;color:${isDark ? "#94a3b8" : "#64748b"};}
.rich-content div[data-file-id][style*="display: flex"] a{font-weight:600;}
.rich-content .rc-table-wrap{clear:both;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0.75em 0;}
.rich-content table{border-collapse:collapse;margin:0.75em 0;font-size:0.95em;}
.rich-content .rc-table-wrap>table{margin:0;}
.rich-content th,.rich-content td{border:1px solid ${isDark ? "#475569" : "#cbd5e1"};padding:0.4em 0.65em;vertical-align:top;min-width:3em;overflow-wrap:normal;word-break:normal;}
.rich-content th{background:${isDark ? "#1e293b" : "#f1f5f9"};font-weight:700;}
.rich-content caption{caption-side:bottom;font-size:0.8em;color:${c.textMuted};padding-top:0.3em;}
${
  isDark
    ? `.rich-content [style*="background-color"]:not([style^="color"]):not([style*="; color"]),.rich-content mark{color:#111827;}
.rich-content [style*="color: rgb(0, 0, 0)"]:not([style*="background"]),.rich-content [style*="color: #000"]:not([style*="background"]),.rich-content [style*="color: black"]:not([style*="background"]),.rich-content font[color="#000000"],.rich-content font[color="#000"]{color:inherit!important;}`
    : ""
}
.rich-content--editor:empty::before{content:attr(data-placeholder);color:#9ca3af;font-style:italic;pointer-events:none;}
.rich-content--editor .rc-attachment{user-select:none;-webkit-user-select:none;}
.rich-content--editor td:empty::after,.rich-content--editor th:empty::after{content:"\\00a0";}
`;

/**
 * ES5 port of web's sanitizeRichHtml (same allowlists). Defines
 * window.__scSanitize(html, {forEditor, allowLocal}).
 *  - forEditor: no display decoration (table scroll wrapper, lazy images).
 *  - allowLocal: also accept file:/content: sources (professor's own preview
 *    of files not uploaded yet).
 */
export const RICH_SANITIZER_JS = `
(function(){
  function set(list){ var o={}; for(var i=0;i<list.length;i++) o[list[i]]=true; return o; }
  var DROP=set(["script","style","iframe","frame","frameset","object","embed","applet","form","input","button","select","option","textarea","label","link","meta","base","noscript","template","svg","math","canvas","dialog","title","head"]);
  var TAGS=set(["p","div","span","br","b","strong","i","em","u","s","strike","del","ins","sub","sup","mark","small","big","font","h1","h2","h3","h4","h5","h6","ul","ol","li","blockquote","pre","code","hr","a","img","video","audio","source","table","thead","tbody","tfoot","tr","th","td","caption","colgroup","col","figure","figcaption","center"]);
  var GLOBAL=set(["style","class","title","dir","align","data-file-id","data-file-name","data-file-size","data-file-type","data-sc-auth-src"]);
  var TAG_ATTRS={a:["href","target","rel","download"],img:["src","alt","width","height"],video:["src","controls","poster","width","height","preload","playsinline"],audio:["src","controls","preload"],source:["src","type"],font:["color","face","size"],ol:["start","type","reversed"],ul:["type"],td:["colspan","rowspan","width","valign"],th:["colspan","rowspan","width","valign","scope"],col:["span","width"],colgroup:["span"],table:["width","border","cellpadding","cellspacing"]};
  var STYLE=set(["color","background-color","background","text-align","text-decoration","text-decoration-line","text-indent","font-weight","font-style","font-size","font-family","line-height","letter-spacing","vertical-align","white-space","margin","margin-left","margin-right","margin-top","margin-bottom","padding","padding-left","padding-right","padding-top","padding-bottom","float","clear","display","width","max-width","min-width","height","max-height","border","border-top","border-bottom","border-left","border-right","border-color","border-style","border-width","border-radius","border-collapse","list-style-type","object-fit","box-shadow","gap","align-items","justify-content","flex-wrap"]);
  var DISPLAY=set(["block","inline","inline-block","flex","inline-flex","table","table-cell","table-row","list-item","none"]);
  var BAD=/url\\s*\\(|expression\\s*\\(|javascript:|vbscript:|@import|behaviou?r\\s*:|-moz-binding/i;
  var CLASS_OK=/^(ql-|rc-)/;
  function safeHref(v){ v=(v||"").trim(); if(!v) return false; if(/^(https?:|mailto:|tel:)/i.test(v)) return true; if(/^[#\\/?.]/.test(v)) return true; return !/^[a-z][a-z0-9+.-]*:/i.test(v); }
  function safeSrc(v,local){ v=(v||"").trim(); if(!v) return false; if(/^(https?:|blob:)/i.test(v)) return true; if(/^data:image\\/(png|jpe?g|gif|webp|bmp);base64,/i.test(v)) return true; if(/^\\//.test(v)) return true; if(local && /^(file:|content:|ph:|assets-library:)/i.test(v)) return true; return false; }
  function cleanStyle(t){
    if(!t) return ""; var out=[]; var parts=t.split(";");
    for(var i=0;i<parts.length;i++){ var d=parts[i]; var k=d.indexOf(":"); if(k<0) continue;
      var p=d.slice(0,k).trim().toLowerCase(); var v=d.slice(k+1).trim();
      if(!p||!v||!STYLE[p]||BAD.test(v)) continue;
      if(p==="display" && !DISPLAY[v.toLowerCase().replace(/\\s*!important/,"")]) continue;
      out.push(p+": "+v); }
    return out.join("; ");
  }
  function cleanAttrs(el,tag,o){
    var allowed=TAG_ATTRS[tag]||[]; var attrs=[]; for(var i=0;i<el.attributes.length;i++) attrs.push(el.attributes[i]);
    for(var j=0;j<attrs.length;j++){ var a=attrs[j]; var n=a.name.toLowerCase();
      if(!GLOBAL[n] && allowed.indexOf(n)<0){ el.removeAttribute(a.name); continue; }
      if(n==="style"){ var s=cleanStyle(a.value); if(s) el.setAttribute("style",s); else el.removeAttribute("style"); }
      else if(n==="class"){ var cl=a.value.split(/\\s+/).filter(function(c){ return CLASS_OK.test(c); }); if(cl.length) el.setAttribute("class",cl.join(" ")); else el.removeAttribute("class"); }
      else if(n==="href" && !safeHref(a.value)) el.removeAttribute("href");
      else if(n==="src" && !safeSrc(a.value,o.allowLocal)) el.removeAttribute("src");
      else if(n==="color" && BAD.test(a.value)) el.removeAttribute("color");
    }
  }
  function walk(node,doc,o){
    var kids=[]; for(var i=0;i<node.childNodes.length;i++) kids.push(node.childNodes[i]);
    for(var j=0;j<kids.length;j++){ var c=kids[j];
      if(c.nodeType===8){ c.parentNode.removeChild(c); continue; }
      if(c.nodeType!==1) continue;
      var tag=c.tagName.toLowerCase();
      if(DROP[tag]){ c.parentNode.removeChild(c); continue; }
      walk(c,doc,o);
      if(!TAGS[tag]){ var f=doc.createDocumentFragment(); while(c.firstChild) f.appendChild(c.firstChild); c.parentNode.replaceChild(f,c); continue; }
      cleanAttrs(c,tag,o);
    }
  }
  window.__scSanitize=function(html,o){
    o=o||{}; if(!html||typeof html!=="string") return "";
    var doc=new DOMParser().parseFromString('<!doctype html><html><body><div id="rc-root">'+html+'</div></body></html>',"text/html");
    var root=doc.getElementById("rc-root"); if(!root) return "";
    walk(root,doc,o);
    var chrome=root.querySelectorAll("[data-file-id] > div, [data-file-id] > span");
    for(var i=0;i<chrome.length;i++){ var e=chrome[i]; if(!e.textContent.trim() && !e.querySelector("img,video,audio,a")) e.parentNode.removeChild(e); }
    var links=root.querySelectorAll("a[href]");
    for(var k=0;k<links.length;k++){ var a=links[k]; var h=a.getAttribute("href")||""; if(/^(https?:)?\\/\\//i.test(h)||/^\\//.test(h)){ a.setAttribute("target","_blank"); a.setAttribute("rel","noopener noreferrer"); } else a.removeAttribute("target"); }
    if(o.forEditor){
      var w=root.querySelectorAll("div.rc-table-wrap");
      for(var m=0;m<w.length;m++){ var f=doc.createDocumentFragment(); while(w[m].firstChild) f.appendChild(w[m].firstChild); w[m].parentNode.replaceChild(f,w[m]); }
      var chips=root.querySelectorAll(".rc-attachment");
      for(var q=0;q<chips.length;q++) chips[q].setAttribute("contenteditable","false");
      return root.innerHTML;
    }
    var vids=root.querySelectorAll("video");
    for(var v=0;v<vids.length;v++){ vids[v].setAttribute("controls",""); vids[v].setAttribute("playsinline",""); if(!vids[v].getAttribute("preload")) vids[v].setAttribute("preload","metadata"); }
    var tables=root.querySelectorAll("table");
    for(var t=0;t<tables.length;t++){ var tb=tables[t]; if(tb.parentElement && tb.parentElement.classList.contains("rc-table-wrap")) continue; var wrap=doc.createElement("div"); wrap.className="rc-table-wrap"; tb.parentNode.replaceChild(wrap,tb); wrap.appendChild(tb); }
    return root.innerHTML;
  };
})();
`;

/** JSON literal safe to embed inside a <script> element. */
export const scriptJson = (value: unknown) =>
  JSON.stringify(value ?? "")
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

const escapeAttr = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Read-only document for CourseRichContent (sanitized in the WebView, web typography). */
export const buildViewerDocument = (
  base: string,
  body: string,
  token: string | null,
  c: RichCssColors,
  isDark: boolean,
  allowLocal: boolean
) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
html,body{margin:0;padding:0;background:transparent;}
body{font-family:-apple-system,Roboto,"Segoe UI",sans-serif;color:${c.text};-webkit-text-size-adjust:100%;}
${richContentCss(c, isDark)}
</style></head><body><div id="sc-root" class="rich-content"></div>
<script>${RICH_SANITIZER_JS}</script>
<script>
(function(){
  var TOKEN=${scriptJson(token || "")};
  var BASE=${scriptJson(base)};
  var root=document.getElementById('sc-root');
  root.innerHTML=window.__scSanitize(${scriptJson(body)},{allowLocal:${allowLocal ? "true" : "false"}});
  function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  var last=0;
  function report(){ var h=Math.ceil(root.getBoundingClientRect().height); if(h!==last){ last=h; post({type:'height',h:h}); } }
  // The token only ever goes to the API itself (proxy media), never to a URL taken from the content.
  function ownApi(url){ return typeof url==='string' && url.indexOf(BASE+'/media/')===0; }
  function authBlob(url){
    if(!ownApi(url)) return Promise.reject(new Error('foreign'));
    return fetch(url,{headers:TOKEN?{Authorization:'Bearer '+TOKEN}:{}}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.blob(); }).then(function(b){ return URL.createObjectURL(b); });
  }
  Array.prototype.forEach.call(root.querySelectorAll('img[data-sc-auth-src]'),function(img){
    authBlob(img.getAttribute('data-sc-auth-src')).then(function(u){ img.src=u; }).catch(function(){});
  });
  Array.prototype.forEach.call(root.querySelectorAll('video[data-sc-auth-src],source[data-sc-auth-src]'),function(el){
    var video=el.tagName==='VIDEO'?el:el.parentElement;
    function fallback(){ authBlob(el.getAttribute('data-sc-auth-src')).then(function(u){ el.src=u; if(video&&video.load) video.load(); }).catch(function(){}); }
    if(!el.getAttribute('src')) fallback(); else if(video) video.addEventListener('error',fallback,{once:true});
  });
  Array.prototype.forEach.call(root.querySelectorAll('video'),function(v){ v.addEventListener('loadedmetadata',report); });
  Array.prototype.forEach.call(document.images,function(img){ img.addEventListener('load',report); img.addEventListener('error',report); });
  document.addEventListener('click',function(e){
    var t=e.target;
    var a=t&&t.closest?t.closest('a[href]'):null;
    if(a){
      e.preventDefault();
      post({type:'link',url:a.getAttribute('href'),fileName:a.getAttribute('data-file-name')||(a.textContent||'').trim(),contentType:a.getAttribute('data-file-type')||''});
      return;
    }
    var img=t&&t.closest?t.closest('img'):null;
    if(img){
      var src=img.getAttribute('data-sc-auth-src')||img.getAttribute('src');
      if(src && !/^(data:|blob:)/i.test(src)){ e.preventDefault(); post({type:'link',url:src,fileName:img.getAttribute('alt')||'Image',contentType:'image/jpeg'}); }
    }
  },true);
  if(window.ResizeObserver){ new ResizeObserver(report).observe(root); }
  window.addEventListener('load',report);
  setTimeout(report,50); setTimeout(report,500); setTimeout(report,1500);
})();
</script></body></html>`;

/** Editable document for ChapterRichEditor (same CSS/sanitizer as the viewer, execCommand bridge). */
export const buildEditorDocument = (
  base: string,
  initial: string,
  placeholder: string,
  isDark: boolean,
  token: string | null,
  colors: RichCssColors
) => {
  const bg = isDark ? "#0F172A" : "#FFFFFF";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
html,body{margin:0;padding:0;background:${bg};}
body{font-family:-apple-system,Roboto,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%;}
#editor{min-height:100vh;box-sizing:border-box;padding:12px;outline:none;}
${richContentCss(colors, isDark)}
</style></head><body>
<div id="editor" class="rich-content rich-content--editor" contenteditable="true" data-placeholder="${escapeAttr(placeholder)}"></div>
<script>${RICH_SANITIZER_JS}</script>
<script>
(function(){
  var ed=document.getElementById('editor');
  var BASE=${scriptJson(base)};
  var TOKEN=${scriptJson(token || "")};
  ed.innerHTML=window.__scSanitize(${scriptJson(initial || "")},{forEditor:true,allowLocal:true});
  var saved=null;
  function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  // Stored HTML keeps the real (proxy) URLs; blob: URLs are display-only.
  function serialize(){
    var c=ed.cloneNode(true);
    var n=c.querySelectorAll('[data-sc-orig]');
    for(var i=0;i<n.length;i++){ n[i].setAttribute('src',n[i].getAttribute('data-sc-orig')); n[i].removeAttribute('data-sc-orig'); }
    var s=c.querySelectorAll('.rc-editor-selected'); for(var j=0;j<s.length;j++) s[j].classList.remove('rc-editor-selected');
    return c.innerHTML;
  }
  function emit(){ post({type:'change',html:serialize()}); }
  function ownApi(u){ return typeof u==='string' && u.indexOf(BASE+'/media/')===0; }
  function loadAuth(img){
    var u=img.getAttribute('src'); if(!ownApi(u)||!TOKEN) return;
    img.setAttribute('data-sc-orig',u);
    fetch(u,{headers:{Authorization:'Bearer '+TOKEN}}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function(b){ img.src=URL.createObjectURL(b); }).catch(function(){});
  }
  Array.prototype.forEach.call(ed.querySelectorAll('img'),loadAuth);
  var CMDS=['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight','justifyFull'];
  var stTimer=null;
  function state(){
    clearTimeout(stTimer);
    stTimer=setTimeout(function(){
      var o={type:'state'};
      for(var i=0;i<CMDS.length;i++){ try{ o[CMDS[i]]=document.queryCommandState(CMDS[i]); }catch(e){} }
      try{ o.block=(document.queryCommandValue('formatBlock')||'').toLowerCase().replace(/[<>]/g,''); }catch(e){}
      post(o);
    },60);
  }
  // Caret rect (viewport coords) so the app can keep it above the keyboard / docked toolbar.
  function caret(){
    var s=window.getSelection(); if(!s||s.rangeCount===0) return;
    var r=s.getRangeAt(0); if(!ed.contains(r.commonAncestorContainer)) return;
    var rect=null, rs=r.getClientRects();
    if(rs&&rs.length) rect=rs[rs.length-1];
    if(!rect||(!rect.height&&!rect.top)){ var n=r.endContainer; if(n&&n.nodeType!==1) n=n.parentNode; if(n&&n.getBoundingClientRect) rect=n.getBoundingClientRect(); }
    if(rect) post({type:'caret',top:rect.top,bottom:rect.bottom});
  }
  var caretTimer=null;
  function caretSoon(){ clearTimeout(caretTimer); caretTimer=setTimeout(caret,120); }
  window.__scCaret=caret;
  ed.addEventListener('focus',function(){ post({type:'focus'}); caretSoon(); });
  ed.addEventListener('blur',function(){ post({type:'blur'}); });
  document.addEventListener('selectionchange',function(){
    var s=window.getSelection();
    if(s&&s.rangeCount>0){ var r=s.getRangeAt(0); if(ed.contains(r.commonAncestorContainer)){ saved=r.cloneRange(); state(); if(document.activeElement===ed) caretSoon(); } }
  });
  function restore(){
    var s=window.getSelection();
    if(s&&s.rangeCount>0&&ed.contains(s.getRangeAt(0).commonAncestorContainer)){ saved=s.getRangeAt(0).cloneRange(); return true; }
    ed.focus();
    if(saved){ s=window.getSelection(); s.removeAllRanges(); s.addRange(saved); return true; }
    return false;
  }
  function exec(c,v,css){
    try{ document.execCommand('styleWithCSS',false,!!css); }catch(e){}
    document.execCommand(c,false,v==null?null:v);
  }
  window.__scCmd=function(c,v,css){ restore(); exec(c,v,css); emit(); state(); };
  var SENTINEL='rgb(1, 2, 3)';
  window.__scColor=function(kind,color){
    restore();
    exec(kind==='color'?'foreColor':'hiliteColor',color||SENTINEL,true);
    if(!color){
      var prop=kind==='color'?'color':'backgroundColor';
      Array.prototype.forEach.call(ed.querySelectorAll('[style]'),function(n){ if(n.style[prop]===SENTINEL) n.style[prop]=''; if(!n.getAttribute('style')) n.removeAttribute('style'); });
      Array.prototype.forEach.call(ed.querySelectorAll('font[color]'),function(n){ if((n.getAttribute('color')||'').toLowerCase()==='#010203') n.removeAttribute('color'); });
    }
    emit();
  };
  window.__scInsert=function(html){
    if(restore()) exec('insertHTML',html); else ed.insertAdjacentHTML('beforeend',html);
    Array.prototype.forEach.call(ed.querySelectorAll('.rc-attachment'),function(c){ c.setAttribute('contenteditable','false'); });
    emit();
  };
  window.__scLink=function(url,html,fallback){
    restore();
    var s=window.getSelection();
    var hasSel=s&&s.rangeCount>0&&!s.getRangeAt(0).collapsed;
    if(hasSel&&!html) exec('createLink',url); else exec('insertHTML',html||fallback);
    emit();
  };
  window.__scRemove=function(id){
    var els=ed.querySelectorAll('[data-file-id]');
    for(var i=0;i<els.length;i++){ if(els[i].getAttribute('data-file-id')!==id) continue; var t=els[i].closest('.rc-figure, .rc-attachment')||els[i]; if(t.parentNode) t.parentNode.removeChild(t); }
    emit();
  };
  ed.addEventListener('input',function(){ emit(); caretSoon(); });
  ed.addEventListener('blur',emit);
  ed.addEventListener('paste',function(e){
    e.preventDefault();
    var cd=e.clipboardData||window.clipboardData;
    var h=cd.getData('text/html'); var t=cd.getData('text/plain')||'';
    if(h){
      var tmp=document.createElement('div');
      tmp.innerHTML=window.__scSanitize(h,{forEditor:true});
      Array.prototype.forEach.call(tmp.querySelectorAll('img'),function(n){ var s=n.getAttribute('src')||''; if(/^(data:|file:|blob:)/i.test(s)||!s) n.parentNode.removeChild(n); });
      Array.prototype.forEach.call(tmp.querySelectorAll('[class]'),function(n){ var k=(n.getAttribute('class')||'').split(/\\s+/).filter(function(c){ return /^rc-(figure|float-|attachment|caption)/.test(c); }); if(k.length) n.setAttribute('class',k.join(' ')); else n.removeAttribute('class'); });
      exec('insertHTML',tmp.innerHTML);
    } else if(t){
      exec('insertHTML',t.split(/\\r?\\n/).map(function(l){ return l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }).join('<br>'));
    }
    setTimeout(emit,10);
  });
})();
true;
</script></body></html>`;
};
