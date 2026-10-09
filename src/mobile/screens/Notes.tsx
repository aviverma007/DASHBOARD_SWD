import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, Empty, SearchBar, Sheet, useToast } from "../ui";

interface Note { id: string; title: string; body: string; updatedAt: number }

// Same key/format as src/features/workspace/NotesPage.tsx
const STORAGE_KEY = "swd_notes_v1";

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch { return []; }
}
function fmtWhen(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
const FIELD: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1.5px solid var(--m-line)", borderRadius: 14,
  padding: "12px 14px", fontSize: 16, fontFamily: "inherit", color: "var(--m-ink)", background: "#f7f8fb",
};

export default function Notes() {
  const toast = useToast();
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null); // "new" = composer
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch { /* ignore */ }
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? notes.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) : notes;
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query]);

  const close = () => { setEditingId(null); setConfirmDel(false); };
  const startNew = () => { setEditingId("new"); setTitle(""); setBody(""); setConfirmDel(false); };
  const startEdit = (n: Note) => { setEditingId(n.id); setTitle(n.title); setBody(n.body); setConfirmDel(false); };

  function save() {
    const t = title.trim() || "Untitled note";
    const b = body.trim();
    if (editingId === "new") setNotes(p => [{ id: crypto.randomUUID(), title: t, body: b, updatedAt: Date.now() }, ...p]);
    else if (editingId) setNotes(p => p.map(n => (n.id === editingId ? { ...n, title: t, body: b, updatedAt: Date.now() } : n)));
    toast("Note saved");
    close();
  }
  function remove() {
    setNotes(p => p.filter(n => n.id !== editingId));
    toast("Note deleted");
    close();
  }

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Notes</h1><p className="m-sub">Personal scratchpad, saved in this browser</p></div>
      <SearchBar value={query} onChange={setQuery} placeholder="Search notes" />
      {filtered.length === 0 ? (
        <Empty title={notes.length ? "No notes match" : "No notes yet"} sub={notes.length ? undefined : "Tap New note to write your first one."} />
      ) : filtered.map(n => (
        <Card key={n.id} onClick={() => startEdit(n)}>
          <b style={{ fontSize: 15, display: "block", overflowWrap: "anywhere" }}>{n.title}</b>
          {n.body && <div style={{ fontSize: 13.5, color: "var(--m-mut)", marginTop: 4, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textAlign: "left" }}>{n.body}</div>}
          <small className="m-sub" style={{ display: "block", marginTop: 6, textAlign: "left" }}>{fmtWhen(n.updatedAt)}</small>
        </Card>
      ))}
      <div style={{ height: 56 }} />
      <button type="button" className="m-btn pri" onClick={startNew}
        style={{ position: "fixed", left: 16, bottom: "calc(var(--m-bot) + 14px)", zIndex: 30, width: "auto", padding: "0 20px", gap: 6, display: "inline-flex", alignItems: "center", boxShadow: "0 8px 22px rgba(10,18,40,.3)" }}>
        <Plus size={18} /> New note
      </button>

      <Sheet open={editingId !== null} onClose={close} title={editingId === "new" ? "New note" : "Edit note"}
        footer={
          <div style={{ display: "flex", gap: 10 }}>
            {editingId !== "new" && (confirmDel
              ? <button type="button" className="m-btn" style={{ color: "var(--m-bad)" }} onClick={remove}>Confirm delete</button>
              : <button type="button" className="m-btn" aria-label="Delete note" onClick={() => setConfirmDel(true)}><Trash2 size={18} /></button>)}
            <button type="button" className="m-btn pri" style={{ flex: 1 }} onClick={save}>Save</button>
          </div>
        }>
        <div className="m-field"><span className="m-label">Title</span>
          <input style={FIELD} value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" /></div>
        <div className="m-field"><span className="m-label">Note</span>
          <textarea style={{ ...FIELD, minHeight: 180, resize: "vertical" }} value={body} onChange={e => setBody(e.target.value)} placeholder="Write something…" /></div>
        {confirmDel && <p className="m-sub">Delete this note? This can't be undone.</p>}
      </Sheet>
    </div>
  );
}
