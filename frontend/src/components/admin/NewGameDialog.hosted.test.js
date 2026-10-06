import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppStateProvider, useApp } from "../../context/AppStateContext";
import NewGameDialog from "./NewGameDialog";
import * as backend from "../../lib/backend";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("@/lib/utils", () => ({ cn: (...classes) => classes.filter(Boolean).join(" ") }), { virtual: true });
jest.mock("@/components/ui/button", () => jest.requireActual("../ui/button"), { virtual: true });
jest.mock("../../lib/supabase", () => ({ BACKEND_ENABLED: true, supabase: { from: jest.fn() } }));
jest.mock("../../context/RoleContext", () => ({ useRole: () => ({ role: "admin" }) }));
jest.mock("../../lib/backend", () => ({ ...jest.requireActual("../../lib/backend"), fetchAppState: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
const state = { leagues: [{id:"l1",name:"League",sport:"kickball",kind:"league",season:"2027"}], teams:[{id:"t1",name:"A",league_id:"l1"},{id:"t2",name:"B",league_id:"l1"}],venues:[{id:"v1",name:"Park",status:"active"}],games:[] };
let current;
function Probe(){ const app=useApp();current=app;const [open,setOpen]=useState(true);return <NewGameDialog app={app} open={open} onOpenChange={setOpen}/>; }
const setValue=(id,value)=> {const el=document.querySelector(`[data-testid="new-game-${id}"]`); const proto=el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(el,value);el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input",{bubbles:true}));};
test("committed INSERT with refresh failure recovers on retry and closes with one persisted game", async()=>{
  const spy=jest.spyOn(console,"error").mockImplementation(()=>{});
  backend.fetchAppState.mockResolvedValueOnce(state).mockRejectedValueOnce(new Error("fetch games: network down")).mockImplementation(async () => ({...state, games: [...rows.values()]}));
  const rows=new Map();
  const insert=jest.fn(async(row)=>{
    if(rows.has(row.id))return {error:{code:"23505",message:"duplicate key value violates unique constraint games_pkey"}};
    rows.set(row.id,row); return {error:null};
  });
  const select = jest.fn(() => ({ eq: (key, id) => ({ maybeSingle: async () => ({ data: rows.get(id) || null, error: null }) }) }));
  supabase.from.mockReturnValue({insert, select});
  const container=document.createElement("div");document.body.appendChild(container);const root=createRoot(container);
  await act(async()=>root.render(<AppStateProvider><Probe/></AppStateProvider>));
  for(const [id,value] of Object.entries({league:"l1",home:"t1",away:"t2",start:"2027-04-01T19:00",venue:"v1"})) await act(async()=>setValue(id,value));
  for(let i=0;i<2;i++)await act(async()=>document.querySelector('[data-testid="new-game-save"]').click());
  expect(rows.size).toBe(1);
  expect(insert).toHaveBeenCalledTimes(2);
  expect(backend.fetchAppState).toHaveBeenCalledTimes(3); // mount + failed refresh + successful retry
  expect(current.state.games).toEqual([...rows.values()]);
  expect(document.querySelector('[data-testid="new-game-dialog"]')).toBeNull();
  expect(toast.success).toHaveBeenCalledWith("Game scheduled");
  expect(toast.error.mock.calls.map(c=>c[0])).toEqual(["fetch games: network down"]);
  await act(async()=>root.unmount());container.remove();spy.mockRestore();
});
