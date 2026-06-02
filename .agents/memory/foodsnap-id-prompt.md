---
name: FoodSnap identification prompt
description: Decisions made about the /api/snap/label identification Claude call — what was removed and why.
---

The `nameOnlyBaseSystem` prompt in `server/routes.ts` must remain a pure vision task.

**Rule:** Do NOT add any food library contents, library entry lists, or references to library matching into the identification prompt. The library lookup happens *after* Claude returns a name (as a cache check), never before.

**Why:** Passing library data or naming-consistency instructions into the identification call causes Claude to anchor to library-sounding names instead of trusting what it sees. This produced wrong identifications (e.g. 豆腐花燒仙草 for 豬紅竹笙米線).

**What was removed:** The line "Same dish must return exact same wording every time — the food library matches exact strings." was deleted from the prompt. Naming consistency is the job of the normalization/fuzzy-match layer, not the vision prompt.

**Token budget:** The identification call uses 400 max_tokens in a single call with no retry. The previous pattern (200 tokens + retry at 400) was replaced because a single well-budgeted call is more stable than two escalating calls.
