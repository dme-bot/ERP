const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'erp.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dataDir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const db = getDb();

  db.exec(`
    -- Users & Auth
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin','manager','user')),
      department TEXT,
      phone TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Roles & Permissions (Admin customizable)
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Module-level permissions per role
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      module TEXT NOT NULL,
      can_view INTEGER DEFAULT 0,
      can_create INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      can_approve INTEGER DEFAULT 0,
      UNIQUE(role_id, module)
    );

    -- User-role assignment (a user can have a custom role)
    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      UNIQUE(user_id, role_id)
    );

    -- Lead Sources
    CREATE TABLE IF NOT EXISTS lead_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    -- Leads / CRM
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      source_id INTEGER REFERENCES lead_sources(id),
      status TEXT DEFAULT 'new' CHECK(status IN (
        'new','called','qualified','meeting_scheduled','meeting_done',
        'boq_drawing','quotation_sent','negotiation','won','lost'
      )),
      assigned_to INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Meetings
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER REFERENCES leads(id),
      scheduled_at DATETIME NOT NULL,
      location TEXT,
      agenda TEXT,
      outcome TEXT,
      status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- BOQ (Bill of Quantities)
    CREATE TABLE IF NOT EXISTS boq (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER REFERENCES leads(id),
      title TEXT NOT NULL,
      drawing_required INTEGER DEFAULT 0,
      drawing_file TEXT,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved')),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS boq_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      boq_id INTEGER REFERENCES boq(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'nos',
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0
    );

    -- Quotations
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER REFERENCES leads(id),
      boq_id INTEGER REFERENCES boq(id),
      quotation_number TEXT UNIQUE,
      total_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      final_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','negotiation','accepted','rejected')),
      valid_until DATE,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchase Orders (from client)
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_book_id INTEGER REFERENCES business_book(id),
      lead_id INTEGER REFERENCES leads(id),
      quotation_id INTEGER REFERENCES quotations(id),
      po_number TEXT UNIQUE NOT NULL,
      po_date DATE NOT NULL,
      total_amount REAL DEFAULT 0,
      advance_amount REAL DEFAULT 0,
      advance_received INTEGER DEFAULT 0,
      po_copy_link TEXT,
      pt_advance REAL DEFAULT 0,
      pt_delivery REAL DEFAULT 0,
      pt_installation REAL DEFAULT 0,
      pt_commissioning REAL DEFAULT 0,
      pt_retention REAL DEFAULT 0,
      status TEXT DEFAULT 'received' CHECK(status IN ('received','booked','planning','in_progress','completed')),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Item Master (from Drive Item-wise sheet)
    CREATE TABLE IF NOT EXISTS item_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT UNIQUE,
      department TEXT,
      item_name TEXT NOT NULL,
      specification TEXT,
      size TEXT,
      uom TEXT DEFAULT 'PCS',
      gst TEXT DEFAULT '18%',
      type TEXT DEFAULT 'PO',
      make TEXT,
      model_number TEXT,
      current_price REAL DEFAULT 0,
      catalogue_link TEXT,
      photo_link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Business Book (Master New Business Booked Sheet - matches Google Form/Excel)
    CREATE TABLE IF NOT EXISTS business_book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_no TEXT UNIQUE,
      lead_type TEXT DEFAULT 'Private' CHECK(lead_type IN ('Private','Government')),
      client_name TEXT NOT NULL,
      company_name TEXT,
      project_name TEXT,
      client_contact TEXT,
      client_email TEXT,
      email_address TEXT,
      source_of_enquiry TEXT,
      district TEXT,
      state TEXT,
      billing_address TEXT,
      shipping_address TEXT,
      guarantee_required TEXT DEFAULT 'No',
      guarantee_percentage TEXT,
      sale_amount_without_gst REAL DEFAULT 0,
      po_amount REAL DEFAULT 0,
      order_type TEXT DEFAULT 'Supply',
      penalty_clause TEXT DEFAULT 'No',
      penalty_clause_date DATE,
      committed_start_date DATE,
      committed_delivery_date DATE,
      committed_completion_date DATE,
      freight_extra TEXT DEFAULT 'No',
      category TEXT,
      customer_type TEXT,
      client_type TEXT,
      customer_code TEXT,
      -- People
      employee_assigned TEXT,
      employee_id INTEGER REFERENCES users(id),
      lead_by TEXT,
      management_person_name TEXT,
      management_person_contact TEXT,
      operations_person_name TEXT,
      operations_person_contact TEXT,
      pmc_person_name TEXT,
      pmc_person_contact TEXT,
      architect_person_name TEXT,
      architect_person_contact TEXT,
      accounts_person_name TEXT,
      accounts_person_contact TEXT,
      -- TPA Details
      tpa_items_count INTEGER DEFAULT 0,
      tpa_items_qty TEXT,
      tpa_material_amount REAL DEFAULT 0,
      tpa_labour_amount REAL DEFAULT 0,
      accessory_amount REAL DEFAULT 0,
      required_labour_per_day TEXT,
      actual_margin_pct REAL DEFAULT 0,
      -- Payment Terms
      payment_advance TEXT,
      payment_against_delivery TEXT,
      payment_against_installation TEXT,
      payment_against_commissioning TEXT,
      payment_retention TEXT,
      payment_credit TEXT,
      credit_days INTEGER DEFAULT 0,
      advance_received REAL DEFAULT 0,
      balance_amount REAL DEFAULT 0,
      -- PO Details (combined - no separate PO needed)
      po_number TEXT,
      po_date DATE,
      po_copy_link TEXT,
      -- File Links
      boq_file_link TEXT,
      boq_signed_link TEXT,
      tpa_material_link TEXT,
      tpa_material_signed_link TEXT,
      tpa_labour_link TEXT,
      tpa_labour_signed_link TEXT,
      final_drawing_link TEXT,
      -- Other
      remarks TEXT,
      status TEXT DEFAULT 'booked' CHECK(status IN ('booked','advance_received','planning','execution','completed')),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- PO Items (item-wise data for each PO / Business Book entry)
    CREATE TABLE IF NOT EXISTS po_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_book_id INTEGER REFERENCES business_book(id) ON DELETE CASCADE,
      item_master_id INTEGER REFERENCES item_master(id),
      description TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'nos',
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      hsn_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Order Planning
    CREATE TABLE IF NOT EXISTS order_planning (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER REFERENCES purchase_orders(id),
      business_book_id INTEGER REFERENCES business_book(id),
      planned_start DATE,
      planned_end DATE,
      notes TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed')),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Vendors
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      gst_number TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Vendor Rate Comparison
    CREATE TABLE IF NOT EXISTS vendor_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planning_id INTEGER REFERENCES order_planning(id),
      item_description TEXT NOT NULL,
      vendor1_id INTEGER REFERENCES vendors(id),
      vendor1_rate REAL DEFAULT 0,
      vendor2_id INTEGER REFERENCES vendors(id),
      vendor2_rate REAL DEFAULT 0,
      vendor3_id INTEGER REFERENCES vendors(id),
      vendor3_rate REAL DEFAULT 0,
      final_rate REAL DEFAULT 0,
      selected_vendor_id INTEGER REFERENCES vendors(id),
      approved_by TEXT,
      approval_status TEXT DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indent (Material Request)
    CREATE TABLE IF NOT EXISTS indents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planning_id INTEGER REFERENCES order_planning(id),
      indent_number TEXT UNIQUE,
      indent_date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected','po_sent','dispatched','received')),
      approved_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS indent_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indent_id INTEGER REFERENCES indents(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'nos',
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      vendor_id INTEGER REFERENCES vendors(id)
    );

    -- Vendor PO (purchase order to vendor)
    CREATE TABLE IF NOT EXISTS vendor_pos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indent_id INTEGER REFERENCES indents(id),
      vendor_id INTEGER REFERENCES vendors(id),
      po_number TEXT UNIQUE,
      total_amount REAL DEFAULT 0,
      advance_required INTEGER DEFAULT 0,
      advance_paid INTEGER DEFAULT 0,
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent','acknowledged','dispatched','delivered','completed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchase Bills
    CREATE TABLE IF NOT EXISTS purchase_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_po_id INTEGER REFERENCES vendor_pos(id),
      vendor_id INTEGER REFERENCES vendors(id),
      bill_number TEXT,
      bill_date DATE,
      amount REAL DEFAULT 0,
      gst_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','partial','paid')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Delivery Notes
    CREATE TABLE IF NOT EXISTS delivery_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_po_id INTEGER REFERENCES vendor_pos(id),
      delivery_date DATE,
      received_by INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','received','partial','rejected')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sales Bills (to client)
    CREATE TABLE IF NOT EXISTS sales_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER REFERENCES purchase_orders(id),
      bill_number TEXT UNIQUE,
      bill_date DATE,
      amount REAL DEFAULT 0,
      gst_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','partial','paid')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Installation
    CREATE TABLE IF NOT EXISTS installations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER REFERENCES purchase_orders(id),
      site_address TEXT,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','testing')),
      assigned_to INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- RA Bill (Running Account Bill)
    CREATE TABLE IF NOT EXISTS ra_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installation_id INTEGER REFERENCES installations(id),
      bill_number TEXT,
      bill_date DATE,
      work_done_amount REAL DEFAULT 0,
      previous_amount REAL DEFAULT 0,
      current_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','paid')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- MB Bill (Measurement Book)
    CREATE TABLE IF NOT EXISTS mb_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ra_bill_id INTEGER REFERENCES ra_bills(id),
      installation_id INTEGER REFERENCES installations(id),
      bill_number TEXT,
      measurements TEXT,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','verified','approved')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Installation Bills
    CREATE TABLE IF NOT EXISTS installation_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installation_id INTEGER REFERENCES installations(id),
      mb_bill_id INTEGER REFERENCES mb_bills(id),
      bill_number TEXT,
      amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','partial','paid')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Testing & Commissioning
    CREATE TABLE IF NOT EXISTS testing_commissioning (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installation_id INTEGER REFERENCES installations(id),
      test_date DATE,
      test_type TEXT,
      result TEXT CHECK(result IN ('pass','fail','partial')),
      notes TEXT,
      tested_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Complaints
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installation_id INTEGER REFERENCES installations(id),
      po_id INTEGER REFERENCES purchase_orders(id),
      complaint_number TEXT UNIQUE,
      description TEXT NOT NULL,
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      status TEXT DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
      resolved_date DATE,
      resolution_notes TEXT,
      created_by INTEGER REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Handover Certificates
    CREATE TABLE IF NOT EXISTS handover_certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installation_id INTEGER REFERENCES installations(id),
      po_id INTEGER REFERENCES purchase_orders(id),
      certificate_number TEXT UNIQUE,
      handover_date DATE,
      client_signatory TEXT,
      company_signatory TEXT,
      notes TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','signed','completed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Payment Tracking
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('receivable','payable')),
      reference_type TEXT,
      reference_id INTEGER,
      amount REAL DEFAULT 0,
      payment_date DATE,
      payment_mode TEXT,
      transaction_ref TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- HR: Job Candidates
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      source TEXT CHECK(source IN ('facebook','naukri','linkedin','reference','other')),
      position TEXT,
      status TEXT DEFAULT 'lead' CHECK(status IN ('lead','called','qualified','interview_scheduled','interview_done','offer_sent','accepted','onboarded','rejected')),
      resume_file TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- HR: Employees
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      designation TEXT,
      department TEXT,
      join_date DATE,
      salary REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','training','inactive','terminated')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sub-Contractors
    CREATE TABLE IF NOT EXISTS sub_contractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      specialization TEXT,
      rate REAL DEFAULT 0,
      rate_unit TEXT DEFAULT 'per_day',
      status TEXT DEFAULT 'qualified' CHECK(status IN ('qualified','negotiation','onboarded','active','inactive')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      category TEXT,
      expense_date DATE DEFAULT CURRENT_DATE,
      receipt_file TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','paid')),
      submitted_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      paid_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Checklists
    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      frequency TEXT DEFAULT 'monthly' CHECK(frequency IN ('daily','weekly','monthly','quarterly','yearly','once')),
      due_date DATE,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','overdue')),
      assigned_to INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Activity Log
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      record_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================
    -- SYSTEM 1: AUTOMATIC CASH FLOW SYSTEM
    -- ============================================
    CREATE TABLE IF NOT EXISTS cash_flow_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE UNIQUE NOT NULL,
      opening_balance REAL DEFAULT 0,
      total_inflows REAL DEFAULT 0,
      total_outflows REAL DEFAULT 0,
      closing_balance REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cash_flow_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      daily_id INTEGER REFERENCES cash_flow_daily(id),
      date DATE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('inflow','outflow')),
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      payment_mode TEXT,
      party_name TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================
    -- SYSTEM 2: COLLECTION ENGINE SYSTEM
    -- ============================================
    CREATE TABLE IF NOT EXISTS receivables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      project_name TEXT,
      po_id INTEGER REFERENCES purchase_orders(id),
      invoice_number TEXT,
      invoice_date DATE,
      invoice_amount REAL NOT NULL DEFAULT 0,
      received_amount REAL DEFAULT 0,
      outstanding_amount REAL DEFAULT 0,
      due_date DATE,
      ageing_days INTEGER DEFAULT 0,
      ageing_bucket TEXT DEFAULT '0-30' CHECK(ageing_bucket IN ('0-30','31-60','61-90','90+')),
      status TEXT DEFAULT 'red' CHECK(status IN ('green','yellow','red')),
      follow_up_status TEXT DEFAULT 'pending' CHECK(follow_up_status IN ('pending','contacted','promised','escalated','legal')),
      follow_up_date DATE,
      follow_up_notes TEXT,
      escalation_level INTEGER DEFAULT 0,
      owner_id INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS collection_follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receivable_id INTEGER REFERENCES receivables(id) ON DELETE CASCADE,
      follow_up_date DATE NOT NULL,
      contact_method TEXT CHECK(contact_method IN ('call','email','visit','whatsapp','legal_notice')),
      response TEXT,
      promised_date DATE,
      promised_amount REAL,
      status TEXT DEFAULT 'done',
      followed_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receivable_id INTEGER REFERENCES receivables(id),
      amount REAL NOT NULL,
      collection_date DATE NOT NULL,
      payment_mode TEXT,
      transaction_ref TEXT,
      notes TEXT,
      collected_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================
    -- SYSTEM 3: INDENT TO PAYMENT FMS (Enhanced)
    -- ============================================
    CREATE TABLE IF NOT EXISTS grn (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_po_id INTEGER REFERENCES vendor_pos(id),
      indent_id INTEGER REFERENCES indents(id),
      grn_number TEXT UNIQUE,
      grn_date DATE NOT NULL,
      received_by INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','partial','complete','rejected')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS grn_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_id INTEGER REFERENCES grn(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      ordered_qty REAL DEFAULT 0,
      received_qty REAL DEFAULT 0,
      accepted_qty REAL DEFAULT 0,
      rejected_qty REAL DEFAULT 0,
      unit TEXT DEFAULT 'nos',
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      remarks TEXT
    );

    CREATE TABLE IF NOT EXISTS indent_tracker (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indent_id INTEGER REFERENCES indents(id),
      stage TEXT NOT NULL CHECK(stage IN ('indent_raised','approval_pending','approved','po_created','dispatched','grn_done','bill_entered','payment_done')),
      stage_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER REFERENCES users(id),
      notes TEXT
    );

    -- ============================================
    -- SYSTEM 4: DPR DAILY CALCULATION SYSTEM
    -- ============================================
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      client_name TEXT,
      po_id INTEGER REFERENCES purchase_orders(id),
      business_book_id INTEGER REFERENCES business_book(id),
      site_engineer_id INTEGER REFERENCES users(id),
      supervisor TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','on_hold')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dpr (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER REFERENCES sites(id),
      report_date DATE NOT NULL,
      submitted_by INTEGER REFERENCES users(id),
      submission_time DATETIME,
      weather TEXT DEFAULT 'clear' CHECK(weather IN ('clear','rainy','cloudy','hot')),
      overall_status TEXT DEFAULT 'on_track' CHECK(overall_status IN ('on_track','delayed','ahead','blocked')),
      remarks TEXT,
      billing_ready INTEGER DEFAULT 0,
      approved_by INTEGER REFERENCES users(id),
      approval_status TEXT DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_id, report_date)
    );

    CREATE TABLE IF NOT EXISTS dpr_work_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dpr_id INTEGER REFERENCES dpr(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      unit TEXT DEFAULT 'nos',
      boq_qty REAL DEFAULT 0,
      planned_qty REAL DEFAULT 0,
      actual_qty REAL DEFAULT 0,
      cumulative_qty REAL DEFAULT 0,
      variance_pct REAL DEFAULT 0,
      remarks TEXT
    );

    CREATE TABLE IF NOT EXISTS dpr_manpower (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dpr_id INTEGER REFERENCES dpr(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      required INTEGER DEFAULT 0,
      deployed INTEGER DEFAULT 0,
      shortage INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dpr_material (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dpr_id INTEGER REFERENCES dpr(id) ON DELETE CASCADE,
      po_item_id INTEGER REFERENCES po_items(id),
      material_name TEXT NOT NULL,
      unit TEXT DEFAULT 'nos',
      boq_qty REAL DEFAULT 0,
      consumed_today REAL DEFAULT 0,
      cumulative_consumed REAL DEFAULT 0,
      balance_qty REAL DEFAULT 0,
      remarks TEXT
    );
  `);

  // Seed lead sources
  const sources = ['Indiamart', 'WhatsApp', 'LinkedIn', 'Client Reference', 'YouTube', 'Instagram', 'Twitter'];
  const insertSource = db.prepare('INSERT OR IGNORE INTO lead_sources (name) VALUES (?)');
  for (const s of sources) insertSource.run(s);

  // Seed default roles
  const defaultRoles = [
    { name: 'Admin', desc: 'Full access to all modules', is_system: 1 },
    { name: 'Sales Manager', desc: 'Manage leads, quotations, orders', is_system: 0 },
    { name: 'Sales Executive', desc: 'View and create leads, quotations', is_system: 0 },
    { name: 'Purchase Manager', desc: 'Manage procurement and vendors', is_system: 0 },
    { name: 'Site Engineer', desc: 'Installation and testing', is_system: 0 },
    { name: 'HR Manager', desc: 'HR, hiring, employees', is_system: 0 },
    { name: 'Accountant', desc: 'Billing, expenses, payments', is_system: 0 },
    { name: 'Data Entry', desc: 'Data entry for Business Book and orders', is_system: 0 },
    { name: 'Viewer', desc: 'View-only access to all modules', is_system: 0 },
  ];

  const ALL_MODULES = [
    'dashboard','leads','quotations','orders','business_book','item_master','vendors','procurement','cashflow','collections','indent_fms','dpr',
    'installation','billing','complaints','hr','employees','expenses','checklists','users'
  ];

  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name, description, is_system) VALUES (?, ?, ?)');
  for (const r of defaultRoles) insertRole.run(r.name, r.desc, r.is_system);

  // Seed permissions for each role
  const adminRole = db.prepare("SELECT id FROM roles WHERE name='Admin'").get();
  if (adminRole) {
    const existingPerms = db.prepare('SELECT COUNT(*) as c FROM role_permissions WHERE role_id=?').get(adminRole.id);
    if (existingPerms.c === 0) {
      const insertPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES (?,?,?,?,?,?,?)');
      // Admin gets full access
      for (const m of ALL_MODULES) insertPerm.run(adminRole.id, m, 1, 1, 1, 1, 1);

      // Data Entry - full access to business_book + orders, view others
      const deRole = db.prepare("SELECT id FROM roles WHERE name='Data Entry'").get();
      if (deRole) {
        for (const m of ['dashboard']) insertPerm.run(deRole.id, m, 1, 0, 0, 0, 0);
        for (const m of ['business_book','orders']) insertPerm.run(deRole.id, m, 1, 1, 1, 1, 0);
        for (const m of ['leads','quotations','vendors','procurement','cashflow','collections','indent_fms','dpr','installation','billing','complaints','hr','employees','expenses','checklists']) insertPerm.run(deRole.id, m, 1, 0, 0, 0, 0);
      }

      // Sales Manager
      const smRole = db.prepare("SELECT id FROM roles WHERE name='Sales Manager'").get();
      if (smRole) {
        for (const m of ['dashboard','leads','quotations','orders']) insertPerm.run(smRole.id, m, 1, 1, 1, 1, 1);
        for (const m of ['business_book']) insertPerm.run(smRole.id, m, 1, 0, 0, 0, 0);
        for (const m of ['vendors','procurement','installation','billing','complaints']) insertPerm.run(smRole.id, m, 1, 0, 0, 0, 0);
      }

      // Sales Executive
      const seRole = db.prepare("SELECT id FROM roles WHERE name='Sales Executive'").get();
      if (seRole) {
        for (const m of ['dashboard','leads','quotations']) insertPerm.run(seRole.id, m, 1, 1, 1, 0, 0);
        for (const m of ['orders','business_book']) insertPerm.run(seRole.id, m, 1, 0, 0, 0, 0);
      }

      // Purchase Manager
      const pmRole = db.prepare("SELECT id FROM roles WHERE name='Purchase Manager'").get();
      if (pmRole) {
        for (const m of ['dashboard','vendors','procurement']) insertPerm.run(pmRole.id, m, 1, 1, 1, 1, 1);
        for (const m of ['orders','billing']) insertPerm.run(pmRole.id, m, 1, 1, 1, 0, 0);
        for (const m of ['business_book']) insertPerm.run(pmRole.id, m, 1, 0, 0, 0, 0);
      }

      // Site Engineer
      const engRole = db.prepare("SELECT id FROM roles WHERE name='Site Engineer'").get();
      if (engRole) {
        for (const m of ['dashboard','installation','complaints']) insertPerm.run(engRole.id, m, 1, 1, 1, 0, 0);
        for (const m of ['billing']) insertPerm.run(engRole.id, m, 1, 1, 0, 0, 0);
        for (const m of ['orders','business_book']) insertPerm.run(engRole.id, m, 1, 0, 0, 0, 0);
      }

      // HR Manager
      const hrRole = db.prepare("SELECT id FROM roles WHERE name='HR Manager'").get();
      if (hrRole) {
        for (const m of ['dashboard','hr','employees','expenses','checklists']) insertPerm.run(hrRole.id, m, 1, 1, 1, 1, 1);
        for (const m of ['business_book']) insertPerm.run(hrRole.id, m, 1, 0, 0, 0, 0);
      }

      // Accountant
      const accRole = db.prepare("SELECT id FROM roles WHERE name='Accountant'").get();
      if (accRole) {
        for (const m of ['dashboard','billing','expenses']) insertPerm.run(accRole.id, m, 1, 1, 1, 0, 1);
        for (const m of ['orders','procurement','vendors','business_book']) insertPerm.run(accRole.id, m, 1, 0, 0, 0, 0);
      }

      // Viewer
      const viewerRole = db.prepare("SELECT id FROM roles WHERE name='Viewer'").get();
      if (viewerRole) {
        for (const m of ALL_MODULES) insertPerm.run(viewerRole.id, m, 1, 0, 0, 0, 0);
      }
    }
  }

  // Seed default admin user
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@erp.com');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    const r = db.prepare('INSERT INTO users (name, email, password, role, department) VALUES (?, ?, ?, ?, ?)')
      .run('Admin', 'admin@erp.com', hash, 'admin', 'Management');
    // Assign Admin role
    if (adminRole) {
      db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(r.lastInsertRowid, adminRole.id);
    }
  }

  // Seed sample Business Book entries (last 10 from Master Sheet)
  const bbCount = db.prepare('SELECT COUNT(*) as c FROM business_book').get().c;
  if (bbCount === 0) {
    const insertBB = db.prepare(`INSERT OR IGNORE INTO business_book (
      lead_no, lead_type, client_name, company_name, client_contact, source_of_enquiry,
      district, state, billing_address, sale_amount_without_gst, order_type, penalty_clause,
      committed_start_date, committed_delivery_date, committed_completion_date,
      employee_assigned, category, management_person_name, management_person_contact,
      customer_code, client_type, po_copy_link, boq_file_link, tpa_material_link, final_drawing_link,
      status, created_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);

    const seedData = [
      ['SEPL20001','Private','Seema mahajan','CONSERN PHARMA','9872655005','CRR','LUDHIANA','Punjab','LUDHIANA',222000,'SITC','No','2026-01-31','2026-02-06','2026-01-10','MD SIR','Fire Fighting','Seema mahajan','9872655005','SEPLCC1341','CRR','https://drive.google.com/open?id=1N5d0ug3iobuS_v3JGvB1ie0KCFp86u4y','https://drive.google.com/open?id=1vi7Mu5mAiSS_qh7VIlc0tF8ZwDl0uVfg','https://drive.google.com/open?id=1SLLt9c0fZjwHIbu73jBz9kQEZnf3e7FH','https://drive.google.com/open?id=1n6hS884Q69rmDZVQF4dSOYcRmnaIK7SA','booked'],
      ['SEPL20002','Private','Seema mahajan','CONSERN PHARMA','9872655005','CRR','ludhiana','punjab','ludhiana',553105,'SITC','No','2026-02-02','2026-02-09','2026-02-13','MD SIR','Fire Fighting','Seema mahajan','9872655005','SEPLCC1351','CRR','https://drive.google.com/open?id=18DHkuCx7lRYPIvXwkwnh4JcLP-nt2vFA','https://drive.google.com/open?id=1TWwwaAhK6FJAHG7iVaaRFaqHnwZp6hpl','https://drive.google.com/open?id=1bbo4nUybZ1Qbw_g97ZJUmuH-PeiQtzYY','https://drive.google.com/open?id=1jACzRXmfCA7G4Uq228gBMv3SOCU3Bv1W','booked'],
      ['SEPL20003','Private','Gurpreet Sodi','V-GUARD INDUSTRIES LTD','9899900489','CRR','HARIDWAR','HARIDWAR','HARIDWAR',129537,'SITC','No','2026-02-02','2026-02-09','2026-02-13','Lovely Sharma','Fire Fighting','Gurpreet Sodi','9899900489','SEPLCC1076','CRR','https://drive.google.com/open?id=17KedC2fesfiuXaic3loCXk4aDQCPUdUv','https://drive.google.com/open?id=14alGn10sS4bXScYJL7I7xwIwckLiCLWN','https://drive.google.com/open?id=1sXE9BHLAeYZSZH6KcFOh1TqV3udKQ3Kh','https://drive.google.com/open?id=1bAwn6P1Uum8IYuVsABuI-MjXDj8_UzqE','booked'],
      ['SEPL20004','Private','Seema mahajan','CONSERN PHARMA','9872655005','CRR','LUDHIANA','PUNJAB','LUDHIANA',450000,'SITC','No','2026-02-18','2026-02-25','2026-02-28','MD Sir','Water Tank','Seema mahajan','9872655005','SEPLCC1341','CRR','https://drive.google.com/open?id=151CXGmPlvxIraatRZktdi14_6L_C4UZM','https://drive.google.com/open?id=1Ius-YG-t60UNtLS3IhsNxu_vCRKRKvp5','https://drive.google.com/open?id=16a5R9FUraZwsowphPgKbFMrnj2RSePnV','https://drive.google.com/open?id=10-J4hi8qA2_peBwBgrE_navCi83DnOk2','booked'],
      ['SEPL20005','Private','Seema mahajan','CONSERN PHARMA','9872655005','CRR','LUDHIANA','PUNJAB','LUDHIANA',825150,'SITC','Yes','2026-02-26','2026-02-28','2026-03-05','MD Sir','Electrical','Seema mahajan','9872655005','SEPLCC1351','CRR','https://drive.google.com/open?id=1EMyfEpIjbdjy_YyqCU9snSkYqLAUs64z','https://drive.google.com/open?id=1fKH-EYr9jvpEx5BmkZ200kZ9f2Pz-Ilx','https://drive.google.com/open?id=1sdr872lipYaPt_cLPbk1yXaWcd9gW9jj','https://drive.google.com/open?id=1MC6rXQ_18eFETPMGmh1yYgm5wEhOp_7l','booked'],
      ['SEPL20006','Private','Shivam Porwal','Emerald land india pvt ltd (Imperial Golf)','7906673064','Inbound','ludhiana','punjab','ludhiana',350000,'SITC','No','2026-03-06','2026-03-13','2026-03-17','Ankur sir','Fire Fighting','Shivam Porwal','7906673064','SEPLCC1380','NBD','','','','','booked'],
      ['SEPL20007','Private','Harvinder Singh','Harvinder Singh','9501106700','Inbound','LUDHIANA','PUNJAB','LUDHIANA',85000,'Supply','No','2026-03-07','2026-03-09','2026-03-12','Lovely Sharma','Fire Fighting','Harvinder Singh','9501106700','SEPLCC1381','NBD','','','','','booked'],
      ['SEPL20008','Private','Robby Ji Team','Ramana Machine','9876792561','Inbound','Ludhiana','Punjab','Punjab',1221036,'SITC','No','2026-03-18','2026-03-23','2026-03-27','Ankur sir','Solar','Robby Ji Team','9876792561','SEPLCC1379','NBD','https://drive.google.com/open?id=1BKFKpZwilobNawHsQVExISUMKJyjArNH','https://drive.google.com/open?id=1XGDf-q70qDKSaLBO1FKuq8WkliVutSzb','https://drive.google.com/open?id=1QywIKR4VCMmYqeuv0xQ1lftmmaAXN83a','https://drive.google.com/open?id=178ejMW-nUG_hVUzXRpPCq64_mzup5xYY','booked'],
      ['SEPL20009','Private','Mayank','sbj (Nirmal Products)','9877669049','Inbound','PUNJAB','Ludhiana','Ludhiana',365000,'SITC','No','2026-03-25','2026-03-30','2026-04-02','lovely sharma','Water Tank','Mayank','9877669049','SEPLCC1373','CRR','https://drive.google.com/open?id=1348oaE5eSAkDHlPqUopG8CTP-hK56cls','https://drive.google.com/open?id=1DM7NdEdvD6A22RPtjcCr20-nl0Ta24_i','https://drive.google.com/open?id=1DKovp3s0kA2I4rrW_-_IB7JQMrMyMOJK','https://drive.google.com/open?id=1OXQI4Q5Ti5Jet5PWeVE2UEJRTGrywDBx','booked'],
      ['SEPL20010','Private','Seema mahajan','CONSERN PHARMA','9872655005','CRR','LUdhiana','Punjab','LUdhiana',157500,'SITC','No','2026-04-06','2026-04-13','2026-04-16','LOVELY SHARMA','Electrical','Seema mahajan','9872655005','SEPLCC1351','CRR','https://drive.google.com/open?id=1IiI2ETQRFvdAeQNkUAEe5luvUt4sQ7PI','https://drive.google.com/open?id=1d11zaDrp6pWKjo44Y23dPV0IB_M50_2w','https://drive.google.com/open?id=1ek_Rzv1bzliP9deihSjadltH6nXF0k4T','https://drive.google.com/open?id=1lOgP_SsqFJFK--tDjbZSjkQ-mE9QILZw','booked'],
    ];

    for (const d of seedData) {
      insertBB.run(...d);
    }
    console.log('Seeded 10 Business Book entries from Master Sheet');
  }

  // Seed Item Master (from Drive Item-wise sheet)
  const itemCount = db.prepare('SELECT COUNT(*) as c FROM item_master').get().c;
  if (itemCount === 0) {
    const insertItem = db.prepare('INSERT OR IGNORE INTO item_master (item_code, department, item_name, specification, size, uom, gst, type, make, current_price) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const items = [
      ['FF0001','FF','BRANCH PIPE','SS TYPE','63MM','PCS','18%','PO','AGNI ORIGINAL',1050],
      ['FF0002','FF','HOSE REEL DRUM','WITH 30 MTR PIPE WITH NOZZLE','20mm dia','PCS','18%','PO','AGNI ORIGINAL',3650],
      ['FF0003','FF','RRL PIPE ( 15 MTR)','SS COUPLING & SS BINDING','63MM','PCS','12%','PO','AGNI ORIGINAL',2250],
      ['FF0004','FF','TWO WAY FIRE BRIGADE','SS COUPLING ,CI BODY','100MM','PCS','18%','PO','AGNI ORIGINAL',2200],
      ['FF0005','FF','HYDRANT VALVE','SS BODY SS COUPLING(SINGLE WAY)','63MM','PCS','18%','PO','AGNI',2180],
      ['FF0006','FF','FIRE FIGHTING PANEL','MAIN PUMP + JOCKEY PUMP PANEL','40HP + 7.5 HP','PCS','18%','PO','L&T',52000],
      ['LV0007','LV','EMERGENCY EXIT LIGHT','24VOLT INCLUDE Battery','','PCS','18%','PO','AGNI',2350],
      ['LV0008','LV','SMOKE DETECTOR','','','PCS','18%','PO','AGNI',550],
      ['LV0009','LV','FIRE PANEL','CONVENTIONAL','4 ZONE','PCS','18%','PO','AGNI PALLADIUM',3800],
      ['FF0010','FF','MS NIPPLE','','4"X6"','PCS','18%','FOC','OEM',350],
      ['FF0011','FF','FIRE EXTINGUISHER','ABC TYPE','6KG','PCS','18%','PO','ATASEE',700],
      ['FF0012','FF','FIRE EXTINGUISHER','CO2 TYPE','9KG','PCS','18%','PO','ATASEE',8400],
      ['FF0013','FF','FIRE HOSE BOX','MS 16 GAUGE','36X24X18','PCS','18%','PO','FABRICATED',4000],
      ['FF0014','FF','BUTTERFLY VALVE','CI TYPE PN 1.0','65MM','PCS','18%','PO','KARTAR',1630],
      ['FF0019','FF','SPRITE LEVEL','HAND TOOL','','PCS','18%','RGP','OEM',120],
      ['LV0016','LV','PU FOAM','DOWSIL','','PCS','18%','FOC','OEM',450],
      ['LV0017','LV','SCREW','WALL SCREW','35X8','PACKET','18%','FOC','OEM',60],
      ['LV0018','LV','CLUMP','PVC TYPE','25MM','PACKET','18%','FOC','OEM',190],
      ['ELE0100','ELE','MCB','SP','16A','PCS','18%','PO','HAVELLS',250],
      ['ELE0101','ELE','WIRE','FR GRADE','1.5 SQMM','MTR','18%','PO','POLYCAB',12],
    ];
    for (const item of items) insertItem.run(...item);
    console.log('Seeded 20 Item Master entries from Drive sheet');
  }

  console.log('Database initialized successfully');
  return db;
}

module.exports = { getDb, initializeDatabase };
