import { isCampusKey } from "@/config/campus";
import { AuthScreen } from "../components/auth-screen";

/** ?school=osu or ?school=uiuc comes from the pop-up's buttons and skips the school step. */
export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { school } = await searchParams;
  return <AuthScreen mode="sign-up" school={isCampusKey(school) ? school : null} />;
}
