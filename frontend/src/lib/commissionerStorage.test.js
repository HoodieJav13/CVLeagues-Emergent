import { createDraftStorage, draftScope } from "./commissionerStorage";
import { STORE_KEY, loadStore, saveWorking, setAsideUnreadable } from "./commissioner";
const admin = { backend:true, production:true, project:"https://one.supabase.co", actor:"actor-a", role:"admin", authStatus:"ready" };
const memory = () => { const data = new Map(); return { localStorage: { getItem:k => data.get(k) ?? null, setItem:(k,v) => data.set(k,v) }, data }; };
const args = { roundKey:"league|2026-10-31", expectedRevision:0, heading:"Private", body:"Draft" };
test("only ready admin plus project/actor can select backend scope; production never selects fixture", () => {
 expect(draftScope(admin)).toBeTruthy();
 for (const patch of [{role:"anonymous"},{role:"player"},{authStatus:"checking"},{authStatus:"mfa_challenge"},{authStatus:"unauthorized"},{actor:null},{project:null},{project:"bad"}]) expect(draftScope({...admin,...patch})).toBeNull();
 expect(draftScope({backend:false,mock:true,production:true,role:"admin"})).toBeNull();
 expect(draftScope({backend:false,mock:true,production:false,role:"admin"})).toContain("fixture");
});
test("actor, project and fixture scopes neither load nor overwrite each other's drafts", () => {
 const browser=memory(), a=createDraftStorage(browser,draftScope(admin));
 saveWorking(a,args); const raw=browser.localStorage.getItem(a.keyFor(STORE_KEY));
 for (const scope of [draftScope({...admin,actor:"actor-b"}),draftScope({...admin,project:"https://two.supabase.co"}),draftScope({backend:false,mock:true,production:false,role:"admin"})]) {
  const other=createDraftStorage(browser,scope); expect(loadStore(other).status).toBe("empty"); saveWorking(other,{...args,body:"Other"});
  expect(a.acceptsEvent(other.keyFor(STORE_KEY))).toBe(false);
 }
 expect(browser.localStorage.getItem(a.keyFor(STORE_KEY))).toBe(raw);
 expect(loadStore(a).doc.rounds[args.roundKey].working.body).toBe("Draft");
});
test("foreign copied envelope is refused untouched and recovery preserves exact bytes", () => {
 const browser=memory(), a=createDraftStorage(browser,draftScope(admin)), b=createDraftStorage(browser,draftScope({...admin,actor:"actor-b"}));
 saveWorking(a,args); const foreign=browser.localStorage.getItem(a.keyFor(STORE_KEY)); browser.localStorage.setItem(b.keyFor(STORE_KEY),foreign);
 expect(loadStore(b).writable).toBe(false); expect(saveWorking(b,args).ok).toBe(false);
 expect(browser.localStorage.getItem(b.keyFor(STORE_KEY))).toBe(foreign);
 const recovered=setAsideUnreadable(b); expect(recovered.ok).toBe(true); expect(b.getItem(recovered.setAsideKey)).toBe(foreign);
 expect(browser.localStorage.getItem(a.keyFor(STORE_KEY))).toBe(foreign);
});
test("a write with no exact readback never reports success", () => {
 const browser=memory(), a=createDraftStorage(browser,draftScope(admin));
 browser.localStorage.setItem=()=>{};
 expect(saveWorking(a,args)).toMatchObject({ok:false,code:"write-unconfirmed"});
 expect(loadStore(a).doc.rounds).toEqual({});
});

test("bare valid document copied into a foreign scoped key is not trusted", () => {
 const browser=memory(), a=createDraftStorage(browser,draftScope(admin)), b=createDraftStorage(browser,draftScope({...admin,actor:"actor-b"}));
 saveWorking(a,args); const bare=a.getItem(STORE_KEY); browser.localStorage.setItem(b.keyFor(STORE_KEY),bare);
 expect(loadStore(b).writable).toBe(false); expect(browser.localStorage.getItem(b.keyFor(STORE_KEY))).toBe(bare);
 const recovered=setAsideUnreadable(b); expect(recovered.ok).toBe(true); expect(b.getItem(recovered.setAsideKey)).toBe(bare);
});
