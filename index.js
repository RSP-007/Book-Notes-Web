import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;

// DB connection
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "",
  password: "",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Helper: parse rating safely
const parseRating = (rating) => (rating ? parseInt(rating) : null);

// HOME - show all books with optional search & sort
app.get("/", async (req, res) => {
  try {
    const { sort, search } = req.query;

    let baseQuery = "SELECT * FROM books";
    const conditions = [];
    const values = [];

    if (search) {
      conditions.push("(LOWER(title) LIKE $1 OR LOWER(author) LIKE $1)");
      values.push(`%${search.toLowerCase()}%`);
    }

    if (conditions.length) {
      baseQuery += " WHERE " + conditions.join(" AND ");
    }

    if (sort === "rating") {
      baseQuery += " ORDER BY rating DESC NULLS LAST";
    } else if (sort === "date") {
      baseQuery += " ORDER BY date_read DESC NULLS LAST";
    } else {
      baseQuery += " ORDER BY id DESC";
    }

    const result = await db.query(baseQuery, values);
    res.render("index", { books: result.rows });
  } catch (err) {
    console.error(err);
    res.send("Error loading books");
  }
});

// ADD BOOK
app.post("/add", async (req, res) => {
  const { title, author, notes, date } = req.body;
  const rating = parseRating(req.body.rating);

  try {
    const { data } = await axios.get(
      `https://openlibrary.org/search.json?title=${title}`
    );

    let coverUrl = "";
    if (data.docs?.[0]?.cover_i) {
      coverUrl = `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`;
    }

    await db.query(
      "INSERT INTO books (title, author, rating, notes, cover_url, date_read) VALUES ($1,$2,$3,$4,$5,$6)",
      [title, author, rating, notes, coverUrl, date || null]
    );

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Error adding book");
  }
});

// DELETE BOOK
app.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;
    await db.query("DELETE FROM books WHERE id=$1", [id]);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Error deleting book");
  }
});

// EDIT PAGE
app.get("/edit/:id", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books WHERE id=$1", [
      req.params.id,
    ]);
    res.render("edit", { book: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.send("Error loading edit page");
  }
});

// UPDATE BOOK
app.post("/update", async (req, res) => {
  const { id, title, author, notes } = req.body;
  const rating = parseRating(req.body.rating);

  try {
    await db.query(
      "UPDATE books SET title=$1, author=$2, rating=$3, notes=$4 WHERE id=$5",
      [title, author, rating, notes, id]
    );
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Error updating book");
  }
});

// STATS PAGE
app.get("/stats", async (req, res) => {
  try {
    const [totalRes, avgRes, topRes, recentRes, authorsRes, mostAuthorRes] = await Promise.all([
      db.query("SELECT COUNT(*) FROM books"),
      db.query("SELECT AVG(rating) FROM books"),
      db.query("SELECT * FROM books ORDER BY rating DESC LIMIT 1"),
      db.query("SELECT * FROM books ORDER BY date_read DESC LIMIT 1"),
      db.query("SELECT COUNT(DISTINCT author) FROM books"),
      db.query(`
        SELECT author, COUNT(*) as count
        FROM books
        GROUP BY author
        ORDER BY count DESC
        LIMIT 1
      `),
    ]);

    res.render("stats", {
      total: totalRes.rows[0].count,
      avg: avgRes.rows[0].avg,
      top: topRes.rows[0],
      recent: recentRes.rows[0],
      authors: authorsRes.rows[0].count,
      mostAuthor: mostAuthorRes.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading stats");
  }
});

// BOOK DETAIL PAGE
app.get("/book/:id", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books WHERE id=$1", [
      req.params.id,
    ]);
    res.render("book", { book: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.send("Error loading book");
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});