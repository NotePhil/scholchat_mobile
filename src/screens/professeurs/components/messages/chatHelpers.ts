import { translate } from "../../../../i18n";
import { ChatMessage, Conversation, ConversationParticipant } from "../../../../services/conversationService";
import { MessageMedia } from "../../../../types";
import { dateMs, mediaTypeFromMime, parseMessageDate } from "./messageHelpers";

/** Helpers of the WhatsApp-like chat (conversation list + chat view). */

// ── List filters (same labels and rules as the web app) ────────────────────
export type ConversationFilter = "all" | "unread" | "favorites" | "general" | "sent" | "trash";

export const CONVERSATION_FILTERS: { id: ConversationFilter; labelKey: Parameters<typeof translate>[0] }[] = [
  { id: "all", labelKey: "chat.filters.all" },
  { id: "unread", labelKey: "chat.filters.unread" },
  { id: "favorites", labelKey: "chat.filters.favorites" },
  { id: "general", labelKey: "chat.filters.general" },
  { id: "sent", labelKey: "chat.filters.sent" },
  { id: "trash", labelKey: "chat.filters.trash" },
];

/** Unread messages, or marked as unread. */
export const isUnreadConversation = (c: Conversation) => (c.nonLus ?? 0) > 0 || !!c.marqueNonLu;

/** Starred conversation, or one containing a message I starred. */
export const isFavoriteConversation = (c: Conversation) => !!c.favori || !!c.contientFavori;

/** Class, group and general broadcast conversations. */
export const isGeneralConversation = (c: Conversation) => !!c.general || c.type === "GROUPE" || !!c.classeId;

/** The last message is mine, or I started the conversation. */
export const isSentConversation = (c: Conversation, userId?: string) =>
  !!userId && (c.dernierMessage?.expediteurId === userId || c.createdBy === userId);

export const conversationMatchesFilter = (c: Conversation, filter: ConversationFilter, userId?: string) => {
  switch (filter) {
    case "unread":
      return isUnreadConversation(c);
    case "favorites":
      return isFavoriteConversation(c);
    case "general":
      return isGeneralConversation(c);
    case "sent":
      return isSentConversation(c, userId);
    default:
      return true;
  }
};

/** Badge of the list / header: "Classe" (message to a class) or "Général" (message to several classes). */
export const conversationBadgeKey = (c: Conversation): Parameters<typeof translate>[0] | null => {
  if (c.categorie === "GENERAL") return "chat.generalBadge";
  if (c.categorie === "CLASSE" || (c.type === "GROUPE" && !!c.classeId)) return "chat.classBadge";
  return null;
};

export const participantName = (p?: { prenom?: string | null; nom?: string | null } | null) => {
  const name = `${p?.prenom ?? ""} ${p?.nom ?? ""}`.trim();
  return name || translate("chat.unknownUser");
};

export const participantInitials = (p?: { prenom?: string | null; nom?: string | null } | null) => {
  const initials = `${(p?.prenom ?? "").trim().charAt(0)}${(p?.nom ?? "").trim().charAt(0)}`.toUpperCase();
  return initials || "?";
};

export const otherParticipants = (c: Conversation, userId?: string): ConversationParticipant[] =>
  (c.participants ?? []).filter((p) => p.id !== userId);

/** DIRECT: the other person (or the caller for a note-to-self). */
export const directPartner = (c: Conversation, userId?: string): ConversationParticipant | null =>
  otherParticipants(c, userId)[0] ?? (c.participants ?? [])[0] ?? null;

export const conversationTitle = (c: Conversation, userId?: string) => {
  if (c.type === "GROUPE") {
    if (c.titre?.trim()) return c.titre.trim();
    const others = otherParticipants(c, userId);
    if (others.length === 0) return translate("chat.groupBadge");
    const names = others.slice(0, 3).map((p) => (p.prenom || p.nom || "").trim()).filter(Boolean);
    return others.length > 3 ? `${names.join(", ")}…` : names.join(", ");
  }
  return participantName(directPartner(c, userId));
};

export const conversationInitials = (c: Conversation, userId?: string) => {
  if (c.type === "GROUPE") {
    const words = conversationTitle(c, userId).split(/\s+/).filter(Boolean);
    return ((words[0]?.charAt(0) ?? "") + (words[1]?.charAt(0) ?? "")).toUpperCase() || "#";
  }
  return participantInitials(directPartner(c, userId));
};

/** Stable avatar colour per id. */
const AVATAR_COLORS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#4f46e5"];
export const avatarColor = (seed?: string | null) => {
  const s = seed ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

/** Preview of a message body: text, or Photo / Vidéo / Document for attachment-only messages. */
export const mediaSummary = (medias?: MessageMedia[] | null) => {
  const list = medias ?? [];
  if (list.length === 0) return "";
  const first = list[0];
  const type = (first.mediaType as string) || mediaTypeFromMime(first.contentType);
  const suffix = list.length > 1 ? ` (${list.length})` : "";
  if (type === "IMAGE") return `${translate("chat.photo")}${suffix}`;
  if (type === "VIDEO") return `${translate("chat.video")}${suffix}`;
  return `${translate("chat.document")}${suffix}`;
};

export const conversationPreview = (c: Conversation, userId?: string) => {
  const m = c.dernierMessage;
  if (!m) return "";
  const prefix =
    m.expediteurId === userId
      ? translate("chat.youPrefix")
      : c.type === "GROUPE" && m.expediteurPrenom
        ? `${m.expediteurPrenom} : `
        : "";
  const body = m.supprime ? translate("chat.deletedMessage") : (m.contenu ?? "").replace(/\s+/g, " ").trim();
  return `${prefix}${body}`;
};

export const sortConversations = (list: Conversation[]) =>
  [...list].sort(
    (a, b) =>
      dateMs(b.lastMessageAt ?? b.dernierMessage?.date ?? b.createdAt) -
      dateMs(a.lastMessageAt ?? a.dernierMessage?.date ?? a.createdAt)
  );

/** Short text for quotes (reply preview / quoted block). */
export const messageExcerpt = (m: ChatMessage) => {
  if (m.supprimePourTous) return translate("chat.deletedMessage");
  const text = (m.contenu ?? "").replace(/\s+/g, " ").trim();
  if (text) return text.length > 100 ? `${text.slice(0, 100)}…` : text;
  return mediaSummary(m.medias) || translate("chat.attachment");
};

export const sameDay = (a?: string | null, b?: string | null) => {
  const da = parseMessageDate(a);
  const db = parseMessageDate(b);
  return !!da && !!db && da.toDateString() === db.toDateString();
};

export const chatDayLabel = (value?: string | null) => {
  const date = parseMessageDate(value);
  if (!date) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return translate("chat.today");
  if (date.toDateString() === yesterday.toDateString()) return translate("chat.yesterday");
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
};

export const chatTime = (value?: string | null) => {
  const date = parseMessageDate(value);
  return date ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
};

/** List time: hour today, "Hier", weekday within a week, else short date. */
export const listTime = (value?: string | null) => {
  const date = parseMessageDate(value);
  if (!date) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return chatTime(value);
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return translate("chat.yesterday");
  if (now.getTime() - date.getTime() < 6 * 86_400_000) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" });
};

/** My message is READ once every other participant's lastReadAt reached it. */
export const isReadByAll = (m: ChatMessage, c: Conversation | null | undefined, userId?: string) => {
  if (!c) return false;
  const others = otherParticipants(c, userId);
  if (others.length === 0) return false;
  const t = dateMs(m.date);
  return others.every((p) => !!p.lastReadAt && dateMs(p.lastReadAt) >= t);
};

/** Merge pages / pushed messages by id, chronological (oldest first). */
export const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map<string, ChatMessage>();
  current.forEach((m) => byId.set(m.id, m));
  incoming.forEach((m) => byId.set(m.id, { ...byId.get(m.id), ...m, pending: false }));
  return Array.from(byId.values()).sort((a, b) => dateMs(a.date) - dateMs(b.date) || a.id.localeCompare(b.id));
};
