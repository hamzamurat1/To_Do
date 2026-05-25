const API = "";
const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
let baseWeek = 0;
let pool = [];
let currentWeekDates = [];

/* ======================
   📅 TARİH HESAPLAMA
====================== */
function mondayOf(offset) {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  return monday;
}

/* ======================
   ✅ GÜN CHECKBOX LİSTESİ
====================== */
function buildDayList() {
  const dayList = document.getElementById("dayList");
  dayList.innerHTML = "";
  currentWeekDates.forEach((dateStr, i) => {
    const btn = document.createElement("div");
    btn.className = "dayCheckItem";
    btn.dataset.date = dateStr;
    btn.textContent = days[i];
    btn.onclick = () => {
      btn.classList.toggle("checked");
      updateSelectAllBtn();
    };
    dayList.appendChild(btn);
  });
}

function updateSelectAllBtn() {
  const btns = document.querySelectorAll("#dayList .dayCheckItem");
  const allChecked = [...btns].every(b => b.classList.contains("checked"));
  document.getElementById("selectAllDays").textContent = allChecked ? "Hepsini Kaldır" : "Hepsini Seç";
}

document.getElementById("selectAllDays").onclick = () => {
  const btns = document.querySelectorAll("#dayList .dayCheckItem");
  const allChecked = [...btns].every(b => b.classList.contains("checked"));
  btns.forEach(b => b.classList.toggle("checked", !allChecked));
  updateSelectAllBtn();
};

/* ======================
   📦 TASK POOL
====================== */
function loadPool() {
  fetch(`${API}/taskpool`)
    .then(res => res.json())
    .then(data => {
      pool = data;
      poolDiv.innerHTML = "";
      poolSelect.innerHTML = "";
      data.forEach((t, i) => {
        const div = document.createElement("div");
        div.className = "task";
        div.innerHTML = `<span><span class="task-time">${t.Time}</span> ${t.Name}</span><button class="deleteBtn pool-del-btn" data-id="${t.Id}">🗑️</button>`;
        div.querySelector(".pool-del-btn").onclick = async (e) => {
          e.stopPropagation();
          if (!confirm("Bu görevi havuzdan sil?")) return;
          await fetch(`${API}/taskpool/${t.Id}`, { method: "DELETE" });
          loadPool();
        };
        poolDiv.appendChild(div);
        poolSelect.innerHTML += `<option value="${i}">${t.Time} ${t.Name}</option>`;
      });
    });
}

function addPool() {
  if (!taskName.value || !taskTime.value) return;
  fetch(`${API}/taskpool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: taskName.value, time: taskTime.value })
  }).then(() => { taskName.value = ""; taskTime.value = ""; loadPool(); });
}

function resetPool() {
  if (!confirm("Tüm görev havuzunu silmek istiyor musun? Bu işlem geri alınamaz!")) return;
  fetch(`${API}/taskpool-reset`, { method: "DELETE" })
    .then(() => { pool = []; loadPool(); render(); });
}

/* ======================
   📅 WEEKLY API
====================== */
async function loadWeekly(mon) {
  const start = mon.toISOString().split("T")[0];
  const endDate = new Date(mon);
  endDate.setDate(endDate.getDate() + 29);
  const end = endDate.toISOString().split("T")[0];
  const res = await fetch(`${API}/weekly?start=${start}&end=${end}`);
  const data = await res.json();
  // Eski format uyumluluğu (dizi ise direkt kullan)
  if (Array.isArray(data)) return { tasks: data, postponedDays: [] };
  return data;
}

function toggleDone(id, done) {
  fetch(`${API}/weekly/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done })
  }).then(() => render());
}

function deleteTask(id) {
  if (!confirm("Bu görevi silmek istiyor musun?")) return;
  fetch(`${API}/weekly/${id}`, { method: "DELETE" }).then(() => render());
}

/* ======================
   🟠 GÜN ERTELEME (postponed)
====================== */
async function togglePostpone(dateStr, col) {
  const isPostponed = col.classList.contains("postponed");
  if (isPostponed) {
    await fetch(`${API}/postpone/${dateStr}`, { method: "DELETE" });
    col.classList.remove("postponed");
  } else {
    await fetch(`${API}/postpone/${dateStr}`, { method: "POST" });
    col.classList.add("postponed");
  }
}

/* ======================
   🗑️ GÜN SİLME
====================== */
function deleteDay(dateStr) {
  if (!confirm(`${dateStr} tarihindeki tüm görevler silinsin mi?`)) return;
  fetch(`${API}/weekly/day/${dateStr}`, { method: "DELETE" }).then(() => render());
}

function deleteAllDays() {
  if (!confirm("Bu haftadaki TÜM görevler silinsin mi? Bu işlem geri alınamaz!")) return;
  const requests = currentWeekDates.map(d =>
    fetch(`${API}/weekly/day/${d}`, { method: "DELETE" })
  );
  Promise.all(requests).then(() => render());
}

/* ======================
   🔀 SÜRÜKLE BIRAK — TAŞI
====================== */
function moveTask(taskId, newDate) {
  fetch(`${API}/weekly/${taskId}/move`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: newDate })
  }).then(() => render());
}

/* ======================
   ➕ GÖREV EKLEME
====================== */
function assignTask() {
  const idx = poolSelect.value;
  if (idx === "" || idx === null || !pool[idx]) return;

  const selectedDates = [...document.querySelectorAll("#dayList .dayCheckItem.checked")]
    .map(b => b.dataset.date);

  if (selectedDates.length === 0) { alert("Lütfen en az bir gün seç!"); return; }

  const repeatCount = parseInt(document.getElementById("repeatCount").value) || 1;
  const requests = [];

  selectedDates.forEach(dateStr => {
    const startDate = new Date(dateStr);
    for (let i = 0; i < repeatCount; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i * 7);
      requests.push(fetch(`${API}/weekly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskPoolId: pool[idx].Id, date: d.toISOString().split("T")[0] })
      }));
    }
  });

  Promise.all(requests).then(() => render());
}

/* ======================
   🖼️ RENDER
====================== */
async function render() {
  const mon = mondayOf(baseWeek);
  weekLabel.innerText = mon.toLocaleDateString();
  board.innerHTML = "";

  currentWeekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    currentWeekDates.push(d.toISOString().split("T")[0]);
  }

  const prevChecked = new Set(
    [...document.querySelectorAll("#dayList .dayCheckItem.checked")].map(b => b.dataset.date)
  );
  buildDayList();
  document.querySelectorAll("#dayList .dayCheckItem").forEach(b => {
    if (prevChecked.has(b.dataset.date)) b.classList.add("checked");
  });
  updateSelectAllBtn();

  const { tasks: weekly, postponedDays } = await loadWeekly(mon);
  const today = new Date().toISOString().split("T")[0];

  days.forEach((g, i) => {
    const key = currentWeekDates[i];
    const isPostponed = postponedDays.includes(key);
    const col = document.createElement("div");
    col.className = "day"
      + (key === today ? " today" : "")
      + (isPostponed ? " postponed" : "");

    const d = new Date(key);

    // Başlık satırı: gün adı + tarih + butonlar
    const header = document.createElement("div");
    header.className = "day-header";
    header.innerHTML = `
      <span class="day-title">${g}<br><small>${d.getDate()}/${d.getMonth() + 1}</small></span>
      <div class="day-btns">
        <button class="postponeBtn" title="Ertele">⚠️</button>
        <button class="deleteDayBtn" title="Günü sil">🗑️</button>
      </div>
    `;

    header.querySelector(".postponeBtn").onclick = (e) => {
      e.stopPropagation();
      togglePostpone(key, col);
    };
    header.querySelector(".deleteDayBtn").onclick = (e) => {
      e.stopPropagation();
      deleteDay(key);
    };

    col.appendChild(header);

    weekly
      .filter(t => t.TaskDate.startsWith(key))
      .sort((a, b) => a.Time.localeCompare(b.Time))
      .forEach(t => {
        const div = document.createElement("div");
        const isOverdue = !t.IsDone && key < today;
        div.className = "task" + (t.IsDone ? " done" : "") + (isOverdue ? " overdue" : "");
        div.draggable = true;
        div.dataset.taskId = t.Id;
        div.innerHTML = `<span><span class="task-time">${t.Time}</span> ${t.Name}</span><button class="deleteBtn">🗑️</button>`;
        div.querySelector(".deleteBtn").onclick = (e) => { e.stopPropagation(); deleteTask(t.Id); };
        div.onclick = () => toggleDone(t.Id, !t.IsDone);

        // Sürükleme başladı
        div.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("taskId", t.Id);
          e.dataTransfer.effectAllowed = "move";
          setTimeout(() => div.classList.add("dragging"), 0);
        });
        div.addEventListener("dragend", () => {
          div.classList.remove("dragging");
          document.querySelectorAll(".day").forEach(d => d.classList.remove("drag-over"));
        });

        col.appendChild(div);
      });

    // Bırakma hedefi: gün sütunu
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".day").forEach(d => d.classList.remove("drag-over"));
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove("drag-over");
    });
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;
      moveTask(taskId, key);
    });

    board.appendChild(col);
  });

  loadPool();

  // Masaüstünde tüm günleri göster, mobilde swipe
  if (window.innerWidth <= 768) {
    initMobileSwipe();
  } else {
    // Masaüstü: hepsini göster, display sıfırla
    [...board.querySelectorAll(".day")].forEach(col => {
      col.style.display = "flex";
    });
  }
}

/* ======================
   📱 MOBİL SWIPE
====================== */
let activeDayIndex = null;

function isMobile() { return window.innerWidth <= 768; }

function initMobileSwipe() {
  const cols = [...board.querySelectorAll(".day")];
  if (!cols.length) return;

  // Bugün hangi index?
  const today = new Date().toISOString().split("T")[0];
  let startIndex = currentWeekDates.indexOf(today);
  if (startIndex === -1) startIndex = 0;

  // Kayıtlı index varsa onu kullan
  if (activeDayIndex !== null && activeDayIndex < cols.length) {
    startIndex = activeDayIndex;
  }

  activeDayIndex = startIndex;

  // Tüm günleri gizle, aktifi göster
  cols.forEach((col, i) => {
    col.style.display = i === activeDayIndex ? "flex" : "none";
  });

  // Swipe dot göstergesi güncelle
  updateSwipeDots();
}

function showDay(index) {
  const cols = [...board.querySelectorAll(".day")];
  if (index < 0 || index >= cols.length) return;
  activeDayIndex = index;
  cols.forEach((col, i) => {
    col.style.display = i === activeDayIndex ? "flex" : "none";
  });
  updateSwipeDots();
}

function updateSwipeDots() {
  const dots = document.querySelectorAll(".swipe-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === activeDayIndex);
  });
  // Gün adı göstergesi
  const label = document.getElementById("activeDayLabel");
  if (label && currentWeekDates[activeDayIndex]) {
    const d = new Date(currentWeekDates[activeDayIndex]);
    label.textContent = days[activeDayIndex] + "  " + d.getDate() + "/" + (d.getMonth()+1);
  }
}

// Touch listeners aşağıda DOM tanımından sonra eklendi

/* ======================
   🧩 DOM
====================== */
const board = document.getElementById("board");
const weekLabel = document.getElementById("weekLabel");
const poolSelect = document.getElementById("poolSelect");
const poolDiv = document.getElementById("pool");
const taskName = document.getElementById("taskName");
const taskTime = document.getElementById("taskTime");

document.getElementById("prev").onclick = () => { baseWeek--; activeDayIndex = 0; render(); };
document.getElementById("next").onclick = () => { baseWeek++; activeDayIndex = 0; render(); };

// Swipe gesture — board DOM'dan sonra
let touchStartX = 0;
board.addEventListener("touchstart", e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });

board.addEventListener("touchend", e => {
  if (!isMobile()) return;
  const diff = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 50) {
    if (diff > 0) showDay(activeDayIndex + 1);
    else          showDay(activeDayIndex - 1);
  }
}, { passive: true });

// Swipe butonları
document.getElementById("swipePrev").onclick = () => showDay(activeDayIndex - 1);
document.getElementById("swipeNext").onclick = () => showDay(activeDayIndex + 1);

// Dot'ları oluştur (7 tane)
const swipeDots = document.getElementById("swipeDots");
for (let i = 0; i < 7; i++) {
  const dot = document.createElement("span");
  dot.className = "swipe-dot";
  dot.dataset.index = i;
  dot.onclick = () => showDay(i);
  swipeDots.appendChild(dot);
}
document.getElementById("savePool").onclick = addPool;
document.getElementById("assign").onclick = assignTask;
document.getElementById("resetPool").onclick = resetPool;
document.getElementById("deleteAllDays").onclick = deleteAllDays;

/* ======================
   🍅 POMODORO
====================== */
const pomoSound = new Audio("./sound/timerIsOver.mp3");
let pomoInterval = null;
let pomoMode = localStorage.getItem("pomoMode") || "idle";
let pomoDuration = 0;

// Bitiş zamanı bazlı sayaç — sekme arka planda olsa bile doğru çalışır
let pomoEndTime = localStorage.getItem("pomoEndTime")
  ? parseInt(localStorage.getItem("pomoEndTime"))
  : null;

const pomoDisplay = document.getElementById("pomoDisplay");

function setPomoMode(mode) {
  pomoMode = mode;
  localStorage.setItem("pomoMode", mode);
  pomoDisplay.className = mode;
}

function getRemainingSeconds() {
  if (!pomoEndTime) return 0;
  return Math.max(0, Math.round((pomoEndTime - Date.now()) / 1000));
}

function updatePomo() {
  const remaining = getRemainingSeconds();
  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");
  const timeStr = `${m}:${s}`;
  pomoDisplay.innerText = timeStr;

  // Sekme başlığı
  const modeIcon = pomoMode === "work" ? "🟢" : pomoMode === "break" ? "🟠" : "⏱";
  document.title = pomoInterval ? `${modeIcon} ${timeStr} — Planlayıcı` : "Haftalık Planlayıcı";

  // PiP canvas güncelle
  updatePipCanvas(timeStr);
}

// Picture-in-Picture (Document PiP)
let pipWindow = null;
let pipCanvas = null;
let pipCtx = null;

function getPipBarColor() {
  return pomoMode === "work" ? "#44ffaa" : pomoMode === "break" ? "#ffaa44" : "#88aacc";
}

function updatePipCanvas(timeStr) {
  if (!pipCtx) return;
  const W = 64, H = 50;
  const barColor = getPipBarColor();

  pipCtx.fillStyle = "#0f2030";
  pipCtx.fillRect(0, 0, W, H);

  pipCtx.fillStyle = barColor;
  pipCtx.font = "bold 22px Arial";
  pipCtx.textAlign = "center";
  pipCtx.shadowColor = barColor;
  pipCtx.shadowBlur = 14;
  pipCtx.fillText(timeStr, W / 2, 37);
  pipCtx.shadowBlur = 0;
}

function updatePipToggle() {
  if (!pipWindow || pipWindow.closed) return;
  const toggleBtn = pipWindow.document.getElementById("pip-toggle");
  if (!toggleBtn) return;
  const barColor = getPipBarColor();
  toggleBtn.style.borderColor = barColor;
  toggleBtn.style.boxShadow = "0 0 7px " + barColor + "77";
  toggleBtn.textContent = pomoInterval ? "⏸ Durdur" : "▶ Başlat";
}

async function togglePip() {
  if ("documentPictureInPicture" in window) {
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
      pipWindow = null;
      return;
    }

    pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 70,
      height: 90,
    });

    const mainDoc = document;

    // Canvas
    pipCanvas = pipWindow.document.createElement("canvas");
    pipCanvas.width = 64;
    pipCanvas.height = 50;
    pipCtx = pipCanvas.getContext("2d");

    const styleEl = pipWindow.document.createElement("style");
    styleEl.textContent = [
      "* { margin:0; padding:0; box-sizing:border-box; }",
      "html, body { background:#0f2030; width:100%; height:100%; overflow:hidden; }",
      "body { display:flex; flex-direction:column; align-items:center;",
      "       justify-content:center; gap:5px; padding:3px; }",
      "canvas { border-radius:6px; display:block; }",
      ".pip-toggle { width:60px; height:24px; border-radius:12px;",
      "              border:1.5px solid #44ffaa; background:rgba(255,255,255,0.07);",
      "              color:#fff; font-size:11px; cursor:pointer;",
      "              display:flex; align-items:center; justify-content:center;",
      "              transition:background 0.15s; }",
      ".pip-toggle:hover { background:rgba(255,255,255,0.2); }",
      ".pip-toggle:active { transform:scale(0.95); }"
    ].join("\n");
    pipWindow.document.head.appendChild(styleEl);

    // Tek toggle butonu
    const toggleBtn = pipWindow.document.createElement("button");
    toggleBtn.id = "pip-toggle";
    toggleBtn.className = "pip-toggle";
    toggleBtn.textContent = pomoInterval ? "⏸ Durdur" : "▶ Başlat";
    toggleBtn.onclick = function() {
      if (pomoInterval) {
        mainDoc.getElementById("pomoStop").click();
      } else {
        mainDoc.getElementById("pomoStart").click();
      }
      updatePipToggle();
    };

    pipWindow.document.body.appendChild(pipCanvas);
    pipWindow.document.body.appendChild(toggleBtn);

    updatePipCanvas(pomoDisplay.innerText);
    updatePipToggle();

    pipWindow.addEventListener("pagehide", function() {
      pipWindow = null;
      pipCtx = null;
      pipCanvas = null;
    });

  } else {
    alert("Tarayıcınız Document PiP desteklemiyor. Chrome 116+ gerekli.");
  }
}

function updatePipPlaybackState() {
  updatePipToggle();
}

function savePomodoro() {
  const idx = poolSelect.value;
  if (idx === null || idx === undefined || !pool[idx]) return;
  const duration = Math.round(pomoDuration / 60);
  fetch(`${API}/pomodoro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskPoolId: pool[idx].Id, duration })
  });
}

// Preset butonları
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.onclick = () => {
    if (pomoInterval) return;
    const minutes = parseInt(btn.dataset.min);
    pomoDuration = minutes * 60;
    pomoEndTime = null;
    localStorage.removeItem("pomoEndTime");
    const mode = btn.classList.contains("work-btn") ? "work" : "break";
    setPomoMode(mode);
    // Manuel göster
    const m = String(minutes).padStart(2, "0");
    pomoDisplay.innerText = `${m}:00`;
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };
});

document.getElementById("pomoStart").onclick = () => {
  if (pomoInterval) return;
  if (!pomoDuration && !pomoEndTime) return;

  // Eğer durdurulmuşsa kalan süreden devam et, yoksa baştan başla
  if (!pomoEndTime) {
    pomoEndTime = Date.now() + pomoDuration * 1000;
    localStorage.setItem("pomoEndTime", pomoEndTime);
  }

  pomoInterval = setInterval(() => {
    const remaining = getRemainingSeconds();
    if (remaining <= 0) {
      clearInterval(pomoInterval); pomoInterval = null;
      pomoSound.play().catch(() => {});
      if (pomoMode === "work") savePomodoro();
      setPomoMode("idle");
      pomoEndTime = null;
      localStorage.removeItem("pomoEndTime");
      pomoDisplay.innerText = "00:00";
      document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
      return;
    }
    updatePomo();
  }, 500); // 500ms ile daha hassas
  updatePipPlaybackState();
};

document.getElementById("pomoStop").onclick = () => {
  if (!pomoInterval) return;
  clearInterval(pomoInterval); pomoInterval = null;
  // Kalan süreyi kaydet — devam edilebilsin
  const remaining = getRemainingSeconds();
  pomoDuration = remaining;
  pomoEndTime = null;
  localStorage.removeItem("pomoEndTime");
  updatePipPlaybackState();
};

document.getElementById("pomoReset").onclick = () => {
  clearInterval(pomoInterval); pomoInterval = null;
  pomoDuration = 0;
  pomoEndTime = null;
  localStorage.removeItem("pomoEndTime");
  localStorage.removeItem("pomoMode");
  setPomoMode("idle");
  pomoDisplay.innerText = "00:00";
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
};

// Sayfa açılışında devam eden sayaç varsa göster
if (pomoEndTime && getRemainingSeconds() > 0) {
  setPomoMode(pomoMode);
  updatePomo();
  // Otomatik devam et
  document.getElementById("pomoStart").click();
}

/* ======================
   🍞 TOAST BİLDİRİM
====================== */
function showToast(msg, isError = false) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = isError ? "error" : "";
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => toast.classList.remove("show"), 2800);
}

/* ======================
   🔁 TEKRARLAYAN GÖREVLER
====================== */
const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

// Gün buton tıklama (checkbox yok, sadece div)
document.querySelectorAll(".rec-day-btn").forEach(btn => {
  if (btn.id === "recSelectAll") return;
  btn.onclick = () => {
    btn.classList.toggle("active");
    // Hepsi durumunu güncelle
    const allBtns = [...document.querySelectorAll(".rec-day-btn:not(#recSelectAll)")];
    const allActive = allBtns.every(b => b.classList.contains("active"));
    const recAll = document.getElementById("recSelectAll");
    recAll.classList.toggle("active", allActive);
    recAll.textContent = allActive ? "Hepsini Kaldır" : "Hepsi";
  };
});

// Hepsi butonu
document.getElementById("recSelectAll").onclick = () => {
  const allBtns = [...document.querySelectorAll(".rec-day-btn:not(#recSelectAll)")];
  const allActive = allBtns.every(b => b.classList.contains("active"));
  allBtns.forEach(b => b.classList.toggle("active", !allActive));
  const recAll = document.getElementById("recSelectAll");
  recAll.classList.toggle("active", !allActive);
  recAll.textContent = !allActive ? "Hepsini Kaldır" : "Hepsi";
};

// Kayıtlı listeyi getir ve göster
async function loadRecurringList() {
  const res = await fetch(`${API}/recurring`);
  const data = await res.json();
  const list = document.getElementById("recList");

  if (!data.length) {
    list.innerHTML = '<div class="rec-empty">Henüz kural yok — yukarıdan ekle</div>';
    return;
  }

  // Aynı görevi günlere göre grupla
  const grouped = {};
  data.forEach(r => {
    const key = r.Name + "_" + r.Time;
    if (!grouped[key]) grouped[key] = { name: r.Name, time: r.Time, days: [], ids: [] };
    grouped[key].days.push(r.Weekday);
    grouped[key].ids.push(r.Id);
  });

  list.innerHTML = "";
  Object.values(grouped).forEach(g => {
    const item = document.createElement("div");
    item.className = "rec-item";
    const order = [1,2,3,4,5,6,0];
    const dayBadges = g.days
      .sort((a,b) => order.indexOf(a) - order.indexOf(b))
      .map(d => `<span class="rec-item-day">${dayNames[d]}</span>`)
      .join("");

    item.innerHTML = `
      <div class="rec-item-info">
        <span class="rec-item-name">${g.name}</span>
        <span class="rec-item-time">${g.time}</span>
        <div class="rec-item-days">${dayBadges}</div>
      </div>
      <button class="rec-delete-btn">🗑️</button>
    `;

    item.querySelector(".rec-delete-btn").onclick = async () => {
      if (!confirm("Bu kuralı silmek istiyor musun?")) return;
      await Promise.all(g.ids.map(id =>
        fetch(`${API}/recurring/${id}`, { method: "DELETE" })
      ));
      showToast("Kural silindi");
      loadRecurringList();
    };

    list.appendChild(item);
  });
}

// Kural kaydet
async function saveRecurring() {
  const idx = document.getElementById("recPoolSelect").value;
  if (idx === "" || !pool[idx]) { showToast("Görev seç!", true); return; }

  const selectedDays = [...document.querySelectorAll(".rec-day-btn.active")]
    .map(b => parseInt(b.dataset.day));

  if (!selectedDays.length) { showToast("En az bir gün seç!", true); return; }

  await Promise.all(selectedDays.map(day =>
    fetch(`${API}/recurring`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskPoolId: pool[idx].Id, weekday: day })
    })
  ));

  // Seçimleri temizle
  document.querySelectorAll(".rec-day-btn.active").forEach(b => b.classList.remove("active"));

  showToast(`"${pool[idx].Name}" kural olarak kaydedildi ✓`);
  loadRecurringList();
}

// Bu haftayı otomatik doldur
async function fillThisWeek() {
  const mon = mondayOf(baseWeek);
  const weekStart = mon.toISOString().split("T")[0];
  await fetch(`${API}/recurring/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weekStart, weeks: 1 })
  });
  showToast("Bu hafta dolduruldu ✓");
  render();
}

// İleri haftalara ekle
async function generateWeeks() {
  const weeks = parseInt(document.getElementById("recWeeks").value);
  if (!weeks || weeks < 1) { showToast("Hafta sayısı gir!", true); return; }
  const mon = mondayOf(baseWeek);
  const weekStart = mon.toISOString().split("T")[0];
  await fetch(`${API}/recurring/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weekStart, weeks })
  });
  showToast(`${weeks} hafta oluşturuldu ✓`);
  document.getElementById("recWeeks").value = "";
  render();
}

// Modal aç
document.getElementById("showRecurring").onclick = () => {
  const recSel = document.getElementById("recPoolSelect");
  recSel.innerHTML = pool.map((t, i) =>
    `<option value="${i}">${t.Time} ${t.Name}</option>`
  ).join("");
  loadRecurringList();
  document.getElementById("recurringModal").classList.remove("hidden");
};

document.getElementById("closeRecurring").onclick = () =>
  document.getElementById("recurringModal").classList.add("hidden");

document.getElementById("recurringModal").onclick = (e) => {
  if (e.target.id === "recurringModal")
    document.getElementById("recurringModal").classList.add("hidden");
};

document.getElementById("recSave").onclick = saveRecurring;
document.getElementById("pipBtn").onclick = togglePip;

// Manuel süre ayarlama
document.getElementById("customSet").onclick = () => {
  if (pomoInterval) return;
  const min = parseInt(document.getElementById("customMin").value) || 0;
  const sec = parseInt(document.getElementById("customSec").value) || 0;
  const total = min * 60 + sec;
  if (total <= 0) return;
  pomoDuration = total;
  pomoEndTime = null;
  localStorage.removeItem("pomoEndTime");
  const m = String(min).padStart(2, "0");
  const s = String(sec).padStart(2, "0");
  pomoDisplay.innerText = `${m}:${s}`;
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
  // Seçili moda göre renk uygula
  setPomoMode(pomoMode === "break" ? "break" : "work");
};

document.getElementById("recThisWeek").onclick = fillThisWeek;
document.getElementById("recGenerate").onclick = generateWeeks;
document.getElementById("recRefresh").onclick = loadRecurringList;

/* ======================
   📊 İSTATİSTİK
====================== */
let chartInstance = null;

async function showStats() {
  const mon = mondayOf(baseWeek);
  const start = mon.toISOString().split("T")[0];
  const endDate = new Date(mon);
  endDate.setDate(endDate.getDate() + 6);
  const end = endDate.toISOString().split("T")[0];

  const res = await fetch(`${API}/weekly?start=${start}&end=${end}`);
  const data = await res.json();
  const weekly = Array.isArray(data) ? data : data.tasks;
  const postponedDays = Array.isArray(data) ? [] : (data.postponedDays || []);

  // Günlük topla
  const totalArr = [], doneArr = [], postponedArr = [], labels = [];
  days.forEach((g, i) => {
    const key = currentWeekDates[i] || (() => {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      return d.toISOString().split("T")[0];
    })();
    const isPostponed = postponedDays.includes(key);
    const dayTasks = weekly.filter(t => t.TaskDate.startsWith(key));
    labels.push(g.substring(0, 3));
    totalArr.push(isPostponed ? 0 : dayTasks.length);
    doneArr.push(isPostponed ? 0 : dayTasks.filter(t => t.IsDone).length);
    postponedArr.push(isPostponed ? dayTasks.length : 0);
  });

  // Ertelenen günler tamamlanma yüzdesine dahil edilmez
  const total = totalArr.reduce((a,b) => a+b, 0);
  const done  = doneArr.reduce((a,b) => a+b, 0);
  const rate  = total > 0 ? Math.round((done / total) * 100) : 0;

  // Özet kartlar
  document.getElementById("statTotal").innerHTML =
    `<div class="stat-value">${total}</div><div class="stat-label">Toplam Görev</div>`;
  document.getElementById("statTotal").className = "stat-card blue";

  document.getElementById("statDone").innerHTML =
    `<div class="stat-value">${done}</div><div class="stat-label">Tamamlanan</div>`;
  document.getElementById("statDone").className = "stat-card green";

  document.getElementById("statRate").innerHTML =
    `<div class="stat-value">${rate}%</div><div class="stat-label">Tamamlanma Oranı</div>`;
  document.getElementById("statRate").className = "stat-card " + (rate >= 70 ? "green" : rate >= 40 ? "blue" : "orange");

  // Grafik
  if (chartInstance) chartInstance.destroy();
  const ctx = document.getElementById("statsChart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Toplam",
          data: totalArr,
          backgroundColor: "rgba(100,180,255,0.35)",
          borderColor: "rgba(100,180,255,0.8)",
          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          label: "Tamamlanan",
          data: doneArr,
          backgroundColor: "rgba(0,210,120,0.5)",
          borderColor: "rgba(0,230,130,0.9)",
          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          label: "Ertelenen",
          data: postponedArr,
          backgroundColor: "rgba(255,180,0,0.4)",
          borderColor: "rgba(255,200,0,0.9)",
          borderWidth: 1.5,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "rgba(255,255,255,0.75)", font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} görev`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "rgba(255,255,255,0.65)", font: { size: 11 } },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "rgba(255,255,255,0.65)", font: { size: 11 }, stepSize: 1 },
          grid: { color: "rgba(255,255,255,0.08)" }
        }
      }
    }
  });

  document.getElementById("statsModal").classList.remove("hidden");
}

document.getElementById("showStats").onclick = showStats;
document.getElementById("closeStats").onclick = () => {
  document.getElementById("statsModal").classList.add("hidden");
};
document.getElementById("statsModal").onclick = (e) => {
  if (e.target.id === "statsModal")
    document.getElementById("statsModal").classList.add("hidden");
};

document.getElementById("togglePool").onclick = () => {
  poolDiv.classList.toggle("open");
  document.getElementById("togglePool").innerText =
    poolDiv.classList.contains("open") ? "Aktiviteleri Gizle" : "Aktiviteleri Göster";
};

updatePomo();
render();
