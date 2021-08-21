import "./styles.css";
import { getFilteredHolders, getHolders } from "./service";
import { useState } from "react";
import Loader from "react-loader-spinner";
import xlsx from "xlsx";
import { saveAs } from "file-saver";

export default function App() {
  const [contract, setContract] = useState(
    "0x015804f45b4b465f364821623d04814fb9c68302"
  );
  const [from, setFrom] = useState("");
  const [minBalance, setMinBalance] = useState(10000);
  const [minTransaction, setMinTransaction] = useState(100);
  const [loading, setLoading] = useState(false);
  const [filteredHolders, setFilteredHolders] = useState([]);
  const [amount, setAmount] = useState(69.69);
  const [limitedHolders, setLimitedHolders] = useState([]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (from === "") {
      return;
    }
    setLoading(true);
    const diffTime = Math.abs(new Date(from) - new Date());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let curPage = 1;

    let tokenHolders = await getFilteredHolders(
      contract,
      minBalance,
      diffDays,
      minTransaction,
      curPage
    );

    handleAirdrop(tokenHolders, curPage);
    await handleExportXlsx(tokenHolders, curPage);

    setFilteredHolders(tokenHolders);
    while (true) {
      curPage += 1;
      tokenHolders = await getFilteredHolders(
        contract,
        minBalance,
        diffDays,
        minTransaction,
        curPage
      );
      if (tokenHolders.done || tokenHolders.error) {
        break;
      } else {
        handleAirdrop(tokenHolders, curPage);
        await handleExportXlsx(tokenHolders, curPage);
        setFilteredHolders(filteredHolders.concat(tokenHolders));
      }
    }

    setLoading(false);
  };

  const handleAirdrop = (tokenHolders, curPage, last = false) => {
    if (last) {
      const element = document.createElement("a");

      const holdersArr = JSON.stringify(
        tokenHolders.map((holder) => holder.holderAddress)
      );

      const amountVals = Array(tokenHolders.length).fill(amount * 10 ** 18);
      const holders = new Blob(
        [holdersArr.replace(/['"]+/g, ""), `[${amountVals.toString()}]`],
        {
          type: "text/plain"
        }
      );
      element.href = URL.createObjectURL(holders);
      element.download = `holders-${contract}-${curPage}.txt`;
      document.body.appendChild(element);
      element.click();
    }

    const totalHoldersNow = limitedHolders.concat(tokenHolders);

    if (totalHoldersNow.length < 800) {
      setLimitedHolders(totalHoldersNow);
      return;
    }
    setLimitedHolders(totalHoldersNow);
    // event.preventDefault();
    const element = document.createElement("a");
    // const elementAmounts = document.createElement("a");

    const holdersArr = JSON.stringify(
      totalHoldersNow.map((holder) => holder.holderAddress)
    );

    const amountVals = Array(totalHoldersNow.length).fill(amount * 10 ** 18);
    const holders = new Blob(
      [holdersArr.replace(/['"]+/g, ""), `[${amountVals.toString()}]`],
      {
        type: "text/plain"
      }
    );
    element.href = URL.createObjectURL(holders);
    element.download = `holders-${contract}-${curPage}.txt`;
    // elementAmounts.href = URL.createObjectURL(amounts);
    // elementAmounts.download = `amounts-${contract}.txt`;
    document.body.appendChild(element);
    // document.body.appendChild(elementAmounts);
    element.click();
    // elementAmounts.click();
  };

  const handleExportXlsx = async (tokenHolders, curPage) => {
    const worksheet = xlsx.utils.json_to_sheet(tokenHolders);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, worksheet, "SheetJs");
    let buff = xlsx.write(wb, {
      bookType: "xlsx",
      bookSST: false,
      type: "array"
    });
    saveAs(new Blob([buff]), `holders-${contract}-${curPage}.xlsx`, {
      type: "application/octet-stream"
    });
  };

  return (
    <div className="App">
      <h1>Filter contract token holders</h1>
      <h5>
        Populate all input fields and wait for the result. <br />
        Depending on the number of token holders of the smart contract, it might
        take some time to finish fetching and filtering token holders.
        <br />
        IMPORTANT: While the script is loading, don't reload the page
      </h5>
      <form onSubmit={onSubmit}>
        <fieldset disabled={loading}>
          <input
            placeholder="contract address"
            type="text"
            style={{ width: 370, marginBottom: 10 }}
            onChange={(e) => setContract(e.target.value)}
          />
          <br />
          <label htmlFor="from">From date:</label>
          <input
            id="from"
            type="date"
            style={{ width: 370, marginBottom: 10 }}
            onChange={(e) => setFrom(e.target.value)}
          />
          <br />
          <input
            placeholder="minimum balance in USD"
            type="number"
            style={{ width: 370, marginBottom: 10 }}
            onChange={(e) => setMinBalance(e.target.value)}
            step={0.01}
          />
          <br />
          <input
            placeholder="minimum buy transactions in USD"
            type="number"
            style={{ width: 370, marginBottom: 10 }}
            onChange={(e) => setMinTransaction(e.target.value)}
            step={0.01}
          />
          <br />
          <input
            placeholder="amount of tokens to airdrop"
            type="number"
            style={{ width: 370, marginBottom: 10 }}
            onChange={(e) => setAmount(e.target.value)}
            step={0.01}
          />
          <br />
          <button
            type="submit"
            disabled={loading}
            style={{ width: 100, height: 30, marginBottom: 10 }}
          >
            Query
          </button>
        </fieldset>
      </form>
      <button
        disabled={loading || !filteredHolders.length}
        onClick={() => handleExportXlsx(filteredHolders, "all")}
        style={{ width: 120, height: 80, marginBottom: 10, marginRight: 20 }}
      >
        Export all in one csv
      </button>
      <button
        disabled={loading || !filteredHolders.length}
        onClick={() => handleAirdrop(filteredHolders, "all")}
        style={{ width: 120, height: 80, marginBottom: 10 }}
      >
        Export to airdrops (800 addresses each)
      </button>
      <Loader
        type="TailSpin"
        color="#00BFFF"
        height={100}
        width={100}
        visible={loading}
      />
      <br />
      <div>
        <h3>Contract: {contract}</h3>
        <h4>Total count: {filteredHolders.length}</h4>
        <h4>Min balance (USD): {minBalance}</h4>
        <h4>Min buy transactions (USD): {minTransaction}</h4>
        <h4>Amount to airdrop: {amount}</h4>
        {/* {filteredHolders.map((holder) => (
          <div key={holder.holderAddress}>
            <div>
              <b>Holder address</b>: {holder.holderAddress}
            </div>
            <div>
              <b>Token quantity:</b> {holder.tokenQuantity}
            </div>
            <div>
              <b>Balance (USD):</b> {holder.balanceInUsd}
            </div>
            <div>
              <b>Price (USD)</b> : {holder.priceUsd}
            </div>
            <div>
              <b>Historic balance at {from} (USD):</b> {holder.balanceBefore}
            </div>
            <br />
          </div>
        ))} */}
      </div>
    </div>
  );
}
