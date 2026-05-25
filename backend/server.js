const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

/* ======================
   🗄️ SQLite BAĞLANTI
====================== */
const db = new Database(path.join(__dirname, "data", "pomodoro.db"));

// Tabloları oluştur (yoksa)
db.exec(`
  CREATE TABLE IF NOT EXISTS TaskPool (
    Id   INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS WeeklyTask (
    Id          INTEGER PRIMARY KEY AUTOINCREMENT,
    TaskPoolId  INTEGER NOT NULL,
    TaskDate    TEXT NOT NULL,
    IsDone      INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (TaskPoolId) REFERENCES TaskPool(Id)
  );
`);

// IsPostponed kolonu yoksa ekle (migration)
try {
  db.exec("ALTER TABLE WeeklyTask ADD COLUMN IsPostponed INTEGER NOT NULL DEFAULT 0");
} catch(e) { /* zaten var */ }

// DayPostponed tablosu — gün bazlı erteleme
db.exec(`
  CREATE TABLE IF NOT EXISTS DayPostponed (
    Date TEXT PRIMARY KEY,
    IsPostponed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS RecurringTask (
    Id         INTEGER PRIMARY KEY AUTOINCREMENT,
    TaskPoolId INTEGER NOT NULL,
    Weekday    INTEGER NOT NULL,
    FOREIGN KEY (TaskPoolId) REFERENCES TaskPool(Id)
  );

  CREATE TABLE IF NOT EXISTS PomodoroSession (
    Id         INTEGER PRIMARY KEY AUTOINCREMENT,
    TaskPoolId INTEGER NOT NULL,
    Duration   INTEGER NOT NULL,
    CreatedAt  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (TaskPoolId) REFERENCES TaskPool(Id)
  );
`);

console.log("✅ SQLite veritabanı hazır");

/* ======================
   🌐 FRONTEND DOSYALARI
====================== */
app.use(express.static(path.join(__dirname, "public")));

/* ======================
   📦 TASK POOL
====================== */
app.post("/taskpool", (req, res) => {
  const { name, time } = req.body;
  if (!name || !time)
    return res.status(400).json({ error: "name ve time zorunlu" });

  const stmt = db.prepare("INSERT INTO TaskPool (Name, Time) VALUES (?, ?)");
  stmt.run(name, time);
  res.json({ message: "Görev eklendi" });
});

app.get("/taskpool", (req, res) => {
  const rows = db.prepare("SELECT * FROM TaskPool").all();
  res.json(rows);
});

app.delete("/taskpool-reset", (req, res) => {
  db.prepare("DELETE FROM WeeklyTask").run();
  db.prepare("DELETE FROM PomodoroSession").run();
  db.prepare("DELETE FROM RecurringTask").run();
  db.prepare("DELETE FROM TaskPool").run();
  res.json({ message: "Tüm görevler silindi" });
});

app.put("/taskpool/:id", (req, res) => {
  const { name, time } = req.body;
  if (!name || !time)
    return res.status(400).json({ error: "name ve time zorunlu" });
  db.prepare("UPDATE TaskPool SET Name = ?, Time = ? WHERE Id = ?").run(name, time, req.params.id);
  res.json({ message: "Görev güncellendi" });
});

app.delete("/taskpool/:id", (req, res) => {
  db.prepare("DELETE FROM WeeklyTask WHERE TaskPoolId = ?").run(req.params.id);
  db.prepare("DELETE FROM RecurringTask WHERE TaskPoolId = ?").run(req.params.id);
  db.prepare("DELETE FROM PomodoroSession WHERE TaskPoolId = ?").run(req.params.id);
  db.prepare("DELETE FROM TaskPool WHERE Id = ?").run(req.params.id);
  res.json({ message: "Görev silindi" });
});

/* ======================
   📅 WEEKLY TASK
====================== */
app.post("/weekly", (req, res) => {
  const { taskPoolId, date } = req.body;
  const stmt = db.prepare(
    "INSERT INTO WeeklyTask (TaskPoolId, TaskDate) VALUES (?, ?)"
  );
  stmt.run(taskPoolId, date);
  res.json({ message: "Haftalık görev eklendi" });
});

app.get("/weekly", (req, res) => {
  const { start, end } = req.query;
  const rows = db.prepare(`
    SELECT
      w.Id,
      w.TaskDate,
      w.IsDone,
      t.Name,
      t.Time
    FROM WeeklyTask w
    JOIN TaskPool t ON t.Id = w.TaskPoolId
    WHERE w.TaskDate BETWEEN ? AND ?
    ORDER BY w.TaskDate, t.Time
  `).all(start, end);

  // Ertelenen günleri de getir
  const postponed = db.prepare(
    "SELECT Date FROM DayPostponed WHERE IsPostponed = 1 AND Date BETWEEN ? AND ?"
  ).all(start, end).map(r => r.Date);

  res.json({ tasks: rows, postponedDays: postponed });
});

app.put("/weekly/:id", (req, res) => {
  const { done } = req.body;
  db.prepare("UPDATE WeeklyTask SET IsDone = ? WHERE Id = ?")
    .run(done ? 1 : 0, req.params.id);
  res.json({ message: "Durum güncellendi" });
});

app.delete("/weekly/:id", (req, res) => {
  db.prepare("DELETE FROM WeeklyTask WHERE Id = ?").run(req.params.id);
  res.json({ message: "Görev silindi" });
});

app.delete("/weekly/day/:date", (req, res) => {
  db.prepare("DELETE FROM WeeklyTask WHERE TaskDate = ?").run(req.params.date);
  res.json({ message: "Gün silindi" });
});

// Gün erteleme
app.post("/postpone/:date", (req, res) => {
  const { date } = req.params;
  db.prepare("INSERT OR REPLACE INTO DayPostponed (Date, IsPostponed) VALUES (?, 1)").run(date);
  res.json({ message: "Gün ertelendi" });
});

app.delete("/postpone/:date", (req, res) => {
  const { date } = req.params;
  db.prepare("DELETE FROM DayPostponed WHERE Date = ?").run(date);
  res.json({ message: "Erteleme kaldırıldı" });
});

app.get("/postpone", (req, res) => {
  const { start, end } = req.query;
  const rows = db.prepare(
    "SELECT Date FROM DayPostponed WHERE IsPostponed = 1 AND Date BETWEEN ? AND ?"
  ).all(start, end);
  res.json(rows.map(r => r.Date));
});

app.put("/weekly/:id/move", (req, res) => {
  const { date } = req.body;
  db.prepare("UPDATE WeeklyTask SET TaskDate = ? WHERE Id = ?")
    .run(date, req.params.id);
  res.json({ message: "Görev taşındı" });
});

/* ======================
   🔁 RECURRING TASK
====================== */
app.post("/recurring", (req, res) => {
  const { taskPoolId, weekday } = req.body;
  db.prepare("INSERT INTO RecurringTask (TaskPoolId, Weekday) VALUES (?, ?)")
    .run(taskPoolId, weekday);
  res.json({ message: "Recurring görev eklendi" });
});

app.get("/recurring", (req, res) => {
  const rows = db.prepare(`
    SELECT r.Id, r.Weekday, t.Name, t.Time
    FROM RecurringTask r
    JOIN TaskPool t ON t.Id = r.TaskPoolId
  `).all();
  res.json(rows);
});

app.delete("/recurring/:id", (req, res) => {
  db.prepare("DELETE FROM RecurringTask WHERE Id = ?").run(req.params.id);
  res.json({ message: "Tekrarlayan görev silindi" });
});

app.post("/recurring/generate", (req, res) => {
  const { weekStart, weeks } = req.body;
  if (!weekStart)
    return res.status(400).json({ error: "weekStart zorunlu" });

  const totalWeeks = weeks || 1;
  const start = new Date(weekStart);

  const getRecurring = db.prepare(
    "SELECT * FROM RecurringTask WHERE Weekday = ?"
  );
  const checkExists = db.prepare(
    "SELECT 1 FROM WeeklyTask WHERE TaskPoolId = ? AND TaskDate = ?"
  );
  const insertWeekly = db.prepare(
    "INSERT INTO WeeklyTask (TaskPoolId, TaskDate) VALUES (?, ?)"
  );

  const generate = db.transaction(() => {
    for (let w = 0; w < totalWeeks; w++) {
      for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + i);
        const weekday = day.getDay();
        const dateStr = day.toISOString().split("T")[0];

        const tasks = getRecurring.all(weekday);
        for (const r of tasks) {
          const exists = checkExists.get(r.TaskPoolId, dateStr);
          if (!exists) insertWeekly.run(r.TaskPoolId, dateStr);
        }
      }
    }
  });

  generate();
  res.json({ message: `${totalWeeks} haftalık görevler eklendi` });
});

/* ======================
   🍅 POMODORO
====================== */
app.post("/pomodoro", (req, res) => {
  const { taskPoolId, duration } = req.body;
  db.prepare(
    "INSERT INTO PomodoroSession (TaskPoolId, Duration) VALUES (?, ?)"
  ).run(taskPoolId, duration);
  res.json({ message: "Pomodoro kaydedildi" });
});

app.get("/pomodoro/stats", (req, res) => {
  const rows = db.prepare(`
    SELECT
      t.Name,
      COUNT(p.Id)   AS SessionCount,
      SUM(p.Duration) AS TotalMinutes
    FROM PomodoroSession p
    JOIN TaskPool t ON t.Id = p.TaskPoolId
    GROUP BY t.Name
  `).all();
  res.json(rows);
});

/* ======================
   🔀 SPA FALLBACK
====================== */
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ======================
   🚀 SERVER START
====================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API çalışıyor: http://localhost:${PORT}`);
});
