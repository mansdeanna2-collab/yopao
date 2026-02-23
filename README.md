# yopao

Stamp store e-commerce website with MySQL database backend and local image storage.

## Database Setup

- **Host**: `127.0.0.1`
- **Port**: `3306`
- **Database**: `yopao`
- **User**: `yopao`

### 1. Create database tables

```bash
mysql -u yopao -p -h 127.0.0.1 yopao < db/schema.sql
```

### 2. Set database password environment variable

```bash
export DB_PASS="your_database_password"
```

### 3. Import product data into MySQL

```bash
pip install mysql-connector-python && python3 scripts/import_to_mysql.py
```

### 4. Download product images to local storage

```bash
python3 scripts/download_images.py
```

This downloads all external product images to `images/products/` and generates `products_data_local.json` with local paths.

## Configuration

Database connection settings are in `db/config.php`. All settings can be overridden via environment variables:

| Variable  | Default          | Description       |
|-----------|------------------|-------------------|
| `DB_HOST` | `127.0.0.1`      | MySQL server host |
| `DB_PORT` | `3306`           | MySQL server port |
| `DB_NAME` | `yopao`          | Database name     |
| `DB_USER` | `yopao`          | Database username |
| `DB_PASS` | `6ffc39ea3c3a285d` | Database password |

## API Endpoints

The PHP API (`api/products.php`) provides:

- `GET /api/products.php?action=list` — List all products
- `GET /api/products.php?action=list&category=Flag+Series` — Filter by category
- `GET /api/products.php?action=get&slug=xxx` — Get single product by slug
- `GET /api/products.php?action=search&q=keyword` — Search products

The frontend pages (`category/` and `product/`) automatically use the API when available, with fallback to the static `products_data.json` file.