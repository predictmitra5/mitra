import { describe, expect, it } from "vitest";
import { checkYoutubeVideo, youtubeId, youtubeThumbnail, youtubeUrl } from "./youtube";

describe("reading a YouTube link", () => {
  it("finds the video id in every link a founder is likely to paste", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=abc123",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ?feature=share",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      "youtube.com/watch?v=dQw4w9WgXcQ",
      "  youtu.be/dQw4w9WgXcQ  ",
    ]) expect(youtubeId(link), link).toBe("dQw4w9WgXcQ");
  });

  it("refuses anything that isn't a YouTube video", () => {
    for (const link of [
      "", "hello", "https://vimeo.com/123456789", "https://www.youtube.com/@mitra", "https://www.youtube.com/watch?v=short",
      "https://evil.example/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "javascript:alert(1)//youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/playlist?list=PL123", "https://youtu.be/dQw4w9WgXcQ<script>",
    ]) expect(youtubeId(link), link).toBeNull();
    expect(youtubeId(42)).toBeNull();
  });

  it("gives the canonical link and YouTube's thumbnail", () => {
    expect(youtubeUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(youtubeThumbnail("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});

describe("asking YouTube whether a video can be embedded", () => {
  const answer = (status: number) => (async () => new Response("{}", { status })) as unknown as typeof fetch;

  it("reads oEmbed's answers", async () => {
    expect(await checkYoutubeVideo("dQw4w9WgXcQ", answer(200))).toBe("ok");
    expect(await checkYoutubeVideo("dQw4w9WgXcQ", answer(401))).toBe("not_embeddable");
    expect(await checkYoutubeVideo("dQw4w9WgXcQ", answer(404))).toBe("missing");
    expect(await checkYoutubeVideo("dQw4w9WgXcQ", answer(500))).toBe("unknown");
  });

  it("treats a network failure as unknown, so YouTube being down never blocks a founder", async () => {
    const failing = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await checkYoutubeVideo("dQw4w9WgXcQ", failing)).toBe("unknown");
  });

  it("only ever asks YouTube's own address", async () => {
    let asked = "";
    const spy = (async (url: string) => { asked = url; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    await checkYoutubeVideo("dQw4w9WgXcQ", spy);
    expect(new URL(asked).origin).toBe("https://www.youtube.com");
    expect(await checkYoutubeVideo("../../evil", spy)).toBe("missing");
  });
});
