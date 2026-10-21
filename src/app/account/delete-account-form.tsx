"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/modules/account/actions";
import type { FormState } from "@/modules/auth/policy";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, {} as FormState);
  return <div className="delete-account-panel">
    <p>This permanently removes your login, profile photo, any earlier proof files, and suggestions that were never published. Financial history remains as an accounting record. Open orders, holdings and funds must be resolved first.</p>
    <form action={action} className="delete-account-form" aria-busy={pending}>
      <div className="field">
        <label htmlFor="delete-confirmation">Type DELETE to confirm</label>
        <input id="delete-confirmation" name="confirmation" autoComplete="off" pattern="DELETE" required />
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="danger-button" disabled={pending} type="submit">{pending ? "Deleting account…" : "Delete account permanently"}</button>
    </form>
  </div>;
}
