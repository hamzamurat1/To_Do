const API = "http://localhost:3000";
const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
let baseWeek = 0;
let pool = [];

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
        poolDiv.innerHTML += `<div class="task">${t.Time} ${t.Name}</div>`;
        poolSelect.innerHTML += `<option value="${i}">${t.Time} ${t.Name}</option>`;
      });
    });
}

function addPool() {
  if (!taskName.value || !taskTime.value) return;

  fetch(`${API}/taskpool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: taskName.value,
      time: taskTime.value
    })
  }).then(() => {
    taskName.value = "";
    taskTime.value = "";
    loadPool();
  });
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
  return await res.json();
}

function toggleDone(id, done) {
  fetch(`${API}/weekly/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done })
  }).then(() => render());
}

function assignTask() {
  const idx = poolSelect.value;
  const date = daySelect.value;

  fetch(`${API}/weekly`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskPoolId: pool[idx].Id,
      date: date
    })
  }).then(() => render());
}

function deleteTask(id) {
  if (!confirm("Bu görevi silmek istiyor musun?")) return;

  fetch(`${API}/weekly/${id}`, {
    method: "DELETE"
  }).then(() => render());
}

/* ======================
   🖼️ RENDER
====================== */
async function render() {
  const mon = mondayOf(baseWeek);
  weekLabel.innerText = mon.toLocaleDateString();
  board.innerHTML = "";
  daySelect.innerHTML = "";

  const weekly = await loadWeekly(mon);

  days.forEach((g, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const key = d.toISOString().split("T")[0];

    const col = document.createElement("div");
    col.className = "day";
    col.innerHTML = `<h3>${g}<br>${d.getDate()}/${d.getMonth() + 1}</h3>`;

    weekly
      .filter(t => t.TaskDate.startsWith(key))
      .sort((a, b) => a.Time.localeCompare(b.Time))
      .forEach(t => {
        const div = document.createElement("div");
        div.className = "task" + (t.IsDone ? " done" : "");
        div.innerHTML = `
          <span>${t.Time} ${t.Name}</span>
          <button class="deleteBtn">🗑️</button>
        `;

        div.querySelector(".deleteBtn").onclick = (e) => {
          e.stopPropagation();
          deleteTask(t.Id);
        };

        div.onclick = () => toggleDone(t.Id, !t.IsDone);
        col.appendChild(div);
      });

    board.appendChild(col);
    daySelect.innerHTML += `<option value="${key}">${g}</option>`;
  });

  loadPool();
}

/* ======================
   🧩 DOM
====================== */
const board = document.getElementById("board");
const weekLabel = document.getElementById("weekLabel");
const daySelect = document.getElementById("daySelect");
const poolSelect = document.getElementById("poolSelect");
const poolDiv = document.getElementById("pool");
const taskName = document.getElementById("taskName");
const taskTime = document.getElementById("taskTime");

prev.onclick = () => { baseWeek--; render(); };
next.onclick = () => { baseWeek++; render(); };
savePool.onclick = addPool;
assign.onclick = assignTask;

/* ======================
   🍅 POMODORO
====================== */
const pomoSound = new Audio("./sound/timerIsOver.mp3");
let pomoInterval = null;

let remaining = localStorage.getItem("pomoRemaining")
  ? parseInt(localStorage.getItem("pomoRemaining"))
  : 0;

const pomoMinute = document.getElementById("pomoMinute");
const pomoSecond = document.getElementById("pomoSecond");
const pomoDisplay = document.getElementById("pomoDisplay");

function updatePomo() {
  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");
  pomoDisplay.innerText = `${m}:${s}`;
  localStorage.setItem("pomoRemaining", remaining);
}

function savePomodoro() {
  const idx = poolSelect.value;
  if (idx === null || idx === undefined) return;

  const duration =
    (parseInt(pomoMinute.value || 0) * 60 +
     parseInt(pomoSecond.value || 0)) / 60;

  fetch(`${API}/pomodoro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskPoolId: pool[idx].Id,
      duration: Math.round(duration)
    })
  });
}

pomoStart.onclick = () => {
  if (pomoInterval) return;

  if (remaining === 0) {
    remaining =
      (parseInt(pomoMinute.value || 0) * 60) +
      parseInt(pomoSecond.value || 0);
  }

  pomoInterval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(pomoInterval);
      pomoInterval = null;

      pomoSound.play();   // 🔊 SES
      savePomodoro();     // 💾 DB

      localStorage.removeItem("pomoRemaining");
      return;
    }

    remaining--;
    updatePomo();
  }, 1000);
};

pomoStop.onclick = () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
};

pomoReset.onclick = () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
  remaining = 0;
  localStorage.removeItem("pomoRemaining");
  pomoDisplay.innerText = "00:00";
};

/* 🚀 BAŞLAT */
updatePomo();
render();
