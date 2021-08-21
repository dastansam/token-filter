import axios from "axios";
import BigNumber from "bignumber.js";

const apikey = "A1QGI6IXRG475CCBFA94ICN1SGBYHDNHII";
const apiUrl = "https://api.bscscan.com/api";
const pancakeSwapApi = "https://api.pancakeswap.info/api/v2";
const covalentApi = "https://api.covalenthq.com/v1";
const covalentKey = "ckey_33f53f3d98d1430b9f10dfe4158:";

let DECIMALS = 0;

export async function getHoldersDifference(
  address,
  days,
  minUsdBalance,
  minTransaction
) {
  const tokenInfo = await _getTokenInfo(address);
  const covalentUrl = `${covalentApi}/56/tokens/${address}/token_holders_changes/`;
  const { latestBlock } = await _getLatestBlock();
  const from = daysToBlocks(days);
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

  const minQuantity = new BigNumber(minTransaction)
    .dividedBy(tokenInfo.price)
    .multipliedBy(decimals);

  const minTxQuantity = new BigNumber(minUsdBalance)
    .dividedBy(tokenInfo.price)
    .multipliedBy(decimals);

  holders = holders.concat(
    response.data.data.items.flatMap((holder) =>
      filterHolder(holder, tokenInfo, minQuantity, minTxQuantity)
    )
  );

  console.log(response.data.data);

  while (!response.error && response.data.has_more) {
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

    holders = holders.concat(
      response.data.result.flatMap((holder) =>
        validateHolder(holder, minUsdBalance, tokenInfo)
      )
    );
  }

  console.log(holders.length);

  return { holders };
}

function filterHolder(holderObject, tokenInfo, minQuantity, minTxQuantity) {
  if (
    holderObject["next_balance"].toString() === "0" &&
    new BigNumber(holderObject["diff"]).lte(0)
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

/**
 *
 * @param {*} address
 * @param {*} minUsdBalance
 * @param {*} curPage
 */
async function getHoldersByPage(address, minUsdBalance, curPage) {
  const tokenInfo = await _getTokenInfo(address);
  let holders = [];

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
  if (response.status === "0") {
    return { error: response.data.result };
  }

  holders = holders.concat(
    response.data.result.flatMap((holder) =>
      validateHolder(holder, minUsdBalance, tokenInfo)
    )
  );
  return { holders };
}
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

  if (response.status === "0") {
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
function daysToBlocks(days) {
  const BINANCE_BLOCK_SECONDS = 3;
  const ONE_DAY_IN_SECONDS = 86400;
  return (ONE_DAY_IN_SECONDS * days) / BINANCE_BLOCK_SECONDS;
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
async function _getUsdPrice(address) {
  const url = `${pancakeSwapApi}/tokens/${address}`;
  const response = await axios.get(url);
  if (response.status !== 200) {
    return { error: response.statusText };
  }
  return { data: response.data.data };
}

async function _getTokenInfo(address) {
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
async function filterHolders(address, holders, days, minTransaction) {
  const filteredHolders = [];
  const { latestBlock } = await _getLatestBlock();
  const from = daysToBlocks(days);

  console.log(`days: ${days} from: ${latestBlock - from} to: ${latestBlock}`);

  for (let holder of holders) {
    if (
      holder.tokenQuantity.toString() !== "0" ||
      new BigNumber(holder.balanceInUsd).gte(minTransaction)
    ) {
      const minQuantity = new BigNumber(minTransaction)
        .dividedBy(holder.priceUsd)
        .multipliedBy(DECIMALS);
      const qualifies = await _filterTransfers(
        address,
        holder.holderAddress,
        latestBlock - from,
        latestBlock,
        minQuantity
      );
      if (qualifies && !qualifies.error) {
        console.log("pushing here: " + holder.balanceInUsd);
        filteredHolders.push(holder);
      }
    }
  }
  return filteredHolders;
}

async function _filterTransfers(
  contractAddress,
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
  while (incoming.lt(minQuantity) && counter < transfers.length) {
    if (transfers[counter].to === address.toString()) {
      incoming = incoming.plus(new BigNumber(transfers[counter].value));
    }
    counter += 1;
  }

  if (incoming.gte(minQuantity)) {
    return true;
  }
  return false;
}

/**
 * Get latest block number
 * @returns
 */
async function _getLatestBlock() {
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

export async function getHolders(address, minBalance, days, minTransaction) {
  const response = await getAllHolders(address, minBalance);

  if (response.error) {
    console.log("Encountered error: " + response.error);
    return;
  }
  const { holders } = response;
  console.log("first filter: " + holders.length);
  const filteredHolders = await filterHolders(
    address,
    holders,
    days,
    minTransaction
  );
  console.log("all holders count:" + holders.length);
  return filteredHolders;
}

/**
 *
 * @param {*} address
 * @param {*} minBalance
 * @param {*} days
 * @param {*} minTransaction
 * @param {*} curPage
 */
export async function getFilteredHolders(
  address,
  minBalance,
  days,
  minTransaction,
  curPage
) {
  const response = await getHoldersByPage(address, minBalance, curPage);
  if (response.error) {
    console.log("Encountered error: " + response.error);
    return { error: "Encountered error" };
  }
  const { holders } = response;

  if (holders.length === 0) {
    return { done: true };
  }

  console.log("first filter: " + holders.length);
  const filteredHolders = await filterHolders(
    address,
    holders,
    days,
    minTransaction
  );
  console.log("all holders count:" + filteredHolders.length);
  return filteredHolders;
}
