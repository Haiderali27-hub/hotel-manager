use rusqlite::{Connection, Result as SqliteResult};

struct Migration {
    version: i32,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "create_unified_module_tables",
        sql: r#"
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(admin_id, role_id),
    FOREIGN KEY (admin_id) REFERENCES admin_auth(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES shared_roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS retail_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER,
    sku TEXT,
    barcode TEXT,
    is_track_stock INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS retail_suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS retail_inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_cost REAL,
    reference_type TEXT,
    reference_id INTEGER,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hotel_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER,
    room_number TEXT NOT NULL UNIQUE,
    room_type TEXT NOT NULL,
    base_rate REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS hotel_guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    id_document TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS hotel_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_room_id INTEGER NOT NULL,
    hotel_guest_id INTEGER,
    check_in_date TEXT NOT NULL,
    check_out_date TEXT NOT NULL,
    nightly_rate REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'reserved',
    source TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_room_id) REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
    FOREIGN KEY (hotel_guest_id) REFERENCES hotel_guests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER,
    table_code TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    area TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS restaurant_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    restaurant_table_id INTEGER,
    customer_name TEXT,
    order_status TEXT NOT NULL DEFAULT 'open',
    subtotal REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
    FOREIGN KEY (restaurant_table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS restaurant_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_order_id INTEGER NOT NULL,
    menu_item_id INTEGER,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    notes TEXT,
    FOREIGN KEY (restaurant_order_id) REFERENCES restaurant_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS salon_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salon_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    duration_minutes INTEGER NOT NULL,
    base_price REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salon_appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    salon_service_id INTEGER NOT NULL,
    salon_staff_id INTEGER,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (salon_service_id) REFERENCES salon_services(id) ON DELETE RESTRICT,
    FOREIGN KEY (salon_staff_id) REFERENCES salon_staff(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cafe_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER,
    table_code TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cafe_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    cafe_table_id INTEGER,
    order_status TEXT NOT NULL DEFAULT 'open',
    subtotal REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
    FOREIGN KEY (cafe_table_id) REFERENCES cafe_tables(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cafe_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cafe_order_id INTEGER NOT NULL,
    menu_item_id INTEGER,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    notes TEXT,
    FOREIGN KEY (cafe_order_id) REFERENCES cafe_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO shared_roles (key, name) VALUES
    ('owner', 'Owner'),
    ('manager', 'Manager'),
    ('cashier', 'Cashier'),
    ('staff', 'Staff');
"#,
    },
    Migration {
        version: 2,
        name: "add_business_mode_scoping",
        sql: r#"
ALTER TABLE sales ADD COLUMN business_mode TEXT;
ALTER TABLE expenses ADD COLUMN business_mode TEXT;

UPDATE sales
SET business_mode = COALESCE(
    NULLIF((SELECT value FROM settings WHERE key = 'business_mode' LIMIT 1), ''),
    'hotel'
)
WHERE business_mode IS NULL OR TRIM(business_mode) = '';

UPDATE expenses
SET business_mode = COALESCE(
    NULLIF((SELECT value FROM settings WHERE key = 'business_mode' LIMIT 1), ''),
    'hotel'
)
WHERE business_mode IS NULL OR TRIM(business_mode) = '';

UPDATE sales SET business_mode = 'hotel' WHERE LOWER(TRIM(COALESCE(business_mode, ''))) IN ('restaurant', 'hospitality');

CREATE INDEX IF NOT EXISTS idx_sales_business_mode_created_at ON sales(business_mode, created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_business_mode_date ON expenses(business_mode, date);
"#,
    },
    Migration {
        version: 3,
        name: "add_business_mode_to_core_entities",
        sql: r#"
ALTER TABLE customers ADD COLUMN business_mode TEXT;
ALTER TABLE resources ADD COLUMN business_mode TEXT;
ALTER TABLE menu_items ADD COLUMN business_mode TEXT;

UPDATE customers
SET business_mode = COALESCE(
    NULLIF((SELECT value FROM settings WHERE key = 'business_mode' LIMIT 1), ''),
    'hotel'
)
WHERE business_mode IS NULL OR TRIM(business_mode) = '';

UPDATE resources
SET business_mode = COALESCE(
    NULLIF((SELECT value FROM settings WHERE key = 'business_mode' LIMIT 1), ''),
    'hotel'
)
WHERE business_mode IS NULL OR TRIM(business_mode) = '';

UPDATE menu_items
SET business_mode = COALESCE(
    NULLIF((SELECT value FROM settings WHERE key = 'business_mode' LIMIT 1), ''),
    'hotel'
)
WHERE business_mode IS NULL OR TRIM(business_mode) = '';

CREATE INDEX IF NOT EXISTS idx_customers_business_mode ON customers(business_mode);
CREATE INDEX IF NOT EXISTS idx_resources_business_mode ON resources(business_mode);
CREATE INDEX IF NOT EXISTS idx_menu_items_business_mode ON menu_items(business_mode);
"#,
    },
];

pub fn run_migrations(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    for migration in MIGRATIONS {
        let already_applied = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
            [migration.version],
            |row| row.get::<_, i32>(0),
        )?;

        if already_applied == 1 {
            continue;
        }

        if let Err(err) = conn.execute_batch(migration.sql) {
            // Allow idempotent ALTER TABLE behavior on existing databases where columns are already present.
            let msg = err.to_string().to_lowercase();
            let ignorable = (migration.version == 2 || migration.version == 3)
                && (msg.contains("duplicate column name") || msg.contains("already exists"));
            if !ignorable {
                return Err(err);
            }
        }
        conn.execute(
            "INSERT INTO schema_migrations (version, name) VALUES (?1, ?2)",
            (migration.version, migration.name),
        )?;
    }

    Ok(())
}
