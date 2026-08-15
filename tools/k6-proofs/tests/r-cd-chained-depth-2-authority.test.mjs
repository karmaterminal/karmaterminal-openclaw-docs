import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  rCdChainHopIdentities,
  rCdChainJournalReturnAuthority,
  rCdChainNestedDelegateSpec,
  rCdChainPromptTemplate,
  rCdChainRootReturnCandidate,
  rCdChainRootReturnReceipt,
  resolveUniqueSpawnedByChild,
} from '../lib/r-cd-chained-depth-2-authority.mjs';

const nonce = 'R-CD-CHAIN-EXACT-NONCE';
const root = 'agent:main:r-cd-chain-root';
const child = 'agent:main:subagent:child';
const grandchild = 'agent:main:subagent:grandchild';
const signingKey = 'r-cd-chained-depth-2-unit-gateway-token';

function systemEvent(text, sessionKey = root) {
  return { sessionKey, message: { role: 'system', content: [{ type: 'text', text }] } };
}

test('depth-2 nested call explicitly requests fanoutMode=tree', () => {
  const nested = rCdChainNestedDelegateSpec({ nonce });
  assert.equal(nested.fanoutMode, 'tree');
  assert.equal(nested.mode, 'silent-wake');
  const template = rCdChainPromptTemplate();
  assert.match(template, /fanoutMode='tree'/);
  assert.match(template, /GRANDCHILD-DONE \{\{nonce\}\}/);
  assert.match(template, /CHILD-DONE \{\{nonce\}\} CHILD-DELEGATE-SCHEDULED/);
});

test('manifest nested prompt includes fanoutMode=tree and no fictional three-subtest list', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifests/r-cd-chained-depth-2.json', import.meta.url), 'utf8'));
  assert.match(manifest.invocation.promptTemplate, /fanoutMode='tree'/);
  assert.equal(manifest.scenario.subtests, undefined);
  assert.doesNotMatch(manifest.scenario.description, /Three sub-tests/i);
});

test('depth-2 scenario requires a disposable ancestry root', async () => {
  const scenario = await readFile(
    new URL('../scenarios/r-cd-chained-depth-2.js', import.meta.url),
    'utf8',
  );
  assert.match(
    scenario,
    /OPENCLAW_CREATE_DISPOSABLE_SESSION=true is required for R-CD-CHAINED-DEPTH-2/,
  );
  assert.match(scenario, /sessions\.list',\s*\{\s*spawnedBy:\s*parentSessionKey/);
  assert.doesNotMatch(scenario, /observeChainSession\(task\.childSessionKey\)/);
  assert.match(scenario, /child_ancestry_confirmations\s*>=\s*2/);
  assert.match(scenario, /grandchild_ancestry_confirmations\s*>=\s*2/);
  assert.match(scenario, /grandchild_ancestry_confirmed_at_ms\s*-\s*evidence\.dispatch_accepted_at_ms/);
  assert.match(scenario, /evidence\.ancestry_stable === true/);
  assert.match(scenario, /Math\.max\(30000,\s*configuredAncestryStabilityMs\)/);
  assert.doesNotMatch(
    scenario,
    /ancestryRequest\.depth === 1 && evidence\.child_session &&\s*!evidence\.grandchild_session/,
  );
});

test('depth-2 requires two distinct hop identities', () => {
  assert.equal(rCdChainHopIdentities({ childSessionKey: child, grandchildSessionKey: null }).ok, false);
  assert.equal(rCdChainHopIdentities({ childSessionKey: child, grandchildSessionKey: child }).ok, false);
  assert.equal(rCdChainHopIdentities({ childSessionKey: child, grandchildSessionKey: grandchild }).ok, true);
});

test('depth-2 resolves direct hops from spawnedBy ancestry despite truncated titles', () => {
  const childPayload = {
    sessions: [{
      key: child,
      spawnedBy: root,
      title: 'Proof chain nonce R-CD-CHAIN-EXACT-NONCE-TRUNCATED-BEFORE-THE-REST',
    }],
  };
  const childResult = resolveUniqueSpawnedByChild({
    sessionsPayload: childPayload,
    parentSessionKey: root,
  });
  assert.equal(childResult.uniqueChildKey, child);

  const grandchildPayload = {
    sessions: [{
      key: grandchild,
      spawnedBy: child,
      title: 'Grandchild nonce R-CD-CHAIN-EXACT-NONCE-TRUNCATED-BEFORE-THE-REST',
    }],
  };
  const grandchildResult = resolveUniqueSpawnedByChild({
    sessionsPayload: grandchildPayload,
    parentSessionKey: child,
  });
  assert.equal(grandchildResult.uniqueChildKey, grandchild);
  assert.equal(
    rCdChainHopIdentities({
      childSessionKey: childResult.uniqueChildKey,
      grandchildSessionKey: grandchildResult.uniqueChildKey,
    }).ok,
    true,
  );
});

test('depth-2 ancestry fails closed on ambiguous direct children', () => {
  const resolved = resolveUniqueSpawnedByChild({
    sessionsPayload: {
      sessions: [
        { key: child, spawnedBy: root },
        { key: 'agent:main:subagent:other', parentSessionKey: root },
      ],
    },
    parentSessionKey: root,
  });
  assert.equal(resolved.uniqueChildKey, null);
  assert.equal(resolved.ambiguous, true);
  assert.equal(resolved.failureCategory, 'multiple-direct-children');
});

test('depth-2 transcript root marker is never routing authority', () => {
  const candidate = rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: systemEvent(`GRANDCHILD-DONE ${nonce}`),
    rootSessionKey: root,
    nonce,
  });
  assert.equal(candidate.authoritative, false);
  assert.equal(rCdChainRootReturnReceipt(candidate, {
    childSessionKey: child,
    grandchildSessionKey: grandchild,
  }), null);
});

test('depth-2 shared journal collector binds grandchild→root under fanoutMode=tree', () => {
  const ts = '2026-08-09T17:15:19.000-07:00';
  const start = Date.parse('2026-08-09T17:14:00.000-07:00');
  const end = Date.parse('2026-08-09T17:16:00.000-07:00');
  const journal = `${ts} node: [continuation:targeted-return] Delivered to ${root} from ${grandchild}\n`;
  const receipt = rCdChainJournalReturnAuthority({
    journalText: journal,
    rootSessionKey: root,
    childSessionKey: child,
    grandchildSessionKey: grandchild,
    windowStartMs: start,
    windowEndMs: end,
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(receipt.targetMatchCount, 1);
  assert.equal(receipt.parentMatchCount, 0);
  assert.equal(receipt.structuralOk, true);
  assert.equal(receipt.integrity?.algorithm, 'hmac-sha256-gateway-token-v1');
});

test('depth-2 journal authority fails when hops are missing', () => {
  const receipt = rCdChainJournalReturnAuthority({
    journalText: '',
    rootSessionKey: root,
    childSessionKey: child,
    grandchildSessionKey: null,
    signingKey,
  });
  assert.equal(receipt.failureCategory, 'missing-hop');
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
  assert.equal(receipt.structuralOk, false);
  assert.equal(receipt.integrity?.algorithm, 'hmac-sha256-gateway-token-v1');
});

test('depth-2 tree multi-target delivery to root+intermediate PASSes', () => {
  const ts = '2026-08-09T17:15:19.000-07:00';
  const start = Date.parse('2026-08-09T17:14:00.000-07:00');
  const end = Date.parse('2026-08-09T17:16:00.000-07:00');
  const journal =
    `${ts} node: [continuation:targeted-return] Delivered to ${child},${root} from ${grandchild}\n`;
  const receipt = rCdChainJournalReturnAuthority({
    journalText: journal,
    rootSessionKey: root,
    childSessionKey: child,
    grandchildSessionKey: grandchild,
    windowStartMs: start,
    windowEndMs: end,
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(receipt.targetMatchCount, 1);
});

test('depth-2 separate intermediate+root lines still PASS under tree fanout', () => {
  const start = Date.parse('2026-08-09T17:14:00.000-07:00');
  const end = Date.parse('2026-08-09T17:16:00.000-07:00');
  const journal = [
    '2026-08-09T17:15:18.000-07:00 node: [continuation:targeted-return] Delivered to ' + child + ' from ' + grandchild,
    '2026-08-09T17:15:19.000-07:00 node: [continuation:targeted-return] Delivered to ' + root + ' from ' + grandchild,
  ].join('\n');
  const receipt = rCdChainJournalReturnAuthority({
    journalText: journal,
    rootSessionKey: root,
    childSessionKey: child,
    grandchildSessionKey: grandchild,
    windowStartMs: start,
    windowEndMs: end,
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
});
