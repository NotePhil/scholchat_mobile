import { useCallback, useRef, useState } from 'react';
import {
  ClassPreview,
  ClassPreviewError,
  ClassPreviewType,
  classPreviewService,
} from '../services/api/classPreviewService';
import { translate } from '../i18n';

export type ClassPreviewStatus = 'idle' | 'loading' | 'found' | 'error';

interface State {
  status: ClassPreviewStatus;
  preview: ClassPreview | null;
  error: string;
  errorCode?: string;
  /** Code (trimmed, upper-cased) the current preview / error belongs to. */
  code: string;
}

const IDLE: State = { status: 'idle', preview: null, error: '', code: '' };

const normalizeCode = (code: string) => code.trim().toUpperCase();

/**
 * Class lookup by activation code (GET /public/classes/apercu), run only by `check()` (single
 * "Vérifier le code" button) — nothing is fetched while typing. Editing the code after a lookup
 * hides the result (status back to "idle"). Results are cached per code.
 */
export const useClassPreview = (code: string, type: ClassPreviewType) => {
  const [state, setState] = useState<State>(IDLE);
  const cache = useRef<Record<string, ClassPreview>>({});
  const requestId = useRef(0);

  const run = useCallback(
    async (raw: string): Promise<ClassPreview | null> => {
      const c = normalizeCode(raw);
      if (!c) {
        setState({ ...IDLE, status: 'error', error: translate('classPreview.errors.required'), errorCode: 'CODE_CLASSE_REQUIS' });
        return null;
      }
      const cached = cache.current[`${type}:${c}`];
      if (cached) {
        setState({ status: 'found', preview: cached, error: '', code: c });
        return cached;
      }
      const id = ++requestId.current;
      setState({ status: 'loading', preview: null, error: '', code: c });
      try {
        const preview = await classPreviewService.getPreview(c, type);
        cache.current[`${type}:${c}`] = preview;
        if (id === requestId.current) setState({ status: 'found', preview, error: '', code: c });
        return preview;
      } catch (err) {
        const e = err as ClassPreviewError;
        if (id === requestId.current) {
          setState({
            status: 'error',
            preview: null,
            error: e?.message || translate('classPreview.errors.generic'),
            errorCode: e?.code,
            code: c,
          });
        }
        return null;
      }
    },
    [type]
  );

  /** Immediate lookup (reuses the current result when it is for the same code). */
  const check = useCallback(async (): Promise<ClassPreview | null> => {
    const c = normalizeCode(code);
    if (state.code === c && state.status === 'found' && state.preview) return state.preview;
    return run(code);
  }, [code, state, run]);

  const reset = useCallback(() => {
    requestId.current++;
    setState(IDLE);
  }, []);

  const current = normalizeCode(code) === state.code;
  return {
    status: current ? state.status : 'idle',
    preview: current ? state.preview : null,
    error: current ? state.error : '',
    errorCode: current ? state.errorCode : undefined,
    check,
    reset,
  };
};
