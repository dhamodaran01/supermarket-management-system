/* SuperMart static edition: browser localStorage replaces Servlet/API and MySQL storage. */
(function(){
  const DB='supermart_static_v1';
  const defaults={users:[{userId:1,username:'admin',userName:'Administrator',email:'admin@supermart.local',password:'admin123',role:'ADMIN',created_at:new Date().toLocaleString()}],products:[],suppliers:[],customers:[],payments:[],sales:[],settings:{store_name:'SuperMart',phone:'',email:'',address:''},counter:[],next:{product:1,supplier:1,customer:1,staff:2,sale:1,payment:1}};
  function read(){try{const d=JSON.parse(localStorage.getItem(DB));return d&&typeof d==='object'?Object.assign(structuredClone(defaults),d):structuredClone(defaults)}catch(e){return structuredClone(defaults)}}
  function save(d){localStorage.setItem(DB,JSON.stringify(d))}
  let db=read(); if(!localStorage.getItem(DB))save(db);
  const params=body=>{if(body instanceof URLSearchParams)return Object.fromEntries(body.entries());if(typeof body==='string')return Object.fromEntries(new URLSearchParams(body).entries());return body||{}}
  const num=v=>Number(v||0); const today=()=>new Date().toISOString().slice(0,10);
  function result(message,extra={}){return Object.assign({success:true,message},extra)}
  function listBy(path){return db[path]||[]}
  async function api(path,opts={}){
    const method=(opts.method||'GET').toUpperCase(), url=new URL(path,location.href), route=url.pathname.split('/').filter(Boolean).pop(), q=url.searchParams, b=params(opts.body);
    if(route==='auth'){
      if(method==='GET'){const u=JSON.parse(localStorage.getItem('supermart_current_user')||'null');return u?Object.assign({loggedIn:true},u):{loggedIn:false}}
      if(method==='DELETE'){localStorage.removeItem('supermart_current_user');return result('Logged out')}
      if(method==='POST'){
        const action=b.action||'login',role=String(b.role||'admin').toUpperCase(),username=String(b.username||'').trim(),email=String(b.email||'').trim(),password=String(b.password||'');
        if(!username||!password)throw Error('Enter username and password');
        if(action==='register'){
          if(db.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))throw Error('Username already exists');
          const user={userId:db.next.staff++,username,userName:username,email,password,role,created_at:new Date().toLocaleString()};db.users.push(user);save(db);localStorage.setItem('supermart_current_user',JSON.stringify(user));return result('Registration successful')
        }
        const user=db.users.find(u=>u.username.toLowerCase()===username.toLowerCase()&&u.password===password&&u.role===role);
        if(!user)throw Error('Invalid username, password, or role. Default login: admin / admin123');
        localStorage.setItem('supermart_current_user',JSON.stringify(user));return result('Login successful')
      }
    }
    const current=JSON.parse(localStorage.getItem('supermart_current_user')||'null');
    if(route==='dashboard'){
      const sales=db.sales.filter(s=>s.date===today());return {products:db.products.length,stock:db.products.reduce((a,p)=>a+num(p.stock),0),customers:db.customers.length,suppliers:db.suppliers.length,low_stock:db.products.filter(p=>num(p.stock)>0&&num(p.stock)<=5).length,out_stock:db.products.filter(p=>num(p.stock)<=0).length,today_sales:sales.length,revenue:sales.reduce((a,s)=>a+num(s.total),0)}
    }
    if(route==='billing-products')return db.products.filter(p=>num(p.stock)>0);
    if(route==='products'){
      if(method==='GET'){const id=q.get('productId');return id?db.products.find(p=>p.product_id===num(id))||{}:db.products}
      if(method==='POST'||method==='PUT'){
        const id=num(b.productId), supplier=db.suppliers.find(s=>s.supplier_id===num(b.supplierId));let p={product_id:id||db.next.product++,category_type:b.categoryType||'',product_name:b.productName||'',variety:b.variety||'',actual_price:num(b.actualPrice),selling_price:num(b.sellingPrice),stock:num(b.stock),unit:b.unit||'pcs',supplier_id:num(b.supplierId),supplier_name:supplier?.supplier_name||'',supplier_cost:num(b.supplierCost)};
        const i=db.products.findIndex(x=>x.product_id===id);if(i>=0)db.products[i]=p;else db.products.push(p);save(db);return result(i>=0?'Product updated':'Product added')
      }
      if(method==='DELETE'){db.products=db.products.filter(p=>p.product_id!==num(q.get('productId')));save(db);return result('Product deleted')}
    }
    if(route==='stock'){
      const p=db.products.find(x=>x.product_id===num(b.productId));if(!p)throw Error('Product not found');if(method==='PUT')p.stock=num(b.stock);else if(method==='POST')p.stock+=num(b.quantity);save(db);return result('Stock updated')
    }
    if(route==='suppliers'){
      if(method==='GET'){const id=q.get('supplierId');return id?db.suppliers.find(s=>s.supplier_id===num(id))||{}:db.suppliers}
      if(method==='POST'||method==='PUT'){const id=num(b.supplierId),s={supplier_id:id||db.next.supplier++,supplier_code:b.supplierCode||'',supplier_name:b.supplierName||'',phone:b.phone||'',email:b.email||'',address:b.address||'',product_name:b.productName||'',variety:b.variety||'',supplier_cost:num(b.supplierCost),unit:b.unit||''};const i=db.suppliers.findIndex(x=>x.supplier_id===id);if(i>=0)db.suppliers[i]=s;else db.suppliers.push(s);save(db);return result(i>=0?'Supplier updated':'Supplier added')}
      if(method==='DELETE'){db.suppliers=db.suppliers.filter(s=>s.supplier_id!==num(q.get('supplierId')));save(db);return result('Supplier deleted')}
    }
    if(route==='supplier-compare'){const term=(q.get('productName')||'').toLowerCase();return db.suppliers.filter(s=>(s.product_name||'').toLowerCase().includes(term))}
    if(route==='customers'){
      if(method==='GET'){const id=q.get('customerId');return id?db.customers.find(c=>c.customer_id===num(id))||{}:db.customers}
      if(method==='POST'||method==='PUT'){const id=num(b.customerId),c={customer_id:id||db.next.customer++,name:b.name||'',mobile:b.mobile||'',email:b.email||'',address:b.address||'',reward_points:0};const i=db.customers.findIndex(x=>x.customer_id===id);if(i>=0)db.customers[i]=Object.assign(db.customers[i],c);else db.customers.push(c);save(db);return result(i>=0?'Customer updated':'Customer added')}
      if(method==='DELETE'){db.customers=db.customers.filter(c=>c.customer_id!==num(q.get('customerId')));save(db);return result('Customer deleted')}
    }
    if(route==='customer-by-mobile'){return db.customers.find(c=>c.mobile===q.get('mobile'))||{}}
    if(route==='staff'){
      if(method==='GET')return db.users.filter(u=>u.role==='STAFF').map(({password,...u})=>({staff_id:u.userId,username:u.username,email:u.email,created_at:u.created_at}));
      if(method==='POST'){if(db.users.some(u=>u.username===b.username))throw Error('Username already exists');db.users.push({userId:db.next.staff++,username:b.username,userName:b.username,email:b.email,password:b.password,role:'STAFF',created_at:new Date().toLocaleString()});save(db);return result('Staff account added')}
    }
    if(route==='sales'&&method==='POST'){
      const ids=opts.body instanceof URLSearchParams?opts.body.getAll('productId'):new URLSearchParams(String(opts.body||'')).getAll('productId');const quantities=opts.body instanceof URLSearchParams?opts.body.getAll('quantity'):new URLSearchParams(String(opts.body||'')).getAll('quantity');const prices=opts.body instanceof URLSearchParams?opts.body.getAll('price'):new URLSearchParams(String(opts.body||'')).getAll('price');
      const items=ids.map((id,i)=>{const p=db.products.find(x=>x.product_id===num(id));if(!p)throw Error('Product not found');if(num(p.stock)<num(quantities[i]))throw Error('Insufficient stock for '+p.product_name);p.stock-=num(quantities[i]);return {product_id:p.product_id,product_name:p.product_name,quantity:num(quantities[i]),price:num(prices[i]),amount:num(quantities[i])*num(prices[i])}});
      const sale={sale_id:db.next.sale++,date:today(),customer_id:num(b.customerId),customer_name:db.customers.find(c=>c.customer_id===num(b.customerId))?.name||'',subtotal:num(b.subtotal),discount:num(b.discount),tax:num(b.tax),total:num(b.total),method:b.method||'CASH',items,created_by:current?.username||'User'};db.sales.push(sale);db.payments.push({payment_id:db.next.payment++,sale_id:sale.sale_id,payment_date:sale.date,date:sale.date,customer_name:sale.customer_name,mobile:db.customers.find(c=>c.customer_id===sale.customer_id)?.mobile||'',amount:sale.total,method:sale.method,cash_received:num(b.cashReceived),change_amount:Math.max(0,num(b.cashReceived)-sale.total),payment_reference:b.upiId||b.cardLast4||'',status:'PAID',staff_name:sale.created_by,created_by:sale.created_by});save(db);return result('Sale completed', {saleId:sale.sale_id,invoiceNo:'INV-'+String(sale.sale_id).padStart(5,'0')})
    }
    if(route==='payments')return db.payments;
    if(route==='reports'){
      const date=q.get('date')||today(),period=q.get('period')||'DAILY';const sales=db.sales.filter(s=>!q.get('date')||s.date===date);const revenue=sales.reduce((a,s)=>a+num(s.total),0);const pay=sales.map(s=>db.payments.find(p=>p.sale_id===s.sale_id)).filter(Boolean);const sumBy=m=>pay.filter(p=>p.method===m).reduce((a,p)=>a+num(p.amount),0);const items=sales.flatMap(s=>s.items||[]);const itemMap={};items.forEach(i=>{const k=i.product_name;itemMap[k]=itemMap[k]||{product_name:k,quantity_sold:0,unit:db.products.find(p=>p.product_id===i.product_id)?.unit||'',revenue:0};itemMap[k].quantity_sold+=num(i.quantity);itemMap[k].revenue+=num(i.amount)});const summary={products:db.products.length,stock_value:db.products.reduce((a,p)=>a+num(p.stock)*num(p.selling_price),0),customers:db.customers.length,suppliers:db.suppliers.length,today_sales:sales.length,today_revenue:revenue,staff_count:db.users.filter(u=>u.role==='STAFF').length,admin_count:db.users.filter(u=>u.role==='ADMIN').length};const userType=q.get('userType');const userId=num(q.get('userId'));const user=userType?db.users.find(u=>u.role===userType&&u.userId===userId):null;const userSales=user?db.sales.filter(s=>s.created_by===user.username):[];return {date,period,rangeLabel:period+' report - '+date,summary,periodSummary:{sales_count:sales.length,revenue,cash:sumBy('CASH'),upi:sumBy('UPI'),card:sumBy('CARD'),discount:sales.reduce((a,s)=>a+num(s.discount),0),tax:sales.reduce((a,s)=>a+num(s.tax),0),items_sold:items.reduce((a,i)=>a+num(i.quantity),0)},periodSales:sales.map(s=>({sale_id:s.sale_id,user_name:s.created_by,customer_name:s.customer_name,subtotal:s.subtotal,discount:s.discount,tax:s.tax,grand_total:s.total,sale_date:s.date})),periodItems:Object.values(itemMap),todaySales:sales.map(s=>({sale_id:s.sale_id,user_name:s.created_by,customer_name:s.customer_name,grand_total:s.total,sale_date:s.date})),daily:{payment_count:pay.length,cash:sumBy('CASH'),upi:sumBy('UPI'),card:sumBy('CARD'),total:revenue},closure:db.counter.find(c=>c.date===date&&c.user===(current?.username||''))?{counter_status:'CLOSED'}:{counter_status:'OPEN'},payments:user?db.payments.filter(p=>userSales.some(s=>s.sale_id===p.sale_id)):db.payments,staff:current?{username:current.username,email:current.email,created_at:current.created_at}:null,user:user?{username:user.username,email:user.email,created_at:user.created_at,sales_count:userSales.length,revenue:userSales.reduce((a,s)=>a+num(s.total),0),cash:0,upi:0,card:0}:null,closures:db.counter.filter(c=>c.user===user?.username),generatedBy:current?.username||'User'}
    }
    if(route==='settings'){
      if(method==='GET')return db.settings;if(method==='POST'){db.settings={store_name:b.storeName||'',phone:b.phone||'',email:b.email||'',address:b.address||''};save(db);return result('Settings saved')}
    }
    if(route==='counter-open'||route==='counter-close'){if(method==='POST'){db.counter.push({type:route,date:b.date||today(),cash:num(b.cashEntered),upi:num(b.upiEntered),card:num(b.cardEntered),user:current?.username||'User'});save(db);return result('Counter record saved')}return {message:'No counter record'}}
    if(route==='counter-close-admin'){if(method==='PUT')return result('Counter close updated');return db.counter}
    throw Error('This feature is not available in static mode: '+route);
  }
  window.supermartLocalApi=api;
  window.supermartLocalDB={read:()=>read(),save:save};
})();
