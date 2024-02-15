-- select total_burned from veve_comics where total_burned is not null and total_burned > 0
-- 88153 total sum for 123 burns of 1472 comics

-- select sum(total_burned) from veve_collectibles where total_burned is not null and total_burned > 0
-- 78462 total sum for 109 collectibles

-- select token_id, transfer_count from veve_mints where transfer_count is not null and transfer_count > 0
-- 91

-- select count(is_burned) from veve_transfers where is_burned is not null and is_burned = 1
-- 43930


-- select count(transfer_count) from veve_mints where transfer_count is null




-- update veve_mints set transfer_count = (select count(*) from veve_transfers where veve_transfers.token_id = veve_mints.token_id)


-- MINT DATE ERRORS 
SELECT
m.token_id
,date(timestamp) as mints_timestamp
,t.token_id
,name
,date(mint_date) as tokens_mint_date
from veve_mints m
left join veve_tokens t on t.token_id = m.token_id
where date(m.timestamp) between '2021-12-16' and '2024-05-31'
and date(t.mint_date) between '2021-12-16' and '2024-05-31'
and date(m.timestamp) != date(t.mint_date)
-- 87
-- mint date on 8998606 doesnt match veve mints