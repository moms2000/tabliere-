/**
 * Test d'intégration SÉCURITÉ — auth des opérations d'événement (ownerOrStaff).
 * Vérifie qu'un jeton organisateur valide accède aux event-ops, mais qu'un
 * jeton émis avant un reset de mot de passe (sessions_valid_from) ou d'un
 * compte suspendu est refusé — au même titre que sur l'API principale.
 *
 * Nécessite un backend démarré + une base de TEST. Voir routes-security.mjs.
 */
import bcrypt from "bcryptjs";
import pg from "pg";

const BASE = process.env.BASE_URL || "http://localhost:4021/api/v1";
const DB   = process.env.DATABASE_URL || "postgresql://localhost:5432/tabliere_otp";
if (/render|onrender|amazonaws|neon\.tech|supabase/i.test(DB)) {
  console.error("REFUS : DATABASE_URL ressemble à une base distante/production.");
  process.exit(2);
}
const pool = new pg.Pool({ connectionString: DB });

let uid, eid;
try {
  const h = await bcrypt.hash("Orgpass123", 12);
  await pool.query("DELETE FROM events WHERE slug='evt-auth-sec'");
  await pool.query("DELETE FROM users WHERE email='orgauth@sec.ci'");
  const { rows:[u] } = await pool.query(
    `INSERT INTO users (phone,email,password_hash,full_name,role,status,email_verified,phone_verified)
     VALUES ('2250700000071','orgauth@sec.ci',$1,'Org','organisateur','actif',true,true) RETURNING id`, [h]);
  uid = u.id;
  const { rows:[e] } = await pool.query(
    "INSERT INTO events (owner_id,name,slug,starts_at) VALUES ($1,'Evt Auth','evt-auth-sec',NOW()+INTERVAL '2 days') RETURNING id", [uid]);
  eid = e.id;

  const login = async () => {
    const r = await fetch(BASE+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:"2250700000071",password:"Orgpass123"})});
    return (await r.json())?.data?.access_token;
  };
  const hit = async (tok) => (await fetch(BASE+`/event-orders?event_id=${eid}`,{headers:{Authorization:`Bearer ${tok}`}})).status;

  let pass=0,tot=0; const ok=(n,c,d="")=>{tot++;if(c)pass++;console.log(`  ${c?"✓":"✗"} ${n}${c?"":"  → "+d}`);};
  const tok = await login();
  ok("Organisateur valide → event-ops accessible", ![401,403].includes(await hit(tok)));
  await pool.query("UPDATE users SET sessions_valid_from=NOW()+INTERVAL '5 minutes' WHERE id=$1",[uid]);
  ok("Jeton pré-reset (sessions_valid_from) → 401", await hit(tok)===401);
  await pool.query("UPDATE users SET sessions_valid_from=NULL, status='suspendu' WHERE id=$1",[uid]);
  ok("Compte suspendu → event-ops refusé", [401,403].includes(await hit(tok)));

  console.log(`\n[event-auth] ${pass}/${tot} OK`);
  await pool.query("DELETE FROM events WHERE id=$1",[eid]);
  await pool.query("DELETE FROM users WHERE id=$1",[uid]);
  await pool.end();
  process.exit(pass===tot?0:1);
} catch (e) {
  console.error("ERREUR:", e.message);
  if (eid) await pool.query("DELETE FROM events WHERE id=$1",[eid]).catch(()=>{});
  if (uid) await pool.query("DELETE FROM users WHERE id=$1",[uid]).catch(()=>{});
  await pool.end().catch(()=>{});
  process.exit(2);
}
