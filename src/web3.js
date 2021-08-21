import Web3 from "web3";
import abi from "./abi";
const web3 = new Web3("https://bsc-dataseed1.binance.org:443");

async function getHistoricBalance(address) {
  const contract = new web3.eth.Contract(
    abi,
    "0x015804F45B4b465F364821623d04814fb9c68302"
  );

  console.log("provider: " + web3.currentProvider);

  const balance = await contract.balanceOf(
    "0x7d8AD7cea37D721360D7df9f9AF69d09274b37ea",
    {},
    9737343
  );

  console.log(balance);
  return balance;
}

getHistoricBalance().then((res) => {
  console.log(res);
});
