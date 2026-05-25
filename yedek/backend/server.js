const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* ======================
   🔌 SQL CONFIG
====================== */
const dbConfig = {
  user: "sa",
  password: "129211",
  server: "HAMZAPC\\SQLEXPRESS",
  database: "PomodoroTodo",
  options: {
    trustServerCertificate: true,
    encrypt: false
  }
};

sql.connect(dbConfig)
  .then(() => console.log("✅ SQL Server bağlandı"))
  .catch(err => console.log("❌ SQL bağlantı hatası:", err));

/* ======================
   📦 TASK POOL
====================== */
app.post("/taskpool", async (req, res) => {
  const { name, time } = req.body;
  if (!name || !time)
    return res.status(400).json({ error: "name ve time zorunlu" });

  await sql.query`
    INSERT INTO TaskPool (Name, Time)
    VALUES (${name}, ${time})
  `;
  res.json({ message: "Görev eklendi" });
});

app.get("/taskpool", async (req, res) => {
  const result = await sql.query("SELECT * FROM TaskPool");
  res.json(result.recordset);
});

/* ======================
   📅 WEEKLY TASK
====================== */
app.post("/weekly", async (req, res) => {
  const { taskPoolId, date } = req.body;

  await sql.query`
    INSERT INTO WeeklyTask (TaskPoolId, TaskDate)
    VALUES (${taskPoolId}, ${date})
  `;
  res.json({ message: "Haftalık görev eklendi" });
});

app.get("/weekly", async (req, res) => {
  const { start, end } = req.query;

  const result = await sql.query`
    SELECT 
      w.Id,
      w.TaskDate,
      w.IsDone,
      t.Name,
      t.Time
    FROM WeeklyTask w
    JOIN TaskPool t ON t.Id = w.TaskPoolId
    WHERE w.TaskDate BETWEEN ${start} AND ${end}
    ORDER BY w.TaskDate, t.Time
  `;
  res.json(result.recordset);
});

app.put("/weekly/:id", async (req, res) => {
  const { done } = req.body;

  await sql.query`
    UPDATE WeeklyTask
    SET IsDone = ${done}
    WHERE Id = ${req.params.id}
  `;
  res.json({ message: "Durum güncellendi" });
});

app.delete("/weekly/:id", async (req, res) => {
  await sql.query`
    DELETE FROM WeeklyTask
    WHERE Id = ${req.params.id}
  `;
  res.json({ message: "Görev silindi" });
});

/* ======================
   🔁 RECURRING TASK
====================== */
app.post("/recurring", async (req, res) => {
  const { taskPoolId, weekday } = req.body;

  await sql.query`
    INSERT INTO RecurringTask (TaskPoolId, Weekday)
    VALUES (${taskPoolId}, ${weekday})
  `;
  res.json({ message: "Recurring görev eklendi" });
});

app.get("/recurring", async (req, res) => {
  const result = await sql.query`
    SELECT 
      r.Id,
      r.Weekday,
      t.Name,
      t.Time
    FROM RecurringTask r
    JOIN TaskPool t ON t.Id = r.TaskPoolId
  `;
  res.json(result.recordset);
});

/* 🔥 1 HAFTA / 3 AY / N HAFTA DESTEKLİ */
app.post("/recurring/generate", async (req, res) => {
  const { weekStart, weeks } = req.body;
  if (!weekStart)
    return res.status(400).json({ error: "weekStart zorunlu" });

  const totalWeeks = weeks || 1;
  const start = new Date(weekStart);

  for (let w = 0; w < totalWeeks; w++) {
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + (w * 7) + i);

      const weekday = day.getDay();
      const dateStr = day.toISOString().split("T")[0];

      const recurringTasks = await sql.query`
        SELECT * FROM RecurringTask
        WHERE Weekday = ${weekday}
      `;

      for (const r of recurringTasks.recordset) {
        const exists = await sql.query`
          SELECT 1 FROM WeeklyTask
          WHERE TaskPoolId = ${r.TaskPoolId}
          AND TaskDate = ${dateStr}
        `;

        if (exists.recordset.length === 0) {
          await sql.query`
            INSERT INTO WeeklyTask (TaskPoolId, TaskDate)
            VALUES (${r.TaskPoolId}, ${dateStr})
          `;
        }
      }
    }
  }

  res.json({ message: `${totalWeeks} haftalık görevler eklendi` });
});

/* ======================
   🍅 POMODORO
====================== */
app.post("/pomodoro", async (req, res) => {
  const { taskPoolId, duration } = req.body;

  await sql.query`
    INSERT INTO PomodoroSession (TaskPoolId, Duration)
    VALUES (${taskPoolId}, ${duration})
  `;
  res.json({ message: "Pomodoro kaydedildi" });
});

app.get("/pomodoro/stats", async (req, res) => {
  const result = await sql.query`
    SELECT 
      t.Name,
      COUNT(p.Id) AS SessionCount,
      SUM(p.Duration) AS TotalMinutes
    FROM PomodoroSession p
    JOIN TaskPool t ON t.Id = p.TaskPoolId
    GROUP BY t.Name
  `;
  res.json(result.recordset);
});

/* ======================
   🚀 SERVER START
====================== */
app.listen(3000, () => {
  console.log("🚀 API çalışıyor: http://localhost:3000");
});
