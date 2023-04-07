

// TODO list: 如何计算gas 费用

// IMPORTS AND SETUP
const { abi: QuoterAbi } = require('@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json')
const { abi: V3SwapRouterABI } = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const { ethers } = require('ethers')

require('dotenv').config()


const WETH_ADDRESS = process.env.WETH_ADDR; //'0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';//'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC_ADDRESS = process.env.USDC_ADDR; //'0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';//'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

// https://docs.uniswap.org/contracts/v3/reference/deployments 中给出查询合约的地址
const QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
const QUOTER2_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
const INFURA_URL_MAINNET = process.env.PROVIDE_URL;  //https://arb-mainnet.g.alchemy.com/v2/dKULT3A2vNWeOl73D4I9sG3ANoTPmoxB'; //'https://eth-mainnet.g.alchemy.com/v2/aA6njjPpGijS8wprbUY7EavsuH7Fc2NM'

const ROUTER_ADDR = process.env.ROUTER_ADDR;
//const 

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_MAINNET)
const signer = new ethers.Wallet(process.env.WALLET_SECRET, provider);

const tokenIn = WETH_ADDRESS;
const tokenOut = USDC_ADDRESS;
// 修改费率获得的报价也不一样
// 500 == 0.05%, 3000 == 0.3%, 10000 = 
const fee =  process.env.FEE;
const amountIn = ethers.utils.parseEther('1');


const sqrtPriceLimitX96 = '0';

const quoter = new ethers.Contract(
    QUOTER_ADDRESS,
    QuoterAbi,
    provider
);


function sleep(delay) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delay);
  });
}

const router = new ethers.Contract(ROUTER_ADDR, V3SwapRouterABI);
const inputAmount = ethers.utils.parseEther('0.01');


const main = async() => {
  // 5分钟
  const deadline = Math.floor(Date.now()/1000 + 60*5);

  const params = {
    tokenIn: WETH_ADDRESS,
    tokenOut: USDC_ADDRESS,
    fee: fee,
    recipient: process.env.WALLET_ADDR,
    deadline: deadline,
    amountIn: inputAmount,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  }

  // 直接使用ETH就可以交易，可以省点gas费用
  const data = router.interface.encodeFunctionData("exactInputSingle", [params])
  // 使用WETH进行交易，过一手
  //  const data = router.exactInputSingle(params);
  const txArgs = {
    to: process.env.ROUTER_ADDR,
    from: process.env.WALLET_ADDR,
    data: data,
    value: inputAmount,
    gasLimit:'1000000'
  }

  console.log("sending");
  const tx = await signer.sendTransaction(txArgs);
  const receipt = await tx.wait();
  console.log('complete....');
}

main();