# Feature idea (LATER): QC photos delivered to the friend's cart

**Status:** not built — parked idea, needs a proper design pass before implementing.

## The vision
When a garment's quality-check photos arrive at the Superbuy warehouse, the friend gets a link/email:
> "Your QC for **Product #1** has arrived — view the photos in your cart."
They open their haul/cart on haulhq.shop and see the QC gallery attached to that line item (badge like "QC ready").

## Why the per-item number matters
Each friend's cart line gets a **stable product number** (`#1`, `#2`, …) that never changes. That's the human-facing handle used in the email copy and the cart UI. It's already recorded per item in each `research/orders/<name>.md` ordering table.

## Rough data shape (to flesh out at design time)
- QC photos attach to the friend's `items` row (Supabase). Options: a `qc_photos text[]` column on `items`, or a `qc_photos` table keyed by `item_id` (order, uploaded_at). A `qc_status` (`none | ready | seen`) drives the cart badge.
- **Storage:** Supabase storage bucket (e.g. `qc/<haul>/<item-id>/`) so the cart can render them directly. The `research/orders/<name>/qc/<#>-<slug>/` repo folders are the interim staging area / source of truth until this is built.
- Admin flow: upload QC photos to an item → status flips to `ready` → triggers the email (Resend, already planned for invites).
- Cart UI: per-item QC thumbnail strip + lightbox; "QC ready" badge.

## Open questions for the design pass
- Notify per-item as each arrives, or batch once the whole order is checked in?
- Same email pipeline as invites (Resend)?
- Does the friend need to approve/reject QC before it ships (a "proceed / re-check" loop), or is it view-only?

## Interim (now)
Collect warehouse QC photos into `research/orders/<name>/qc/<#>-<slug>/` and tick the `QC` box + note arrival in the timeline. Nothing friend-facing yet.
