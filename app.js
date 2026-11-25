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
    async saveMany(list) {
      for (const c of list) await this.save(c);
    },
    async remove(ids) {
      const cards = (await this.list()).filter((c) => !ids.includes(c.id));
      localStorage.setItem(this.key, JSON.stringify(cards));
    },
    subscribe() {},
    async signOut() {},
    // Demo photos are kept small and stored inside the card itself.
    photoMax: 800,
    async uploadPhoto(cardId, blob) {
      return await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(blob);
      });
    },
    async photoUrls(paths) { return Object.fromEntries(paths.map((p) => [p, p])); },
    async removePhotos() {}
  };

  // Shared store: cards live in Supabase, changes stream in live.
  function makeSupabaseStore() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
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
        const { data, error } = await sb.from("cards").select("*");
        if (error) throw error;
        return data;
      },
      async save(card) {
        const { error } = await sb.from("cards").upsert(card);
        if (error) throw error;
      },
      async saveMany(list) {
        const { error } = await sb.from("cards").upsert(list);
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
      async signOut() { await sb.auth.signOut(); },
      // Photos live in a private Supabase Storage bucket called "photos".
      photoMax: 1600,
      async uploadPhoto(cardId, blob) {
        const path = `${cardId}/${uuid()}.jpg`;
        const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        return path;
      },
      async photoUrls(paths) {
        const { data, error } = await sb.storage.from("photos").createSignedUrls(paths, 3600);
        if (error) throw error;
        const out = {};
        for (const d of data) if (d.signedUrl) out[d.path] = d.signedUrl;
        return out;
      },
      async removePhotos(paths) {
        if (paths.length) await sb.storage.from("photos").remove(paths);
      }
    };
  }

  const store = DEMO ? LocalStore : makeSupabaseStore();

  // ---------- State ----------

  let cards = [];
  const ASSIGNING = CFG.PEOPLE.length > 0;
  let filter = ASSIGNING ? (localGet("harcourt-filter") || "all") : "all";
  let sizeFilter = localGet("harcourt-size") || "any";
  // "week" = This week, "all" = All rooms, otherwise a room name.
  let room = localGet("harcourt-room") || "week";
  if (room !== "all" && room !== "week" && !CFG.ROOMS.includes(room)) room = "week";

  const SIZES = [
    { id: "quick", name: "Quick", long: "Quick (15 min or less)" },
    { id: "hour",  name: "About an hour", long: "About an hour" },
    { id: "big",   name: "Big job", long: "Big job (half a day or more)" }
  ];
  const REPEATS = {
    weekly: "weekly", fortnightly: "fortnightly", monthly: "monthly",
    quarterly: "every 3 months", "6-monthly": "every 6 months", yearly: "yearly"
  };
  const WEEK_DAYS = 7;
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

  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => isoDate(new Date());
  const daysFromToday = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      }));
  const category = (id) => CFG.CATEGORIES.find((c) => c.id === id);
  const roomColour = (r) => (CFG.ROOM_COLOURS || {})[r] || CFG.WHOLE_HOUSE_COLOUR || "#1e293b";

  function friendlyDate(iso) {
    const d = new Date(iso + "T00:00:00");
    const diff = Math.round((d - new Date(today() + "T00:00:00")) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    const opts = { weekday: "short", day: "numeric", month: "short" };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("en-GB", opts);
  }

  function nextDue(iso, repeat) {
    const d = new Date((iso || today()) + "T00:00:00");
    if (repeat === "weekly") d.setDate(d.getDate() + 7);
    if (repeat === "fortnightly") d.setDate(d.getDate() + 14);
    if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
    if (repeat === "quarterly") d.setMonth(d.getMonth() + 3);
    if (repeat === "6-monthly") d.setMonth(d.getMonth() + 6);
    if (repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
    return isoDate(d);
  }

  // Next time a given month/day comes round (today counts).
  function nextOccurrence(month, day) {
    const now = new Date();
    let d = new Date(now.getFullYear(), month - 1, day);
    if (isoDate(d) < today()) d = new Date(now.getFullYear() + 1, month - 1, day);
    return isoDate(d);
  }

  // Is this job part of "This week"?
  function inWeek(card) {
    if (card.status === "done") {
      return !!card.done_at && card.done_at >= new Date(Date.now() - WEEK_DAYS * 86400000).toISOString();
    }
    if (card.status === "doing") return true;
    return !!card.due && card.due <= daysFromToday(WEEK_DAYS);
  }

  function inRoom(card, r = room) {
    if (r === "week") return inWeek(card);
    return r === "all" || card.room === r;
  }

  function visible(card) {
    if (!inRoom(card)) return false;
    if (sizeFilter !== "any" && card.size !== sizeFilter) return false;
    if (filter === "all") return true;
    return card.assignee === filter || card.assignee === "Both";
  }

  const roomTitle = (r) => r === "week" ? "This week" : r === "all" ? "All rooms" : r;

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
    const opts = ASSIGNING ? [["all", "Everyone"], ...CFG.PEOPLE.map((p) => [p, p])] : [];
    for (const [val, label] of opts) {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = label;
      b.setAttribute("aria-pressed", String(filter === val));
      b.onclick = () => { filter = val; localSet("harcourt-filter", val); render(); };
      wrap.append(b);
    }
    if (ASSIGNING) wrap.append(Object.assign(document.createElement("span"), { className: "chip-divider" }));
    for (const [val, label] of [["any", "Any length"], ...SIZES.map((z) => [z.id, z.name])]) {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = label;
      b.setAttribute("aria-pressed", String(sizeFilter === val));
      b.onclick = () => { sizeFilter = val; localSet("harcourt-size", val); render(); };
      wrap.append(b);
    }
  }

  function renderRooms() {
    $("roomName").textContent = roomTitle(room);
    $("roomBtn").style.setProperty("--room", CFG.ROOMS.includes(room) ? roomColour(room) : "");
    const here = cards.filter((c) => c.status !== "done" && inRoom(c));
    const lateHere = here.filter((c) => c.due && c.due < today()).length;
    const todayHere = here.filter((c) => c.due === today()).length;
    const stats = $("roomStats");
    stats.replaceChildren();
    const pill = (text, cls) => Object.assign(document.createElement("span"), { className: "pill " + (cls || ""), textContent: text });
    if (lateHere) stats.append(pill(`${lateHere} late`, "late"));
    if (todayHere) stats.append(pill(`${todayHere} today`, "today"));
    stats.append(pill(`${here.length} to do`));
    const open = (r) => cards.filter((c) => c.status !== "done" && inRoom(c, r)).length;
    const overdue = cards.filter((c) => c.status !== "done" && c.due && c.due < today()).length;
    const grid = $("roomGrid");
    grid.replaceChildren();
    for (const r of ["week", "all", ...CFG.ROOMS]) {
      const b = document.createElement("button");
      if (r === "all" || r === "week") b.className = r;
      else { b.classList.add("swatch"); b.style.setProperty("--room", roomColour(r)); }
      b.setAttribute("aria-current", String(r === room));
      const name = document.createElement("span");
      name.textContent = roomTitle(r);
      const n = document.createElement("span");
      n.className = "n";
      const count = open(r);
      n.textContent = count ? count + " to do" : "";
      if (r === "week" && overdue) { n.textContent += ` · ${overdue} overdue`; n.classList.add("alert"); }
      b.append(name, n);
      b.onclick = () => {
        room = r; localSet("harcourt-room", r);
        activeCol = CFG.COLUMNS[0].id;
        $("rooms").close(); render();
      };
      grid.append(b);
    }
  }

  function render() {
    renderRooms();
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
      h.append(col.name, Object.assign(document.createElement("span"), { className: "count", textContent: list.length }));
      section.append(h);
      if (!list.length) {
        const p = document.createElement("p");
        p.className = "empty";
        p.textContent = col.id === "done" ? (room === "week" ? "Nothing finished this week yet." : "Nothing finished yet.")
          : room === "week" ? "Nothing due this week. Enjoy it."
          : room === "all" ? "Nothing here. Nice." : `Nothing to do in the ${room.toLowerCase()}. Nice.`;
        section.append(p);
      }
      list.forEach((c) => section.append(renderCard(c, i)));
      board.append(section);
    });

    loadPhotos(board);

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
    el.style.setProperty("--cat", roomColour(c.room));

    // Coloured strip in the room's colour: room name, plus the job type.
    const strip = document.createElement("div");
    strip.className = "strip";
    strip.append(c.room || "Whole house");
    if (cat) strip.append(Object.assign(document.createElement("span"), { className: "room", textContent: cat.name }));

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = c.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    if (ASSIGNING && c.assignee) {
      const who = document.createElement("span");
      const dot = document.createElement("span");
      dot.className = "who";
      dot.textContent = c.assignee === "Both" ? "★" : c.assignee[0].toUpperCase();
      who.append(dot, " ", c.assignee);
      meta.append(who);
    }
    if (c.due && c.status !== "done") {
      const due = document.createElement("span");
      const t = today();
      if (c.due < t) {
        const days = Math.round((new Date(t + "T00:00:00") - new Date(c.due + "T00:00:00")) / 86400000);
        due.className = "pill late";
        due.textContent = `Late · ${days} day${days === 1 ? "" : "s"}`;
      } else if (c.due === t) {
        due.className = "pill today";
        due.textContent = "Today";
      } else {
        due.textContent = "Due " + friendlyDate(c.due);
      }
      meta.append(due);
    }
    const size = SIZES.find((z) => z.id === c.size);
    if (size) meta.append(Object.assign(document.createElement("span"), { textContent: "⏱ " + size.name }));
    if (c.repeat) meta.append(Object.assign(document.createElement("span"), { textContent: "↻ " + (REPEATS[c.repeat] || c.repeat) }));

    const move = document.createElement("button");
    move.className = "move";
    const last = colIndex === CFG.COLUMNS.length - 1;
    const finishing = CFG.COLUMNS[colIndex + 1]?.id === "done";
    move.textContent = last ? "↩" : finishing ? "✓" : "→";
    if (last) move.classList.add("back");
    else if (finishing) move.classList.add("finish");
    move.setAttribute("aria-label", last ? "Move back to To do" : "Move to " + CFG.COLUMNS[colIndex + 1].name);
    move.onclick = (e) => {
      e.stopPropagation();
      moveTo(c, last ? CFG.COLUMNS[0].id : CFG.COLUMNS[colIndex + 1].id);
    };

    el.append(strip, title, move, meta);
    if (!meta.childElementCount) meta.remove();
    const steps = Array.isArray(c.checklist) ? c.checklist : [];
    if (steps.length) {
      const doneSteps = steps.filter((s) => s.done).length;
      const prog = document.createElement("div");
      prog.className = "progress";
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("span");
      fill.style.width = Math.round((doneSteps / steps.length) * 100) + "%";
      bar.append(fill);
      const line = document.createElement("div");
      line.className = "next";
      const nextStep = steps.find((s) => !s.done);
      line.append(`☑ ${doneSteps}/${steps.length}`);
      if (nextStep && c.status !== "done") {
        const b = document.createElement("b");
        b.textContent = nextStep.text;
        line.append(" · Next: ", b);
      }
      prog.append(bar, line);
      el.append(prog);
    }
    const photos = Array.isArray(c.photos) ? c.photos : [];
    if (photos.length) {
      const row = document.createElement("div");
      row.className = "thumbs";
      photos.slice(0, 3).forEach((path, i) => {
        const box = document.createElement("span");
        const img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.dataset.path = path;
        box.append(img);
        if (i === 2 && photos.length > 3) {
          box.append(Object.assign(document.createElement("span"), { className: "more", textContent: "+" + (photos.length - 3) }));
        }
        row.append(box);
      });
      el.append(row);
    }
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
          checklist: (card.checklist || []).map((s) => ({ ...s, done: false })),
          photos: [],
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
    draftSteps = (card?.checklist || []).map((s) => ({ ...s }));
    edit = { id: card?.id || uuid(), photos: [...(card?.photos || [])], uploaded: [], pending: [], uploading: 0, saved: false };
    setPhotoStatus("");
    renderPhotos();
    $("newStep").value = "";
    renderSteps();
    $("fAssignee").value = card?.assignee || "";
    $("fCategory").value = card?.category || "";
    $("fRoom").value = card ? (card.room || "") : (CFG.ROOMS.includes(room) ? room : "");
    $("fSize").value = card ? (card.size || "") : (sizeFilter === "any" ? "" : sizeFilter);
    // New jobs added from "This week" are due today, so they show up there.
    $("fDue").value = card ? (card.due || "") : (room === "week" ? today() : "");
    $("fRepeat").value = card?.repeat || "";
    $("fStatus").value = card?.status || activeCol;
    $("deleteBtn").hidden = !card;
    $("editor").showModal();
    if (!card) $("fTitle").focus();
  }

  // ---------- Checklist (inside the editor) ----------

  let draftSteps = [];

  function renderSteps() {
    const ul = $("checklist");
    ul.replaceChildren();
    draftSteps.forEach((step, i) => {
      const li = document.createElement("li");
      if (step.done) li.className = "ticked";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!step.done;
      cb.setAttribute("aria-label", "Done");
      cb.onchange = () => { step.done = cb.checked; li.className = cb.checked ? "ticked" : ""; updateStepCount(); };
      const txt = document.createElement("input");
      txt.type = "text";
      txt.value = step.text;
      txt.maxLength = 120;
      txt.oninput = () => { step.text = txt.value; };
      txt.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); $("newStep").focus(); } };
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "remove";
      rm.textContent = "×";
      rm.setAttribute("aria-label", "Remove step");
      rm.onclick = () => { draftSteps.splice(i, 1); renderSteps(); };
      li.append(cb, txt, rm);
      ul.append(li);
    });
    updateStepCount();
  }

  function updateStepCount() {
    const n = draftSteps.length;
    $("checkCount").textContent = n ? `${draftSteps.filter((s) => s.done).length}/${n}` : "";
  }

  function addStep() {
    const text = $("newStep").value.trim();
    if (!text) return;
    draftSteps.push({ text, done: false });
    $("newStep").value = "";
    renderSteps();
    $("newStep").focus();
  }

  function collectSteps() {
    // Add anything typed but not yet added, and drop empty steps.
    if ($("newStep").value.trim()) addStep();
    return draftSteps.map((s) => ({ text: s.text.trim(), done: !!s.done })).filter((s) => s.text);
  }

  async function saveEditor() {
    const sess = edit;
    const base = editing || { id: sess.id, created_at: new Date().toISOString(), done_at: null };
    const status = $("fStatus").value;
    const card = {
      ...base,
      title: $("fTitle").value.trim(),
      notes: $("fNotes").value.trim(),
      checklist: collectSteps(),
      assignee: $("fAssignee").value,
      category: $("fCategory").value,
      room: $("fRoom").value,
      size: $("fSize").value,
      due: $("fDue").value || null,
      repeat: $("fRepeat").value
    };
    if (!card.title) return;
    sess.saved = true;
    // Wait for any photos still uploading, then remove ones taken off this job.
    if (sess.pending.length) await Promise.allSettled(sess.pending);
    card.photos = [...sess.photos];
    const dropped = (editing?.photos || []).filter((p) => !sess.photos.includes(p));
    if (dropped.length) store.removePhotos(dropped).catch(() => {});
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
    const photoPaths = cards.filter((c) => ids.includes(c.id)).flatMap((c) => c.photos || []);
    if (photoPaths.length) store.removePhotos(photoPaths).catch(() => {});
    cards = cards.filter((c) => !ids.includes(c.id));
    render();
    try { await store.remove(ids); setSync("ok", "Saved"); }
    catch (e) { setSync("err", e.message); refresh(); }
  }

  // ---------- Photos ----------

  // The job being edited: its id (new jobs get one up front), its photos,
  // photos uploaded during this edit (removed again if cancelled), uploads in flight.
  let edit = { id: null, photos: [], uploaded: [], pending: [], uploading: 0, saved: false };
  let viewing = null;
  const urlCache = new Map(); // path -> { url, until }

  async function photoUrls(paths) {
    const now = Date.now();
    const missing = paths.filter((p) => !(urlCache.get(p)?.until > now));
    if (missing.length) {
      const got = await store.photoUrls(missing);
      for (const [p, url] of Object.entries(got)) urlCache.set(p, { url, until: now + 50 * 60 * 1000 });
    }
    return Object.fromEntries(paths.map((p) => [p, urlCache.get(p)?.url]));
  }

  // Fill in any <img data-path> under root that has no picture yet.
  async function loadPhotos(root) {
    const imgs = [...root.querySelectorAll("img[data-path]:not([src])")];
    if (!imgs.length) return;
    try {
      const urls = await photoUrls([...new Set(imgs.map((i) => i.dataset.path))]);
      imgs.forEach((i) => { if (urls[i.dataset.path]) i.src = urls[i.dataset.path]; });
    } catch { /* thumbnails are a nice-to-have; ignore */ }
  }

  // Shrink a photo before upload: saves data and storage, and fixes rotation.
  async function shrink(file, max) {
    let src;
    try {
      src = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      src = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("That file doesn't look like a photo."));
        i.src = URL.createObjectURL(file);
      });
    }
    const scale = Math.min(1, max / Math.max(src.width, src.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(src.width * scale);
    canvas.height = Math.round(src.height * scale);
    canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
  }

  function setPhotoStatus(text, isError) {
    const el = $("photoStatus");
    el.textContent = text;
    el.classList.toggle("error", !!isError);
  }

  function renderPhotos() {
    const grid = $("photoGrid");
    grid.replaceChildren();
    edit.photos.forEach((path) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "thumb";
      b.setAttribute("aria-label", "View photo");
      const img = document.createElement("img");
      img.alt = "";
      img.dataset.path = path;
      b.append(img);
      b.onclick = () => openViewer(path);
      grid.append(b);
    });
    for (let i = 0; i < edit.uploading; i++) {
      grid.append(Object.assign(document.createElement("span"), { className: "thumb loading" }));
    }
    const n = edit.photos.length;
    $("photoCount").textContent = n ? String(n) : "";
    loadPhotos(grid);
  }

  async function addPhotos(files) {
    const sess = edit;
    for (const file of files) {
      sess.uploading++;
      renderPhotos();
      const job = (async () => {
        try {
          const blob = await shrink(file, store.photoMax);
          const path = await store.uploadPhoto(sess.id, blob);
          sess.photos.push(path);
          sess.uploaded.push(path);
          if (sess === edit) setPhotoStatus("");
          // Editor was cancelled while this was uploading: tidy it away.
          if (sess.cancelled) store.removePhotos([path]).catch(() => {});
        } catch (e) {
          if (sess === edit) setPhotoStatus("Couldn't add that photo: " + (e.message || e), true);
        } finally {
          sess.uploading = Math.max(0, sess.uploading - 1);
          if (sess === edit) renderPhotos();
        }
      })();
      sess.pending.push(job);
    }
  }

  async function openViewer(path) {
    viewing = path;
    const img = $("viewerImg");
    img.removeAttribute("src");
    $("viewer").showModal();
    try { img.src = (await photoUrls([path]))[path]; } catch { /* ignore */ }
  }

  function removeViewedPhoto() {
    if (!viewing) return;
    edit.photos = edit.photos.filter((p) => p !== viewing);
    if (edit.uploaded.includes(viewing)) {
      // Uploaded during this edit and never saved: delete it straight away.
      store.removePhotos([viewing]).catch(() => {});
      edit.uploaded = edit.uploaded.filter((p) => p !== viewing);
    }
    viewing = null;
    $("viewer").close();
    renderPhotos();
  }

  // ---------- Starter packs ----------

  const PACKS = window.HARCOURT_STARTER_PACKS || [];
  const key = (title, rm) => (title + "|" + (rm || "")).toLowerCase();

  function openStarters() {
    const existing = new Set(cards.filter((c) => c.status !== "done").map((c) => key(c.title, c.room)));
    const list = $("starterList");
    list.replaceChildren();
    PACKS.forEach((pack, pi) => {
      const det = document.createElement("details");
      det.className = "pack";
      det.open = true; // everything ticked is visible, so nothing gets added by surprise
      const sum = document.createElement("summary");
      const fresh = pack.jobs.filter((j) => !existing.has(key(j.title, j.room))).length;
      sum.append(Object.assign(document.createElement("span"), { textContent: pack.name }),
                 Object.assign(document.createElement("span"), { className: "n", textContent: `${fresh} new` }));
      det.append(sum);
      pack.jobs.forEach((j, ji) => {
        const added = existing.has(key(j.title, j.room));
        const row = document.createElement("label");
        row.className = "job" + (added ? " added" : "");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !added;
        cb.disabled = added;
        cb.dataset.pack = pi;
        cb.dataset.job = ji;
        cb.onchange = updateStarterCount;
        const text = document.createElement("span");
        text.textContent = j.title;
        const small = document.createElement("small");
        const bits = [j.room || "Whole house", REPEATS[j.repeat] || j.repeat];
        if (added) bits.push("already on your board");
        small.textContent = bits.join(" · ");
        text.append(small);
        row.append(cb, text);
        det.append(row);
      });
      list.append(det);
    });
    updateStarterCount();
    $("menu").close();
    $("starters").showModal();
  }

  function checkedStarters() {
    return [...$("starterList").querySelectorAll("input:checked:not(:disabled)")]
      .map((cb) => PACKS[cb.dataset.pack].jobs[cb.dataset.job]);
  }

  function updateStarterCount() {
    const n = checkedStarters().length;
    $("addStartersBtn").textContent = n ? `Add ${n} job${n === 1 ? "" : "s"}` : "Add jobs";
    $("addStartersBtn").disabled = !n;
  }

  async function addStarters() {
    const now = new Date().toISOString();
    const newCards = checkedStarters().map((j) => ({
      id: uuid(), title: j.title, notes: j.notes || "", status: CFG.COLUMNS[0].id,
      assignee: "", category: j.category || "", room: CFG.ROOMS.includes(j.room) ? j.room : "",
      size: j.size || "", repeat: j.repeat || "", done_at: null, created_at: now,
      checklist: (j.checklist || []).map((text) => ({ text, done: false })),
      due: j.month ? nextOccurrence(j.month, j.day || 1) : daysFromToday(j.in || 0)
    }));
    if (!newCards.length) return;
    cards.push(...newCards);
    render();
    try {
      await store.saveMany(newCards);
      setSync("ok", "Saved");
    } catch (e) {
      setSync("err", "Not saved: " + e.message);
      alert("Couldn't add the starter jobs.\n\n" + e.message);
      refresh();
    }
  }

  // ---------- Wiring ----------

  function wire() {
    $("whoField").hidden = !ASSIGNING;
    fillSelect($("fAssignee"), [["", "Anyone"], ...CFG.PEOPLE.map((p) => [p, p]), ["Both", "Both of us"]]);
    fillSelect($("fCategory"), [["", "None"], ...CFG.CATEGORIES.map((c) => [c.id, c.name])]);
    fillSelect($("fRoom"), [["", "Whole house"], ...CFG.ROOMS.map((r) => [r, r])]);
    fillSelect($("fSize"), [["", "Not sure"], ...SIZES.map((z) => [z.id, z.long])]);
    fillSelect($("fStatus"), CFG.COLUMNS.map((c) => [c.id, c.name]));

    $("addBtn").onclick = () => openEditor(null);
    $("addStepBtn").onclick = addStep;
    for (const id of ["cameraInput", "libraryInput"]) {
      $(id).onchange = (e) => { addPhotos([...e.target.files]); e.target.value = ""; };
    }
    $("closeViewerBtn").onclick = () => $("viewer").close();
    $("removePhotoBtn").onclick = removeViewedPhoto;
    // Cancelled edit: tidy away photos uploaded during it.
    $("editor").addEventListener("close", () => {
      if (edit.saved) return;
      edit.cancelled = true;
      if (edit.uploaded.length) store.removePhotos(edit.uploaded).catch(() => {});
    });
    $("newStep").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } };
    $("cancelBtn").onclick = () => $("editor").close();
    $("editForm").onsubmit = (e) => { e.preventDefault(); saveEditor(); $("editor").close(); };
    $("deleteBtn").onclick = () => {
      if (editing && confirm(`Delete "${editing.title}"?`)) { $("editor").close(); removeCards([editing.id]); }
    };

    $("roomBtn").onclick = () => { renderRooms(); $("rooms").showModal(); };
    $("closeRoomsBtn").onclick = () => $("rooms").close();
    $("startersBtn").onclick = openStarters;
    $("closeStartersBtn").onclick = () => $("starters").close();
    $("startersForm").onsubmit = (e) => { e.preventDefault(); $("starters").close(); addStarters(); };
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

  if ("serviceWorker" in navigator) {
    // When a new version of the app takes over, reload once so the page
    // isn't left running a mix of old and new files.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register("sw.js").then((reg) => reg.update()).catch(() => {});
  }
  boot();
})();
