// server/src/index.js
require('dotenv').config();
const express = require('express');
const sql = require('mssql/msnodesqlv8');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// DB configuration from .env
const dbConfig = {
  server: process.env.DB_HOST,        // "kittu"  (or "kittu\\SQLEXPRESS" if that's what SSMS shows)
  database: process.env.DB_NAME,      // "ReactAppDB"
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,          // use current Windows user
    trustServerCertificate: true,
    encrypt: false
  }
};
const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect()
  .then(() => console.log('✅ Connected to MSSQL'))
  .catch(err => console.error('❌ DB connection error:', err));

// --- showin string <-> int mapping (Accounts.showin is INT in the DB) ---
// Verify with: SELECT DISTINCT [showin] FROM Accounts;
const SHOWIN_TO_INT = { customer: 1, supplier: 2, both: 3 };
const SHOWIN_FROM_INT = { 1: 'customer', 2: 'supplier', 3: 'both' };

function showinToInt(value) {
  const v = String(value || '').trim().toLowerCase();
  const normalized = v === 'suplier' ? 'supplier' : v;   // accept legacy typo
  return SHOWIN_TO_INT[normalized];                       // undefined if invalid
}
function showinFromInt(value) {
  return SHOWIN_FROM_INT[Number(value)] || String(value ?? '');
}

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    await poolConnect;
    const request = pool.request();
    request.input('user', sql.VarChar, username);
    request.input('pwd', sql.VarChar, password);
    const result = await request.query(`
      SELECT TOP 1 *
      FROM Users
      WHERE username = @user AND password = @pwd
    `);
    if (result.recordset.length === 1) {
      // In production return a signed JWT or session token
      res.json({ success: true, user: result.recordset[0] });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const accountColumns = `
  [code], [name], [doorno], [street], [area], [city],
  [phone], [cell], [mailid], [active], [showin]
`;
const accountOutputColumns = `
  INSERTED.[code], INSERTED.[name], INSERTED.[doorno], INSERTED.[street],
  INSERTED.[area], INSERTED.[city], INSERTED.[phone], INSERTED.[cell],
  INSERTED.[mailid], INSERTED.[active], INSERTED.[showin]
`;

function getAccountValues(body = {}) {
  const { code, name, doorno, street, area, city, phone, cell, mailid, active, showin } = body;
  if (!String(code || '').trim() || !String(name || '').trim()) {
    return { error: 'Code and name are required.' };
  }
  const showinInt = showinToInt(showin);
  if (showinInt === undefined) {
    return { error: 'Show in must be customer, supplier, or both.' };
  }
  return {
    values: {
      code: String(code).trim(),
      name: String(name).trim(),
      doorno: String(doorno || '').trim(),
      street: String(street || '').trim(),
      area: String(area || '').trim(),
      city: String(city || '').trim(),
      phone: String(phone || '').trim(),
      cell: String(cell || '').trim(),
      mailid: String(mailid || '').trim(),
      active: Boolean(active),
      showin: showinInt                       // INT — matches the column
    }
  };
}

function addAccountInputs(request, values) {
  request.input('code', sql.NVarChar(100), values.code);
  request.input('name', sql.NVarChar(255), values.name);
  request.input('doorno', sql.NVarChar(255), values.doorno);
  request.input('street', sql.NVarChar(255), values.street);
  request.input('area', sql.NVarChar(255), values.area);
  request.input('city', sql.NVarChar(255), values.city);
  request.input('phone', sql.NVarChar(100), values.phone);
  request.input('cell', sql.NVarChar(100), values.cell);
  request.input('mailid', sql.NVarChar(255), values.mailid);
  request.input('active', sql.Bit, values.active);
  request.input('showin', sql.Int, values.showin);   // was sql.NVarChar(20)
  return request;
}

app.get('/api/accounts', async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();
    const search = String(req.query.search || '').trim();
    request.input('search', sql.NVarChar(255), `%${search}%`);
    const result = await request.query(`
      SELECT TOP 250 ${accountColumns}
      FROM Accounts
      WHERE [showin] IN (1, 2, 3)
        AND (
          [code] LIKE @search OR [name] LIKE @search
        )
      ORDER BY [name], [code]
    `);
    const accounts = result.recordset.map(row => ({
      ...row,
      showin: showinFromInt(row.showin)          // 'customer' | 'supplier' | 'both'
    }));
    res.json({ accounts });
  } catch (err) {
    console.error('Unable to find customer/supplier accounts:', err);
    res.status(500).json({ message: 'Unable to find customer/supplier accounts.' });
  }
});

app.post('/api/accounts', async (req, res) => {
  const parsed = getAccountValues(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  try {
    await poolConnect;
    const request = addAccountInputs(pool.request(), parsed.values);
    const result = await request.query(`
      INSERT INTO Accounts ([code], [name], [doorno], [street], [area], [city], [phone], [cell], [mailid], [active], [showin])
      OUTPUT ${accountOutputColumns}
      VALUES (@code, @name, @doorno, @street, @area, @city, @phone, @cell, @mailid, @active, @showin)
    `);
    const row = result.recordset[0];
    res.status(201).json({
      account: { ...row, showin: showinFromInt(row.showin) }
    });
  } catch (err) {
    console.error('Unable to add customer/supplier account:', err);
    if (err.number === 2601 || err.number === 2627) {
      return res.status(409).json({ message: 'An account with this code already exists.' });
    }
    res.status(500).json({ message: 'Unable to add customer/supplier account.' });
  }
});

app.put('/api/accounts/:code', async (req, res) => {
  const parsed = getAccountValues({ ...req.body, code: req.params.code });
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  try {
    await poolConnect;
    const request = addAccountInputs(pool.request(), parsed.values);
    const result = await request.query(`
      UPDATE Accounts
      SET [name] = @name, [doorno] = @doorno, [street] = @street, [area] = @area,
          [city] = @city, [phone] = @phone, [cell] = @cell, [mailid] = @mailid,
          [active] = @active, [showin] = @showin
      OUTPUT ${accountOutputColumns}
      WHERE [code] = @code
    `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Customer/supplier account not found.' });
    }
    const row = result.recordset[0];
    res.json({
      account: { ...row, showin: showinFromInt(row.showin) }
    });
  } catch (err) {
    console.error('Unable to update customer/supplier account:', err);
    res.status(500).json({ message: 'Unable to update customer/supplier account.' });
  }
});

app.delete('/api/accounts/:code', async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();
    request.input('code', sql.NVarChar(100), req.params.code);
    const result = await request.query('DELETE FROM Accounts WHERE [code] = @code');
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Customer/supplier account not found.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Unable to remove customer/supplier account:', err);
    res.status(500).json({ message: 'Unable to remove customer/supplier account.' });
  }
});

const itemColumns = `
  [Code] AS code, [Name] AS name, [Active] AS active, [Packing] AS packing,
  [Units] AS units, [Company] AS company, [HSNCode] AS hsnCode, [DrugForm] AS drugForm
`;
const itemOutputColumns = `
  INSERTED.[Code] AS code, INSERTED.[Name] AS name, INSERTED.[Active] AS active,
  INSERTED.[Packing] AS packing, INSERTED.[Units] AS units,
  INSERTED.[Company] AS company, INSERTED.[HSNCode] AS hsnCode,
  INSERTED.[DrugForm] AS drugForm
`;

function getItemValues(body = {}) {
  const { code, name, active, packing, units, company, hsnCode, drugForm } =
    body && typeof body === 'object' ? body : {};
  if (!String(code || '').trim() || !String(name || '').trim()) {
    return { error: 'Code and name are required.' };
  }

  const values = {
    code: String(code).trim(),
    name: String(name).trim(),
    active: active === undefined ? true : active,
    packing: packing,
    units: units,
    company: company,
    hsnCode: hsnCode,
    drugForm: drugForm
  };
  const limits = { code: 50, name: 200, packing: 100, units: 50, company: 150, hsnCode: 50, drugForm: 100 };
  for (const [field, limit] of Object.entries(limits)) {
    if (values[field] !== undefined && values[field] !== null) {
      values[field] = String(values[field]).trim();
      if (values[field].length > limit) {
        return { error: `${field} must be ${limit} characters or fewer.` };
      }
      if (!values[field] && field !== 'code' && field !== 'name') {
        values[field] = null;
      }
    } else if (field !== 'code' && field !== 'name') {
      values[field] = null;
    }
  }
  if (typeof values.active !== 'boolean') {
    return { error: 'Active must be true or false.' };
  }
  return { values };
}

function addItemInputs(request, values) {
  request.input('code', sql.VarChar(50), values.code);
  request.input('name', sql.VarChar(200), values.name);
  request.input('active', sql.Bit, values.active);
  request.input('packing', sql.VarChar(100), values.packing);
  request.input('units', sql.VarChar(50), values.units);
  request.input('company', sql.VarChar(150), values.company);
  request.input('hsnCode', sql.VarChar(50), values.hsnCode);
  request.input('drugForm', sql.VarChar(100), values.drugForm);
  return request;
}

app.get('/api/items/next-code', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT CONVERT(VARCHAR(50), ISNULL(MAX(TRY_CONVERT(BIGINT, [Code])), 0) + 1) AS code
      FROM Items
      WHERE TRY_CONVERT(BIGINT, [Code]) IS NOT NULL
    `);
    res.json({ code: result.recordset[0].code });
  } catch (err) {
    console.error('Unable to generate an item code:', err);
    res.status(500).json({ message: 'Unable to generate an item code.' });
  }
});

app.get('/api/items', async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();
    request.input('search', sql.VarChar(200), `%${String(req.query.search || '').trim()}%`);
    const result = await request.query(`
      SELECT TOP 250 ${itemColumns}
      FROM Items
      WHERE [Code] LIKE @search OR [Name] LIKE @search
      ORDER BY [Name], [Code]
    `);
    res.json({ items: result.recordset });
  } catch (err) {
    console.error('Unable to find items:', err);
    res.status(500).json({ message: 'Unable to find items.' });
  }
});

app.post('/api/items', async (req, res) => {
  const parsed = getItemValues(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  try {
    await poolConnect;
    const request = addItemInputs(pool.request(), parsed.values);
    const result = await request.query(`
      INSERT INTO Items ([Code], [Name], [Active], [Packing], [Units], [Company], [HSNCode], [DrugForm])
      OUTPUT ${itemOutputColumns}
      VALUES (@code, @name, @active, @packing, @units, @company, @hsnCode, @drugForm)
    `);
    res.status(201).json({ item: result.recordset[0] });
  } catch (err) {
    console.error('Unable to add item:', err);
    if (err.number === 2601 || err.number === 2627) {
      return res.status(409).json({ message: 'An item with this code already exists. Click Add to generate another code.' });
    }
    res.status(500).json({ message: 'Unable to add item.' });
  }
});

app.put('/api/items/:code', async (req, res) => {
  const parsed = getItemValues({ ...req.body, code: req.params.code });
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  try {
    await poolConnect;
    const request = addItemInputs(pool.request(), parsed.values);
    const result = await request.query(`
      UPDATE Items
      SET [Name] = @name, [Active] = @active, [Packing] = @packing,
          [Units] = @units, [Company] = @company, [HSNCode] = @hsnCode,
          [DrugForm] = @drugForm
      OUTPUT ${itemOutputColumns}
      WHERE [Code] = @code
    `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Item not found.' });
    }
    res.json({ item: result.recordset[0] });
  } catch (err) {
    console.error('Unable to update item:', err);
    res.status(500).json({ message: 'Unable to update item.' });
  }
});

app.delete('/api/items/:code', async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();
    request.input('code', sql.VarChar(50), req.params.code);
    const result = await request.query('DELETE FROM Items WHERE [Code] = @code');
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Item not found.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Unable to remove item:', err);
    res.status(500).json({ message: 'Unable to remove item.' });
  }
});

const transactionTypes = {
  sale: { invoicePrefix: 'S', feedPrefix: 'SF', showin: [1, 3] },
  purchase: { invoicePrefix: 'P', feedPrefix: 'PF', showin: [2, 3] },
  saleReturn: { invoicePrefix: 'SR', feedPrefix: 'SRF', showin: [1, 3] },
  purchaseReturn: { invoicePrefix: 'PR', feedPrefix: 'PRF', showin: [2, 3] }
};

let transactionSchemaPromise;
async function ensureTransactionSchema() {
  if (!transactionSchemaPromise) {
    transactionSchemaPromise = (async () => {
      await poolConnect;
      await pool.request().query(`
        IF OBJECT_ID(N'dbo.StockTransactions', N'U') IS NULL
        BEGIN
          CREATE TABLE dbo.StockTransactions (
            [Id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_StockTransactions] PRIMARY KEY,
            [TransactionType] VARCHAR(20) NOT NULL,
            [InvoiceNo] VARCHAR(50) NOT NULL,
            [FeedNo] VARCHAR(50) NOT NULL,
            [AccountCode] VARCHAR(50) NOT NULL,
            [Name] VARCHAR(200) NOT NULL,
            [DoorNo] VARCHAR(100) NULL,
            [Street] VARCHAR(200) NULL,
            [Area] VARCHAR(100) NULL,
            [City] VARCHAR(100) NULL,
            [Phone] VARCHAR(20) NULL,
            [Cell] VARCHAR(20) NULL,
            [MailId] VARCHAR(150) NULL,
            [BillType] VARCHAR(10) NOT NULL,
            [DiscountPercent] DECIMAL(9,4) NOT NULL CONSTRAINT [DF_StockTransactions_DiscountPercent] DEFAULT 0,
            [DiscountAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_StockTransactions_DiscountAmount] DEFAULT 0,
            [SchemeAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_StockTransactions_SchemeAmount] DEFAULT 0,
            [CGST] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_StockTransactions_CGST] DEFAULT 0,
            [SGST] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_StockTransactions_SGST] DEFAULT 0,
            [TotalGST] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_StockTransactions_TotalGST] DEFAULT 0,
            [Gross] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_StockTransactions_Gross] DEFAULT 0,
            [NetAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_StockTransactions_NetAmount] DEFAULT 0,
            [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_StockTransactions_CreatedAt] DEFAULT SYSUTCDATETIME(),
            CONSTRAINT [UQ_StockTransactions_Invoice] UNIQUE ([TransactionType], [InvoiceNo]),
            CONSTRAINT [UQ_StockTransactions_Feed] UNIQUE ([TransactionType], [FeedNo])
          );
        END;

        IF OBJECT_ID(N'dbo.StockTransactionLines', N'U') IS NULL
        BEGIN
          CREATE TABLE dbo.StockTransactionLines (
            [Id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_StockTransactionLines] PRIMARY KEY,
            [TransactionId] INT NOT NULL,
            [ItemCode] VARCHAR(50) NOT NULL,
            [ItemName] VARCHAR(200) NOT NULL,
            [Price] DECIMAL(18,4) NOT NULL,
            [Qty] DECIMAL(18,4) NOT NULL,
            [Free] DECIMAL(18,4) NOT NULL CONSTRAINT [DF_StockTransactionLines_Free] DEFAULT 0,
            [ExpYear] SMALLINT NULL,
            [ExpMonth] TINYINT NULL,
            [Amount] DECIMAL(18,2) NOT NULL,
            CONSTRAINT [FK_StockTransactionLines_StockTransactions]
              FOREIGN KEY ([TransactionId]) REFERENCES dbo.StockTransactions([Id]) ON DELETE CASCADE
          );
          CREATE INDEX [IX_StockTransactionLines_TransactionId]
            ON dbo.StockTransactionLines([TransactionId]);
        END;

        IF OBJECT_ID(N'dbo.StockTransactionNumberCounters', N'U') IS NULL
        BEGIN
          CREATE TABLE dbo.StockTransactionNumberCounters (
            [CounterKey] VARCHAR(40) NOT NULL CONSTRAINT [PK_StockTransactionNumberCounters] PRIMARY KEY,
            [LastValue] BIGINT NOT NULL
          );
        END;

        INSERT INTO dbo.StockTransactionNumberCounters ([CounterKey], [LastValue])
        SELECT counters.[CounterKey], 0
        FROM (VALUES
          ('sale-invoice'), ('sale-feed'),
          ('purchase-invoice'), ('purchase-feed'),
          ('saleReturn-invoice'), ('saleReturn-feed'),
          ('purchaseReturn-invoice'), ('purchaseReturn-feed')
        ) AS counters([CounterKey])
        WHERE NOT EXISTS (
          SELECT 1
          FROM dbo.StockTransactionNumberCounters existing
          WHERE existing.[CounterKey] = counters.[CounterKey]
        );
      `);
    })().catch((err) => {
      transactionSchemaPromise = null;
      throw err;
    });
  }
  return transactionSchemaPromise;
}

function getTransactionType(type) {
  return Object.prototype.hasOwnProperty.call(transactionTypes, type)
    ? transactionTypes[type]
    : null;
}

function nextDisplayNumber(prefix, value) {
  return `${prefix}-${String(value).padStart(6, '0')}`;
}

async function reserveTransactionNumbers(type) {
  const config = getTransactionType(type);
  if (!config) throw new Error('Invalid transaction type.');
  await ensureTransactionSchema();

  const invoiceResult = await pool.request()
    .input('counterKey', sql.VarChar(40), `${type}-invoice`)
    .query(`
      UPDATE dbo.StockTransactionNumberCounters
      SET [LastValue] = [LastValue] + 1
      OUTPUT INSERTED.[LastValue] AS value
      WHERE [CounterKey] = @counterKey
    `);
  const feedResult = await pool.request()
    .input('counterKey', sql.VarChar(40), `${type}-feed`)
    .query(`
      UPDATE dbo.StockTransactionNumberCounters
      SET [LastValue] = [LastValue] + 1
      OUTPUT INSERTED.[LastValue] AS value
      WHERE [CounterKey] = @counterKey
    `);
  if (!invoiceResult.recordset.length || !feedResult.recordset.length) {
    throw new Error(`Transaction number counters are missing for ${type}.`);
  }
  return {
    invoiceNo: nextDisplayNumber(config.invoicePrefix, invoiceResult.recordset[0].value),
    feedNo: nextDisplayNumber(config.feedPrefix, feedResult.recordset[0].value)
  };
}

function parseTransactionValues(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Transaction details are required.' };
  }
  const accountCode = String(body.accountCode || '').trim();
  const invoiceNo = String(body.invoiceNo || '').trim();
  const feedNo = String(body.feedNo || '').trim();
  const billType = String(body.billType || '').trim().toLowerCase();
  if (!accountCode || !invoiceNo || !feedNo) {
    return { error: 'Account, invoice number, and feed number are required.' };
  }
  if (accountCode.length > 50 || invoiceNo.length > 50 || feedNo.length > 50) {
    return { error: 'Account and transaction numbers must be 50 characters or fewer.' };
  }
  if (!['cash', 'credit', 'upi'].includes(billType)) {
    return { error: 'Bill type must be cash, credit, or upi.' };
  }

  const numberFields = [
    ['discountPercent', 'Discount percent'],
    ['discountAmount', 'Discount amount'],
    ['schemeAmount', 'Scheme amount'],
    ['cgst', 'CGST'],
    ['sgst', 'SGST']
  ];
  const totals = {};
  for (const [field, label] of numberFields) {
    const value = body[field] === '' || body[field] === undefined || body[field] === null
      ? 0
      : Number(body[field]);
    if (!Number.isFinite(value) || value < 0) {
      return { error: `${label} must be a non-negative number.` };
    }
    totals[field] = value;
  }
  if (totals.discountPercent > 100) {
    return { error: 'Discount percent cannot exceed 100.' };
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 100) {
    return { error: 'Add between 1 and 100 item rows.' };
  }

  const lines = [];
  let gross = 0;
  for (const [index, line] of body.lines.entries()) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      return { error: `Item row ${index + 1} is invalid.` };
    }
    const itemCode = String(line.itemCode || '').trim();
    if (!itemCode || itemCode.length > 50) {
      return { error: `Item code is required on row ${index + 1}.` };
    }
    const price = Number(line.price);
    const qty = Number(line.qty);
    const free = line.free === '' || line.free === undefined || line.free === null ? 0 : Number(line.free);
    if (![price, qty, free].every(Number.isFinite) || price < 0 || qty <= 0 || free < 0) {
      return { error: `Row ${index + 1} needs a positive quantity and non-negative price/free quantity.` };
    }
    const expYear = line.expYear === '' || line.expYear === undefined || line.expYear === null
      ? null
      : Number(line.expYear);
    const expMonth = line.expMonth === '' || line.expMonth === undefined || line.expMonth === null
      ? null
      : Number(line.expMonth);
    if (expYear !== null && (!Number.isInteger(expYear) || expYear < 0 || expYear > 9999)) {
      return { error: `Expiry year on row ${index + 1} must be a valid year.` };
    }
    if (expMonth !== null && (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12)) {
      return { error: `Expiry month on row ${index + 1} must be between 1 and 12.` };
    }
    const amount = Number((price * qty).toFixed(2));
    lines.push({
      itemCode,
      price,
      qty,
      free,
      expYear,
      expMonth,
      amount
    });
    gross += amount;
  }
  gross = Number(gross.toFixed(2));
  const totalGST = Number((totals.cgst + totals.sgst).toFixed(2));
  const netAmount = Number((
    gross - totals.discountAmount - totals.schemeAmount + totalGST
  ).toFixed(2));
  if (netAmount < 0) return { error: 'Discounts cannot make the net amount negative.' };

  return {
    values: {
      accountCode,
      invoiceNo,
      feedNo,
      billType,
      ...totals,
      totalGST,
      gross,
      netAmount,
      lines
    }
  };
}

async function loadTransaction(requestOwner, transactionType, id) {
  const headerRequest = new sql.Request(requestOwner);
  headerRequest.input('id', sql.Int, id);
  headerRequest.input('transactionType', sql.VarChar(20), transactionType);
  const headerResult = await headerRequest.query(`
    SELECT [Id] AS id, [TransactionType] AS type, [InvoiceNo] AS invoiceNo,
      [FeedNo] AS feedNo, [AccountCode] AS accountCode, [Name] AS name,
      [DoorNo] AS doorNo, [Street] AS street, [Area] AS area, [City] AS city,
      [Phone] AS phone, [Cell] AS cell, [MailId] AS mailId, [BillType] AS billType,
      [DiscountPercent] AS discountPercent, [DiscountAmount] AS discountAmount,
      [SchemeAmount] AS schemeAmount, [CGST] AS cgst, [SGST] AS sgst,
      [TotalGST] AS totalGST, [Gross] AS gross, [NetAmount] AS netAmount,
      [CreatedAt] AS createdAt
    FROM dbo.StockTransactions
    WHERE [Id] = @id AND [TransactionType] = @transactionType
  `);
  if (!headerResult.recordset.length) return null;

  const linesRequest = new sql.Request(requestOwner);
  linesRequest.input('id', sql.Int, id);
  const linesResult = await linesRequest.query(`
    SELECT [Id] AS id, [ItemCode] AS itemCode, [ItemName] AS itemName,
      [Price] AS price, [Qty] AS qty, [Free] AS free, [ExpYear] AS expYear,
      [ExpMonth] AS expMonth, [Amount] AS amount
    FROM dbo.StockTransactionLines
    WHERE [TransactionId] = @id
    ORDER BY [Id]
  `);
  return { ...headerResult.recordset[0], lines: linesResult.recordset };
}

async function validateTransactionAccount(requestOwner, type, accountCode) {
  const config = getTransactionType(type);
  const request = new sql.Request(requestOwner);
  request.input('code', sql.VarChar(50), accountCode);
  const result = await request.query(`
    SELECT TOP 1 [code] AS code, [name] AS name, [doorno] AS doorNo,
      [street] AS street, [area] AS area, [city] AS city, [phone] AS phone,
      [cell] AS cell, [mailid] AS mailId
    FROM Accounts
    WHERE [code] = @code AND [active] = 1
      AND [showin] IN (${config.showin.join(', ')})
  `);
  return result.recordset[0] || null;
}

async function insertTransactionLines(transaction, transactionId, lines) {
  for (const line of lines) {
    const itemRequest = new sql.Request(transaction);
    itemRequest.input('itemCode', sql.VarChar(50), line.itemCode);
    const itemResult = await itemRequest.query(`
      SELECT TOP 1 [Code] AS code, [Name] AS name
      FROM Items
      WHERE [Code] = @itemCode AND [Active] = 1
    `);
    if (!itemResult.recordset.length) {
      throw Object.assign(new Error(`Active item ${line.itemCode} was not found.`), { status: 400 });
    }
    const item = itemResult.recordset[0];
    const lineRequest = new sql.Request(transaction);
    lineRequest.input('transactionId', sql.Int, transactionId);
    lineRequest.input('itemCode', sql.VarChar(50), item.code);
    lineRequest.input('itemName', sql.VarChar(200), item.name);
    lineRequest.input('price', sql.Decimal(18, 4), line.price);
    lineRequest.input('qty', sql.Decimal(18, 4), line.qty);
    lineRequest.input('free', sql.Decimal(18, 4), line.free);
    lineRequest.input('expYear', sql.SmallInt, line.expYear);
    lineRequest.input('expMonth', sql.TinyInt, line.expMonth);
    lineRequest.input('amount', sql.Decimal(18, 2), line.amount);
    await lineRequest.query(`
      INSERT INTO dbo.StockTransactionLines
        ([TransactionId], [ItemCode], [ItemName], [Price], [Qty], [Free], [ExpYear], [ExpMonth], [Amount])
      VALUES
        (@transactionId, @itemCode, @itemName, @price, @qty, @free, @expYear, @expMonth, @amount)
    `);
  }
}

async function saveTransaction(type, values, id) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const account = await validateTransactionAccount(transaction, type, values.accountCode);
    if (!account) {
      throw Object.assign(new Error('Select an active account configured for this transaction type.'), { status: 400 });
    }
    const accountFieldLimits = {
      code: 50,
      name: 200,
      doorNo: 100,
      street: 200,
      area: 100,
      city: 100,
      phone: 20,
      cell: 20,
      mailId: 150
    };
    for (const [field, limit] of Object.entries(accountFieldLimits)) {
      if (String(account[field] || '').length > limit) {
        throw Object.assign(
          new Error(`Account ${field} exceeds the ${limit}-character transaction limit.`),
          { status: 400 }
        );
      }
    }

    let transactionId = id;
    if (id) {
      const updateRequest = new sql.Request(transaction);
      updateRequest.input('id', sql.Int, id);
      updateRequest.input('transactionType', sql.VarChar(20), type);
      updateRequest.input('invoiceNo', sql.VarChar(50), values.invoiceNo);
      updateRequest.input('feedNo', sql.VarChar(50), values.feedNo);
      updateRequest.input('accountCode', sql.VarChar(50), account.code);
      updateRequest.input('name', sql.VarChar(200), account.name);
      updateRequest.input('doorNo', sql.VarChar(100), account.doorNo);
      updateRequest.input('street', sql.VarChar(200), account.street);
      updateRequest.input('area', sql.VarChar(100), account.area);
      updateRequest.input('city', sql.VarChar(100), account.city);
      updateRequest.input('phone', sql.VarChar(20), account.phone);
      updateRequest.input('cell', sql.VarChar(20), account.cell);
      updateRequest.input('mailId', sql.VarChar(150), account.mailId);
      updateRequest.input('billType', sql.VarChar(10), values.billType);
      updateRequest.input('discountPercent', sql.Decimal(9, 4), values.discountPercent);
      updateRequest.input('discountAmount', sql.Decimal(18, 2), values.discountAmount);
      updateRequest.input('schemeAmount', sql.Decimal(18, 2), values.schemeAmount);
      updateRequest.input('cgst', sql.Decimal(18, 2), values.cgst);
      updateRequest.input('sgst', sql.Decimal(18, 2), values.sgst);
      updateRequest.input('totalGST', sql.Decimal(18, 2), values.totalGST);
      updateRequest.input('gross', sql.Decimal(18, 2), values.gross);
      updateRequest.input('netAmount', sql.Decimal(18, 2), values.netAmount);
      const updateResult = await updateRequest.query(`
        UPDATE dbo.StockTransactions
        SET [AccountCode] = @accountCode, [Name] = @name, [DoorNo] = @doorNo,
          [Street] = @street, [Area] = @area, [City] = @city, [Phone] = @phone,
          [Cell] = @cell, [MailId] = @mailId, [BillType] = @billType,
          [DiscountPercent] = @discountPercent, [DiscountAmount] = @discountAmount,
          [SchemeAmount] = @schemeAmount, [CGST] = @cgst, [SGST] = @sgst,
          [TotalGST] = @totalGST, [Gross] = @gross, [NetAmount] = @netAmount
        WHERE [Id] = @id AND [TransactionType] = @transactionType
      `);
      if (updateResult.rowsAffected[0] === 0) {
        throw Object.assign(new Error('Transaction not found.'), { status: 404 });
      }
      const deleteRequest = new sql.Request(transaction);
      deleteRequest.input('id', sql.Int, id);
      await deleteRequest.query('DELETE FROM dbo.StockTransactionLines WHERE [TransactionId] = @id');
    } else {
      const insertRequest = new sql.Request(transaction);
      insertRequest.input('transactionType', sql.VarChar(20), type);
      insertRequest.input('invoiceNo', sql.VarChar(50), values.invoiceNo);
      insertRequest.input('feedNo', sql.VarChar(50), values.feedNo);
      insertRequest.input('accountCode', sql.VarChar(50), account.code);
      insertRequest.input('name', sql.VarChar(200), account.name);
      insertRequest.input('doorNo', sql.VarChar(100), account.doorNo);
      insertRequest.input('street', sql.VarChar(200), account.street);
      insertRequest.input('area', sql.VarChar(100), account.area);
      insertRequest.input('city', sql.VarChar(100), account.city);
      insertRequest.input('phone', sql.VarChar(20), account.phone);
      insertRequest.input('cell', sql.VarChar(20), account.cell);
      insertRequest.input('mailId', sql.VarChar(150), account.mailId);
      insertRequest.input('billType', sql.VarChar(10), values.billType);
      insertRequest.input('discountPercent', sql.Decimal(9, 4), values.discountPercent);
      insertRequest.input('discountAmount', sql.Decimal(18, 2), values.discountAmount);
      insertRequest.input('schemeAmount', sql.Decimal(18, 2), values.schemeAmount);
      insertRequest.input('cgst', sql.Decimal(18, 2), values.cgst);
      insertRequest.input('sgst', sql.Decimal(18, 2), values.sgst);
      insertRequest.input('totalGST', sql.Decimal(18, 2), values.totalGST);
      insertRequest.input('gross', sql.Decimal(18, 2), values.gross);
      insertRequest.input('netAmount', sql.Decimal(18, 2), values.netAmount);
      const insertResult = await insertRequest.query(`
        INSERT INTO dbo.StockTransactions
          ([TransactionType], [InvoiceNo], [FeedNo], [AccountCode], [Name],
           [DoorNo], [Street], [Area], [City], [Phone], [Cell], [MailId], [BillType],
           [DiscountPercent], [DiscountAmount], [SchemeAmount], [CGST], [SGST],
           [TotalGST], [Gross], [NetAmount])
        OUTPUT INSERTED.[Id] AS id
        VALUES
          (@transactionType, @invoiceNo, @feedNo, @accountCode, @name,
           @doorNo, @street, @area, @city, @phone, @cell, @mailId, @billType,
           @discountPercent, @discountAmount, @schemeAmount, @cgst, @sgst,
           @totalGST, @gross, @netAmount)
      `);
      transactionId = insertResult.recordset[0].id;
    }

    await insertTransactionLines(transaction, transactionId, values.lines);
    const savedTransaction = await loadTransaction(transaction, type, transactionId);
    await transaction.commit();
    return savedTransaction;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

app.get('/api/transactions/accounts', async (req, res) => {
  const type = String(req.query.type || '');
  const config = getTransactionType(type);
  if (!config) return res.status(400).json({ message: 'A valid transaction type is required.' });
  try {
    await poolConnect;
    const request = pool.request();
    const search = String(req.query.search || '').trim();
    request.input('search', sql.NVarChar(255), `%${search}%`);
    request.input('exactCode', sql.VarChar(50), search);
    const result = await request.query(`
      SELECT TOP 1000 [code] AS code, [name] AS name, [doorno] AS doorno,
        [street] AS street, [area] AS area, [city] AS city, [phone] AS phone,
        [cell] AS cell, [mailid] AS mailid
      FROM Accounts
      WHERE [active] = 1 AND [showin] IN (${config.showin.join(', ')})
        AND ([code] LIKE @search OR [name] LIKE @search)
      ORDER BY CASE WHEN [code] = @exactCode THEN 0 ELSE 1 END, [name], [code]
    `);
    res.json({ accounts: result.recordset });
  } catch (err) {
    console.error('Unable to find accounts for transaction:', err);
    res.status(500).json({ message: 'Unable to find accounts for transaction.' });
  }
});

app.get('/api/transactions/next-numbers', async (req, res) => {
  const type = String(req.query.type || '');
  if (!getTransactionType(type)) {
    return res.status(400).json({ message: 'A valid transaction type is required.' });
  }
  try {
    const numbers = await reserveTransactionNumbers(type);
    res.json(numbers);
  } catch (err) {
    console.error('Unable to generate transaction numbers:', err);
    res.status(500).json({ message: 'Unable to generate transaction numbers.' });
  }
});

app.get('/api/transactions', async (req, res) => {
  const type = String(req.query.type || '');
  if (!getTransactionType(type)) {
    return res.status(400).json({ message: 'A valid transaction type is required.' });
  }
  try {
    await ensureTransactionSchema();
    const request = pool.request();
    request.input('transactionType', sql.VarChar(20), type);
    request.input('search', sql.VarChar(255), `%${String(req.query.search || '').trim()}%`);
    const result = await request.query(`
      SELECT TOP 250 [Id] AS id, [InvoiceNo] AS invoiceNo, [FeedNo] AS feedNo,
        [AccountCode] AS accountCode, [Name] AS name, [BillType] AS billType,
        [NetAmount] AS netAmount, [CreatedAt] AS createdAt
      FROM dbo.StockTransactions
      WHERE [TransactionType] = @transactionType
        AND ([InvoiceNo] LIKE @search OR [FeedNo] LIKE @search
          OR [AccountCode] LIKE @search OR [Name] LIKE @search)
      ORDER BY [CreatedAt] DESC, [Id] DESC
    `);
    res.json({ transactions: result.recordset });
  } catch (err) {
    console.error('Unable to find transactions:', err);
    res.status(500).json({ message: 'Unable to find transactions.' });
  }
});

app.get('/api/transactions/:type/:id', async (req, res) => {
  const type = String(req.params.type || '');
  const id = Number(req.params.id);
  if (!getTransactionType(type) || !Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'A valid transaction type and ID are required.' });
  }
  try {
    await ensureTransactionSchema();
    const transaction = await loadTransaction(pool, type, id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
    res.json({ transaction });
  } catch (err) {
    console.error('Unable to load transaction:', err);
    res.status(500).json({ message: 'Unable to load transaction.' });
  }
});

app.post('/api/transactions/:type', async (req, res) => {
  const type = String(req.params.type || '');
  if (!getTransactionType(type)) {
    return res.status(400).json({ message: 'A valid transaction type is required.' });
  }
  const parsed = parseTransactionValues(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  try {
    await ensureTransactionSchema();
    const transaction = await saveTransaction(type, parsed.values);
    res.status(201).json({ transaction });
  } catch (err) {
    console.error('Unable to save transaction:', err);
    if (err.number === 2601 || err.number === 2627) {
      return res.status(409).json({ message: 'This invoice or feed number is already in use. Cancel and start a new transaction.' });
    }
    res.status(err.status || 500).json({
      message: err.status ? err.message : 'Unable to save transaction.'
    });
  }
});

app.put('/api/transactions/:type/:id', async (req, res) => {
  const type = String(req.params.type || '');
  const id = Number(req.params.id);
  if (!getTransactionType(type) || !Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'A valid transaction type and ID are required.' });
  }
  const parsed = parseTransactionValues(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  try {
    await ensureTransactionSchema();
    const transaction = await saveTransaction(type, parsed.values, id);
    res.json({ transaction });
  } catch (err) {
    console.error('Unable to update transaction:', err);
    res.status(err.status || 500).json({
      message: err.status ? err.message : 'Unable to update transaction.'
    });
  }
});

app.delete('/api/transactions/:type/:id', async (req, res) => {
  const type = String(req.params.type || '');
  const id = Number(req.params.id);
  if (!getTransactionType(type) || !Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'A valid transaction type and ID are required.' });
  }
  try {
    await ensureTransactionSchema();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('transactionType', sql.VarChar(20), type)
      .query(`
        DELETE FROM dbo.StockTransactions
        WHERE [Id] = @id AND [TransactionType] = @transactionType
      `);
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Unable to remove transaction:', err);
    res.status(500).json({ message: 'Unable to remove transaction.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
