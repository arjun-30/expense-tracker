import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";

const artifactDir = "C:\\Users\\ARJUN R\\.gemini\\antigravity-ide\\brain\\21fa6dc1-b10b-49ff-a2db-bd67bf49a936";
const workspaceDir = "c:\\Users\\ARJUN R\\Desktop\\manufacturing-expense-system";

function getBase64Image(filename) {
  const filePath = path.join(artifactDir, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return "";
  }
  const buffer = fs.readFileSync(filePath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

const images = {
  login: getBase64Image("erp_login.png"),
  dashboard: getBase64Image("erp_dashboard.png"),
  expenses: getBase64Image("erp_expenses.png"),
  fuel: getBase64Image("erp_fuel.png"),
  purchases: getBase64Image("erp_purchases.png"),
  machinery: getBase64Image("erp_machinery.png"),
  maintenance: getBase64Image("erp_maintenance.png"),
  budgets: getBase64Image("erp_budgets.png"),
  users: getBase64Image("erp_users.png"),
};

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Manufacturing Cost Control ERP: Architecture & Workings</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lexend:wght@600;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.6;
      font-size: 13px;
    }

    .cover-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 60px 40px;
      page-break-after: always;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      position: relative;
    }

    .cover-badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(37, 99, 235, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #60a5fa;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 24px;
      align-self: flex-start;
    }

    .cover-title {
      font-family: 'Lexend', sans-serif;
      font-size: 38px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 16px;
      color: #f8fafc;
    }

    .cover-subtitle {
      font-size: 18px;
      color: #94a3b8;
      max-width: 650px;
      margin-bottom: 48px;
      line-height: 1.5;
    }

    .cover-meta {
      margin-top: auto;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      padding-top: 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .meta-item h4 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-bottom: 4px;
    }

    .meta-item p {
      font-size: 14px;
      font-weight: 600;
      color: #e2e8f0;
    }

    .page {
      padding: 20px 30px 25px 30px;
      page-break-after: always;
    }

    .page:last-child,
    .page:last-of-type {
      page-break-after: auto !important;
      page-break-inside: avoid;
    }

    h1, h2, h3, h4 {
      font-family: 'Lexend', sans-serif;
      color: #0f172a;
    }

    h2 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      background: #2563eb;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      border-radius: 6px;
    }

    h3 {
      font-size: 15px;
      font-weight: 600;
      margin: 18px 0 8px 0;
      color: #1e293b;
    }

    p {
      margin-bottom: 12px;
      color: #334155;
    }

    ul, ol {
      margin-left: 20px;
      margin-bottom: 14px;
      color: #334155;
    }

    li {
      margin-bottom: 6px;
    }

    .screenshot-container {
      margin: 16px 0 20px 0;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      page-break-inside: avoid;
    }

    .screenshot-container img {
      width: 100%;
      height: auto;
      border-radius: 6px;
      display: block;
      border: 1px solid #cbd5e1;
    }

    .caption {
      font-size: 11px;
      color: #64748b;
      text-align: center;
      margin-top: 8px;
      font-weight: 500;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 14px 0;
    }

    .feature-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      page-break-inside: avoid;
    }

    .feature-card h4 {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .feature-card p {
      font-size: 12px;
      color: #475569;
      margin: 0;
    }

    .mermaid-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      margin: 16px 0;
      text-align: center;
      page-break-inside: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 11px;
      page-break-inside: avoid;
    }

    th, td {
      padding: 5px 8px;
      text-align: left;
      border: 1px solid #e2e8f0;
    }

    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: #f8fafc;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }

    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-green { background: #dcfce7; color: #15803d; }
    .badge-amber { background: #fef3c7; color: #b45309; }
    .badge-red { background: #fee2e2; color: #b91c1c; }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover-page">
    <div class="cover-badge">Enterprise Operations Manual</div>
    <h1 class="cover-title">Manufacturing Expense & Cost Control ERP</h1>
    <p class="cover-subtitle">Complete Architecture, Workflow Lifecycles, and Module Operations with Live Screenshots</p>
    
    <div class="cover-meta">
      <div class="meta-item">
        <h4>System</h4>
        <p>MECS Platform v1.0</p>
      </div>
      <div class="meta-item">
        <h4>Deployment</h4>
        <p>Production / Cloud ERP</p>
      </div>
      <div class="meta-item">
        <h4>Generated</h4>
        <p>September 2026</p>
      </div>
    </div>
  </div>

  <!-- SECTION 1: END-TO-END FLOW -->
  <div class="page">
    <h2><span class="section-num">1</span> End-to-End Operational Flow & Architecture</h2>
    <p>
      The Manufacturing Expense & Cost Control ERP connects all operational departments—Production, Maintenance, Fleet, Warehouse, and Administration—into a consolidated financial approval and cost control pipeline.
    </p>

    <div class="mermaid-box">
      <pre class="mermaid">
flowchart LR
    A["Asset & Operations<br/>(Plant, Fleet, POs)"] --> B["Automated Budget<br/>Validation"]
    B --> C["Manager<br/>Review"]
    C --> D["Accounts & Tax<br/>Verification"]
    D --> E["Payment<br/>Settlement"]
    E --> F["Live Executive<br/>Analytics"]
      </pre>
    </div>

    <h3>Operational Lifecycle Stages</h3>
    <div class="feature-grid">
      <div class="feature-card">
        <h4>1. Initiation & Asset Logging</h4>
        <p>Operational claims, machine spares usage, fuel fills, and purchase orders are logged at source with vendor invoices.</p>
      </div>
      <div class="feature-card">
        <h4>2. Real-Time Budget Check</h4>
        <p>System automatically verifies department budget availability before submission proceeds to the approval hierarchy.</p>
      </div>
      <div class="feature-card">
        <h4>3. Multi-Tier Approval Chain</h4>
        <p>Claims pass through Manager verification, Accounts tax validation, and Super Admin review for high-value transactions.</p>
      </div>
      <div class="feature-card">
        <h4>4. Settlement & Analytics</h4>
        <p>Cleared payments are recorded (NEFT/Cheque), immediately reflecting in budget burn rates and spend anomaly engines.</p>
      </div>
    </div>
  </div>

  <!-- SECTION 2: AUTH & EXECUTIVE DASHBOARD -->
  <div class="page">
    <h2><span class="section-num">2</span> Executive Dashboard & Spend Analytics</h2>
    <p>
      The executive dashboard provides unified visibility into overall company expenditures, month-over-month comparisons, budget consumption, and rolling anomaly detections.
    </p>

    <div class="screenshot-container">
      <img src="${images.dashboard}" alt="Executive Dashboard" />
      <div class="caption">Figure 2.1: Real-Time Executive Dashboard with Continuous 30-Day Expense Trend & Anomaly Alerts</div>
    </div>

    <h3>Key Capabilities</h3>
    <ul>
      <li><strong>Executive KPI Cards</strong>: Live tracking of Total Expenses (₹30,54,206), Current Month Spend (₹3,75,786 with explicit ↓ 20.1% vs Aug comparison), Pending Approvals, and Budget Utilization.</li>
      <li><strong>Interactive 30-Day Expense Trend</strong>: High-resolution continuous graph lines with spot hover tooltips displaying the exact expenditure for any specific date.</li>
      <li><strong>Automated Anomaly Detection</strong>: Automatically flags category and department expenditures that surge abnormally against a rolling 3-month baseline (e.g., Machinery +389%, Printing +379%).</li>
      <li><strong>Ergonomic Sidebar</strong>: Clean navigation with a full-bleed charcoal profile rectangle, crisp white typography, and a dedicated red door logout icon.</li>
    </ul>
  </div>

  <!-- SECTION 3: EXPENSES & APPROVAL WORKFLOW -->
  <div class="page">
    <h2><span class="section-num">3</span> Expense Management & Multi-Tier Approvals</h2>
    <p>
      The expenses module handles company-wide cost claims with document uploads, automated status progression, and priority visual highlights.
    </p>

    <div class="screenshot-container">
      <img src="${images.expenses}" alt="Expenses List & Approvals" />
      <div class="caption">Figure 3.1: Expense Records Table featuring Priority Red Alert Highlight for Pending Approvals</div>
    </div>

    <h3>Workflow & Governance</h3>
    <ul>
      <li><strong>Dynamic Multi-Filter</strong>: Search by expense number, vendor, department, or date range with real-time responsive updates.</li>
      <li><strong>Pulsing Alert for Pending Review</strong>: Records in <code>Approval Pending</code> state feature a high-priority red perimeter highlight to accelerate clearance.</li>
      <li><strong>Lifecycle Progression</strong>: <code>Submitted</code> &rarr; <code>Approval Pending</code> &rarr; <code>Approved (Unpaid)</code> &rarr; <code>Paid</code>.</li>
      <li><strong>Compliance & Bill Proof</strong>: Direct integration with cloud document storage for receipts, delivery challans, and GST bills.</li>
    </ul>
  </div>

  <!-- SECTION 4: FLEET & FUEL EFFICIENCY -->
  <div class="page">
    <h2><span class="section-num">4</span> Fleet Logistics & Fuel Efficiency Engine</h2>
    <p>
      Monitors company transport vehicles, fuel dispensations, driver efficiency, and statutory document renewals to prevent pilferage and regulatory penalties.
    </p>

    <div class="screenshot-container">
      <img src="${images.fuel}" alt="Fleet Fuel Analytics" />
      <div class="caption">Figure 4.1: Fuel Logs with Automated km/L Efficiency and Anomaly Flagging</div>
    </div>

    <h3>Workings & Algorithms</h3>
    <ul>
      <li><strong>Automated Efficiency Calculation</strong>: Divides trip distance covered by fuel volume dispensed to calculate exact km/L per log.</li>
      <li><strong>Fuel Pilferage & Fault Detection</strong>: Entries dropping significantly below the vehicle's historical baseline (e.g. 5.06 km/L vs 11.72 km/L fleet benchmark) trigger an immediate <strong>⚠️ Anomaly</strong> alert.</li>
      <li><strong>Compliance Monitoring</strong>: Proactively tracks <em>Pollution certificate expiry</em>, <em>Fitness certificate expiry</em>, and insurance renewals.</li>
    </ul>
  </div>

  <!-- SECTION 5: PLANT MACHINERY -->
  <div class="page">
    <h2><span class="section-num">5</span> Plant Machinery Assets & Operations</h2>
    <p>
      Maintains a centralized registry of manufacturing machinery, operational status tracking, installation dates, and department allocations.
    </p>

    <div class="screenshot-container">
      <img src="${images.machinery}" alt="Machinery Assets" />
      <div class="caption">Figure 5.1: Plant Machinery Assets Register & Operational Health Tracking</div>
    </div>

    <h3>Workings & Asset Governance</h3>
    <ul>
      <li><strong>Asset Registry</strong>: Tracks machine name, internal asset code (e.g. <code>EXT-01</code>, <code>CUT-01</code>), department assignment, purchase price, and installation history.</li>
      <li><strong>Live State Monitoring</strong>: Operational status tags (<code>Running</code>, <code>Maintenance</code>, <code>Idle</code>) keep plant managers informed of line availability in real time.</li>
      <li><strong>Asset Cost Linking</strong>: Automatically aggregates cumulative maintenance and parts costs against each individual machine asset over its lifetime.</li>
    </ul>
  </div>

  <!-- SECTION 6: PREVENTATIVE & BREAKDOWN MAINTENANCE -->
  <div class="page">
    <h2><span class="section-num">6</span> Preventative & Breakdown Maintenance</h2>
    <p>
      Automates work order ticketing, servicing schedules, spare parts inventory deduction, and external labour cost tracking.
    </p>

    <div class="screenshot-container">
      <img src="${images.maintenance}" alt="Maintenance Records" />
      <div class="caption">Figure 6.1: Maintenance Tickets with Labour & Spares Allocation</div>
    </div>

    <h3>Workings & Cost Tracking</h3>
    <ul>
      <li><strong>Preventative Maintenance (PM)</strong>: Scheduled routine servicing to prevent costly line breakdowns and manufacturing downtime.</li>
      <li><strong>Breakdown & Corrective Work Orders</strong>: Rapid ticketing for unexpected faults with tracked downtime hours and priority response flags.</li>
      <li><strong>Total Cost Reconciliation</strong>: Captures spare parts consumed (bearings, seals, heating elements) alongside technician service fees, automatically posting costs to the plant operating ledger.</li>
    </ul>
  </div>

  <!-- SECTION 7: PROCUREMENT & PURCHASE ORDERS -->
  <div class="page">
    <h2><span class="section-num">7</span> Procurement & Purchase Order Flow</h2>
    <p>
      Automates vendor engagement from purchase request initiation through goods receipt notes (GRN) and invoice three-way matching.
    </p>

    <div class="screenshot-container">
      <img src="${images.purchases}" alt="Purchase Orders" />
      <div class="caption">Figure 7.1: Purchase Order Ledger & Goods Receipt Verification</div>
    </div>

    <h3>Workings</h3>
    <ul>
      <li><strong>PO Issuance</strong>: Formal PO creation with tax calculations (CGST/SGST/IGST), vendor details, delivery schedules, and payment terms.</li>
      <li><strong>Goods Receipt Note (GRN)</strong>: Warehouse verifies physically delivered items against PO quantities before accounts clearance.</li>
      <li><strong>Three-Way Match</strong>: System matches PO &rarr; Goods Receipt &rarr; Vendor Tax Invoice before payments can be disbursed.</li>
    </ul>
  </div>

  <!-- SECTION 8: BUDGETS & GOVERNANCE -->
  <div class="page" style="page-break-after: avoid !important; padding-bottom: 0;">
    <h2><span class="section-num">8</span> Budgets & Role-Based Access Control (RBAC)</h2>
    <p>
      Financial safeguards and organizational access boundaries enforced at database and route levels.
    </p>

    <div class="screenshot-container" style="margin-bottom: 8px;">
      <img src="${images.budgets}" alt="Departmental Budgets" style="max-height: 200px; object-fit: contain; object-position: top;" />
      <div class="caption">Figure 8.1: Departmental Budget Allocations & Real-Time Burn Monitoring</div>
    </div>

    <h3>Role Permissions Matrix</h3>
    <table>
      <thead>
        <tr>
          <th>Role</th>
          <th>Expenses</th>
          <th>Fleet & Fuel</th>
          <th>Machinery</th>
          <th>Purchases</th>
          <th>Budgets</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Super Admin</strong></td>
          <td><span class="badge badge-blue">Full Control</span></td>
          <td><span class="badge badge-blue">Full Control</span></td>
          <td><span class="badge badge-blue">Full Control</span></td>
          <td><span class="badge badge-blue">Full Control</span></td>
          <td><span class="badge badge-blue">Full Control</span></td>
        </tr>
        <tr>
          <td><strong>Admin</strong></td>
          <td><span class="badge badge-blue">Approve All</span></td>
          <td><span class="badge badge-blue">Full Control</span></td>
          <td><span class="badge badge-blue">Full Control</span></td>
          <td><span class="badge badge-blue">Full Control</span></td>
          <td><span class="badge badge-green">Allocate</span></td>
        </tr>
        <tr>
          <td><strong>Accounts</strong></td>
          <td><span class="badge badge-green">Verify & Pay</span></td>
          <td><span class="badge badge-green">Audit & Pay</span></td>
          <td><span class="badge badge-green">Spares Audit</span></td>
          <td><span class="badge badge-green">Three-Way Match</span></td>
          <td><span class="badge badge-green">Monitor</span></td>
        </tr>
        <tr>
          <td><strong>Purchase Manager</strong></td>
          <td><span class="badge badge-amber">Dept Submit</span></td>
          <td><span class="badge badge-amber">View</span></td>
          <td><span class="badge badge-amber">Parts PO</span></td>
          <td><span class="badge badge-blue">Full POs</span></td>
          <td><span class="badge badge-amber">PO Budget</span></td>
        </tr>
        <tr>
          <td><strong>Maintenance Manager</strong></td>
          <td><span class="badge badge-amber">Dept Submit</span></td>
          <td><span class="badge badge-amber">View</span></td>
          <td><span class="badge badge-blue">Work Orders</span></td>
          <td><span class="badge badge-amber">Requisitions</span></td>
          <td><span class="badge badge-amber">Dept Budget</span></td>
        </tr>
        <tr>
          <td><strong>Transport Manager</strong></td>
          <td><span class="badge badge-amber">Dept Submit</span></td>
          <td><span class="badge badge-blue">Fleet Ops</span></td>
          <td><span class="badge badge-amber">View</span></td>
          <td><span class="badge badge-amber">Transport PO</span></td>
          <td><span class="badge badge-amber">Dept Budget</span></td>
        </tr>
        <tr>
          <td><strong>Employee</strong></td>
          <td><span class="badge badge-amber">Personal Submit</span></td>
          <td><span class="badge badge-amber">Personal Log</span></td>
          <td><span class="badge badge-amber">View</span></td>
          <td>&mdash;</td>
          <td>&mdash;</td>
        </tr>
      </tbody>
    </table>
  </div>

  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
  </script>
</body>
</html>
`;

async function main() {
  console.log("Writing temporary HTML document...");
  const tempHtmlPath = path.join(artifactDir, "scratch", "erp_manual.html");
  fs.writeFileSync(tempHtmlPath, htmlContent, "utf8");

  console.log("Launching Edge browser via playwright-core...");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const page = await browser.newPage();
  console.log("Loading document HTML...");
  await page.goto("file:///" + tempHtmlPath.replace(/\\\\/g, "/"), { waitUntil: "networkidle" });
  await page.waitForTimeout(2000); // let mermaid render

  const outputPdfWorkspace = path.join(workspaceDir, "docs", "ERP_System_Flow_and_Workings.pdf");
  const outputPdfArtifact = path.join(artifactDir, "ERP_System_Flow_and_Workings.pdf");

  console.log("Generating PDF...");
  await page.pdf({
    path: outputPdfWorkspace,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-family: -apple-system, sans-serif; font-size: 8px; color: #94a3b8; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between;"><span>Manufacturing Cost Control ERP</span><span>Confidential & Proprietary</span></div>`,
    footerTemplate: `<div style="font-family: -apple-system, sans-serif; font-size: 8px; color: #94a3b8; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between;"><span>Operational Flow & Architecture Guide</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    margin: {
      top: "14mm",
      bottom: "14mm",
      left: "12mm",
      right: "12mm",
    },
  });

  fs.copyFileSync(outputPdfWorkspace, outputPdfArtifact);

  console.log(`Saved PDF to: ${outputPdfWorkspace}`);
  console.log(`Saved PDF to: ${outputPdfArtifact}`);

  await browser.close();
  console.log("PDF generation complete!");
}

main().catch((err) => {
  console.error("Error generating PDF:", err);
  process.exit(1);
});
