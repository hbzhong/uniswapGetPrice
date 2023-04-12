const { ethers } = require('ethers')
const { Token } = require('@uniswap/sdk-core')
const { Pool, Position, nearestUsableTick } = require('@uniswap/v3-sdk')
const { abi: IUniswapV3PoolABI }  = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const { abi: INonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json')
const { abi: UniswapV3Factory } = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
const ERC20ABI = require('./abi.json')

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.PROVIDE_URL
const WALLET_ADDRESS = process.env.WALLET_ADDR
const WALLET_SECRET = process.env.WALLET_SECRET
const chainId = 5

// 这个合约地址可以从 factoryContract.getPool
//const poolAddress = "0x07A4f63f643fE39261140DF5E613b9469eccEC86" // UNI/WETH
// 0x3D807E94BF75ddEfbed21C9f3DeC1ab80c26F28D  // ZETA/WETH
const poolAddress = "0x3D807E94BF75ddEfbed21C9f3DeC1ab80c26F28D";
const positionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" // NonfungiblePositionManager
const factoryAddress = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET)

const name0 = 'Wrapped Ether'
const symbol0 = 'WETH'
const decimals0 = 18
const address0 = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'

const name1 = 'Zeta'
const symbol1 = 'ZETA'
const decimals1 = 18
const address1 = '0xCc7bb2D219A0FC08033E130629C2B854b7bA9195'

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

async function getPoolData(poolContract) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ])

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  }
}


async function main() {
  console.log("hello world");

  const wallet = new ethers.Wallet(WALLET_SECRET)
  const connectedWallet = wallet.connect(provider)


  nonfungiblePositionManagerContract.connect(connectedWallet).positions(
    '62003'
  ).then((res) => {
    const totalLiquidity = res.liquidity;

    console.log(res);    
    
    params = {
      tokenId: 62003,
      liquidity: totalLiquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(Date.now()/1000) + 60*5
    }

    nonfungiblePositionManagerContract.connect(connectedWallet).decreaseLiquidity(
      params,
      { gasLimit: ethers.utils.hexlify(1000000) }
    ).then ((res) => {
      console.log(res);
    })
  })
}

main()
