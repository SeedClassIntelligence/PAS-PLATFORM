#!/usr/bin/env bash
# claim-verification-gate.sh
#
# A Claude Code Stop hook implementing the Claim Verification Gate as
# actual enforcement, not doctrine text asking for voluntary compliance.
#
# WHAT THIS DOES: scans the transcript of the turn that's about to end for
# completion-claim language ("done", "complete", "should work", "fixed",
# "ready"). If a completion claim appears with no evidence of an actual
# verification action (a test run, a build, a curl, an execution) in the
# same turn, this hook blocks the stop and forces the agent to either
# produce real verification or downgrade the claim to "should work,
# unverified" before the turn is allowed to end.
#
# HONEST LIMITS, stated up front because overselling this would repeat
# the exact failure it's built to prevent: this is pattern matching on
# text, not a semantic understanding of whether verification actually
# happened or was sufficient. It will have false positives (flagging a
# legitimate claim that didn't need this exact evidence pattern) and
# false negatives (missing a real unverified claim phrased unusually).
# It is a real backstop, not a perfect one. Tune the patterns below for
# your actual project's language and verification commands.
#
# INSTALL: place at .claude/hooks/claim-verification-gate.sh, chmod +x it,
# and register it in .claude/settings.json:
#
# {
#   "hooks": {
#     "Stop": [
#       { "hooks": [ { "type": "command",
#           "command": "\"$CLAUDE_PROJECT_DIR/.claude/hooks/claim-verification-gate.sh\"" } ] }
#     ]
#   }
# }

set -euo pipefail

# Claude Code passes hook input as JSON on stdin. We need transcript_path.
INPUT_JSON="$(cat)"
# `|| true` is load-bearing. Without it, `set -euo pipefail` plus a grep that
# matches nothing kills the script with exit 1 on any stdin this pattern does
# not fit — malformed JSON, or a future change to the hook input format. That
# contradicts the intent stated directly below: never block on infrastructure
# we cannot reach. Found by pipe-testing the five cases before install; the
# original exited 1 on malformed stdin.
TRANSCRIPT_PATH="$(echo "$INPUT_JSON" | grep -o '"transcript_path"[^,}]*' | sed 's/.*: *"//;s/"$//' || true)"

if [[ -z "$TRANSCRIPT_PATH" || ! -f "$TRANSCRIPT_PATH" ]]; then
  # No transcript to check — don't block on infrastructure we can't reach.
  exit 0
fi

# Only look at the most recent chunk of the transcript (the current turn),
# not the whole session — otherwise an old verified claim from ten turns
# ago would satisfy the check for a brand-new unverified one.
RECENT_TRANSCRIPT="$(tail -n 200 "$TRANSCRIPT_PATH")"

# Completion-claim language this gate watches for. Extend this list to
# match how your own agent actually phrases completion in practice —
# a heuristic gate is only as good as the patterns it's given.
CLAIM_PATTERN='(is done|is complete|is ready|is fixed|is resolved|should work now|this works|task complete|successfully (implemented|fixed|completed))'

# Evidence a real verification action happened in this same recent window.
# These are intentionally broad tool/command signatures, not exact matches —
# tune to your stack (pytest, npm test, cargo test, curl, a build command,
# an explicit "tool_result" block showing a command's real output).
EVIDENCE_PATTERN='(tool_result|exit code 0|[0-9]+ passed|npm test|pytest|cargo test|go test|curl -|build succeeded|BUILD SUCCESS)'

if echo "$RECENT_TRANSCRIPT" | grep -qiE "$CLAIM_PATTERN"; then
  if ! echo "$RECENT_TRANSCRIPT" | grep -qiE "$EVIDENCE_PATTERN"; then
    # Exit 2 = blocking error. Claude Code feeds this stderr text back to
    # the agent as an error it must respond to before the turn can end.
    echo "CLAIM VERIFICATION GATE: a completion claim was made in this turn \
(matched: completion-style language) with no detected verification evidence \
(no test run, build, execution, or tool result found in the recent \
transcript). Before ending this turn: either (1) actually run the \
verification this claim requires and show the real result, or (2) restate \
the claim honestly as 'should work, not yet verified' rather than 'done'. \
This is not optional — see the Claim Verification Gate in the CAS doctrine \
this session is operating under." >&2
    exit 2
  fi
fi

exit 0
