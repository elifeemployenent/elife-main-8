

## Fix: Escape XML special characters in WhatsApp bot responses

**Root cause**: The `twiml()` function wraps the message in `<Response><Message>...</Message></Response>` XML. Commands 2 and 3 include literal `<` and `>` characters in their text (e.g. `<your work details>`, `<details>`), which Twilio interprets as malformed XML tags and silently drops the response.

Commands 1 and 4 work because their reply text never contains angle brackets.

**Fix**: Add XML escaping to the `twiml()` helper function so all special characters (`&`, `<`, `>`, `"`, `'`) are properly escaped before being embedded in the TwiML XML.

### Changes in `supabase/functions/whatsapp-worklog/index.ts`

1. Add an `escapeXml()` helper function that replaces `&`, `<`, `>`, `"`, `'` with their XML entities
2. Update the `twiml()` function to call `escapeXml(msg)` before embedding in the XML response
3. Update the catch block's hardcoded TwiML to also use proper escaping

This is a one-file fix. No database or frontend changes needed.

