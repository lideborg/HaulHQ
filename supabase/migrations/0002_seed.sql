-- Seed: sellers (for the no-match fallback) + a few published demo products.

insert into sellers (name, brands, yupoo_url, superbuy_store, notes) values
 ('HappyWhale', array['Prada','Eyewear','Bags'], 'https://happywhale.x.yupoo.com', null, 'glasses / apparel / bags'),
 ('cn--made (CNMADE)', array['Balenciaga','Prada','Gucci','Dior','Rick Owens','Acne','Jil Sander','Off-White'], 'https://cn--made.x.yupoo.com/albums', null, 'huge multi-brand aggregator'),
 ('Logan', array['Corteiz','Gallery Dept','MM6 Margiela','Our Legacy','Miu Miu','Balenciaga','Acne'], 'https://loganhere.x.yupoo.com/albums', null, 'big streetwear multi-brand'),
 ('718 Manufacturing', array['Gucci','Balenciaga','Loewe'], 'https://718made.x.yupoo.com/albums', null, null),
 ('MVT', array['Balenciaga'], 'https://mvt-shop01.x.yupoo.com/albums', null, 'BLCG bags'),
 ('Swag Made', array['Raf Simons','Undercover','CDG','Number (N)ine'], 'https://swaggymade.x.yupoo.com/albums', 'Taobao shopid 349170071', 'archive / avant-garde'),
 ('Crypto made', array['Enfants Riches Déprimés'], null, 'Taobao shopid 590930507', 'ERD specialist'),
 ('Frank Chang', array['The Row'], null, 'Taobao shopid 1781922864', 'quiet luxury'),
 ('CharlesKing', array['Jil Sander','Loewe'], 'https://charlesking77.x.yupoo.com', null, null);

insert into products (brand, title, description, category, seller, source_link, image_urls, cost_cny, markup, price_usd, size_options, published) values
 ('Enfants Riches Déprimés','Carved Embossed Monk-Strap Loafers','Black cowhide brogue loafers, red ERD insole','footwear','Crypto made','https://item.taobao.com/item.htm?id=1055579213910', array['https://img.alicdn.com/bao/uploaded/i3/2215800851954/O1CN018cBol71QIz3YVC7qm_!!2215800851954.jpg'], 869, 0.20, 164.74, array['41','42'], true),
 ('Enfants Riches Déprimés','Carved Copper-Buckle Engineer Boots','Black leather engineer boots, rose-engraved buckles, wooden heel','footwear','Crypto made','https://item.taobao.com/item.htm?id=970132662225', array['https://img.alicdn.com/bao/uploaded/i4/2215800851954/O1CN01CDDdX71QIyzzrDmWs_!!2215800851954.jpg'], 1299, 0.20, 249.12, array['41','42'], true),
 ('Enfants Riches Déprimés','Distressed Cropped Cardigan','Black cashmere-cotton knit, silver buttons, cropped','apparel-top','Crypto made','https://item.taobao.com/item.htm?id=965649084862', array['https://img.alicdn.com/bao/uploaded/i3/2215800851954/O1CN01ljeM0u1QIyzlm3xzq_!!2215800851954.jpg'], 399, 0.20, 76.52, array['L','XL'], true);
