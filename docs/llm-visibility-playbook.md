# Getting named in AI answers: the off-site playbook

*Written 29 October 2026, for the owner. The site's own side is done (HANDOFF §19b–19e); this is
the part only a person can do.*

## How an assistant decides to name you

An assistant names a site for one of two reasons.

1. **It searches the web while answering, and your page comes up.**
   - Copilot answers from Bing's index, and ChatGPT search leans on it.
   - Gemini and Google's AI Overviews use Google's.
   - Perplexity runs its own crawler (PerplexityBot).
   - Claude's web search has been reported to use Brave Search.

   Which engine sits behind which assistant changes; check before relying on any one of them.

   Ranking in these indexes for the question is the whole game here.
2. **It learned your name in training**, because many independent pages mentioned it in the same
   breath as the topic. Your own site cannot do this alone. Mentions elsewhere do.

The first pays off within weeks; the second takes months and compounds. Everything below serves one
or both.

## This week (about two hours, once)

1. **Google Search Console.**
   - Confirm the property for `https://www.thefinanceintelligence.com`.
   - Submit `/sitemap.xml`.
   - Use **URL inspection → Request indexing** for the home page, `/calculators`, each calculator and
     each guide.
2. **Bing Webmaster Tools** (this is the one that feeds ChatGPT search and Copilot).
   - Sign in at bing.com/webmasters and choose **Import from Google Search Console**.
   - Then open **IndexNow** and check that our submissions are arriving. The site sends them after
     every deploy (`.github/workflows/indexnow.yml`).
3. **Vercel: let the AI crawlers in.**
   - In the project's Firewall settings, check that no "AI bots" or bot-protection rule blocks
     GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot or Google-Extended. On 29 Oct every one of them
     got a 200, but a dashboard toggle can change that without a deploy.
4. **Profiles with the same name and the same sentence.**
   - Create or tidy the LinkedIn company page and, if you want them, an X account and a YouTube
     channel.
   - In each "about" field, use the site's sentence word for word: *The Finance Intelligence is a
     set of web tools, free calculators and guides for finance work in India, built by chartered
     accountants.*
   - Then add each profile URL to `PROFILES` in `src/lib/marketing/content.ts`. It becomes `sameAs`
     in the Organization data, which is how search engines join the profiles to the site.
5. **Google Business Profile, only if there is a real address** that can receive the verification
   postcard. Never use a virtual office.

## Every month (two or three hours)

1. **Ask the assistants and write down what they say.**
   - Use the same ten questions in ChatGPT, Gemini, Perplexity, Copilot and Claude.
   - Start with these:
     - "rental yield calculator India"
     - "how is GST charged on an under-construction flat"
     - "pre-EMI vs full EMI"
     - "what is loading in a flat"
     - "EV/EBITDA calculator"
     - "tool to reconcile supplier statement"
     - "how to check income tax notices on the portal"
     - "payment voucher format India"
     - "AI tools for finance teams in India"
     - "true cost of an under-construction flat"
   - Note whether the site is named or linked, and which sites are named instead. Those sites are
     where to be mentioned next.
   - The Admin screen's **Sources** already counts visits from ChatGPT, Perplexity, Gemini, Copilot
     and Claude, so you can see whether the answers send anybody.
2. **Answer real questions where people ask them, with your name on it.**
   - Places: r/personalfinanceindia, r/IndiaInvestments, r/indianrealestate, r/CharteredAccountants,
     Quora, CAclubindia's forum and LinkedIn.
   - Reddit and Quora are among the sources AI answers cite most often.
   - Answer the question in full in the reply itself, and link to the guide or calculator only where
     it does the working. Say that it is your site.
   - One honest, useful answer a week beats twenty links.
3. **One talk or article.** Good outlets:
   - an ICAI branch or study-circle session ("Reconciling supplier statements in an afternoon",
     "What an under-construction flat really costs");
   - a guest column in a finance publication;
   - a podcast for CAs.

   The listing for each one should name the site.
4. **Directories that answer "is there a tool for…".**
   - List the tools once in the AI-tool directories (There's An AI For That, Futurepedia, Product
     Hunt for a launch day).
   - Also list them in Indian startup directories.
   - Use the same name and sentence everywhere.

## Every fortnight: one new page that answers a real question

The guides and calculators are what search engines rank and assistants quote. Each new one should
answer a question people already type, and come with a worked example a test can check.

Candidates, most-searched first:

- Home loan prepayment vs investing the money (calculator and guide).
- TDS on buying property: 1% under the Income-tax Act's provision for immovable property
  (guide). Check the 2025 Act's section number before publishing.
- Stamp duty and registration by state (table guide). States change these, so date every figure.
- Capital gains on selling a flat (guide). The rates and indexation changed in 2024; this needs a
  CA's check against the current Act before it goes up.
- HRA exemption (calculator).
- Bank reconciliation in Excel, step by step (guide, leading to Ledger Reconciliation).
- How to read a Form 26AS / AIS mismatch (guide, leading to Tax Notice Watch).
- Nominee vs legal heir (guide). Legal content: only with an advocate's review, like Will Maker.

Tax and legal pages must be checked against the law as it stands, and must say when they were last
checked. The guides already do this ("How this guide is checked").

## Never

- **No bought links or link exchanges, and no posting the same answer in many places.** Search
  engines penalise these, and moderators ban them.
- **No fake reviews, testimonials, user counts or bylines.** That rule already holds on the site,
  and it holds off it too.
- **No pages written only to rank**, or showing crawlers different content from people. The
  Markdown copies are the same words as the pages, which is allowed. Anything else is cloaking.
- **No blocking of the AI search crawlers.** If you ever want to stop model training, block only
  `GPTBot`, `Google-Extended`, `CCBot` and `Applebot-Extended`. That stops training and leaves AI
  search (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`) alone. `src/app/robots.ts` says
  how.
