"""
Builds benchmark/benchmark.db: the same schema as company.db, but with enough
data (40 customers, 25 products, 400 orders) for accuracy results to mean something.
Deterministic: running it again always produces the identical database.

Run from the project root:
    python benchmark/seed_benchmark_db.py
"""
import itertools
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "benchmark.db"
random.seed(42)

FIRST = ["Aarav", "Diya", "Rohan", "Ananya", "Vihaan", "Isha", "Kabir", "Meera",
         "Arjun", "Saanvi", "Aditya", "Riya", "Karan", "Priya", "Neha", "Rahul",
         "Sneha", "Varun", "Tanvi", "Yash"]
LAST = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Reddy", "Nair", "Mehta", "Iyer", "Khan"]

# (city, how many customers live there)
CITY_COUNTS = [("Delhi", 8), ("Mumbai", 7), ("Bangalore", 6), ("Chennai", 5), ("Hyderabad", 4),
               ("Pune", 3), ("Kolkata", 3), ("Jaipur", 2), ("Lucknow", 2)]

PRODUCTS = [
    ("Laptop Pro", "Electronics", 1200.0), ("Wireless Headphones", "Electronics", 150.0),
    ("Smartphone X", "Electronics", 800.0), ("Tablet Air", "Electronics", 450.0),
    ("Smartwatch", "Electronics", 220.0), ("Bluetooth Speaker", "Electronics", 90.0),
    ("Office Chair", "Furniture", 180.0), ("Standing Desk", "Furniture", 520.0),
    ("Bookshelf", "Furniture", 130.0), ("Floor Lamp", "Furniture", 65.0),
    ("Notebook Pack", "Stationery", 12.0), ("Gel Pens", "Stationery", 8.0),
    ("Desk Organizer", "Stationery", 25.0), ("Whiteboard", "Stationery", 70.0),
    ("Running Shoes", "Clothing", 95.0), ("Denim Jacket", "Clothing", 85.0),
    ("Cotton T-Shirt", "Clothing", 20.0), ("Backpack", "Clothing", 55.0),
    ("Blender", "Kitchen", 75.0), ("Air Fryer", "Kitchen", 110.0),
    ("Coffee Maker", "Kitchen", 60.0), ("Knife Set", "Kitchen", 45.0),
    ("Water Bottle", "Kitchen", 15.0), ("Lunch Box", "Kitchen", 18.0), ("Toaster", "Kitchen", 35.0),
]
NEVER_ORDERED = {"Toaster", "Lunch Box", "Knife Set", "Whiteboard"}
CUSTOMERS_WITHOUT_ORDERS = 6


def main():
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript("""
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, city TEXT);
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT, price REAL);
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER, product_id INTEGER, order_date TEXT, quantity INTEGER,
            FOREIGN KEY (customer_id) REFERENCES customers (id),
            FOREIGN KEY (product_id) REFERENCES products (id));
    """)

    names = random.sample(list(itertools.product(FIRST, LAST)), 40)
    cities = [c for c, n in CITY_COUNTS for _ in range(n)]
    random.shuffle(cities)
    for (first, last), city in zip(names, cities):
        conn.execute("INSERT INTO customers (name, email, city) VALUES (?, ?, ?)",
                     (f"{first} {last}", f"{first}.{last}@example.com".lower(), city))

    conn.executemany("INSERT INTO products (name, category, price) VALUES (?, ?, ?)", PRODUCTS)

    customer_ids = [r[0] for r in conn.execute("SELECT id FROM customers")]
    active_customers = customer_ids[: len(customer_ids) - CUSTOMERS_WITHOUT_ORDERS]
    active_products = [r[0] for r in conn.execute("SELECT id, name FROM products")
                       if r[1] not in NEVER_ORDERED]
    weights = [random.randint(1, 8) for _ in active_products]  # some products sell more than others

    start = date(2026, 1, 1)
    span = (date(2026, 9, 30) - start).days
    orders = []
    for _ in range(400):
        d = start + timedelta(days=random.randint(0, span))
        orders.append((random.choice(active_customers),
                       random.choices(active_products, weights)[0],
                       d.isoformat(), random.randint(1, 5)))
    orders.sort(key=lambda o: o[2])
    conn.executemany(
        "INSERT INTO orders (customer_id, product_id, order_date, quantity) VALUES (?, ?, ?, ?)", orders)
    conn.commit()

    for t in ("customers", "products", "orders"):
        print(t, conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0], "rows")
    conn.close()
    print("Created", DB_PATH)


if __name__ == "__main__":
    main() 
