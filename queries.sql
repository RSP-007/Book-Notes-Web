CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  title TEXT,
  author TEXT,
  rating INT,
  notes TEXT,
  cover_url TEXT,
  date_read DATE
);
