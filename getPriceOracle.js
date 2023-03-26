
// IMPORTS AND SETUP
const { abi: QuoterAbi } = require('@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json')
const { abi: Quoter2Abi } = require('@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json')
const { ethers } = require('ethers')

require('dotenv').config()


const WETH_ADDRESS = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';//'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC_ADDRESS = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';//'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
const QUOTER2_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
const INFURA_URL_MAINNET = 'https://arb-mainnet.g.alchemy.com/v2/dKULT3A2vNWeOl73D4I9sG3ANoTPmoxB'; //'https://eth-mainnet.g.alchemy.com/v2/aA6njjPpGijS8wprbUY7EavsuH7Fc2NM'

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_MAINNET)

const tokenIn = WETH_ADDRESS
const tokenOut = USDC_ADDRESS
// 修改费率获得的报价也不一样
// 500 == 0.05%, 3000 == 0.3%, 10000 = 
const fee = '500'
const amountIn = ethers.utils.parseEther('1');


const sqrtPriceLimitX96 = '0';

const quoter = new ethers.Contract(
    QUOTER_ADDRESS,
    QuoterAbi,
    provider
);

const quoter2 = new ethers.Contract(
  QUOTER2_ADDRESS,
  Quoter2Abi,
  provider
)

function sleep(delay) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delay);
  });
}

const main = async() => {
  while (true)
  {
    const  amountOut = await quoter.callStatic.quoteExactInputSingle (
      tokenIn,
      tokenOut,
      fee,
      amountIn,
      sqrtPriceLimitX96
    )

    console.log('amountOut', ethers.utils.formatUnits(amountOut.toString(), 6));

    console.log("----------------------------------------");
    
    const params = {
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      fee: fee,
      amountIn: amountIn,
      sqrtPriceLimitX96: sqrtPriceLimitX96
    }

    const output = await quoter2.callStatic.quoteExactInputSingle(params);
    console.log('amountOut', ethers.utils.formatUnits(output.amountOut.toString(), 6));
    console.log('gas ', output.gasEstimate.toString());

    await sleep(5);
  }
}

main()