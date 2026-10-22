import { describe, expect, it } from "vitest";
import { describeYoutubeVideo, isShortsLink, youtubeId, youtubeThumbnail, youtubeUrl } from "./youtube";

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

describe("asking YouTube about a video", () => {
  const answer = (status: number, body: object = {}) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("reads whether it can be embedded", async () => {
    expect((await describeYoutubeVideo("dQw4w9WgXcQ", answer(200, { width: 200, height: 150 }))).status).toBe("ok");
    expect((await describeYoutubeVideo("dQw4w9WgXcQ", answer(401))).status).toBe("not_embeddable");
    expect((await describeYoutubeVideo("dQw4w9WgXcQ", answer(404))).status).toBe("missing");
    expect((await describeYoutubeVideo("dQw4w9WgXcQ", answer(500))).status).toBe("unknown");
  });

  it("tells a Short by its tall shape", async () => {
    expect(await describeYoutubeVideo("6yX9tINzYf0", answer(200, { width: 113, height: 200 }))).toEqual({ status: "ok", vertical: true });
    expect(await describeYoutubeVideo("dQw4w9WgXcQ", answer(200, { width: 200, height: 150 }))).toEqual({ status: "ok", vertical: false });
    expect(await describeYoutubeVideo("dQw4w9WgXcQ", answer(200, {}))).toEqual({ status: "ok", vertical: null });
  });

  it("treats a network failure as unknown, so YouTube being down never blocks a founder", async () => {
    const failing = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await describeYoutubeVideo("dQw4w9WgXcQ", failing)).toEqual({ status: "unknown", vertical: null });
  });

  it("only ever asks YouTube's own address, about the video's Shorts address", async () => {
    let asked = "";
    const spy = (async (url: string) => { asked = url; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    await describeYoutubeVideo("dQw4w9WgXcQ", spy);
    expect(new URL(asked).origin).toBe("https://www.youtube.com");
    expect(new URL(asked).searchParams.get("url")).toBe("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect((await describeYoutubeVideo("../../evil", spy)).status).toBe("missing");
  });
});

describe("a Shorts link", () => {
  it("is told apart from other YouTube links", () => {
    expect(isShortsLink("https://www.youtube.com/shorts/6yX9tINzYf0")).toBe(true);
    expect(isShortsLink("youtube.com/shorts/6yX9tINzYf0?feature=share")).toBe(true);
    expect(isShortsLink("https://youtu.be/6yX9tINzYf0")).toBe(false);
    expect(isShortsLink("https://www.youtube.com/watch?v=6yX9tINzYf0")).toBe(false);
    expect(isShortsLink("https://evil.example/shorts/6yX9tINzYf0")).toBe(false);
  });
});
