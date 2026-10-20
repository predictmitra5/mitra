import { loadHome } from "@/app/components/home/load";
import { HomePage } from "@/app/components/home/home-page";
import { readTopic } from "@/app/components/home/topics";

/*
 * The home route (2026-10-20): YouTube's home, for visitors and members alike.
 * The order is personal (src/modules/recommend), so it is never cached.
 */
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { topic } = await searchParams;
  const data = await loadHome();
  return <HomePage data={data} topic={readTopic(topic)} />;
}
