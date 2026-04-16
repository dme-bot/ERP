// Import Business Book entries from bb_import.json
// SAFE: Uses INSERT OR IGNORE - will NOT delete or overwrite existing data
const path = require('path');
const { getDb, initializeDatabase } = require('./schema');

initializeDatabase();
const db = getDb();
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'bb_import.json'), 'utf-8'));

const insert = db.prepare(`INSERT OR IGNORE INTO business_book (
  lead_no, lead_type, client_name, company_name, client_contact, source_of_enquiry,
  district, state, billing_address, sale_amount_without_gst, order_type, penalty_clause,
  committed_start_date, committed_delivery_date, committed_completion_date,
  employee_assigned, category, management_person_name, management_person_contact,
  customer_code, client_type, status, created_by
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);

const insertSite = db.prepare('INSERT OR IGNORE INTO sites (name, address, client_name, business_book_id, supervisor) VALUES (?,?,?,?,?)');

let added = 0, skipped = 0;
for (const b of data) {
  try {
    const r = insert.run(
      b.lead_no, b.lead_type || 'Private', b.client_name, b.company_name,
      b.client_contact, b.source_of_enquiry, b.district, b.state, b.billing_address,
      b.sale_amount_without_gst || 0, b.order_type || 'Supply', b.penalty_clause || 'No',
      b.committed_start_date || null, b.committed_delivery_date || null, b.committed_completion_date || null,
      b.employee_assigned, b.category, b.management_person_name, b.management_person_contact,
      b.customer_code, b.client_type, 'booked'
    );
    if (r.changes > 0) {
      added++;
      // Create site for this entry
      const bbId = r.lastInsertRowid;
      const siteName = b.company_name || b.client_name;
      const siteAddr = b.billing_address || `${b.district}, ${b.state}`;
      insertSite.run(siteName, siteAddr, b.client_name, bbId, b.employee_assigned || b.management_person_name);
    } else {
      skipped++;
    }
  } catch (e) {
    skipped++;
  }
}

console.log(`\nImport complete: ${added} added, ${skipped} skipped (already exist)`);
console.log(`Total Business Book entries: ${db.prepare('SELECT COUNT(*) as c FROM business_book').get().c}`);
console.log(`Total Sites: ${db.prepare('SELECT COUNT(*) as c FROM sites').get().c}`);
