"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import type { FormState } from "@/modules/auth/policy";
import { approveDraft, createGoalDraft, GoalError, rejectDraft } from "./service";
import { isGoalType, type GoalInput } from "./templates";

const signedOut = { error: "Sign in with your confirmed Ohio State email to continue." };

export async function createGoal(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    const input = goalInputFromForm(form);
    if (!input) return { error: "Choose a goal type." };
    await createGoalDraft(getDb(), identity.id, input);
  } catch (error) {
    if (error instanceof GoalError) return { error: error.message };
    return { error: "We couldn’t save your goal. Please try again shortly." };
  }
  revalidatePath("/account");
  redirect("/account?notice=goal-submitted");
}

export async function approveGoal(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    const percent = Number(text(form, "openingPercent"));
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
      return { error: "Set an opening price as a whole number from 1 to 99." };
    }
    await approveDraft(getDb(), identity.id, text(form, "marketId"), percent * 100, text(form, "note"));
  } catch (error) {
    if (error instanceof GoalError) return { error: error.message };
    return { error: "We couldn’t open this goal. Please try again shortly." };
  }
  revalidatePath("/review");
  redirect("/review?notice=approved");
}

export async function rejectGoal(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const identity = await currentIdentity();
    if (!identity) return signedOut;
    await rejectDraft(getDb(), identity.id, text(form, "marketId"), text(form, "reason"));
  } catch (error) {
    if (error instanceof GoalError) return { error: error.message };
    return { error: "We couldn’t reject this goal. Please try again shortly." };
  }
  revalidatePath("/review");
  redirect("/review?notice=rejected");
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Reads only the fields the chosen template uses; anything else in the form is ignored. */
function goalInputFromForm(form: FormData): GoalInput | null {
  const type = text(form, "type");
  if (!isGoalType(type)) return null;
  const deadline = text(form, "deadline");
  switch (type) {
    case "gpa":
      return { type, gpa: text(form, "gpa"), semester: text(form, "semester"), deadline };
    case "club":
      return { type, club: text(form, "club"), deadline };
    case "internship":
      return { type, company: text(form, "company"), deadline };
    case "gym":
      return { type, achievement: text(form, "achievement"), deadline };
    case "running":
      return { type, distance: text(form, "distance"), miles: text(form, "miles"), time: text(form, "time"), deadline };
    case "own_words":
      return { type, question: text(form, "question"), criteria: text(form, "criteria"), deadline };
  }
}
