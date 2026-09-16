import { redirect } from "next/navigation";
import { currentIdentity } from "@/modules/auth/server";
import { AuthScreen } from "../components/auth-screen";

export default async function ResetPasswordPage() {
  if (!await currentIdentity()) redirect("/forgot-password");
  return <AuthScreen mode="reset-password" />;
}
