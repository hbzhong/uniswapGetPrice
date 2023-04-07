

// TODO list: 如何计算gas 费用

// IMPORTS AND SETUP
const { abi: QuoterAbi } = require('@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json')
const { abi: V3SwapRouterABI } = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const { ethers } = require('ethers')
const axios = require('axios');

const { Pool, Position, nearestUsableTick } = require('@uniswap/v3-sdk')
const { abi: IUniswapV3PoolABI }  = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const { abi: INonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json')
const { abi: UniswapV3Factory } = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
//const ERC20ABI = require('./abi.json')

// https://thegraph.com/hosted-service/subgraph/uniswap/uniswap-v3
const SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';// 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-subgraph';
                     


TOKEN_IDS_QUERY = `
  {
    positions(where: {
      owner: '0xEc7D043c820051d6c0B85c319a354B2d2DD48831',
      pool: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443'
    }) {
      id
      owner
    }
  }
`
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
//const signer = new ethers.Wallet(process.env.WALLET_SECRET, provider);

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

//const router = new ethers.Contract(ROUTER_ADDR, V3SwapRouterABI);
const inputAmount = ethers.utils.parseEther('0.01');


const factoryAddress = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const factoryContract = new ethers.Contract(
  factoryAddress,
  UniswapV3Factory,
  provider
)

const main = async() => {

  // # 500 == 0.05%, 3000 == 0.3%, 10000 = 
  const poolAddress = await factoryContract.getPool(process.env.WETH_ADDR, process.env.USDC_ADDR, 500)
  console.log('poolAddress', poolAddress.toString())


  const result = await axios.post(SUBGRAPH_URL, {query: TOKEN_IDS_QUERY});
  console.log('result', result);

  const positions = result.data.data.positions;
  console.log('positions', positions);

}

main();