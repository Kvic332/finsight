import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSMS } from '../services/smsParser.js';
import { csvToRows, parseRows } from '../services/statementParser.js';

test('structured bank SMS is read correctly', () => {
  const [tx] = parseSMS('Acct:123**45 DR:N5,000.00 Desc:POS Shoprite DT:15/MAY/26 Fidelity');
  assert.equal(tx.amount, 5000);
  assert.equal(tx.type, 'debit');
  assert.equal(tx.bank, 'Fidelity Bank');
  assert.equal(tx.source, 'sms');
});

test('natural language alerts detect money in and out', () => {
  const out = parseSMS('Your GTBank account was debited N12,400 at Shoprite Ikeja.\n\nYour Zenith Bank account was credited N450,000 salary.');
  assert.equal(out.length, 2);
  assert.equal(out[0].amount, 12400);
  assert.equal(out[0].type, 'debit');
  assert.equal(out[1].amount, 450000);
  assert.equal(out[1].type, 'credit');
});

test('non-bank messages are ignored', () => {
  assert.deepEqual(parseSMS('Jumia: your order of N5,000 ships tomorrow!'), []);
  assert.deepEqual(parseSMS(''), []);
});

test('a statement with separate debit and credit columns is read', () => {
  const rows = csvToRows('Date,Narration,Debit,Credit\n03/11/2026,"Shoprite, Ikeja","12,400",\n25/10/2026,Salary,,"450,000"');
  const out = parseRows(rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].desc, 'Shoprite, Ikeja');
  assert.equal(out[0].amount, 12400);
  assert.equal(out[0].type, 'debit');
  assert.equal(out[0].date, '03/11/2026');
  assert.equal(out[1].type, 'credit');
  assert.equal(out[1].cat, 'Income');
});

test('metadata above the header row is skipped', () => {
  const rows = csvToRows('Account statement\nName: A Person\nDate,Description,Amount,Type\n01/11/2026,Bolt ride,3200,DR');
  const out = parseRows(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].amount, 3200);
  assert.equal(out[0].type, 'debit');
});

test('a file with no transactions returns nothing', () => {
  assert.deepEqual(parseRows([]), []);
  assert.deepEqual(parseRows(csvToRows('Hello\nWorld')), []);
});
