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
  database: "books",
  password: "",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// HOME - show all books
app.get("/", async (req, res) => {
  try {
    let sort = req.query.sort;

    let query = "SELECT * FROM books";

    if (sort === "rating") {
      query += " ORDER BY rating DESC NULLS LAST";
    } else if (sort === "date") {
      query += " ORDER BY date_read DESC NULLS LAST";
    } else {
      query += " ORDER BY id DESC";
    }

    const result = await db.query(query);
    res.render("index", { books: result.rows });

  } catch (err) {
    console.log(err);
    res.send("Error loading books");
  }
});

// ADD BOOK
app.post("/add", async (req, res) => {
  let { title, author, rating, notes, date } = req.body;

  // 🔥 FIX: handle empty rating
  rating = rating ? parseInt(rating) : null;

  try {
    // Fetch book cover
    const response = await axios.get(
      `https://openlibrary.org/search.json?title=${title}`
    );

    let coverUrl = "";
    if (response.data.docs.length > 0 && response.data.docs[0].cover_i) {
      const coverId = response.data.docs[0].cover_i;
      coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
    }

    await db.query(
      "INSERT INTO books (title, author, rating, notes, cover_url, date_read) VALUES ($1,$2,$3,$4,$5,$6)",
      [title, author, rating, notes, coverUrl, date || null]
    );

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.send("Error adding book");
  }
});

// DELETE BOOK
app.post("/delete", async (req, res) => {
  try {
    const id = req.body.id;
    await db.query("DELETE FROM books WHERE id=$1", [id]);
    res.redirect("/");
  } catch (err) {
    console.log(err);
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
    console.log(err);
    res.send("Error loading edit page");
  }
});

// UPDATE BOOK
app.post("/update", async (req, res) => {
  let { id, title, author, rating, notes } = req.body;

  // 🔥 FIX: handle empty rating here too
  rating = rating ? parseInt(rating) : null;

  try {
    await db.query(
      "UPDATE books SET title=$1, author=$2, rating=$3, notes=$4 WHERE id=$5",
      [title, author, rating, notes, id]
    );

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.send("Error updating book");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});