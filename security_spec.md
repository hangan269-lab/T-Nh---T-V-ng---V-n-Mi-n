# Firestore Security Rules Specification & Red-Team TDD

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every unmatched path is denied read and write access (`match /{document=**} { allow read, write: if false; }`).
2. **Anonymous Auth Gate (`request.auth != null`)**: Every `get`, `list`, `create`, `update`, and `delete` operation across all 11 collections (`system`, `products`, `stockImports`, `orders`, `shareholders`, `expenses`, `budgetItems`, `accounts`, `auditLogs`, `backups`, `chinaPartners`) requires `isSignedIn()` (`request.auth != null`), satisfied automatically by silent `signInAnonymously(auth)` on app startup. (`email_verified` is intentionally NOT required so Anonymous Auth sessions work seamlessly.)
3. **Workspace Isolation**: Every collection document enforces `workspaceId == 'nhavuongmien_studio'` on creates, updates, and `list` queries (`isStudioWorkspace(existing())`), and allows legacy studio migration reads/updates via `isLegacyOrStudioWorkspace(existing())`.
4. **Temporal Integrity**: `serverCreatedAt` is immutable after creation (`incoming().serverCreatedAt == existing().serverCreatedAt`); `serverCreatedAt` (create) and `serverUpdatedAt` (create/update) must strictly equal `request.time`.
5. **Anti-Shadow-Field & Size Bounds**: Every collection enforces strict `keys().hasAll(...)` + `keys().hasOnly(...)`, path ID regex `^[a-zA-Z0-9_\-]+$`, bounded arrays (`items.size() <= 30`, backup lists bounded), and bounded string lengths.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Order Read/List**: Client with `request.auth == null` requests `get` or `list` on `/orders` -> DENIED.
2. **Unauthenticated Write**: Client with `request.auth == null` attempts `create` or `update` on `/products` or `/expenses` -> DENIED.
3. **Foreign Workspace Read/List**: Signed-in client queries or reads document with `workspaceId != 'nhavuongmien_studio'` -> DENIED.
4. **Unmatched Collection Access**: Signed-in client attempts read/write on `/test/connection` or any undeclared collection -> DENIED by global catch-all.
5. **Foreign Workspace Write**: Signed-in client creates `/orders/ord_99` with `workspaceId: "other_studio"` -> DENIED.
6. **Shadow / Ghost Field Injection**: Signed-in client creates `/orders/ord_99` including extra field `isVerifiedAdmin: true` -> DENIED (`keys().hasOnly(...)`).
7. **Path ID Poisoning**: Signed-in client attempts write to `/products/..junk$id!` or 500-char ID -> DENIED (`isValidId()`).
8. **Resource Exhaustion / Denial of Wallet**: Order `shippingAddress` with 5,000 characters (`> 500`) -> DENIED.
9. **Unbounded Array Attack**: Order `items` with 35 items (`> 30`) or empty `items: []` -> DENIED.
10. **Client Timestamp Forgery**: Update payload sends client `Date` for `serverUpdatedAt` instead of `request.time` -> DENIED.
11. **Immutable Timestamp Mutation**: Update payload modifies `serverCreatedAt` -> DENIED.
12. **Negative Discount / Invalid Enum Injection**: Order `discount: -50000` or invalid `brand` enum -> DENIED.
