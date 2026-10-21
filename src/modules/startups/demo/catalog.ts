import type { IndustryKey, MilestoneKey, VerificationKey, VideoKind } from "../labels";

/*
 * The demonstration catalog (2026-10-19, DECISIONS.md): twenty fictional
 * startups, their fictional founders, videos, updates, claims and markets.
 * Every name, person, number and event here is invented. Nothing is a real
 * company or person, and every page that shows them labels them as demo data.
 *
 * This is data only. seed.ts writes it into the database through the same
 * tables real startups use, so the pages never special-case it, and replacing
 * a demo startup with a real one is a matter of rows, not code.
 *
 * Times are relative to when the seed runs ("days ago"), except market close
 * dates, which are fixed calendar dates in Eastern time.
 */

export type DemoFounder = {
  handle: string;
  name: string;
  headline: string;
  bio: string;
  background: string;
  location: string;
  hue: number;
  accomplishments: string[];
};

export type DemoVideo = {
  title: string;
  description: string;
  kind: VideoKind;
  durationSeconds: number;
  daysAgo: number;
  /** Spoken lines, shown as captions spread evenly over the video. */
  lines: string[];
};

export type DemoUpdate = { title: string; body: string; daysAgo: number; kind: "update" | "milestone"; verification: VerificationKey };
export type DemoClaim = { statement: string; level: VerificationKey; sourceName?: string };

export type DemoMarket = {
  key: string;
  question: string;
  /** The card's few words. */
  short: string;
  kind: MilestoneKey;
  yes: string;
  no: string;
  /** How the number or fact is measured, in a sentence or two. */
  method: string;
  source: string;
  /** Last moment of trading, ISO with the Eastern offset. */
  closes: string;
  openedDaysAgo: number;
  /** A finished demo market: its outcome and the owner's ruling, some days ago. */
  resolved?: { outcome: "yes" | "no"; reason: string; daysAgo: number };
};

export type DemoStartup = {
  slug: string;
  name: string;
  tagline: string;
  /** The card's headline, as in the owner's screenshot: "Building the future of studying". */
  headline: string;
  description: string;
  industry: IndustryKey;
  tags: string[];
  founded: string;
  stage: string;
  headquarters: string;
  glyph: string;
  hue: number;
  productDetails: string;
  /** "icon:words", three of them, for the thumbnail's product panel. */
  features: [string, string, string];
  founders: { founder: DemoFounder; role: string }[];
  videos: DemoVideo[];
  updates: DemoUpdate[];
  claims: DemoClaim[];
  markets: DemoMarket[];
};

const END_2027 = "2027-12-31T23:59:59-05:00";
const MID_2027 = "2027-06-30T23:59:59-04:00";
const END_2028 = "2028-12-31T23:59:59-05:00";

export const DEMO_STARTUPS: DemoStartup[] = [
  {
    slug: "lumenly",
    name: "Lumenly",
    tagline: "AI Study Companion",
    headline: "Building the future of studying",
    description: "Lumenly is an AI learning platform founded by Ari Vale. The company develops personalized study plans, AI-generated practice questions, and adaptive tutoring tools for college students.",
    industry: "edtech",
    tags: ["AI", "Startups"],
    founded: "2024-02-01",
    stage: "Seed",
    headquarters: "Columbus, OH",
    glyph: "sparkles",
    hue: 210,
    productDetails: "Students upload lecture slides and notes; Lumenly turns them into a week-by-week study plan, practice questions that get harder as you improve, and a tutor that answers in the words of your own course material. It works in the browser and on iOS.",
    features: ["check:Study plans", "book:Course notes", "bot:AI tutoring"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "arivale", name: "Ari Vale", headline: "Turning class notes into study plans",
        bio: "Ari is creating an AI study platform that turns class notes into personalized learning plans.",
        background: "Studied computer science and cognitive psychology. Built tutoring tools for a university learning center for two years before starting Lumenly.",
        location: "Columbus, OH", hue: 205,
        accomplishments: ["Ran a peer-tutoring program that served 900 students", "Published a study on spaced repetition in intro calculus"],
      },
    }],
    videos: [
      { title: "Why I'm building Lumenly", description: "Ari explains the problem with cramming and what Lumenly does about it.", kind: "pitch", durationSeconds: 144, daysAgo: 6,
        lines: ["Hi, I'm Ari, and I'm building Lumenly.", "Most students study the night before, from notes they never organized.", "Lumenly reads your slides and notes and builds a plan for the whole term.", "Every day it asks you a few questions, harder where you're weak.", "And when you're stuck, the tutor answers using your own course material.", "We launched on iOS this summer and students are using it every week.", "Our goal is a hundred thousand verified monthly users by the end of 2027.", "If you think we can do it, or think we can't, there's a market for that."] },
      { title: "Lumenly in 60 seconds", description: "A walkthrough of the study plan and the tutor.", kind: "demo", durationSeconds: 62, daysAgo: 21,
        lines: ["Here's a real organic chemistry course.", "I drop in the slides from week three.", "Lumenly pulls out the twelve ideas that matter.", "It schedules them across the next two weeks.", "Now the tutor: I ask why this carbocation is more stable.", "It answers with the diagram from my own lecture."] },
      { title: "September update: retention", description: "What happened after the semester started.", kind: "update", durationSeconds: 95, daysAgo: 34,
        lines: ["Quick update from the first month of the fall semester.", "Weekly active users roughly doubled since August.", "The number I care about more is retention.", "Students who build a plan in week one are still here in week four.", "Next up: shared plans for study groups."] },
    ],
    updates: [
      { title: "iOS app launched", body: "Lumenly is now on the App Store, with offline study plans.", daysAgo: 80, kind: "milestone", verification: "independently_verified" },
      { title: "Study groups in beta", body: "Students can now share a plan with up to six classmates.", daysAgo: 12, kind: "update", verification: "founder_reported" },
      { title: "Joined a campus pilot", body: "A fictional university learning center is piloting Lumenly in two intro courses.", daysAgo: 45, kind: "milestone", verification: "founder_reported" },
    ],
    claims: [
      { statement: "Lumenly's iOS app is live on the App Store.", level: "independently_verified", sourceName: "App Store listing (demo)" },
      { statement: "About 31,000 students used Lumenly in September.", level: "founder_reported" },
    ],
    markets: [
      { key: "lumenly-100k-mau", question: "Will Lumenly reach 100,000 verified monthly active users by December 31, 2027?", short: "Will Lumenly reach 100K verified monthly users by Dec 2027?",
        kind: "adoption", yes: "Lumenly reports at least 100,000 monthly active users for any calendar month ending on or before December 31, 2027, confirmed by an independent analytics audit or app-store analytics shared with the owner.",
        no: "No calendar month through December 2027 reaches 100,000 verified monthly active users, or the figure cannot be verified.",
        method: "A monthly active user is a distinct account that opened a study plan or the tutor at least once in the calendar month; test and staff accounts are excluded.",
        source: "Independent analytics audit, with App Store Connect and web analytics exports", closes: END_2027, openedDaysAgo: 320 },
      { key: "lumenly-accelerator", question: "Will Lumenly be accepted into a Y Combinator batch announced on or before June 30, 2027?", short: "Will Lumenly get into Y Combinator by mid-2027?",
        kind: "accelerator", yes: "Y Combinator lists Lumenly as a company in any batch, or Lumenly and Y Combinator both announce its acceptance, on or before June 30, 2027.",
        no: "No such listing or joint announcement exists by June 30, 2027.",
        method: "Acceptance means a public listing in Y Combinator's company directory or a joint announcement; an interview invitation does not count.",
        source: "Y Combinator's public company directory", closes: MID_2027, openedDaysAgo: 140 },
      { key: "lumenly-ios-launch", question: "Will Lumenly's iOS app be publicly available on the App Store by August 31, 2026?", short: "Will Lumenly launch on iOS by August 31?",
        kind: "launch", yes: "Lumenly's iOS app can be downloaded from the US App Store on or before August 31, 2026.", no: "It cannot be downloaded from the US App Store by then.",
        method: "A public listing that anyone in the US can download; TestFlight does not count.", source: "US App Store listing",
        closes: "2026-08-31T23:59:59-04:00", openedDaysAgo: 260,
        resolved: { outcome: "yes", reason: "The App Store listing was public on August 2, 2026 (demo).", daysAgo: 46 } },
    ],
  },
  {
    slug: "nexa-robotics",
    name: "Nexa Robotics",
    tagline: "Robots for small factories",
    headline: "Automation for the shops that build everything",
    description: "Nexa Robotics, founded by Noah Reed, builds affordable robotic arms that small manufacturers can set up in an afternoon without a robotics engineer.",
    industry: "robotics",
    tags: ["Manufacturing", "Hardware"],
    founded: "2023-09-01",
    stage: "Seed",
    headquarters: "Dayton, OH",
    glyph: "robot",
    hue: 190,
    productDetails: "The Nexa One arm costs a fraction of an industrial robot and is taught by demonstration: an operator moves the arm through a task once and Nexa repeats it. A fleet dashboard shows every arm's uptime and alerts.",
    features: ["hand:Pick and place", "wand:No-code setup", "gauge:Fleet dashboard"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "noahreed", name: "Noah Reed", headline: "Making robots small shops can afford",
        bio: "Noah grew up in his family's machine shop and is building the robot he wished it had.",
        background: "Mechanical engineer. Spent five years designing grippers at a large automation company.",
        location: "Dayton, OH", hue: 25,
        accomplishments: ["Holds two patents on low-cost gripper design (demo)", "Built a robotics club that won a state championship"],
      },
    }],
    videos: [
      { title: "Teaching a robot in five minutes", description: "Noah shows how a shop worker trains the Nexa One.", kind: "demo", durationSeconds: 118, daysAgo: 4,
        lines: ["This is a twelve-person shop that makes brackets.", "Nobody here has ever programmed a robot.", "Watch: Dana moves the arm through the task once.", "Now Nexa does it, and keeps doing it, all shift.", "Setup took under an hour, including unboxing.", "That's the whole idea: robots for shops like this one."] },
      { title: "Why small factories get left behind", description: "Noah on the gap between big and small manufacturers.", kind: "pitch", durationSeconds: 136, daysAgo: 27,
        lines: ["I'm Noah, founder of Nexa Robotics.", "Big factories have had robots for forty years.", "Small shops still can't afford them or the engineers to run them.", "We built an arm that costs less than one year of overtime.", "And you train it by showing it, not by writing code.", "We're entering the Open Automation Prize next year. Wish us luck."] },
    ],
    updates: [
      { title: "First 40 arms delivered", body: "Nexa One arms are running in 17 shops across Ohio and Indiana.", daysAgo: 60, kind: "milestone", verification: "founder_reported" },
      { title: "Fleet dashboard released", body: "Owners can now see uptime and cycle counts for every arm.", daysAgo: 18, kind: "update", verification: "founder_reported" },
    ],
    claims: [
      { statement: "Nexa has delivered 40 arms to paying customers.", level: "founder_reported" },
      { statement: "Nexa was a finalist at a regional manufacturing showcase.", level: "independently_verified", sourceName: "Showcase finalist list (demo)" },
    ],
    markets: [
      { key: "nexa-automation-prize", question: "Will Nexa Robotics win the 2027 Open Automation Prize (a fictional independent robotics competition) by December 31, 2027?", short: "Will Nexa Robotics win the 2027 Open Automation Prize?",
        kind: "competition", yes: "Nexa Robotics is named the overall winner of the 2027 Open Automation Prize by its organizers on or before December 31, 2027.",
        no: "Another entrant is named overall winner, Nexa does not win, or no winner is announced by December 31, 2027.",
        method: "Only the overall first prize counts; category awards and honorable mentions do not.", source: "The Open Automation Prize organizers' published results (fictional)",
        closes: END_2027, openedDaysAgo: 210 },
      { key: "nexa-10k-deployments", question: "Will Nexa Robotics have 10,000 active arm deployments by December 31, 2028?", short: "Will Nexa reach 10,000 active deployments by 2028?",
        kind: "adoption", yes: "Nexa reports at least 10,000 arms that each completed a task cycle in December 2028, confirmed by an independent audit of its fleet telemetry.",
        no: "Fewer than 10,000 active arms, or the figure cannot be verified.", method: "An active deployment is an arm at a customer site that completed at least one task cycle in the final month.",
        source: "Independent audit of Nexa fleet telemetry", closes: END_2028, openedDaysAgo: 95 },
    ],
  },
  {
    slug: "northstar-games",
    name: "Northstar Games",
    tagline: "Indie multiplayer studio",
    headline: "A co-op game built by four friends",
    description: "Northstar Games is an independent studio founded by Maya Chen, making Driftlight, a co-op exploration game for up to four players, for PC.",
    industry: "gaming",
    tags: ["IndieDev", "Steam"],
    founded: "2023-05-01",
    stage: "Pre-seed",
    headquarters: "Chicago, IL",
    glyph: "gamepad",
    hue: 265,
    productDetails: "Driftlight is a co-op exploration game in which up to four players sail a floating island through a storm-filled sky, building it as they go. Cross-play on PC and Steam Deck, with mod tools at launch.",
    features: ["swords:Co-op raids", "repeat:Cross-play", "wrench:Mod tools"],
    founders: [{
      role: "Founder / Game director",
      founder: {
        handle: "mayachen", name: "Maya Chen", headline: "Making co-op games that feel like home",
        bio: "Maya leads a four-person studio making the co-op game she always wanted to play with her friends.",
        background: "Former gameplay programmer at a mid-size studio. Shipped two console titles.",
        location: "Chicago, IL", hue: 330,
        accomplishments: ["Shipped two console games as a gameplay programmer", "Won a game jam with a prototype of Driftlight"],
      },
    }],
    videos: [
      { title: "Driftlight gameplay with the team", description: "Maya and the team play a full storm run.", kind: "demo", durationSeconds: 150, daysAgo: 3,
        lines: ["We're about to fly straight into a storm. On purpose.", "Every player has a job: steering, building, repairs.", "The island grows as you find new pieces in the clouds.", "If the storm wins, you lose the pieces you didn't anchor.", "This run took us forty minutes and we survived. Barely.", "Driftlight launches on Steam next spring."] },
      { title: "Why we're a four-person studio", description: "Maya on staying small.", kind: "pitch", durationSeconds: 104, daysAgo: 30,
        lines: ["I'm Maya, and Northstar is four people.", "We stay small so the game can stay weird.", "Our closed beta passed ten thousand sign-ups in September.", "The goal for launch month: fifty thousand players at once.", "That's ambitious for a studio our size. That's the point."] },
    ],
    updates: [
      { title: "Closed beta: 10,000 sign-ups", body: "The Driftlight closed beta passed 10,000 sign-ups.", daysAgo: 25, kind: "milestone", verification: "independently_verified" },
      { title: "Steam page live", body: "Driftlight's Steam page is up with a spring release window.", daysAgo: 70, kind: "milestone", verification: "independently_verified" },
    ],
    claims: [
      { statement: "Driftlight has a public Steam store page.", level: "independently_verified", sourceName: "Steam store page (demo)" },
      { statement: "About 64,000 players have wishlisted Driftlight.", level: "founder_reported" },
    ],
    markets: [
      { key: "northstar-50k-ccu", question: "Will Driftlight reach 50,000 peak concurrent players on Steam within 30 days of its release?", short: "Will Driftlight hit 50K concurrent Steam players in month one?",
        kind: "performance", yes: "SteamDB's all-time peak concurrent player count for Driftlight reaches 50,000 or more at any moment in the 30 days after its Steam release.",
        no: "The peak stays below 50,000 in those 30 days, or the game is not released on Steam by December 31, 2027.",
        method: "Peak concurrent players as recorded by SteamDB from Steam's public player counts; free weekends before release do not count.", source: "SteamDB player-count chart",
        closes: END_2027, openedDaysAgo: 180 },
      { key: "northstar-release", question: "Will Driftlight be released on Steam by June 30, 2027?", short: "Will Driftlight release on Steam by June 30, 2027?",
        kind: "launch", yes: "Driftlight is purchasable or free to download on Steam (not early access sign-ups) on or before June 30, 2027.",
        no: "It is not available on Steam by then.", method: "Early Access counts as a release; a demo or a playtest does not.", source: "Driftlight's Steam store page",
        closes: MID_2027, openedDaysAgo: 120 },
      { key: "northstar-beta-10k", question: "Will Driftlight's closed beta reach 10,000 sign-ups by September 30, 2026?", short: "Will the Driftlight beta reach 10,000 sign-ups?",
        kind: "adoption", yes: "Steam's playtest sign-up count shown to the developer reaches 10,000 by September 30, 2026, shared with the owner.",
        no: "Fewer than 10,000 sign-ups by then.", method: "Distinct Steam accounts that requested playtest access.", source: "Steamworks playtest report, shared with the owner",
        closes: "2026-09-30T23:59:59-04:00", openedDaysAgo: 150,
        resolved: { outcome: "yes", reason: "The Steamworks report showed 10,412 sign-ups on September 24, 2026 (demo).", daysAgo: 16 } },
    ],
  },
  {
    slug: "verdant-grid",
    name: "Verdant Grid",
    tagline: "Shared batteries for apartments",
    headline: "Clean power for people who rent",
    description: "Verdant Grid, founded by Priya Raman, installs shared batteries in apartment buildings so renters can store cheap off-peak power and sell it back at peak hours.",
    industry: "climate",
    tags: ["Energy", "CleanTech"],
    founded: "2024-01-01",
    stage: "Seed",
    headquarters: "Pittsburgh, PA",
    glyph: "battery",
    hue: 150,
    productDetails: "One battery cabinet in the basement serves the whole building. Each apartment gets a share, an app shows savings, and the building earns grid credits for discharging at peak hours.",
    features: ["battery:Shared batteries", "trending-down:Peak-hour savings", "zap:Grid credits"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "priyaraman", name: "Priya Raman", headline: "Bringing batteries to renters",
        bio: "Priya is building the energy storage that renters were left out of.",
        background: "Electrical engineer; worked on grid-scale storage interconnection at a utility.",
        location: "Pittsburgh, PA", hue: 145,
        accomplishments: ["Led interconnection for 200 MW of storage projects (demo)", "Fellow of a fictional climate leadership program"],
      },
    }],
    videos: [
      { title: "A battery in the basement", description: "Priya tours the first building on Verdant Grid.", kind: "demo", durationSeconds: 122, daysAgo: 9,
        lines: ["This 40-unit building is our first full install.", "The cabinet behind me stores power at night when it's cheap.", "At 6 PM, when prices spike, it powers the building.", "Every tenant sees their share and savings in the app.", "No roof, no ownership needed. Just a lease."] },
      { title: "Why renters miss out on clean energy", description: "The problem Verdant Grid solves.", kind: "pitch", durationSeconds: 97, daysAgo: 40,
        lines: ["Half of Americans in cities rent.", "They can't put solar on a roof they don't own.", "So we put the storage in the basement and share it.", "Our target: five thousand households enrolled by the end of 2027."] },
    ],
    updates: [
      { title: "First building live", body: "A 40-unit building in Pittsburgh runs on a shared Verdant battery.", daysAgo: 52, kind: "milestone", verification: "founder_reported" },
      { title: "Utility program approval", body: "Verdant qualified for a utility peak-demand program (demo).", daysAgo: 15, kind: "milestone", verification: "unverified" },
    ],
    claims: [{ statement: "Tenants in the first building saved about 11% on their summer bills.", level: "founder_reported" }],
    markets: [
      { key: "verdant-5k-households", question: "Will Verdant Grid have 5,000 households enrolled by December 31, 2027?", short: "Will Verdant Grid enroll 5,000 households by 2027?",
        kind: "adoption", yes: "At least 5,000 households are enrolled and connected to a live Verdant battery on December 31, 2027, confirmed by the utility program's participation report or an independent audit.",
        no: "Fewer than 5,000, or the figure cannot be verified.", method: "A household counts if its apartment is connected to an operating Verdant battery; sign-ups waiting for installation do not.",
        source: "Utility program participation report (fictional)", closes: END_2027, openedDaysAgo: 200 },
      { key: "verdant-gridshift-prize", question: "Will Verdant Grid be named a winner of the 2027 Gridshift Climate Prize (a fictional independent prize) by December 31, 2027?", short: "Will Verdant Grid win the 2027 Gridshift Prize?",
        kind: "competition", yes: "The prize organizers list Verdant Grid among the 2027 Gridshift Climate Prize winners on or before December 31, 2027.",
        no: "Verdant Grid is not listed as a winner, or no 2027 winners are announced by then.", method: "Winners as published by the organizers; finalists do not count.",
        source: "Gridshift Climate Prize results page (fictional)", closes: END_2027, openedDaysAgo: 60 },
    ],
  },
  {
    slug: "pulsewell",
    name: "Pulsewell",
    tagline: "Heart monitoring patch",
    headline: "Catching heart problems before the ER",
    description: "Pulsewell, founded by Dr. Samuel Okoye, makes a 14-day adhesive heart-rhythm monitor that flags atrial fibrillation and sends reports straight to the patient's clinician.",
    industry: "healthcare",
    tags: ["MedTech", "Cardiology"],
    founded: "2023-03-01",
    stage: "Series A",
    headquarters: "Cleveland, OH",
    glyph: "heart",
    hue: 350,
    productDetails: "A thin patch records a continuous ECG for 14 days. Pulsewell's software flags suspected atrial fibrillation and other arrhythmias, and a clinician portal lets doctors review the strips.",
    features: ["activity:14-day patch", "bell:AFib alerts", "stethoscope:Clinician portal"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "drokoye", name: "Samuel Okoye", headline: "Cardiologist building better monitors",
        bio: "Samuel is a cardiologist who got tired of patients missing their arrhythmia on a 24-hour monitor.",
        background: "Practicing cardiologist for ten years; led a hospital's remote-monitoring program.",
        location: "Cleveland, OH", hue: 15,
        accomplishments: ["Authored studies on ambulatory ECG monitoring (demo)", "Built a remote-monitoring program for 3,000 patients"],
      },
    }],
    videos: [
      { title: "Why 24 hours isn't enough", description: "Samuel explains the gap in heart monitoring.", kind: "pitch", durationSeconds: 128, daysAgo: 11,
        lines: ["I'm a cardiologist. Every week I see patients who were monitored and still missed.", "A 24-hour monitor catches the heart on a good day.", "Pulsewell records for fourteen days, through normal life.", "Our software flags what matters and the doctor confirms it.", "We submitted for FDA clearance this year."] },
      { title: "How the patch works", description: "From the box to the clinician's report.", kind: "demo", durationSeconds: 76, daysAgo: 36,
        lines: ["The patch goes on in about a minute.", "You can shower and sleep with it.", "After fourteen days, mail it back in the envelope.", "Your doctor gets a report with every flagged rhythm."] },
    ],
    updates: [
      { title: "FDA submission filed", body: "Pulsewell filed a 510(k) premarket notification (demo).", daysAgo: 90, kind: "milestone", verification: "founder_reported" },
      { title: "Clinical study results", body: "A 400-patient study completed; the paper is under review (demo).", daysAgo: 30, kind: "update", verification: "unverified" },
    ],
    claims: [{ statement: "Pulsewell has filed for FDA 510(k) clearance.", level: "founder_reported" }],
    markets: [
      { key: "pulsewell-fda", question: "Will Pulsewell's patch receive FDA 510(k) clearance by December 31, 2027?", short: "Will Pulsewell get FDA clearance by end of 2027?",
        kind: "launch", yes: "The FDA's 510(k) database lists a clearance for Pulsewell's heart-rhythm patch with a decision date on or before December 31, 2027.",
        no: "No such clearance is listed with a decision date by then.", method: "The decision date in the FDA's public 510(k) premarket notification database.",
        source: "FDA 510(k) premarket notification database", closes: END_2027, openedDaysAgo: 230 },
      { key: "pulsewell-50k-patches", question: "Will Pulsewell ship 50,000 patches to patients by December 31, 2027?", short: "Will Pulsewell ship 50,000 patches by 2027?",
        kind: "adoption", yes: "Pulsewell has shipped at least 50,000 patches to patients by December 31, 2027, confirmed by an independent audit of its fulfillment records.",
        no: "Fewer than 50,000 shipped, or the figure cannot be verified.", method: "Patches shipped to patients under a clinician's order; samples and returns are excluded.",
        source: "Independent audit of fulfillment records", closes: END_2027, openedDaysAgo: 115 },
    ],
  },
  {
    slug: "stackwise",
    name: "Stackwise",
    tagline: "Code review that explains itself",
    headline: "Pull requests anyone can understand",
    description: "Stackwise, founded by Lena Fischer, is an open-source code-review assistant that summarizes pull requests, scores their risk, and explains changes in plain language.",
    industry: "devtools",
    tags: ["OpenSource", "AI"],
    founded: "2024-06-01",
    stage: "Pre-seed",
    headquarters: "Remote",
    glyph: "code",
    hue: 230,
    productDetails: "A GitHub app and CLI. Each pull request gets a summary, a risk score based on what it touches, and an explanation of every changed file. Self-hostable and open source under the MIT license.",
    features: ["file-text:PR summaries", "shield:Risk scores", "plug:CI plugin"],
    founders: [{
      role: "Founder / Maintainer",
      founder: {
        handle: "lenafischer", name: "Lena Fischer", headline: "Open source maintainer, building calmer code review",
        bio: "Lena maintains Stackwise and wants code review to take minutes, not days.",
        background: "Staff engineer at two developer-tools companies; long-time open source maintainer.",
        location: "Berlin, Germany", hue: 255,
        accomplishments: ["Maintainer of a popular testing library (demo)", "Speaker at a fictional European developer conference"],
      },
    }],
    videos: [
      { title: "Stackwise reviews a real pull request", description: "Lena runs Stackwise on a 900-line change.", kind: "demo", durationSeconds: 88, daysAgo: 2,
        lines: ["This pull request touches 41 files. Nobody wants to review it.", "Stackwise summarizes it in four sentences.", "It flags the two files that change authentication.", "And explains each change in plain English.", "Review time on our own repo went from two days to forty minutes."] },
      { title: "Why I made it open source", description: "Lena on building in public.", kind: "pitch", durationSeconds: 113, daysAgo: 24,
        lines: ["I'm Lena, and Stackwise is open source.", "Developers should be able to read the tool that reads their code.", "We're at 4,300 GitHub stars.", "We launch on Product Hunt in November.", "Ten thousand stars by the end of next year is the goal."] },
    ],
    updates: [
      { title: "4,000 GitHub stars", body: "The Stackwise repository passed 4,000 stars.", daysAgo: 20, kind: "milestone", verification: "independently_verified" },
      { title: "GitLab support", body: "Stackwise now reviews GitLab merge requests too.", daysAgo: 8, kind: "update", verification: "founder_reported" },
    ],
    claims: [{ statement: "The Stackwise repository has more than 4,000 GitHub stars.", level: "independently_verified", sourceName: "GitHub repository (demo)" }],
    markets: [
      { key: "stackwise-10k-stars", question: "Will the Stackwise GitHub repository have 10,000 stars by December 31, 2027?", short: "Will Stackwise reach 10,000 GitHub stars by 2027?",
        kind: "adoption", yes: "The star count shown on the Stackwise repository's GitHub page is 10,000 or more at any check on or before December 31, 2027.",
        no: "It stays below 10,000 through December 31, 2027.", method: "The repository's public star count, checked by the owner and archived with a dated snapshot.",
        source: "GitHub repository page, archived snapshot", closes: END_2027, openedDaysAgo: 150 },
      { key: "stackwise-product-hunt", question: "Will Stackwise finish #1 Product of the Day on its Product Hunt launch day in November 2026?", short: "Will Stackwise be #1 on Product Hunt launch day?",
        kind: "ranking", yes: "Product Hunt's daily leaderboard shows Stackwise in first place for its launch day, which must fall between November 1 and November 30, 2026.",
        no: "Stackwise finishes below first, or does not launch on Product Hunt in November 2026.", method: "The final daily ranking on Product Hunt's leaderboard for the launch date.",
        source: "Product Hunt daily leaderboard", closes: "2026-11-04T00:00:00-05:00", openedDaysAgo: 40 },
    ],
  },
  {
    slug: "tally",
    name: "Tally",
    tagline: "Round-ups into Treasury bills",
    headline: "Saving without thinking about it",
    description: "Tally, founded by Marcus Bell, is a savings app that rounds up card purchases and invests the spare change in short-term US Treasury bills.",
    industry: "fintech",
    tags: ["Savings", "Consumer"],
    founded: "2024-04-01",
    stage: "Seed",
    headquarters: "Atlanta, GA",
    glyph: "wallet",
    hue: 45,
    productDetails: "Link a card and Tally rounds every purchase up to the nearest dollar, sweeping the difference into Treasury bills through a regulated partner. Goal pots split savings by purpose.",
    features: ["coins:Round-ups", "landmark:Treasury yield", "target:Goal pots"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "marcusbell", name: "Marcus Bell", headline: "Making saving automatic",
        bio: "Marcus is building the savings habit he didn't have at 22.",
        background: "Worked in consumer lending risk at a bank for six years.",
        location: "Atlanta, GA", hue: 40,
        accomplishments: ["Built credit-risk models for a consumer bank (demo)", "Mentor at a fictional first-generation founders program"],
      },
    }],
    videos: [
      { title: "Spare change, real yield", description: "Marcus explains how Tally works.", kind: "pitch", durationSeconds: 99, daysAgo: 13,
        lines: ["I'm Marcus. At 22 I had zero savings.", "Not because I spent big. Because I never started.", "Tally rounds up every purchase and saves the change.", "It goes into Treasury bills, so it actually earns something.", "Our users saved an average of 41 dollars last month."] },
    ],
    updates: [
      { title: "Goal pots launched", body: "Users can split savings into named goals.", daysAgo: 28, kind: "update", verification: "founder_reported" },
    ],
    claims: [{ statement: "Tally users saved an average of $41 in September.", level: "founder_reported" }],
    markets: [
      { key: "tally-1m-arr", question: "Will Tally reach $1 million in annual recurring revenue by December 31, 2027?", short: "Will Tally reach $1M in annual revenue by 2027?",
        kind: "financial", yes: "Tally's audited or independently reviewed financial statements show annualized recurring revenue of at least $1,000,000 for any month ending on or before December 31, 2027.",
        no: "No such month, or the figure cannot be independently confirmed.", method: "Monthly recurring revenue times twelve, from subscription fees only. Demonstration market: financial milestones need legal review before any real-money use.",
        source: "Independent accountant's review shared with the owner", closes: END_2027, openedDaysAgo: 160 },
      { key: "tally-app-store-1", question: "Will Tally reach #1 in the Finance category of the US App Store on or before June 30, 2027?", short: "Will Tally hit #1 in Finance on the App Store?",
        kind: "ranking", yes: "An archived App Store ranking shows Tally at #1 among free Finance apps in the US on any day on or before June 30, 2027.",
        no: "It never reaches #1 in that chart by then.", method: "The top free Finance chart for the United States, as archived by a third-party rank tracker.",
        source: "Third-party App Store rank tracker archive", closes: MID_2027, openedDaysAgo: 70 },
    ],
  },
  {
    slug: "orbit-kitchen",
    name: "Orbit Kitchen",
    tagline: "Meal plans that shop for you",
    headline: "Dinner, planned and in your cart",
    description: "Orbit Kitchen, founded by Jasmine Ortiz, plans a week of meals around your budget and diet and fills your grocery cart automatically.",
    industry: "consumer",
    tags: ["Food", "Apps"],
    founded: "2024-08-01",
    stage: "Pre-seed",
    headquarters: "Austin, TX",
    glyph: "utensils",
    hue: 15,
    productDetails: "Pick a budget and a diet; Orbit plans seven dinners that share ingredients so nothing goes to waste, then builds the cart at a supported grocery store. Macros are tracked per meal.",
    features: ["calendar:Weekly plans", "shopping-cart:Auto grocery cart", "pie-chart:Macro tracking"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "jasmineortiz", name: "Jasmine Ortiz", headline: "Taking the thinking out of dinner",
        bio: "Jasmine is a former line cook building the app that plans dinner for busy people.",
        background: "Line cook for six years, then a product designer at a delivery company.",
        location: "Austin, TX", hue: 5,
        accomplishments: ["Designed checkout for a delivery app used by millions (demo)", "Cooked in two restaurants in Austin"],
      },
    }],
    videos: [
      { title: "A week of dinners in two minutes", description: "Jasmine plans her own week live.", kind: "demo", durationSeconds: 117, daysAgo: 5,
        lines: ["Budget: 70 dollars. Diet: high protein.", "Orbit picks seven dinners that share ingredients.", "One bag of spinach covers three meals.", "Tap once and the cart is ready for pickup.", "That used to take me an hour every Sunday."] },
      { title: "Why I left the kitchen to build an app", description: "Jasmine's story.", kind: "pitch", durationSeconds: 88, daysAgo: 33,
        lines: ["I cooked for a living and still ate cereal for dinner.", "Planning is the hard part, not cooking.", "So Orbit does the planning.", "Our goal: a hundred thousand downloads on Android by the end of 2027."] },
    ],
    updates: [{ title: "Android app released", body: "Orbit Kitchen is now on Google Play.", daysAgo: 40, kind: "milestone", verification: "independently_verified" }],
    claims: [{ statement: "Orbit Kitchen is available on Google Play.", level: "independently_verified", sourceName: "Google Play listing (demo)" }],
    markets: [
      { key: "orbit-100k-installs", question: "Will Orbit Kitchen's Android app show 100K+ downloads on Google Play by December 31, 2027?", short: "Will Orbit Kitchen pass 100K Android downloads?",
        kind: "adoption", yes: "Orbit Kitchen's Google Play listing shows the \"100K+ downloads\" badge or higher on or before December 31, 2027, captured in a dated snapshot.",
        no: "The listing shows less than 100K+ downloads through that date.", method: "Google Play's public download range on the app's listing.",
        source: "Google Play listing, archived snapshot", closes: END_2027, openedDaysAgo: 110 },
      { key: "orbit-top50-food", question: "Will Orbit Kitchen reach the top 50 free Food & Drink apps on the US App Store on or before June 30, 2027?", short: "Will Orbit Kitchen crack the top 50 Food & Drink apps?",
        kind: "ranking", yes: "An archived chart shows Orbit Kitchen in the top 50 of the US App Store's free Food & Drink chart on any day on or before June 30, 2027.",
        no: "It never reaches the top 50 in that chart by then.", method: "The US iPhone top free Food & Drink chart, as archived by a third-party rank tracker.",
        source: "Third-party App Store rank tracker archive", closes: MID_2027, openedDaysAgo: 50 },
    ],
  },
  {
    slug: "ferro-labs",
    name: "Ferro Labs",
    tagline: "E-bike kits for any bike",
    headline: "Any bike, electric in 20 minutes",
    description: "Ferro Labs, founded by Kenji Watanabe, makes modular drive kits that turn an ordinary bicycle into an e-bike in about twenty minutes.",
    industry: "hardware",
    tags: ["Mobility", "Climate"],
    founded: "2023-11-01",
    stage: "Pre-seed",
    headquarters: "Portland, OR",
    glyph: "bike",
    hue: 30,
    productDetails: "A hub motor wheel, a battery that clips to the bottle mount, and a sensor that reads pedal pressure. An app tunes the assist level and regenerative braking.",
    features: ["clock:20-minute install", "refresh-cw:Regen braking", "smartphone:App tuning"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "kenjiw", name: "Kenji Watanabe", headline: "Electrifying the bikes people already own",
        bio: "Kenji builds e-bike kits so nobody has to buy a whole new bike to ride electric.",
        background: "Hardware engineer at a consumer electronics company; bike mechanic on weekends.",
        location: "Portland, OR", hue: 200,
        accomplishments: ["Shipped three consumer hardware products (demo)", "Rebuilt more than 300 bikes as a volunteer mechanic"],
      },
    }],
    videos: [
      { title: "Converting a 1990s road bike", description: "Kenji installs the kit on camera.", kind: "demo", durationSeconds: 140, daysAgo: 7,
        lines: ["This bike is older than me. Let's make it electric.", "Swap the rear wheel for the Ferro hub.", "Clip the battery where the bottle cage was.", "Pair the app, set assist to medium.", "Nineteen minutes. And it rides like new."] },
    ],
    updates: [{ title: "Kickstarter date set", body: "The Ferro kit Kickstarter opens in February.", daysAgo: 22, kind: "update", verification: "founder_reported" }],
    claims: [{ statement: "200 people have paid deposits for the kit.", level: "disputed", sourceName: "Two community reports disagree (demo)" }],
    markets: [
      { key: "ferro-kickstarter", question: "Will Ferro Labs' Kickstarter campaign raise at least $500,000 by the time it closes, no later than March 31, 2027?", short: "Will Ferro Labs raise $500K on Kickstarter?",
        kind: "financial", yes: "Ferro Labs' Kickstarter page shows at least $500,000 pledged when its campaign ends, on or before March 31, 2027.",
        no: "Less than $500,000 pledged at the end, or no campaign ends by March 31, 2027.", method: "The final pledged total on the Kickstarter campaign page, in US dollars. Demonstration market.",
        source: "Kickstarter campaign page", closes: "2027-03-31T23:59:59-04:00", openedDaysAgo: 85 },
    ],
  },
  {
    slug: "tidewell",
    name: "Tidewell",
    tagline: "AI notes for therapists",
    headline: "More time with patients, less with paperwork",
    description: "Tidewell, founded by Ana Lucía Pérez, writes therapy session notes from the clinician's own summary so therapists spend less of their evening on documentation.",
    industry: "healthcare",
    tags: ["AI", "MentalHealth"],
    founded: "2024-03-01",
    stage: "Seed",
    headquarters: "Miami, FL",
    glyph: "mic",
    hue: 175,
    productDetails: "After a session the therapist speaks a two-minute summary; Tidewell drafts structured notes in the format their records system uses. Nothing is recorded during the session itself.",
    features: ["file-text:Session notes", "lock:Privacy first", "refresh-cw:EHR sync"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "anaperez", name: "Ana Lucía Pérez", headline: "Giving therapists their evenings back",
        bio: "Ana is a licensed therapist building the notes tool she needed.",
        background: "Licensed clinical social worker for eight years; later worked on health-records software.",
        location: "Miami, FL", hue: 290,
        accomplishments: ["Ran a community counseling practice (demo)", "Built documentation templates used by 40 clinics"],
      },
    }],
    videos: [
      { title: "Two minutes instead of forty", description: "Ana shows how a note gets written.", kind: "demo", durationSeconds: 92, daysAgo: 15,
        lines: ["After a session I used to write notes for forty minutes.", "Now I talk for two.", "Tidewell drafts the note in our clinic's format.", "I review it, fix one line, and sign.", "Nothing from the session itself is recorded."] },
    ],
    updates: [{ title: "200 clinicians", body: "Tidewell passed 200 paying clinicians.", daysAgo: 35, kind: "milestone", verification: "founder_reported" }],
    claims: [{ statement: "Tidewell does not record therapy sessions.", level: "founder_reported" }],
    markets: [
      { key: "tidewell-health-system", question: "Will Tidewell publicly announce a contract with a health system of at least 1,000 clinicians by December 31, 2027?", short: "Will Tidewell sign a 1,000-clinician health system?",
        kind: "adoption", yes: "Tidewell and a health system with at least 1,000 employed clinicians jointly announce a signed contract on or before December 31, 2027.",
        no: "No such joint announcement by then.", method: "A joint press release or both parties' public statements; clinician count from the health system's own published figures.",
        source: "Joint press release and the health system's published figures", closes: END_2027, openedDaysAgo: 130 },
    ],
  },
  {
    slug: "fieldnote",
    name: "Fieldnote",
    tagline: "Learn languages from local podcasts",
    headline: "Learn Spanish from people, not textbooks",
    description: "Fieldnote, founded by Theo Laurent, teaches languages through short podcasts recorded by real people in their own cities, with interactive transcripts.",
    industry: "edtech",
    tags: ["Languages", "Audio"],
    founded: "2024-09-01",
    stage: "Pre-seed",
    headquarters: "New Orleans, LA",
    glyph: "headphones",
    hue: 285,
    productDetails: "Each episode is a five-minute conversation recorded on location. Tap any word in the transcript to hear it again slowly, save it, and practice it later in spaced review.",
    features: ["headphones:Local podcasts", "type:Live transcripts", "repeat:Spaced review"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "theolaurent", name: "Theo Laurent", headline: "Language learning that sounds like real life",
        bio: "Theo learned four languages by listening to strangers and wants to bottle that.",
        background: "Radio producer for seven years before moving into education technology.",
        location: "New Orleans, LA", hue: 270,
        accomplishments: ["Produced a public-radio series heard in 40 cities (demo)", "Speaks four languages"],
      },
    }],
    videos: [
      { title: "Recording an episode in a market", description: "Theo records a Fieldnote episode on location.", kind: "demo", durationSeconds: 131, daysAgo: 10,
        lines: ["We're in a fish market at six in the morning.", "Rosa has sold fish here for thirty years.", "She talks for five minutes. We record everything.", "Tonight it's an episode with a tappable transcript.", "That's how you learn the Spanish people actually speak."] },
    ],
    updates: [{ title: "300 episodes", body: "Fieldnote now has 300 episodes across Spanish and French.", daysAgo: 19, kind: "milestone", verification: "independently_verified" }],
    claims: [{ statement: "Fieldnote publishes 300 episodes in two languages.", level: "independently_verified", sourceName: "Fieldnote catalog (demo)" }],
    markets: [
      { key: "fieldnote-edtech-award", question: "Will Fieldnote win the 2027 Open Learning Award (a fictional independent EdTech award) by December 31, 2027?", short: "Will Fieldnote win the 2027 Open Learning Award?",
        kind: "award", yes: "The award's organizers name Fieldnote the winner of the 2027 Open Learning Award in any category on or before December 31, 2027.",
        no: "Fieldnote is not named a winner, or no 2027 awards are announced by then.", method: "Winners as listed on the organizers' results page; shortlists and finalists do not count.",
        source: "Open Learning Award results page (fictional)", closes: END_2027, openedDaysAgo: 75 },
    ],
  },
  {
    slug: "parallax-ai",
    name: "Parallax AI",
    tagline: "Vision AI for factory inspection",
    headline: "Spotting defects a human eye would miss",
    description: "Parallax AI, founded by Omar Haddad, runs computer-vision models on cheap cameras at the production line to catch defects in real time, without sending video to the cloud.",
    industry: "ai",
    tags: ["ComputerVision", "Manufacturing"],
    founded: "2024-01-01",
    stage: "Seed",
    headquarters: "Detroit, MI",
    glyph: "eye",
    hue: 220,
    productDetails: "A small box beside the line runs the model offline. Workers label twenty good and bad parts on a tablet, and Parallax trains a model in about three minutes.",
    features: ["scan:Defect detection", "wifi-off:Runs offline", "timer:3-minute training"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "omarhaddad", name: "Omar Haddad", headline: "Putting AI where the parts are made",
        bio: "Omar builds vision models that run on the factory floor, not in a data center.",
        background: "Machine-learning researcher; spent four years in quality engineering at an auto supplier.",
        location: "Detroit, MI", hue: 185,
        accomplishments: ["Published research on few-shot defect detection (demo)", "Led quality engineering for two plants"],
      },
    }],
    videos: [
      { title: "Training a model in three minutes", description: "Omar trains Parallax on a new part.", kind: "demo", durationSeconds: 101, daysAgo: 8,
        lines: ["New part, never seen before.", "We label twenty good ones and five bad ones.", "Three minutes later, the model is running.", "It just caught a hairline crack I couldn't see.", "And no video ever left this building."] },
      { title: "Why we run offline", description: "Omar on privacy and uptime in factories.", kind: "pitch", durationSeconds: 85, daysAgo: 41,
        lines: ["Factories don't want their video in the cloud.", "And the internet goes down. The line doesn't stop.", "So Parallax runs entirely on the box.", "Twelve plants use it today."] },
    ],
    updates: [{ title: "Twelve plants live", body: "Parallax runs at twelve plants in three states.", daysAgo: 26, kind: "milestone", verification: "founder_reported" }],
    claims: [{ statement: "Parallax catches 98% of defects on the lines it runs.", level: "disputed", sourceName: "One customer reported a lower figure (demo)" }],
    markets: [
      { key: "parallax-100-plants", question: "Will Parallax AI be running at 100 production plants by December 31, 2027?", short: "Will Parallax AI reach 100 plants by 2027?",
        kind: "adoption", yes: "Parallax reports at least 100 distinct production plants with an active device on December 31, 2027, confirmed by an independent audit or customer list shared with the owner.",
        no: "Fewer than 100, or the figure cannot be verified.", method: "A plant counts if at least one Parallax device inspected parts there in December 2027.",
        source: "Independent audit of device telemetry", closes: END_2027, openedDaysAgo: 190 },
      { key: "parallax-foundry-cohort", question: "Will Parallax AI be selected for the 2027 cohort of the Foundry Industrial AI accelerator (fictional) by June 30, 2027?", short: "Will Parallax AI get into the Foundry accelerator?",
        kind: "accelerator", yes: "The accelerator's published 2027 cohort list includes Parallax AI on or before June 30, 2027.",
        no: "Parallax AI is not on the published list by then.", method: "The cohort list as published by the accelerator; an interview does not count.",
        source: "Foundry accelerator cohort announcement (fictional)", closes: MID_2027, openedDaysAgo: 45 },
    ],
  },
  {
    slug: "kestrel-aero",
    name: "Kestrel Aero",
    tagline: "Drones that scout crops",
    headline: "A drone that tells farmers what's wrong",
    description: "Kestrel Aero, founded by Isabel Moreno, flies autonomous drones over fields at dawn and sends farmers a map of pests, drought stress and disease before they can see it.",
    industry: "robotics",
    tags: ["AgTech", "Drones"],
    founded: "2023-07-01",
    stage: "Seed",
    headquarters: "Des Moines, IA",
    glyph: "plane",
    hue: 95,
    productDetails: "The drone launches from a weatherproof dock, flies a set route at sunrise, and returns to charge. Multispectral images become a map with problem areas circled by 7 AM.",
    features: ["map:Field maps", "bug:Pest alerts", "home:Auto docking"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "isabelmoreno", name: "Isabel Moreno", headline: "Farmer's daughter, drone engineer",
        bio: "Isabel grew up on a corn farm and builds the scout her father never had time to be.",
        background: "Aerospace engineer; built flight software for agricultural drones.",
        location: "Des Moines, IA", hue: 110,
        accomplishments: ["Wrote flight software for 2,000 drones (demo)", "4-H state champion in crop science"],
      },
    }],
    videos: [
      { title: "Sunrise flight over 400 acres", description: "A full autonomous scouting run.", kind: "demo", durationSeconds: 126, daysAgo: 12,
        lines: ["It's 5:40 AM and the dock is opening.", "Nobody is touching the controls.", "Four hundred acres in thirty-five minutes.", "By seven, the farmer has a map with two problem spots.", "One was rootworm. Caught a week early."] },
    ],
    updates: [
      { title: "Demo Day result", body: "Kestrel pitched at the fictional Heartland AgTech Demo Day and did not place.", daysAgo: 55, kind: "update", verification: "independently_verified" },
    ],
    claims: [{ statement: "Kestrel drones scouted 60,000 acres this season.", level: "founder_reported" }],
    markets: [
      { key: "kestrel-1000-farms", question: "Will Kestrel Aero have drones operating on 1,000 farms by December 31, 2028?", short: "Will Kestrel Aero reach 1,000 farms by 2028?",
        kind: "adoption", yes: "Kestrel reports at least 1,000 distinct farms with a drone that flew in the 2028 season, confirmed by an independent audit.",
        no: "Fewer than 1,000, or the figure cannot be verified.", method: "A farm counts if a Kestrel drone completed at least one scouting flight there during 2028.",
        source: "Independent audit of flight logs", closes: END_2028, openedDaysAgo: 140 },
      { key: "kestrel-demo-day", question: "Will Kestrel Aero place first at the 2026 Heartland AgTech Demo Day (fictional)?", short: "Will Kestrel win Heartland AgTech Demo Day?",
        kind: "competition", yes: "The organizers name Kestrel Aero first place at the 2026 Heartland AgTech Demo Day.", no: "Another company places first.",
        method: "First place as announced by the organizers on the day.", source: "Demo Day organizers' announcement (fictional)",
        closes: "2026-08-20T09:00:00-05:00", openedDaysAgo: 120,
        resolved: { outcome: "no", reason: "The organizers named another company first place on August 20, 2026 (demo).", daysAgo: 56 } },
    ],
  },
  {
    slug: "pixel-harbor",
    name: "Pixel Harbor",
    tagline: "Cozy fishing game for phones",
    headline: "The calmest game on your phone",
    description: "Pixel Harbor, founded by Ravi Shah, makes Tidepool, a cozy pixel-art fishing game for iOS and Android with no ads and no timers.",
    industry: "gaming",
    tags: ["Mobile", "IndieDev"],
    founded: "2024-05-01",
    stage: "Bootstrapped",
    headquarters: "Seattle, WA",
    glyph: "fish",
    hue: 195,
    productDetails: "Fish, decorate a harbor, trade with neighbors. One price, no ads, no energy timers. Launches worldwide on iOS and Android in November.",
    features: ["fish:200 fish to catch", "home:Build a harbor", "ban:No ads, no timers"],
    founders: [{
      role: "Founder / Developer",
      founder: {
        handle: "ravishah", name: "Ravi Shah", headline: "Making the calmest game on your phone",
        bio: "Ravi is a solo developer making the game he plays to unwind.",
        background: "Mobile engineer at a social app, then went solo in 2024.",
        location: "Seattle, WA", hue: 190,
        accomplishments: ["Built a mobile app with 2 million installs (demo)", "Tidepool was featured in a fictional indie showcase"],
      },
    }],
    videos: [
      { title: "Tidepool launch trailer", description: "Ravi introduces Tidepool before launch.", kind: "pitch", durationSeconds: 70, daysAgo: 5,
        lines: ["I made a game where nothing is urgent.", "You fish. You build a little harbor.", "No ads. No energy. No timers.", "Tidepool launches November 12.", "I'm hoping for the top ten. I'll settle for calm."] },
    ],
    updates: [{ title: "Launch date set", body: "Tidepool launches worldwide on November 12, 2026.", daysAgo: 14, kind: "milestone", verification: "independently_verified" }],
    claims: [{ statement: "Tidepool has 85,000 pre-registrations.", level: "founder_reported" }],
    markets: [
      { key: "pixel-harbor-top10", question: "Will Tidepool reach the top 10 free games on the US App Store within 14 days of its November 12, 2026 launch?", short: "Will Tidepool crack the top 10 free games at launch?",
        kind: "ranking", yes: "An archived chart shows Tidepool in the top 10 of the US App Store's free Games chart on any day from November 12 to November 26, 2026.",
        no: "It never reaches the top 10 in that window, or it does not launch by November 26, 2026.", method: "The US iPhone top free Games chart, as archived by a third-party rank tracker.",
        source: "Third-party App Store rank tracker archive", closes: "2026-11-12T00:00:00-05:00", openedDaysAgo: 30 },
    ],
  },
  {
    slug: "carbonfold",
    name: "Carbonfold",
    tagline: "Concrete that stores CO2",
    headline: "Buildings that lock carbon away",
    description: "Carbonfold, founded by Hannah Brooks, makes a concrete additive that permanently binds captured carbon dioxide while making the concrete stronger.",
    industry: "climate",
    tags: ["Materials", "CarbonRemoval"],
    founded: "2023-02-01",
    stage: "Series A",
    headquarters: "Boston, MA",
    glyph: "leaf",
    hue: 120,
    productDetails: "Captured CO2 is mineralized into a powder that replaces part of the cement in a standard mix. Each cubic meter stores carbon and needs less cement, which is where most of concrete's emissions come from.",
    features: ["leaf:Stores CO2", "building:Stronger mix", "factory:Drop-in at plants"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "hannahbrooks", name: "Hannah Brooks", headline: "Materials scientist turning CO2 into buildings",
        bio: "Hannah wants every new building to be a place carbon goes to stay.",
        background: "PhD in materials science; postdoc on mineralization chemistry.",
        location: "Boston, MA", hue: 130,
        accomplishments: ["Six peer-reviewed papers on CO2 mineralization (demo)", "Named to a fictional list of climate innovators"],
      },
    }],
    videos: [
      { title: "A pour you can't see the difference in", description: "Hannah at a ready-mix plant.", kind: "demo", durationSeconds: 107, daysAgo: 16,
        lines: ["This truck is carrying Carbonfold concrete.", "To the crew, it pours exactly the same.", "Each cubic meter stored about eighteen kilos of CO2.", "And it tested twelve percent stronger at 28 days.", "Next: a whole building."] },
    ],
    updates: [
      { title: "First commercial pour", body: "Carbonfold concrete was used in a parking structure's foundation (demo).", daysAgo: 48, kind: "milestone", verification: "independently_verified" },
    ],
    claims: [{ statement: "Each cubic meter stores about 18 kg of CO2.", level: "founder_reported" }],
    markets: [
      { key: "carbonfold-building", question: "Will a completed commercial building using Carbonfold concrete in its structure be publicly announced by December 31, 2027?", short: "Will a finished building use Carbonfold concrete by 2027?",
        kind: "launch", yes: "The building's developer or contractor publicly announces completion of a commercial building whose structural concrete includes Carbonfold, on or before December 31, 2027.",
        no: "No such completed building is announced by then.", method: "A certificate of occupancy or the developer's completion announcement; foundations alone do not count.",
        source: "Developer announcement and public permit records", closes: END_2027, openedDaysAgo: 250 },
      { key: "carbonfold-material-futures", question: "Will Carbonfold be named a winner of the 2027 Material Futures Challenge (a fictional independent competition) by December 31, 2027?", short: "Will Carbonfold win the Material Futures Challenge?",
        kind: "competition", yes: "The challenge's organizers name Carbonfold among the 2027 winners on or before December 31, 2027.",
        no: "Carbonfold is not named a winner, or no 2027 winners are announced by then.", method: "Winners as published by the organizers; finalists and honorable mentions do not count.",
        source: "Material Futures Challenge results (fictional)", closes: END_2027, openedDaysAgo: 80 },
    ],
  },
  {
    slug: "loop-closet",
    name: "Loop Closet",
    tagline: "Rent clothes from neighbors",
    headline: "A closet the size of your neighborhood",
    description: "Loop Closet, founded by Zoe Kim, lets people rent clothes from others nearby for an evening or a week, with pickup at partner cafés.",
    industry: "consumer",
    tags: ["Fashion", "Marketplace"],
    founded: "2024-07-01",
    stage: "Pre-seed",
    headquarters: "Los Angeles, CA",
    glyph: "shirt",
    hue: 320,
    productDetails: "List a piece in thirty seconds, set a price per day, and drop it at a partner café. Renters pick up nearby. Loop handles cleaning between rentals.",
    features: ["shirt:Rent nearby", "map-pin:Café pickup", "sparkles:Cleaning included"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "zoekim", name: "Zoe Kim", headline: "Sharing closets, block by block",
        bio: "Zoe is building a closet the whole neighborhood shares.",
        background: "Merchandiser at a fashion retailer; launched a campus clothing swap in college.",
        location: "Los Angeles, CA", hue: 315,
        accomplishments: ["Ran clothing swaps for 5,000 students (demo)", "Merchandised a top-selling retail line"],
      },
    }],
    videos: [
      { title: "Renting a jacket for one night", description: "Zoe rents and returns a jacket.", kind: "demo", durationSeconds: 79, daysAgo: 9,
        lines: ["I need a jacket for one dinner. Not forever.", "Three listings within a mile.", "Pick up at the café on the corner.", "Eight dollars for the night, cleaning included.", "That's Loop."] },
    ],
    updates: [{ title: "50 partner cafés", body: "Loop Closet pickups now run through 50 cafés in Los Angeles.", daysAgo: 21, kind: "milestone", verification: "founder_reported" }],
    claims: [{ statement: "Loop Closet has 50 partner cafés.", level: "founder_reported" }],
    markets: [
      { key: "loop-second-city", question: "Will Loop Closet launch rentals in a second US metro area by June 30, 2027?", short: "Will Loop Closet launch in a second city by mid-2027?",
        kind: "launch", yes: "Loop Closet's app lets anyone in a US metro area other than Los Angeles complete a rental on or before June 30, 2027.",
        no: "Rentals are still available only in Los Angeles on that date.", method: "The owner completes or observes a test rental in the new metro area.",
        source: "Loop Closet app availability, checked by the owner", closes: MID_2027, openedDaysAgo: 90 },
    ],
  },
  {
    slug: "paystream",
    name: "Paystream",
    tagline: "Instant pay for freelancers",
    headline: "Get paid the day you finish the job",
    description: "Paystream, founded by Daniel Asante, advances freelancers the money for approved invoices the same day, and collects from the client later.",
    industry: "fintech",
    tags: ["Payments", "FutureOfWork"],
    founded: "2023-10-01",
    stage: "Seed",
    headquarters: "New York, NY",
    glyph: "send",
    hue: 260,
    productDetails: "Freelancers send invoices through Paystream; once the client approves, the money arrives within hours for a flat fee. Works with the invoicing tools freelancers already use.",
    features: ["zap:Same-day payouts", "file-check:Invoice approval", "percent:Flat fee"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "danielasante", name: "Daniel Asante", headline: "Ending the 60-day wait to get paid",
        bio: "Daniel freelanced for five years and waited too long for every invoice.",
        background: "Freelance designer, then payments product manager at a fintech.",
        location: "New York, NY", hue: 250,
        accomplishments: ["Built invoicing for a payments platform (demo)", "Freelanced for 40 clients over five years"],
      },
    }],
    videos: [
      { title: "Sixty days is too long", description: "Daniel's pitch for Paystream.", kind: "pitch", durationSeconds: 94, daysAgo: 18,
        lines: ["The average freelancer waits forty days to get paid.", "Some wait ninety.", "Paystream pays you the day your client approves.", "We've advanced 11 million dollars of invoices so far.", "Next year we raise a Series A. Or that's the plan."] },
    ],
    updates: [{ title: "$11M advanced", body: "Paystream has advanced $11M in approved invoices (demo).", daysAgo: 32, kind: "milestone", verification: "founder_reported" }],
    claims: [{ statement: "Paystream has advanced $11M in invoices.", level: "founder_reported" }],
    markets: [
      { key: "paystream-series-a", question: "Will Paystream publicly announce a Series A round of at least $5 million by December 31, 2027?", short: "Will Paystream raise a $5M+ Series A by 2027?",
        kind: "financial", yes: "Paystream or its lead investor publicly announces a priced Series A of at least $5,000,000 on or before December 31, 2027.",
        no: "No such announcement by then.", method: "A public announcement by the company or lead investor; a SAFE or note does not count. Demonstration market: financial milestones need legal review before any real-money use.",
        source: "Company or lead investor announcement", closes: END_2027, openedDaysAgo: 175 },
      { key: "paystream-50m-advanced", question: "Will Paystream have advanced $50 million of approved invoices in total by December 31, 2027?", short: "Will Paystream advance $50M of invoices by 2027?",
        kind: "financial", yes: "Paystream's cumulative advanced invoice volume reaches $50,000,000 on or before December 31, 2027, confirmed by an independent accountant's review.",
        no: "Less than $50,000,000, or the figure cannot be independently confirmed.", method: "The total face value of invoices Paystream paid out early since launch. Demonstration market: financial milestones need legal review before any real-money use.",
        source: "Independent accountant's review shared with the owner", closes: END_2027, openedDaysAgo: 65 },
    ],
  },
  {
    slug: "tracelight",
    name: "Tracelight",
    tagline: "Observability for AI agents",
    headline: "See exactly what your AI agent did",
    description: "Tracelight, founded by Sofia Rossi, is an open-source SDK and dashboard that records every step an AI agent takes, so developers can debug and evaluate them.",
    industry: "devtools",
    tags: ["AI", "OpenSource"],
    founded: "2025-01-01",
    stage: "Pre-seed",
    headquarters: "San Francisco, CA",
    glyph: "activity",
    hue: 240,
    productDetails: "Two lines of code record every model call, tool call and decision as a trace. The dashboard replays a run step by step and compares versions of an agent on the same tasks.",
    features: ["git-branch:Step-by-step traces", "play:Replay runs", "bar-chart:Evaluations"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "sofiarossi", name: "Sofia Rossi", headline: "Making AI agents debuggable",
        bio: "Sofia builds tools for developers whose software now makes its own decisions.",
        background: "Infrastructure engineer on observability platforms for six years.",
        location: "San Francisco, CA", hue: 225,
        accomplishments: ["Core contributor to an open-source tracing project (demo)", "Built monitoring for a fictional cloud provider"],
      },
    }],
    videos: [
      { title: "Debugging an agent that went wrong", description: "Sofia replays a failed agent run.", kind: "demo", durationSeconds: 112, daysAgo: 1,
        lines: ["This agent was supposed to book a meeting. It emailed the whole company.", "Let's replay the trace.", "Step four: it misread the calendar tool's answer.", "Here's the exact prompt and response.", "Fixed in one line, and the evaluation proves it."] },
    ],
    updates: [{ title: "SDK 1.0", body: "Tracelight's SDK reached version 1.0.", daysAgo: 17, kind: "milestone", verification: "independently_verified" }],
    claims: [{ statement: "The Tracelight SDK passed 40,000 weekly npm downloads.", level: "independently_verified", sourceName: "npm download stats (demo)" }],
    markets: [
      { key: "tracelight-100k-npm", question: "Will the Tracelight SDK pass 100,000 weekly downloads on npm in any week ending on or before December 31, 2027?", short: "Will Tracelight hit 100K weekly npm downloads?",
        kind: "adoption", yes: "npm's public download statistics show at least 100,000 downloads of the Tracelight SDK package in any week ending on or before December 31, 2027.",
        no: "No week reaches 100,000 by then.", method: "Weekly downloads from npm's public download-count API for the main package only.",
        source: "npm public download statistics", closes: END_2027, openedDaysAgo: 100 },
    ],
  },
  {
    slug: "sona-audio",
    name: "Sona Audio",
    tagline: "Earbuds for clearer conversations",
    headline: "Hear the person across the table",
    description: "Sona Audio, founded by Elijah Turner, makes earbuds that turn down background noise and turn up the voice in front of you, for people who struggle in loud rooms.",
    industry: "hardware",
    tags: ["Audio", "Accessibility"],
    founded: "2024-02-01",
    stage: "Seed",
    headquarters: "Nashville, TN",
    glyph: "ear",
    hue: 340,
    productDetails: "Beam-forming microphones focus on the voice you face. A hearing check in the app tunes each earbud to your ears. Eight hours of battery, sold without a prescription.",
    features: ["ear:Voice focus", "sliders:Personal tuning", "battery:8-hour battery"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "elijahturner", name: "Elijah Turner", headline: "Building earbuds for loud rooms",
        bio: "Elijah has mild hearing loss and built the earbuds he couldn't find.",
        background: "Audio engineer for live music, then acoustic engineer at a headphone maker.",
        location: "Nashville, TN", hue: 0,
        accomplishments: ["Mixed live sound for 600 shows (demo)", "Designed acoustics for two headphone models"],
      },
    }],
    videos: [
      { title: "A conversation in a loud bar", description: "Elijah tests Sona in a real bar.", kind: "demo", durationSeconds: 83, daysAgo: 6,
        lines: ["It's loud in here. Listen to this without Sona.", "Now with Sona on.", "The music drops back. Her voice comes forward.", "No prescription. Tuned to my ears in the app.", "We're shipping the first ten thousand next year."] },
    ],
    updates: [{ title: "Pre-orders open", body: "Sona opened pre-orders with shipping next spring.", daysAgo: 29, kind: "update", verification: "founder_reported" }],
    claims: [{ statement: "Sona has 6,000 pre-orders.", level: "unverified" }],
    markets: [
      { key: "sona-10k-units", question: "Will Sona Audio ship 10,000 units to customers by December 31, 2027?", short: "Will Sona Audio ship 10,000 earbuds by 2027?",
        kind: "adoption", yes: "Sona Audio has delivered at least 10,000 units to paying customers by December 31, 2027, confirmed by its contract manufacturer's shipment records or an independent audit.",
        no: "Fewer than 10,000 delivered, or the figure cannot be verified.", method: "Units delivered to customers, net of returns within 30 days.",
        source: "Independent audit of shipment records", closes: END_2027, openedDaysAgo: 125 },
    ],
  },
  {
    slug: "draftboard",
    name: "Draftboard",
    tagline: "Sketches into app prototypes",
    headline: "Draw an app, get a working prototype",
    description: "Draftboard, founded by Chloe Nguyen, turns a photo of a hand-drawn app sketch into a clickable prototype in about a minute.",
    industry: "ai",
    tags: ["Design", "NoCode"],
    founded: "2024-10-01",
    stage: "Seed",
    headquarters: "Toronto, ON",
    glyph: "pen",
    hue: 280,
    productDetails: "Snap a photo of a whiteboard or a napkin. Draftboard recognizes the screens, buttons and flow, then builds a clickable prototype you can share and export to a design tool.",
    features: ["camera:Snap a sketch", "mouse-pointer:Clickable prototype", "share:Export anywhere"],
    founders: [{
      role: "Founder / CEO",
      founder: {
        handle: "chloenguyen", name: "Chloe Nguyen", headline: "From napkin to prototype in a minute",
        bio: "Chloe wants anyone with an idea to see it working the same day.",
        background: "Product designer for seven years; taught a design course at a community college.",
        location: "Toronto, ON", hue: 300,
        accomplishments: ["Designed apps with 10 million users (demo)", "Taught 400 students product design"],
      },
    }],
    videos: [
      { title: "Napkin to prototype", description: "Chloe sketches and Draftboard builds.", kind: "demo", durationSeconds: 74, daysAgo: 3,
        lines: ["Three screens on a napkin. A login, a list, a detail.", "Snap a photo.", "Fifty seconds later, it's clickable.", "Tap the list item and the detail screen opens.", "Share the link. Your idea, working, today."] },
      { title: "Why ideas die in sketches", description: "Chloe's pitch.", kind: "pitch", durationSeconds: 90, daysAgo: 37,
        lines: ["Most app ideas never get past a sketch.", "Building a prototype takes days and a designer.", "Draftboard takes a minute.", "Twenty thousand people used it last month."] },
    ],
    updates: [{ title: "20,000 monthly users", body: "Draftboard passed 20,000 monthly users.", daysAgo: 23, kind: "milestone", verification: "founder_reported" }],
    claims: [{ statement: "Draftboard has 20,000 monthly users.", level: "founder_reported" }],
    markets: [
      { key: "draftboard-acquired", question: "Will Draftboard announce an acquisition by another company by December 31, 2028?", short: "Will Draftboard be acquired by 2028?",
        kind: "financial", yes: "Draftboard or its acquirer publicly announces a signed agreement for another company to acquire Draftboard on or before December 31, 2028.",
        no: "No such announcement by then.", method: "A public announcement of a signed acquisition agreement; rumors and talks do not count. Demonstration market: financial milestones need legal review before any real-money use.",
        source: "Company or acquirer announcement", closes: END_2028, openedDaysAgo: 60 },
      { key: "draftboard-50k-wau", question: "Will Draftboard reach 50,000 weekly active users by December 31, 2027?", short: "Will Draftboard reach 50K weekly users by 2027?",
        kind: "adoption", yes: "Draftboard reports at least 50,000 weekly active users for any week ending on or before December 31, 2027, confirmed by an independent analytics audit.",
        no: "No week reaches 50,000 verified weekly active users by then.", method: "Distinct accounts that created or opened a prototype in the week.",
        source: "Independent analytics audit", closes: END_2027, openedDaysAgo: 105 },
    ],
  },
];

/** Every demo market with its startup, in catalog order. */
export function demoMarkets(): { startup: DemoStartup; market: DemoMarket }[] {
  return DEMO_STARTUPS.flatMap((startup) => startup.markets.map((market) => ({ startup, market })));
}
