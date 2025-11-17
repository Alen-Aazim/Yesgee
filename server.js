
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;
const DB_FILE = path.join(__dirname, 'products-db.json');

app.use(bodyParser.json());
app.use(express.static(__dirname));

// Initialize database file if it doesn't exist
async function initDB() {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify({ products: [] }));
  }
}

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    const db = JSON.parse(data);
    res.json(db.products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read products' });
  }
});

// Save products
app.post('/api/products', async (req, res) => {
  try {
    const products = req.body;
    await fs.writeFile(DB_FILE, JSON.stringify({ products }, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save products' });
  }
});

// Get cart (per session - this is still local for demo purposes)
app.get('/api/cart', async (req, res) => {
  res.json([]);
});

// Serve-side product management routes
app.use(bodyParser.urlencoded({ extended: true }));

// Display products management page
app.get('/admin/products-server', async (req, res) => {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    const db = JSON.parse(data);
    const products = db.products;
    
    let html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Manage Products (Server-Side)</title>
  <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
  <header class="site-header container">
    <a class="logo" href="dashboard.html">Admin — Products (Server-Side)</a>
    <nav class="nav">
      <a href="dashboard.html">Dashboard</a>
      <a href="/admin/products.html">JS Version</a>
    </nav>
  </header>

  <main class="container admin-products">
    <h1>Products Management (No JavaScript)</h1>
    
    <form method="POST" action="/admin/products-server/save" class="product-form">
      <input name="id" type="hidden" value="">
      <label>Title<input name="title" required></label>
      <label>Category<input name="category"></label>
      <label>Price<input name="price" type="number" step="0.01" required></label>
      <label>Image URL<input name="image"></label>
      <label>Description<textarea name="description"></textarea></label>
      <div class="form-actions">
        <button class="btn" type="submit">Save Product</button>
      </div>
    </form>

    <h2>Existing Products</h2>
    <div class="grid">
    ${products.map(p => `
      <div class="card">
        <img src="${p.image}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px">
        <h4>${p.title}</h4>
        <p>₹${p.price} · ${p.category}</p>
        <p style="font-size:0.9em;color:var(--muted)">${p.description || ''}</p>
        <div style="display:flex;gap:8px;margin-top:8px">
          <form method="GET" action="/admin/products-server/edit/${p.id}" style="margin:0">
            <button class="btn" type="submit">Edit</button>
          </form>
          <form method="POST" action="/admin/products-server/delete/${p.id}" style="margin:0" onsubmit="return confirm('Delete this product?')">
            <button class="btn" type="submit">Delete</button>
          </form>
        </div>
      </div>
    `).join('')}
    </div>
  </main>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    res.status(500).send('Error loading products');
  }
});

// Edit product page
app.get('/admin/products-server/edit/:id', async (req, res) => {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    const db = JSON.parse(data);
    const product = db.products.find(p => p.id === req.params.id);
    
    if (!product) {
      return res.redirect('/admin/products-server');
    }
    
    let html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Edit Product</title>
  <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
  <header class="site-header container">
    <a class="logo" href="dashboard.html">Admin — Edit Product</a>
    <nav class="nav">
      <a href="/admin/products-server">Back to Products</a>
    </nav>
  </header>

  <main class="container admin-products">
    <h1>Edit Product</h1>
    
    <form method="POST" action="/admin/products-server/save" class="product-form">
      <input name="id" type="hidden" value="${product.id}">
      <label>Title<input name="title" value="${product.title}" required></label>
      <label>Category<input name="category" value="${product.category}"></label>
      <label>Price<input name="price" type="number" step="0.01" value="${product.price}" required></label>
      <label>Image URL<input name="image" value="${product.image}"></label>
      <label>Description<textarea name="description">${product.description || ''}</textarea></label>
      <div class="form-actions">
        <button class="btn" type="submit">Update Product</button>
        <a href="/admin/products-server" class="btn">Cancel</a>
      </div>
    </form>
  </main>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    res.status(500).send('Error loading product');
  }
});

// Save product (create or update)
app.post('/admin/products-server/save', async (req, res) => {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    const db = JSON.parse(data);
    
    const id = req.body.id || ('p' + Date.now());
    const product = {
      id,
      title: req.body.title,
      category: req.body.category || '',
      price: parseFloat(req.body.price) || 0,
      image: req.body.image || '/assets/images/placeholder.jpg',
      description: req.body.description || ''
    };
    
    const existingIndex = db.products.findIndex(p => p.id === id);
    if (existingIndex >= 0) {
      db.products[existingIndex] = product;
    } else {
      db.products.unshift(product);
    }
    
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
    res.redirect('/admin/products-server');
  } catch (error) {
    res.status(500).send('Error saving product');
  }
});

// Delete product
app.post('/admin/products-server/delete/:id', async (req, res) => {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    const db = JSON.parse(data);
    
    db.products = db.products.filter(p => p.id !== req.params.id);
    
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
    res.redirect('/admin/products-server');
  } catch (error) {
    res.status(500).send('Error deleting product');
  }
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
});
