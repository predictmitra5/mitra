/** Exact USD cents and whole binary contracts. No funding or grant command exists. */
export type Outcome = "yes" | "no";
export type Direction = "buy" | "sell";
export type Terms = { id: string; cutoff: number; resultsDeadline: number; source: string; yes: string; no: string; status: "open" | "paused" | "closed" | "settled" | "void"; outcome?: Outcome; insiders: string[] };
export type Order = { id: string; userId: string; marketId: string; outcome: Outcome; direction: Direction; price: number; quantity: number; remaining: number; sequence: number; createdAt: number; status: "open" | "filled" | "cancelled" };
export type Fill = { id: string; marketId: string; makerId: string; takerId: string; makerUserId: string; takerUserId: string; outcome: Outcome; price: number; quantity: number; kind: "pair" | "transfer"; at: number };
export type Posting = { account: string; cents: number };
export type Journal = { id: string; kind: string; postings: Posting[]; at: number; reverses?: string };
export type Holding = { userId: string; marketId: string; outcome: Outcome; available: number; reserved: number };
export type State = { sequence: number; markets: Record<string, Terms>; orders: Order[]; fills: Fill[]; holdings: Holding[]; journal: Journal[]; requests: Record<string, { payload: string; result: string }> };
export type OrderInput = { id: string; marketId: string; outcome: Outcome; direction: Direction; price: number; quantity: number };
export class ExchangeError extends Error { constructor(public code: string, message: string) { super(message); } }
export const emptyState = (): State => ({ sequence: 0, markets: {}, orders: [], fills: [], holdings: [], journal: [], requests: {} });
export const accountKey = (userId: string, kind: "available" | "reserved") => `user:${userId}:${kind}`;
const escrow = (marketId: string) => `escrow:${marketId}`;
const other = (side: Outcome): Outcome => side === "yes" ? "no" : "yes";
function fail(code: string, message: string): never { throw new ExchangeError(code, message); }
function natural(n: number, max = 1_000_000_000_000) { if (!Number.isSafeInteger(n) || n < 0 || n > max) fail("INVALID_AMOUNT", "Use whole contract quantities and cent prices within the allowed limits."); return n; }
export function balance(state: State, account: string) { return state.journal.flatMap(j => j.postings).filter(p => p.account === account).reduce((sum, p) => { const next = sum + p.cents; if (!Number.isSafeInteger(next)) fail("ACCOUNTING", "The account requires reconciliation."); return next; }, 0); }
export function funds(state: State, userId: string) { return { available: balance(state, accountKey(userId, "available")), reserved: balance(state, accountKey(userId, "reserved")) }; }
function post(state: State, id: string, kind: string, at: number, postings: Posting[]) {
  if (state.journal.some(j => j.id === id)) fail("DUPLICATE_JOURNAL", "This journal entry already exists.");
  if (postings.some(p => !Number.isSafeInteger(p.cents)) || postings.reduce((n,p) => n+p.cents,0) !== 0) fail("ACCOUNTING", "Journal entries must balance.");
  const entry = { id, kind, at, postings: postings.filter(p => p.cents !== 0) };
  state.journal.push(entry);
  for (const account of new Set(postings.map(p => p.account))) if (account !== "custody:settled" && balance(state, account) < 0) fail("INSUFFICIENT_FUNDS", "Verified settled funds are required. Deposits are unavailable.");
}
function move(state: State, id: string, kind: string, at: number, from: string, to: string, cents: number) { natural(cents); post(state,id,kind,at,[{account:from,cents:-cents},{account:to,cents}]); }
function holding(state: State, userId: string, marketId: string, outcome: Outcome) { let p=state.holdings.find(p=>p.userId===userId&&p.marketId===marketId&&p.outcome===outcome); if(!p) { p={userId,marketId,outcome,available:0,reserved:0}; state.holdings.push(p); } return p; }
function repeat(state: State, key: string, payload: unknown) { const previous=state.requests[key]; if(previous&&previous.payload!==JSON.stringify(payload)) fail("IDEMPOTENCY_MISMATCH","This request identifier was already used for a different instruction."); return previous; }
function validateTerms(m: Terms) { if (!m.id || !m.source || !m.yes || !m.no || !Number.isSafeInteger(m.cutoff) || !Number.isSafeInteger(m.resultsDeadline) || m.resultsDeadline < m.cutoff) fail("INVALID_TERMS","Publish explicit terms, a source and valid cutoffs before opening a market."); }
/** Call on a private working copy; errors never modify the caller's state. */
export function placeOrder(original: State, userId: string, input: OrderInput, now: number): State {
  const state=structuredClone(original), key=`order:${userId}:${input.id}`;
  if(repeat(state,key,input)) return state;
  if(!input.id||!userId||!(["yes","no"] as unknown[]).includes(input.outcome)||!(["buy","sell"] as unknown[]).includes(input.direction)) fail("INVALID_ORDER","Choose an outcome and order direction.");
  natural(input.price,99); natural(input.quantity,1_000_000); if(input.price<1||input.quantity<1) fail("INVALID_ORDER","Prices must be 1–99 cents and quantities must be positive whole contracts.");
  if(state.orders.some(o=>o.id===input.id)) fail("DUPLICATE_ORDER","The order identifier already exists.");
  const market=state.markets[input.marketId]; if(!market) fail("NOT_FOUND","This market is unavailable."); validateTerms(market);
  if(market.status!=="open"||now>=market.cutoff) fail("MARKET_CLOSED","Trading is closed or paused.");
  if(market.insiders.includes(userId)) fail("CONFLICT","You cannot trade a market whose outcome you can influence or know privately.");
  const order: Order={...input,userId,remaining:input.quantity,sequence:++state.sequence,createdAt:now,status:"open"};
  if(input.direction==="buy") move(state,`reserve:${input.id}`,"reserve",now,accountKey(userId,"available"),accountKey(userId,"reserved"),input.price*input.quantity);
  else { const p=holding(state,userId,input.marketId,input.outcome); if(p.available<input.quantity) fail("INSUFFICIENT_CONTRACTS","You cannot sell contracts you do not own."); p.available-=input.quantity; p.reserved+=input.quantity; }
  state.orders.push(order);
  // Best executable price, then global FIFO. The resting maker sets execution price.
  const candidates=state.orders.filter(o=>o.id!==order.id&&o.marketId===order.marketId&&o.status==="open"&&o.remaining>0&&((o.outcome===order.outcome&&o.direction!==order.direction&&(order.direction==="buy"?o.price<=order.price:o.price>=order.price))||(order.direction==="buy"&&o.direction==="buy"&&o.outcome!==order.outcome&&o.price+order.price>=100)));
  const executable=(o: Order)=>o.outcome===order.outcome?o.price:100-o.price;
  candidates.sort((a,b)=>(order.direction==="buy"?executable(a)-executable(b):executable(b)-executable(a))||a.sequence-b.sequence);
  for(const maker of candidates) {
    if(!order.remaining) break;
    // Cancel neither order: reject the whole submission if it would trade with itself.
    if(maker.userId===userId) fail("SELF_TRADE","This order would match your own resting order. Cancel it first.");
    if(market.insiders.includes(maker.userId)) continue;
    const quantity=Math.min(order.remaining,maker.remaining), price=executable(maker), id=`fill:${maker.id}:${order.id}`;
    if(state.fills.some(f=>f.id===id)) fail("DUPLICATE_FILL","This fill already exists.");
    const pair=order.direction==="buy"&&maker.direction==="buy";
    if(pair) {
      post(state,id,"pair_execution",now,[{account:accountKey(maker.userId,"reserved"),cents:-maker.price*quantity},{account:accountKey(userId,"reserved"),cents:-order.price*quantity},{account:accountKey(userId,"available"),cents:(order.price-price)*quantity},{account:escrow(order.marketId),cents:100*quantity}]);
      holding(state,maker.userId,order.marketId,maker.outcome).available+=quantity;
      holding(state,userId,order.marketId,order.outcome).available+=quantity;
    } else {
      const buy=order.direction==="buy"?order:maker, sell=order.direction==="sell"?order:maker;
      post(state,id,"contract_transfer",now,[{account:accountKey(buy.userId,"reserved"),cents:-buy.price*quantity},{account:accountKey(buy.userId,"available"),cents:(buy.price-price)*quantity},{account:accountKey(sell.userId,"available"),cents:price*quantity}]);
      const sold=holding(state,sell.userId,order.marketId,order.outcome); if(sold.reserved<quantity) fail("INSUFFICIENT_CONTRACTS","Reserved contracts require reconciliation."); sold.reserved-=quantity;
      holding(state,buy.userId,order.marketId,order.outcome).available+=quantity;
    }
    maker.remaining-=quantity; order.remaining-=quantity;
    if(!maker.remaining) maker.status="filled";
    if(!order.remaining) order.status="filled";
    state.fills.push({id,marketId:order.marketId,makerId:maker.id,takerId:order.id,makerUserId:maker.userId,takerUserId:userId,outcome:order.outcome,price,quantity,kind:pair?"pair":"transfer",at:now});
  }
  state.requests[key]={payload:JSON.stringify(input),result:order.id};
  reconcile(state); return state;
}
function cancelMutable(state: State, order: Order, now: number) {
  if(order.status!=="open") return;
  if(order.direction==="buy") move(state,`release:${order.id}`,"reservation_release",now,accountKey(order.userId,"reserved"),accountKey(order.userId,"available"),order.remaining*order.price);
  else { const p=holding(state,order.userId,order.marketId,order.outcome); p.reserved-=order.remaining; p.available+=order.remaining; }
  order.status="cancelled";
}
export function cancelOrder(original: State,userId: string,orderId: string,requestId: string,now:number): State {
  const state=structuredClone(original), key=`cancel:${userId}:${requestId}`, payload={orderId}; if(repeat(state,key,payload)) return state;
  const order=state.orders.find(o=>o.id===orderId&&o.userId===userId); if(!order) fail("NOT_FOUND","This order is unavailable.");
  cancelMutable(state,order,now); state.requests[key]={payload:JSON.stringify(payload),result:orderId}; reconcile(state); return state;
}
export function settle(original: State,marketId:string,outcome:Outcome|"void",requestId:string,now:number): State {
  const state=structuredClone(original), key=`settle:${marketId}:${requestId}`,payload={outcome}; if(repeat(state,key,payload)) return state;
  const market=state.markets[marketId]; if(!market) fail("NOT_FOUND","This market is unavailable.");
  if(["settled","void"].includes(market.status)) fail("FINAL","Settlement is final.");
  if(outcome!=="void"&&now<market.cutoff) fail("TOO_EARLY","Close trading before settlement.");
  if(outcome!=="void"&&!["yes","no"].includes(outcome)) fail("INVALID_OUTCOME","Choose Yes, No or void.");
  for(const order of state.orders.filter(o=>o.marketId===marketId)) cancelMutable(state,order,now);
  const postings: Posting[]=[];
  for(const p of state.holdings.filter(p=>p.marketId===marketId)) { const payout=p.available*(outcome==="void"?50:outcome===p.outcome?100:0); if(payout) postings.push({account:accountKey(p.userId,"available"),cents:payout}); p.available=0;p.reserved=0; }
  const total=postings.reduce((n,p)=>n+p.cents,0); postings.push({account:escrow(marketId),cents:-total}); post(state,`settlement:${marketId}`,outcome==="void"?"void_refund":"settlement",now,postings);
  market.status=outcome==="void"?"void":"settled"; if(outcome!=="void") market.outcome=outcome;
  state.requests[key]={payload:JSON.stringify(payload),result:marketId}; reconcile(state); return state;
}
/** Authorized corrections must reference and reverse an existing journal; no minting API. */
export function reverseJournal(original:State,journalId:string,correctionId:string,reason:string,now:number):State {
  if(reason.trim().length<10) fail("CORRECTION_REASON","A documented correction reason is required.");
  const state=structuredClone(original), prior=state.journal.find(j=>j.id===journalId); if(!prior) fail("NOT_FOUND","Journal entry not found.");
  const existing=state.journal.find(j=>j.id===correctionId); if(existing){if(existing.reverses!==journalId)fail("IDEMPOTENCY_MISMATCH","Correction identifier already used."); return state;}
  if(state.journal.some(j=>j.reverses===journalId)) fail("ALREADY_REVERSED","This entry was already reversed.");
  post(state,correctionId,`correction:${reason.trim()}`,now,prior.postings.map(p=>({account:p.account,cents:-p.cents}))); state.journal.at(-1)!.reverses=journalId;
  reconcile(state); return state;
}
export function reconcile(state: State) {
  const ids=new Set<string>(); for(const j of state.journal){if(ids.has(j.id)||j.postings.some(p=>!Number.isSafeInteger(p.cents))||j.postings.reduce((n,p)=>n+p.cents,0)!==0)fail("ACCOUNTING","Journal reconciliation failed.");ids.add(j.id);}
  for(const p of state.holdings) {natural(p.available);natural(p.reserved);const expected=state.orders.filter(o=>o.userId===p.userId&&o.marketId===p.marketId&&o.outcome===p.outcome&&o.direction==="sell"&&o.status==="open").reduce((n,o)=>n+o.remaining,0); if(p.reserved!==expected) fail("ACCOUNTING","Contract reservations do not reconcile.");}
  for(const userId of new Set([...state.orders.map(o=>o.userId),...state.journal.flatMap(j=>j.postings).filter(p=>p.account.startsWith("user:")).map(p=>p.account.split(":")[1])])) {const f=funds(state,userId),reserved=state.orders.filter(o=>o.userId===userId&&o.direction==="buy"&&o.status==="open").reduce((n,o)=>n+o.remaining*o.price,0);if(f.available<0||f.reserved<0||f.reserved!==reserved)fail("ACCOUNTING","Fund reservations do not reconcile.");}
  for(const market of Object.values(state.markets)) {const yes=state.holdings.filter(p=>p.marketId===market.id&&p.outcome==="yes").reduce((n,p)=>n+p.available+p.reserved,0),no=state.holdings.filter(p=>p.marketId===market.id&&p.outcome==="no").reduce((n,p)=>n+p.available+p.reserved,0); if(yes!==no||balance(state,escrow(market.id))!==100*yes)fail("ACCOUNTING","Contracts are not fully collateralized.");}
  return true;
}
export function quotes(state: State,marketId:string) {
  const orders=state.orders.filter(o=>o.marketId===marketId&&o.status==="open"&&o.remaining>0);
  const ask=(side:Outcome)=>{const offers=orders.filter(o=>o.direction==="sell"&&o.outcome===side||o.direction==="buy"&&o.outcome===other(side)).map(o=>({price:o.direction==="sell"?o.price:100-o.price,quantity:o.remaining,sequence:o.sequence})).sort((a,b)=>a.price-b.price||a.sequence-b.sequence);return offers[0]??null;};
  const fills=state.fills.filter(f=>f.marketId===marketId),last=fills.at(-1);
  return {yes:ask("yes"),no:ask("no"),lastYes:last?(last.outcome==="yes"?last.price:100-last.price):null,volumeContracts:fills.reduce((n,f)=>n+f.quantity,0),traders:new Set(fills.flatMap(f=>[f.makerUserId,f.takerUserId])).size};
}
