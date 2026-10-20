"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelLimitOrder } from "@/modules/exchange/actions";
export function CancelOrder({id}:{id:string}){const[error,setError]=useState(""),[pending,start]=useTransition(),router=useRouter();return <><button className="btn btn-quiet" disabled={pending} onClick={()=>start(async()=>{const r=await cancelLimitOrder(id,crypto.randomUUID());if(!r.ok)setError(r.error);else router.refresh();})}>{pending?"Cancelling…":"Cancel order"}</button>{error&&<p role="alert">{error}</p>}</>;}
