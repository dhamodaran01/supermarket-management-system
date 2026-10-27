/*
DETAILED CMD-STYLE LEARNING TRACE — js/dashboard.js
Purpose: Handle dashboard navigation, API calls, data rendering, forms and reports.

JS STEP 01> Browser loads dashboard.html and its CSS; then dashboard.js is loaded.
JS STEP 02> The script declares arrays/variables for products, suppliers, customers, payments,
            bill items, staff and current-user/session information.
JS STEP 03> The helper $ = id => document.getElementById(id) makes it shorter to find an element by ID.
JS STEP 04> api(path, opts) sends HTTP requests to api/data/<path> and includes session cookies.
JS STEP 05> api(...) parses the response as JSON. A 401 response sends the user back to index.html;
            other unsuccessful responses throw an error for the calling function to handle.
JS STEP 06> adminOnly lists sections restricted in the UI for Staff accounts.
JS STEP 07> showSection(id) changes which .dashboard-section is active and highlights the sidebar link.
JS STEP 08> showSection(id) calls the matching loader, such as loadDashboard(), loadProducts(),
            loadCustomers(), loadPayments() or loadReports(), when that section is opened.
JS STEP 09> Loader functions request records from the Java backend through api(...).
JS STEP 10> Renderer functions create/update HTML rows, cards, labels and messages using the returned data.
JS STEP 11> Form event handlers collect user-entered values and send create/update/delete requests.
JS STEP 12> Billing functions manage selected customer, bill items, quantities, totals and payment steps.
JS STEP 13> Report and counter-close functions request summaries or submit closing figures.
JS STEP 14> initialize() checks the session/current user and loads initial dashboard data.
JS STEP 15> Logout behaviour requests session logout and returns the browser to the authentication page,
            according to the implementation.
JS STEP 16> The Java backend validates requests, enforces permissions, accesses the database and returns JSON.

HOW TO EXPLAIN:
A click or form event starts a JavaScript function. That function may call api(...), the backend
responds, and JavaScript updates the page. HTML defines the places where content appears; CSS
controls their appearance; JavaScript makes them interactive.
The Staff-only UI restrictions are not a substitute for server-side authorization.
These JS STEP lines are comments for learning, not commands to type into CMD.
*/

/*
COMMAND-LINE FLOW: dashboard.html -> css/dashboard.css -> js/dashboard.js -> initialize()
-> GET api/auth (verify session and role) -> load initial data -> showSection(...)
-> loader function -> api/data/<resource> -> Java backend/database -> JSON -> renderer -> UI.
Key entry points: api() is the shared request helper; initialize() verifies the session and
loads initial data; showSection() navigates between sections and triggers the relevant loader.
Product/customer/supplier/payment/report/billing/counter-close functions are grouped below.
Detailed command-line traces and function map: FRONTEND_EXECUTION_FLOW.md
*/
// JS SECTION: Application state and DOM lookup helper.
let products=[],suppliers=[],customers=[],payments=[],bill=[],selectedCustomer=null,staffList=[];
let currentUser=null,currentRole="",editingProductId=null,editingSupplierId=null,editingCustomerId=null;
const $=id=>document.getElementById(id);

async function api(path,opts={}){
    return window.supermartLocalApi(path,opts);
}
const adminOnly=new Set(['products','stock','suppliers','settings','staff']);

function showSection(id,updateUrl=true){
    if(currentRole==='STAFF'&&adminOnly.has(id)){id='dashboard';alert('Staff access is limited to Dashboard, Customers, Sales / Billing, Payments and Reports.');}
    document.querySelectorAll('.dashboard-section').forEach(s=>s.classList.toggle('active',s.id===id));
    document.querySelectorAll('.sidebar a[data-section]').forEach(a=>a.classList.toggle('active',a.dataset.section===id));
    if(id==='dashboard')loadDashboard();
    if(id==='products'||id==='stock')loadProducts();
    if(id==='sales'){loadBillingProducts();loadCustomers();setTimeout(()=>showSalesSection('customer'),0);}
    if(id==='suppliers')loadSuppliers();
    if(id==='customers')loadCustomers();
    if(id==='payments')loadPayments();
    if(id==='reports')loadReports();
    if(id==='settings')loadSettings();
    if(id==='staff')loadStaff();
    if(updateUrl)history.replaceState(null,'','#'+id);
}

function updatePaymentSummary(){
    const t=currentBillTotals();
    const itemsCount=bill.reduce((sum,x)=>sum+Number(x.q||0),0);
    const set=(id,val)=>{if($(id))$(id).textContent=val;};
    set('paySummaryItems',itemsCount);
    set('paySummarySubtotal','₹'+t.subtotal.toFixed(2));
    set('paySummaryLoyalty','₹'+t.loyalty.toFixed(2));
    set('paySummaryOther','₹'+t.other.toFixed(2));
    set('paySummaryTaxable','₹'+t.taxable.toFixed(2));
    set('paySummaryTax','₹'+t.tax.toFixed(2));
    set('paySummaryPoints',Math.max(0,Number(selectedCustomer?.reward_points||0)-Number($('pointsToRedeem')?.value||0)+Math.floor(t.taxable/100)));
    set('paySummaryGrandTotal','₹'+t.total.toFixed(2));
}

function showSalesSection(step){
    const steps={customer:'salesCustomerStep',billing:'salesBillingStep',payment:'salesPaymentStep',menu:'salesMenuStep'};
    Object.values(steps).forEach(id=>$(id)?.classList.remove('active'));
    const target=$(steps[step]||steps.customer);
    if(target)target.classList.add('active');
    document.querySelectorAll('#sales .sales-flow-card').forEach(card=>card.classList.toggle('active',card.dataset.step===step));
    if(step==='payment'){
        $('paymentGrandTotal').textContent='₹'+currentBillTotals().total.toFixed(2);
        updatePaymentSummary();
        updateCashChange();
    }
}

function updateSalesDate(){
    const d=new Date();
    const text=d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',weekday:'short'});
    if($('salesDateDisplay'))$('salesDateDisplay').textContent=text;
}

document.addEventListener('keydown',function(e){
    if(!document.getElementById('sales')?.classList.contains('active'))return;
    const tag=(e.target.tagName||'').toLowerCase();
    const typing=['input','textarea','select'].includes(tag)||e.target.isContentEditable;
    if(typing)return;
    const key=e.key.toLowerCase();
    if(key==='q'){e.preventDefault();showSalesSection('customer');}
    else if(key==='w'){e.preventDefault();showSalesSection('billing');}
    else if(key==='e'){e.preventDefault();showSalesSection('payment');}
    else if(key==='r'){e.preventDefault();showSalesSection('menu');}
});

async function loadDashboard(){const d=await api('dashboard');$('dashboardProducts').textContent=d.products??0;$('dashboardStock').textContent=Number(d.stock??0).toFixed(2);$('dashboardCustomers').textContent=d.customers??0;$('dashboardSuppliers').textContent=d.suppliers??0;$('dashboardLowStock').textContent=d.low_stock??0;$('dashboardOutOfStock').textContent=d.out_stock??0;$('dashboardTodaySales').textContent=d.today_sales??0;$('dashboardTodayRevenue').textContent='₹'+Number(d.revenue??0).toFixed(2);}

async function loadProducts(){
    products=await api('products');renderProducts();
    const opts=products.map(p=>`<option value="${p.product_id}">${esc(p.product_name)}${p.variety?' - '+esc(p.variety):''} | Stock: ${p.stock}</option>`).join('');
    $('productSelect').innerHTML='<option value="">Select Product</option>'+products.filter(p=>Number(p.stock)>0).map(p=>`<option value="${p.product_id}">${esc(p.product_name)}${p.variety?' - '+esc(p.variety):''} | Stock: ${p.stock}</option>`).join('');
    $('stockProductSelect').innerHTML='<option value="">Select Product</option>'+opts;
    $('supplierId').innerHTML='<option value="">Supplier</option>'+suppliers.map(s=>`<option value="${s.supplier_id}">${esc(s.supplier_name)}</option>`).join('');
}

function renderProducts(){
    const q=($('searchProduct')?.value||'').toLowerCase();
    const rows=products.filter(p=>JSON.stringify(p).toLowerCase().includes(q));
    $('productTable').innerHTML=rows.map(p=>`<tr onclick="showProductDetails(${p.product_id})"><td>${p.product_id}</td><td>${esc(p.category_type)}</td><td>${esc(p.product_name)}</td><td>${esc(p.variety||'')}</td><td>₹${Number(p.actual_price).toFixed(2)}</td><td>₹${Number(p.selling_price).toFixed(2)}</td><td>${p.stock}</td><td>${esc(p.unit)}</td><td>${esc(p.supplier_name||'')}</td><td>₹${Number(p.supplier_cost||0).toFixed(2)}</td><td class="actions"><button class="mini" onclick="event.stopPropagation();editProduct(${p.product_id})">Edit</button><button class="mini danger" onclick="event.stopPropagation();deleteProduct(${p.product_id})">Delete</button></td></tr>`).join('')||'<tr><td colspan="11">No products found.</td></tr>';
    renderStock();
}
function renderStock(){
    const q=($('searchStock')?.value||'').toLowerCase();
    const rows=products.filter(p=>JSON.stringify(p).toLowerCase().includes(q));
    $('stockTable').innerHTML=rows.map(p=>`<tr onclick="showStockDetails(${p.product_id})"><td>${p.product_id}</td><td>${esc(p.product_name)}</td><td>${esc(p.variety||'')}</td><td>${esc(p.supplier_name||'')}</td><td>${p.stock}</td><td>${esc(p.unit)}</td><td><button class="mini" onclick="event.stopPropagation();editStock(${p.product_id})">Edit Stock</button></td></tr>`).join('')||'<tr><td colspan="7">No stock records found.</td></tr>';
}
function showProductDetails(id){const p=products.find(x=>x.product_id==id);if(!p)return;$('productDetails').innerHTML=`<b>Product Details</b><span>ID: ${p.product_id} | ${esc(p.product_name)} | Category: ${esc(p.category_type)} | Variety: ${esc(p.variety||'-')} | Actual: ₹${Number(p.actual_price).toFixed(2)} | Selling: ₹${Number(p.selling_price).toFixed(2)} | Stock: ${p.stock} ${esc(p.unit)} | Supplier: ${esc(p.supplier_name||'-')} | Supplier Cost: ₹${Number(p.supplier_cost||0).toFixed(2)}</span>`;}
function editProduct(id){const p=products.find(x=>x.product_id==id);if(!p)return;editingProductId=id;$('editProductId').value=id;$('categoryType').value=p.category_type||'';$('productName').value=p.product_name||'';$('variety').value=p.variety||'';$('actualPrice').value=p.actual_price;$('sellingPrice').value=p.selling_price;$('productStock').value=p.stock;$('productStock').disabled=true;$('unit').value=p.unit||'';$('supplierId').value=p.supplier_id||'';$('supplierCost').value=p.supplier_cost||0;$('productFormTitle').textContent='Edit Product';$('productSubmit').textContent='Update Product';$('productCancel').style.display='inline-block';showProductDetails(id);window.scrollTo({top:0,behavior:'smooth'});}
function resetProductForm(){editingProductId=null;$('productForm').reset();$('productStock').disabled=false;$('productFormTitle').textContent='Add Product';$('productSubmit').textContent='Add Product';$('productCancel').style.display='none';}
async function deleteProduct(id){if(!confirm('Delete this product?'))return;try{const d=await api('products?productId='+id,{method:'DELETE'});alert(d.message);await loadProducts();await loadDashboard();}catch(e){alert(e.message);}}

async function loadBillingProducts(){
    products=await api('billing-products');
    $('productSelect').innerHTML='<option value="">Select Product</option>'+products.map(p=>`<option value="${p.product_id}">${esc(p.product_name)}${p.variety?' - '+esc(p.variety):''} | Stock: ${p.stock}</option>`).join('');
    if($('productSearchInput')) $('productSearchInput').value='';
    closeBillingProductResults();
}

function closeBillingProductResults(){
    const results=$('productSearchResults');
    if(results){results.hidden=true;results.innerHTML='';}
    if($('productSearchInput'))$('productSearchInput').setAttribute('aria-expanded','false');
}

function searchBillingProducts(){
    const input=$('productSearchInput');
    const results=$('productSearchResults');
    if(!input||!results)return;
    const q=input.value.trim().toLocaleLowerCase();
    $('productSelect').value='';
    $('productPrice').value='';
    if(!q){closeBillingProductResults();return;}
    const matches=products.filter(p=>Number(p.stock)>0 && `${p.product_name||''} ${p.variety||''}`.toLocaleLowerCase().includes(q)).slice(0,50);
    results.innerHTML=matches.length?matches.map(p=>`<button type="button" class="billing-product-result" role="option" onclick="selectBillingProduct(${Number(p.product_id)})"><span class="billing-product-result-main"><strong>${esc(p.product_name)}</strong>${p.variety?`<small>${esc(p.variety)}</small>`:''}</span><span class="billing-product-result-meta"><strong>₹${Number(p.selling_price).toFixed(2)}</strong><small>Stock: ${esc(p.stock)} ${esc(p.unit||'')}</small></span></button>`).join(''):'<div class="billing-product-no-results">No matching products found.</div>';
    results.hidden=false;
    input.setAttribute('aria-expanded','true');
}

function selectBillingProduct(id){
    const p=products.find(x=>Number(x.product_id)===Number(id));
    if(!p)return;
    $('productSelect').value=String(p.product_id);
    $('productSearchInput').value=p.product_name+(p.variety?' - '+p.variety:'');
    $('productPrice').value='₹'+Number(p.selling_price).toFixed(2);
    closeBillingProductResults();
    $('productQuantity').focus();
}

async function loadSuppliers(){suppliers=await api('suppliers');renderSuppliers();if($('supplierId'))$('supplierId').innerHTML='<option value="">Supplier</option>'+suppliers.map(s=>`<option value="${s.supplier_id}">${esc(s.supplier_name)}</option>`).join('');}
function renderSuppliers(){const q=($('searchSupplier')?.value||'').toLowerCase();const rows=suppliers.filter(s=>JSON.stringify(s).toLowerCase().includes(q));$('supplierTable').innerHTML=rows.map(s=>`<tr onclick="showSupplierDetails(${s.supplier_id})"><td>${s.supplier_id}</td><td>${esc(s.supplier_code)}</td><td>${esc(s.supplier_name)}</td><td>${esc(s.product_name||'')}</td><td>${esc(s.variety||'')}</td><td>₹${Number(s.supplier_cost).toFixed(2)}</td><td>${esc(s.unit||'')}</td><td>${esc(s.phone||'')}</td><td>${esc(s.email||'')}</td><td class="actions"><button class="mini" onclick="event.stopPropagation();editSupplier(${s.supplier_id})">Edit</button><button class="mini danger" onclick="event.stopPropagation();deleteSupplier(${s.supplier_id})">Delete</button><button class="mini" onclick="event.stopPropagation();compareRowSupplier('${esc(s.product_name||'').replace(/'/g,"\\'")}')">Compare</button></td></tr>`).join('')||'<tr><td colspan="10">No suppliers found.</td></tr>';}
function showSupplierDetails(id){const s=suppliers.find(x=>x.supplier_id==id);if(!s)return;$('supplierDetails').innerHTML=`<b>Supplier Details</b><span>ID: ${s.supplier_id} | Code: ${esc(s.supplier_code)} | Name: ${esc(s.supplier_name)} | Phone: ${esc(s.phone||'-')} | Email: ${esc(s.email||'-')} | Address: ${esc(s.address||'-')} | Product: ${esc(s.product_name||'-')} | Variety: ${esc(s.variety||'-')} | Cost: ₹${Number(s.supplier_cost||0).toFixed(2)} / ${esc(s.unit||'-')}</span>`;}
function editSupplier(id){const s=suppliers.find(x=>x.supplier_id==id);if(!s)return;editingSupplierId=id;$('editSupplierId').value=id;$('supplierCode').value=s.supplier_code||'';$('supplierNameForm').value=s.supplier_name||'';$('supplierPhone').value=s.phone||'';$('supplierEmail').value=s.email||'';$('supplierAddress').value=s.address||'';$('supplierProductName').value=s.product_name||'';$('supplierVariety').value=s.variety||'';$('supplierCostForm').value=s.supplier_cost||0;$('supplierUnit').value=s.unit||'';$('supplierFormTitle').textContent='Edit Supplier';$('supplierSubmit').textContent='Update Supplier';$('supplierCancel').style.display='inline-block';showSupplierDetails(id);window.scrollTo({top:0,behavior:'smooth'});}
function resetSupplierForm(){editingSupplierId=null;$('supplierForm').reset();$('supplierFormTitle').textContent='Add Supplier';$('supplierSubmit').textContent='Add Supplier';$('supplierCancel').style.display='none';}
async function deleteSupplier(id){if(!confirm('Delete this supplier?'))return;try{const d=await api('suppliers?supplierId='+id,{method:'DELETE'});alert(d.message);await loadSuppliers();await loadProducts();await loadDashboard();}catch(e){alert(e.message);}}
async function compareSupplierCost(){const product=$('compareProduct').value.trim();if(!product){alert('Enter a product name');return;}try{const rows=await api('supplier-compare?productName='+encodeURIComponent(product));$('compareTable').innerHTML=rows.length?rows.map(s=>`<tr><td>${esc(s.supplier_name)}</td><td>${esc(s.supplier_code)}</td><td>${esc(s.product_name)}</td><td>${esc(s.variety||'')}</td><td>₹${Number(s.supplier_cost).toFixed(2)}</td><td>${esc(s.unit||'')}</td></tr>`).join(''):'<tr><td colspan="6">No supplier cost found for this product.</td></tr>';}catch(e){alert(e.message);}}
function compareRowSupplier(product){$('compareProduct').value=product;compareSupplierCost();}

async function loadCustomers(){customers=await api('customers');renderCustomers();}
function renderCustomers(){const q=($('searchCustomer')?.value||'').toLowerCase();const rows=customers.filter(c=>JSON.stringify(c).toLowerCase().includes(q));$('customerTable').innerHTML=rows.map(c=>`<tr onclick="showCustomerDetails(${c.customer_id})"><td>${c.customer_id}</td><td>${esc(c.customer_name)}</td><td>${esc(c.mobile)}</td><td>${esc(c.email||'')}</td><td>${esc(c.address||'')}</td><td>${c.reward_points}</td><td>${esc(c.created_by||'Admin')}</td><td class="actions"><button class="mini" onclick="event.stopPropagation();editCustomer(${c.customer_id})">Edit</button><button class="mini danger" onclick="event.stopPropagation();deleteCustomer(${c.customer_id})">Delete</button></td></tr>`).join('')||'<tr><td colspan="8">No customers found.</td></tr>';}
function showCustomerDetails(id){const c=customers.find(x=>x.customer_id==id);if(!c)return;$('customerDetails').innerHTML=`<b>Customer Details</b><span>ID: ${c.customer_id} | Name: ${esc(c.customer_name)} | Mobile: ${esc(c.mobile)} | Email: ${esc(c.email||'-')} | Address: ${esc(c.address||'-')} | Reward Points: ${c.reward_points} | Created By: ${esc(c.created_by||'Admin')}</span>`;}
function editCustomer(id){const c=customers.find(x=>x.customer_id==id);if(!c)return;editingCustomerId=Number(id);$('editCustomerId').value=id;$('customerNameForm').value=c.customer_name||'';$('customerMobileForm').value=c.mobile||'';$('customerEmailForm').value=c.email||'';$('customerAddressForm').value=c.address||'';$('customerFormTitle').textContent='Edit Customer';$('customerSubmit').textContent='Update Customer';$('customerCancel').style.display='inline-block';showCustomerDetails(id);window.scrollTo({top:0,behavior:'smooth'});}
function resetCustomerForm(){editingCustomerId=null;$('customerForm').reset();$('customerFormTitle').textContent='Add Customer';$('customerSubmit').textContent='Add Customer';$('customerCancel').style.display='none';}
async function deleteCustomer(id){if(!confirm('Delete this customer?'))return;try{const d=await api('customers?customerId='+id,{method:'DELETE'});alert(d.message);await loadCustomers();await loadDashboard();}catch(e){alert(e.message);}}

async function loadPayments(){payments=await api('payments');if(currentRole==='STAFF'){if($('payments').querySelector('h1'))$('payments').querySelector('h1').textContent='My Payment Management';if($('payments').querySelector('.welcome'))$('payments').querySelector('.welcome').textContent='Only your staff payments, cash received, change and references are shown.';if($('searchPayment'))$('searchPayment').placeholder='Search my payments...';}renderPayments();}
function renderPayments(){const q=($('searchPayment')?.value||'').toLowerCase();const rows=payments.filter(p=>JSON.stringify(p).toLowerCase().includes(q));$('paymentCount').textContent=payments.length;$('cashCollected').textContent='₹'+payments.filter(p=>p.method==='CASH').reduce((a,p)=>a+Number(p.cash_received||0),0).toFixed(2);$('totalChange').textContent='₹'+payments.reduce((a,p)=>a+Number(p.change_amount||0),0).toFixed(2);$('paymentTable').innerHTML=rows.map(p=>`<tr onclick="showPaymentDetails(${p.payment_id})"><td>${p.payment_id}</td><td>${p.sale_id}</td><td>${esc(p.customer_name)}</td><td>${esc(p.mobile)}</td><td>₹${Number(p.amount).toFixed(2)}</td><td>${esc(p.method)}</td><td>₹${Number(p.cash_received).toFixed(2)}</td><td>₹${Number(p.change_amount).toFixed(2)}</td><td>${esc(p.payment_reference||'-')}</td><td>${esc(p.status)}</td><td>${esc(p.payment_date)}</td><td>${esc(p.staff_name||'Admin')}</td><td><button class="mini" onclick="event.stopPropagation();showPaymentDetails(${p.payment_id})">View</button></td></tr>`).join('')||'<tr><td colspan="13">No payments found.</td></tr>';}
function showPaymentDetails(id){const p=payments.find(x=>x.payment_id==id);if(!p)return;window.selectedPayment=p;$('paymentDetails').innerHTML=`<b>Payment Details</b><span>Payment #${p.payment_id} | Sale #${p.sale_id} | Customer: ${esc(p.customer_name)} | Amount: ₹${Number(p.amount).toFixed(2)} | Method: ${esc(p.method)} | Cash Received: ₹${Number(p.cash_received).toFixed(2)} | Change / Remaining: ₹${Number(p.change_amount).toFixed(2)} | Reference: ${esc(p.payment_reference||'-')} | Staff: ${esc(p.staff_name||'Admin')} | Status: ${esc(p.status)} | Date: ${esc(p.payment_date)}</span><button class="primary" onclick="printPaymentDetails()">Print / Download Payment</button>`;}
function printPaymentDetails(){if(!window.selectedPayment)return;const p=window.selectedPayment;const w=window.open('','_blank','width=700,height=700');if(!w)return;w.document.write('<html><head><title>SuperMart Payment</title></head><body style="font-family:Arial;padding:30px"><h2>SuperMart Payment Receipt</h2><p><b>Payment ID:</b> '+p.payment_id+'</p><p><b>Sale ID:</b> '+p.sale_id+'</p><p><b>Customer:</b> '+esc(p.customer_name)+'</p><p><b>Mobile:</b> '+esc(p.mobile)+'</p><p><b>Amount:</b> ₹'+Number(p.amount).toFixed(2)+'</p><p><b>Method:</b> '+esc(p.method)+'</p><p><b>Cash Received:</b> ₹'+Number(p.cash_received).toFixed(2)+'</p><p><b>Change / Remaining:</b> ₹'+Number(p.change_amount).toFixed(2)+'</p><p><b>Reference:</b> '+esc(p.payment_reference||'-')+'</p><p><b>Status:</b> '+esc(p.status)+'</p><p><b>Date:</b> '+esc(p.payment_date)+'</p></body></html>');w.document.close();w.focus();w.print();}

async function loadReports(){
    $('reportWelcome').textContent=currentRole==='STAFF'?'Individual staff payment and counter report':'Admin-only reports with individual staff and admin details';
    if(currentRole==='STAFF'){
        $('adminReports').style.display='none';$('staffReports').style.display='block';
        if(!$('staffReportDate').value)$('staffReportDate').value=new Date().toISOString().slice(0,10);
        await loadStaffReport();
        return;
    }
    $('adminReports').style.display='block';$('staffReports').style.display='none';
    const d=await api('reports');
    $('reportProductsCount').textContent=d.summary?.products??0;
    $('reportStockValue').textContent='₹'+Number(d.summary?.stock_value||0).toFixed(2);
    $('reportCustomersCount').textContent=d.summary?.customers??0;
    $('reportSuppliersCount').textContent=d.summary?.suppliers??0;
    $('reportSalesCount').textContent=d.summary?.today_sales??0;
    $('reportRevenue').textContent='₹'+Number(d.summary?.today_revenue||0).toFixed(2);
    $('reportStaffCount').textContent=d.summary?.staff_count??0;
    $('reportAdminCount').textContent=d.summary?.admin_count??0;
    window.adminReportData=d;
    if(!$('adminReportPeriod').value)$('adminReportPeriod').value='DAILY';
    // Keep both Admin report features closed until the user clicks a report card.
    const salesPanel=$('salesRevenueFeature');
    const counterPanel=$('counterCloseFeature');
    if(salesPanel)salesPanel.style.display='none';
    if(counterPanel)counterPanel.style.display='none';
    const generated=$('generatedReportContent');
    if(generated)generated.innerHTML='<p class="muted">Click Sales & Revenue Reports or Counter Close above to view details.</p>';
}

function openDashboardReportFeature(type){
    if(currentRole!=='ADMIN')return;
    showSection('reports');
    setTimeout(()=>openAdminReportFeature(type),250);
}

function openAdminReportFeature(type){
    if(currentRole!=='ADMIN')return;
    const detailPanel=$('reportDetailPanel');
    if(detailPanel)detailPanel.style.display='none';
    window.openAdminReportCard=null;
    document.querySelectorAll('#adminReports .report-card').forEach(card=>card.classList.remove('active'));
    const salesPanel=$('salesRevenueFeature');
    const counterPanel=$('counterCloseFeature');
    const salesOpen=salesPanel && salesPanel.style.display!=='none';
    const counterOpen=counterPanel && counterPanel.style.display!=='none';
    const alreadyOpen=(type==='salesRevenue'&&salesOpen)||(type==='counterClose'&&counterOpen);

    // Clicking the same feature card again collapses it. Clicking another
    // feature card closes the previous panel and opens the new one.
    if(salesPanel)salesPanel.style.display=(type==='salesRevenue'&&!alreadyOpen)?'block':'none';
    if(counterPanel)counterPanel.style.display=(type==='counterClose'&&!alreadyOpen)?'block':'none';

    document.querySelectorAll('#adminReports .report-feature-card').forEach(card=>{
        const isSales=card.getAttribute('onclick')?.includes('salesRevenue');
        const isCounter=card.getAttribute('onclick')?.includes('counterClose');
        card.classList.toggle('active', !alreadyOpen && ((type==='salesRevenue'&&isSales)||(type==='counterClose'&&isCounter)));
    });

    if(!alreadyOpen && type==='counterClose')loadAdminCounterClosures();
    const target=type==='counterClose'?counterPanel:salesPanel;
    if(!alreadyOpen && target)target.scrollIntoView({behavior:'smooth',block:'start'});
}

async function loadAdminCounterClosures(){
    if(currentRole!=='ADMIN')return;
    try{
        const rows=await api('counter-close-admin');
        window.adminCounterClosures=rows||[];
        renderAdminCounterClosures();
    }catch(e){alert(e.message);}
}

function renderAdminCounterClosures(){
    const box=$('adminCounterCloseContent');
    if(!box)return;
    const rows=window.adminCounterClosures||[];
    if(!rows.length){
        box.innerHTML='<p class="muted">No staff counter closing records found yet.</p>';
        return;
    }
    box.innerHTML=rows.map(x=>{
        const status=x.counter_status==='OPEN'?'OPEN':(x.reconciliation_status||'MISMATCH');
        const statusClass=status==='MATCHED'?'matched':(status==='OPEN'?'open':'mismatch');
        const totalManual=Number(x.manual_cash||0)+Number(x.manual_upi||0)+Number(x.manual_card||0);
        const totalSystem=Number(x.cash_amount||0)+Number(x.upi_amount||0)+Number(x.card_amount||0);
        return `
        <div class="admin-counter-record">
            <div class="admin-counter-record-head">
                <div>
                    <h3>${esc(x.staff_name||('Staff #'+x.staff_id))}</h3>
                    <p>Staff ID: ${x.staff_id} • Closing Date: ${esc(x.closure_date||'-')} • Reopens: ${x.reopen_count||0}</p>
                </div>
                <div class="counter-status-pill ${statusClass}">${esc(status)}</div>
            </div>
            <div class="admin-counter-two-cards">
                <div class="admin-counter-side-card system">
                    <h4>System Entry</h4>
                    <div class="admin-counter-values"><span>Cash <b>${money(x.cash_amount)}</b></span><span>UPI <b>${money(x.upi_amount)}</b></span><span>Card <b>${money(x.card_amount)}</b></span><span>Total <b>${money(totalSystem)}</b></span></div>
                </div>
                <div class="admin-counter-side-card actual">
                    <h4>Actual / Manual Entry</h4>
                    <div class="admin-counter-values"><span>Cash <b>${money(x.manual_cash)}</b></span><span>UPI <b>${money(x.manual_upi)}</b></span><span>Card <b>${money(x.manual_card)}</b></span><span>Total <b>${money(totalManual)}</b></span></div>
                    <div class="admin-counter-differences"><span>Cash Difference ${money(x.cash_difference)}</span><span>UPI Difference ${money(x.upi_difference)}</span><span>Card Difference ${money(x.card_difference)}</span></div>
                </div>
            </div>
            <div class="admin-counter-actions">
                <span class="small-note">${x.counter_status==='OPEN'?'Counter currently open':'Closed'}: ${esc(x.closed_at||'-')}</span>
                <div class="admin-counter-action-buttons"><button class="secondary mini" type="button" onclick="toggleAdminCounterEdit(${x.closure_id})">Edit Cash / UPI / Card</button></div>
            </div>
            <div class="admin-counter-edit" id="adminCounterEdit-${x.closure_id}" style="display:none">
                <div class="form-field"><label>Cash</label><input id="adminCash-${x.closure_id}" type="number" min="0" step="0.01" value="${Number(x.manual_cash||0).toFixed(2)}"></div>
                <div class="form-field"><label>UPI</label><input id="adminUpi-${x.closure_id}" type="number" min="0" step="0.01" value="${Number(x.manual_upi||0).toFixed(2)}"></div>
                <div class="form-field"><label>Card</label><input id="adminCard-${x.closure_id}" type="number" min="0" step="0.01" value="${Number(x.manual_card||0).toFixed(2)}"></div>
                <div class="admin-counter-edit-actions"><button class="secondary mini" type="button" onclick="toggleAdminCounterEdit(${x.closure_id})">Cancel</button><button class="primary mini" type="button" onclick="saveAdminCounterEdit(${x.closure_id})">Save Values</button></div>
            </div>
        </div>`;
    }).join('');
}
function toggleAdminCounterEdit(id){const el=$('adminCounterEdit-'+id);if(el)el.style.display=el.style.display==='none'?'grid':'none';}
async function saveAdminCounterEdit(id){
    if(currentRole!=='ADMIN')return;
    const cash=Number($('adminCash-'+id)?.value||0),upi=Number($('adminUpi-'+id)?.value||0),card=Number($('adminCard-'+id)?.value||0);
    if(cash<0||upi<0||card<0){alert('Values cannot be negative.');return;}
    try{
        const body=new URLSearchParams({closureId:String(id),manualCash:String(cash),manualUpi:String(upi),manualCard:String(card)});
        const r=await api('counter-close-admin',{method:'PUT',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
        alert(r.message);await loadAdminCounterClosures();
    }catch(e){alert(e.message);}
}

let generatedAdminReport=null;

async function generateAdminPeriodReport(){
    if(currentRole!=='ADMIN')return;
    const period=$('adminReportPeriod')?.value||'DAILY';
    try{
        const d=await api('reports?period='+encodeURIComponent(period));
        generatedAdminReport=d;
        renderGeneratedAdminReport(d);
    }catch(e){alert(e.message);}
}

function money(v){return '₹'+Number(v||0).toFixed(2);}

function renderGeneratedAdminReport(d){
    const titleMap={DAILY:'Daily Report',WEEKLY:'Weekly Report',YEARLY:'Yearly Report'};
    $('generatedReportTitle').textContent=titleMap[d.period]||'Report';
    $('generatedReportRange').textContent=d.rangeLabel||'';
    const s=d.periodSummary||{};
    const sales=d.periodSales||[];
    const items=d.periodItems||[];
    const content=$('generatedReportContent');
    content.innerHTML=`
        <div class="report-mini-grid generated-summary-grid">
            <div><b>Total Sales</b><strong>${s.sales_count??0}</strong></div>
            <div><b>Total Revenue</b><strong>${money(s.revenue)}</strong></div>
            <div><b>Cash</b><strong>${money(s.cash)}</strong></div>
            <div><b>UPI</b><strong>${money(s.upi)}</strong></div>
            <div><b>Card</b><strong>${money(s.card)}</strong></div>
            <div><b>Discount</b><strong>${money(s.discount)}</strong></div>
            <div><b>Tax</b><strong>${money(s.tax)}</strong></div>
            <div><b>Items Sold</b><strong>${s.items_sold??0}</strong></div>
        </div>
        <h3 class="report-subtitle">Sales Details</h3>
        ${reportTable(['Sale ID','Staff / Admin','Customer','Subtotal','Discount','Tax','Grand Total','Date'],
            sales.map(x=>`<tr><td>${x.sale_id}</td><td>${esc(x.user_name||'Admin')}</td><td>${esc(x.customer_name||'Walk-in')}</td><td>${money(x.subtotal)}</td><td>${money(x.discount)}</td><td>${money(x.tax)}</td><td>${money(x.grand_total)}</td><td>${esc(x.sale_date)}</td></tr>`),
            'No sales found for this period.')}
        <h3 class="report-subtitle">Product Sales Summary</h3>
        ${reportTable(['Product','Quantity Sold','Unit','Revenue'],
            items.map(x=>`<tr><td>${esc(x.product_name)}</td><td>${x.quantity_sold??0}</td><td>${esc(x.unit||'-')}</td><td>${money(x.revenue)}</td></tr>`),
            'No product sales found for this period.')}
    `;
}

function generatedReportHtml(){
    const d=generatedAdminReport;
    if(!d)return '<p>No generated report.</p>';
    const s=d.periodSummary||{},sales=d.periodSales||[],items=d.periodItems||[];
    const escHtml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const m=v=>Number(v||0).toFixed(2);
    return `
    <h1>${escHtml(d.rangeLabel||'Report')}</h1>
    <p><b>Period:</b> ${escHtml(d.period||'')}</p>
    <table class="export-summary"><tr><th>Total Sales</th><th>Revenue</th><th>Cash</th><th>UPI</th><th>Card</th><th>Discount</th><th>Tax</th><th>Items Sold</th></tr>
    <tr><td>${s.sales_count??0}</td><td>₹${m(s.revenue)}</td><td>₹${m(s.cash)}</td><td>₹${m(s.upi)}</td><td>₹${m(s.card)}</td><td>₹${m(s.discount)}</td><td>₹${m(s.tax)}</td><td>${s.items_sold??0}</td></tr></table>
    <h2>Sales Details</h2><table><thead><tr><th>Sale ID</th><th>Staff / Admin</th><th>Customer</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Grand Total</th><th>Date</th></tr></thead><tbody>
    ${sales.map(x=>`<tr><td>${x.sale_id}</td><td>${escHtml(x.user_name||'Admin')}</td><td>${escHtml(x.customer_name||'Walk-in')}</td><td>₹${m(x.subtotal)}</td><td>₹${m(x.discount)}</td><td>₹${m(x.tax)}</td><td>₹${m(x.grand_total)}</td><td>${escHtml(x.sale_date)}</td></tr>`).join('')}</tbody></table>
    <h2>Product Sales Summary</h2><table><thead><tr><th>Product</th><th>Quantity Sold</th><th>Unit</th><th>Revenue</th></tr></thead><tbody>
    ${items.map(x=>`<tr><td>${escHtml(x.product_name)}</td><td>${x.quantity_sold??0}</td><td>${escHtml(x.unit||'-')}</td><td>₹${m(x.revenue)}</td></tr>`).join('')}</tbody></table>`;
}

function openReportPrintWindow(){
    if(!generatedAdminReport){alert('Generate a report first.');return null;}
    const w=window.open('','_blank','width=1200,height=800');
    if(!w){alert('Please allow pop-ups to export the report.');return null;}
    w.document.write(`<!doctype html><html><head><title>${generatedAdminReport.rangeLabel||'Report'}</title>
    <style>body{font-family:Arial,sans-serif;padding:25px;color:#172033}h1{margin-bottom:5px}h2{margin-top:25px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #d0d5dd;padding:8px;text-align:left}th{background:#f3f4f6}.export-summary{font-size:12px}@media print{body{padding:10px}}</style></head><body>${generatedReportHtml()}</body></html>`);
    w.document.close();
    return w;
}

function printGeneratedReport(){
    const w=openReportPrintWindow();
    if(w){w.focus();setTimeout(()=>w.print(),400);}
}

function exportGeneratedReportPDF(){
    const w=openReportPrintWindow();
    if(w){w.focus();setTimeout(()=>w.print(),400);}
}

function exportGeneratedReportExcel(){
    if(!generatedAdminReport){alert('Generate a report first.');return;}
    const htmlContent=generatedReportHtml();
    const excel=`<html><head><meta charset="UTF-8"><style>table{border-collapse:collapse}th,td{border:1px solid #999;padding:6px}th{background:#e5e7eb}</style></head><body>${htmlContent}</body></html>`;
    const blob=new Blob(['\ufeff',excel],{type:'application/vnd.ms-excel'});
    const a=document.createElement('a');
    const safe=(generatedAdminReport.rangeLabel||'report').replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'').toLowerCase();
    a.href=URL.createObjectURL(blob);a.download=`${safe}_report.xls`;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function reportTable(headers,rows,empty='No records found.'){
    if(!rows||!rows.length)return `<p class="muted">${empty}</p>`;
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function showReportCard(type){
    const panel=$('reportDetailPanel');
    const currentlyOpen=window.openAdminReportCard===type && panel && panel.style.display!=='none';
    if(currentlyOpen){
        panel.style.display='none';
        window.openAdminReportCard=null;
        document.querySelectorAll('#adminReports .report-card').forEach(card=>card.classList.remove('active'));
        return;
    }
    window.openAdminReportCard=type;
    if(panel)panel.style.display='block';
    document.querySelectorAll('#adminReports .report-card').forEach(card=>{
        const match=card.getAttribute('onclick')?.includes(`'${type}'`);
        card.classList.toggle('active',match);
    });
    // Opening a normal report card closes the two large feature panels.
    const salesPanel=$('salesRevenueFeature'),counterPanel=$('counterCloseFeature');
    if(salesPanel)salesPanel.style.display='none';
    if(counterPanel)counterPanel.style.display='none';
    document.querySelectorAll('#adminReports .report-feature-card').forEach(card=>card.classList.remove('active'));
    const d=window.adminReportData||{};const title=$('reportDetailTitle'),content=$('reportDetailContent');
    if(type==='products'){
        title.textContent='Product Report Details';
        content.innerHTML=reportTable(['ID','Category','Product','Variety','Selling Price','Stock','Unit','Supplier'],(products||[]).map(p=>`<tr><td>${p.product_id}</td><td>${esc(p.category_type)}</td><td>${esc(p.product_name)}</td><td>${esc(p.variety||'-')}</td><td>₹${Number(p.selling_price).toFixed(2)}</td><td>${p.stock}</td><td>${esc(p.unit)}</td><td>${esc(p.supplier_name||'-')}</td></tr>`));
    }else if(type==='stock'){
        title.textContent='Stock Report Details';
        content.innerHTML=reportTable(['ID','Product','Supplier','Stock','Unit','Stock Value','Status'],(products||[]).map(p=>{const value=Number(p.stock||0)*Number(p.selling_price||0);const status=Number(p.stock)<=0?'OUT OF STOCK':Number(p.stock)<=10?'LOW STOCK':'AVAILABLE';return `<tr><td>${p.product_id}</td><td>${esc(p.product_name)}</td><td>${esc(p.supplier_name||'-')}</td><td>${p.stock}</td><td>${esc(p.unit)}</td><td>₹${value.toFixed(2)}</td><td>${status}</td></tr>`;}));
    }else if(type==='customers'){
        title.textContent='Customer Report Details';
        content.innerHTML=reportTable(['ID','Customer','Mobile','Reward Points','Created By','Created At'],(customers||[]).map(c=>`<tr><td>${c.customer_id}</td><td>${esc(c.customer_name)}</td><td>${esc(c.mobile)}</td><td>${c.reward_points??0}</td><td>${esc(c.created_by||'Admin')}</td><td>${esc(c.created_at)}</td></tr>`));
    }else if(type==='suppliers'){
        title.textContent='Supplier Report Details';
        content.innerHTML=reportTable(['ID','Code','Supplier','Product','Variety','Cost','Unit','Phone'],(suppliers||[]).map(x=>`<tr><td>${x.supplier_id}</td><td>${esc(x.supplier_code)}</td><td>${esc(x.supplier_name)}</td><td>${esc(x.product_name||'-')}</td><td>${esc(x.variety||'-')}</td><td>₹${Number(x.supplier_cost||0).toFixed(2)}</td><td>${esc(x.unit||'-')}</td><td>${esc(x.phone||'-')}</td></tr>`));
    }else if(type==='sales'||type==='revenue'){
        title.textContent=type==='sales'?"Today's Sales Details":"Today's Revenue Details";
        content.innerHTML=`<div class="report-mini-grid"><div><b>Transactions</b><strong>${d.summary?.today_sales??0}</strong></div><div><b>Revenue</b><strong>₹${Number(d.summary?.today_revenue||0).toFixed(2)}</strong></div></div>`+reportTable(['Sale ID','Staff/Admin','Customer','Total','Date'],(d.todaySales||[]).map(x=>`<tr><td>${x.sale_id}</td><td>${esc(x.user_name||'Admin')}</td><td>${esc(x.customer_name||'Walk-in')}</td><td>₹${Number(x.grand_total||0).toFixed(2)}</td><td>${esc(x.sale_date)}</td></tr>`));
    }else if(type==='staff'||type==='admins'){
        const isStaff=type==='staff';title.textContent=isStaff?'Individual Staff Reports':'Individual Admin Reports';
        const list=isStaff?(d.users||[]).filter(x=>x.user_type==='STAFF'):(d.users||[]).filter(x=>x.user_type==='ADMIN');
        content.innerHTML=list.length?`<div class="user-report-grid">${list.map(x=>`<button class="user-report-card" onclick="showIndividualUserReport('${x.user_type}',${x.user_id})"><b>${esc(x.username)}</b><span>${esc(x.email)}</span><small>${x.user_type} • ${x.sales_count} sales • ₹${Number(x.revenue||0).toFixed(2)}</small><small>Cash ₹${Number(x.cash||0).toFixed(2)} | UPI ₹${Number(x.upi||0).toFixed(2)} | Card ₹${Number(x.card||0).toFixed(2)}</small></button>`).join('')}</div>`:'<p class="muted">No users found.</p>';
    }
    $('reportDetailPanel').scrollIntoView({behavior:'smooth',block:'start'});
}

async function showIndividualUserReport(type,id){
    const panel=$('reportDetailPanel');
    const key=type+':'+id;
    if(window.openIndividualUserReport===key && panel && panel.style.display!=='none'){
        panel.style.display='none';
        window.openIndividualUserReport=null;
        document.querySelectorAll('#adminReports .user-report-card').forEach(card=>card.classList.remove('active'));
        return;
    }
    window.openIndividualUserReport=key;
    if(panel)panel.style.display='block';
    document.querySelectorAll('#adminReports .user-report-card').forEach(card=>card.classList.remove('active'));
    try{
        const d=await api('reports?userType='+encodeURIComponent(type)+'&userId='+encodeURIComponent(id));
        const u=d.user||{};$('reportDetailTitle').textContent=`${type==='STAFF'?'Staff':'Admin'} Report - ${u.username||'-'}`;
        $('reportDetailContent').innerHTML=`<div class="user-profile"><div><b>Name</b><span>${esc(u.username||'-')}</span></div><div><b>Email</b><span>${esc(u.email||'-')}</span></div><div><b>Role</b><span>${type}</span></div><div><b>Created</b><span>${esc(u.created_at||'-')}</span></div></div><div class="report-mini-grid"><div><b>Total Sales</b><strong>${u.sales_count||0}</strong></div><div><b>Total Revenue</b><strong>₹${Number(u.revenue||0).toFixed(2)}</strong></div><div><b>Cash</b><strong>₹${Number(u.cash||0).toFixed(2)}</strong></div><div><b>UPI</b><strong>₹${Number(u.upi||0).toFixed(2)}</strong></div><div><b>Card</b><strong>₹${Number(u.card||0).toFixed(2)}</strong></div></div>${reportTable(['Payment ID','Sale ID','Customer','Amount','Method','Date','Reference'],(d.payments||[]).map(p=>`<tr><td>${p.payment_id}</td><td>${p.sale_id}</td><td>${esc(p.customer_name||'Walk-in')}</td><td>₹${Number(p.amount||0).toFixed(2)}</td><td>${esc(p.method)}</td><td>${esc(p.payment_date)}</td><td>${esc(p.payment_reference||'-')}</td></tr>`),'No payments found for this user.')}${type==='STAFF'?'<h3 class="report-subtitle">Counter Closing History</h3>'+reportTable(['Date','Cash','UPI','Card','Total','Closed At'],(d.closures||[]).map(x=>`<tr><td>${esc(x.closure_date)}</td><td>₹${Number(x.cash_amount||0).toFixed(2)}</td><td>₹${Number(x.upi_amount||0).toFixed(2)}</td><td>₹${Number(x.card_amount||0).toFixed(2)}</td><td>₹${Number(x.total_amount||0).toFixed(2)}</td><td>${esc(x.closed_at)}</td></tr>`),'No counter closures recorded yet.') :''}`;
        $('reportDetailPanel').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){alert(e.message);}
}

async function loadStaffReport(){
    if(currentRole!=='STAFF')return;
    const date=$('staffReportDate').value||new Date().toISOString().slice(0,10);
    try{
        const d=await api('reports?date='+encodeURIComponent(date));window.myStaffReport=d;
        $('myStaffName').textContent=d.staff?.username||currentUser?.userName||'Staff';
        $('myPaymentCount').textContent=d.daily?.payment_count??0;
        $('myCashTotal').textContent='₹'+Number(d.daily?.cash||0).toFixed(2);
        $('myUpiTotal').textContent='₹'+Number(d.daily?.upi||0).toFixed(2);
        $('myCardTotal').textContent='₹'+Number(d.daily?.card||0).toFixed(2);
        const counterClosed=!!d.closure && d.closure.counter_status!=='OPEN';
        $('myCounterStatus').textContent=counterClosed?'CLOSED':'OPEN';
        const action=$('counterActionButton');if(action){action.textContent=counterClosed?'Open Counter / View Closing':'Close Counter';}
        applyStaffCounterState(counterClosed);
        const panel=$('staffReportDetailPanel'); if(panel)panel.style.display='none'; window.openStaffReportCard=null;
    }catch(e){alert(e.message);}
}
function showStaffReportCard(type){
    const panel=$('staffReportDetailPanel');
    const currentlyOpen=window.openStaffReportCard===type && panel && panel.style.display!=='none';
    if(currentlyOpen){
        panel.style.display='none';
        window.openStaffReportCard=null;
        document.querySelectorAll('#staffReports .report-card').forEach(card=>card.classList.remove('active'));
        return;
    }
    window.openStaffReportCard=type;
    if(panel)panel.style.display='block';
    document.querySelectorAll('#staffReports .report-card').forEach(card=>{
        const match=card.getAttribute('onclick')?.includes(`'${type}'`);
        card.classList.toggle('active',match);
    });
    const d=window.myStaffReport||{},s=d.staff||{},p=d.payments||[];
    const title=$('staffReportDetailTitle'),content=$('staffReportDetailContent');
    if(type==='profile'){
        title.textContent='My Staff Details';
        content.innerHTML=`<div class="user-profile"><div><b>Staff ID</b><span>${s.staff_id??currentUser?.userId??'-'}</span></div><div><b>Name</b><span>${esc(s.username||currentUser?.userName||'-')}</span></div><div><b>Email</b><span>${esc(s.email||'-')}</span></div><div><b>Report Date</b><span>${esc(d.date||'-')}</span></div><div><b>Created At</b><span>${esc(s.created_at||'-')}</span></div></div>`;
    }else if(type==='payments'||type==='cash'||type==='upi'||type==='card'){
        const method=type==='payments'?null:type.toUpperCase();const rows=method?p.filter(x=>x.method===method):p;
        title.textContent=method?`${method} Payments - ${d.date}`:`My Payments - ${d.date}`;
        content.innerHTML=`<div class="report-mini-grid"><div><b>Payments</b><strong>${rows.length}</strong></div><div><b>Total</b><strong>₹${rows.reduce((n,x)=>n+Number(x.amount||0),0).toFixed(2)}</strong></div></div>`+reportTable(['Payment ID','Sale ID','Customer','Amount','Method','Cash Received','Change','Date','Reference'],rows.map(x=>`<tr><td>${x.payment_id}</td><td>${x.sale_id}</td><td>${esc(x.customer_name||'Walk-in')}</td><td>₹${Number(x.amount||0).toFixed(2)}</td><td>${esc(x.method)}</td><td>₹${Number(x.cash_received||0).toFixed(2)}</td><td>₹${Number(x.change_amount||0).toFixed(2)}</td><td>${esc(x.payment_date)}</td><td>${esc(x.payment_reference||'-')}</td></tr>`),'No payments found for this selection.');
    }else if(type==='counter'){
        title.textContent=`Counter Closing & Reconciliation - ${d.date}`;const c=d.closure;
        if(c && c.counter_status!=='OPEN'){
            const status=c.reconciliation_status||'MISMATCH';
            content.innerHTML=`<div class="counter-close-box ${status==='MATCHED'?'closed':'open'}"><b>COUNTER CLOSED — ${esc(status)}</b><span>System Cash: ₹${Number(c.cash_amount||0).toFixed(2)}<small>Actual: ₹${Number(c.manual_cash||0).toFixed(2)} | Difference: ₹${Number(c.cash_difference||0).toFixed(2)}</small></span><span>System UPI: ₹${Number(c.upi_amount||0).toFixed(2)}<small>Actual: ₹${Number(c.manual_upi||0).toFixed(2)} | Difference: ₹${Number(c.upi_difference||0).toFixed(2)}</small></span><span>System Card: ₹${Number(c.card_amount||0).toFixed(2)}<small>Actual: ₹${Number(c.manual_card||0).toFixed(2)} | Difference: ₹${Number(c.card_difference||0).toFixed(2)}</small></span><span>System Total: ₹${Number(c.total_amount||0).toFixed(2)}<small>Actual Total: ₹${(Number(c.manual_cash||0)+Number(c.manual_upi||0)+Number(c.manual_card||0)).toFixed(2)}</small></span><small>Closed At: ${esc(c.closed_at)}</small><button class="primary" type="button" onclick="openMyCounter()">Open Counter & Continue Billing</button></div>`;
        }else{
            content.innerHTML=`<div class="counter-reconcile-form"><div class="counter-system-values"><h3>System Entry</h3><div><b>Cash</b><strong>${money(d.daily?.cash)}</strong></div><div><b>UPI</b><strong>${money(d.daily?.upi)}</strong></div><div><b>Card</b><strong>${money(d.daily?.card)}</strong></div><div><b>Total</b><strong>${money(d.daily?.total)}</strong></div></div><div class="counter-manual-values"><h3>Manual Counter Entry</h3><div class="form-field"><label>Cash Counted</label><input id="manualCash" type="number" min="0" step="0.01" placeholder="1000.00"></div><div class="form-field"><label>UPI Counted</label><input id="manualUpi" type="number" min="0" step="0.01" placeholder="30.00"></div><div class="form-field"><label>Card Counted</label><input id="manualCard" type="number" min="0" step="0.01" placeholder="290.00"></div><div id="counterVariance" class="counter-variance">Enter manual amounts to cross-check.</div><button class="primary" type="button" onclick="closeMyCounter()">Cross-check & Close Counter</button></div></div>`;
            ['manualCash','manualUpi','manualCard'].forEach(id=>$(id)?.addEventListener('input',updateCounterVariance));
        }
    }

    $('staffReportDetailPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function applyStaffCounterState(closed){
    const banner=$('staffCounterLockBanner'),btn=$('completeSaleButton');
    if(banner)banner.style.display=closed?'flex':'none';
    if(btn){btn.disabled=closed;btn.title=closed?'Counter is closed. Open it from Reports.':'';}
}
async function openMyCounter(){
    if(currentRole!=='STAFF')return;
    const date=new Date().toISOString().slice(0,10);
    try{const r=await api('counter-open',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({date})});alert(r.message);await loadStaffReport();showStaffReportCard('counter');}catch(e){alert(e.message);}
}
function updateCounterVariance(){
    const d=window.myStaffReport||{};const cash=Number($('manualCash')?.value||0),upi=Number($('manualUpi')?.value||0),card=Number($('manualCard')?.value||0);const dc=cash-Number(d.daily?.cash||0),du=upi-Number(d.daily?.upi||0),dd=card-Number(d.daily?.card||0);const matched=Math.abs(dc)<0.005&&Math.abs(du)<0.005&&Math.abs(dd)<0.005;const el=$('counterVariance');if(el){el.className='counter-variance '+(matched?'matched':'mismatch');el.innerHTML=`Cash Difference: <b>${money(dc)}</b> | UPI Difference: <b>${money(du)}</b> | Card Difference: <b>${money(dd)}</b> | ${matched?'<strong>MATCHED ✓</strong>':'<strong>MISMATCH — check the cash/card/UPI count</strong>'}`;}
}

async function closeMyCounter(){
    if(currentRole!=='STAFF')return;if(!$('staffReportDate').value)$('staffReportDate').value=new Date().toISOString().slice(0,10);
    const date=$('staffReportDate').value;if(date!==new Date().toISOString().slice(0,10)){alert('Counter can be closed only for today.');return;}
    const cash=Number($('manualCash')?.value||0),upi=Number($('manualUpi')?.value||0),card=Number($('manualCard')?.value||0);
    if(cash<0||upi<0||card<0){alert('Manual counter amounts cannot be negative.');return;}
    updateCounterVariance();
    const d=window.myStaffReport||{};const dc=cash-Number(d.daily?.cash||0),du=upi-Number(d.daily?.upi||0),dd=card-Number(d.daily?.card||0);const matched=Math.abs(dc)<0.005&&Math.abs(du)<0.005&&Math.abs(dd)<0.005;
    const prompt=matched?"System and manual amounts match. Close today's counter?":"There is a mismatch between manual count and system entry. The difference will be recorded. Close counter anyway?";
    if(!confirm(prompt))return;
    try{const r=await api('counter-close',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({date,cashEntered:String(cash),upiEntered:String(upi),cardEntered:String(card)})});alert(r.message);await loadStaffReport();showStaffReportCard('counter');}catch(e){alert(e.message);}
}

async function loadStaff(){if(currentRole!=='ADMIN')return;staffList=await api('staff');$('staffTable').innerHTML=staffList.map(s=>`<tr><td>${s.staff_id}</td><td>${esc(s.username)}</td><td>${esc(s.email)}</td><td>${esc(s.created_at)}</td></tr>`).join('');}

$('productForm').onsubmit=async e=>{e.preventDefault();try{const f=new URLSearchParams({productId:editingProductId||'',categoryType:$('categoryType').value,productName:$('productName').value,variety:$('variety').value,actualPrice:$('actualPrice').value,sellingPrice:$('sellingPrice').value,stock:$('productStock').value,unit:$('unit').value,supplierId:$('supplierId').value,supplierCost:$('supplierCost').value});const d=await api('products',{method:editingProductId?'PUT':'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:f});alert(d.message);resetProductForm();await loadSuppliers();await loadProducts();await loadDashboard();}catch(e){alert(e.message);}};
$('supplierForm').onsubmit=async e=>{e.preventDefault();try{const f=new URLSearchParams({supplierId:editingSupplierId||'',supplierCode:$('supplierCode').value,supplierName:$('supplierNameForm').value,phone:$('supplierPhone').value,email:$('supplierEmail').value,address:$('supplierAddress').value,productName:$('supplierProductName').value,variety:$('supplierVariety').value,supplierCost:$('supplierCostForm').value,unit:$('supplierUnit').value});const d=await api('suppliers',{method:editingSupplierId?'PUT':'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:f});alert(d.message);resetSupplierForm();await loadSuppliers();await loadProducts();await loadDashboard();}catch(e){alert(e.message);}};
$('customerForm').onsubmit=async e=>{e.preventDefault();try{const mobile=$('customerMobileForm').value.trim();if(!/^\d{10}$/.test(mobile)){alert('Mobile number must contain exactly 10 digits');return;}if(editingCustomerId!==null){const customerId=Number(editingCustomerId);if(!Number.isInteger(customerId)||customerId<=0){alert('Invalid customer ID');return;}editingCustomerId=customerId;}const f=new URLSearchParams();if(editingCustomerId!==null)f.set('customerId',String(editingCustomerId));f.set('name',$('customerNameForm').value.trim());f.set('mobile',mobile);f.set('email',$('customerEmailForm').value.trim());f.set('address',$('customerAddressForm').value.trim());const d=await api('customers',{method:editingCustomerId!==null?'PUT':'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:f.toString()});alert(d.message);resetCustomerForm();await loadCustomers();await loadDashboard();}catch(e){alert(e.message);}};
$('staffForm').onsubmit=async e=>{e.preventDefault();try{const f=new URLSearchParams({username:$('staffUsername').value,email:$('staffEmail').value,password:$('staffPassword').value});const d=await api('staff',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:f});alert(d.message);e.target.reset();loadStaff();}catch(e){alert(e.message);}};

$('stockProductSelect').onchange=()=>{const p=products.find(x=>x.product_id==$('stockProductSelect').value);$('stockCurrentStock').value=p?p.stock:'';$('stockNewStock').value=p?p.stock:'';$('stockAddStock').value='';$('stockSetStock').value='';if(p)$('stockDetails').innerHTML=`<b>Stock Details</b><span>Product #${p.product_id} | ${esc(p.product_name)} | Variety: ${esc(p.variety||'-')} | Supplier: ${esc(p.supplier_name||'-')} | Current: ${p.stock} ${esc(p.unit)}</span>`;};
$('stockAddStock').oninput=()=>{$('stockNewStock').value=(Number($('stockCurrentStock').value||0)+Number($('stockAddStock').value||0)).toFixed(2)};
$('stockSetStock').oninput=()=>{if($('stockSetStock').value!=='')$('stockNewStock').value=Number($('stockSetStock').value).toFixed(2)};
$('stockForm').onsubmit=async e=>{e.preventDefault();try{const productId=$('stockProductSelect').value;if(!productId){alert('Select a product');return;}const setValue=$('stockSetStock').value;const addValue=$('stockAddStock').value;let body;if(setValue!=='')body=new URLSearchParams({productId,stock:setValue});else if(addValue!=='')body=new URLSearchParams({productId,quantity:addValue});else{alert('Enter stock to add or exact stock');return;}const d=await api('stock',{method:setValue!==''?'PUT':'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});alert(d.message);clearStockForm();await loadProducts();await loadDashboard();}catch(e){alert(e.message);}};
function editStock(id){$('stockProductSelect').value=id;$('stockProductSelect').dispatchEvent(new Event('change'));showSection('stock');window.scrollTo({top:0,behavior:'smooth'});}
function showStockDetails(id){const p=products.find(x=>x.product_id==id);if(p)$('stockDetails').innerHTML=`<b>Stock Details</b><span>Product #${p.product_id} | ${esc(p.product_name)} | Variety: ${esc(p.variety||'-')} | Supplier: ${esc(p.supplier_name||'-')} | Current Stock: ${p.stock} ${esc(p.unit)} | Selling Price: ₹${Number(p.selling_price).toFixed(2)}</span>`;}
function clearStockForm(){$('stockProductSelect').value='';$('stockCurrentStock').value='';$('stockAddStock').value='';$('stockNewStock').value='';$('stockSetStock').value='';}

$('productSelect').onchange=()=>{const p=products.find(x=>x.product_id==$('productSelect').value);$('productPrice').value=p?'₹'+Number(p.selling_price).toFixed(2):'';};
if($('productSearchInput')){
    $('productSearchInput').addEventListener('input',searchBillingProducts);
    $('productSearchInput').addEventListener('focus',()=>{if($('productSearchInput').value.trim())searchBillingProducts();});
    $('productSearchInput').addEventListener('keydown',e=>{
        if(e.key==='Escape')closeBillingProductResults();
        if(e.key==='Enter'){
            const first=$('productSearchResults')?.querySelector('.billing-product-result');
            if(first){e.preventDefault();first.click();}
        }
    });
    document.addEventListener('click',e=>{if(!e.target.closest('.billing-product-search-wrap'))closeBillingProductResults();});
}
$('customerMobile').addEventListener('input',debounce(autoFindCustomer,350));
$('pointsToRedeem').addEventListener('input',renderBill);
$('otherDiscountInput').addEventListener('input',renderBill);
$('cashReceived').addEventListener('input',updateCashChange);
$('cardNumber').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,19);});
$('cardYear').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);});
$('cardCvv').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);});

function generateInvoiceNumber(){
    const now=new Date();
    const stamp=now.getFullYear().toString()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0');
    const random=Math.floor(1000+Math.random()*9000);
    if($('invoiceNumber'))$('invoiceNumber').value='INV-'+stamp+'-'+random;
    if($('billDate'))$('billDate').value=now.toISOString().slice(0,10);
    updateSalesDate();
}

async function autoFindCustomer(){
    const mobile=$('customerMobile').value.replace(/\D/g,'');
    $('customerMobile').value=mobile;
    const status=$('customerSearchStatus');
    if(mobile.length!==10){
        selectedCustomer=null;
        $('customerResult').innerHTML='<span class="muted">Enter a valid 10-digit mobile number.</span>';
        $('addCustomerFromBill').style.display='none';
        if(status)status.textContent='Customer details will be searched automatically after 10 digits are entered.';
        renderBill();
        return;
    }
    try{
        if(status)status.textContent='Searching customer in MySQL...';
        $('customerResult').innerHTML='<span class="muted">Searching customer...</span>';
        const d=await api('customer-by-mobile?mobile='+encodeURIComponent(mobile));
        if(d.found){
            selectedCustomer=d.customer;
            $('customerResult').innerHTML=`<div class="customer-info-list"><div><span>▣</span><label>Customer ID</label><b>C${String(selectedCustomer.customer_id).padStart(3,'0')}</b></div><div><span>👤</span><label>Customer Name</label><b>${esc(selectedCustomer.customer_name)}</b></div><div><span>☎</span><label>Mobile Number</label><b>${esc(selectedCustomer.mobile)}</b></div><div><span>✉</span><label>Email</label><b>${esc(selectedCustomer.email||'-')}</b></div><div><span>⌖</span><label>Address</label><b>${esc(selectedCustomer.address||'-')}</b></div><div><span>★</span><label>Reward Points</label><b>${selectedCustomer.reward_points} Points</b></div></div>`;
            if(status)status.textContent='✓ Customer found automatically from MySQL.';
            $('addCustomerFromBill').style.display='none';
        }else{
            selectedCustomer=null;
            $('customerResult').innerHTML='<b>Customer not found.</b><p class="muted">No customer exists with this mobile number.</p>';
            $('addCustomerFromBill').style.display='inline-block';
            if(status)status.textContent='Customer not found. Add the customer before billing.';
        }
        renderBill();
    }catch(e){if(status)status.textContent='Unable to search customer.';alert(e.message);}
}

function addBillItem(){
    const p=products.find(x=>x.product_id==$('productSelect').value);
    if(!p){alert('Select a product');return;}
    const q=Number($('productQuantity').value);
    if(q<=0){alert('Enter a valid quantity');return;}
    if(q>Number(p.stock)){alert('Insufficient stock');return;}
    const existing=bill.find(x=>Number(x.p.product_id)===Number(p.product_id));
    if(existing){
        if(existing.q+q>Number(p.stock)){alert('Total quantity exceeds available stock');return;}
        existing.q+=q;
        alert(`${p.product_name} is already added to the bill. Quantity updated to ${existing.q}.`);
    }else bill.push({p,q});
    $('productSelect').value='';if($('productSearchInput'))$('productSearchInput').value='';closeBillingProductResults();$('productQuantity').value='1';$('productPrice').value='';
    renderBill();
}

function renderBill(){
    $('billTable').innerHTML=bill.map((x,n)=>`<tr><td>${n+1}</td><td>${esc(x.p.product_name)}</td><td>${esc(x.p.variety||'')}</td><td>₹${Number(x.p.selling_price).toFixed(2)}</td><td>${x.q}</td><td>${esc(x.p.unit)}</td><td>₹${(x.q*x.p.selling_price).toFixed(2)}</td><td><button class="mini danger" onclick="bill.splice(${n},1);renderBill()">Remove</button></td></tr>`).join('')||'<tr><td colspan="8">No products added to the bill.</td></tr>';
    const subtotal=bill.reduce((a,x)=>a+x.q*x.p.selling_price,0);
    const points=Number($('pointsToRedeem').value||0);
    const available=selectedCustomer?Number(selectedCustomer.reward_points||0):0;
    const loyalty=points>=5?points*10:0;
    const other=Math.max(0,Number($('otherDiscountInput').value||0));
    const taxable=Math.max(0,subtotal-loyalty-other);
    const tax=taxable*0.05;
    const total=taxable+tax;
    if(points>0&&points<5)$('rewardMessage').textContent='Minimum 5 points are required to redeem.';
    else if(points>available)$('rewardMessage').textContent='Points to redeem cannot exceed available points.';
    else $('rewardMessage').textContent=`Available: ${available} points | Discount: ₹${loyalty.toFixed(2)} | 1 point = ₹10.`;
    const earned=Math.floor(subtotal/1000);
    const after=Math.max(0,available-points+earned);
    $('totalItems').textContent=bill.length;
    $('billSubtotal').textContent='₹'+subtotal.toFixed(2);
    $('billTax').textContent='₹'+tax.toFixed(2);
    $('loyaltyDiscount').textContent='₹'+loyalty.toFixed(2);
    $('otherDiscount').textContent='₹'+other.toFixed(2);
    $('taxableAmount').textContent='₹'+taxable.toFixed(2);
    $('grandTotal').textContent='₹'+total.toFixed(2);
    $('pointsAfterSale').textContent=after;
    if($('paymentGrandTotal'))$('paymentGrandTotal').textContent='₹'+total.toFixed(2);
    updateCashChange();
}
    updatePaymentSummary();

function selectPaymentMethod(method){
    $('paymentMethod').value=method;
    document.querySelectorAll('.payment-tab').forEach(b=>b.classList.toggle('active',b.dataset.method===method));
    $('cashFields').style.display=method==='CASH'?'block':'none';
    $('upiFields').style.display=method==='UPI'?'block':'none';
    $('cardFields').style.display=method==='CARD'?'block':'none';
    updateCashChange();
}

function currentBillTotals(){
    const subtotal=bill.reduce((a,x)=>a+x.q*x.p.selling_price,0);
    const points=Number($('pointsToRedeem').value||0);
    const loyalty=points>=5?points*10:0;
    const other=Math.max(0,Number($('otherDiscountInput').value||0));
    const taxable=Math.max(0,subtotal-loyalty-other);
    const tax=taxable*0.05;
    return {subtotal,loyalty,other,taxable,tax,total:taxable+tax};
}

function updateCashChange(){
    const total=currentBillTotals().total;
    const cash=Number($('cashReceived').value||0);
    const diff=cash-total;
    const box=$('cashChange')?.parentElement;
    if($('paymentGrandTotal'))$('paymentGrandTotal').textContent='₹'+total.toFixed(2);
    if(cash<=0){
        $('cashChange').textContent='₹0.00';
        if(box){box.classList.remove('cash-short');box.classList.add('cash-ok');$('cashResultLabel').textContent='Balance / Change:';}
    }else if(diff>=0){
        $('cashChange').textContent='₹'+diff.toFixed(2);
        if(box){box.classList.remove('cash-short');box.classList.add('cash-ok');$('cashResultLabel').textContent='Balance / Change:';}
    }else{
        $('cashChange').textContent='₹'+Math.abs(diff).toFixed(2);
        if(box){box.classList.remove('cash-ok');box.classList.add('cash-short');$('cashResultLabel').textContent='Remaining Amount:';}
    }
}

function clearBill(){
    bill=[];
    $('productSelect').value='';
    if($('productSearchInput'))$('productSearchInput').value='';closeBillingProductResults();
    $('productQuantity').value='1';
    $('productPrice').value='';
    $('pointsToRedeem').value='0';
    $('otherDiscountInput').value='0';
    $('cashReceived').value='';
    $('paymentMethod').value='CASH';
    document.querySelectorAll('.payment-tab').forEach(b=>b.classList.toggle('active',b.dataset.method==='CASH'));
    $('cashFields').style.display='block';
    $('upiFields').style.display='none';
    $('cardFields').style.display='none';
    $('upiId').value='';
    $('cardNumber').value='';
    $('cardYear').value='';
    $('cardCvv').value='';
    if($('invoiceModal')?.classList.contains('show'))closeInvoiceModal();
    renderBill();
}

async function completeSale(){
    if(!selectedCustomer){alert('Enter a valid customer mobile number first.');return;}
    if(!bill.length){alert('Add products to the bill.');return;}
    const t=currentBillTotals(),points=Number($('pointsToRedeem').value||0),method=$('paymentMethod').value;
    if(points>0&&(points<5||points>Number(selectedCustomer.reward_points||0))){alert('Check reward points. Minimum redemption is 5 and points cannot exceed available points.');return;}
    if(t.loyalty>t.subtotal){alert('Reward discount cannot exceed bill amount.');return;}
    let cash=Number($('cashReceived').value||0),upi=$('upiId').value.trim(),card=$('cardNumber').value.replace(/\D/g,''),year=$('cardYear').value.trim(),cvv=$('cardCvv').value.trim();
    if(method==='CASH'&&cash<t.total){alert('Amount received is less than the grand total.');return;}
    if(method==='UPI'&&!/^[A-Za-z0-9._-]{2,}@[A-Za-z0-9._-]{2,}$/.test(upi)){alert('Enter a valid UPI ID.');return;}
    if(method==='CARD'&&(card.length<12||!/^(20)\d{2}$/.test(year)||!/^\d{3,4}$/.test(cvv))){alert('Enter valid card number, expiry year and CVV.');return;}
    try{
        const f=new URLSearchParams({customerId:selectedCustomer.customer_id,subtotal:t.subtotal,discount:t.loyalty+t.other,loyaltyDiscount:t.loyalty,otherDiscount:t.other,tax:t.tax,total:t.total,pointsToRedeem:points,method,cashReceived:method==='CASH'?cash:t.total,upiId:upi,cardLast4:card.slice(-4),cardYear:year});
        bill.forEach(x=>{f.append('productId',x.p.product_id);f.append('quantity',x.q);f.append('price',x.p.selling_price);});
        const d=await api('sales',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:f});
        const change=Number(d.change||0);
        const billDateRaw=$('billDate').value;
        const billDate=billDateRaw?billDateRaw.split('-').reverse().join('-'):billDateRaw;
        const generatedBy=d.generatedBy||((currentUser?.userName||currentUser?.username||'User')+' ('+(currentRole||'USER')+')');
        const generatedAt=d.generatedAt||new Date().toLocaleString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
        const invoiceNo=$('invoiceNumber').value;
        const items=bill.map(x=>`<tr><td>${esc(x.p.product_name)}${x.p.variety?`<small>${esc(x.p.variety)}</small>`:''}</td><td>${x.q}</td><td>₹${Number(x.p.selling_price).toFixed(2)}</td><td>₹${(x.q*x.p.selling_price).toFixed(2)}</td></tr>`).join('');
        const paymentDetails=method==='CASH'?`<div><span>Amount Received</span><b>₹${cash.toFixed(2)}</b></div><div><span>Change</span><b>₹${change.toFixed(2)}</b></div>`:method==='UPI'?`<div><span>UPI ID</span><b>${esc(upi)}</b></div>`:`<div><span>Card</span><b>****${esc(card.slice(-4))}</b></div><div><span>Expiry</span><b>${esc(year)}</b></div>`;
        const logoDataUrl=await getBrandLogoDataUrl();
        const invoiceHtml=`<div class="invoice-sheet"><div class="invoice-store"><img class="invoice-logo" src="${logoDataUrl}" alt="SuperMart"><p>Sales &amp; Billing Invoice</p></div><div class="invoice-meta"><div><span>Invoice No</span><b>${esc(invoiceNo)}</b></div><div><span>Bill Date</span><b>${esc(billDate)}</b></div><div><span>Sale ID</span><b>${d.saleId}</b></div><div><span>Payment ID</span><b>${d.paymentId}</b></div></div><div class="invoice-customer"><div><span>Customer</span><b>${esc(selectedCustomer.customer_name)}</b></div><div><span>Mobile</span><b>${esc(selectedCustomer.mobile)}</b></div></div><div class="invoice-generated"><div><span>Generated By</span><b>${esc(generatedBy)}</b></div><div><span>Generated Date &amp; Time</span><b>${esc(generatedAt)}</b></div></div><table class="invoice-items"><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${items}</tbody></table><div class="invoice-totals"><div><span>Subtotal</span><b>₹${t.subtotal.toFixed(2)}</b></div><div><span>Loyalty Discount</span><b>- ₹${t.loyalty.toFixed(2)}</b></div><div><span>Other Discount</span><b>- ₹${t.other.toFixed(2)}</b></div><div><span>Taxable Amount</span><b>₹${t.taxable.toFixed(2)}</b></div><div><span>GST (5%)</span><b>₹${t.tax.toFixed(2)}</b></div><div class="invoice-grand"><span>GRAND TOTAL</span><b>₹${t.total.toFixed(2)}</b></div></div><div class="invoice-payment"><h4>Payment</h4><div><span>Method</span><b>${esc(method)}</b></div>${paymentDetails}</div><div class="invoice-points"><span>Points Earned</span><b>${d.earnedPoints}</b><span>Points Remaining</span><b>${d.remainingPoints}</b></div><p class="invoice-thanks">Thank you for shopping with SuperMart.</p></div>`;
        $('invoicePopupContent').innerHTML=invoiceHtml;
        window.lastInvoiceHtml=invoiceHtml;
        window.lastInvoiceNo=invoiceNo;
        openInvoiceModal();
        bill=[];selectedCustomer=null;$('customerMobile').value='';$('customerResult').innerHTML='<span class="muted">Sale completed. Enter another mobile number for the next bill.</span>';$('addCustomerFromBill').style.display='none';$('cashReceived').value='';$('paymentMethod').value='CASH';document.querySelectorAll('.payment-tab').forEach(b=>b.classList.toggle('active',b.dataset.method==='CASH'));$('cashFields').style.display='block';$('upiFields').style.display='none';$('cardFields').style.display='none';$('upiId').value='';$('cardNumber').value='';$('cardYear').value='';$('cardCvv').value='';$('pointsToRedeem').value='0';$('otherDiscountInput').value='0';generateInvoiceNumber();renderBill();
        await loadBillingProducts();await loadCustomers();await loadPayments();await loadDashboard();await loadReports();
    }catch(e){alert(e.message);}
}

async function getBrandLogoDataUrl(){
    try{
        const res=await fetch(new URL('assets/supermart-logo.png',window.location.href));
        if(!res.ok) throw new Error('Logo request failed');
        const blob=await res.blob();
        return await new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.onload=()=>resolve(reader.result);
            reader.onerror=reject;
            reader.readAsDataURL(blob);
        });
    }catch(e){
        return new URL('assets/supermart-logo.png',window.location.href).href;
    }
}

function openInvoiceModal(){const m=$('invoiceModal');if(!m)return;m.classList.add('show');m.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');}
function closeInvoiceModal(){const m=$('invoiceModal');if(!m)return;m.classList.remove('show');m.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}
function invoiceDocumentHtml(){return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(window.lastInvoiceNo||'SuperMart-Bill')}</title><style>body{font-family:Arial,sans-serif;background:#fff;color:#172033;margin:0;padding:30px}.invoice-sheet{max-width:760px;margin:auto;border:1px solid #ddd;padding:28px}.invoice-store{text-align:center;border-bottom:1px solid #ddd;padding-bottom:14px}.invoice-store .invoice-logo{display:block;width:260px;max-width:80%;height:auto;margin:0 auto 8px}.invoice-store p{margin:6px 0;color:#667085}.invoice-meta,.invoice-customer,.invoice-payment>div,.invoice-points{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.invoice-meta>div,.invoice-customer>div,.invoice-payment>div{padding:8px 0}.invoice-meta span,.invoice-customer span,.invoice-payment span{display:block;color:#667085;font-size:12px;margin-bottom:4px}.invoice-items{width:100%;border-collapse:collapse;margin:20px 0}.invoice-items th,.invoice-items td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.invoice-items small{display:block;color:#667085}.invoice-totals{margin-left:auto;max-width:380px}.invoice-totals>div{display:flex;justify-content:space-between;padding:8px 0}.invoice-grand{margin-top:8px;padding:14px;background:#eff6ff;border:2px solid #2563eb;color:#1d4ed8;font-size:18px;font-weight:800}.invoice-payment{border-top:1px solid #ddd;margin-top:20px;padding-top:12px}.invoice-thanks{text-align:center;color:#667085;margin-top:25px}</style></head><body>${window.lastInvoiceHtml||''}</body></html>`;}
function printBill(){if(!window.lastInvoiceHtml)return;const w=window.open('','_blank','width=850,height=900');if(!w){alert('Please allow pop-ups to print the bill.');return;}w.document.write(invoiceDocumentHtml());w.document.close();w.focus();setTimeout(()=>{w.print();},250);}
function downloadBill(){if(!window.lastInvoiceHtml)return;const blob=new Blob([invoiceDocumentHtml()],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(window.lastInvoiceNo||'SuperMart-Bill')+'.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

$('settingsForm').onsubmit=async e=>{e.preventDefault();try{const f=new URLSearchParams({storeName:$('storeName').value,phone:$('settingsPhone').value,email:$('settingsEmail').value,address:$('settingsAddress').value});const d=await api('settings',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:f});alert(d.message);}catch(e){alert(e.message);}};
async function loadSettings(){const d=await api('settings');$('storeName').value=d.store_name||'';$('settingsPhone').value=d.phone||'';$('settingsEmail').value=d.email||'';$('settingsAddress').value=d.address||'';$('accountUserId').value=currentUser?.userId||'';$('accountUserName').value=currentUser?.userName||'';}
async function logout(){try{await api('auth',{method:'DELETE'});}finally{location.href='index.html';}}
function debounce(fn,ms){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);};}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

async function initialize(){
    generateInvoiceNumber();
    try{const d=await api('auth');if(!d.loggedIn){window.location.replace('index.html');return;}currentUser=d;currentRole=String(d.role||'').toUpperCase();$('loggedUser').textContent=(d.userName||d.username||'User')+' ('+currentRole+')';
        if(currentRole==='STAFF'){adminOnly.forEach(id=>{const link=document.querySelector(`.sidebar a[data-section="${id}"]`);if(link)link.style.display='none';});document.querySelectorAll('.quick-admin').forEach(x=>x.style.display='none');$('staffNav').style.display='none';}
    }catch(e){console.error(e);alert('Login session could not be verified. Please login again.\n\n'+e.message);location.href='index.html';return;}
    try{await loadDashboard();await loadCustomers();await loadPayments();if(currentRole==='ADMIN'){await loadSuppliers();await loadProducts();await loadStaff();}else{await loadBillingProducts();await loadReports();}}catch(e){console.error('Initial data load:',e);alert('Some dashboard data could not be loaded: '+e.message);}
    if(location.hash)showSection(location.hash.slice(1),false);else showSection('dashboard',false);
}
initialize();
