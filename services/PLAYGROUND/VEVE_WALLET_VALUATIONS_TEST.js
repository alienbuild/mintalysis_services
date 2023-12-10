const VEVE_WALLET_VALUATIONS_TEST = async () => {

    let result = await prisma.$queryRaw(`
      INSERT INTO new_table (wallet_id, collectible_id, unique_cover_id, count)
      SELECT wallet_id, collectible_id, unique_cover_id, COUNT(*)
      FROM veve_tokens
      WHERE wallet_id IS NOT NULL
    `);

    console.log('result is: ', result)

}