import { describe, expect, it } from "vitest";
import { linkedinProfileUrl } from "./links";
import { MAX_RESUME_BYTES, resumeProblem } from "./pdf-check";

const pdf = (body: string) => new TextEncoder().encode(`%PDF-1.7\n${body}\n%%EOF\n`);

describe("a resume PDF", () => {
  it("is accepted when it is a plain PDF", () => {
    expect(resumeProblem(pdf("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj"))).toBeNull();
  });

  it("is refused when it isn't a PDF, is cut short, empty or too big", () => {
    expect(resumeProblem(new TextEncoder().encode("<html><script>alert(1)</script></html>"))).toMatch(/isn't a PDF/);
    expect(resumeProblem(new TextEncoder().encode("%PDF-1.7\n1 0 obj << >> endobj"))).toMatch(/incomplete/);
    expect(resumeProblem(new Uint8Array())).toMatch(/empty/);
    expect(resumeProblem(new Uint8Array(MAX_RESUME_BYTES + 1))).toMatch(/5 MB/);
  });

  it("is refused when it carries scripts, launch actions or attachments", () => {
    for (const body of [
      "<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>",
      "<< /AA << /O << /JS (x) >> >> >>",
      "<< /S /Launch /F (calc.exe) >>",
      "<< /Names << /EmbeddedFiles 3 0 R >> >>",
      "<< /RichMedia 4 0 R >>",
    ]) expect(resumeProblem(pdf(body)), body).toMatch(/scripts or attachments/);
  });
});

describe("a LinkedIn profile link", () => {
  it("is kept in one form", () => {
    expect(linkedinProfileUrl("linkedin.com/in/ravi-shah")).toBe("https://www.linkedin.com/in/ravi-shah/");
    expect(linkedinProfileUrl("https://www.linkedin.com/in/ravi-shah?trk=share")).toBe("https://www.linkedin.com/in/ravi-shah/");
    expect(linkedinProfileUrl("http://uk.linkedin.com/in/ravi_shah/")).toBe("https://www.linkedin.com/in/ravi_shah/");
  });

  it("refuses anything that isn't someone's profile on linkedin.com", () => {
    for (const link of ["", "ravi", "https://linkedin.com/company/mitra", "https://evil.example/in/ravi", "https://linkedin.com.evil.example/in/ravi",
      "javascript:alert(1)//linkedin.com/in/ravi", "https://www.linkedin.com/in/", "https://www.linkedin.com/in/ravi/posts"]) {
      expect(linkedinProfileUrl(link), link).toBeNull();
    }
  });
});
