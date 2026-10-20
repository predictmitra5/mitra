"use server";
import { currentIdentity } from "@/modules/auth/server";
import { getDb } from "@/db/client";
import { submitOrder, cancelMemberOrder } from "./store";
import type { OrderInput } from "./engine";
export async function placeLimitOrder(input:OrderInput){const identity=await currentIdentity();if(!identity)return {ok:false as const,error:"Sign in to continue."};try{await submitOrder(getDb(),identity.id,input);return {ok:true as const};}catch{return {ok:false as const,error:"Trading is not available yet. Account funding is closed."};}}
export async function cancelLimitOrder(orderId:string,requestId:string){const identity=await currentIdentity();if(!identity)return {ok:false as const,error:"Sign in to continue."};try{await cancelMemberOrder(getDb(),identity.id,orderId,requestId);return {ok:true as const};}catch{return {ok:false as const,error:"The order could not be cancelled. Reload and try again."};}}
