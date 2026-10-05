import { MessageItem, MessageMediaType, MessageParty } from "../../../../types";
import { parseServerDate } from "../../../../utils/dates";

/**
 * Shared helpers for the messaging screens (inbox, thread, compose).
 * Backend contract: see MessagesApi — MessageDto now carries `medias`,
 * deletes are per-user (`?scope=me|everyone`, POST /messages/bulk-delete),
 * and live updates arrive on /topic/messages/{userId}.
 */

/**
 * Message dates: ISO instants now, but older messages were stored with
 * java.util.Date#toString() ("Mon Oct 05 12:00:00 WAT 2026") or naive
 * strings — all handled by the shared parser (returns null, never Invalid Date).
 */
export const parseMessageDate = (value?: string | null): Date | null => parseServerDate(value);

export const dateMs = (value?: string | null) => parseMessageDate(value)?.getTime() ?? 0;

export const formatListDate = (value?: string) => {
  const date = parseMessageDate(value);
  if (!date) return "";
  const diffHours = (Date.now() - date.getTime()) / 3_600_000;
  if (diffHours < 24 && new Date().getDate() === date.getDate()) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffHours < 168) return date.toLocaleDateString("fr-FR", { weekday: "short" });
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

export const formatBubbleTime = (value?: string) => {
  const date = parseMessageDate(value);
  return date ? date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
};

export const formatDayLabel = (value?: string) => {
  const date = parseMessageDate(value);
  if (!date) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

export const getDisplayName = (party: MessageParty | null | undefined) => {
  if (party?.prenom || party?.nom) return `${party?.prenom ?? ""} ${party?.nom ?? ""}`.trim();
  return party?.email || "Utilisateur";
};

export const getInitials = (party: MessageParty | null | undefined) => {
  const initials = `${(party?.prenom ?? "").charAt(0)}${(party?.nom ?? "").charAt(0)}`.toUpperCase();
  return initials || (party?.email ?? "?").charAt(0).toUpperCase();
};

const ROLE_LABELS: Record<string, string> = {
  PROFESSEUR: "Professeur",
  PROFESSOR: "Professeur",
  ELEVE: "Élève",
  STUDENT: "Élève",
  PARENT: "Parent",
  PARENTS: "Parent",
  REPETITEUR: "Répétiteur",
  TUTOR: "Répétiteur",
  GESTIONNAIRE: "Gestionnaire",
  ADMIN: "Administrateur",
};

export const getRoleLabel = (party: { typeUtilisateur?: string; type?: string; role?: string } | null | undefined) => {
  const raw = (party?.typeUtilisateur || party?.type || party?.role || "").toString().toUpperCase();
  return ROLE_LABELS[raw] ?? "";
};

export const QUOTE_SEPARATOR = "--- Message original ---";

export const splitQuoted = (contenu?: string) => {
  const text = contenu ?? "";
  const idx = text.indexOf(QUOTE_SEPARATOR);
  if (idx === -1) return { body: text.trim(), quoted: "" };
  return { body: text.slice(0, idx).trim(), quoted: text.slice(idx).trim() };
};

export const stripReplyPrefix = (objet?: string) => (objet ?? "").replace(/^(re\s*:\s*)+/i, "").trim();

/** Body for POST /messages — the backend's Utilisateurs model rejects null nom/prenom. */
export const toUtilisateurPayload = (party: Partial<MessageParty> & { id: string }) => ({
  type: "utilisateur",
  id: party.id,
  nom: party.nom || "",
  prenom: party.prenom || "",
  email: party.email || "",
});

export interface ConversationThread {
  key: string;
  /** The other person (1-to-1) — null for a broadcast sent by the current user. */
  partner: MessageParty | null;
  /** Recipients of a broadcast sent by the current user (empty for 1-to-1). */
  broadcastRecipients: MessageParty[];
  partnerLabel: string;
  messages: MessageItem[];
  latest: MessageItem;
  unreadCount: number;
  hasReceived: boolean;
  hasSent: boolean;
  hasFavorite: boolean;
}

/**
 * Groups messages by conversation PARTNER (the other person), so every message
 * exchanged with the same person (sent + received, any subject) merges into
 * one thread — same rule as web's groupMessagesByConversation. A message the
 * current user sent to several people has no single partner and is grouped by
 * its recipient set instead.
 */
export const groupByPartner = (messages: MessageItem[], userId?: string): ConversationThread[] => {
  const buckets = new Map<string, { partner: MessageParty | null; recipients: MessageParty[]; messages: MessageItem[] }>();

  messages.forEach((msg) => {
    const isSender = !!userId && msg.expediteur?.id === userId;
    const destinataires = (msg.destinataires ?? []).filter((d) => d && d.id !== userId);
    let key: string;
    let partner: MessageParty | null = null;
    let recipients: MessageParty[] = [];
    if (isSender && destinataires.length === 1) {
      partner = destinataires[0];
      key = partner.id;
    } else if (!isSender) {
      partner = msg.expediteur ?? null;
      key = partner?.id ?? `unknown:${msg.id}`;
    } else if (destinataires.length === 0) {
      // Sent only to self (or recipients missing) — keep it visible on its own.
      partner = msg.expediteur ?? null;
      key = `self:${msg.id}`;
    } else {
      recipients = destinataires;
      key = `broadcast:${destinataires.map((d) => d.id).sort().join(",")}`;
    }
    const bucket = buckets.get(key) ?? { partner, recipients, messages: [] };
    // Prefer a partner object that actually carries a name.
    if (partner && !bucket.partner?.nom && !bucket.partner?.prenom) bucket.partner = partner;
    bucket.messages.push(msg);
    buckets.set(key, bucket);
  });

  const threads: ConversationThread[] = [];
  buckets.forEach(({ partner, recipients, messages: msgs }, key) => {
    const sorted = [...msgs].sort((a, b) => dateMs(a.dateCreation) - dateMs(b.dateCreation));
    const latest = sorted[sorted.length - 1];
    const isBroadcast = key.startsWith("broadcast:");
    const label = isBroadcast
      ? recipients.length <= 2
        ? recipients.map(getDisplayName).join(", ")
        : `${getDisplayName(recipients[0])} et ${recipients.length - 1} autres`
      : getDisplayName(partner);
    threads.push({
      key,
      partner: isBroadcast ? null : partner,
      broadcastRecipients: isBroadcast ? recipients : [],
      partnerLabel: label,
      messages: sorted,
      latest,
      unreadCount: sorted.filter((m) => !m.lu && m.expediteur?.id !== userId).length,
      hasReceived: sorted.some((m) => m.expediteur?.id !== userId),
      hasSent: sorted.some((m) => m.expediteur?.id === userId),
      hasFavorite: sorted.some((m) => m.favori),
    });
  });

  return threads.sort((a, b) => dateMs(b.latest.dateCreation) - dateMs(a.latest.dateCreation));
};

// ── Media helpers ─────────────────────────────────────────────────────────

export const mediaTypeFromMime = (mime?: string | null): MessageMediaType => {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "IMAGE";
  if (m.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
};

export const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
};

type IconName =
  | "image"
  | "video"
  | "file"
  | "file-pdf"
  | "file-word"
  | "file-excel"
  | "file-powerpoint"
  | "file-archive"
  | "file-audio"
  | "file-alt";

/** FontAwesome5 icon for an attachment (never emoji). */
export const mediaIconFor = (type?: string | null, mime?: string | null, name?: string | null): IconName => {
  if (type === "IMAGE") return "image";
  if (type === "VIDEO") return "video";
  const m = (mime ?? "").toLowerCase();
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (m.includes("pdf") || ext === "pdf") return "file-pdf";
  if (m.includes("word") || ext === "doc" || ext === "docx") return "file-word";
  if (m.includes("sheet") || m.includes("excel") || ["xls", "xlsx", "csv"].includes(ext)) return "file-excel";
  if (m.includes("presentation") || m.includes("powerpoint") || ["ppt", "pptx"].includes(ext)) return "file-powerpoint";
  if (m.includes("zip") || m.includes("compressed") || ["zip", "rar", "7z"].includes(ext)) return "file-archive";
  if (m.startsWith("audio/")) return "file-audio";
  if (m.startsWith("text/") || ext === "txt") return "file-alt";
  return "file";
};

/**
 * List preview for a message: its text, or — when the text is empty but it has
 * attachments — "Photo" / "Vidéo" / "Document" with a matching icon.
 */
export const getMessagePreview = (
  msg: MessageItem | null | undefined
): { text: string; icon: "paperclip" | "image" | "video" | "file" | null } => {
  const body = splitQuoted(msg?.contenu).body;
  const medias = msg?.medias ?? [];
  if (medias.length === 0) return { text: body, icon: null };
  if (body) return { text: body, icon: "paperclip" };
  const first = medias[0];
  const type = (first.mediaType as string) || mediaTypeFromMime(first.contentType);
  const n = medias.length;
  const suffix = n > 1 ? ` (${n})` : "";
  if (type === "IMAGE") return { text: `Photo${suffix}`, icon: "image" };
  if (type === "VIDEO") return { text: `Vidéo${suffix}`, icon: "video" };
  return { text: `Document${suffix}`, icon: "file" };
};

/** Merges `incoming` into `list` by id (replace or append). */
export const upsertById = (list: MessageItem[], incoming: MessageItem): MessageItem[] => {
  const idx = list.findIndex((m) => m.id === incoming.id);
  if (idx === -1) return [...list, incoming];
  const next = list.slice();
  next[idx] = { ...list[idx], ...incoming };
  return next;
};

/** Lower-case, accent-free form for search ("Élève" → "eleve"). */
export const normalizeSearch = (value?: string | null) => {
  const raw = (value ?? "").toString();
  let out = raw;
  try {
    out = raw.normalize("NFD").replace(/[̀-ͯ]/g, "");
  } catch {
    // String#normalize unavailable — fall back to plain lower-casing.
  }
  return out.toLowerCase().trim();
};

/**
 * Recipient autocomplete matcher: prénom, nom, full name in either order, or e-mail,
 * case- and accent-insensitive. Multi-word queries also match when every word hits.
 */
export const contactMatches = (
  contact: { prenom?: string | null; nom?: string | null; email?: string | null },
  query: string
) => {
  const q = normalizeSearch(query).replace(/\s+/g, " ");
  if (!q) return false;
  const prenom = normalizeSearch(contact.prenom);
  const nom = normalizeSearch(contact.nom);
  const email = normalizeSearch(contact.email);
  const fields = [prenom, nom, `${prenom} ${nom}`, `${nom} ${prenom}`, email];
  if (fields.some((f) => f.includes(q))) return true;
  const words = q.split(" ");
  return words.length > 1 && words.every((w) => prenom.includes(w) || nom.includes(w) || email.includes(w));
};
