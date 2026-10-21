# The remote from anywhere (optional)

Use the phone or iPad remote when it is not on the same Wi-Fi as the PC: from another building, on mobile data, or
on a guest network that keeps devices apart. It is the same remote, with the same buttons. It reaches the PC through
your FrameDecks account, and each phone is paired with the PC once and approved there.

**Who this is for:** a presenter or helper who cannot join the PC's Wi-Fi.

On the same Wi-Fi, keep using the remote as before ([Remote control](remote-control.md)). It is direct and needs
no internet.

**On this page**
- [Turn it on at the PC](#turn-it-on-at-the-pc)
- [Pair a phone or iPad](#pair-a-phone-or-ipad)
- [Trusted devices: roles and Revoke](#trusted-devices-roles-and-revoke)
- [Install it as an app](#install-it-as-an-app)
- [What is safe](#what-is-safe)
- [If it does not connect](#if-it-does-not-connect)

---

## Turn it on at the PC

1. Sign in to your FrameDecks account: **Settings → FrameDecks account** ([guide](account.md)).
2. Open **Settings → Phone & iPad Remote** and turn on **Control from anywhere**.
3. The status shows **Reachable from anywhere**. The PC keeps one secure connection open to the FrameDecks cloud; it
   opens no port and needs no router change.

Turn it off at any time: nothing then reaches the PC except over its Wi-Fi.

## Pair a phone or iPad

Once per phone. Under **Control from anywhere** at the PC, select **Pair a phone or iPad**. A QR code and a 6-digit
code appear; they work once, for 5 minutes.

1. On the phone, point the **Camera** at the QR code and open the link. (Or open the FrameDecks remote address, sign
   in, choose the PC, and type the 6-digit code.)
2. Sign in with the **same account** as the PC, if the phone is not signed in yet.
3. The phone shows six digits, for example **569 680**. The PC asks "Allow ‹iPhone› (Safari, iOS) to control this
   PC?" with digits too. **If they are the same**, choose a role and select **Approve**. If not, select **Reject**.
4. The remote opens. From now on it opens straight away, with no PIN.

Everything the paired phone and the PC send each other is sealed with a key only they have; the FrameDecks cloud only
passes it on and cannot read it.

## Trusted devices: roles and Revoke

The PC lists every paired phone and tablet with its role and when it was last used.

| Role | Can |
| --- | --- |
| Viewer | See what is live and the Teleprompter; changes nothing |
| Operator (the usual) | Everything the Wi-Fi remote can do |
| Presenter, Administrator | As Operator, for now |

Change a role at any time. **Revoke** cuts a phone off at once (within a second); to use it again, pair it again. Lost
a phone? Revoke it at the PC.

## Install it as an app

- **iPhone, iPad:** Share → **Add to Home Screen**.
- **Android:** the **Install FrameDecks on this device** link on the sign-in card, or the browser's Install.

The installed remote opens like an app, full screen, and opens even with no signal (it then says it is not connected
until the signal is back).

## What is safe

- Only phones approved at the PC can connect, and only with the role you gave them.
- What they send is sealed end to end; the cloud cannot read it, and a copied or replayed message is refused.
- Only the remote can be reached this way. The members list, birthdays, email list, the Studio and your account
  settings never can.
- Presenting never depends on it: if the internet drops, the PC carries on and the Wi-Fi remote keeps working.

## If it does not connect

| You see | Do this |
| --- | --- |
| The PC is "not reachable" in the list | At the PC: is FrameDecks running, signed in, with **Control from anywhere** on and **Reachable from anywhere** showing? |
| "No PC in your account yet" | Sign in on the phone with the same email as on the PC. |
| "Not connected to the PC" in the remote | The phone or the PC lost the internet. It reconnects by itself. |
| "This phone was removed from ‹PC›" | It was revoked at the PC. Pair it again. |
| The digits on the phone and the PC differ | Select **Reject** at the PC and pair again: something is in the way. |
