

## Add Wallet Balance Check via WhatsApp

**What**: Allow agents to check their wallet balance by sending keyword **4** (or "balance") via WhatsApp.

**How it works**:
- Agent sends `4` or `balance` to the Twilio WhatsApp number
- The edge function looks up the agent, queries `agent_wallet_transactions` for their total balance, and replies with the amount

**Changes needed**:

### 1. Update `supabase/functions/whatsapp-worklog/index.ts`
- Update `HELP_TEXT` to include the new command: `4️⃣ Check your wallet balance`
- Add a new command handler before the unrecognized command block:
  - Match command `4` or `balance`
  - Query `agent_wallet_transactions` where `agent_id = agent.id`
  - Sum up all `amount` values to get the balance
  - Reply with a formatted TwiML message showing the balance (e.g. `💰 Wallet Balance: ₹1,250.00`)
- Update the unrecognized command fallback to list the new command

### 2. No database or frontend changes needed
- The `agent_wallet_transactions` table already exists with public SELECT access
- The edge function already uses the service role key, so it can query freely

**Example WhatsApp interaction**:
```
Agent sends: 4
Bot replies:
💰 *Wallet Balance*
👤 Rahul Kumar
💳 Available Balance: ₹1,250.00
```

