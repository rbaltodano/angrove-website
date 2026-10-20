# Angrove — Website

Source for [angrove.app](https://angrove.app): the product site, User Guide, FAQ, case studies,
Development Notes, privacy policy, and bug-report form for Angrove, a private iOS study app whose language model runs
entirely on the iPhone. The app itself lives in
[Angrove-iOS](https://github.com/rbaltodano/Angrove-iOS).

Plain HTML/CSS/JS, no build step, deployed with GitHub Pages from `main`. Open `index.html`
directly in a browser, or serve the repository root:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Pages

```
(repository root)
  index.html          Home (built from Figma "source-of-truth" / Home, node 169:7019)
  guide.html          The app's User Guide (Settings → User Guide) word for word: First Five Minutes, eleven topics, Try It app windows
  faq.html            Common questions: release, cost, privacy, the model and its sources
  features.html       Redirect to guide.html (also how-it-works.html, insight-tree.html)
  model.html          Redirect to faq.html (the model question)
  privacy.html        Privacy Policy for the app and website (linked from every footer)
  about.html          Founder note, the four principles, engineering showcase preparation and review contact
  case-study.html     Case Studies: product story, architecture, key decisions, and links to evidence
  blog/index.html     Development Notes: newest-first index of experiments and archived research
  blog/*.html         Four standalone notes with dated methods, charts, and limitations
  css/blog.css        Blog index and article layout; reuses case-study.css for evidence
  report.html         Bug report form that sends to the support inbox through Formspree
  css/site.css        All tokens and components
  css/demos.css       Internal-page interaction styles
  js/site.js          Mobile menu, smooth scrolling, headline reveal, FAQ accordions
  js/bug-report.js    Submits the support form to Formspree and shows the result
  js/dot-field.js     Dot-grid background for [data-dot-field] sections: idle shimmer, a ripple from the pointer every 2 s, and a ripple on click/tap
  js/boot.js          Home startup: the app's growing leaf/dots, waits for first-screen images
  js/boot-assets.js   Streams first-screen image downloads once; feeds the loading percentage
  js/hero-phone.js    Home hero: live question, streamed answer, floating Insights
  js/guide.js         Guide: the topic list marks the topic being read
  js/guide-tasks.js   Guide: the Model Tasks practice queue
  js/map-flow.js       Home: the pinned photo panel that scrolls horizontally from answer to Insight to tree, which turns into Study in place
  js/page-demos.js    Local-only internal-page interactions
  js/insight-tree.js  Home page Insight Tree animation (port of the app's canvas and Study mode; one scroll-driven tree/3D view)
  js/grounding-demo.js  Home Library card: Library cards scrolling in a loop that follows page scroll
  assets/home/        Images exported from Figma
  assets/brand/       Brand assets, including boot leaf frames and dots from the app
  assets/app/         Real app screenshots and the Study demo video (from Angrove-iOS/Documentation)
```

Each page repeats the same header and footer markup; update all of them together.
The interactive examples are illustrations, not live app inference. The three Library excerpts
come from the bundled `passages.json` corpus; the explanatory connections are editorial copy.

Home startup downloads about 2.13 MB of critical images. The web-optimized vine sheets preserve
the original 24 frames and dimensions; each idle loop still repeats grow frames 21–24 at 4 fps.
The boot percentage tracks received bytes, holds below 100% until decoding and preparation
finish, and then the page reveals. Vine growth starts only after the page reveal completes.
The download deadline resets when bytes arrive, so a healthy slow transfer is not cancelled.
Original vine exports remain available alongside the `*-paint-web.webp` versions.
The boot mark fades in and out over 0.5 seconds, followed by the app's 1.5-second page reveal
(0.3-second opacity-only reveal with reduced motion). Scroll and page interaction stay locked
until the reveal finishes. Home loads and reloads start at the top; explicit section links retain
their destination.

## Still to do

- Keep the FAQ's model answer in step with the app's model. As of 2026-10-02 the
  main build uses the Gemma 4 E4B LiteRT Community package (not fine-tuned) on LiteRT-LM.

## Source docs

Copy sources: `../WEBSITE_COPY.md`, `../CONTENT.md`, and the Angrove-Foundations docs
(`MISSION.md`, `FUNCTIONALITY.md`, `MODEL-INTEGRATION.md`).

## Encryption copy

Use **Fully Encrypted** with the scope “Your saved personal data is encrypted on your device.”
The home, About, FAQ, User Guide and shared footer use this wording.
The guide’s privacy topic explains AES-256-GCM, Keychain keys, local backups and recovery,
and that deliberate conversation exports remain readable JSON. Appearance preferences, public
books/model assets, displayed content and Apple-managed backup protection are outside this claim.

## Case Studies

`case-study.html` is linked after About in every primary navbar and footer, and from the About
essay. It uses the October 5, 2026 captures in `assets/app/case-study-2026-10-05/` and the existing Study clip. Three October 8 app recordings now appear in the product section: a question and its conversation tree, the global Insight Tree, and on-device read-aloud playback. The report distinguishes historical simulator comparisons from
independent acceptance, phone performance, user outcomes and release status. Source text and
aggregate evaluation evidence live in Angrove-iOS `Documentation/Case-Study.md` and
`Documentation/Evaluation.md`. Keep the values aligned when new evidence is published.

The seven current JPEG originals are preserved unchanged. The Case Studies page groups them into
product, semantic-map documentation, and expanded source-detail galleries with full-size image
links. The two technical diagrams are mobile browser captures of the website User Guide.
The Nature of Evil conversation shows Corpus Grounded details and Summa Theologica links.
Matching originals live in the iOS repo’s dated Screenshots directory.

The page leads with the problem and Ryan’s role, followed by the current product, architecture,
and engineering decisions. A short evidence section explains what testing changed and links to
standalone Development Notes; next steps close the story. The existing URL remains
`case-study.html`. Its `#performance`, `#evaluation`, `#sources`, and `#exploration` fragments
still land on the corresponding summary and article link, preserving existing references.

## Development Notes

`blog/` is the development blog, linked as “Dev Notes” in every primary navbar and
“Development Notes” in every footer. It lists four notes, newest work first:

- `blog/better-sources-bigger-model.html` — October 15–20 experiments comparing model size,
  factual behavior, phone constraints, and retrieval. Distinguishes shared fetched evidence
  from the first end-to-end Wikipedia prototype.
- `blog/where-the-wait-goes.html` — October 8 iPhone timing and sustained-session measurements.
- `blog/choosing-a-thinking-default.html` — October 2 simulator comparison of native thinking.
- `blog/a-working-model-is-the-first-gate.html` — August–September exploration, explicitly
  archived and shelved on September 25. This is historical reporting, not resumed research.

Dates identify the work being reported. The migration preserves results, table values,
chart data, methods, and limitations. `js/case-charts.js` and `css/case-study.css` are shared
by the posts with charts; the case study no longer loads the chart script. Every post links
back to the index and product story, with related notes for continued reading.

Keep the index newest-first when adding posts. Use the existing article shell, include the
experiment dates and tested configuration, distinguish unreleased work from product behavior,
and carry limitations alongside results. Summarize lasting product decisions in the case
study and link to their full notes rather than appending another experiment to that page.

## Availability and engineering references

The iPhone beta is open on TestFlight at https://testflight.apple.com/join/qHDFeAUa.
All download buttons use “Download the iOS Beta”; the App Store release is next.
The homepage hero and closing call to action on every content page show macOS availability as “COMING DEC. 15” above “Download for macOS” in a non-clickable secondary outline, with the creator note and résumé link underneath. Legacy page URLs redirect to the updated User Guide or FAQ.

About and Case Studies link to the site's existing engineering explanations.
Full-source review is available through Ryan's review contact. Backend remains a
separate supporting offline-tooling link. These references do not claim that the
full app or a separate implementation showcase is publicly available as source.
The résumé download and editable sources describe the open TestFlight beta.

## App demo recordings

Web playback copies and JPEG posters live in `assets/app/demos/`. Desktop originals are preserved
outside this repository. The players use native controls, keep audio, and do not autoplay or
preload the recordings. `css/demo-videos.css` provides the shared responsive layout.

- `user-question-and-insight-tree.mp4` — 1:49; Case Studies and User Guide → Starting a Conversation.
- `global-insight-tree.mp4` — 0:24; Case Studies and User Guide → Understanding the Insight Tree.
- `on-device-reader.mp4` — 0:50; Case Studies and User Guide → Starting a Conversation.
  This shows reading an answer aloud, not the bundled Library reader.

Link GitHub README demos to `https://angrove.app/case-study.html#demos` or the individual
`#demo-conversation`, `#demo-global-tree`, and `#demo-reader` anchors.

## License

Copyright © 2026 Ryan Baltodano (Sine Viridian). All rights reserved. The source is published
for reference and review; see [`LICENSE`](LICENSE). Bundled fonts keep their own licenses.
