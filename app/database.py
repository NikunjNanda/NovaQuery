import sqlite3

def init_db():
    conn = sqlite3.connect("company.db")
    cursor = conn.cursor()

    # Create Tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        city TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        price REAL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        product_id INTEGER,
        order_date TEXT,
        quantity INTEGER,
        FOREIGN KEY(customer_id) REFERENCES customers(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )
    """)

    # Seed Sample Data if empty
    cursor.execute("SELECT COUNT(*) FROM customers")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("INSERT INTO customers (name, email, city) VALUES (?, ?, ?)", [
            ("Nikunj Nanda", "nikunj@example.com", "Delhi"),
            ("Aarav Sharma", "aarav@example.com", "Mumbai"),
            ("Priya Patel", "priya@example.com", "Bangalore")
        ])

        cursor.executemany("INSERT INTO products (name, category, price) VALUES (?, ?, ?)", [
            ("Laptop Pro", "Electronics", 1200.00),
            ("Wireless Headphones", "Electronics", 150.00),
            ("Ergonomic Chair", "Furniture", 250.00)
        ])

        cursor.executemany("INSERT INTO orders (customer_id, product_id, order_date, quantity) VALUES (?, ?, ?, ?)", [
            (1, 1, "2026-08-01", 1),
            (1, 2, "2026-08-05", 2),
            (2, 3, "2026-08-10", 1)
        ])

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")

