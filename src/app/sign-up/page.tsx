import { safeReturnTo } from "@/modules/auth/policy";
import { AuthScreen } from "../components/auth-screen";
export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
 const {next}=await searchParams;return <AuthScreen mode="sign-up" returnTo={safeReturnTo(next)}/>;
}
