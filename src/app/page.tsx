"use client";

import { useEffect, useState, useCallback } from "react";
import {
  useEditor,
  EditorContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Share2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  LogOut,
  Upload,
  Save,
  Loader2,
  Users,
} from "lucide-react";

type User = {
  id: string;
  email: string;
  name: string | null;
};

type Share = {
  userId: string;
  role: "EDITOR" | "VIEWER";
  user: User;
};

type DocumentItem = {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  owner?: User;
  shares?: Share[];
  updatedAt: string;
};

const accounts = [
  { email: "shashi@example.com", name: "Shashi" },
  { email: "alex@example.com", name: "Alex" },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeId, setActiveId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [message, setMessage] = useState("");

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: "",
    immediatelyRender: false,
    editable: true,
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
      setDirty(true);
    },
  });

  const activeDocument = documents.find((d) => d.id === activeId);

  // Check ownership using the document and owner relation.
  // The email fallback also handles documents returned without a complete ownerId mapping.
  const isOwner = Boolean(
    user &&
      activeDocument &&
      (
        activeDocument.ownerId === user.id ||
        activeDocument.owner?.id === user.id ||
        activeDocument.owner?.email?.toLowerCase() === user.email.toLowerCase()
      )
  );

  const currentShare = activeDocument?.shares?.find(
    (share) => share.userId === user?.id
  );

  const canEdit = Boolean(
    isOwner || currentShare?.role === "EDITOR"
  );

  const loadDocuments = useCallback(async (selectFirst = false) => {
    try {
      const response = await fetch("/api/documents");
      if (!response.ok) throw new Error("Unable to load documents");

      const data = await response.json();
      const items: DocumentItem[] = data.documents || [];

      setDocuments(items);

      if (selectFirst && items.length > 0) {
        setActiveId(items[0].id);
        setTitle(items[0].title);
        setContent(items[0].content || "");
        setDirty(false);
      }

      if (items.length === 0) {
        setActiveId("");
        setTitle("");
        setContent("");
        setDirty(false);
      }
    } catch {
      setMessage("Unable to load documents.");
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        const response = await fetch("/api/session");
        const data = await response.json();

        if (data.user) {
          setUser(data.user);

          const docsResponse = await fetch("/api/documents");

          if (docsResponse.ok) {
            const docsData = await docsResponse.json();
            const items = docsData.documents || [];

            setDocuments(items);

            if (items.length > 0) {
              setActiveId(items[0].id);
              setTitle(items[0].title);
              setContent(items[0].content || "");
            }
          }
        }
      } catch {
        setMessage("Unable to connect to the server.");
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  useEffect(() => {
    if (!editor) return;

    editor.commands.setContent(content || "", {
      emitUpdate: false,
    });
  }, [editor, activeId]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(canEdit);
  }, [editor, canEdit, activeId]);

  useEffect(() => {
    if (!dirty || !activeId) return;

    const timer = setTimeout(async () => {
      setSaving(true);

      try {
        const response = await fetch(`/api/documents/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content }),
        });

        if (!response.ok) throw new Error("Save failed");

        setDirty(false);

        setDocuments((previous) =>
          previous.map((doc) =>
            doc.id === activeId
              ? { ...doc, title, content }
              : doc
          )
        );
      } catch {
        setMessage("Unable to save changes. Please try again.");
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [dirty, title, content, activeId]);

  async function login(email: string) {
    setLoading(true);

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setUser(data.user);
      setDocuments([]);
      setActiveId("");
      setTitle("");
      setContent("");
      setDirty(false);

      const docsResponse = await fetch("/api/documents");

      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        const items = docsData.documents || [];

        setDocuments(items);

        if (items.length > 0) {
          setActiveId(items[0].id);
          setTitle(items[0].title);
          setContent(items[0].content || "");
        }
      }
    } catch {
      setMessage("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function createDocument() {
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled Document",
          content: "<p>Start writing your document...</p>",
        }),
      });

      if (!response.ok) throw new Error("Create failed");

      const data = await response.json();
      const doc: DocumentItem = {
        ...data.document,
        owner: data.document.owner ?? user ?? undefined,
        shares: data.document.shares ?? [],
      };

      setDocuments((previous) => [doc, ...previous]);
      setActiveId(doc.id);
      setTitle(doc.title);
      setContent(doc.content);
      setDirty(false);
    } catch {
      setMessage("Unable to create document.");
    }
  }

  function openDocument(doc: DocumentItem) {
    setActiveId(doc.id);
    setTitle(doc.title);
    setContent(doc.content || "");
    setDirty(false);
    setMessage("");
  }

  async function deleteDocument(id: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete failed");

      const remaining = documents.filter((d) => d.id !== id);
      setDocuments(remaining);

      if (activeId === id) {
        if (remaining.length > 0) {
          openDocument(remaining[0]);
        } else {
          setActiveId("");
          setTitle("");
          setContent("");
        }
      }
    } catch {
      setMessage("Unable to delete document.");
    }
  }

  async function shareDocument() {
    if (!activeId || !shareEmail.trim()) return;

    try {
      const response = await fetch(
        `/api/documents/${activeId}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: shareEmail,
            role: shareRole,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sharing failed");
      }

      setShareOpen(false);
      setShareEmail("");
      setMessage("Document shared successfully.");

      await loadDocuments();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sharing failed."
      );
    }
  }

  async function uploadFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    if (!/\.(txt|md)$/i.test(file.name)) {
      setMessage("Only TXT and Markdown files are supported.");
      event.target.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      setMessage("File must be smaller than 1 MB.");
      event.target.value = "";
      return;
    }

    const text = await file.text();

    const html = text
      .split(/\r?\n/)
      .map((line) => {
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        if (line.startsWith("# ")) {
          return `<h1>${escaped.slice(2)}</h1>`;
        }

        if (line.startsWith("## ")) {
          return `<h2>${escaped.slice(3)}</h2>`;
        }

        return `<p>${escaped || "<br>"}</p>`;
      })
      .join("");

    editor.commands.setContent(html, { emitUpdate: true });
    setMessage(`${file.name} imported successfully.`);
    event.target.value = "";
  }

  const visibleDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title
      .toLowerCase()
      .includes(search.toLowerCase());

    if (tab === "mine") {
      return doc.ownerId === user?.id && matchesSearch;
    }

    if (tab === "shared") {
      return doc.ownerId !== user?.id && matchesSearch;
    }

    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-600 text-white p-3 rounded-xl">
              <FileText size={26} />
            </div>
            <h1 className="text-2xl font-bold">CollabSpace</h1>
          </div>

          <h2 className="text-xl font-semibold mb-2">
            Welcome back
          </h2>

          <p className="text-slate-500 mb-6">
            Choose a demo account to continue.
          </p>

          <div className="space-y-3">
            {accounts.map((account) => (
              <button
                key={account.email}
                onClick={() => login(account.email)}
                className="w-full border rounded-xl p-4 text-left hover:border-blue-500 hover:bg-blue-50 transition"
              >
                <div className="font-semibold">{account.name}</div>
                <div className="text-sm text-slate-500">
                  {account.email}
                </div>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400 mt-6">
            Demo authentication for assessment purposes.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="h-16 bg-white border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <FileText size={21} />
          </div>
          <h1 className="font-bold text-xl">CollabSpace</h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {user.name || user.email}
          </span>

          <select
            value={user.email}
            onChange={(e) => login(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {accounts.map((account) => (
              <option key={account.email} value={account.email}>
                Switch to {account.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              document.cookie = "collabspace_user=; Max-Age=0; path=/";
              setUser(null);
              setDocuments([]);
              setActiveId("");
            }}
            title="Sign out"
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-72 bg-white border-r flex flex-col">
          <div className="p-5">
            <button
              onClick={createDocument}
              className="w-full bg-blue-600 text-white rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-blue-700"
            >
              <Plus size={19} />
              New Document
            </button>
          </div>

          <div className="px-4 pb-4">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-3 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents"
                className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <nav className="px-3 space-y-1">
            {[
              ["all", "All documents"],
              ["mine", "My documents"],
              ["shared", "Shared with me"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  tab === value
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-6 px-4 flex-1 overflow-y-auto">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">
              Documents
            </p>

            {visibleDocuments.map((doc) => (
              <div
                key={doc.id}
                className={`group flex items-center gap-2 rounded-lg mb-1 ${
                  activeId === doc.id
                    ? "bg-blue-50"
                    : "hover:bg-slate-100"
                }`}
              >
                <button
                  onClick={() => openDocument(doc)}
                  className="flex-1 min-w-0 text-left px-3 py-3"
                >
                  <div className="flex items-center gap-2">
                    <FileText
                      size={16}
                      className="text-blue-600 shrink-0"
                    />
                    <span className="text-sm truncate">
                      {doc.title}
                    </span>
                  </div>
                  {doc.ownerId !== user.id && (
                    <span className="text-xs text-slate-400 ml-6">
                      Shared by {doc.owner?.name || doc.owner?.email}
                    </span>
                  )}
                </button>

                {doc.ownerId === user.id && (
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    title="Delete document"
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}

            {visibleDocuments.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No documents found.
              </p>
            )}
          </div>

          <div className="border-t p-4 text-xs text-slate-400">
            {documents.length} documents
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          {activeDocument ? (
            <>
              <div className="bg-white border-b px-8 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setDirty(true);
                    }}
                    disabled={!canEdit}
                    className="text-xl font-semibold bg-transparent outline-none w-full disabled:text-slate-600"
                    placeholder="Untitled Document"
                  />

                  <p className="text-xs text-slate-400 mt-1">
                    {canEdit ? "Editing enabled" : "View only"} ·{" "}
                    {isOwner ? "Owner" : currentShare?.role}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {saving ? (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <Loader2 size={14} className="animate-spin" />
                      Saving
                    </span>
                  ) : (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Save size={14} />
                      Saved
                    </span>
                  )}

                  {isOwner && (
                    <button
                      onClick={() => setShareOpen(true)}
                      className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-2 hover:bg-blue-700"
                    >
                      <Share2 size={16} />
                      Share
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white border-b px-8 py-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  disabled={!canEdit}
                  className={`toolbar-button ${editor?.isActive("bold") ? "active" : ""}`}
                  title="Bold"
                >
                  <Bold size={17} />
                </button>

                <button
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  disabled={!canEdit}
                  className={`toolbar-button ${editor?.isActive("italic") ? "active" : ""}`}
                  title="Italic"
                >
                  <Italic size={17} />
                </button>

                <button
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  disabled={!canEdit}
                  className={`toolbar-button ${editor?.isActive("underline") ? "active" : ""}`}
                  title="Underline"
                >
                  <UnderlineIcon size={17} />
                </button>

                <div className="w-px h-6 bg-slate-200 mx-1" />

                <button
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                  disabled={!canEdit}
                  className="toolbar-button"
                  title="Heading 1"
                >
                  <Heading1 size={18} />
                </button>

                <button
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  disabled={!canEdit}
                  className="toolbar-button"
                  title="Heading 2"
                >
                  <Heading2 size={18} />
                </button>

                <button
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  disabled={!canEdit}
                  className="toolbar-button"
                  title="Bullet list"
                >
                  <List size={18} />
                </button>

                <button
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  disabled={!canEdit}
                  className="toolbar-button"
                  title="Numbered list"
                >
                  <ListOrdered size={18} />
                </button>

                <div className="w-px h-6 bg-slate-200 mx-1" />

                <label className={`toolbar-button cursor-pointer ${!canEdit ? "opacity-40 pointer-events-none" : ""}`}>
                  <Upload size={17} />
                  <span className="text-xs">Import TXT/MD</span>
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={uploadFile}
                    className="hidden"
                    disabled={!canEdit}
                  />
                </label>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto bg-white min-h-full shadow-sm rounded-xl p-12">
                  <EditorContent
                    editor={editor}
                    className="document-editor"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="bg-blue-50 text-blue-600 p-5 rounded-2xl mb-5">
                <FileText size={42} />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                Welcome to CollabSpace
              </h2>
              <p className="text-slate-500 mb-6">
                Create your first document to get started.
              </p>
              <button
                onClick={createDocument}
                className="bg-blue-600 text-white px-5 py-3 rounded-lg flex items-center gap-2"
              >
                <Plus size={18} />
                Create document
              </button>
            </div>
          )}

          {message && (
            <div className="fixed bottom-5 right-5 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm">
              {message}
              <button
                onClick={() => setMessage("")}
                className="ml-4 text-slate-300"
              >
                ✕
              </button>
            </div>
          )}
        </main>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <Users size={22} className="text-blue-600" />
              <h2 className="text-xl font-bold">Share document</h2>
            </div>

            <p className="text-sm text-slate-500 mb-6">
              Invite someone to access this document.
            </p>

            <label className="block text-sm font-medium mb-2">
              Email address
            </label>

            <input
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full border rounded-lg px-4 py-3 mb-5 outline-none focus:border-blue-500"
            />

            <label className="block text-sm font-medium mb-2">
              Permission
            </label>

            <select
              value={shareRole}
              onChange={(e) =>
                setShareRole(e.target.value as "EDITOR" | "VIEWER")
              }
              className="w-full border rounded-lg px-4 py-3 mb-6 bg-white"
            >
              <option value="EDITOR">Editor — can edit</option>
              <option value="VIEWER">Viewer — read only</option>
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShareOpen(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={shareDocument}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}