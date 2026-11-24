/* Harcourt Kanban: a small shared board for house jobs. */
(() => {
  "use strict";

  const CFG = window.HARCOURT_CONFIG;
  const $ = (id) => document.getElementById(id);
  const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;

  // ---------- Data stores ----------

  // Demo store: cards live in this browser only.
  const LocalStore = {
    key: "harcourt-cards",
    async signedIn() { return true; },
    async list() {
      try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; }
    },
    async save(card) {
      const cards = await this.list();
      const i = cards.findIndex((c) => c.id === card.id);
      if (i >= 0) cards[i] = card; else cards.push(card);
      localStorage.setItem(this.key, JSON.stringify(cards));
    },
    async remove(ids) {
      const cards = (await this.list()).filter((c) => !ids.includes(c.id));
      localStorage.setItem(this.key, JSON.stringify(cards));
    },
    subscribe() {},
    async signOut() {}
  };

  // Shared store: cards live in Supabase, changes stream in live.
  function makeSupabaseStore() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    const cols = "id,title,notes,status,assignee,category,due,repeat,done_at,created_at";
    return {
      async signedIn() {
        const { data } = await sb.auth.getSession();
        return !!data.session;
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async list() {
        const { data, error } = await sb.from("cards").select(cols);
        if (error) throw error;
        return data;
      },
      async save(card) {
        const { error } = await sb.from("cards").upsert(card);
        if (error) throw error;
      },
      async remove(ids) {
        const { error } = await sb.from("cards").delete().in("id", ids);
        if (error) throw error;
      },
      subscribe(onChange) {
        sb.channel("cards")
          .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, onChange)
          .subscribe((status) => setSync(status === "SUBSCRIBED" ? "ok" : "", status));
      },
      async signOut() { await sb.auth.signOut(); }
    };
  }

  const store = DEMO ? LocalStore : makeSupabaseStore();

  // ---------- State ----------

  let cards = [];
  let filter = localGet("harcourt-filter") || "all";
  let activeCol = CFG.COLUMNS[0].id;
  let editing = null;

  function localGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function localSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

  function setSync(state, title) {
    const el = $("sync");
    el.className = "sync " + state;
    el.title = title || state;
  }

  async function refresh() {
    try {
      cards = await store.list();
      setSync("ok", "Up to date");
    } catch (e) {
      setSync("err", "Could not load: " + e.message);
    }
    render();
  }

  // ---------- Helpers ----------

  const today = () => new Date().toISOString().slice(0, 10);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      }));
  const category = (id) => CFG.CATEGORIES.find((c) => c.id === id);

  function friendlyDate(iso) {
    const d = new Date(iso + "T00:00:00");
    const diff = Math.round((d - new Date(today() + "T00:00:00")) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }

  function nextDue(iso, repeat) {
    const d = new Date((iso || today()) + "T00:00:00");
    if (repeat === "weekly") d.setDate(d.getDate() + 7);
    if (repeat === "fortnightly") d.setDate(d.getDate() + 14);
    if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
    if (repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function visible(card) {
    if (filter === "all") return true;
    return card.assignee === filter || card.assignee === "Both";
  }

  function sortCards(list, colId) {
    if (colId === "done") return list.sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
    return list.sort((a, b) =>
      (a.due || "9999").localeCompare(b.due || "9999") ||
      (a.created_at || "").localeCompare(b.created_at || ""));
  }

  // ---------- Rendering ----------

  function renderFilters() {
    const wrap = $("filters");
    wrap.replaceChildren();
    const opts = [["all", "Everyone"], ...CFG.PEOPLE.map((p) => [p, p])];
    for (const [val, label] of opts) {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = label;
      b.setAttribute("aria-pressed", String(filter === val));
      b.onclick = () => { filter = val; localSet("harcourt-filter", val); render(); };
      wrap.append(b);
    }
  }

  function render() {
    renderFilters();
    const tabs = $("tabs");
    const board = $("board");
    tabs.replaceChildren();
    board.replaceChildren();

    CFG.COLUMNS.forEach((col, i) => {
      const list = sortCards(cards.filter((c) => c.status === col.id && visible(c)), col.id);

      const tab = document.createElement("button");
      tab.className = "tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(activeCol === col.id));
      tab.innerHTML = `${col.name} <span class="count">${list.length}</span>`;
      tab.onclick = () => {
        activeCol = col.id;
        board.children[i].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
        updateTabs();
      };
      tabs.append(tab);

      const section = document.createElement("section");
      section.className = "column";
      section.dataset.col = col.id;
      const h = document.createElement("h2");
      h.textContent = `${col.name} (${list.length})`;
      section.append(h);
      if (!list.length) {
        const p = document.createElement("p");
        p.className = "empty";
        p.textContent = col.id === "done" ? "Nothing finished yet." : "Nothing here. Nice.";
        section.append(p);
      }
      list.forEach((c) => section.append(renderCard(c, i)));
      board.append(section);
    });

    // Keep the current column in view after re-render.
    const idx = CFG.COLUMNS.findIndex((c) => c.id === activeCol);
    board.scrollLeft = idx * board.clientWidth;
  }

  function updateTabs() {
    [...$("tabs").children].forEach((t, i) =>
      t.setAttribute("aria-selected", String(CFG.COLUMNS[i].id === activeCol)));
  }

  function renderCard(c, colIndex) {
    const el = document.createElement("article");
    el.className = "card" + (c.status === "done" ? " done" : "");
    const cat = category(c.category);
    if (cat) el.style.setProperty("--cat", cat.colour);

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = c.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    if (c.assignee) {
      const who = document.createElement("span");
      const dot = document.createElement("span");
      dot.className = "who";
      dot.textContent = c.assignee === "Both" ? "★" : c.assignee[0].toUpperCase();
      who.append(dot, " ", c.assignee);
      meta.append(who);
    }
    if (cat) meta.append(Object.assign(document.createElement("span"), { textContent: cat.name }));
    if (c.due && c.status !== "done") {
      const due = document.createElement("span");
      due.textContent = "Due " + friendlyDate(c.due);
      if (c.due < today()) due.className = "overdue";
      meta.append(due);
    }
    if (c.repeat) meta.append(Object.assign(document.createElement("span"), { textContent: "↻ " + c.repeat }));

    const move = document.createElement("button");
    move.className = "move";
    const last = colIndex === CFG.COLUMNS.length - 1;
    move.textContent = last ? "↩" : "→";
    move.setAttribute("aria-label", last ? "Move back to To do" : "Move to " + CFG.COLUMNS[colIndex + 1].name);
    move.onclick = (e) => {
      e.stopPropagation();
      moveTo(c, last ? CFG.COLUMNS[0].id : CFG.COLUMNS[colIndex + 1].id);
    };

    el.append(title, move, meta);
    if (c.notes) {
      const n = document.createElement("div");
      n.className = "notes";
      n.textContent = c.notes;
      el.append(n);
    }
    el.onclick = () => openEditor(c);
    return el;
  }

  // ---------- Actions ----------

  async function persist(card) {
    // Update the screen straight away, then save.
    const i = cards.findIndex((c) => c.id === card.id);
    if (i >= 0) cards[i] = card; else cards.push(card);
    render();
    try {
      await store.save(card);
      setSync("ok", "Saved");
    } catch (e) {
      setSync("err", "Not saved: " + e.message);
      alert("Couldn't save that change. Check your connection and try again.\n\n" + e.message);
      refresh();
    }
  }

  async function moveTo(card, status) {
    const updated = { ...card, status };
    if (status === "done") {
      updated.done_at = new Date().toISOString();
      if (card.repeat) {
        // Make the next one, and stop this one repeating again.
        await persist({
          ...card, id: uuid(), status: CFG.COLUMNS[0].id, done_at: null,
          due: nextDue(card.due, card.repeat), created_at: new Date().toISOString()
        });
        updated.repeat = "";
      }
    } else {
      updated.done_at = null;
    }
    await persist(updated);
  }

  function fillSelect(sel, options) {
    sel.replaceChildren(...options.map(([v, label]) => new Option(label, v)));
  }

  function openEditor(card) {
    editing = card;
    $("editTitle").textContent = card ? "Edit job" : "New job";
    $("fTitle").value = card?.title || "";
    $("fNotes").value = card?.notes || "";
    $("fAssignee").value = card?.assignee || "";
    $("fCategory").value = card?.category || "";
    $("fDue").value = card?.due || "";
    $("fRepeat").value = card?.repeat || "";
    $("fStatus").value = card?.status || activeCol;
    $("deleteBtn").hidden = !card;
    $("editor").showModal();
    if (!card) $("fTitle").focus();
  }

  async function saveEditor() {
    const base = editing || { id: uuid(), created_at: new Date().toISOString(), done_at: null };
    const status = $("fStatus").value;
    const card = {
      ...base,
      title: $("fTitle").value.trim(),
      notes: $("fNotes").value.trim(),
      assignee: $("fAssignee").value,
      category: $("fCategory").value,
      due: $("fDue").value || null,
      repeat: $("fRepeat").value
    };
    if (!card.title) return;
    if (editing && editing.status !== status) {
      card.status = editing.status;
      await moveTo(card, status);
    } else {
      card.status = status;
      if (status === "done" && !card.done_at) card.done_at = new Date().toISOString();
      await persist(card);
    }
  }

  async function removeCards(ids) {
    cards = cards.filter((c) => !ids.includes(c.id));
    render();
    try { await store.remove(ids); setSync("ok", "Saved"); }
    catch (e) { setSync("err", e.message); refresh(); }
  }

  // ---------- Wiring ----------

  function wire() {
    fillSelect($("fAssignee"), [["", "Anyone"], ...CFG.PEOPLE.map((p) => [p, p]), ["Both", "Both of us"]]);
    fillSelect($("fCategory"), [["", "None"], ...CFG.CATEGORIES.map((c) => [c.id, c.name])]);
    fillSelect($("fStatus"), CFG.COLUMNS.map((c) => [c.id, c.name]));

    $("addBtn").onclick = () => openEditor(null);
    $("cancelBtn").onclick = () => $("editor").close();
    $("editForm").onsubmit = (e) => { e.preventDefault(); $("editor").close(); saveEditor(); };
    $("deleteBtn").onclick = () => {
      if (editing && confirm(`Delete "${editing.title}"?`)) { $("editor").close(); removeCards([editing.id]); }
    };

    $("menuBtn").onclick = () => $("menu").showModal();
    $("closeMenuBtn").onclick = () => $("menu").close();
    $("clearDoneBtn").onclick = () => {
      const done = cards.filter((c) => c.status === "done").map((c) => c.id);
      $("menu").close();
      if (done.length && confirm(`Remove ${done.length} finished job(s)?`)) removeCards(done);
    };
    $("signOutBtn").hidden = DEMO;
    $("signOutBtn").onclick = async () => { await store.signOut(); location.reload(); };

    // Swiping between columns updates the tabs.
    const board = $("board");
    board.addEventListener("scroll", () => {
      const i = Math.round(board.scrollLeft / Math.max(board.clientWidth, 1));
      if (CFG.COLUMNS[i] && CFG.COLUMNS[i].id !== activeCol) { activeCol = CFG.COLUMNS[i].id; updateTabs(); }
    }, { passive: true });

    // Catch up when the app comes back to the foreground.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

    $("loginForm").onsubmit = async (e) => {
      e.preventDefault();
      $("loginError").textContent = "";
      try {
        await store.signIn($("loginEmail").value.trim(), $("loginPassword").value);
        start();
      } catch (err) {
        $("loginError").textContent = "Sign-in failed: " + err.message;
      }
    };
  }

  async function start() {
    $("login").hidden = true;
    $("app").hidden = false;
    $("addBtn").hidden = false;
    await refresh();
    store.subscribe(() => refresh());
  }

  async function boot() {
    wire();
    $("demoBanner").hidden = !DEMO;
    if (await store.signedIn()) start();
    else { $("login").hidden = false; setSync("", "Signed out"); }
  }

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  boot();
})();
