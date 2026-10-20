import {and,eq,inArray,isNotNull} from "drizzle-orm";
import type {PgDatabase,PgQueryResultHKT} from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import {isUuid} from "./input";
import {tradeBlockReason} from "./eligibility";
import {isInactive} from "@/modules/account/standing";
import {readExchange} from "@/modules/exchange/store";
import {quotes,funds} from "@/modules/exchange/engine";
const {markets,profiles,marketOutcomeDeciders,venues,events,resolutionSources,startups,startupFounders,founders}=schema;
type Database<Q extends PgQueryResultHKT>=PgDatabase<Q,typeof schema>;
type Market=typeof markets.$inferSelect;
const publicStatuses=['open','closed','ruled','settled','cancelled'] as const;
export async function readPublicMarket<Q extends PgQueryResultHKT>(database: Database<Q>, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await database.select({
    id: markets.id, question: markets.question, shortQuestion: markets.shortQuestion, resolutionCriteria: markets.resolutionCriteria,
    status: markets.status, deadlineAt: markets.deadlineAt,
    evidenceDeadlineAt: markets.evidenceDeadlineAt, tradingClosedAt: markets.tradingClosedAt,
    ruledOutcome: markets.ruledOutcome, rulingReason: markets.rulingReason, rulingVersion: markets.rulingVersion,
    ruledAt: markets.ruledAt, contestEndsAt: markets.contestEndsAt, settledAt: markets.settledAt, cancelledAt: markets.cancelledAt,
    approvedAt: markets.approvedAt, openingProbabilityBp: markets.openingProbabilityBp,
    campus: markets.campus, category: markets.category, isSample: markets.isSample,
    windowStartAt: markets.windowStartAt, windowEndAt: markets.windowEndAt, timeZone: markets.timeZone,
    yesCondition: markets.yesCondition, noCondition: markets.noCondition,
    venueName: venues.name, venueSlug: venues.slug, venueArea: venues.area,
    eventTitle: events.title,
    sourceName: resolutionSources.name, sourceMethod: resolutionSources.method, sourceUrl: resolutionSources.url,
    sourceOperational: resolutionSources.operational,
    startupId: markets.startupId, milestoneKind: markets.milestoneKind, pausedAt: markets.pausedAt, pausedReason: markets.pausedReason,
    createdAt: markets.createdAt,
    liquidityMicro: markets.liquidityMicro, yesSharesMicro: markets.yesSharesMicro, noSharesMicro: markets.noSharesMicro,
  }).from(markets)
    .leftJoin(venues, eq(venues.id, markets.venueId))
    .leftJoin(events, eq(events.id, markets.eventId))
    .leftJoin(resolutionSources, eq(resolutionSources.id, markets.resolutionSourceId))
    .where(and(eq(markets.id, id), isNotNull(markets.approvedAt), inArray(markets.status, [...publicStatuses]))).limit(1);
  if(!row || !row.startupId) return null;
 const {liquidityMicro:_l,yesSharesMicro:_y,noSharesMicro:_n,...fields}=row;void _l;void _y;void _n;
 const state=await readExchange(database),q=quotes(state,id);
 return {...fields,liquidity:0,tradingOpen:row.status==='open'&&!row.tradingClosedAt&&!row.pausedAt&&row.deadlineAt.getTime()>Date.now(),contestOpen:row.status==='ruled'&&!!row.contestEndsAt&&row.contestEndsAt.getTime()>Date.now(),yesPrice:q.lastYes===null?0.5:q.lastYes/100,hasPrice:q.lastYes!==null,yesAskCents:q.yes?.price??null,noAskCents:q.no?.price??null,book:state.orders.filter(o=>o.marketId===id&&o.status==='open').map(o=>({outcome:o.outcome,direction:o.direction,price:o.price,quantity:o.remaining}))};
}

export async function insidersFor<Q extends PgQueryResultHKT>(database: Database<Q>, market: Pick<Market, "startupId">): Promise<string[]> {
  if (!market.startupId) return [];
  const linked = await database.select({ userId: founders.userId }).from(startupFounders)
    .innerJoin(founders, eq(founders.id, startupFounders.founderId)).where(eq(startupFounders.startupId, market.startupId));
  const [startup] = await database.select({ createdBy: startups.createdBy }).from(startups).where(eq(startups.id, market.startupId));
  return [...new Set([...linked.map((row) => row.userId), startup?.createdBy ?? null].filter((id): id is string => !!id))];
}

export async function readTrader<Q extends PgQueryResultHKT>(database:Database<Q>,userId:string,marketId:string){
 const [profile]=await database.select().from(profiles).where(eq(profiles.id,userId));if(!profile||isInactive(profile)||!profile.adultConfirmedAt)return null;
 const [market]=await database.select().from(markets).where(eq(markets.id,marketId));if(!market?.startupId)return null;
 const deciders=await database.select().from(marketOutcomeDeciders).where(eq(marketOutcomeDeciders.marketId,marketId));
 const block=tradeBlockReason(userId,{subjectUserId:null,outcomeDeciderUserIds:[...deciders.map(d=>d.userId),...(profile.isOwner===1?[userId]:[])],insiderUserIds:await insidersFor(database,market)});
 const state=await readExchange(database),held=state.holdings.filter(p=>p.userId===userId&&p.marketId===marketId),amount=(side:'yes'|'no')=>held.filter(p=>p.outcome===side).reduce((n,p)=>n+p.available+p.reserved,0)*1_000_000;
 return {balanceMicro:funds(state,userId).available*10_000,allowanceMicro:0,position:{yesSharesMicro:amount('yes'),noSharesMicro:amount('no'),yesCostBasisMicro:0,noCostBasisMicro:0},blocked:block?'You cannot trade this market because you help decide or influence its outcome.':null};
}
