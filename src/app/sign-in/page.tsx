import { AuthScreen } from "../components/auth-screen";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { notice } = await searchParams;
  return <AuthScreen mode="sign-in" notice={typeof notice === "string" ? notice : undefined} />;
}
