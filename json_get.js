/*
策略：
1.检测45分钟，没有越界。则进入组LP。
2.组LP的时间最长2小时，超过2小时就，找机会在进入的点退出。
3.如果越界则退出，swap拿回放进去的ETH。
*/

const { ethers } = require('ethers')
const { Token } = require('@uniswap/sdk-core')
const { TickMath, FullMath, Pool, Position, nearestUsableTick } = require('@uniswap/v3-sdk')
const { abi: IUniswapV3PoolABI }  = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const { abi: INonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json')
const { abi: UniswapV3Factory } = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
const JSBI = require('jsbi');
const readline = require('readline');
//const ERC20ABI = require('./abi.json')

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.PROVIDE_URL
const WALLET_ADDRESS = process.env.WALLET_ADDR
const WALLET_SECRET = process.env.WALLET_SECRET
const chainId = 42161


// 这个合约地址可以从 factoryContract.getPool
//const poolAddress = "0x07A4f63f643fE39261140DF5E613b9469eccEC86" // UNI/WETH
// 0x3D807E94BF75ddEfbed21C9f3DeC1ab80c26F28D  // ZETA/WETH
const poolAddress = "0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443";  // 需要修改
const positionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" // NonfungiblePositionManager
const factoryAddress = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET)

const name0 = 'Wrapped Ether'
const symbol0 = 'WETH'
const decimals0 = 18
const address0 = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'

const name1 = 'USD Coin'
const symbol1 = 'USDC'
const decimals1 = 6
const address1 = '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8'

const WethToken = new Token(chainId, address0, decimals0, symbol0, name0)
const UniToken = new Token(chainId, address1, decimals1, symbol1, name1)

const nonfungiblePositionManagerContract = new ethers.Contract(
  positionManagerAddress,
  INonfungiblePositionManagerABI,
  provider
)
const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
)

const factoryContract = new ethers.Contract(
  factoryAddress,
  UniswapV3Factory,
  provider
)


//second
function sleep(delay) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delay*1000);
  });
}



async function get_wallet_json()
{
  const wallet1 = new ethers.Wallet(WALLET_SECRET)  
  wallet1.encrypt("helloworld").then(function(json) {
    console.log(json);
  });
}

async function main() {

/*
  var monTickUpper;
  var monTickLower;  

  const poolAddress = await factoryContract.getPool(address1, address0,  500)
  console.log('poolAddress', poolAddress.toString())

  var poolData = await getPoolData(poolContract)
  console.log("fee:"+poolData.fee);

*/

  
  
}

//main()

get_wallet_json()
