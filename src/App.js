import "./styles.css";
import { getFilteredHolders  } from "./service";
import { getHoldersDifference } from "./covalent";
import { useState } from "react";
import Loader from "react-loader-spinner";
import xlsx from "xlsx";
import { saveAs } from "file-saver";

/**
 * Divide array into chunks
 * @returns 
 */

const toChunks = (array, parts) => {
  console.log("parts: " + parts);
  let result = [];
  for (let i = parts; i > 0; i--) {
      result.push(array.splice(0, Math.ceil(array.length / i)));
  }
  return result;
}

export default function App() {
  const [contract, setContract] = useState(
    "0x015804f45b4b465f364821623d04814fb9c68302"
  );
  const [from, setFrom] = useState("");
  const [minBalance, setMinBalance] = useState(1000);
  const [minTransaction, setMinTransaction] = useState(100);
  const [loading, setLoading] = useState(false);
  const [liqPool, setLiqPool] = useState("");
  const [cex, setCex] = useState('')
  const [filteredHolders, setFilteredHolders] = useState([]);
  const [amount, setAmount] = useState(69.69);
  const [fewHolders, setFewHolders] = useState(false);
  const [error, setError] = useState(null);

  const _diffSeconds = (a, b) => {
    const _MS_PER_SECOND = 1000;
      // Discard the time and time-zone information.
    const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

    return Math.floor((utc2 - utc1) / _MS_PER_SECOND);
  }
  const onSubmit = async (event) => {
    event.preventDefault();
    if (from === "") {
      return;
    }
    setError(null);
    setLoading(true);
    const diffSeconds = _diffSeconds(new Date(from), new Date());
    if (fewHolders) {
      const holders = await getHoldersDifference(
        contract,
        diffSeconds,
        minBalance,
        minTransaction
      );
      console.log(holders);
      if (holders.error) {
        setFilteredHolders([]);
        setError({message: holders.error || "Unknown error"});
        setLoading(false);
        return;
      }

      setFilteredHolders(holders);

      setLoading(false);
    } else {
      const holders = await getFilteredHolders(
        contract,
        liqPool,
        cex,
        minBalance,
        diffSeconds,
        minTransaction
      );
      console.log(holders);

      if (holders.error) {
        setFilteredHolders([]);
        setError({message: holders.error || "Unknown error"});
        setLoading(false);
        return ;
      }
      else if(holders.done) {
        setFilteredHolders([]);
        return ;
      }

      setFilteredHolders(holders);

      setLoading(false);
  }

  };

  const handleAirdrop = (event) => {
    event.preventDefault();
    // copy object so that it doesn't get removed during dividing in chunks
    const copiedHolders = filteredHolders.slice(0);
    const chunks = toChunks(copiedHolders, Math.ceil(copiedHolders.length/800));
    console.log('len: ' + copiedHolders.length);
    console.log(chunks);
    let elements = [];

    for (let [index, chunk] of chunks.entries()) {
      const element = document.createElement("a");
      console.log(chunk);
      const holdersArr = JSON.stringify(
        chunk.map((holder) => holder.holderAddress)
      );

      const amountVals = Array(chunk.length).fill(amount * 10 ** 18);
      const holders = new Blob(
        [holdersArr.replace(/['"]+/g, ""), `[${amountVals.toString()}]`],
        {
          type: "text/plain"
        }
      );
      element.href = URL.createObjectURL(holders);
      element.download = `holders-${contract}-${index}.txt`;
      document.body.appendChild(element);
      elements.push(element);
    };
    console.log(elements.length);
    let interval = setInterval(download, 300, elements);
    function download(elements) {
      let element = elements.pop();
      element.click();

      if (elements.length === 0) {
        clearInterval(interval);
      }
    }
  };

  const handleExportXlsx = async (event) => {
    event.preventDefault();
    const worksheet = xlsx.utils.json_to_sheet(filteredHolders);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, worksheet, "SheetJs");
    let buff = xlsx.write(wb, {
      bookType: "xlsx",
      bookSST: false,
      type: "array"
    });
    saveAs(new Blob([buff]), `holders-${contract}.xlsx`, {
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
            placeholder="liquidity pool"
            type="text"
            style={{ width: 370, marginBottom: 10 }}
            onChange={(e) => setLiqPool(e.target.value)}
          />
          <br />
          <input
            placeholder="CEX account"
            type="text"
            style={{ width: 370, marginBottom: 10 }}
            onChange={(e) => setCex(e.target.value)}
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
          <br/>
          <p>token has less than 20k holders?
            <br/>
            Note: This query uses different API than BscScan, so it might not be accurate
          </p>
          <input
            type="checkbox"
            onChange={() => setFewHolders(!fewHolders)}
            style={{ width: 370, marginBottom: 10 }}
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
        onClick={handleExportXlsx}
        style={{ width: 120, height: 30, marginBottom: 10, marginRight: 20 }}
      >
        Export xlsx
      </button>
      <button
        disabled={loading || !filteredHolders.length}
        onClick={handleAirdrop}
        style={{ width: 120, height: 30, marginBottom: 10 }}
      >
        Export airdrop
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
        {error ? (
          <div style={{color: "red"}}>
            Encountered following error:
            <br/>
            {error.message}
          </div>
        ): 
        <>
          <h3>Contract: {contract}</h3>
          <h4>Total count: {filteredHolders.length}</h4>
          <h4>Min balance (USD): {minBalance}</h4>
          <h4>Min buy transactions (USD): {minTransaction}</h4>
          <h4>Amount to airdrop: {amount}</h4>
          {filteredHolders.map((holder) => (
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
              {/* <div>
                <b>Historic balance at {from} (USD):</b> {holder.oldBalanceInUsd}
              </div> */}
              <div>
                <b>Price (USD)</b> : {holder.priceUsd}
              </div>
              <br />
            </div>
          ))}
        </>
        }
      </div>
    </div>
  );
}