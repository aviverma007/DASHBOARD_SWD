import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, X, Check } from "lucide-react";
import "../../components/inventory/smartworldInventory.css";

interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number; // epoch ms
}

const STORAGE_KEY = "swd_notes_v1";

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

function fmtWhen(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const INPUT: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13.5,
  fontFamily: "inherit",
  color: "var(--ink)",
  background: "#fff",
};

/** Personal scratchpad — notes persist in this browser (localStorage);
 * they are not synced to a server or shared with other users. */
export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null); // "new" = composer
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? notes.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      : notes;
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query]);

  function startNew() {
    setEditingId("new");
    setDraftTitle("");
    setDraftBody("");
  }

  function startEdit(n: Note) {
    setEditingId(n.id);
    setDraftTitle(n.title);
    setDraftBody(n.body);
  }

  function saveDraft() {
    const title = draftTitle.trim() || "Untitled note";
    const body = draftBody.trim();
    if (editingId === "new") {
      setNotes(prev => [{ id: crypto.randomUUID(), title, body, updatedAt: Date.now() }, ...prev]);
    } else if (editingId) {
      setNotes(prev => prev.map(n => (n.id === editingId ? { ...n, title, body, updatedAt: Date.now() } : n)));
    }
    setEditingId(null);
  }

  function remove(id: string) {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    setNotes(prev => prev.filter(n => n.id !== id));
    if (editingId === id) setEditingId(null);
  }

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 20px 40px" }}>
        {/* Header row: title · search · new */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>Notes</div>
            <div style={{ fontSize: 12, color: "var(--mut)" }}>Saved in this browser only</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative", minWidth: 240 }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--mut)" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search notes…"
              style={{ ...INPUT, paddingLeft: 34 }}
            />
          </div>
          <button
            onClick={startNew}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "var(--gold)", color: "#fff", border: "none", borderRadius: 8,
              padding: "10px 16px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
            }}
          >
            <Plus size={16} /> New note
          </button>
        </div>

        {/* Composer / editor */}
        {editingId !== null && (
          <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--gold)" }}>
            <input
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              placeholder="Title"
              autoFocus
              style={{ ...INPUT, fontWeight: 700, fontSize: 15, marginBottom: 8 }}
            />
            <textarea
              value={draftBody}
              onChange={e => setDraftBody(e.target.value)}
              placeholder="Write your note…"
              rows={5}
              style={{ ...INPUT, resize: "vertical", lineHeight: 1.55 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditingId(null)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", color: "var(--mut)" }}
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={saveDraft}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
              >
                <Check size={14} /> Save
              </button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "34px 20px", color: "var(--mut)", fontSize: 13.5 }}>
            {notes.length === 0 ? "No notes yet — click “New note” to write your first one." : "No notes match your search."}
          </div>
        ) : (
          filtered.map(n => (
            <div key={n.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>Updated {fmtWhen(n.updatedAt)}</div>
                </div>
                <button onClick={() => startEdit(n)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mut)", padding: 6 }}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => remove(n.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "#b3362c", padding: 6 }}>
                  <Trash2 size={15} />
                </button>
              </div>
              {n.body && (
                <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{n.body}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
