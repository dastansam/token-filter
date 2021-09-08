import axios from "axios";
import BigNumber from "bignumber.js";
import { _getTokenInfo, _getLatestBlock, secondsToBlocks} from './service';

const covalentApi = "https://api.covalenthq.com/v1";
const covalentKey = "ckey_33f53f3d98d1430b9f10dfe4158:";

export async function getHoldersDifference(
    address,
    days,
    minUsdBalance,
    minTransaction
  ) {
    const tokenInfo = await _getTokenInfo(address);
    const covalentUrl = `${covalentApi}/56/tokens/${address}/token_holders_changes/`;
    const { latestBlock } = await _getLatestBlock();
    const from = secondsToBlocks(days);
    let holders = [];
    let curPage = 0;
  
    console.log(`days: ${days} from: ${latestBlock - from} to: ${latestBlock}`);
  
    let response = await axios.get(covalentUrl, {
      params: {
        "starting-block": latestBlock - from,
        "page-size": 10000
        // match: "diff > 1000000"
      },
      auth: { username: covalentKey }
    });
    if (response.data.error) {
      return { error: response.data.error_message };
    }
    let decimals = new BigNumber(10).pow(tokenInfo.decimals);
  
    const minQuantity = new BigNumber(minUsdBalance)
      .dividedBy(tokenInfo.price)
      .multipliedBy(decimals);
  
    const minTxQuantity = new BigNumber(minTransaction)
      .dividedBy(tokenInfo.price)
      .multipliedBy(decimals);
  
    holders = holders.concat(
      response.data.data.items.flatMap((holder) =>
        filterHolder(holder, tokenInfo, minQuantity, minTxQuantity)
      )
    );
  
    console.log(response.data.data);
  
    while (response.pagination && response.data.data.items.length > 0) {
      curPage += 1;
      response = await axios.get(covalentUrl, {
        params: {
          "starting-block": latestBlock - from,
          "page-size": 10000,
          "page-number": curPage
          // match: "diff > 1000000"
        },
        auth: { username: covalentKey }
      });
      console.log(response.data.data);
  
      holders = holders.concat(
        response.data.data.items.flatMap((holder) =>
          filterHolder(holder, tokenInfo, minQuantity, minTxQuantity)
        )
      );
    }
  
    console.log(holders.length);
  
    return holders;
}

function filterHolder(holderObject, tokenInfo, minQuantity, minTxQuantity) {
if (
    new BigNumber(holderObject["next_balance"]).lte(minTxQuantity)
) {
    return [];
}
let decimals = new BigNumber(10).pow(tokenInfo.decimals);

if (
    minQuantity.lt(holderObject["next_balance"]) &&
    minTxQuantity.lt(holderObject["diff"])
) {
    let balance = new BigNumber(holderObject["next_balance"]).dividedBy(
    decimals
    );
    let oldBalance = new BigNumber(holderObject["prev_balance"]).dividedBy(
    decimals
    );
    return [
    {
        holderAddress: holderObject["token_holder"],
        tokenQuantity: holderObject["next_balance"],
        balanceInUsd: balance.multipliedBy(tokenInfo.price).toFixed(6),
        oldBalanceInUsd: oldBalance.multipliedBy(tokenInfo.price).toFixed(6),
        priceUsd: tokenInfo.price
    }
    ];
}
return [];
}