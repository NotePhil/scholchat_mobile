import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';
import { useThemeStore } from '../../store/useThemeStore';
import { useT } from '../../i18n';
import { CachedFile, FileOpenError, OpenableFile, downloadToCache, fileNameOf, readCachedBase64 } from '../../services/fileOpener';
import { openExternallyWithAlert } from '../../hooks/useFileOpener';

export interface PdfViewerParams {
  file: OpenableFile;
}

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/`;
/** Base64 is injected in slices (multiple of 4 chars, so each slice decodes on its own). */
const CHUNK = 512 * 1024;

/**
 * pdf.js page: every page is a canvas sized to the screen width, rendered when
 * it nears the viewport and dropped again when far away (keeps memory flat on
 * long documents). Zoom is the WebView's own pinch zoom; pages render at up to
 * 2× device pixels so zoomed text stays readable.
 */
const buildHtml = (bg: string) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes">
<style>
html,body{margin:0;padding:0;background:${bg};-webkit-tap-highlight-color:transparent;}
#pages{padding:8px 0 56px;}
.page{margin:0 auto 10px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3);position:relative;overflow:hidden;}
.page canvas{display:block;width:100%;height:100%;}
</style></head><body><div id="pages"></div>
<script>
function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
window.onerror=function(m){ post({type:'error',message:String(m)}); };
</script>
<script src="${PDFJS_BASE}pdf.min.js" onerror="post({type:'libError'})"></script>
<script>
(function(){
  if(!window.pdfjsLib){ post({type:'libError'}); return; }
  pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS_BASE}pdf.worker.min.js';
  var parts=[];
  window.__pdfChunk=function(b64){
    var bin=atob(b64), u=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
    parts.push(u);
  };
  window.__pdfDone=function(){
    var len=0; parts.forEach(function(p){ len+=p.length; });
    var data=new Uint8Array(len), o=0;
    parts.forEach(function(p){ data.set(p,o); o+=p.length; });
    parts=[];
    show(data);
  };
  function show(data){
    pdfjsLib.getDocument({data:data, isEvalSupported:false}).promise.then(function(pdf){
      var container=document.getElementById('pages');
      var width=Math.max(100, document.documentElement.clientWidth-16);
      var dpr=Math.min(2, window.devicePixelRatio||1);
      var quality=dpr*1.5;
      var pages=[];
      return pdf.getPage(1).then(function(first){
        var v1=first.getViewport({scale:1});
        for(var n=1;n<=pdf.numPages;n++){
          var el=document.createElement('div');
          el.className='page'; el.dataset.n=n;
          el.style.width=width+'px'; el.style.height=Math.round(width*v1.height/v1.width)+'px';
          container.appendChild(el);
          pages[n]={el:el,canvas:null,task:null};
        }
        post({type:'loaded',pages:pdf.numPages});
        function render(n){
          var p=pages[n]; if(p.canvas||p.task) return;
          p.task=pdf.getPage(n).then(function(page){
            var base=page.getViewport({scale:1});
            var css=width/base.width;
            p.el.style.height=Math.round(base.height*css)+'px';
            var vp=page.getViewport({scale:css*quality});
            var c=document.createElement('canvas');
            c.width=Math.floor(vp.width); c.height=Math.floor(vp.height);
            p.canvas=c; p.el.appendChild(c);
            return page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
          }).catch(function(){ post({type:'pageError',n:n}); }).then(function(){ p.task=null; });
        }
        function unload(n){
          var p=pages[n]; if(!p.canvas||p.task) return;
          p.canvas.width=0; p.canvas.height=0; p.el.removeChild(p.canvas); p.canvas=null;
        }
        var io=new IntersectionObserver(function(entries){
          entries.forEach(function(e){ var n=+e.target.dataset.n; if(e.isIntersecting) render(n); else unload(n); });
        },{rootMargin:'1500px 0px'});
        for(var k=1;k<=pdf.numPages;k++) io.observe(pages[k].el);
        var current=0;
        function report(){
          var mid=window.scrollY+window.innerHeight/2, n=1;
          for(var i=1;i<=pdf.numPages;i++){ if(pages[i].el.offsetTop<=mid) n=i; else break; }
          if(n!==current){ current=n; post({type:'page',n:n}); }
        }
        window.addEventListener('scroll',report,{passive:true});
        report();
      });
    }).catch(function(e){ post({type:'error',message:String((e&&e.message)||e)}); });
  }
  post({type:'ready'});
})();
</script></body></html>`;

type Phase = 'download' | 'render' | 'ready' | 'error';

/**
 * In-app PDF reader: downloads the file to the cache (with progress), then
 * renders it with pdf.js inside react-native-webview — no extra native module.
 * The header has close and "Ouvrir avec…" (native app chooser).
 */
const PdfViewerScreen = () => {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useT();
  const file = ((route.params ?? {}) as PdfViewerParams).file ?? {};
  const name = fileNameOf(file);

  const webRef = useRef<WebView>(null);
  const base64Ref = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>('download');
  const [progress, setProgress] = useState<number | null>(0);
  const [cached, setCached] = useState<CachedFile | null>(null);
  const [errorText, setErrorText] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const html = useMemo(() => buildHtml(isDark ? '#0F172A' : '#E2E8F0'), [isDark]);

  useEffect(() => {
    const controller = new AbortController();
    setPhase('download');
    setProgress(0);
    setErrorText('');
    setShowHint(false);
    setPageCount(0);
    base64Ref.current = null;
    (async () => {
      try {
        const c = await downloadToCache(file, { signal: controller.signal, onProgress: setProgress });
        if (controller.signal.aborted) return;
        setCached(c);
        base64Ref.current = await readCachedBase64(c);
        if (!controller.signal.aborted) setPhase('render');
      } catch (e) {
        if (controller.signal.aborted || (e instanceof FileOpenError && e.code === 'cancelled')) return;
        setErrorText(e instanceof FileOpenError && e.code === 'unavailable' ? t('fileViewer.unavailable') : t('fileViewer.downloadFailed'));
        setPhase('error');
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const sendDocument = useCallback(async () => {
    const b64 = base64Ref.current;
    if (!b64 || !webRef.current) return;
    for (let i = 0; i < b64.length; i += CHUNK) {
      webRef.current?.injectJavaScript(`window.__pdfChunk&&window.__pdfChunk("${b64.slice(i, i + CHUNK)}");true;`);
      // Let the bridge drain between slices.
      await new Promise((r) => setTimeout(r, 0));
    }
    // Kept in memory: a reload of the page (theme switch) asks for it again.
    webRef.current?.injectJavaScript('window.__pdfDone&&window.__pdfDone();true;');
  }, []);

  const renderFailed = useCallback(
    (hint: boolean) => {
      setErrorText(t('fileViewer.pdfRenderFailed'));
      setShowHint(hint);
      setPhase('error');
    },
    [t]
  );

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type?: string; pages?: number; n?: number } | null = null;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    switch (msg?.type) {
      case 'ready':
        sendDocument();
        break;
      case 'loaded':
        setPageCount(msg.pages ?? 0);
        setPhase('ready');
        break;
      case 'page':
        if (typeof msg.n === 'number') setPage(msg.n);
        break;
      case 'libError':
        renderFailed(true);
        break;
      case 'error':
        if (phase !== 'ready') renderFailed(false);
        break;
      default:
        break;
    }
  };

  const openWith = () => {
    if (cached) openExternallyWithAlert(cached, t);
  };

  const retry = () => {
    if (cached && errorText === t('fileViewer.pdfRenderFailed')) {
      // The file is already here: only rebuild the viewer.
      readCachedBase64(cached)
        .then((b64) => {
          base64Ref.current = b64;
          setErrorText('');
          setShowHint(false);
          setPhase('render');
        })
        .catch(() => setAttempt((a) => a + 1));
      return;
    }
    setAttempt((a) => a + 1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel={t('fileViewer.close')}>
          <FontAwesome5 name="times" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          {pageCount > 0 ? <Text style={styles.subtitle}>{t('fileViewer.pageOf', { page, total: pageCount })}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={openWith}
          disabled={!cached}
          style={[styles.openWith, !cached && styles.disabled]}
          accessibilityLabel={t('fileViewer.openWith')}
        >
          <FontAwesome5 name="external-link-alt" size={12} color={colors.primary} />
          <Text style={styles.openWithText}>{t('fileViewer.openWith')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {phase === 'render' || phase === 'ready' ? (
          <WebView
            key={`pdf-${attempt}`}
            ref={webRef}
            originWhitelist={['*']}
            source={{ html, baseUrl: PDFJS_BASE }}
            style={styles.webview}
            containerStyle={styles.webview}
            onMessage={onMessage}
            javaScriptEnabled
            domStorageEnabled
            scalesPageToFit
            setBuiltInZoomControls
            setDisplayZoomControls={false}
            setSupportMultipleWindows={false}
            showsVerticalScrollIndicator
            onError={() => renderFailed(true)}
            onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith(PDFJS_BASE) || req.url.startsWith('data:')}
          />
        ) : null}

        {phase === 'download' || phase === 'render' ? (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.centerText}>
              {phase === 'render'
                ? t('fileViewer.pdfLoading')
                : progress != null && progress > 0
                  ? t('fileViewer.downloadingPercent', { pct: Math.round(progress * 100) })
                  : t('fileViewer.downloading')}
            </Text>
            {phase === 'download' ? (
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.max(4, Math.round((progress ?? 0) * 100))}%` }]} />
              </View>
            ) : null}
          </View>
        ) : null}

        {phase === 'error' ? (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]}>
            <FontAwesome5 name="file-pdf" size={44} color={colors.danger} />
            <Text style={styles.errorTitle}>{errorText}</Text>
            {showHint ? <Text style={styles.centerText}>{t('fileViewer.pdfRenderHint')}</Text> : null}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={retry}>
                <FontAwesome5 name="redo" size={13} color={colors.text} />
                <Text style={styles.secondaryText}>{t('fileViewer.retry')}</Text>
              </TouchableOpacity>
              {cached ? (
                <TouchableOpacity style={styles.primaryButton} onPress={openWith}>
                  <FontAwesome5 name="external-link-alt" size={13} color="#FFFFFF" />
                  <Text style={styles.primaryText}>{t('fileViewer.openWith')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    titleWrap: { flex: 1 },
    title: { ...typography.h4, color: colors.text },
    subtitle: { ...typography.caption, color: colors.textMuted },
    openWith: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: `${colors.primary}1A`,
    },
    openWithText: { ...typography.captionBold, color: colors.primary },
    disabled: { opacity: 0.4 },
    body: { flex: 1 },
    webview: { flex: 1, backgroundColor: 'transparent' },
    center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
    centerText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
    errorTitle: { ...typography.h4, color: colors.text, textAlign: 'center' },
    track: { width: '70%', height: 6, borderRadius: 3, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
    bar: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryText: { ...typography.bodyBold, color: colors.text },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    primaryText: { ...typography.bodyBold, color: '#FFFFFF' },
  });

export default PdfViewerScreen;
