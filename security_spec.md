# Firestore Security Rules Specification & Red-Team TDD

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every unmatched path is denied read and write access (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity Gate**: No unauthenticated or email-unverified client (`request.auth == null || request.auth.token.email_verified != true`) may read, list, create, update, or delete any document.
3. **Workspace Membership / PII Isolation**: Every collection document (`orders`, `accounts`, `shareholders`, `expenses`, `products`, `stockImports`, `budgetItems`, `auditLogs`, `system`) restricts `get` and `list` to verified workspace members (`ownerUid == request.auth.uid` or `request.auth.token.email in resource.data.memberEmails`). No blanket `allow read: if isSignedIn();`.
4. **Admin Bootstrap & RBAC Separation**: `hangan269@gmail.com` (verified) is the bootstrapped Firebase Admin (`isAdmin()`). Non-admin members cannot delete products, expenses, shareholders, or accounts, cannot create/edit accounts (except updating their own PIN field if authorized), and cannot mutate cancelled orders.
5. **Temporal & Relational Integrity**: `serverCreatedAt` and `ownerUid` are immutable after creation; `serverUpdatedAt` must equal `request.time`.
6. **Anti-Shadow-Field & Size Bounds**: Every collection enforces strict `keys().hasAll(...)` + `keys().hasOnly(...)`, path ID regex `^[a-zA-Z0-9_\-]+$`, bounded arrays (`items.size() <= 30`, `memberEmails.size() <= 20`), and bounded string lengths.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Order Read/List**: Anonymous client requests `get` or `list` on `/orders` -> DENIED.
2. **Unverified Email Spoof**: Signed-in token with `email: "hangan269@gmail.com"` and `email_verified: false` attempts write -> DENIED.
3. **Foreign Signed-In User PII Scrape**: Verified Google user `attacker@example.com` (not in `memberEmails`, not `ownerUid`) attempts `get` on `/orders/ord_01` or `/accounts/acc_ngan` -> DENIED.
4. **Blanket List Query**: Verified user runs unfiltered `list` without matching `memberEmails` / `ownerUid` -> DENIED.
5. **Identity Spoofing on Create**: User creates `/orders/ord_99` with `ownerUid: "someone_else"` -> DENIED.
6. **Shadow / Ghost Field Injection**: User creates `/orders/ord_99` including extra field `isVerifiedAdmin: true` -> DENIED (`keys().hasOnly(...)`).
7. **Path ID Poisoning**: User attempts write to `/products/..junk$id!` or 500-char ID -> DENIED (`isValidId()`).
8. **Resource Exhaustion / Denial of Wallet**: Order `shippingAddress` with 5,000 characters (`> 500`) -> DENIED.
9. **Unbounded Array Attack**: Order `items` with 35 items (`> 30`) or empty `items: []` -> DENIED.
10. **Client Timestamp Forgery**: Update payload sends client `Date` for `serverUpdatedAt` instead of `request.time` -> DENIED.
11. **Terminal State Mutation by Non-Admin**: Non-admin member attempts to mutate an already cancelled order (`existing().isCancelled == true`) -> DENIED.
12. **Privilege Escalation on Accounts**: Non-admin member attempts to change `role` to `'Admin'` on `/accounts/acc_giang` -> DENIED.
