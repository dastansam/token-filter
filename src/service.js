import axios from "axios";
import BigNumber from "bignumber.js";

const apikey = "A1QGI6IXRG475CCBFA94ICN1SGBYHDNHII";
const apiUrl = "https://api.bscscan.com/api";
const pancakeSwapApi = "https://api.pancakeswap.info/api/v2";

let DECIMALS = 0;

/**
 *
 * @param {*} address
 * @param {*} from
 */
async function getAllHolders(address, minUsdBalance) {
  const tokenInfo = await _getTokenInfo(address);
  let holders = [];
  let curHolders = 0;
  let curPage = 1;

  let response = await axios.get(apiUrl, {
    params: {
      module: "token",
      action: "tokenholderlist",
      contractaddress: address,
      page: curPage,
      offset: 10000,
      apikey
    }
  });

  if (response.data.status === "0") {
    return { error: response.data.result };
  }

  holders = holders.concat(
    response.data.result.flatMap((holder) =>
      validateHolder(holder, minUsdBalance, tokenInfo)
    )
  );
  curHolders = response.data.result.length;

  while (!response.status !== "0" && curHolders !== 0) {
    curPage += 1;
    const response = await axios.get(apiUrl, {
      params: {
        module: "token",
        action: "tokenholderlist",
        contractaddress: address,
        page: curPage,
        offset: 10000,
        apikey
      }
    });

    if (response.data.status === "0") {
      break;
    }

    holders = holders.concat(
      response.data.result.flatMap((holder) =>
        validateHolder(holder, minUsdBalance, tokenInfo)
      )
    );
    curHolders = response.data.result.length;
  }
  return { holders };
}

/**
 * Convert days to block numbers (approximate)
 * @param {*} days
 */
export function secondsToBlocks(seconds) {
  const BINANCE_BLOCK_SECONDS = 3;
  return seconds / BINANCE_BLOCK_SECONDS;
}

/**
 * Validate holder balance (tokens * price) > minUsdBalance
 * @param {*} balance amount of tokens owned
 * @param {*} minUsdBalance min usd balance
 * @param {*} price usd price for token
 * @returns bool -
 */
function validateHolder(holder, minUsdBalance, tokenInfo) {
  if (holder["TokenHolderQuantity"].toString() === "0") {
    return [];
  }
  let decimals = new BigNumber(10).pow(tokenInfo.decimals);
  let balance = new BigNumber(holder["TokenHolderQuantity"]).dividedBy(
    decimals
  );
  let usdBalance = new BigNumber(balance).multipliedBy(tokenInfo.price);
  if (new BigNumber(usdBalance).gt(minUsdBalance)) {
    return [
      {
        holderAddress: holder["TokenHolderAddress"],
        tokenQuantity: balance.toString(),
        balanceInUsd: usdBalance.toFixed(4),
        priceUsd: tokenInfo.price
      }
    ];
  }
  return [];
}

/**
 * Get USD price of the token from PancakeSwap
 * @param {*} address
 * @returns
 */
export async function _getUsdPrice(address) {
  const url = `${pancakeSwapApi}/tokens/${address}`;
  const response = await axios.get(url);
  if (response.status !== 200) {
    return { error: response.statusText };
  }
  return { data: response.data.data };
}

export async function _getTokenInfo(address) {
  const { data } = await _getUsdPrice(address);

  const response = await axios.get(apiUrl, {
    params: {
      module: "token",
      action: "tokeninfo",
      contractaddress: address,
      apikey
    }
  });
  if (response.status === "0") {
    return { error: response.data.result };
  }
  console.log(response.data.result);
  DECIMALS = new BigNumber(10).pow(response.data.result[0].divisor);
  return {
    decimals: response.data.result[0].divisor,
    price: data.price
  };
}

/**
 * Filters holders by given criteria
 * @param {*} address
 * @param {*} holders
 * @param {*} days
 * @param {*} minTransaction
 */
export async function filterHolders(
  address, 
  liqPool,
  cex,
  holders, 
  seconds, 
  minTransaction
  ) {
  const filteredHolders = [];
  const { latestBlock } = await _getLatestBlock();
  const blocks = secondsToBlocks(seconds);
  console.log(seconds);

  console.log(`days: ${seconds} from: ${latestBlock - blocks} to: ${latestBlock}`);

  for (let [index, holder] of holders.entries()) {
    if (
      holder.tokenQuantity.toString() !== "0" ||
      new BigNumber(holder.balanceInUsd).gte(minTransaction)
    ) {
      console.log(`validating holder #${index} out of ${holders.length}...`)
      const minQuantity = new BigNumber(minTransaction)
        .dividedBy(holder.priceUsd)
        .multipliedBy(DECIMALS);
      const qualifies = await _filterTransfers(
        address,
        liqPool,
        cex,
        holder.holderAddress,
        latestBlock - blocks,
        latestBlock,
        minQuantity
      );
      if (qualifies && !qualifies.error) {
        if (holder.holderAddress !== liqPool && holder.holderAddress !== cex) {
          console.log("Adding holder with: " + holder.balanceInUsd);
          filteredHolders.push(holder);
        }
      }
    }
  }
  return filteredHolders;
}

async function _filterTransfers(
  contractAddress,
  liqPool,
  cex,
  address,
  from,
  to,
  minQuantity
) {
  const response = await axios.get(apiUrl, {
    params: {
      module: "account",
      action: "tokentx",
      startBlock: from,
      endBlock: to,
      address,
      contractaddress: contractAddress,
      apikey
    }
  });
  if (response.status === "0") {
    return { error: response.data.result };
  }
  let incoming = new BigNumber(0);

  let transfers = response.data.result;
  let counter = 0;
  
  if (liqPool || cex) {
    console.log('filtering by liq pool: ' + liqPool);
    while (incoming.lt(minQuantity) && counter < transfers.length) {
      if (transfers[counter].from === liqPool || transfers[counter].from === cex) {
        incoming = incoming.plus(new BigNumber(transfers[counter].value));
      }
      counter += 1;
    }
  
    if (incoming.gte(minQuantity)) {
      return true;
    }
    return false;
  } else {
    while (incoming.lt(minQuantity) && counter < transfers.length) {
      if (transfers[counter].to === address) {
        incoming = incoming.plus(new BigNumber(transfers[counter].value));
      }
      counter += 1;
    }
  
    if (incoming.gte(minQuantity)) {
      return true;
    }
    return false;
  }
}

/**
 * Get latest block number
 * @returns
 */
export async function _getLatestBlock() {
  const currentTimestamp = (new Date().getTime() / 1000) | 0;
  const response = await axios.get(apiUrl, {
    params: {
      module: "block",
      action: "getblocknobytime",
      timestamp: currentTimestamp,
      closest: "before",
      apikey
    }
  });

  if (response.status === "0") {
    return { error: response.data.result };
  }
  return { latestBlock: response.data.result };
}

/**
 *
 * @param {*} address
 * @param {*} minBalance
 * @param {*} seconds
 * @param {*} minTransaction
 * @param {*} curPage
 */
export async function getFilteredHolders(
  address,
  liqPool,
  cex,
  minBalance,
  seconds,
  minTransaction,
) {
  const response = await getAllHolders(address, minBalance);
  if (response.error) {
    console.log("Encountered error: " + response.error);
    return { error: "Encountered error" };
  }
  const { holders } = response;

  if (holders.length === 0) {
    return { done: true };
  }

  console.log("Holders that pass first filter (out of first 10k): " + holders.length);
  const filteredHolders = await filterHolders (
    address,
    liqPool,
    cex,
    holders,
    seconds,
    minTransaction
  );
  console.log("all holders count:" + filteredHolders.length);
  return filteredHolders;
}
