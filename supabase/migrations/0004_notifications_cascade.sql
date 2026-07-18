-- 0004: notifications.item_id must not block item deletion (final review finding)
alter table notifications
  drop constraint if exists notifications_item_id_fkey,
  add constraint notifications_item_id_fkey
    foreign key (item_id) references items(id) on delete cascade;
