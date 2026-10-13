import { AuthScreen } from "../components/auth-screen";
import { campaignReturnTo } from "@/modules/auth/policy";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { notice, next } = await searchParams;
  return <AuthScreen mode="sign-in" notice={typeof notice === "string" ? notice : undefined}
    returnTo={campaignReturnTo(next)} />;
}
