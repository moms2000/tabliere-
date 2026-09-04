/**
 * Test d'intégration SÉCURITÉ des routes — TablièreCI
 *
 * Sonde les propriétés de sécurité des routes contre un serveur EN COURS :
 * authentification requise (401), rôles (403), isolation inter-restaurant
 * (IDOR), denyStaff, requireTab (onglets staff), correctif messagerie,
 * anti-SSRF webhook, garde-fou Mode Vitrine.
 *
 * Nécessite : un backend démarré + une base PostgreSQL de TEST (jamais la prod).
 * Le plus simple : `npm run test:security` (démarre/arrête le serveur tout seul).
 * Manuel : démarrer le serveur puis
 *   BASE_URL=http://localhost:4021/api/v1 DATABASE_URL=postgresql://localhost:5432/tabliere_otp \
 *   node test/security/routes-security.mjs
 *
 * Le test crée des comptes/restaurants temporaires et les supprime à la fin.
 */
import bcrypt from "bcryptjs";
import pg from "pg";

const BASE = process.env.BASE_URL || "http://localhost:4021/api/v1";
const DB   = process.env.DATABASE_URL || "postgresql://localhost:5432/tabliere_otp";
if (/render|onrender|amazonaws|neon\.tech|supabase/i.test(DB)) {
  console.error("REFUS : DATABASE_URL ressemble à une base distante/production. Utilise une base de test locale.");
  process.exit(2);
}
const pool = new pg.Pool({ connectionString: DB });

const mkUser = async (phone, email, pass, role) => {
  const h = await bcrypt.hash(pass, 12);
  await pool.query("DELETE FROM users WHERE email=$1 OR phone=$2", [email, phone]);
  const { rows:[u] } = await pool.query(
    `INSERT INTO users (phone,email,password_hash,full_name,role,status,email_verified,phone_verified)
     VALUES ($1,$2,$3,$4,$5,'actif',true,true) RETURNING id`, [phone,email,h,"T "+role,role]);
  return u.id;
};
const mkResto = async (ownerId, name, slug, mode="restaurant") => {
  await pool.query("DELETE FROM restaurants WHERE slug=$1", [slug]);
  const { rows:[r] } = await pool.query(
    `INSERT INTO restaurants (owner_id,name,slug,status,is_published,listing_mode,capacity)
     VALUES ($1,$2,$3,'actif',true,$4,20) RETURNING id`, [ownerId,name,slug,mode]);
  return r.id;
};
const login = async (phone, pass) => {
  const r = await fetch(BASE+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:phone,password:pass})});
  return (await r.json())?.data?.access_token;
};
const call = (path, tok, method="GET", body) => fetch(BASE+path,{method,
  headers:{"Content-Type":"application/json",...(tok?{Authorization:`Bearer ${tok}`}:{})},
  body: (body && method!=="GET" && method!=="HEAD")?JSON.stringify(body):undefined});
const st = async (...a) => (await call(...a)).status;

const checks=[]; const ok=(n,cond,d="")=>{checks.push({n,ok:cond,d});};

const cleanup = async (ids, slugs) => {
  await pool.query("DELETE FROM reservations WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = ANY($1))",[slugs]).catch(()=>{});
  await pool.query("DELETE FROM restaurant_staff WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = ANY($1))",[slugs]).catch(()=>{});
  await pool.query("DELETE FROM menu_items WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = ANY($1))",[slugs]).catch(()=>{});
  await pool.query("DELETE FROM menu_categories WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = ANY($1))",[slugs]).catch(()=>{});
  await pool.query("DELETE FROM restaurants WHERE slug = ANY($1)",[slugs]).catch(()=>{});
  await pool.query("DELETE FROM users WHERE id = ANY($1)",[ids]).catch(()=>{});
};

const SLUGS = ["resto-a-sec","resto-b-sec"];
let ids = [];
try {
  await cleanup([], SLUGS); // au cas où un run précédent a laissé des restes
  const adminId = await mkUser("2250700000061","adm@sec.ci","Adminpass123","admin");
  const oaId    = await mkUser("2250700000062","oa@sec.ci","Ownerpass123","restaurateur");
  const obId    = await mkUser("2250700000063","ob@sec.ci","Ownerpass123","restaurateur");
  const clId    = await mkUser("2250700000064","cl@sec.ci","Clientpass123","client");
  ids = [adminId,oaId,obId,clId];
  const A = await mkResto(oaId,"Resto A SEC","resto-a-sec");
  const B = await mkResto(obId,"Resto B SEC","resto-b-sec");
  await pool.query("UPDATE users SET restaurant_id=$1 WHERE id=$2",[A,oaId]);
  await pool.query("UPDATE users SET restaurant_id=$1 WHERE id=$2",[B,obId]);
  const { rows:[cat] } = await pool.query("INSERT INTO menu_categories (restaurant_id,name,position) VALUES ($1,'Cat',0) RETURNING id",[A]);
  const { rows:[item] } = await pool.query("INSERT INTO menu_items (category_id,restaurant_id,name,price,is_active,position) VALUES ($1,$2,'Plat A',1000,true,0) RETURNING id",[cat.id,A]);

  const adm = await login("2250700000061","Adminpass123");
  const oa  = await login("2250700000062","Ownerpass123");
  const ob  = await login("2250700000063","Ownerpass123");
  const cl  = await login("2250700000064","Clientpass123");
  ok("Connexions (admin,ownerA,ownerB,client)", adm&&oa&&ob&&cl);

  await call("/restaurant-staff", oa, "POST", { name:"Serveur", login_id:"SERVSEC", pin:"1234", permissions:["menu"] });
  const slog = await (await call("/restaurant-staff/login", null, "POST", { login_id:"SERVSEC", pin:"1234" })).json();
  const staff = slog?.data?.token;
  ok("Staff créé + connecté", !!staff);

  // 1. Auth requise
  {
    const routes = [["GET","/auth/me"],["GET","/admin/stats"],["PATCH",`/restaurants/${A}`],["GET","/sessions"],["PATCH","/users/me"],["POST","/menu/categories"]];
    let all401=true, detail=[];
    for (const [m,p] of routes){ const s=await st(p,null,m,{x:1}); if(s!==401){all401=false; detail.push(`${p}:${s}`);} }
    ok("Routes protégées → 401 sans token", all401, detail.join(","));
  }
  // 2. Rôle client bloqué
  ok("client → /admin/stats = 403", await st("/admin/stats",cl)===403);
  ok("client → PATCH /restaurants/A = 403", await st(`/restaurants/${A}`,cl,"PATCH",{name:"x"})===403);
  ok("client → POST /menu/categories = 403", await st("/menu/categories",cl,"POST",{name:"x"})===403);
  ok("client → GET /sessions = 403", await st("/sessions",cl)===403);
  // 3. Owner non-admin
  ok("ownerA → /admin/stats = 403", await st("/admin/stats",oa)===403);
  // 4. IDOR inter-restaurant
  {
    const s1 = await st(`/restaurants/${A}`, ob, "PATCH", { name:"HACKED" });
    ok("ownerB → PATCH restoA ≠ 200 (IDOR bloqué)", s1!==200, `statut=${s1}`);
    const { rows:[r] } = await pool.query("SELECT name FROM restaurants WHERE id=$1",[A]);
    ok("Nom restoA inchangé", r.name==="Resto A SEC", r.name);
    ok("ownerB → GET restoA/manage ≠ 200", (await st(`/restaurants/${A}/manage`,ob))!==200);
    ok("ownerB → PATCH menu item de A ≠ 200", (await st(`/menu/items/${item.id}`,ob,"PATCH",{name:"x"}))!==200);
  }
  // 5. denyStaff
  ok("staff → GET /auth/me = 403", await st("/auth/me",staff)===403);
  ok("staff → PATCH /users/me = 403", await st("/users/me",staff,"PATCH",{full_name:"x"})===403);
  ok("staff → POST /restaurant-staff = 403", await st("/restaurant-staff",staff,"POST",{name:"x",login_id:"ZZ",pin:"1111"})===403);
  // 6. requireTab (staff perms=['menu'])
  ok("staff(menu) → PATCH /restaurants/A [profil] = 403", await st(`/restaurants/${A}`,staff,"PATCH",{name:"x"})===403);
  ok("staff(menu) → GET /reservations [reservations] = 403", await st("/reservations",staff)===403);
  ok("staff(menu) → POST /menu/categories [menu] = OK", [200,201].includes(await st("/menu/categories",staff,"POST",{name:"Cat Staff"})));
  // 7. chat requireTab
  ok("staff(menu) → GET /chat/conversations = 403", await st("/chat/conversations",staff)===403);
  ok("ownerA → GET /chat/conversations ≠ 403", (await st("/chat/conversations",oa))!==403);
  // 7b. webhook anti-SSRF
  ok("webhook 127.0.0.1 = 400 (SSRF bloqué)", await st("/integration",oa,"PATCH",{webhook_url:"https://127.0.0.1/hook"})===400);
  ok("webhook public https = 200", (await st("/integration",oa,"PATCH",{webhook_url:"https://example.com/hook"}))===200);
  // 8. Garde-fou vitrine
  {
    await pool.query("UPDATE restaurants SET listing_mode='vitrine' WHERE id=$1",[A]);
    const future=new Date(Date.now()+3*86400000).toISOString();
    ok("Réservation sur vitrine = 409", await st("/reservations",cl,"POST",{restaurant_id:A,reserved_at:future,party_size:2})===409);
    await pool.query("UPDATE restaurants SET listing_mode='restaurant' WHERE id=$1",[A]);
  }

  let pass=0;
  for(const c of checks){ console.log(`  ${c.ok?"✓":"✗"} ${c.n}${c.ok?"":"  → "+c.d}`); if(c.ok)pass++; }
  console.log(`\n[routes-security] ${pass}/${checks.length} OK`);
  await cleanup(ids, SLUGS);
  await pool.end();
  process.exit(pass===checks.length?0:1);
} catch (e) {
  console.error("ERREUR:", e.message);
  await cleanup(ids, SLUGS).catch(()=>{});
  await pool.end().catch(()=>{});
  process.exit(2);
}
